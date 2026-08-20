import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper to get technician info
const getTechniciansList = async () => {
  const result = await query(
    "SELECT id, name, role FROM users WHERE role IN ('OP Technician', 'SOP Technician') AND is_active = true AND is_deleted = false"
  );
  return result.rows;
};

// Helper to enrich sessions with technician, hospital names and specific details
const enrichTherapySession = async (session: any) => {
  // 1. Fetch Hospital Info
  if (session.hospital_id) {
    const hospRes = await query("SELECT id, name, city FROM hospitals WHERE id = $1", [session.hospital_id]);
    if (hospRes.rows.length > 0) {
      session.hospital_name = hospRes.rows[0].name;
    }
  }

  // 2. Fetch OP Tech Info
  if (session.op_technician_id) {
    const opRes = await query("SELECT id, name FROM users WHERE id = $1", [session.op_technician_id]);
    if (opRes.rows.length > 0) {
      session.op_technician_name = opRes.rows[0].name;
    }
  }

  // 3. Fetch SOP Tech Info
  if (session.sop_technician_id) {
    const sopRes = await query("SELECT id, name FROM users WHERE id = $1", [session.sop_technician_id]);
    if (sopRes.rows.length > 0) {
      session.sop_technician_name = sopRes.rows[0].name;
    }
  }

  // 4. Fetch type-specific details
  const type = session.therapy_type;
  if (['HBOT', 'Ozone', 'Physiotherapy', 'Dental', 'Pelvic Chair Therapy', 'SIPCD', 'Zero Gravity'].includes(type)) {
    let tableName = 'therapy_hbot';
    if (type === 'Ozone') tableName = 'therapy_ozone';
    else if (type === 'Physiotherapy') tableName = 'therapy_physiotherapy';
    else if (type === 'Dental') tableName = 'therapy_dental';
    else if (type === 'Pelvic Chair Therapy') tableName = 'therapy_pelvic_chair';
    else if (type === 'SIPCD') tableName = 'therapy_sipcd';
    else if (type === 'Zero Gravity') tableName = 'therapy_zero_gravity';

    const detailsRes = await query(`SELECT * FROM ${tableName} WHERE session_id = $1`, [session.id]);
    if (detailsRes.rows.length > 0) {
      const d = detailsRes.rows[0];
      session.dive_surface_timings = d.dive_surface_timings;
      session.pressure_type = d.pressure_type;
      session.pressure_value = d.pressure_value;
      session.next_session_date = d.next_session_date;
      session.next_session_time = d.next_session_time;
    } else {
      session.dive_surface_timings = '';
      session.pressure_type = '';
      session.pressure_value = null;
      session.next_session_date = '';
      session.next_session_time = '';
    }
  } else if (type === 'Lab') {
    const detailsRes = await query(`SELECT * FROM therapy_lab WHERE session_id = $1`, [session.id]);
    if (detailsRes.rows.length > 0) {
      const d = detailsRes.rows[0];
      session.tests = d.tests || '';
      session.reported = d.reported || 'No';
      session.report_printed = d.report_printed || 'No';
      session.whatsapp_report = d.whatsapp_report || 'Not Sent';
    } else {
      session.tests = '';
      session.reported = 'No';
      session.report_printed = 'No';
      session.whatsapp_report = 'Not Sent';
    }
  } else if (type === 'Hydrogen Inhalation') {
    // Hydrogen inhalation has no custom columns, details table holds audit metadata
  }

  return session;
};

