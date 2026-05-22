import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

export const getLeads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    let result;
    if (userRole === 'Telecaller') {
      // Telecallers see leads assigned to them or unassigned
      result = await query(
        `SELECT l.*, u.name as assigned_to_name 
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.is_deleted = false AND (l.assigned_to = $1 OR l.assigned_to IS NULL)
         ORDER BY l.created_at DESC`,
        [userId]
      );
    } else {
      // Admin and others see all leads
      result = await query(
        `SELECT l.*, u.name as assigned_to_name 
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.is_deleted = false
         ORDER BY l.created_at DESC`
      );
    }

    return res.status(200).json({ leads: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getLeadById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT l.*, u.name as assigned_to_name 
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.id = $1 AND l.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    return res.status(200).json({ lead: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const createLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    const { patient_name, contact_number, status, notes, callback_time, assigned_to } = req.body;

    if (!patient_name || !contact_number) {
      return res.status(400).json({ error: 'Patient name and contact number are required.' });
    }

    const assignedId = assigned_to ? parseInt(assigned_to, 10) : userId;

    const result = await query(
      `INSERT INTO leads (patient_name, contact_number, status, notes, callback_time, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        patient_name,
        contact_number,
        status || 'Interested',
        notes || '',
        callback_time || null,
        assignedId
      ]
    );

    const lead = result.rows[0];

    await logAudit(
      userId || null,
      'CREATE_LEAD',
      'leads',
      lead.id,
      `Lead created for ${patient_name} by ${userName}`
    );

    return res.status(201).json({
      message: 'Lead created successfully.',
      lead
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const updateLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params;

    const existingResult = await query(
      'SELECT * FROM leads WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = existingResult.rows[0];

    const { patient_name, contact_number, status, notes, callback_time, assigned_to } = req.body;

    const newPatientName = patient_name !== undefined ? patient_name : lead.patient_name;
    const newContactNumber = contact_number !== undefined ? contact_number : lead.contact_number;
    const newStatus = status !== undefined ? status : lead.status;
    const newNotes = notes !== undefined ? notes : lead.notes;
    const newCallbackTime = callback_time !== undefined ? callback_time : lead.callback_time;
    const newAssignedTo = assigned_to !== undefined ? (assigned_to ? parseInt(assigned_to, 10) : null) : lead.assigned_to;

    const result = await query(
      `UPDATE leads SET
        patient_name = $1, contact_number = $2, status = $3, notes = $4, callback_time = $5, assigned_to = $6
       WHERE id = $7 RETURNING *`,
      [newPatientName, newContactNumber, newStatus, newNotes, newCallbackTime, newAssignedTo, id]
    );

    const updatedLead = result.rows[0];

    await logAudit(
      userId || null,
      'EDIT_LEAD',
      'leads',
      updatedLead.id,
      `Lead for ${newPatientName} updated by ${userName}. Status: ${newStatus}`,
      { changes: req.body }
    );

    // If status changed to Confirmed, create a notification for Reception
    if (status === 'Confirmed' && lead.status !== 'Confirmed') {
      await query(
        'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
        [null, 'Lead Confirmed', `Lead for ${newPatientName} has been confirmed. Schedule an appointment.`]
      );
    }

    return res.status(200).json({
      message: 'Lead updated successfully.',
      lead: updatedLead
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const deleteLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params;

    const checkResult = await query(
      'SELECT id, patient_name FROM leads WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const patientName = checkResult.rows[0].patient_name;

    await query(
      `UPDATE leads SET is_deleted = true, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      userId || null,
      'DELETE_LEAD',
      'leads',
      parseInt(id, 10),
      `Lead for ${patientName} soft deleted by ${userName}`
    );

    return res.status(200).json({ message: 'Lead deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
