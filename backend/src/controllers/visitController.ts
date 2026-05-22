import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import * as path from 'path';

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

export const startVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;

    if (req.user?.role !== 'Executive' && req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Only executives can perform visit routines.' });
    }

    const { hospital_id, gps_lat, gps_lng, city, state } = req.body;

    if (!hospital_id) {
      return res.status(400).json({ error: 'Hospital ID is required.' });
    }

    // Check if hospital exists
    const hospResult = await query(
      'SELECT name FROM hospitals WHERE id = $1 AND is_deleted = false',
      [hospital_id]
    );

    if (hospResult.rows.length === 0) {
      return res.status(404).json({ error: 'Hospital not found.' });
    }

    const hospitalName = hospResult.rows[0].name;

    // Check if there is already an active visit for this executive
    const activeVisit = await query(
      "SELECT id FROM visits WHERE executive_id = $1 AND status = 'In Progress' AND is_deleted = false LIMIT 1",
      [executiveId]
    );

    if (activeVisit.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a visit in progress. Please complete it first.' });
    }

    const result = await query(
      `INSERT INTO visits (executive_id, hospital_id, start_time, status, gps_lat, gps_lng, city, state)
       VALUES ($1, $2, $3, 'In Progress', $4, $5, $6, $7) RETURNING *`,
      [
        executiveId,
        parseInt(hospital_id, 10),
        new Date().toISOString(),
        gps_lat ? parseFloat(gps_lat) : null,
        gps_lng ? parseFloat(gps_lng) : null,
        city || '',
        state || ''
      ]
    );

    const visit = result.rows[0];

    await logAudit(
      executiveId || null,
      'START_VISIT',
      'visits',
      visit.id,
      `Executive ${executiveName} started a visit at ${hospitalName}`
    );

    await createNotification(
      'Visit Started',
      `${executiveName} has checked in at ${hospitalName}.`
    );

    return res.status(201).json({
      message: 'Visit started successfully.',
      visit
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const uploadVisitPhoto = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;
    const { id } = req.params; // visit_id

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded.' });
    }

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit record not found.' });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && visit.executive_id !== executiveId) {
      return res.status(403).json({ error: 'Unauthorized to upload photos for this visit.' });
    }

    const { gps_lat, gps_lng, city, state, captured_at } = req.body;

    // Generate a relative URL/path for the database
    // Path structure: /uploads/visits/YYYY-MM-DD/filename
    const filename = req.file.filename;
    const dateStr = new Date().toISOString().split('T')[0];
    const photoUrl = `/uploads/visits/${dateStr}/${filename}`;

    const photoResult = await query(
      `INSERT INTO visit_photos (visit_id, photo_url, gps_lat, gps_lng, city, state, captured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        parseInt(id, 10),
        photoUrl,
        gps_lat ? parseFloat(gps_lat) : (visit.gps_lat || null),
        gps_lng ? parseFloat(gps_lng) : (visit.gps_lng || null),
        city || visit.city || '',
        state || visit.state || '',
        captured_at || new Date().toISOString()
      ]
    );

    const newPhoto = photoResult.rows[0];

    await logAudit(
      executiveId || null,
      'UPLOAD_VISIT_PHOTO',
      'visit_photos',
      newPhoto.id,
      `Uploaded photo for visit at ${visit.hospital_name} with GPS geotags.`
    );

    return res.status(201).json({
      message: 'Photo uploaded successfully.',
      photo: newPhoto
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const endVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const executiveId = req.user?.id;
    const executiveName = req.user?.name;
    const { id } = req.params; // visit_id
    const { summary, notes } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Visit summary is required.' });
    }

    const visitResult = await query(
      `SELECT v.*, h.name as hospital_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const visit = visitResult.rows[0];

    if (req.user?.role !== 'Admin' && visit.executive_id !== executiveId) {
      return res.status(403).json({ error: 'Unauthorized to modify this visit.' });
    }

    if (visit.status !== 'In Progress') {
      return res.status(400).json({ error: 'Visit is not in progress.' });
    }

    const result = await query(
      `UPDATE visits
       SET end_time = $1, summary = $2, notes = $3, status = 'Completed'
       WHERE id = $4 RETURNING *`,
      [new Date().toISOString(), summary, notes || '', id]
    );

    const updatedVisit = result.rows[0];

    await logAudit(
      executiveId || null,
      'END_VISIT',
      'visits',
      updatedVisit.id,
      `Executive ${executiveName} completed visit at ${visit.hospital_name}`
    );

    await createNotification(
      'Visit Completed',
      `${executiveName} completed a visit at ${visit.hospital_name}.`
    );

    return res.status(200).json({
      message: 'Visit completed successfully.',
      visit: updatedVisit
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const verifyVisit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params; // visit_id

    // Only Admin can verify visits
    if (req.user?.role !== 'Admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
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
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'Completed') {
      return res.status(400).json({ error: 'Only completed visits can be verified.' });
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
      message: 'Visit verified successfully.',
      visit: verifiedVisit
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getVisits = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let result;
    if (userRole === 'Executive') {
      // Executives see their own visits
      result = await query(
        `SELECT v.*, h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, u.name as executive_name 
         FROM visits v
         JOIN hospitals h ON v.hospital_id = h.id
         JOIN users u ON v.executive_id = u.id
         WHERE v.is_deleted = false AND v.executive_id = $1
         ORDER BY v.start_time DESC`,
        [userId]
      );
    } else {
      // Admins and others see all
      result = await query(
        `SELECT v.*, h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, u.name as executive_name 
         FROM visits v
         JOIN hospitals h ON v.hospital_id = h.id
         JOIN users u ON v.executive_id = u.id
         WHERE v.is_deleted = false
         ORDER BY v.start_time DESC`
      );
    }

    // Fetch photos for each visit
    const visits = result.rows;
    for (const visit of visits) {
      const photosResult = await query(
        'SELECT * FROM visit_photos WHERE visit_id = $1',
        [visit.id]
      );
      visit.photos = photosResult.rows;
    }

    return res.status(200).json({ visits });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getVisitById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT v.*, h.name as hospital_name, h.city as hospital_city, h.state as hospital_state, u.name as executive_name 
       FROM visits v
       JOIN hospitals h ON v.hospital_id = h.id
       JOIN users u ON v.executive_id = u.id
       WHERE v.id = $1 AND v.is_deleted = false`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found.' });
    }

    const visit = result.rows[0];
    const photosResult = await query(
      'SELECT * FROM visit_photos WHERE visit_id = $1',
      [visit.id]
    );
    visit.photos = photosResult.rows;

    return res.status(200).json({ visit });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
