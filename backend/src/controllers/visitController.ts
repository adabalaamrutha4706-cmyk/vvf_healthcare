import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';

// Helpers
const createNotification = async (title: string, message: string) => {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
      [null, title, message]
    );
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in m
};

export const updateVisitProgressAndStatus = async (visitId: number) => {
  const visitResult = await query('SELECT * FROM visits WHERE id = $1', [visitId]);
  if (visitResult.rows.length === 0) return null;
  const visit = visitResult.rows[0];

  const hasPhoto = visit.evidence_uploaded || false;
  const hasSummary = visit.summary_submitted || false;
  const hasObs = visit.observations_submitted || false;

  let progress = 0;
  if (hasPhoto && hasSummary && hasObs) {
    progress = 100;
  } else if ((hasPhoto && (hasSummary || hasObs)) || (hasSummary && hasObs)) {
    progress = 66;
  } else if (hasPhoto) {
    progress = 33;
  } else {
    progress = 0;
  }

  let newStatus = visit.status;
  // If it is already completed, expired, or cancelled, do not dynamically demote status
  if (visit.status !== 'Completed' && visit.status !== 'Expired' && visit.status !== 'Cancelled') {
    if (progress === 100) {
      newStatus = 'Completed';
    } else if (progress > 0) {
      newStatus = 'Partially Completed';
    } else {
      newStatus = 'Checked In';
    }
  }

  const completedAtVal = (newStatus === 'Completed' && !visit.completed_at) ? new Date().toISOString() : visit.completed_at;

  const updated = await query(
    `UPDATE visits 
     SET completion_progress = $1, status = $2, visit_status = $2, completed_at = $3
     WHERE id = $4 RETURNING *`,
    [progress, newStatus, completedAtVal, visitId]
  );

  return updated.rows[0];
};

