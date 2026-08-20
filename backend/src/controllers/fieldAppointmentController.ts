import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { assignSingleLeadToTelecaller, rebalanceLeadsAcrossTelecallers } from '../utils/leadAssignmentHelper';
import { reverseGeocode } from '../utils/geocoder';

const createNotification = async (title: string, message: string, userId: number | null) => {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
      [userId, title, message]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

// Create a new field appointment
export const createFieldAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;

    if (!executiveId || !executiveName) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized executive action.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    const {
      full_name,
      age,
      gender,
      phone_number,
      appointment_type,
      medical_history,
      latitude,
      longitude,
      added_latitude,
      added_longitude
    } = req.body;

    // Validate inputs
    if (!full_name || age === undefined || !gender || !phone_number || !appointment_type) {
      return res.status(400).json({
        success: false,
        message: 'All required patient fields must be provided.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Name validation (letters and spaces only)
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(full_name.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Patient name must contain only letters.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Age validation
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 125) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid age.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Phone validation (exactly 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone_number.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must contain exactly 10 digits.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Gender validation
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be Male, Female, or Other.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Appointment Type validation
    const allowedTypes = ['Doctor Consultation', 'Dental Consultation', 'Therapy Services'];
    if (!allowedTypes.includes(appointment_type)) {
      return res.status(400).json({
        success: false,
        message: 'Appointment Type must be Doctor Consultation, Dental Consultation, or Therapy Services.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Generate unique Patient Lead ID (PL-XXXXXX format)
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const patientLeadId = `PL-${randomNum}`;

    // Resolve location tracking coordinates
    const latVal = added_latitude !== undefined && added_latitude !== null && added_latitude !== '' ? parseFloat(added_latitude) : (latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null);
    const lngVal = added_longitude !== undefined && added_longitude !== null && added_longitude !== '' ? parseFloat(added_longitude) : (longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null);

    let resolvedAddress = null;
    if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal)) {
      resolvedAddress = await reverseGeocode(latVal, lngVal);
    }

    // Insert record
    const result = await query(
      `INSERT INTO field_appointments (
        patient_lead_id, full_name, age, gender, phone_number,
        appointment_type, medical_history, executive_id, executive_name, status,
        added_latitude, added_longitude, added_location_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'New Lead', $10, $11, $12) RETURNING *`,
      [
        patientLeadId,
        full_name.trim(),
        parsedAge,
        gender,
        phone_number.trim(),
        appointment_type,
        medical_history || '',
        executiveId,
        executiveName,
        latVal,
        lngVal,
        resolvedAddress
      ]
    );

    const newAppointment = result.rows[0];

    // Auto assign lead to a telecaller
    let assignedAppointment = newAppointment;
    try {
      const assigned = await assignSingleLeadToTelecaller(newAppointment.id);
      if (assigned) {
        assignedAppointment = assigned;
      }
    } catch (assignErr) {
      console.error('Failed to auto-assign lead to telecaller:', assignErr);
    }

    // Log audit action
    await logAudit(
      executiveId || null,
      'CREATE_FIELD_APPOINTMENT',
      'field_appointments',
      assignedAppointment.id,
      `Field appointment lead ${patientLeadId} created for ${full_name} by executive ${executiveName}`
    );

    // Notify Admins
    await createNotification(
      'New Field Appointment Lead',
      `Field lead ${patientLeadId} registered by executive ${executiveName} for ${full_name}.`,
      null
    );

    return res.status(201).json({
      success: true,
      data: assignedAppointment
    });
  } catch (err: any) {
    console.error('Failed to create field appointment:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Retrieve field appointments (Executive role is scoped to their own, Admin/Superadmin can filter)
export const getFieldAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const {
      search,
      appointment_type,
      executive_id,
      start_date,
      end_date,
      status
    } = req.query;

    let queryParts = [
      `SELECT * FROM field_appointments WHERE 1=1`
    ];
    const params: any[] = [];
    let paramIdx = 1;

    // Scoping based on Role
    if (userRole === 'Executive') {
      queryParts.push(`AND executive_id = $${paramIdx++}`);
      params.push(userId);
    } else if (userRole === 'Telecaller') {
      queryParts.push(`AND assigned_telecaller_id = $${paramIdx++}`);
      params.push(userId);
    } else {
      // Admin/Superadmin can filter by specific executive
      if (executive_id && executive_id !== 'All' && executive_id !== '') {
        queryParts.push(`AND executive_id = $${paramIdx++}`);
        params.push(parseInt(executive_id as string, 10));
      }
    }

    if (appointment_type && appointment_type !== 'All' && appointment_type !== '') {
      queryParts.push(`AND appointment_type = $${paramIdx++}`);
      params.push(appointment_type as string);
    }

    if (status && status !== 'All' && status !== '') {
      queryParts.push(`AND status = $${paramIdx++}`);
      params.push(status as string);
    }

    if (start_date) {
      let start = start_date as string;
      if (!start.includes('T')) {
        start = `${start}T00:00:00.000Z`;
      }
      queryParts.push(`AND created_at >= $${paramIdx++}`);
      params.push(start);
    }

    if (end_date) {
      let end = end_date as string;
      if (!end.includes('T')) {
        end = `${end}T23:59:59.999Z`;
      }
      queryParts.push(`AND created_at <= $${paramIdx++}`);
      params.push(end);
    }

    if (search) {
      const searchStr = (search as string).trim();
      queryParts.push(`AND (
        full_name ILIKE $${paramIdx} OR
        phone_number ILIKE $${paramIdx} OR
        executive_name ILIKE $${paramIdx} OR
        patient_lead_id ILIKE $${paramIdx}
      )`);
      params.push(`%${searchStr}%`);
      paramIdx++;
    }

    queryParts.push(`ORDER BY created_at DESC`);

    const result = await query(queryParts.join(' '), params);

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err: any) {
    console.error('Failed to query field appointments:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Update field appointment status (Admin only)
export const updateFieldAppointmentStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const userName = req.user?.name;

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['New Lead', 'Contacted', 'Appointment Scheduled', 'Visited', 'Converted', 'Closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status transition.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const checkRes = await query(
      `SELECT * FROM field_appointments WHERE id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field appointment not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const oldRecord = checkRes.rows[0];

    const result = await query(
      `UPDATE field_appointments SET status = $1, lead_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [status, id]
    );

    const updatedRecord = result.rows[0];

    // Log audit
    await logAudit(
      userId || null,
      'UPDATE_FIELD_APPOINTMENT_STATUS',
      'field_appointments',
      updatedRecord.id,
      `Status for field lead ${updatedRecord.patient_lead_id} updated from "${oldRecord.status}" to "${status}" by ${userName}`
    );

    // Notify executive
    await createNotification(
      'Field Appointment Status Updated',
      `Field lead ${updatedRecord.patient_lead_id} for ${updatedRecord.full_name} status updated to "${status}".`,
      updatedRecord.executive_id
    );

    return res.status(200).json({
      success: true,
      data: updatedRecord
    });
  } catch (err: any) {
    console.error('Failed to update field appointment status:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Telecaller action to update status, notes, follow-up dates
export const telecallerAction = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const telecallerId = req.user?.id;
    const telecallerName = req.user?.name;
    const userRole = req.user?.role;

    if (userRole !== 'Telecaller' && userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { id } = req.params;
    const { status, notes, next_followup_date } = req.body;

    const checkRes = await query(
      `SELECT * FROM field_appointments WHERE id = $1`,
      [id]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Field appointment lead not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    const lead = checkRes.rows[0];

    // Enforce that Telecallers only see/action leads explicitly assigned to them
    if (userRole === 'Telecaller' && lead.assigned_telecaller_id !== telecallerId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Lead is not assigned to you.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const updatedStatus = status || lead.lead_status;
    const updatedNotes = notes !== undefined ? notes : lead.telecaller_notes;
    const nextFollowup = next_followup_date !== undefined ? next_followup_date : lead.next_followup_date;
    const lastFollowup = new Date().toISOString();

    const result = await query(
      `UPDATE field_appointments 
       SET 
         status = $1,
         lead_status = $2,
         telecaller_notes = $3,
         next_followup_date = $4,
         last_followup_date = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [updatedStatus, updatedStatus, updatedNotes, nextFollowup, lastFollowup, id]
    );

    const updatedLead = result.rows[0];

    // Log audit
    await logAudit(
      telecallerId || null,
      'TELECALLER_LEAD_ACTION',
      'field_appointments',
      updatedLead.id,
      `Telecaller action on field lead ${updatedLead.patient_lead_id} by ${telecallerName}. Status updated to "${updatedStatus}"`
    );

    return res.status(200).json({
      success: true,
      data: updatedLead
    });
  } catch (err: any) {
    console.error('Failed to perform telecaller action:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Admin manually reassigns leads (single or bulk)
export const reassignLeads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const userRole = req.user?.role;
    const adminName = req.user?.name;

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { leadIds, telecallerId } = req.body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0 || !telecallerId) {
      return res.status(400).json({
        success: false,
        message: 'leadIds array and telecallerId are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Fetch telecaller info
    const tcRes = await query(
      "SELECT id, name FROM users WHERE id = $1 AND role = 'Telecaller' AND is_active = true AND is_deleted = false",
      [telecallerId]
    );

    if (tcRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active telecaller not found or is inactive.',
        errorCode: 'NOT_FOUND'
      });
    }

    const tc = tcRes.rows[0];
    const assignedAt = new Date().toISOString();

    const placeholders = leadIds.map((_, idx) => `$${idx + 4}`).join(', ');
    await query(
      `UPDATE field_appointments 
       SET 
         assigned_telecaller_id = $1,
         assigned_telecaller_name = $2,
         assigned_at = $3
       WHERE id IN (${placeholders})`,
      [tc.id, tc.name, assignedAt, ...leadIds]
    );

    await logAudit(
      adminId || null,
      'REASSIGN_LEADS',
      'field_appointments',
      null,
      `Admin ${adminName} reassigned leads [${leadIds.join(', ')}] to telecaller ${tc.name}`
    );

    return res.status(200).json({
      success: true,
      message: `Successfully reassigned ${leadIds.length} leads to ${tc.name}.`
    });
  } catch (err: any) {
    console.error('Failed to reassign leads:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Admin triggers manual lead rebalancing
export const manualRebalanceLeads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const userRole = req.user?.role;
    const adminName = req.user?.name;

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    await rebalanceLeadsAcrossTelecallers('Manual Trigger');

    await logAudit(
      adminId || null,
      'REBALANCE_LEADS',
      'field_appointments',
      null,
      `Admin ${adminName} triggered manual lead rebalancing across active telecallers.`
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully rebalanced active leads across telecallers.'
    });
  } catch (err: any) {
    console.error('Failed to manually rebalance leads:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get Telecaller performance statistics
export const getTelecallerPerformance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    console.log(`[DEBUG] getTelecallerPerformance called by user ID: ${req.user?.id}, Role: ${userRole}`);
    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      console.log(`[DEBUG] getTelecallerPerformance Access Denied for role: ${userRole}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const tcRes = await query(
      "SELECT id, name, is_active FROM users WHERE role = 'Telecaller' AND is_deleted = false ORDER BY name ASC"
    );
    const telecallers = tcRes.rows;

    const performanceData = [];
    for (const tc of telecallers) {
      const leadsRes = await query(
        "SELECT lead_status FROM field_appointments WHERE assigned_telecaller_id = $1",
        [tc.id]
      );
      
      const leads = leadsRes.rows;
      const assignedCount = leads.length;
      const contactedCount = leads.filter(l => l.lead_status !== 'New Lead').length;
      const convertedCount = leads.filter(l => l.lead_status === 'Converted').length;
      const pendingFollowupsCount = leads.filter(l => ['Follow-up Pending', 'Appointment Scheduled'].includes(l.lead_status)).length;
      const conversionRate = assignedCount > 0 ? parseFloat(((convertedCount / assignedCount) * 100).toFixed(1)) : 0;

      performanceData.push({
        telecaller_id: tc.id,
        telecaller_name: tc.name,
        is_active: tc.is_active,
        leads_assigned: assignedCount,
        leads_contacted: contactedCount,
        leads_converted: convertedCount,
        conversion_rate: conversionRate,
        pending_followups: pendingFollowupsCount
      });
    }

    return res.status(200).json({
      success: true,
      data: performanceData
    });
  } catch (err: any) {
    console.error('Failed to get telecaller performance:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get redistribution logs for Admin console
export const getRedistributionLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    console.log(`[DEBUG] getRedistributionLogs called by user ID: ${req.user?.id}, Role: ${userRole}`);
    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      console.log(`[DEBUG] getRedistributionLogs Access Denied for role: ${userRole}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unauthorized role.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const result = await query(
      "SELECT * FROM auto_redistribution_log ORDER BY redistribution_time DESC LIMIT 100"
    );

    return res.status(200).json({
      success: true,
      data: result.rows
    });
  } catch (err: any) {
    console.error('Failed to get redistribution logs:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
