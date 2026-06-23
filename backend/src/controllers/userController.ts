import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { validateEmployee } from '../utils/employeeValidator';
import { rebalanceLeadsAcrossTelecallers } from '../utils/leadAssignmentHelper';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requesterRole = req.user?.role;
    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // 1. Fetch users (filter out Superadmin role for standard Admins to maintain concealment)
    let usersQuery = 'SELECT id, name, email, role, phone, is_active, password_change_count, password_change_limit, password_change_locked, monthly_target, created_at FROM users WHERE is_deleted = false';
    const queryParams: any[] = [];

    if (requesterRole === 'Admin') {
      usersQuery += " AND role != 'Superadmin'";
    }

    usersQuery += ' ORDER BY id ASC';
    const usersResult = await query(usersQuery, queryParams);

    // 2. Fetch all attendance records ordered by punch_in DESC
    const attendanceResult = await query('SELECT * FROM attendance ORDER BY punch_in DESC');
    
    // Group by user_id to get the latest record for each user
    const latestAttendanceMap = new Map<number, any>();
    attendanceResult.rows.forEach((record: any) => {
      if (!latestAttendanceMap.has(record.user_id)) {
        latestAttendanceMap.set(record.user_id, record);
      }
    });

    // 3. Map users to attach live status metrics
    const enrichedUsers = usersResult.rows.map((u: any) => {
      const latest = latestAttendanceMap.get(u.id);
      
      let currentSessionStatus = 'Inactive';
      let lastLoginTime = null;
      let lastLogoutTime = null;
      let currentSessionDuration = 0;

      if (latest) {
        lastLoginTime = latest.punch_in;
        lastLogoutTime = latest.punch_out;
        
        if (latest.status === 'active' || !latest.punch_out) {
          currentSessionStatus = 'Active';
          const diffMs = new Date().getTime() - new Date(latest.punch_in).getTime();
          currentSessionDuration = Math.round(Math.max(0, diffMs / (1000 * 60)));
        }
      }

      return {
        ...u,
        current_session_status: currentSessionStatus,
        last_login_time: lastLoginTime,
        last_logout_time: lastLogoutTime,
        current_session_duration: currentSessionDuration
      };
    });

    return res.status(200).json({
      success: true,
      data: { users: enrichedUsers },
      users: enrichedUsers
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getDoctors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Returns only Doctor-role users for Doctor appointment scheduling
    const result = await query(
      `SELECT id, name, email, phone, role FROM users 
       WHERE role = 'Doctor' AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { doctors: result.rows },
      doctors: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getDentists = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role FROM users 
       WHERE role = 'Dental Doctor' AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { dentists: result.rows },
      dentists: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getExecutives = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role FROM users 
       WHERE role = 'Executive' AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { executives: result.rows },
      executives: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getTelecallers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role FROM users 
       WHERE role = 'Telecaller' AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { telecallers: result.rows },
      telecallers: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;
    const requesterRole = req.user?.role;

    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Required fields (name, email, password, role) are missing.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const validation = validateEmployee({ name, phone });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: Object.values(validation.errors)[0],
        errors: validation.errors,
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Role Escalation Prevention: standard Admins cannot assign the Superadmin role
    if (role === 'Superadmin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only Superadmins can assign the Superadmin role.',
        errorCode: 'ROLE_ESCALATION_BLOCKED'
      });
    }

    // Check if email already exists
    const checkEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (checkEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered.',
        errorCode: 'EMAIL_ALREADY_EXISTS'
      });
    }

    const pwdHash = hashPassword(password);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active, password_change_count, password_change_limit, password_change_locked)
       VALUES ($1, $2, $3, $4, $5, true, 0, 3, false) RETURNING id, name, email, role, phone, is_active, password_change_count, password_change_limit, password_change_locked, created_at`,
      [name, email, pwdHash, role, phone || '']
    );

    const newUser = result.rows[0];

    await logAudit(
      adminId || null,
      'CREATE_USER',
      'users',
      newUser.id,
      `User '${name}' with role '${role}' created by Admin ${adminName}`
    );

    if (role === 'Telecaller') {
      await rebalanceLeadsAcrossTelecallers('New Telecaller Created').catch(err => console.error('Error during auto-rebalance on createUser:', err));
    }

    return res.status(201).json({
      success: true,
      data: { user: newUser }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;
    const requesterRole = req.user?.role;

    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;
    const { name, email, password, role, phone, is_active, password_change_count, password_change_limit, password_change_locked, monthly_target } = req.body;

    const existingResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = existingResult.rows[0];

    // Superadmin Concealment: Admins cannot access or update Superadmins (throw 404)
    if (user.role === 'Superadmin' && requesterRole !== 'Superadmin') {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    // Role Escalation Prevention: standard Admins cannot elevate a user to Superadmin
    if (role === 'Superadmin' && user.role !== 'Superadmin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized. Only Superadmins can assign the Superadmin role.',
        errorCode: 'ROLE_ESCALATION_BLOCKED'
      });
    }

    const currentCount = user.password_change_count != null ? parseInt(String(user.password_change_count), 10) : 0;
    const currentLimit = user.password_change_limit != null ? parseInt(String(user.password_change_limit), 10) : 3;
    const currentLocked = user.password_change_locked === true || String(user.password_change_locked).toLowerCase() === 'true';

    const reqCount = password_change_count !== undefined ? parseInt(String(password_change_count), 10) : currentCount;
    const reqLimit = password_change_limit !== undefined ? parseInt(String(password_change_limit), 10) : currentLimit;
    const reqLocked = password_change_locked !== undefined ? (password_change_locked === true || String(password_change_locked).toLowerCase() === 'true') : currentLocked;

    if (requesterRole !== 'Superadmin') {
      const isAlteringCount = password_change_count !== undefined && parseInt(String(password_change_count), 10) !== currentCount;
      const isAlteringLimit = password_change_limit !== undefined && parseInt(String(password_change_limit), 10) !== currentLimit;
      const isAlteringLock = password_change_locked !== undefined && (password_change_locked === true || String(password_change_locked).toLowerCase() === 'true') !== currentLocked;
      
      if (isAlteringCount || isAlteringLimit || isAlteringLock) {
        const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
        await logAudit(
          adminId || null,
          'PASSWORD_CHANGE_DENIED',
          'users',
          user.id,
          `Admin ${adminName} attempted to bypass password limits/lock status for employee ${user.name} - BLOCKED`,
          {
            employeeId: user.id,
            employeeName: user.name,
            employeeRole: user.role,
            action: 'PASSWORD_CHANGE_DENIED',
            ipAddress: clientIp,
            performedBy: { id: adminId, name: adminName, role: requesterRole }
          }
        );
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only Superadmins can manually unlock or reset the password-change counter.',
          errorCode: 'SUPERADMIN_ONLY_ACTION'
        });
      }
    }

    const newName = name !== undefined ? name : user.name;
    const newEmail = email !== undefined ? email : user.email;
    const newRole = role !== undefined ? role : user.role;
    const newPhone = phone !== undefined ? phone : user.phone;
    const newActive = is_active !== undefined ? is_active : user.is_active;

    // Only validate name and phone if they are being modified in the request
    if (name !== undefined || phone !== undefined) {
      const validation = validateEmployee({ name: newName, phone: newPhone });
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: Object.values(validation.errors)[0],
          errors: validation.errors,
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    const newTarget = monthly_target !== undefined ? parseInt(String(monthly_target), 10) : user.monthly_target;

    let updateQuery = '';
    let params: any[] = [];

    if (password) {
      const pwdHash = hashPassword(password);
      updateQuery = `
        UPDATE users SET
          name = $1, email = $2, password_hash = $3, role = $4, phone = $5, is_active = $6,
          password_change_count = $7, password_change_limit = $8, password_change_locked = $9,
          monthly_target = $10
        WHERE id = $11 RETURNING id, name, email, role, phone, is_active, password_change_count, password_change_limit, password_change_locked, monthly_target, created_at
      `;
      params = [newName, newEmail, pwdHash, newRole, newPhone, newActive, reqCount, reqLimit, reqLocked, newTarget, id];
    } else {
      updateQuery = `
        UPDATE users SET
          name = $1, email = $2, role = $3, phone = $4, is_active = $5,
          password_change_count = $6, password_change_limit = $7, password_change_locked = $8,
          monthly_target = $9
        WHERE id = $10 RETURNING id, name, email, role, phone, is_active, password_change_count, password_change_limit, password_change_locked, monthly_target, created_at
      `;
      params = [newName, newEmail, newRole, newPhone, newActive, reqCount, reqLimit, reqLocked, newTarget, id];
    }

    const result = await query(updateQuery, params);
    const updatedUser = result.rows[0];

    if (password) {
      const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
      await logAudit(
        adminId || null,
        'PASSWORD_CHANGED',
        'users',
        updatedUser.id,
        `Password reset for user ${newName} performed by Admin/Superadmin ${adminName}`,
        {
          employeeId: updatedUser.id,
          employeeName: newName,
          employeeRole: newRole,
          action: 'PASSWORD_CHANGED',
          ipAddress: clientIp,
          performedBy: { id: adminId, name: adminName, role: requesterRole }
        }
      );
    }

    await logAudit(
      adminId || null,
      'EDIT_USER',
      'users',
      updatedUser.id,
      `User '${newName}' details updated by Admin ${adminName}`,
      { changes: req.body }
    );

    if (user.role === 'Telecaller' || updatedUser.role === 'Telecaller') {
      if (user.role !== updatedUser.role || user.is_active !== updatedUser.is_active) {
        let reason = 'Telecaller Profile Updated';
        if (user.role !== updatedUser.role) {
          reason = 'Telecaller Role Updated';
        } else if (!user.is_active && updatedUser.is_active) {
          reason = 'Telecaller Activated';
        } else if (user.is_active && !updatedUser.is_active) {
          reason = 'Telecaller Deactivated';
        }
        await rebalanceLeadsAcrossTelecallers(reason).catch(err => console.error('Error during auto-rebalance on updateUser:', err));
      }
    }

    return res.status(200).json({
      success: true,
      data: { user: updatedUser }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;
    const requesterRole = req.user?.role;

    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;

    if (parseInt(id, 10) === adminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own admin account.',
        errorCode: 'SELF_DELETION_BLOCKED'
      });
    }

    const checkResult = await query(
      'SELECT id, name, role FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = checkResult.rows[0];

    // Superadmin Concealment: Admins cannot delete Superadmins (throw 404)
    if (user.role === 'Superadmin' && requesterRole !== 'Superadmin') {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    await query(
      `UPDATE users SET is_deleted = true, is_active = false, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      adminId || null,
      'DELETE_USER',
      'users',
      parseInt(id, 10),
      `User '${user.name}' soft deleted by Admin ${adminName}`
    );

    if (user.role === 'Telecaller') {
      await rebalanceLeadsAcrossTelecallers('Telecaller Deleted').catch(err => console.error('Error during auto-rebalance on deleteUser:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Recovery / Restore soft-deleted users (Admin & Superadmin only)
export const restoreUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;
    const requesterRole = req.user?.role;
    const { id } = req.params;

    if (requesterRole !== 'Admin' && requesterRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const checkResult = await query(
      'SELECT id, name, role, is_deleted FROM users WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = checkResult.rows[0];

    // Superadmin Concealment
    if (user.role === 'Superadmin' && requesterRole !== 'Superadmin') {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    if (!user.is_deleted) {
      return res.status(400).json({
        success: false,
        message: 'User is already active.',
        errorCode: 'ALREADY_ACTIVE'
      });
    }

    await query(
      'UPDATE users SET is_deleted = false, is_active = true, deleted_at = NULL WHERE id = $1',
      [id]
    );

    await logAudit(
      adminId || null,
      'RESTORE_USER',
      'users',
      parseInt(id, 10),
      `User '${user.name}' restored by Admin ${adminName}`
    );

    if (user.role === 'Telecaller') {
      await rebalanceLeadsAcrossTelecallers('Telecaller Restored').catch(err => console.error('Error during auto-rebalance on restoreUser:', err));
    }

    return res.status(200).json({
      success: true,
      message: 'User restored successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getTechnicians = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, name, email, phone, role FROM users 
       WHERE role IN ('OP Technician', 'SOP Technician') AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({
      success: true,
      data: { technicians: result.rows },
      technicians: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