// GET /api/therapies
export const getTherapies = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { hospital_id, status, therapy_type, search, start_date, end_date, op_technician_id, sop_technician_id } = req.query;

    let sql = 'SELECT * FROM therapy_sessions WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    // Filter by role constraints
    if (userRole === 'OP Technician') {
      sql += ` AND op_technician_id = $${paramIdx++}`;
      params.push(userId);
      if (req.user?.assigned_therapy) {
        sql += ` AND therapy_type = $${paramIdx++}`;
        params.push(req.user.assigned_therapy);
      }
    } else if (userRole === 'SOP Technician') {
      if (req.user?.assigned_therapy) {
        sql += ` AND therapy_type = $${paramIdx++}`;
        params.push(req.user.assigned_therapy);
      } else {
        sql += ` AND sop_technician_id = $${paramIdx++}`;
        params.push(userId);
      }
    }

    // Input filters
    if (hospital_id && hospital_id !== 'All') {
      sql += ` AND hospital_id = $${paramIdx++}`;
      params.push(parseInt(hospital_id as string, 10));
    }
    if (status && status !== 'All') {
      sql += ` AND status = $${paramIdx++}`;
      params.push(status);
    }
    if (therapy_type && therapy_type !== 'All') {
      sql += ` AND therapy_type = $${paramIdx++}`;
      params.push(therapy_type);
    }
    if (op_technician_id && op_technician_id !== 'All') {
      sql += ` AND op_technician_id = $${paramIdx++}`;
      params.push(parseInt(op_technician_id as string, 10));
    }
    if (sop_technician_id && sop_technician_id !== 'All') {
      sql += ` AND sop_technician_id = $${paramIdx++}`;
      params.push(parseInt(sop_technician_id as string, 10));
    }
    if (start_date) {
      sql += ` AND session_date >= $${paramIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND session_date <= $${paramIdx++}`;
      params.push(end_date);
    }

    sql += ' ORDER BY session_date DESC, id DESC';

    const result = await query(sql, params);
    let sessions = result.rows;

    // Local filter for Patient Name Search (if needed, otherwise SQL can do it, but simple search in JS is safer for LocalDB)
    if (search) {
      const s = String(search).toLowerCase().trim();
      sessions = sessions.filter((session: any) =>
        session.patient_name.toLowerCase().includes(s) ||
        session.mobile_number.toLowerCase().includes(s)
      );
    }

    // Enrich all sessions programmatically
    const enriched = [];
    for (const session of sessions) {
      enriched.push(await enrichTherapySession(session));
    }

    return res.status(200).json({
      success: true,
      data: enriched
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// GET /api/therapies/technicians
export const getTechnicians = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await getTechniciansList();
    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// GET /api/therapies/:id
export const getTherapyById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM therapy_sessions WHERE id = $1', [parseInt(id, 10)]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Therapy session not found.',
        errorCode: 'SESSION_NOT_FOUND'
      });
    }

    const session = await enrichTherapySession(result.rows[0]);
    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// POST /api/therapies
