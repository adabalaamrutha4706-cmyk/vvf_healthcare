import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import * as path from 'path';

export const getOxygenLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { container_type, movement_type, search, start_date, end_date } = req.query;

    let sql = `
      SELECT o.*, h.name as hospital_name
      FROM oxygen_cylinders o
      LEFT JOIN hospitals h ON o.hospital_id = h.id
      WHERE o.is_deleted = false
    `;
    const params: any[] = [];

    if (container_type && container_type !== 'All') {
      params.push(container_type);
      sql += ` AND o.container_type = $${params.length}`;
    }

    if (movement_type && movement_type !== 'All') {
      params.push(movement_type);
      sql += ` AND o.movement_type = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      sql += ` AND o.entry_datetime >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      sql += ` AND o.entry_datetime <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (o.bill_dc_no ILIKE $${params.length} OR o.psi_pressure ILIKE $${params.length} OR o.notes ILIKE $${params.length} OR o.created_by_name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY o.entry_datetime DESC, o.created_at DESC`;

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      data: { logs: result.rows },
      logs: result.rows
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to fetch oxygen stock logs.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getOxygenSummaryStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        container_type,
        movement_type,
        SUM(COALESCE(quantity, 1)) as total_qty
      FROM oxygen_cylinders
      WHERE is_deleted = false
      GROUP BY container_type, movement_type
    `);

    let cylinderStockIn = 0;
    let cylinderStockOut = 0;
    let tankStockIn = 0;
    let tankStockOut = 0;

    result.rows.forEach((row: any) => {
      const qty = parseInt(row.total_qty || '0', 10);
      if (row.container_type === 'Cylinder') {
        if (row.movement_type === 'Stock-In') cylinderStockIn += qty;
        if (row.movement_type === 'Stock-Out') cylinderStockOut += qty;
      } else if (row.container_type === 'Big Liquid Tank') {
        if (row.movement_type === 'Stock-In') tankStockIn += qty;
        if (row.movement_type === 'Stock-Out') tankStockOut += qty;
      }
    });

    // Today stats
    const todayResult = await query(`
      SELECT 
        movement_type,
        SUM(COALESCE(quantity, 1)) as total_qty
      FROM oxygen_cylinders
      WHERE is_deleted = false AND DATE(entry_datetime) = CURRENT_DATE
      GROUP BY movement_type
    `);

    let todayStockIn = 0;
    let todayStockOut = 0;

    todayResult.rows.forEach((row: any) => {
      const qty = parseInt(row.total_qty || '0', 10);
      if (row.movement_type === 'Stock-In') todayStockIn += qty;
      if (row.movement_type === 'Stock-Out') todayStockOut += qty;
    });

    const summary = {
      cylinders: {
        stockIn: cylinderStockIn,
        stockOut: cylinderStockOut,
        netAvailable: Math.max(0, cylinderStockIn - cylinderStockOut)
      },
      tanks: {
        stockIn: tankStockIn,
        stockOut: tankStockOut,
        netAvailable: Math.max(0, tankStockIn - tankStockOut)
      },
      today: {
        stockIn: todayStockIn,
        stockOut: todayStockOut
      }
    };

    return res.status(200).json({
      success: true,
      data: summary,
      summary
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to calculate oxygen stock stats.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const createOxygenLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;

    const { container_type, movement_type, entry_datetime, bill_dc_no, psi_pressure, quantity, notes, hospital_id } = req.body;

    if (!container_type || !movement_type) {
      return res.status(400).json({
        success: false,
        message: 'Container type (Cylinder or Big Liquid Tank) and movement type (Stock-In or Stock-Out) are required.',
        errorCode: 'VALIDATION_ERROR'
      });
    }

    let photoUrl = null;
    if (req.file) {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = path.basename(req.file.path);
      photoUrl = `/uploads/oxygen/${dateStr}/${filename}`;
    }

    const qty = quantity ? parseInt(quantity, 10) : 1;
    const datetime = entry_datetime ? new Date(entry_datetime).toISOString() : new Date().toISOString();
    const hospId = hospital_id ? parseInt(hospital_id, 10) : null;

    const result = await query(
      `INSERT INTO oxygen_cylinders (
        container_type, movement_type, entry_datetime, bill_dc_no, psi_pressure, photo_url, quantity, notes, hospital_id, created_by, created_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        container_type,
        movement_type,
        datetime,
        bill_dc_no || '',
        psi_pressure || '',
        photoUrl,
        qty,
        notes || '',
        hospId,
        userId || null,
        userName || 'Staff User'
      ]
    );

    const log = result.rows[0];

    await logAudit(
      userId || null,
      'CREATE_OXYGEN_LOG',
      'oxygen_cylinders',
      log.id,
      `${movement_type} logged for ${container_type} (Bill/DC: ${bill_dc_no || 'N/A'}, PSI: ${psi_pressure || 'N/A'}) by ${userName}`
    );

    return res.status(201).json({
      success: true,
      data: { log },
      log
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create oxygen log entry.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const updateOxygenLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params;
    const logId = parseInt(id, 10);

    if (isNaN(logId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format.' });
    }

    const existingResult = await query(
      'SELECT * FROM oxygen_cylinders WHERE id = $1 AND is_deleted = false',
      [logId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Stock log entry not found.' });
    }

    const existing = existingResult.rows[0];
    const { container_type, movement_type, entry_datetime, bill_dc_no, psi_pressure, quantity, notes } = req.body;

    let photoUrl = existing.photo_url;
    if (req.file) {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = path.basename(req.file.path);
      photoUrl = `/uploads/oxygen/${dateStr}/${filename}`;
    }

    const newContainerType = container_type || existing.container_type;
    const newMovementType = movement_type || existing.movement_type;
    const newDatetime = entry_datetime ? new Date(entry_datetime).toISOString() : existing.entry_datetime;
    const newBillDcNo = bill_dc_no !== undefined ? bill_dc_no : existing.bill_dc_no;
    const newPsiPressure = psi_pressure !== undefined ? psi_pressure : existing.psi_pressure;
    const newQuantity = quantity !== undefined ? parseInt(quantity, 10) : existing.quantity;
    const newNotes = notes !== undefined ? notes : existing.notes;

    const result = await query(
      `UPDATE oxygen_cylinders SET
        container_type = $1, movement_type = $2, entry_datetime = $3, bill_dc_no = $4, psi_pressure = $5, photo_url = $6, quantity = $7, notes = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [newContainerType, newMovementType, newDatetime, newBillDcNo, newPsiPressure, photoUrl, newQuantity, newNotes, logId]
    );

    const updatedLog = result.rows[0];

    await logAudit(
      userId || null,
      'EDIT_OXYGEN_LOG',
      'oxygen_cylinders',
      updatedLog.id,
      `Oxygen stock log ID ${logId} updated by ${userName}`
    );

    return res.status(200).json({
      success: true,
      data: { log: updatedLog },
      log: updatedLog
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to update oxygen log entry.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const deleteOxygenLog = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name;
    const { id } = req.params;
    const logId = parseInt(id, 10);

    if (isNaN(logId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format.' });
    }

    const result = await query(
      `UPDATE oxygen_cylinders SET is_deleted = true, deleted_at = NOW() WHERE id = $1 RETURNING *`,
      [logId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Log entry not found.' });
    }

    await logAudit(
      userId || null,
      'DELETE_OXYGEN_LOG',
      'oxygen_cylinders',
      logId,
      `Oxygen stock log ID ${logId} soft deleted by ${userName}`
    );

    return res.status(200).json({
      success: true,
      message: 'Oxygen stock log entry removed.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to delete oxygen log entry.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
