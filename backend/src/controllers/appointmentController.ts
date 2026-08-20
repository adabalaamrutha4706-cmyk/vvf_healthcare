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
    const { 
      start_date, 
      end_date, 
      hospital_id,
      appointment_type,
      status,
      search,
      doctor_id,
      technician_id,
      service_name
    } = req.query;

    let queryParts = [
      `SELECT a.*, h.name as hospital_name, u.name as doctor_name, t.name as technician_name,
              COALESCE(a.created_by_name, c.name) as creator_name,
              COALESCE(a.created_by_role, c.role) as creator_role,
              COALESCE(a.created_by_user_id, a.created_by) as creator_user_id
       FROM appointments a
       LEFT JOIN hospitals h ON a.hospital_id = h.id
       LEFT JOIN users u ON a.doctor_id = u.id
       LEFT JOIN users t ON a.technician_id = t.id
       LEFT JOIN users c ON a.created_by = c.id
       WHERE a.is_deleted = false`
    ];
    const params: any[] = [];
    let paramIdx = 1;

    // Role-based appointment type scoping
    if (userRole === 'Doctor') {
      // Doctors can only see doctor-type appointments assigned to them
      queryParts.push(`AND a.appointment_type = 'doctor'`);
      queryParts.push(`AND a.doctor_id = $${paramIdx++}`);
      params.push(userId);
    } else if (userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      // Dental Doctors, Juniors, and Assistants can see dental-type appointments assigned to them
      queryParts.push(`AND a.appointment_type = 'dental'`);
      queryParts.push(`AND a.doctor_id = $${paramIdx++}`);
      params.push(userId);
    } else if (userRole === 'OP Technician' || userRole === 'SOP Technician') {
      // Technicians can see all services-type appointments
      queryParts.push(`AND a.appointment_type = 'services'`);
    } else {
      // Admin/Reception/Superadmin: apply optional filters
      if (doctor_id && doctor_id !== 'All' && doctor_id !== '') {
        queryParts.push(`AND a.doctor_id = $${paramIdx++}`);
        params.push(parseInt(doctor_id as string, 10));
      }
    }

    if (hospital_id && hospital_id !== 'All') {
      queryParts.push(`AND a.hospital_id = $${paramIdx++}`);
      params.push(parseInt(hospital_id as string, 10));
    }

    if (appointment_type && appointment_type !== 'All' && appointment_type !== '') {
      // Only apply type filter if not already scoped by role
      if (userRole !== 'Doctor' && userRole !== 'Dental Doctor' && userRole !== 'Dentist Junior' && userRole !== 'Dental Assistant' && userRole !== 'OP Technician' && userRole !== 'SOP Technician') {
        queryParts.push(`AND a.appointment_type = $${paramIdx++}`);
        params.push(appointment_type as string);
      }
    }

    if (status && status !== 'All' && status !== '') {
      queryParts.push(`AND a.status = $${paramIdx++}`);
      params.push(status as string);
    }

    if (technician_id && technician_id !== 'All' && technician_id !== '') {
      queryParts.push(`AND a.technician_id = $${paramIdx++}`);
      params.push(parseInt(technician_id as string, 10));
    }

    if (service_name && service_name !== 'All' && service_name !== '') {
      queryParts.push(`AND a.service_name = $${paramIdx++}`);
      params.push(service_name as string);
    }

    if (start_date) {
      let start = start_date as string;
      if (!start.includes('T')) {
        start = `${start}T00:00:00.000Z`;
      }
      queryParts.push(`AND a.appointment_date >= $${paramIdx++}`);
      params.push(start);
    }

    if (end_date) {
      let end = end_date as string;
      if (!end.includes('T')) {
        end = `${end}T23:59:59.999Z`;
      }
      queryParts.push(`AND a.appointment_date <= $${paramIdx++}`);
      params.push(end);
    }

    if (search) {
      const searchStr = (search as string).trim();
      queryParts.push(`AND (
        a.patient_name ILIKE $${paramIdx} OR 
        a.patient_id ILIKE $${paramIdx} OR
        a.contact_number ILIKE $${paramIdx} OR
        a.id::text ILIKE $${paramIdx} OR
        a.appointment_type ILIKE $${paramIdx} OR
        u.name ILIKE $${paramIdx} OR
        c.name ILIKE $${paramIdx} OR
        (CASE 
          WHEN c.role = 'Reception' THEN 'Receptionist Front Desk Receptionist'
          WHEN c.role = 'Telecaller' THEN 'Telecaller Telecalling Specialist'
          WHEN c.role = 'Executive' THEN 'Executive Regional Executive'
          WHEN c.role = 'Doctor' THEN 'Doctor General Doctor'
          WHEN c.role = 'Dental Doctor' THEN 'Dental Doctor Dentist'
          WHEN c.role = 'Dentist Junior' THEN 'Dentist Junior Dentist'
          WHEN c.role = 'Dental Assistant' THEN 'Dental Assistant'
          WHEN c.role = 'OP Technician' THEN 'OP Technician'
          WHEN c.role = 'SOP Technician' THEN 'SOP Technician'
          ELSE c.role
        END) ILIKE $${paramIdx}
      )`);
      params.push(`%${searchStr}%`);
      paramIdx++;
    }

    queryParts.push(`ORDER BY a.appointment_date ASC`);

    const result = await query(queryParts.join(' '), params);

    // Revenue Privacy Masking: Telecallers and Executives must NOT see revenue/payments
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
      `SELECT a.*, h.name as hospital_name, u.name as doctor_name,
              COALESCE(a.created_by_name, c.name) as creator_name,
              COALESCE(a.created_by_role, c.role) as creator_role,
              COALESCE(a.created_by_user_id, a.created_by) as creator_user_id
       FROM appointments a
       LEFT JOIN hospitals h ON a.hospital_id = h.id
       LEFT JOIN users u ON a.doctor_id = u.id
       LEFT JOIN users c ON a.created_by = c.id
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

    // Enforce Doctor view constraints: can only see their own doctor-type appointments
    if (userRole === 'Doctor' && (app.appointment_type !== 'doctor' || app.doctor_id !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own doctor appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Enforce Dental Doctor view constraints: can only see their own dental-type appointments
    if ((userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') && (app.appointment_type !== 'dental' || app.doctor_id !== userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own dental appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Enforce Technician view constraints: can view all services appointments
    if ((userRole === 'OP Technician' || userRole === 'SOP Technician') &&
        app.appointment_type !== 'services') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view service appointments.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Revenue Privacy Masking
    const hideRevenue = !['Admin', 'Superadmin', 'Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant', 'Reception'].includes(userRole || '');
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
      total_amount,
      // Restructured fields
      appointment_type,
      status,
      patient_id,
      service_name,
      department,
      visit_type,
      chief_complaint,
      dental_concern,
      treatment_type,
      technician_id,
      number_of_sessions,
      session_duration,
      package_type,
      service_remarks,
      // New Fields
      co_relation,
      date_of_birth,
      blood_group,
      city,
      address,
      diagnosis,
      reference,
      consultation_charges,
      tests_charges,
      medicine_charges
    } = req.body;

    const type = appointment_type || 'doctor';

    // Core validation fields
    if (!patient_name || !age || !gender || !contact_number || !appointment_date || !hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Role specific validation
    if ((type === 'doctor' || type === 'dental') && !doctor_id) {
      return res.status(400).json({
        success: false,
        message: 'Assigned doctor/dentist is required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    if (type === 'services' && (!service_name || !technician_id)) {
      return res.status(400).json({
        success: false,
        message: 'Service and assigned technician are required.',
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

    let finalPatientId = patient_id ? String(patient_id).trim() : '';
    if (!finalPatientId) {
      const existingPatient = await query(
        `SELECT patient_id FROM appointments 
         WHERE LOWER(patient_name) = LOWER($1) AND contact_number = $2 AND patient_id IS NOT NULL AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1`,
        [patient_name.trim(), contact_number.trim()]
      );
      if (existingPatient.rows.length > 0 && existingPatient.rows[0].patient_id) {
        finalPatientId = existingPatient.rows[0].patient_id;
      } else {
        let uniqueFound = false;
        while (!uniqueFound) {
          const randNum = Math.floor(10000 + Math.random() * 90000);
          const potentialId = `PT-${randNum}`;
          const checkId = await query('SELECT id FROM appointments WHERE patient_id = $1 LIMIT 1', [potentialId]);
          if (checkId.rows.length === 0) {
            finalPatientId = potentialId;
            uniqueFound = true;
          }
        }
      }
    }

    const consultation = consultation_charges ? parseFloat(consultation_charges) : 0.00;
    const testsVal = tests_charges ? parseFloat(tests_charges) : 0.00;
    const medicine = medicine_charges ? parseFloat(medicine_charges) : 0.00;
    const totalCharges = consultation + testsVal + medicine;
    const price = totalCharges > 0 ? totalCharges : parseFloat(total_amount || 0);
    const appStatus = status || 'Scheduled';

    const result = await query(
      `INSERT INTO appointments (
        patient_name, age, gender, contact_number, hospital_id, doctor_id, 
        appointment_date, notes, total_amount, paid_amount, payment_status, created_by,
        created_by_user_id, created_by_name, created_by_role,
        appointment_type, status, patient_id, service_name, department, visit_type,
        chief_complaint, dental_concern, treatment_type, technician_id,
        number_of_sessions, session_duration, package_type, service_remarks,
        co_relation, date_of_birth, blood_group, city, address, diagnosis, reference,
        consultation_charges, tests_charges, medicine_charges
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 'Unpaid', $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37) RETURNING *`,
      [
        patient_name, // $1
        parseInt(age, 10), // $2
        gender, // $3
        contact_number, // $4
        parseInt(hospital_id, 10), // $5
        (type === 'doctor' || type === 'dental') && doctor_id ? parseInt(doctor_id, 10) : null, // $6
        appointment_date, // $7
        notes || '', // $8
        price, // $9
        creatorId, // $10 (created_by)
        creatorId, // $11 (created_by_user_id)
        req.user?.name || 'Unknown', // $12 (created_by_name)
        req.user?.role || 'Not Available', // $13 (created_by_role)
        type, // $14
        appStatus, // $15
        finalPatientId || null, // $16
        type === 'services' ? service_name : null, // $17
        type === 'doctor' ? department : null, // $18
        type === 'doctor' ? visit_type : null, // $19
        type === 'doctor' ? chief_complaint : null, // $20
        type === 'dental' ? dental_concern : null, // $21
        type === 'dental' ? treatment_type : null, // $22
        type === 'services' && technician_id ? parseInt(technician_id, 10) : null, // $23
        type === 'services' && number_of_sessions ? parseInt(number_of_sessions, 10) : null, // $24
        type === 'services' && session_duration ? parseInt(session_duration, 10) : null, // $25
        type === 'services' ? package_type : null, // $26
        type === 'services' ? service_remarks : null, // $27
        co_relation || null, // $28
        date_of_birth || null, // $29
        blood_group || null, // $30
        city || null, // $31
        address || null, // $32
        diagnosis || null, // $33
        reference || null, // $34
        consultation, // $35
        testsVal, // $36
        medicine // $37
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

    // Route notification to the assigned user based on appointment type
    let notifyUserId: number | null = null;
    if (type === 'doctor' || type === 'dental') {
      notifyUserId = (type === 'doctor' || type === 'dental') && doctor_id ? parseInt(doctor_id, 10) : null;
    } else if (type === 'services' && technician_id) {
      notifyUserId = parseInt(technician_id, 10);
    }

    await createNotification(
      'New Appointment',
      `Appointment created for ${patient_name} on ${appointment_date}.`,
      notifyUserId // Notify assigned doctor/dentist/technician specifically
    );
    // Also broadcast to admins
    await createNotification(
      'New Appointment',
      `Appointment created for ${patient_name} on ${appointment_date}.`,
      null
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

    if (userRole === 'Doctor') {
      if (appointment.appointment_type !== 'doctor' || appointment.doctor_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only edit your own doctor appointments.',
          errorCode: 'ACCESS_DENIED'
        });
      }
      if (hoursElapsed > 24) {
        return res.status(403).json({
          success: false,
          message: `Edit lock active. Doctors can only edit appointments within 24 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`,
          errorCode: 'EDIT_LOCKED'
        });
      }
    }

    if (userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      if (appointment.appointment_type !== 'dental' || appointment.doctor_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only edit your own dental appointments.',
          errorCode: 'ACCESS_DENIED'
        });
      }
      if (hoursElapsed > 24) {
        return res.status(403).json({
          success: false,
          message: `Edit lock active. Dental staff can only edit appointments within 24 hours of creation. (Elapsed: ${hoursElapsed.toFixed(1)}h)`,
          errorCode: 'EDIT_LOCKED'
        });
      }
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
      payment_status,
      // Restructured fields
      appointment_type,
      status,
      patient_id,
      service_name,
      department,
      visit_type,
      chief_complaint,
      dental_concern,
      treatment_type,
      technician_id,
      number_of_sessions,
      session_duration,
      package_type,
      service_remarks,
      // New Fields
      co_relation,
      date_of_birth,
      blood_group,
      city,
      address,
      diagnosis,
      reference,
      consultation_charges,
      tests_charges,
      medicine_charges
    } = req.body;

    // Validate fields if provided in request body
    if (patient_name !== undefined) {
      const nameRegex = /^(?=.*[A-Za-z])[A-Za-z\s]*\.?[A-Za-z\s]*$/;
      if (!nameRegex.test(patient_name.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Patient name must contain only letters.',
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
    const newAppointmentDate = appointment_date !== undefined ? appointment_date : appointment.appointment_date;
    const newNotes = notes !== undefined ? notes : appointment.notes;

    // Calculated total amount
    const newConsultationCharges = consultation_charges !== undefined ? parseFloat(consultation_charges || 0) : parseFloat(appointment.consultation_charges || 0);
    const newTestsCharges = tests_charges !== undefined ? parseFloat(tests_charges || 0) : parseFloat(appointment.tests_charges || 0);
    const newMedicineCharges = medicine_charges !== undefined ? parseFloat(medicine_charges || 0) : parseFloat(appointment.medicine_charges || 0);

    const totalCharges = newConsultationCharges + newTestsCharges + newMedicineCharges;
    const newTotalAmount = totalCharges > 0 ? totalCharges : (total_amount !== undefined ? parseFloat(total_amount) : parseFloat(appointment.total_amount));

    // Restructured fields fallback
    const newAppointmentType = appointment_type !== undefined ? appointment_type : appointment.appointment_type;
    const newStatus = status !== undefined ? status : appointment.status;
    const newPatientId = patient_id !== undefined ? patient_id : appointment.patient_id;
    const newServiceName = service_name !== undefined ? service_name : appointment.service_name;
    const newDepartment = department !== undefined ? department : appointment.department;
    const newVisitType = visit_type !== undefined ? visit_type : appointment.visit_type;
    const newChiefComplaint = chief_complaint !== undefined ? chief_complaint : appointment.chief_complaint;
    const newDentalConcern = dental_concern !== undefined ? dental_concern : appointment.dental_concern;
    const newTreatmentType = treatment_type !== undefined ? treatment_type : appointment.treatment_type;

    const newDoctorId = doctor_id !== undefined 
      ? (doctor_id ? parseInt(doctor_id, 10) : null) 
      : (appointment.doctor_id ? parseInt(appointment.doctor_id, 10) : null);
    
    const newTechnicianId = technician_id !== undefined 
      ? (technician_id ? parseInt(technician_id, 10) : null) 
      : (appointment.technician_id ? parseInt(appointment.technician_id, 10) : null);

    const newNumberOfSessions = number_of_sessions !== undefined 
      ? (number_of_sessions ? parseInt(number_of_sessions, 10) : null) 
      : (appointment.number_of_sessions ? parseInt(appointment.number_of_sessions, 10) : null);

    const newSessionDuration = session_duration !== undefined 
      ? (session_duration ? parseInt(session_duration, 10) : null) 
      : (appointment.session_duration ? parseInt(appointment.session_duration, 10) : null);

    const newPackageType = package_type !== undefined ? package_type : appointment.package_type;
    const newServiceRemarks = service_remarks !== undefined ? service_remarks : appointment.service_remarks;

    // New fields fallback
    const newCoRelation = co_relation !== undefined ? co_relation : appointment.co_relation;
    const newDob = date_of_birth !== undefined ? date_of_birth : appointment.date_of_birth;
    const newBloodGroup = blood_group !== undefined ? blood_group : appointment.blood_group;
    const newCity = city !== undefined ? city : appointment.city;
    const newAddress = address !== undefined ? address : appointment.address;
    const newDiagnosis = diagnosis !== undefined ? diagnosis : appointment.diagnosis;
    const newReference = reference !== undefined ? reference : appointment.reference;

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

    // Fetch doctor and hospital details for change summary
    const doctorsRes = await query("SELECT id, name FROM users WHERE role IN ('Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant')");
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

    const checkDiff = (field: string, oldVal: any, newVal: any, label?: string) => {
      let normalizedOld = oldVal;
      let normalizedNew = newVal;
      if (typeof oldVal === 'number' || typeof newVal === 'number') {
        normalizedOld = oldVal != null ? Number(oldVal) : null;
        normalizedNew = newVal != null ? Number(newVal) : null;
      }
      if (normalizedOld !== normalizedNew) {
        changes.push(`${label || field} changed from "${normalizedOld}" to "${normalizedNew}"`);
        oldValues[field] = normalizedOld;
        newValues[field] = normalizedNew;
      }
    };

    checkDiff('patient_name', appointment.patient_name, newPatientName, 'Patient name');
    checkDiff('age', appointment.age, newAge, 'Age');
    checkDiff('gender', appointment.gender, newGender, 'Gender');
    checkDiff('contact_number', appointment.contact_number, newContactNumber, 'Patient phone');
    checkDiff('hospital_id', appointment.hospital_id, newHospitalId, 'Hospital ID');
    checkDiff('doctor_id', appointment.doctor_id, newDoctorId, 'Doctor ID');
    checkDiff('appointment_date', appointment.appointment_date, newAppointmentDate, 'Appointment date');
    checkDiff('notes', appointment.notes, newNotes, 'Notes');
    checkDiff('total_amount', parseFloat(appointment.total_amount || 0), newTotalAmount, 'Total fee');
    checkDiff('paid_amount', parseFloat(appointment.paid_amount || 0), newPaidAmount, 'Paid amount');
    checkDiff('payment_status', appointment.payment_status, newPaymentStatus, 'Payment status');
    checkDiff('appointment_type', appointment.appointment_type, newAppointmentType, 'Category');
    checkDiff('status', appointment.status, newStatus, 'Status');
    checkDiff('patient_id', appointment.patient_id, newPatientId, 'Patient ID');
    checkDiff('service_name', appointment.service_name, newServiceName, 'Service name');
    checkDiff('department', appointment.department, newDepartment, 'Department');
    checkDiff('visit_type', appointment.visit_type, newVisitType, 'Visit type');
    checkDiff('chief_complaint', appointment.chief_complaint, newChiefComplaint, 'Chief complaint');
    checkDiff('dental_concern', appointment.dental_concern, newDentalConcern, 'Dental concern');
    checkDiff('treatment_type', appointment.treatment_type, newTreatmentType, 'Treatment type');
    checkDiff('technician_id', appointment.technician_id, newTechnicianId, 'Technician ID');
    checkDiff('number_of_sessions', appointment.number_of_sessions, newNumberOfSessions, 'Sessions count');
    checkDiff('session_duration', appointment.session_duration, newSessionDuration, 'Session duration');
    checkDiff('package_type', appointment.package_type, newPackageType, 'Package type');
    checkDiff('service_remarks', appointment.service_remarks, newServiceRemarks, 'Service remarks');
    checkDiff('co_relation', appointment.co_relation, newCoRelation, 'Relation (C%)');
    checkDiff('date_of_birth', appointment.date_of_birth, newDob, 'Date of birth');
    checkDiff('blood_group', appointment.blood_group, newBloodGroup, 'Blood group');
    checkDiff('city', appointment.city, newCity, 'City');
    checkDiff('address', appointment.address, newAddress, 'Address');
    checkDiff('diagnosis', appointment.diagnosis, newDiagnosis, 'Diagnosis');
    checkDiff('reference', appointment.reference, newReference, 'Reference');
    checkDiff('consultation_charges', parseFloat(appointment.consultation_charges || 0), newConsultationCharges, 'Consultation charges');
    checkDiff('tests_charges', parseFloat(appointment.tests_charges || 0), newTestsCharges, 'Tests charges');
    checkDiff('medicine_charges', parseFloat(appointment.medicine_charges || 0), newMedicineCharges, 'Medicine charges');

    const result = await query(
      `UPDATE appointments SET
        patient_name = $1, age = $2, gender = $3, contact_number = $4,
        hospital_id = $5, doctor_id = $6, appointment_date = $7, notes = $8,
        total_amount = $9, paid_amount = $10, payment_status = $11,
        appointment_type = $12, status = $13, patient_id = $14,
        service_name = $15, department = $16, visit_type = $17,
        chief_complaint = $18, dental_concern = $19, treatment_type = $20,
        technician_id = $21, number_of_sessions = $22, session_duration = $23,
        package_type = $24, service_remarks = $25,
        co_relation = $26, date_of_birth = $27, blood_group = $28, city = $29,
        address = $30, diagnosis = $31, reference = $32,
        consultation_charges = $33, tests_charges = $34, medicine_charges = $35
       WHERE id = $36 RETURNING *`,
      [
        newPatientName, // $1
        newAge, // $2
        newGender, // $3
        newContactNumber, // $4
        newHospitalId, // $5
        newDoctorId, // $6
        newAppointmentDate, // $7
        newNotes, // $8
        newTotalAmount, // $9
        newPaidAmount, // $10
        newPaymentStatus, // $11
        newAppointmentType, // $12
        newStatus, // $13
        newPatientId, // $14
        newServiceName, // $15
        newDepartment, // $16
        newVisitType, // $17
        newChiefComplaint, // $18
        newDentalConcern, // $19
        newTreatmentType, // $20
        newTechnicianId, // $21
        newNumberOfSessions, // $22
        newSessionDuration, // $23
        newPackageType, // $24
        newServiceRemarks, // $25
        newCoRelation || null, // $26
        newDob || null, // $27
        newBloodGroup || null, // $28
        newCity || null, // $29
        newAddress || null, // $30
        newDiagnosis || null, // $31
        newReference || null, // $32
        newConsultationCharges, // $33
        newTestsCharges, // $34
        newMedicineCharges, // $35
        id // $36
      ]
    );

    const updatedAppointment = result.rows[0];

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
    const changedFields: Record<string, { old: any, new: any }> = {};
    Object.keys(oldValues).forEach(k => {
      changedFields[k] = { old: oldValues[k], new: newValues[k] };
    });

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

    // Notify the assigned user on reschedule, cancel, or completion
    const oldStatus = appointment.status;
    const oldDate = appointment.appointment_date;

    const isCancelled = newStatus === 'Cancelled' && oldStatus !== 'Cancelled';
    const isCompleted = newStatus === 'Completed' && oldStatus !== 'Completed';
    const isRescheduled = newAppointmentDate !== oldDate;

    const assignedUserId = newAppointmentType === 'services' ? newTechnicianId : newDoctorId;

    if (assignedUserId) {
      if (isCancelled) {
        await createNotification(
          'Appointment Cancelled',
          `Appointment for ${newPatientName} was cancelled by ${userName}.`,
          assignedUserId
        );
      } else if (isCompleted) {
        await createNotification(
          'Appointment Completed',
          `Appointment for ${newPatientName} was marked completed.`,
          assignedUserId
        );
      } else if (isRescheduled) {
        await createNotification(
          'Appointment Rescheduled',
          `Appointment for ${newPatientName} has been rescheduled to ${new Date(newAppointmentDate).toLocaleDateString('en-IN')}.`,
          assignedUserId
        );
      }
    }

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

// Soft delete refactored to set status to Cancelled
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userName = req.user?.name;
    const { id } = req.params;

    // Only Admin and Superadmin can cancel appointments via delete endpoint
    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Unrestricted override required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const checkResult = await query(
      'SELECT id, patient_name, appointment_type, doctor_id, technician_id FROM appointments WHERE id = $1 AND is_deleted = false',
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
    const patientName = app.patient_name;

    await query(
      `UPDATE appointments SET status = 'Cancelled' WHERE id = $1`,
      [id]
    );

    await logAudit(
      userId || null,
      'DELETE_APPOINTMENT',
      'appointments',
      parseInt(id, 10),
      `Appointment for ${patientName} marked Cancelled by ${userName}`
    );

    const assignedUserId = app.appointment_type === 'services' ? app.technician_id : app.doctor_id;
    if (assignedUserId) {
      await createNotification(
        'Appointment Cancelled',
        `Appointment for ${patientName} was cancelled by ${userName}.`,
        assignedUserId
      );
    }

    await createNotification(
      'Appointment Deleted',
      `Appointment for ${patientName} was cancelled by ${userName}.`,
      null
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully.'
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
      hospital_id,
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
              (SELECT MAX(created_at) FROM payments WHERE appointment_id = a.id AND is_deleted = false) as last_payment_date,
              (SELECT notes FROM payments WHERE appointment_id = a.id AND is_deleted = false ORDER BY created_at DESC LIMIT 1) as last_payment_notes
       FROM appointments a
       LEFT JOIN users u ON a.doctor_id = u.id
       WHERE a.is_deleted = false`
    ];

    let params: any[] = [];
    let paramIndex = 1;

    // Doctor/Dental Doctor restriction (can only see their own appointments)
    if (userRole === 'Doctor' || userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      queryParts.push(`AND a.doctor_id = $${paramIndex++}`);
      params.push(userId);
    } else if (doctor_id) {
      queryParts.push(`AND a.doctor_id = $${paramIndex++}`);
      params.push(parseInt(doctor_id as string, 10));
    }

    // Filter by hospital
    if (hospital_id && hospital_id !== 'All') {
      queryParts.push(`AND a.hospital_id = $${paramIndex++}`);
      params.push(parseInt(hospital_id as string, 10));
    }

    // Search by patient name or appointment ID
    if (search) {
      const searchStr = (search as string).trim();
      if (/^\d+$/.test(searchStr)) {
        queryParts.push(`AND (
          a.id = $${paramIndex} 
          OR a.patient_name ILIKE $${paramIndex + 1}
          OR EXISTS (
            SELECT 1 FROM payments p
            WHERE p.appointment_id = a.id
            AND p.is_deleted = false
            AND (
              p.transaction_ref ILIKE $${paramIndex + 1}
              OR p.payment_splits::text ILIKE $${paramIndex + 1}
            )
          )
        )`);
        params.push(parseInt(searchStr, 10));
        params.push(`%${searchStr}%`);
        paramIndex += 2;
      } else {
        queryParts.push(`AND (
          a.patient_name ILIKE $${paramIndex}
          OR EXISTS (
            SELECT 1 FROM payments p
            WHERE p.appointment_id = a.id
            AND p.is_deleted = false
            AND (
              p.transaction_ref ILIKE $${paramIndex}
              OR p.payment_splits::text ILIKE $${paramIndex}
            )
          )
        )`);
        params.push(`%${searchStr}%`);
        paramIndex++;
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
      let start = start_date as string;
      if (!start.includes('T')) {
        start = `${start}T00:00:00.000Z`;
      }
      queryParts.push(`AND a.appointment_date >= $${paramIndex++}`);
      params.push(start);
    }
    if (end_date) {
      let end = end_date as string;
      if (!end.includes('T')) {
        end = `${end}T23:59:59.999Z`;
      }
      queryParts.push(`AND a.appointment_date <= $${paramIndex++}`);
      params.push(end);
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
    const totalCount = countResult.rows && countResult.rows.length > 0 ? countResult.rows[0].count : 0;

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

export const moveAppointmentToTelecalling = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userName = req.user?.name;
    const userRole = req.user?.role;

    const { phone_number, outreach_status, callback_date, telecaller_id, outbound_notes } = req.body;

    if (!outreach_status || !phone_number || !telecaller_id) {
      return res.status(400).json({
        success: false,
        message: 'Outreach status, phone number, and telecaller assignment are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Validate phone number format
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        success: false,
        message: 'Contact number must contain exactly 10 digits.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    // Validate callback date if status is Callback Requested
    if (outreach_status === 'Callback Requested' && !callback_date) {
      return res.status(400).json({
        success: false,
        message: 'Callback schedule date and time are required for Callback Requested status.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

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

    const appointment = appResult.rows[0];

    // Check if telecaller exists and is active
    const telecallerResult = await query(
      "SELECT id, name FROM users WHERE id = $1 AND role = 'Telecaller' AND is_active = true AND is_deleted = false",
      [parseInt(telecaller_id, 10)]
    );

    if (telecallerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assigned telecaller not found or is inactive.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    const telecaller = telecallerResult.rows[0];

    // 1. Update appointment record to mark it as moved
    await query(
      `UPDATE appointments SET
        telecalling_status = $1,
        telecaller_id = $2,
        callback_date = $3,
        outbound_notes = $4,
        moved_to_telecalling = true,
        moved_to_telecalling_at = $5
       WHERE id = $6`,
      [
        outreach_status,
        parseInt(telecaller_id, 10),
        callback_date ? new Date(callback_date).toISOString() : null,
        outbound_notes || '',
        new Date().toISOString(),
        parseInt(id, 10)
      ]
    );

    // 2. Create record in the leads table
    const leadResult = await query(
      `INSERT INTO leads (patient_name, contact_number, status, notes, callback_time, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        appointment.patient_name,
        phone_number,
        outreach_status,
        outbound_notes || '',
        callback_date ? new Date(callback_date).toISOString() : null,
        parseInt(telecaller_id, 10)
      ]
    );

    const newLeadId = leadResult.rows[0].id;

    // 3. Log Audit Trail
    await logAudit(
      userId || null,
      'MOVE_TO_TELECALLING',
      'appointments',
      appointment.id,
      `Lead '${appointment.patient_name}' (Phone: ${phone_number}) moved to telecalling by ${userName}. Assigned to ${telecaller.name}.`,
      {
        leadName: appointment.patient_name,
        leadId: appointment.id,
        newLeadId: newLeadId,
        phoneNumber: phone_number,
        assignedTelecaller: telecaller.name,
        assignedTelecallerId: parseInt(telecaller_id, 10),
        outreachStatus: outreach_status,
        movedBy: userName,
        movedById: userId,
        dateTime: new Date().toISOString()
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Lead successfully moved to Telecalling Queue.'
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const lookupPatient = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, patient_id } = req.query;

    let result;
    if (patient_id) {
      result = await query(
        `SELECT patient_name as name, age, gender, contact_number as phone, patient_id
         FROM appointments
         WHERE LOWER(patient_id) = LOWER($1) AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1`,
        [String(patient_id).trim()]
      );
    } else if (name && phone) {
      result = await query(
        `SELECT patient_name as name, age, gender, contact_number as phone, patient_id
         FROM appointments
         WHERE LOWER(patient_name) = LOWER($1) AND contact_number = $2 AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1`,
        [String(name).trim(), String(phone).trim()]
      );
    } else if (phone) {
      result = await query(
        `SELECT patient_name as name, age, gender, contact_number as phone, patient_id
         FROM appointments
         WHERE contact_number = $1 AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1`,
        [String(phone).trim()]
      );
    } else if (name) {
      result = await query(
        `SELECT patient_name as name, age, gender, contact_number as phone, patient_id
         FROM appointments
         WHERE LOWER(patient_name) = LOWER($1) AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1`,
        [String(name).trim()]
      );
    } else {
      return res.status(400).json({ success: false, message: 'Missing search query parameters.' });
    }

    if (result.rows.length > 0) {
      return res.json({ success: true, patient: result.rows[0] });
    } else {
      return res.json({ success: true, patient: null });
    }
  } catch (err: any) {
    console.error('Lookup patient error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