export const createTherapy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    const creatorName = req.user?.name;

    const {
      patient_name,
      mobile_number,
      therapy_type,
      timings,
      session_date,
      hospital_id,
      op_technician_id,
      sop_technician_id,
      remarks,
      // Specific fields
      dive_surface_timings,
      pressure_type,
      pressure_value,
      next_session_date,
      next_session_time,
      tests
    } = req.body;

    if (!patient_name || !mobile_number || !therapy_type || !session_date || !hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Required master fields (Patient Name, Mobile Number, Therapy Type, Date, Hospital) are missing.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    if (req.user?.role === 'OP Technician' && req.user?.assigned_therapy) {
      if (therapy_type !== req.user.assigned_therapy) {
        return res.status(400).json({
          success: false,
          message: `Access denied. You can only create sessions for your assigned therapy: ${req.user.assigned_therapy}.`,
          errorCode: 'VALIDATION_ERROR'
        });
      }
    }

    // Insert into therapy_sessions
    const sessionRes = await query(
      `INSERT INTO therapy_sessions (
        patient_name, mobile_number, therapy_type, timings, session_date, 
        hospital_id, op_technician_id, sop_technician_id, op_verified, sop_verified, status, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, false, 'Pending Verification', $9) RETURNING *`,
      [
        patient_name,
        mobile_number,
        therapy_type,
        timings || '',
        session_date,
        parseInt(hospital_id, 10),
        op_technician_id ? parseInt(op_technician_id, 10) : null,
        sop_technician_id ? parseInt(sop_technician_id, 10) : null,
        remarks || ''
      ]
    );

    const newSession = sessionRes.rows[0];

    // Insert child table details
    const type = therapy_type;
    if (['HBOT', 'Ozone', 'Physiotherapy', 'Dental', 'Pelvic Chair Therapy', 'SIPCD', 'Zero Gravity'].includes(type)) {
      let tableName = 'therapy_hbot';
      if (type === 'Ozone') tableName = 'therapy_ozone';
      else if (type === 'Physiotherapy') tableName = 'therapy_physiotherapy';
      else if (type === 'Dental') tableName = 'therapy_dental';
      else if (type === 'Pelvic Chair Therapy') tableName = 'therapy_pelvic_chair';
      else if (type === 'SIPCD') tableName = 'therapy_sipcd';
      else if (type === 'Zero Gravity') tableName = 'therapy_zero_gravity';

      await query(
        `INSERT INTO ${tableName} (
          session_id, dive_surface_timings, pressure_type, pressure_value, next_session_date, next_session_time
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newSession.id,
          dive_surface_timings || '',
          pressure_type || '',
          pressure_value ? parseInt(pressure_value, 10) : null,
          next_session_date || '',
          next_session_time || ''
        ]
      );
    } else if (type === 'Lab') {
      await query(
        `INSERT INTO therapy_lab (
          session_id, tests, reported, report_printed, whatsapp_report
        ) VALUES ($1, $2, 'No', 'No', 'Not Sent')`,
        [newSession.id, tests || '']
      );
    } else if (type === 'Hydrogen Inhalation') {
      await query(
        `INSERT INTO therapy_hydrogen_inhalation (session_id) VALUES ($1)`,
        [newSession.id]
      );
    }

    const fullyEnriched = await enrichTherapySession(newSession);

    await logAudit(
      creatorId || null,
      'CREATE_THERAPY',
      'therapy_sessions',
      fullyEnriched.id,
      `Therapy session (${type}) created for patient '${patient_name}' by ${creatorName}`
    );

    return res.status(201).json({
      success: true,
      data: fullyEnriched
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// PUT /api/therapies/:id
export const updateTherapy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const editorId = req.user?.id;
    const editorName = req.user?.name;
    const { id } = req.params;

    const sessionRes = await query('SELECT * FROM therapy_sessions WHERE id = $1', [parseInt(id, 10)]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Therapy session not found.',
        errorCode: 'SESSION_NOT_FOUND'
      });
    }

    const session = sessionRes.rows[0];

    const {
      patient_name,
      mobile_number,
      timings,
      session_date,
      rescheduled,
      rescheduled_date,
      rescheduled_time,
      actual_start,
      end_time,
      hospital_id,
      op_technician_id,
      sop_technician_id,
      remarks,
      status,
      // Specific details
      dive_surface_timings,
      pressure_type,
      pressure_value,
      next_session_date,
      next_session_time,
      tests,
      reported,
      report_printed,
      whatsapp_report
    } = req.body;

    // 1. Update Master Session Table
    const newPatient = patient_name !== undefined ? patient_name : session.patient_name;
    const newMobile = mobile_number !== undefined ? mobile_number : session.mobile_number;
    const newTimings = timings !== undefined ? timings : session.timings;
    const newDate = session_date !== undefined ? session_date : session.session_date;
    const newRescheduled = rescheduled !== undefined ? rescheduled : session.rescheduled;
    const newRescheduledDate = rescheduled_date !== undefined ? rescheduled_date : session.rescheduled_date;
    const newRescheduledTime = rescheduled_time !== undefined ? rescheduled_time : session.rescheduled_time;
    const newActualStart = actual_start !== undefined ? actual_start : session.actual_start;
    const newEndTime = end_time !== undefined ? end_time : session.end_time;
    const newHospital = hospital_id !== undefined ? parseInt(hospital_id, 10) : session.hospital_id;
    const newOpTech = op_technician_id !== undefined ? (op_technician_id ? parseInt(op_technician_id, 10) : null) : session.op_technician_id;
    const newSopTech = sop_technician_id !== undefined ? (sop_technician_id ? parseInt(sop_technician_id, 10) : null) : session.sop_technician_id;
    const newRemarks = remarks !== undefined ? remarks : session.remarks;
    const newStatus = status !== undefined ? status : session.status;

    await query(
      `UPDATE therapy_sessions SET
        patient_name = $1, mobile_number = $2, timings = $3, session_date = $4,
        rescheduled = $5, rescheduled_date = $6, rescheduled_time = $7,
        actual_start = $8, end_time = $9, hospital_id = $10,
        op_technician_id = $11, sop_technician_id = $12, remarks = $13,
        status = $14, updated_at = CURRENT_TIMESTAMP
       WHERE id = $15`,
      [
        newPatient, newMobile, newTimings, newDate,
        newRescheduled, newRescheduledDate, newRescheduledTime,
        newActualStart, newEndTime, newHospital,
        newOpTech, newSopTech, newRemarks,
        newStatus, session.id
      ]
    );

    // 2. Update child table details
    const type = session.therapy_type;
    if (['HBOT', 'Ozone', 'Physiotherapy', 'Dental', 'Pelvic Chair Therapy', 'SIPCD', 'Zero Gravity'].includes(type)) {
      let tableName = 'therapy_hbot';
      if (type === 'Ozone') tableName = 'therapy_ozone';
      else if (type === 'Physiotherapy') tableName = 'therapy_physiotherapy';
      else if (type === 'Dental') tableName = 'therapy_dental';
      else if (type === 'Pelvic Chair Therapy') tableName = 'therapy_pelvic_chair';
      else if (type === 'SIPCD') tableName = 'therapy_sipcd';
      else if (type === 'Zero Gravity') tableName = 'therapy_zero_gravity';

      // Check if details exist
      const detailCheck = await query(`SELECT id FROM ${tableName} WHERE session_id = $1`, [session.id]);
      if (detailCheck.rows.length > 0) {
        // Build values
        const dRes = await query(`SELECT * FROM ${tableName} WHERE session_id = $1`, [session.id]);
        const d = dRes.rows[0];
        const newDiveSurface = dive_surface_timings !== undefined ? dive_surface_timings : d.dive_surface_timings;
        const newPressureType = pressure_type !== undefined ? pressure_type : d.pressure_type;
        const newPressureVal = pressure_value !== undefined ? (pressure_value ? parseInt(pressure_value, 10) : null) : d.pressure_value;
        const newNextDate = next_session_date !== undefined ? next_session_date : d.next_session_date;
        const newNextTime = next_session_time !== undefined ? next_session_time : d.next_session_time;

        await query(
          `UPDATE ${tableName} SET
            dive_surface_timings = $1, pressure_type = $2, pressure_value = $3,
            next_session_date = $4, next_session_time = $5, updated_at = CURRENT_TIMESTAMP
           WHERE session_id = $6`,
          [newDiveSurface, newPressureType, newPressureVal, newNextDate, newNextTime, session.id]
        );
      } else {
        await query(
          `INSERT INTO ${tableName} (
            session_id, dive_surface_timings, pressure_type, pressure_value, next_session_date, next_session_time
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            session.id,
            dive_surface_timings || '',
            pressure_type || '',
            pressure_value ? parseInt(pressure_value, 10) : null,
            next_session_date || '',
            next_session_time || ''
          ]
        );
      }
    } else if (type === 'Lab') {
      const detailCheck = await query(`SELECT id FROM therapy_lab WHERE session_id = $1`, [session.id]);
      if (detailCheck.rows.length > 0) {
        const dRes = await query(`SELECT * FROM therapy_lab WHERE session_id = $1`, [session.id]);
        const d = dRes.rows[0];
        const newTests = tests !== undefined ? tests : d.tests;
        const newReported = reported !== undefined ? reported : d.reported;
        const newPrinted = report_printed !== undefined ? report_printed : d.report_printed;
        const newWhatsapp = whatsapp_report !== undefined ? whatsapp_report : d.whatsapp_report;

        await query(
          `UPDATE therapy_lab SET
            tests = $1, reported = $2, report_printed = $3, whatsapp_report = $4, updated_at = CURRENT_TIMESTAMP
           WHERE session_id = $5`,
          [newTests, newReported, newPrinted, newWhatsapp, session.id]
        );
      } else {
        await query(
          `INSERT INTO therapy_lab (
            session_id, tests, reported, report_printed, whatsapp_report
          ) VALUES ($1, $2, $3, $4, $5)`,
          [session.id, tests || '', reported || 'No', report_printed || 'No', whatsapp_report || 'Not Sent']
        );
      }
    }

    const fullyEnriched = await enrichTherapySession({ ...session, ...req.body });

    await logAudit(
      editorId || null,
      'EDIT_THERAPY',
      'therapy_sessions',
      session.id,
      `Therapy session (${type}) updated for patient '${newPatient}' by ${editorName}`
    );

    return res.status(200).json({
      success: true,
      data: fullyEnriched
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// PUT /api/therapies/:id/verify
export const verifyTherapy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const verifierId = req.user?.id;
    const verifierName = req.user?.name;
    const verifierRole = req.user?.role;
    const { id } = req.params;
    const { remarks, verified } = req.body; // verified: boolean, remarks: string (optional)

    const sessionRes = await query('SELECT * FROM therapy_sessions WHERE id = $1', [parseInt(id, 10)]);
    if (sessionRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Therapy session not found.',
        errorCode: 'SESSION_NOT_FOUND'
      });
    }

    const session = sessionRes.rows[0];
    let updateFields = '';
    const params = [];

    if (verifierRole === 'OP Technician' || verifierRole === 'Admin') {
      // OP Technician verifies or Admin signs off OP Technician name
      // Verify role mapping
      updateFields += 'op_verified = $1';
      params.push(verified === true || verified === 'true');
    }

    if (verifierRole === 'SOP Technician' || verifierRole === 'Admin') {
      // SOP Technician verifies or Admin signs off SOP Technician name
      if (updateFields !== '') updateFields += ', ';
      updateFields += 'sop_verified = $' + (params.length + 1);
      params.push(verified === true || verified === 'true');

      if (remarks !== undefined) {
        updateFields += ', remarks = $' + (params.length + 1);
        params.push(remarks);
      }
    }

    if (params.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permissions to verify this session.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    params.push(session.id);
    const updateSql = `UPDATE therapy_sessions SET ${updateFields} WHERE id = $${params.length} RETURNING *`;
    const updatedRes = await query(updateSql, params);
    let updatedSession = updatedRes.rows[0];

    // Compute session status: only if BOTH op_verified and sop_verified are true, set status = 'Verified'
    const finalOpVerified = updatedSession.op_verified;
    const finalSopVerified = updatedSession.sop_verified;
    let finalStatus = 'Pending Verification';
    let verificationDate = updatedSession.verification_date;

    if (finalOpVerified && finalSopVerified) {
      finalStatus = 'Verified';
      verificationDate = new Date().toISOString();
    } else if (verified === false || verified === 'false') {
      finalStatus = 'Rejected';
    } else {
      finalStatus = 'Pending Verification';
    }

    const finalUpdate = await query(
      'UPDATE therapy_sessions SET status = $1, verification_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [finalStatus, verificationDate, session.id]
    );

    updatedSession = await enrichTherapySession(finalUpdate.rows[0]);

    await logAudit(
      verifierId || null,
      'VERIFY_THERAPY',
      'therapy_sessions',
      session.id,
      `Therapy verification marked for patient '${session.patient_name}' by ${verifierRole} '${verifierName}' (Status: ${finalStatus})`
    );

    return res.status(200).json({
      success: true,
      data: updatedSession
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
