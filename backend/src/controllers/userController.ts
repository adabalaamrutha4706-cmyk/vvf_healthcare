import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, 10);

export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const result = await query(
      'SELECT id, name, email, role, phone, is_active, created_at FROM users WHERE is_deleted = false ORDER BY id ASC'
    );
    return res.status(200).json({ users: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getDoctors = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Accessible by anyone authenticated (for scheduling dropdowns)
    const result = await query(
      `SELECT id, name, email, phone FROM users 
       WHERE role IN ('Doctor', 'Chief Doctor') AND is_active = true AND is_deleted = false 
       ORDER BY name ASC`
    );
    return res.status(200).json({ doctors: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;

    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Required fields (name, email, password, role) are missing.' });
    }

    // Check if email already exists
    const checkEmail = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (checkEmail.rows.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const pwdHash = hashPassword(password);

    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, name, email, role, phone, is_active, created_at`,
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

    return res.status(201).json({
      message: 'User created successfully.',
      user: newUser
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;

    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { id } = req.params;
    const { name, email, password, role, phone, is_active } = req.body;

    const existingResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = existingResult.rows[0];

    const newName = name !== undefined ? name : user.name;
    const newEmail = email !== undefined ? email : user.email;
    const newRole = role !== undefined ? role : user.role;
    const newPhone = phone !== undefined ? phone : user.phone;
    const newActive = is_active !== undefined ? is_active : user.is_active;

    let updateQuery = '';
    let params: any[] = [];

    if (password) {
      const pwdHash = hashPassword(password);
      updateQuery = `
        UPDATE users SET
          name = $1, email = $2, password_hash = $3, role = $4, phone = $5, is_active = $6
        WHERE id = $7 RETURNING id, name, email, role, phone, is_active, created_at
      `;
      params = [newName, newEmail, pwdHash, newRole, newPhone, newActive, id];
    } else {
      updateQuery = `
        UPDATE users SET
          name = $1, email = $2, role = $3, phone = $4, is_active = $5
        WHERE id = $6 RETURNING id, name, email, role, phone, is_active, created_at
      `;
      params = [newName, newEmail, newRole, newPhone, newActive, id];
    }

    const result = await query(updateQuery, params);
    const updatedUser = result.rows[0];

    await logAudit(
      adminId || null,
      'EDIT_USER',
      'users',
      updatedUser.id,
      `User '${newName}' details updated by Admin ${adminName}`,
      { changes: req.body }
    );

    return res.status(200).json({
      message: 'User updated successfully.',
      user: updatedUser
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const adminName = req.user?.name;

    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    const { id } = req.params;

    if (parseInt(id, 10) === adminId) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }

    const checkResult = await query(
      'SELECT id, name FROM users WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const userName = checkResult.rows[0].name;

    await query(
      `UPDATE users SET is_deleted = true, is_active = false, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      adminId || null,
      'DELETE_USER',
      'users',
      parseInt(id, 10),
      `User '${userName}' soft deleted by Admin ${adminName}`
    );

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
