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
      // Admin, Chief Doctor, Reception, Telecallers see all
      result = await query(
        `SELECT a.*, h.name as hospital_name, u.name as doctor_name 
         FROM appointments a
         LEFT JOIN hospitals h ON a.hospital_id = h.id
         LEFT JOIN users u ON a.doctor_id = u.id
         WHERE a.is_deleted = false
         ORDER BY a.appointment_date ASC`
      );
    }

    return res.status(200).json({ appointments: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getAppointmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, h.name as hospital_name, u.name as doctor_name 
       FROM appointments a
       LEFT JOIN hospitals h ON a.hospital_id = h.id
       LEFT JOIN users u ON a.doctor_id = u.id
       WHERE a.id = $1 AND a.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    return res.status(200).json({ appointment: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
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
      return res.status(400).json({ error: 'Required fields are missing.' });
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
      message: 'Appointment created successfully.',
      appointment: newAppointment
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
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
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const appointment = existingResult.rows[0];

    // Enforce role-based edit restrictions
    const timeDiffMs = Date.now() - new Date(appointment.created_at).getTime();
    const hoursElapsed = timeDiffMs / (1000 * 60 * 60);

    if (userRole === 'Reception' && hoursElapsed > 3) {
      return res.status(403).json({
        error: `Edit lock active. Reception can only edit appointments within 3 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`
      });
    }

    if (userRole === 'Doctor' && hoursElapsed > 24) {
      return res.status(403).json({
        error: `Edit lock active. Doctors can only edit appointments within 24 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`
      });
    }

    if (userRole === 'Telecaller') {
      return res.status(403).json({ error: 'Telecallers are not authorized to edit appointments.' });
    }

    if (userRole === 'Executive') {
      return res.status(403).json({ error: 'Executives are not authorized to edit appointments.' });
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

    await logAudit(
      userId || null,
      'EDIT_APPOINTMENT',
      'appointments',
      updatedAppointment.id,
      `Appointment ID ${id} edited by ${userName}`,
      { changes: req.body }
    );

    await createNotification(
      'Appointment Updated',
      `Appointment for ${newPatientName} was updated by ${userName}.`,
      null
    );

    return res.status(200).json({
      message: 'Appointment updated successfully.',
      appointment: updatedAppointment
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

// Soft delete
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userName = req.user?.name;
    const { id } = req.params;

    // Only Admin or Chief Doctor can delete appointments
    if (userRole !== 'Admin' && userRole !== 'Chief Doctor') {
      return res.status(403).json({ error: 'Access denied. Unrestricted override required.' });
    }

    const checkResult = await query(
      'SELECT id, patient_name FROM appointments WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found.' });
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

    return res.status(200).json({ message: 'Appointment deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
