import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_vvf_healthcare_jwt_token_key_12345';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const result = await query(
      'SELECT id, name, email, password_hash, role, is_active, is_deleted FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const user = result.rows[0];

    if (user.is_deleted || !user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated or deleted.',
        errorCode: 'USER_INACTIVE'
      });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    // IP, Device, Session logging (hardened tracking for Superadmin)
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const clientDevice = req.headers['user-agent'] || 'Web Session';
    const nowStr = new Date().toISOString();

    // Store login metrics in DB
    await query(
      `UPDATE users SET last_login_at = $1, last_login_ip = $2, last_login_device = $3 WHERE id = $4`,
      [nowStr, clientIp, clientDevice, user.id]
    );

    // Save login audit log with details
    await logAudit(
      user.id,
      'USER_LOGIN',
      'users',
      user.id,
      `User logged in: ${user.name}`,
      {
        ipAddress: clientIp,
        deviceInfo: clientDevice,
        sessionTimestamp: nowStr,
        role: user.role
      }
    );

    // Check for existing active attendance session for the user
    try {
      const activePunch = await query(
        "SELECT * FROM attendance WHERE user_id = $1 AND status = 'active' LIMIT 1",
        [user.id]
      );

      if (activePunch.rows.length > 0) {
        const activeRecord = activePunch.rows[0];
        const punchInTime = new Date(activeRecord.punch_in);
        const punchOutTime = new Date();
        const diffMs = punchOutTime.getTime() - punchInTime.getTime();
        const durationMinutes = Math.round(diffMs / (1000 * 60));

        await query(
          `UPDATE attendance
           SET punch_out = $1, duration_minutes = $2, status = $3, close_reason = $4
           WHERE id = $5`,
          [punchOutTime.toISOString(), durationMinutes, 'completed', 'session_recovery', activeRecord.id]
        );
        
        await logAudit(
          user.id,
          'ATTENDANCE_SESSION_RECOVERY',
          'attendance',
          activeRecord.id,
          `Auto-recovered previous active session. Duration: ${durationMinutes} minutes`
        );
      }

      // Create new attendance session
      const dateStr = nowStr.split('T')[0];

      const insertResult = await query(
        `INSERT INTO attendance (user_id, punch_in, status, date, device_info)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.id, nowStr, 'active', dateStr, clientDevice]
      );

      if (insertResult.rows && insertResult.rows.length > 0) {
        await logAudit(
          user.id,
          'ATTENDANCE_SESSION_START',
          'attendance',
          insertResult.rows[0].id,
          'User attendance session started automatically on login'
        );
      }
    } catch (dbErr) {
      console.error('Failed to log attendance session on login:', dbErr);
    }

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      },
      // Backward compatibility keys
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      // Find active session
      try {
        const activePunchResult = await query(
          "SELECT * FROM attendance WHERE user_id = $1 AND status = 'active' LIMIT 1",
          [req.user.id]
        );

        if (activePunchResult.rows.length > 0) {
          const activeRecord = activePunchResult.rows[0];
          const punchInTime = new Date(activeRecord.punch_in);
          const punchOutTime = new Date();
          const diffMs = punchOutTime.getTime() - punchInTime.getTime();
          const durationMinutes = Math.round(diffMs / (1000 * 60));

          await query(
            `UPDATE attendance
             SET punch_out = $1, duration_minutes = $2, status = $3
             WHERE id = $4`,
            [punchOutTime.toISOString(), durationMinutes, 'completed', activeRecord.id]
          );

          await logAudit(
            req.user.id,
            'ATTENDANCE_SESSION_END',
            'attendance',
            activeRecord.id,
            `Attendance session ended on logout. Duration: ${durationMinutes} minutes`
          );
        }
      } catch (dbErr) {
        console.error('Failed to log attendance session on logout:', dbErr);
      }

      await logAudit(req.user.id, 'USER_LOGOUT', 'users', req.user.id, `User logged out: ${req.user.name}`);
    }
    res.clearCookie('token');
    return res.status(200).json({
      success: true,
      message: 'Logout successful.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
        errorCode: 'AUTH_REQUIRED'
      });
    }
    return res.status(200).json({
      success: true,
      data: { user: req.user },
      // Backward compatibility key
      user: req.user
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const punch = async (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      message: 'Manual punch is deprecated. Attendance is now automatically tracked via login session.',
      deprecated: true,
      record: {
        id: 0,
        user_id: req.user?.id,
        punch_in: new Date().toISOString(),
        punch_out: new Date().toISOString(),
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        duration_minutes: 0
      }
    },
    // Backward compatibility key
    message: 'Manual punch is deprecated. Attendance is now automatically tracked via login session.',
    deprecated: true,
    record: {
      id: 0,
      user_id: req.user?.id,
      punch_in: new Date().toISOString(),
      punch_out: new Date().toISOString(),
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      duration_minutes: 0
    }
  });
};

export const getAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const requesterRole = req.user?.role;
    const { targetUserId, search, role, status, startDate, endDate, lateOnly } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID missing.',
        errorCode: 'AUTH_REQUIRED'
      });
    }

    // Audit log for attendance access
    await logAudit(
      userId,
      'ATTENDANCE_ACCESS',
      'attendance',
      userId,
      `Attendance logs accessed by ${req.user?.name} (Role: ${requesterRole})`
    );

    // 1. Fetch all users to map names/roles
    const usersResult = await query('SELECT id, name, email, role, is_active FROM users WHERE is_deleted = false');
    const userMap = new Map<number, any>();
    usersResult.rows.forEach((u: any) => {
      userMap.set(u.id, u);
    });

    // 2. Fetch all attendance records sorted by punch_in DESC
    const attendanceResult = await query('SELECT * FROM attendance ORDER BY punch_in DESC');
    let records = attendanceResult.rows;

    // 3. Filter by role-based authorization
    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      // Normal staff only see their own attendance
      records = records.filter((r: any) => r.user_id === userId);
    } else if (targetUserId) {
      records = records.filter((r: any) => r.user_id === parseInt(targetUserId as string, 10));
    }

    // 4. Conceal Superadmin details from standard Admin users (Superadmin role is hidden)
    if (requesterRole === 'Admin') {
      records = records.filter((r: any) => {
        const u = userMap.get(r.user_id);
        return !u || u.role !== 'Superadmin';
      });
    }

    // 5. Enrich records with user details
    let enriched = records.map((r: any) => {
      const u = userMap.get(r.user_id);
      return {
        ...r,
        user_name: u ? u.name : 'Unknown User',
        user_role: u ? u.role : 'Unknown Role',
        user_email: u ? u.email : ''
      };
    });

    // 6. Apply filters for Admin/Superadmin
    if (requesterRole === 'Admin' || requesterRole === 'Superadmin') {
      if (search) {
        const searchLower = (search as string).toLowerCase();
        enriched = enriched.filter((r: any) => 
          r.user_name.toLowerCase().includes(searchLower) ||
          String(r.user_id).includes(searchLower) ||
          r.user_email.toLowerCase().includes(searchLower)
        );
      }

      if (role) {
        enriched = enriched.filter((r: any) => r.user_role === role);
      }

      if (status) {
        enriched = enriched.filter((r: any) => {
          const isRecordActive = r.status === 'active' || !r.punch_out;
          if (status === 'active') return isRecordActive;
          if (status === 'completed') return !isRecordActive;
          return true;
        });
      }

      if (startDate) {
        const start = new Date(startDate as string).getTime();
        enriched = enriched.filter((r: any) => new Date(r.punch_in).getTime() >= start);
      }

      if (endDate) {
        const end = new Date(endDate as string).getTime() + 24 * 60 * 60 * 1000; // include full end date
        enriched = enriched.filter((r: any) => new Date(r.punch_in).getTime() <= end);
      }

      if (lateOnly === 'true') {
        enriched = enriched.filter((r: any) => {
          const punchInDate = new Date(r.punch_in);
          const hours = punchInDate.getHours();
          const minutes = punchInDate.getMinutes();
          return (hours > 9) || (hours === 9 && minutes > 30);
        });
      }
    }

    // 7. Calculate statistics based on the matching pool
    const totalRecords = enriched.length;
    const activeCount = enriched.filter((r: any) => r.status === 'active' || !r.punch_out).length;
    const completedCount = enriched.filter((r: any) => r.status === 'completed' || r.punch_out).length;
    const lateCount = enriched.filter((r: any) => {
      const punchInDate = new Date(r.punch_in);
      const hours = punchInDate.getHours();
      const minutes = punchInDate.getMinutes();
      return (hours > 9) || (hours === 9 && minutes > 30);
    }).length;

    // 8. Paginate the enriched list
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const startIndex = (page - 1) * limit;
    const paginatedRecords = enriched.slice(startIndex, startIndex + limit);

    const payload = {
      records: paginatedRecords,
      total: totalRecords,
      page,
      limit,
      totalPages: Math.ceil(totalRecords / limit),
      activeCount,
      completedCount,
      lateCount
    };

    return res.status(200).json({
      success: true,
      data: payload,
      // Backward compatibility keys
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User context missing.',
        errorCode: 'AUTH_REQUIRED'
      });
    }

    const { name, phone, password } = req.body;

    const existingResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = false',
      [userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = existingResult.rows[0];

    const newName = name !== undefined ? name : user.name;
    const newPhone = phone !== undefined ? phone : user.phone;

    let updateQuery = '';
    let params: any[] = [];

    if (password) {
      const pwdHash = bcrypt.hashSync(password, 10);
      updateQuery = `
        UPDATE users SET
          name = $1, phone = $2, password_hash = $3
        WHERE id = $4 RETURNING id, name, email, role, phone, is_active, created_at
      `;
      params = [newName, newPhone, pwdHash, userId];
    } else {
      updateQuery = `
        UPDATE users SET
          name = $1, phone = $2
        WHERE id = $3 RETURNING id, name, email, role, phone, is_active, created_at
      `;
      params = [newName, newPhone, userId];
    }

    const result = await query(updateQuery, params);
    const updatedUser = result.rows[0];

    await logAudit(
      userId,
      'UPDATE_PROFILE',
      'users',
      userId,
      `User '${newName}' self-updated profile settings`
    );

    return res.status(200).json({
      success: true,
      data: { user: updatedUser },
      user: updatedUser
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
