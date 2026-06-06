import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to create notifications
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

export const getAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let result;
    if (userRole === 'Doctor') {
      // Doctors see appointments assigned to them
      result = await query(
        `SELECT a.*, h.name as hospital_name, u.name as doctor_name 
         FROM appointments a
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE a.is_deleted = false AND a.doctor_id = $1
         ORDER BY a.appointment_date ASC`,
        [userId]
      );
    } else {
      // Admin, Superadmin, Chief Doctor, Reception, Telecallers see all
      result = await query(
        `SELECT a.*, h.name as hospital_name, u.name as doctor_name 
         FROM appointments a
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE a.is_deleted = false
         ORDER BY a.appointment_date ASC`
      );
    }

    // Revenue Privacy Masking: Chief Doctor, Telecallers, Executives must NOT see revenue/payments
    const hideRevenue = !['Admin', 'Superadmin', 'Doctor', 'Reception'].includes(userRole || '');
    const processedAppointments = result.rows.map((app: any) => {
      return {
        ...app,
        total_amount: hideRevenue ? 0.00 : parseFloat(app.total_amount),
        paid_amount: hideRevenue ? 0.00 : parseFloat(app.paid_amount),
        payment_status: hideRevenue ? 'N/A' : app.payment_status
      };
    });

    return res.status(200).json({
      success: true,
      data: { appointments: processedAppointments }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getAppointmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const result = await query(
      `SELECT a.*, h.name as hospital_name, u.name as doctor_name 
       FROM appointments a
       LEFT JOIN hospitals h ON a.hospital_id = h.id
       LEFT JOIN users u ON a.doctor_id = u.id
       WHERE a.id = $1 AND a.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const app = result.rows[0];

    // Enforce Doctor view constraints
    if (userRole === 'Doctor' && app.doctor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Revenue Privacy Masking
    const hideRevenue = !['Admin', 'Superadmin', 'Doctor', 'Reception'].includes(userRole || '');
    const processedApp = {
      ...app,
      total_amount: hideRevenue ? 0.00 : parseFloat(app.total_amount),
      paid_amount: hideRevenue ? 0.00 : parseFloat(app.paid_amount),
      payment_status: hideRevenue ? 'N/A' : app.payment_status
    };

    return res.status(200).json({
      success: true,
      data: { appointment: processedApp }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const createAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    const creatorName = req.user?.name;

    const {
      patient_name,
      age,
      gender,
      contact_number,
      hospital_id,
      doctor_id,
      appointment_date,
      notes,
      total_amount
    } = req.body;

    if (!patient_name || !age || !gender || !contact_number || !appointment_date || !hospital_id || !doctor_id) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // 1. Patient Name Validation
    const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
    if (!nameRegex.test(patient_name)) {
      return res.status(400).json({
        success: false,
        message: 'Patient name can contain only letters.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // 2. Contact Number Validation
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(contact_number)) {
      return res.status(400).json({
        success: false,
        message: 'Contact number must contain exactly 10 digits.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // 3. Appointment Date Validation
    const selectedDate = new Date(appointment_date);
    const today = new Date();
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (isNaN(selectedDate.getTime()) || selectedDateOnly < todayDateOnly) {
      return res.status(400).json({
        success: false,
        message: 'Past appointment dates are not allowed.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // 4. Consultation Fee Validation (total_amount)
    if (total_amount !== undefined && total_amount !== null && total_amount !== '') {
      const feeStr = String(total_amount).trim();
      const feeRegex = /^\d+$/;
      if (!feeRegex.test(feeStr)) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee must contain only numbers.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
      const priceVal = parseFloat(feeStr);
      if (priceVal < 0 || priceVal > 99999999) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee must contain only numbers.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    const price = parseFloat(total_amount || 0);

    const result = await query(
      `INSERT INTO appointments (
        patient_name, age, gender, contact_number, hospital_id, doctor_id, 
        appointment_date, notes, total_amount, paid_amount, payment_status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'Unpaid', $10) RETURNING *`,
      [
        patient_name,
        parseInt(age, 10),
        gender,
        contact_number,
        parseInt(hospital_id, 10),
        parseInt(doctor_id, 10),
        appointment_date,
        notes || '',
        price,
        creatorId
      ]
    );

    const newAppointment = result.rows[0];

    await logAudit(
      creatorId || null,
      'CREATE_APPOINTMENT',
      'appointments',
      newAppointment.id,
      `Appointment created for ${patient_name} by ${creatorName}`
    );

    // Create notifications for Admins & Chief Doctor
    await createNotification(
      'New Appointment',
      `Appointment created for ${patient_name} at ${appointment_date}.`,
      null // Notify all
    );

    return res.status(201).json({
      success: true,
      data: { appointment: newAppointment }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updateAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userName = req.user?.name;
    const { id } = req.params;

    const existingResult = await query(
      'SELECT * FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const appointment = existingResult.rows[0];

    // Enforce role-based edit restrictions (calculated using server timestamp only)
    const timeDiffMs = Date.now() - new Date(appointment.created_at).getTime();
    const hoursElapsed = timeDiffMs / (1000 * 60 * 60);

    if (userRole === 'Reception') {
      const dbTotal = parseFloat(appointment.total_amount || 0);
      const dbPaid = parseFloat(appointment.paid_amount || 0);
      const dbOutstanding = dbTotal - dbPaid;
      const dbPaymentStatus = appointment.payment_status;
      const isPaid = ['Paid', 'Fully Cleared', 'Completed'].includes(dbPaymentStatus) || (dbTotal > 0 && dbOutstanding <= 0);
      if (isPaid) {
        return res.status(403).json({
          success: false,
          message: 'Editing locked because payment has been fully cleared.',
          errorCode: 'EDIT_LOCKED'
        });
      }
    }

    if (userRole === 'Doctor' && hoursElapsed > 24) {
      return res.status(403).json({
        success: false,
        message: `Edit lock active. Doctors can only edit appointments within 24 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`,
        errorCode: 'EDIT_LOCKED'
      });
    }

    if (userRole === 'Chief Doctor' && hoursElapsed > 72) {
      return res.status(403).json({
        success: false,
        message: `Edit lock active. Chief Doctors can only edit appointments within 72 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`,
        errorCode: 'EDIT_LOCKED'
      });
    }

    if (userRole === 'Telecaller' || userRole === 'Executive') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Role is unauthorized to edit appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Capture fields
    const {
      patient_name,
      age,
      gender,
      contact_number,
      hospital_id,
      doctor_id,
      appointment_date,
      notes,
      total_amount,
      paid_amount,
      payment_status
    } = req.body;

    // Validate fields if provided in request body
    if (patient_name !== undefined) {
      const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;

    if (!nameRegex.test(patient_name.trim())) {
      return res.status(400).json({
      success: false,
      message: 'Patient name must contain only letters .',
      errorCode: 'VALIDATION_ERROR'
    });
    }
    }

    if (contact_number !== undefined) {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(contact_number)) {
        return res.status(400).json({
          success: false,
          message: 'Contact number must contain exactly 10 digits.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    if (appointment_date !== undefined) {
      const selectedDate = new Date(appointment_date);
      if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    if (total_amount !== undefined && total_amount !== null && total_amount !== '') {
      const feeStr = String(total_amount).trim();
      const feeRegex = /^\d+$/;
      if (!feeRegex.test(feeStr)) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee must contain only numbers.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
      const priceVal = parseFloat(feeStr);
      if (priceVal < 0 || priceVal > 99999999) {
        return res.status(400).json({
          success: false,
          message: 'Consultation fee must contain only numbers.',
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    const newPatientName = patient_name !== undefined ? patient_name : appointment.patient_name;
    const newAge = age !== undefined ? parseInt(age, 10) : appointment.age;
    const newGender = gender !== undefined ? gender : appointment.gender;
    const newContactNumber = contact_number !== undefined ? contact_number : appointment.contact_number;
    const newHospitalId = hospital_id !== undefined ? parseInt(hospital_id, 10) : appointment.hospital_id;
    const newDoctorId = doctor_id !== undefined ? parseInt(doctor_id, 10) : appointment.doctor_id;
    const newAppointmentDate = appointment_date !== undefined ? appointment_date : appointment.appointment_date;
    const newNotes = notes !== undefined ? notes : appointment.notes;
    const newTotalAmount = total_amount !== undefined ? parseFloat(total_amount) : parseFloat(appointment.total_amount);
    
    // Paid amount calculation
    let newPaidAmount = paid_amount !== undefined ? parseFloat(paid_amount) : parseFloat(appointment.paid_amount);
    let newPaymentStatus = payment_status !== undefined ? payment_status : appointment.payment_status;

    // Auto-completion status check
    if (newPaidAmount >= newTotalAmount && newTotalAmount > 0) {
      newPaymentStatus = 'Completed';
    } else if (newPaidAmount > 0 && newPaidAmount < newTotalAmount) {
      newPaymentStatus = 'Partially Paid';
    } else {
      newPaymentStatus = 'Unpaid';
    }

    // Build changedFields diff
    const changedFields: Record<string, { old: any, new: any }> = {};
    if (newPatientName !== appointment.patient_name) {
      changedFields.patient_name = { old: appointment.patient_name, new: newPatientName };
    }
    if (newAge !== appointment.age) {
      changedFields.age = { old: appointment.age, new: newAge };
    }
    if (newGender !== appointment.gender) {
      changedFields.gender = { old: appointment.gender, new: newGender };
    }
    if (newContactNumber !== appointment.contact_number) {
      changedFields.contact_number = { old: appointment.contact_number, new: newContactNumber };
    }
    if (newHospitalId !== appointment.hospital_id) {
      changedFields.hospital_id = { old: appointment.hospital_id, new: newHospitalId };
    }
    if (newDoctorId !== appointment.doctor_id) {
      changedFields.doctor_id = { old: appointment.doctor_id, new: newDoctorId };
    }
    if (newAppointmentDate !== appointment.appointment_date) {
      changedFields.appointment_date = { old: appointment.appointment_date, new: newAppointmentDate };
    }
    if (newNotes !== appointment.notes) {
      changedFields.notes = { old: appointment.notes, new: newNotes };
    }
    if (newTotalAmount !== parseFloat(appointment.total_amount)) {
      changedFields.total_amount = { old: parseFloat(appointment.total_amount), new: newTotalAmount };
    }
    if (newPaidAmount !== parseFloat(appointment.paid_amount)) {
      changedFields.paid_amount = { old: parseFloat(appointment.paid_amount), new: newPaidAmount };
    }
    if (newPaymentStatus !== appointment.payment_status) {
      changedFields.payment_status = { old: appointment.payment_status, new: newPaymentStatus };
    }

    const result = await query(
      `UPDATE appointments SET
        patient_name = $1, age = $2, gender = $3, contact_number = $4,
        hospital_id = $5, doctor_id = $6, appointment_date = $7, notes = $8,
        total_amount = $9, paid_amount = $10, payment_status = $11
       WHERE id = $12 RETURNING *`,
      [
        newPatientName,
        newAge,
        newGender,
        newContactNumber,
        newHospitalId,
        newDoctorId,
        newAppointmentDate,
        newNotes,
        newTotalAmount,
        newPaidAmount,
        newPaymentStatus,
        id
      ]
    );

    const updatedAppointment = result.rows[0];

    // Fetch doctor and hospital details for change summary
    const doctorsRes = await query("SELECT id, name FROM users WHERE role IN ('Doctor', 'Chief Doctor')");
    const hospitalsRes = await query("SELECT id, name FROM hospitals");
    const getDoctorName = (docId: any) => {
      const doc = doctorsRes.rows.find((d: any) => String(d.id) === String(docId));
      return doc ? doc.name : `Dr. (ID: ${docId})`;
    };
    const getHospitalName = (hospId: any) => {
      const hosp = hospitalsRes.rows.find((h: any) => String(h.id) === String(hospId));
      return hosp ? hosp.name : `Hospital (ID: ${hospId})`;
    };

    const changes: string[] = [];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    if (newPatientName !== appointment.patient_name) {
      changes.push(`Patient name changed from "${appointment.patient_name}" to "${newPatientName}"`);
      oldValues.patient_name = appointment.patient_name;
      newValues.patient_name = newPatientName;
    }
    if (newAge !== appointment.age) {
      changes.push(`Age changed from ${appointment.age} to ${newAge}`);
      oldValues.age = appointment.age;
      newValues.age = newAge;
    }
    if (newGender !== appointment.gender) {
      changes.push(`Gender changed from "${appointment.gender}" to "${newGender}"`);
      oldValues.gender = appointment.gender;
      newValues.gender = newGender;
    }
    if (newContactNumber !== appointment.contact_number) {
      changes.push(`Patient Phone updated`);
      oldValues.contact_number = appointment.contact_number;
      newValues.contact_number = newContactNumber;
    }
    if (newHospitalId !== appointment.hospital_id) {
      changes.push(`Hospital changed from "${getHospitalName(appointment.hospital_id)}" to "${getHospitalName(newHospitalId)}"`);
      oldValues.hospital_id = appointment.hospital_id;
      newValues.hospital_id = newHospitalId;
    }
    if (newDoctorId !== appointment.doctor_id) {
      changes.push(`Doctor changed from "${getDoctorName(appointment.doctor_id)}" to "${getDoctorName(newDoctorId)}"`);
      oldValues.doctor_id = appointment.doctor_id;
      newValues.doctor_id = newDoctorId;
    }
    const oldTime = new Date(appointment.appointment_date).getTime();
    const newTime = new Date(newAppointmentDate).getTime();
    if (oldTime !== newTime) {
      const oldDateStr = new Date(appointment.appointment_date).toLocaleString('en-IN');
      const newDateStr = new Date(newAppointmentDate).toLocaleString('en-IN');
      changes.push(`Visit Date changed from ${oldDateStr} to ${newDateStr}`);
      oldValues.appointment_date = appointment.appointment_date;
      newValues.appointment_date = newAppointmentDate;
    }
    if (newNotes !== appointment.notes) {
      changes.push(`Notes changed`);
      oldValues.notes = appointment.notes;
      newValues.notes = newNotes;
    }
    if (newTotalAmount !== parseFloat(appointment.total_amount)) {
      changes.push(`Consultation fee changed from ₹${parseFloat(appointment.total_amount)} to ₹${newTotalAmount}`);
      oldValues.total_amount = parseFloat(appointment.total_amount);
      newValues.total_amount = newTotalAmount;
    }
    if (newPaidAmount !== parseFloat(appointment.paid_amount)) {
      changes.push(`Paid amount changed from ₹${parseFloat(appointment.paid_amount)} to ₹${newPaidAmount}`);
      oldValues.paid_amount = parseFloat(appointment.paid_amount);
      newValues.paid_amount = newPaidAmount;
    }
    if (newPaymentStatus !== appointment.payment_status) {
      changes.push(`Status changed from ${appointment.payment_status} → ${newPaymentStatus}`);
      oldValues.payment_status = appointment.payment_status;
      newValues.payment_status = newPaymentStatus;
    }

    if (changes.length > 0) {
      const changeSummary = changes.map(c => `• ${c}`).join('\n');
      await query(
        `INSERT INTO appointment_edit_history (
          appointment_id, edited_by_user_id, edited_by_name, edited_by_designation, old_values, new_values, change_summary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          parseInt(id, 10),
          userId || null,
          userName || 'Unknown',
          userRole || 'Unknown',
          JSON.stringify(oldValues),
          JSON.stringify(newValues),
          changeSummary
        ]
      );
    }

    // Maintain audit log metadata containing editedBy, role, editedAt, changedFields
    await logAudit(
      userId || null,
      'EDIT_APPOINTMENT',
      'appointments',
      updatedAppointment.id,
      `Appointment ID ${id} edited by ${userName}`,
      {
        editedBy: userId,
        role: userRole,
        editedAt: new Date().toISOString(),
        changedFields
      }
    );

    await createNotification(
      'Appointment Updated',
      `Appointment for ${newPatientName} was updated by ${userName}.`,
      null
    );

    return res.status(200).json({
      success: true,
      data: { appointment: updatedAppointment }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Soft delete
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userName = req.user?.name;
    const { id } = req.params;

    // Only Admin, Chief Doctor, Superadmin can delete appointments
    if (userRole !== 'Admin' && userRole !== 'Chief Doctor' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unrestricted override required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const checkResult = await query(
      'SELECT id, patient_name FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const patientName = checkResult.rows[0].patient_name;

    await query(
      `UPDATE appointments SET is_deleted = true, deleted_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id]
    );

    await logAudit(
      userId || null,
      'DELETE_APPOINTMENT',
      'appointments',
      parseInt(id, 10),
      `Appointment for ${patientName} soft deleted by ${userName}`
    );

    await createNotification(
      'Appointment Deleted',
      `Appointment for ${patientName} was cancelled by ${userName}.`,
      null
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment soft deleted successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Recovery / Restore soft-deleted appointment (Admin & Superadmin only)
export const restoreAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userName = req.user?.name;
    const { id } = req.params;

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const checkResult = await query(
      'SELECT id, patient_name, is_deleted FROM appointments WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const app = checkResult.rows[0];
    if (!app.is_deleted) {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already active.',
        errorCode: 'ALREADY_ACTIVE'
      });
    }

    await query(
      'UPDATE appointments SET is_deleted = false, deleted_at = NULL WHERE id = $1',
      [id]
    );

    await logAudit(
      userId || null,
      'RESTORE_APPOINTMENT',
      'appointments',
      parseInt(id, 10),
      `Appointment for ${app.patient_name} restored by ${userName}`
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment restored successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getPendingPayments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Filters
    const { 
      search, 
      status, 
      doctor_id, 
      start_date, 
      end_date, 
      sort_by, 
      page = '1', 
      limit = '10' 
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const offset = (pageNum - 1) * limitNum;

    let queryParts = [
      `SELECT a.*, 
              u.name as doctor_name, 
              (a.total_amount - a.paid_amount)::float as pending_amount,
              (SELECT MAX(created_at) FROM payments WHERE appointment_id = a.id) as last_payment_date,
              (SELECT notes FROM payments WHERE appointment_id = a.id ORDER BY created_at DESC LIMIT 1) as last_payment_notes
       FROM appointments a
       LEFT JOIN users u ON a.doctor_id = u.id
       WHERE a.is_deleted = false`
    ];

    let params: any[] = [];
    let paramIndex = 1;

    // Doctor restriction (Doctors can only see their own appointments)
    if (userRole === 'Doctor') {
      queryParts.push(`AND a.doctor_id = $${paramIndex++}`);
      params.push(userId);
    } else if (doctor_id) {
      queryParts.push(`AND a.doctor_id = $${paramIndex++}`);
      params.push(parseInt(doctor_id as string, 10));
    }

    // Search by patient name or appointment ID
    if (search) {
      const searchStr = (search as string).trim();
      if (/^\d+$/.test(searchStr)) {
        queryParts.push(`AND (a.id = $${paramIndex++} OR a.patient_name ILIKE $${paramIndex++})`);
        params.push(parseInt(searchStr, 10));
        params.push(`%${searchStr}%`);
      } else {
        queryParts.push(`AND a.patient_name ILIKE $${paramIndex++}`);
        params.push(`%${searchStr}%`);
      }
    }

    // Filter by payment status
    if (status) {
      let statusVal = status as string;
      if (statusVal === 'Pending') {
        queryParts.push(`AND (a.payment_status = 'Unpaid' OR a.payment_status = 'Pending')`);
      } else if (statusVal === 'Partially Paid') {
        queryParts.push(`AND a.payment_status = 'Partially Paid'`);
      } else if (statusVal === 'Fully Paid') {
        queryParts.push(`AND (a.payment_status = 'Completed' OR a.payment_status = 'Fully Paid' OR a.payment_status = 'Paid')`);
      }
    }

    // Filter by date range
    if (start_date) {
      queryParts.push(`AND a.appointment_date >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      queryParts.push(`AND a.appointment_date <= $${paramIndex++}`);
      params.push(end_date);
    }

    // Sorting: Highest pending amount, oldest pending payments, latest appointments
    let orderClause = 'ORDER BY a.appointment_date DESC'; // default
    if (sort_by === 'highest_pending') {
      orderClause = 'ORDER BY pending_amount DESC';
    } else if (sort_by === 'oldest_pending') {
      orderClause = 'ORDER BY a.appointment_date ASC';
    } else if (sort_by === 'latest') {
      orderClause = 'ORDER BY a.appointment_date DESC';
    }

    // Count query before limits
    const countQuery = `SELECT COUNT(*)::int as count FROM (${queryParts.join(' ')}) as temp`;
    const countResult = await query(countQuery, params);
    const totalCount = countResult.rows[0].count;

    // Append ordering and pagination to the main query
    queryParts.push(orderClause);
    queryParts.push(`LIMIT $${paramIndex++} OFFSET $${paramIndex++}`);
    params.push(limitNum);
    params.push(offset);

    const mainResult = await query(queryParts.join(' '), params);

    return res.status(200).json({
      success: true,
      data: {
        appointments: mainResult.rows,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum)
        }
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

export const getAppointmentEditHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Check if appointment exists
    const appResult = await query(
      'SELECT * FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const app = appResult.rows[0];

    // Enforce role-based access constraints
    if (userRole === 'Doctor' && app.doctor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view history for your own appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Retrieve the history
    const historyResult = await query(
      `SELECT * FROM appointment_edit_history 
       WHERE appointment_id = $1 
       ORDER BY edited_at DESC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: { history: historyResult.rows }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
