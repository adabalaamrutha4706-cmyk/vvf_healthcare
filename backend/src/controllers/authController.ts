import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { USER_PROFILE_SELECT, sanitizeUserProfile } from '../utils/userProfile';

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
      `SELECT id, name, email, password_hash, role, phone, personal_email, age, date_of_birth, gender, about, is_active, is_deleted FROM users WHERE email = $1`,
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
        "SELECT * FROM attendance WHERE user_id = $1 AND status = 'active' AND is_deleted = false LIMIT 1",
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

    const publicUser = sanitizeUserProfile(user);

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: publicUser
      },
      // Backward compatibility keys
      token,
      user: publicUser
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
          "SELECT * FROM attendance WHERE user_id = $1 AND status = 'active' AND is_deleted = false LIMIT 1",
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

export const autoLogout = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user) {
      // Find active session
      try {
        const activePunchResult = await query(
          "SELECT * FROM attendance WHERE user_id = $1 AND status = 'active' AND is_deleted = false LIMIT 1",
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
             SET punch_out = $1, duration_minutes = $2, status = $3, close_reason = $4
             WHERE id = $5`,
            [punchOutTime.toISOString(), durationMinutes, 'completed', 'auto_logout', activeRecord.id]
          );

          await logAudit(
            req.user.id,
            'ATTENDANCE_SESSION_END',
            'attendance',
            activeRecord.id,
            `Attendance session ended on auto logout. Duration: ${durationMinutes} minutes`
          );
        }
      } catch (dbErr) {
        console.error('Failed to log attendance session on auto logout:', dbErr);
      }

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

      await logAudit(
        req.user.id,
        'AUTO_LOGOUT',
        'users',
        req.user.id,
        'Automatic logout executed at 10:30 PM',
        {
          userName: req.user.name,
          role: req.user.role,
          date: dateStr,
          time: '22:30:00',
          actual_time: timeStr
        }
      );
    }
    res.clearCookie('token');
    return res.status(200).json({
      success: true,
      message: 'Automatic logout successful.'
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

    const result = await query(
      `SELECT ${USER_PROFILE_SELECT} FROM users WHERE id = $1 AND is_deleted = false`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const publicUser = sanitizeUserProfile(result.rows[0]);

    return res.status(200).json({
      success: true,
      data: { user: publicUser },
      // Backward compatibility key
      user: publicUser
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
    const { targetUserId, search, role, status, startDate, endDate, lateOnly, hospital_id } = req.query;

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
    const attendanceResult = await query('SELECT * FROM attendance WHERE is_deleted = false ORDER BY punch_in DESC');
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

    // 6. Apply filters
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

      if (lateOnly === 'true') {
        enriched = enriched.filter((r: any) => {
          const punchInDate = new Date(r.punch_in);
          const hours = punchInDate.getHours();
          const minutes = punchInDate.getMinutes();
          return (hours > 9) || (hours === 9 && minutes > 30);
        });
      }
    }

    // Date filters apply to all roles (including normal staff self-monitoring)
    if (startDate) {
      const [y, m, d] = (startDate as string).split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)).getTime();
      enriched = enriched.filter((r: any) => new Date(r.punch_in).getTime() >= start);
    }

    if (endDate) {
      const [y, m, d] = (endDate as string).split('-').map(Number);
      const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).getTime();
      enriched = enriched.filter((r: any) => new Date(r.punch_in).getTime() <= end);
    }

    // Hospital filter (dynamic association mapping)
    if (hospital_id && hospital_id !== 'All') {
      const targetHospId = parseInt(hospital_id as string, 10);
      
      // Get all doctors/receptionists/creators associated with this hospital via appointments
      const appUsers = await query(
        'SELECT DISTINCT doctor_id, created_by FROM appointments WHERE hospital_id = $1 AND is_deleted = false',
        [targetHospId]
      );
      const userIdsInHospital = new Set<number>();
      appUsers.rows.forEach((row: any) => {
        if (row.doctor_id) userIdsInHospital.add(row.doctor_id);
        if (row.created_by) userIdsInHospital.add(row.created_by);
      });

      // Get all executives associated with this hospital via visits
      const visitUsers = await query(
        'SELECT DISTINCT executive_id FROM visits WHERE hospital_id = $1 AND is_deleted = false',
        [targetHospId]
      );
      visitUsers.rows.forEach((row: any) => {
        if (row.executive_id) userIdsInHospital.add(row.executive_id);
      });

      enriched = enriched.filter((r: any) => userIdsInHospital.has(r.user_id));
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

    const { name, phone, password, personal_email, age, date_of_birth, gender, about } = req.body;

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
    const newPersonalEmail = personal_email !== undefined ? personal_email : user.personal_email;
    const newAge = age !== undefined && age !== '' ? parseInt(String(age), 10) : user.age;
    const newDob = date_of_birth !== undefined ? date_of_birth : user.date_of_birth;
    const newGender = gender !== undefined ? gender : user.gender;
    const newAbout = about !== undefined ? about : user.about;

    let updateQuery = '';
    let params: any[] = [];

    let newCount = user.password_change_count;
    let newLocked = user.password_change_locked;

    if (password) {
      if (user.role !== 'Superadmin' && (user.password_change_locked || user.password_change_count >= user.password_change_limit)) {
        const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
        await logAudit(
          userId,
          'PASSWORD_CHANGE_DENIED',
          'users',
          userId,
          `Password change attempt blocked: limit of ${user.password_change_limit} attempts reached for ${user.name}`,
          {
            employeeId: user.id,
            employeeName: user.name,
            employeeRole: user.role,
            action: 'PASSWORD_CHANGE_DENIED',
            ipAddress: clientIp,
            performedBy: { id: user.id, name: user.name, role: user.role }
          }
        );
        return res.status(403).json({
          success: false,
          message: 'Password Change Limit Reached: This employee has already used all 3 password change attempts. Please contact the HPS Team or System Administrator.',
          errorCode: 'PASSWORD_CHANGE_LIMIT_REACHED'
        });
      }

      if (user.role !== 'Superadmin') {
        newCount = user.password_change_count + 1;
        if (newCount >= user.password_change_limit) {
          newLocked = true;
        }
      }

      const pwdHash = bcrypt.hashSync(password, 10);
      updateQuery = `
        UPDATE users SET
          name = $1, phone = $2, personal_email = $3, age = $4, date_of_birth = $5, gender = $6, about = $7, password_hash = $8,
          password_change_count = $9, password_change_locked = $10
        WHERE id = $11 RETURNING ${USER_PROFILE_SELECT}
      `;
      params = [newName, newPhone, newPersonalEmail, newAge, newDob, newGender, newAbout, pwdHash, newCount, newLocked, userId];
    } else {
      updateQuery = `
        UPDATE users SET
          name = $1, phone = $2, personal_email = $3, age = $4, date_of_birth = $5, gender = $6, about = $7
        WHERE id = $8 RETURNING ${USER_PROFILE_SELECT}
      `;
      params = [newName, newPhone, newPersonalEmail, newAge, newDob, newGender, newAbout, userId];
    }

    const result = await query(updateQuery, params);
    const updatedUser = sanitizeUserProfile(result.rows[0]);

    if (password) {
      const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      await logAudit(
        userId,
        'PASSWORD_CHANGED',
        'users',
        userId,
        `Password changed self-service by ${user.name}`,
        {
          employeeId: user.id,
          employeeName: user.name,
          employeeRole: user.role,
          action: 'PASSWORD_CHANGED',
          ipAddress: clientIp,
          performedBy: { id: user.id, name: user.name, role: user.role }
        }
      );

      if (newLocked && !user.password_change_locked) {
        await logAudit(
          userId,
          'PASSWORD_LIMIT_REACHED',
          'users',
          userId,
          `Password change limit reached for ${user.name}`,
          {
            employeeId: user.id,
            employeeName: user.name,
            employeeRole: user.role,
            action: 'PASSWORD_LIMIT_REACHED',
            ipAddress: clientIp,
            performedBy: { id: user.id, name: user.name, role: user.role }
          }
        );
      }
    } else {
      await logAudit(
        userId,
        'UPDATE_PROFILE',
        'users',
        userId,
        `User '${newName}' self-updated profile settings`
      );
    }

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

export const uploadProfilePhoto = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User context missing.',
        errorCode: 'AUTH_REQUIRED'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded.',
        errorCode: 'PHOTO_REQUIRED'
      });
    }

    // Strong file validation
    if (req.file.size <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is empty or corrupted.',
        errorCode: 'INVALID_FILE'
      });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Supported image types are JPEG, PNG, and WEBP.',
        errorCode: 'INVALID_FILE_TYPE'
      });
    }

    const filename = req.file.filename;
    const photoUrl = `/uploads/profiles/${filename}`;

    const updateResult = await query(
      `UPDATE users SET photo_url = $1 WHERE id = $2 RETURNING ${USER_PROFILE_SELECT}`,
      [photoUrl, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const updatedUser: any = sanitizeUserProfile(updateResult.rows[0]);

    await logAudit(
      userId,
      'UPDATE_PROFILE_PHOTO',
      'users',
      userId,
      `User '${updatedUser.name}' updated profile photo`
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

export const requestPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Find active user by email
    const result = await query(
      'SELECT id, name, role FROM users WHERE email = $1 AND is_deleted = false',
      [email]
    );

    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';

    if (result.rows.length === 0) {
      // Generic success to prevent email verification harvesting attacks
      return res.status(200).json({
        success: true,
        message: 'Password reset request registered. Please contact the HPS Team or System Administrator.'
      });
    }

    const employee = result.rows[0];

    // Log the PASSWORD_RESET_REQUESTED audit entry
    await logAudit(
      null, // Unauthenticated user action
      'PASSWORD_RESET_REQUESTED',
      'users',
      employee.id,
      `Password reset assistance requested for ${employee.name} (${employee.role})`,
      {
        employeeId: employee.id,
        employeeName: employee.name,
        employeeRole: employee.role,
        action: 'PASSWORD_RESET_REQUESTED',
        ipAddress: clientIp,
        performedBy: { id: null, name: 'Self (Unauthenticated)', role: 'Guest' }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset request registered. Please contact the HPS Team or System Administrator.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

