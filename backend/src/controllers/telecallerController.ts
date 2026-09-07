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
      // Telecallers see leads assigned to them only
      result = await query(
        `SELECT l.*, u.name as assigned_name 
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.is_deleted = false AND l.assigned_to = $1
         ORDER BY l.created_at DESC`,
        [userId]
      );
    } else {
      // Admin and others see all leads
      result = await query(
        `SELECT l.*, u.name as assigned_name 
         FROM leads l
         LEFT JOIN users u ON l.assigned_to = u.id
         WHERE l.is_deleted = false
         ORDER BY l.created_at DESC`
      );
    }

    return res.status(200).json({
      success: true,
      data: { leads: result.rows },
      leads: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const getLeadById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format. Must be an integer.',
        errorCode: 'VALIDATION_ERROR',
        error: 'Invalid lead ID format. Must be an integer.'
      });
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    const result = await query(
      `SELECT l.*, u.name as assigned_name 
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.id = $1 AND l.is_deleted = false`,
      [leadId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND',
        error: 'Lead not found.'
      });
    }

    const lead = result.rows[0];
    if (userRole === 'Telecaller' && lead.assigned_to !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view leads assigned to you.',
        errorCode: 'ACCESS_DENIED',
        error: 'Access denied. You can only view leads assigned to you.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { lead },
      lead
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const createLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    const { patient_name, contact_number, status, notes, callback_time, assigned_to, referral_type, referrer_name, appointment_type, service_type } = req.body;

    if (!patient_name || !contact_number) {
      return res.status(400).json({
        success: false,
        message: 'Patient name and contact number are required.',
        errorCode: 'VALIDATION_ERROR',
        error: 'Patient name and contact number are required.'
      });
    }

    const assignedId = assigned_to ? parseInt(assigned_to, 10) : userId;

    const result = await query(
      `INSERT INTO leads (patient_name, contact_number, status, notes, callback_time, assigned_to, referral_type, referrer_name, appointment_type, service_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        patient_name,
        contact_number,
        status || 'Interested',
        notes || '',
        callback_time || null,
        assignedId,
        referral_type || null,
        referrer_name || null,
        appointment_type || null,
        service_type || null
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

    const payload = {
      message: 'Lead created successfully.',
      lead
    };

    return res.status(201).json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const updateLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const userRole = req.user?.role;
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format. Must be an integer.',
        errorCode: 'VALIDATION_ERROR',
        error: 'Invalid lead ID format. Must be an integer.'
      });
    }

    const existingResult = await query(
      'SELECT * FROM leads WHERE id = $1 AND is_deleted = false',
      [leadId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND',
        error: 'Lead not found.'
      });
    }

    const lead = existingResult.rows[0];
    if (userRole === 'Telecaller' && lead.assigned_to !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update leads assigned to you.',
        errorCode: 'ACCESS_DENIED',
        error: 'Access denied. You can only update leads assigned to you.'
      });
    }

    const { patient_name, contact_number, status, notes, callback_time, assigned_to, referral_type, referrer_name, appointment_type, service_type } = req.body;

    const newPatientName = patient_name !== undefined ? patient_name : lead.patient_name;
    const newContactNumber = contact_number !== undefined ? contact_number : lead.contact_number;
    const newStatus = status !== undefined ? status : lead.status;
    const newNotes = notes !== undefined ? notes : lead.notes;
    const newCallbackTime = callback_time !== undefined ? callback_time : lead.callback_time;
    const newAssignedTo = assigned_to !== undefined ? (assigned_to ? parseInt(assigned_to, 10) : null) : lead.assigned_to;
    const newReferralType = referral_type !== undefined ? referral_type : lead.referral_type;
    const newReferrerName = referrer_name !== undefined ? referrer_name : lead.referrer_name;
    const newAppointmentType = appointment_type !== undefined ? appointment_type : lead.appointment_type;
    const newServiceType = service_type !== undefined ? service_type : lead.service_type;

    const result = await query(
      `UPDATE leads SET
        patient_name = $1, contact_number = $2, status = $3, notes = $4, callback_time = $5, assigned_to = $6, referral_type = $7, referrer_name = $8, appointment_type = $9, service_type = $10
       WHERE id = $11 RETURNING *`,
      [newPatientName, newContactNumber, newStatus, newNotes, newCallbackTime, newAssignedTo, newReferralType, newReferrerName, newAppointmentType, newServiceType, leadId]
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

    const payload = {
      message: 'Lead updated successfully.',
      lead: updatedLead
    };

    return res.status(200).json({
      success: true,
      data: payload,
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};

export const deleteLead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lead ID format. Must be an integer.',
        errorCode: 'VALIDATION_ERROR',
        error: 'Invalid lead ID format. Must be an integer.'
      });
    }

    const checkResult = await query(
      'SELECT id, patient_name FROM leads WHERE id = $1 AND is_deleted = false',
      [leadId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found.',
        errorCode: 'LEAD_NOT_FOUND',
        error: 'Lead not found.'
      });
    }

    const patientName = checkResult.rows[0].patient_name;

    await query(
      `UPDATE leads SET is_deleted = true, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), leadId]
    );

    await logAudit(
      userId || null,
      'DELETE_LEAD',
      'leads',
      leadId,
      `Lead for ${patientName} soft deleted by ${userName}`
    );

    return res.status(200).json({
      success: true,
      message: 'Lead deleted successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};
