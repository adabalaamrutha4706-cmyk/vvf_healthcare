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
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await query(
      'SELECT id, name, email, password_hash, role, is_active, is_deleted FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (user.is_deleted || !user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated or deleted.' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as any }
    );

    // Save login audit log
    await logAudit(user.id, 'USER_LOGIN', 'users', user.id, `User logged in: ${user.name}`);

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
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const deviceStr = req.headers['user-agent'] || 'Web Session';

      const insertResult = await query(
        `INSERT INTO attendance (user_id, punch_in, status, date, device_info)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user.id, now.toISOString(), 'active', dateStr, deviceStr]
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
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
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
    return res.status(200).json({ message: 'Logout successful.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    return res.status(200).json({ user: req.user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const punch = async (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
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
    const { targetUserId } = req.query; // If admin, can view others
    
    let queryUserId = userId;
    if (targetUserId && req.user?.role === 'Admin') {
      queryUserId = parseInt(targetUserId as string, 10);
    }

    if (!queryUserId) {
      return res.status(401).json({ error: 'User ID missing.' });
    }

    const attendanceRecords = await query(
      'SELECT * FROM attendance WHERE user_id = $1 ORDER BY punch_in DESC',
      [queryUserId]
    );

    return res.status(200).json({ records: attendanceRecords.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User context missing.' });
    }

    const { name, phone, password } = req.body;

    const existingResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = false',
      [userId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
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
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