export const expireOverdueVisits = async () => {
  try {
    const now = new Date().toISOString();
    
    // 1. Expire visits
    const overdue = await query(
      `SELECT v.id, v.executive_id, h.name as hospital_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.status IN ('Checked In', 'Pending Evidence', 'Partially Completed', 'In Progress') 
         AND v.expires_at < $1 
         AND v.is_deleted = false`,
      [now]
    );

    for (const visit of overdue.rows) {
      await query(
        `UPDATE visits 
         SET status = 'Expired', visit_status = 'Expired', expired_at = $1 
         WHERE id = $2`,
         [now, visit.id]
      );

      await logAudit(
        null,
        'AUTO_EXPIRE_VISIT',
        'visits',
        visit.id,
        `Visit at ${visit.hospital_name} expired automatically after 24 hours.`
      );

      await createNotification(
        'Visit Expired',
        `Visit at ${visit.hospital_name} has expired because the 24-hour completion window passed.`
      );

      if (visit.executive_id) {
        await query(
          'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
          [visit.executive_id, 'Visit Expired', `Your visit at ${visit.hospital_name} has expired.`]
        );
      }
    }

    // 2. Check for reminders (6h, 2h, 30m remaining)
    const activeVisits = await query(
      `SELECT v.id, v.executive_id, v.expires_at, h.name as hospital_name,
              v.reminder_6h_sent, v.reminder_2h_sent, v.reminder_30m_sent
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.status IN ('Checked In', 'Pending Evidence', 'Partially Completed', 'In Progress')
         AND v.expires_at > $1
         AND v.is_deleted = false`,
      [now]
    );

    for (const visit of activeVisits.rows) {
      const timeRemainingMs = new Date(visit.expires_at).getTime() - Date.now();
      const hoursRemaining = timeRemainingMs / (1000 * 60 * 60);

      if (hoursRemaining <= 6 && !visit.reminder_6h_sent) {
        await query('UPDATE visits SET reminder_6h_sent = true WHERE id = $1', [visit.id]);
        if (visit.executive_id) {
          await query(
            'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
            [visit.executive_id, 'Visit Expiration Warning (6h)', `Your visit at ${visit.hospital_name} expires in less than 6 hours.`]
          );
        }
      }

      if (hoursRemaining <= 2 && !visit.reminder_2h_sent) {
        await query('UPDATE visits SET reminder_2h_sent = true WHERE id = $1', [visit.id]);
        if (visit.executive_id) {
          await query(
            'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
            [visit.executive_id, 'Visit Expiration Warning (2h)', `Your visit at ${visit.hospital_name} expires in less than 2 hours.`]
          );
        }
      }

      if (hoursRemaining <= 0.5 && !visit.reminder_30m_sent) {
        await query('UPDATE visits SET reminder_30m_sent = true WHERE id = $1', [visit.id]);
        if (visit.executive_id) {
          await query(
            'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
            [visit.executive_id, 'Visit Expiration Warning (30m)', `Your visit at ${visit.hospital_name} expires in less than 30 minutes!`]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error in expireOverdueVisits:', err);
  }
};

export const startVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;
    const userRole = req.user?.role;

    if (userRole !== 'Executive' && userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only executives can perform visit routines.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    if (req.file) {
      if (req.file.size <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded file is empty or corrupted.',
          errorCode: 'INVALID_FILE'
        });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Supported image types are JPEG, PNG, and WEBP.',
          errorCode: 'INVALID_FILE_TYPE'
        });
      }
    }

    const { 
      hospital_id, 
      gps_lat, 
      gps_lng, 
      gps_accuracy, 
      device_info, 
      is_mock_location, 
      city, 
      state,
      captured_at,
      visit_type
    } = req.body;

    if (!hospital_id) {
      return res.status(400).json({
        success: false,
        message: 'Hospital ID is required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    if (gps_lat === undefined || gps_lng === undefined || gps_lat === null || gps_lng === null) {
      return res.status(400).json({
        success: false,
        message: 'GPS location coordinates are required to check in.',
        errorCode: 'GPS_REQUIRED'
      });
    }

    // 1. Validate device GPS accuracy
    if (gps_accuracy !== undefined && gps_accuracy !== null && parseFloat(gps_accuracy) > 3000) {
      return res.status(400).json({
        success: false,
        message: `GPS accuracy is too low (${Math.round(gps_accuracy)} meters). Please move outdoors and try again.`,
        errorCode: 'LOW_GPS_ACCURACY'
      });
    }

    // 2. Reject fake or invalid (mocked) coordinates
    if (is_mock_location === true || is_mock_location === 'true') {
      return res.status(400).json({
        success: false,
        message: 'Mock location / fake GPS detected. Check-in rejected.',
        errorCode: 'MOCK_LOCATION_DETECTED'
      });
    }

    const visitType = visit_type === 'Dental Visit' ? 'Dental Visit' : 'Field Visit';

    // Prevent multiple active check-ins of the same type
    const activeCheck = await query(
      `SELECT id FROM visits 
       WHERE executive_id = $1 AND visit_type = $2 
         AND status IN ('Checked In', 'Partially Completed', 'Pending Evidence', 'In Progress') 
         AND is_deleted = false LIMIT 1`,
      [executiveId, visitType]
    );
    if (activeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You already have an active ${visitType.toLowerCase()} session in progress. Please check out first.`,
        errorCode: 'ACTIVE_VISIT_EXISTS'
      });
    }

    // Check if hospital exists and get its coordinates
    const hospResult = await query(
      'SELECT name, latitude, longitude, geofencing_enabled, allowed_radius FROM hospitals WHERE id = $1 AND is_deleted = false',
      [hospital_id]
    );

    if (hospResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found.',
        errorCode: 'HOSPITAL_NOT_FOUND'
      });
    }

    const hospital = hospResult.rows[0];
    const hospitalName = hospital.name;
    const hospLat = hospital.latitude;
    const hospLng = hospital.longitude;
    const geofencingEnabled = hospital.geofencing_enabled !== false;
    const allowedRadius = hospital.allowed_radius !== null && hospital.allowed_radius !== undefined ? hospital.allowed_radius : 200;

    if (
      hospLat === null || hospLng === null || hospLat === undefined || hospLng === undefined ||
      isNaN(hospLat) || isNaN(hospLng) ||
      (hospLat === 0 && hospLng === 0) ||
      hospLat < -90 || hospLat > 90 || hospLng < -180 || hospLng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: 'Selected hospital has invalid coordinates. Please contact an administrator.',
        errorCode: 'HOSPITAL_COORDINATES_MISSING'
      });
    }

    // Calculate Distance
    const distance = getDistanceInMeters(
      parseFloat(gps_lat),
      parseFloat(gps_lng),
      hospLat,
      hospLng
    );

    const isInsideGeofence = distance <= allowedRadius;
    const geoStatus = isInsideGeofence ? 'Verified' : 'Failed';

    console.log('[GPS_CHECKIN_DEBUG]', {
      selected_hospital_uid: hospital.hospital_uid,
      hospital_coordinates: { latitude: hospLat, longitude: hospLng },
      user_coordinates: { latitude: parseFloat(gps_lat), longitude: parseFloat(gps_lng) },
      gps_accuracy: gps_accuracy ? parseFloat(gps_accuracy) : 10.0,
      gps_timestamp: captured_at || new Date().toISOString(),
      calculated_distance: distance,
      geofence_radius: allowedRadius,
      validation_result: isInsideGeofence ? 'PASSED' : 'FAILED_GEOFENCE'
    });

    if (geofencingEnabled && !isInsideGeofence) {
      return res.status(400).json({
        success: false,
        message: `Geofence violation. You are ${Math.round(distance)}m away from ${hospitalName}, but the allowed check-in radius is ${allowedRadius}m.`,
        errorCode: 'GEOFENCE_VIOLATION'
      });
    }

    const nowStr = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await query(
      `INSERT INTO visits (
        executive_id, hospital_id, start_time, status, 
        gps_lat, gps_lng, city, state, 
        checkin_latitude, checkin_longitude, checkin_accuracy,
        geo_verification_status, checkin_time, visit_status,
        distance_from_hospital_meters, device_info, is_mock_location,
        expires_at, completion_progress, evidence_uploaded, summary_submitted, observations_submitted,
        checkin_hospital_lat, checkin_hospital_lng, visit_type
      )
      VALUES ($1, $2, $3, 'Checked In', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Checked In', $13, $14, $15, $16, 0, false, false, false, $17, $18, $19) RETURNING *`,
      [
        executiveId,
        parseInt(hospital_id, 10),
        nowStr,
        parseFloat(gps_lat),
        parseFloat(gps_lng),
        city || '',
        state || '',
        parseFloat(gps_lat),
        parseFloat(gps_lng),
        gps_accuracy ? parseFloat(gps_accuracy) : 10.0,
        geoStatus,
        nowStr,
        distance,
        device_info || req.headers['user-agent'] || '',
        is_mock_location === true || is_mock_location === 'true',
        expiresAt,
        hospLat,
        hospLng,
        visitType
      ]
    );

    const visit = result.rows[0];

    if (req.file) {
      const filename = req.file.filename;
      const dateStr = new Date().toISOString().split('T')[0];
      const photoUrl = `/uploads/visits/${dateStr}/${filename}`;

      const photoResult = await query(
        `INSERT INTO visit_photos (visit_id, photo_url, gps_lat, gps_lng, city, state, captured_at, captured_latitude, captured_longitude, captured_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          visit.id,
          photoUrl,
          parseFloat(gps_lat),
          parseFloat(gps_lng),
          city || '',
          state || '',
          nowStr,
          parseFloat(gps_lat),
          parseFloat(gps_lng),
          executiveId
        ]
      );
      visit.photos = [photoResult.rows[0]];
    } else {
      visit.photos = [];
    }

    // Increment total visits and set last visit date for hospital
    await query(
      'UPDATE hospitals SET total_visits = COALESCE(total_visits, 0) + 1, last_visit_date = $1 WHERE id = $2',
      [nowStr, parseInt(hospital_id, 10)]
    );

    await logAudit(
      executiveId || null,
      'START_VISIT',
      'visits',
      visit.id,
      `Executive ${executiveName} checked in at ${hospitalName} (Verified geofence, distance: ${Math.round(distance)}m)`
    );

    await createNotification(
      'Visit Started',
      `${executiveName} checked in at ${hospitalName} (distance: ${Math.round(distance)}m).`
    );

    return res.status(201).json({
      success: true,
      data: { visit }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};


export const uploadVisitPhoto = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;
    const { id } = req.params; // visit_id

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded.',
        errorCode: 'PHOTO_REQUIRED'
      });
    }

    // Strong File Validation
    if (req.file.size <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is empty or corrupted.',
        errorCode: 'INVALID_FILE'
      });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Supported image types are JPEG, PNG, and WEBP.',
        errorCode: 'INVALID_FILE_TYPE'
      });
    }

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name, h.allowed_radius 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin' && visit.executive_id !== executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to upload photos for this visit.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Executives cannot modify expired or cancelled visits
    if (visit.status === 'Expired' || visit.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot upload photos for a ${visit.status.toLowerCase()} visit.`,
        errorCode: 'VISIT_NOT_EDITABLE'
      });
    }

    const filename = req.file.filename;
    const dateStr = new Date().toISOString().split('T')[0];
    const photoUrl = `/uploads/visits/${dateStr}/${filename}`;

    const { gps_lat, gps_lng, city, state, captured_at } = req.body;

    let distance = null;
    let isInsideGeofence = true;
    const hospLat = visit.checkin_hospital_lat;
    const hospLng = visit.checkin_hospital_lng;

    if (hospLat !== null && hospLng !== null && gps_lat !== undefined && gps_lng !== undefined && gps_lat !== null && gps_lng !== null) {
      distance = getDistanceInMeters(
        parseFloat(gps_lat),
        parseFloat(gps_lng),
        parseFloat(hospLat),
        parseFloat(hospLng)
      );
      const allowedRadius = visit.allowed_radius !== null && visit.allowed_radius !== undefined ? visit.allowed_radius : 200;
      isInsideGeofence = distance <= allowedRadius;
    }

    const photoResult = await query(
      `INSERT INTO visit_photos (visit_id, photo_url, gps_lat, gps_lng, city, state, captured_at, captured_latitude, captured_longitude, captured_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        parseInt(id, 10),
        photoUrl,
        gps_lat ? parseFloat(gps_lat) : null,
        gps_lng ? parseFloat(gps_lng) : null,
        city || visit.city || '',
        state || visit.state || '',
        captured_at || new Date().toISOString(),
        gps_lat ? parseFloat(gps_lat) : null,
        gps_lng ? parseFloat(gps_lng) : null,
        executiveId || visit.executive_id || null
      ]
    );

    const newPhoto = photoResult.rows[0];

    // Update flags in database
    await query(
      `UPDATE visits 
       SET evidence_uploaded = true, photo_uploaded_at = NOW()
       WHERE id = $1`,
      [parseInt(id, 10)]
    );

    // Dynamic progress tracking and status updates
    const updatedVisit = await updateVisitProgressAndStatus(parseInt(id, 10));

    const distanceMsg = distance !== null ? ` Distance: ${Math.round(distance)}m from hospital.` : '';
    await logAudit(
      executiveId || null,
      'UPLOAD_VISIT_PHOTO',
      'visit_photos',
      newPhoto.id,
      `Uploaded photo for visit at ${visit.hospital_name}.${distanceMsg} Progress: ${updatedVisit?.completion_progress}%. Status: ${updatedVisit?.status}.`
    );

    return res.status(201).json({
      success: true,
      data: { 
        photo: newPhoto, 
        visit: updatedVisit,
        distance_from_hospital_meters: distance,
        is_inside_geofence: isInsideGeofence,
        warning: !isInsideGeofence ? `Executive is not at the hospital location. Distance: ${Math.round(distance || 0)}m.` : null
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

export const endVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;
    const { id } = req.params; // visit_id
    const { summary, notes, checkout_latitude, checkout_longitude, checkout_accuracy } = req.body;

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin' && visit.executive_id !== executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this visit.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    // Check-out cannot happen unless the user has already checked in.
    if (visit.status !== 'Checked In' && visit.status !== 'In Progress' && visit.status !== 'Partially Completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot check out. Visit is not active or has already been completed.',
        errorCode: 'VISIT_NOT_ACTIVE'
      });
    }

    const existingNotes = visit.notes || '';
    const incomingNotes = notes || '';
    const hasExistingNotes = existingNotes.trim() !== '' && existingNotes.trim() !== 'Checked Out';
    const hasIncomingNotes = incomingNotes.trim() !== '' && incomingNotes.trim() !== 'Checked Out';

    if (!hasExistingNotes && !hasIncomingNotes) {
      return res.status(400).json({
        success: false,
        message: 'At least one detailed visit note/observation must be submitted before completing this visit.',
        errorCode: 'VISIT_NOTE_REQUIRED'
      });
    }

    const nowStr = new Date().toISOString();
    const checkinTime = new Date(visit.checkin_time || visit.start_time);
    const checkoutTime = new Date();
    const durationMs = checkoutTime.getTime() - checkinTime.getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / (1000 * 60)));

    await query(
      `UPDATE visits
       SET status = 'Completed', 
           visit_status = 'Completed',
           checkout_time = $1, 
           completed_at = $1, 
           end_time = $1,
           checkout_latitude = $2, 
           checkout_longitude = $3, 
           checkout_accuracy = $4,
           duration_minutes = $5,
           summary = COALESCE($6, summary, 'Checked Out'),
           notes = COALESCE($7, notes, 'Checked Out'),
           completion_progress = 100,
           summary_submitted = true,
           observations_submitted = true
       WHERE id = $8`,
      [
        nowStr,
        checkout_latitude ? parseFloat(checkout_latitude) : null,
        checkout_longitude ? parseFloat(checkout_longitude) : null,
        checkout_accuracy ? parseFloat(checkout_accuracy) : null,
        durationMinutes,
        summary || null,
        notes || null,
        id
      ]
    );

    const updatedVisitResult = await query('SELECT * FROM visits WHERE id = $1', [id]);
    const updatedVisit = updatedVisitResult.rows[0];

    await logAudit(
      executiveId || null,
      'COMPLETE_VISIT',
      'visits',
      updatedVisit.id,
      `Executive ${executiveName} completed visit at ${visit.hospital_name} (Duration: ${durationMinutes} mins)`
    );

    await createNotification(
      'Visit Completed',
      `${executiveName} completed visit at ${visit.hospital_name}.`
    );

    return res.status(200).json({
      success: true,
      data: { visit: updatedVisit }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const reopenVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const userRole = req.user?.role;
    const { id } = req.params; // visit_id

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name, u.name as executive_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       JOIN users u ON v.executive_id = u.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    // Reset expiry timer, status, completed_at, and reminder flags
    const nowStr = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Determine status based on current completion
    const hasPhoto = visit.evidence_uploaded || false;
    const hasSummary = visit.summary_submitted || false;
    const hasObs = visit.observations_submitted || false;
    
    let progress = 0;
    if (hasPhoto && hasSummary && hasObs) progress = 100;
    else if ((hasPhoto && (hasSummary || hasObs)) || (hasSummary && hasObs)) progress = 66;
    else if (hasPhoto) progress = 33;
    
    const newStatus = progress > 0 ? 'Partially Completed' : 'Checked In';

    const result = await query(
      `UPDATE visits 
       SET status = $1, visit_status = $1, expires_at = $2, 
           completed_at = null, expired_at = null,
           reopened_at = $3, reopened_by = $4,
           reminder_6h_sent = false, reminder_2h_sent = false, reminder_30m_sent = false
       WHERE id = $5 RETURNING *`,
      [newStatus, expiresAt, nowStr, userId, id]
    );

    const updatedVisit = result.rows[0];

    await logAudit(
      userId || null,
      'REOPEN_VISIT',
      'visits',
      updatedVisit.id,
      `Admin ${userName} reopened visit at ${visit.hospital_name} by ${visit.executive_name}`
    );

    await createNotification(
      'Visit Reopened',
      `Admin reopened ${visit.executive_name}'s visit at ${visit.hospital_name}.`
    );

    if (visit.executive_id) {
      await query(
        'INSERT INTO notifications (user_id, title, message) VALUES ($1, $2, $3)',
        [visit.executive_id, 'Visit Reopened', `Your visit at ${visit.hospital_name} has been reopened by Admin.`]
      );
    }

    return res.status(200).json({
      success: true,
      data: { visit: updatedVisit }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const verifyVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const userRole = req.user?.role;
    const { id } = req.params; // visit_id

    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name, u.name as executive_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       JOIN users u ON v.executive_id = u.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Only completed visits can be verified.',
        errorCode: 'VISIT_NOT_COMPLETED'
      });
    }

    const result = await query(
      `UPDATE visits SET status = 'Verified' WHERE id = $1 RETURNING *`,
      [id]
    );

    const verifiedVisit = result.rows[0];

    await logAudit(
      userId || null,
      'VERIFY_VISIT',
      'visits',
      verifiedVisit.id,
      `Admin verified visit at ${visit.hospital_name} by ${visit.executive_name}`
    );

    await createNotification(
      'Visit Verified',
      `Admin verified ${visit.executive_name}'s visit at ${visit.hospital_name}.`
    );

    return res.status(200).json({
      success: true,
      data: { visit: verifiedVisit }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getVisits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await expireOverdueVisits();
    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { type } = req.query;

    let typeFilter = "";
    if (type === 'field') {
      typeFilter = " AND (v.visit_type = 'Field Visit' OR v.visit_type IS NULL)";
    } else if (type === 'dental') {
      typeFilter = " AND v.visit_type = 'Dental Visit'";
    }

    let result;
    if (userRole === 'Executive') {
      // Executives see their own visits
      result = await query(
        `SELECT v.*, 
                v.gps_lat as current_latitude, v.gps_lng as current_longitude, 
                v.checkin_accuracy as gps_accuracy, v.checkin_time as captured_at,
                h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, 
                h.latitude as hospital_latitude, h.longitude as hospital_longitude, 
                u.name as executive_name 
         FROM visits v
         JOIN hospitals h ON v.hospital_id = h.id
         JOIN users u ON v.executive_id = u.id
         WHERE v.is_deleted = false AND v.executive_id = $1${typeFilter}
         ORDER BY v.start_time DESC`,
        [userId]
      );
    } else {
      // Admins and Superadmins see all
      result = await query(
        `SELECT v.*, 
                v.gps_lat as current_latitude, v.gps_lng as current_longitude, 
                v.checkin_accuracy as gps_accuracy, v.checkin_time as captured_at,
                h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, 
                h.latitude as hospital_latitude, h.longitude as hospital_longitude, 
                u.name as executive_name 
         FROM visits v
         JOIN hospitals h ON v.hospital_id = h.id
         JOIN users u ON v.executive_id = u.id
         WHERE v.is_deleted = false${typeFilter}
         ORDER BY v.start_time DESC`
      );
    }

    // Fetch photos for each visit
    const visits = result.rows;
    for (const visit of visits) {
      const photosResult = await query(
        'SELECT vp.*, u.name as captured_by_name FROM visit_photos vp LEFT JOIN users u ON vp.captured_by = u.id WHERE vp.visit_id = $1 ORDER BY vp.captured_at ASC',
        [visit.id]
      );
      visit.photos = photosResult.rows;
    }

    return res.status(200).json({
      success: true,
      data: { visits }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getVisitById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    await expireOverdueVisits();
    const { id } = req.params;
    const result = await query(
      `SELECT v.*, 
              v.gps_lat as current_latitude, v.gps_lng as current_longitude, 
              v.checkin_accuracy as gps_accuracy, v.checkin_time as captured_at,
              h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, 
              h.latitude as hospital_latitude, h.longitude as hospital_longitude, 
              u.name as executive_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       JOIN users u ON v.executive_id = u.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = result.rows[0];
    const photosResult = await query(
      'SELECT vp.*, u.name as captured_by_name FROM visit_photos vp LEFT JOIN users u ON vp.captured_by = u.id WHERE vp.visit_id = $1 ORDER BY vp.captured_at ASC',
      [visit.id]
    );
    visit.photos = photosResult.rows;

    return res.status(200).json({
      success: true,
      data: { visit }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const cancelVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const { id } = req.params; // visit_id

    const visitResult = await query(
      'SELECT * FROM visits WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin' && visit.executive_id !== executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this visit.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    if (['Completed', 'Expired', 'Cancelled', 'Verified'].includes(visit.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only active/pending visits can be cancelled.',
        errorCode: 'VISIT_NOT_ACTIVE'
      });
    }

    await query(
      "UPDATE visits SET is_deleted = true, status = 'Cancelled', visit_status = 'Cancelled' WHERE id = $1",
      [id]
    );

    await logAudit(
      executiveId || null,
      'CANCEL_VISIT',
      'visits',
      parseInt(id, 10),
      `Executive cancelled visit at hospital ID ${visit.hospital_id}`
    );

    return res.status(200).json({
      success: true,
      message: 'Visit cancelled successfully.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updateVisitNotes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, summary } = req.body;
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;

    const visitResult = await query(
      'SELECT * FROM visits WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Visit record not found.',
        errorCode: 'VISIT_NOT_FOUND'
      });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && req.user?.role !== 'Superadmin' && visit.executive_id !== executiveId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to modify notes for this visit.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const result = await query(
      `UPDATE visits 
       SET notes = $1, 
           summary = COALESCE($2, summary),
           observations_submitted = true,
           updated_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [notes || '', summary || null, id]
    );

    const updatedVisit = await updateVisitProgressAndStatus(parseInt(id, 10));

    await logAudit(
      executiveId || null,
      'UPDATE_VISIT_NOTES',
      'visits',
      parseInt(id, 10),
      `Updated notes/observations for visit at hospital ID ${visit.hospital_id}`
    );

    return res.status(200).json({
      success: true,
      message: 'Visit notes saved successfully.',
      visit: updatedVisit || result.rows[0]
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
