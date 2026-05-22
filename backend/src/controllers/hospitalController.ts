import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

export const getHospitals = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM hospitals WHERE is_deleted = false ORDER BY name ASC'
    );
    return res.status(200).json({ hospitals: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getHospitalById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT * FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    return res.status(200).json({ hospital: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const createHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin can add hospitals
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    const { name, city, state, contact_person, phone, status } = req.body;

    if (!name || !city || !state) {
      return res.status(400).json({ error: 'Name, city, and state are required.' });
    }

    const result = await query(
      `INSERT INTO hospitals (name, city, state, contact_person, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, city, state, contact_person || '', phone || '', status || 'Active']
    );

    const hospital = result.rows[0];

    await logAudit(
      userId || null,
      'CREATE_HOSPITAL',
      'hospitals',
      hospital.id,
      `Hospital '${name}' created by ${userName}`
    );

    return res.status(201).json({
      message: 'Hospital created successfully.',
      hospital
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const updateHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin can update hospitals
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    const { id } = req.params;
    const { name, city, state, contact_person, phone, status } = req.body;

    const existingResult = await query(
      'SELECT * FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const hospital = existingResult.rows[0];

    const newName = name !== undefined ? name : hospital.name;
    const newCity = city !== undefined ? city : hospital.city;
    const newState = state !== undefined ? state : hospital.state;
    const newContact = contact_person !== undefined ? contact_person : hospital.contact_person;
    const newPhone = phone !== undefined ? phone : hospital.phone;
    const newStatus = status !== undefined ? status : hospital.status;

    const result = await query(
      `UPDATE hospitals SET
        name = $1, city = $2, state = $3, contact_person = $4, phone = $5, status = $6
       WHERE id = $7 RETURNING *`,
      [newName, newCity, newState, newContact, newPhone, newStatus, id]
    );

    const updatedHospital = result.rows[0];

    await logAudit(
      userId || null,
      'EDIT_HOSPITAL',
      'hospitals',
      updatedHospital.id,
      `Hospital '${newName}' updated by ${userName}`,
      { changes: req.body }
    );

    return res.status(200).json({
      message: 'Hospital updated successfully.',
      hospital: updatedHospital
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const deleteHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    // Only Admin can delete hospitals
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    const { id } = req.params;

    const checkResult = await query(
      'SELECT id, name FROM hospitals WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const hospitalName = checkResult.rows[0].name;

    await query(
      `UPDATE hospitals SET is_deleted = true, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      userId || null,
      'DELETE_HOSPITAL',
      'hospitals',
      parseInt(id, 10),
      `Hospital '${hospitalName}' soft deleted by ${userName}`
    );

    return res.status(200).json({ message: 'Hospital deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
