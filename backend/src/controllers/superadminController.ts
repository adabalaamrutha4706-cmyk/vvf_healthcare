import { Response } from 'express';
import { query } from '../config/db';
import { logAudit } from '../config/audit';
import { AuthenticatedRequest } from '../middleware/auth';
import { mapLegacyPaymentMethod } from './paymentController';

// Get unfiltered global stats and activity logs
export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Appointment Counts (Active/Uncancelled)
    const totalApps = await query("SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND status != 'Cancelled'");
    const todayApps = await query(
      "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND appointment_date::text LIKE $1 AND status != 'Cancelled'",
      [`%${today}%`]
    );
    const completedApps = await query("SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND status = 'Completed'");

    // Restructured Categories Stats calculation
    const categories = ['doctor', 'dental', 'services'];
    const categoryStats: Record<string, { today: number; upcoming: number; completed: number; cancelled: number }> = {};
    const nowIso = new Date().toISOString();

    for (const cat of categories) {
      let queryBase = "FROM appointments WHERE is_deleted = false AND appointment_type = $1";
      const paramsBase: any[] = [cat];
      let paramIdx = 2;

      // Today
      const todayQuery = `SELECT count(*)::int as count ${queryBase} AND appointment_date::text LIKE $${paramIdx} AND status != 'Cancelled'`;
      const tParams = [...paramsBase, `%${today}%`];
      const todayRes = await query(todayQuery, tParams);

      // Upcoming
      const upcomingQuery = `SELECT count(*)::int as count ${queryBase} AND appointment_date > $${paramIdx} AND status = 'Scheduled'`;
      const uParams = [...paramsBase, nowIso];
      const upcomingRes = await query(upcomingQuery, uParams);

      // Completed
      const completedQuery = `SELECT count(*)::int as count ${queryBase} AND status = 'Completed'`;
      const completedRes = await query(completedQuery, paramsBase);

      // Cancelled
      const cancelledQuery = `SELECT count(*)::int as count ${queryBase} AND status = 'Cancelled'`;
      const cancelledRes = await query(cancelledQuery, paramsBase);

      categoryStats[cat] = {
        today: todayRes.rows[0].count || 0,
        upcoming: upcomingRes.rows[0].count || 0,
        completed: completedRes.rows[0].count || 0,
        cancelled: cancelledRes.rows[0].count || 0
      };
    }

    // 2. Financial Metrics (Unfiltered)
    const revenueResult = await query("SELECT sum(amount)::float as revenue FROM payments WHERE is_deleted = false");
    const totalDueResult = await query(
      "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false"
    );
    const revenue = revenueResult.rows[0].revenue || 0.00;
    const pendingPayments = totalDueResult.rows[0].pending || 0.00;

    // Compute revenue breakdown (unfiltered for superadmin)
    const paymentsRes = await query("SELECT amount, payment_method, payment_splits FROM payments WHERE is_deleted = false");
    let totalCash = 0;
    let totalUPI = 0;
    let totalCard = 0;
    
    for (const p of paymentsRes.rows) {
      const amt = parseFloat(p.amount) || 0;
      let splits = p.payment_splits;
      if (splits && typeof splits === 'string') {
        try {
          splits = JSON.parse(splits);
        } catch (e) {
          splits = null;
        }
      }
      if (splits && Array.isArray(splits) && splits.length > 0) {
        for (const split of splits) {
          const splitAmt = parseFloat(split.amount) || 0;
          const method = (split.method || '').trim().toLowerCase();
          if (method === 'cash') {
            totalCash += splitAmt;
          } else if (method === 'upi') {
            totalUPI += splitAmt;
          } else if (method === 'card') {
            totalCard += splitAmt;
          } else {
            totalUPI += splitAmt;
          }
        }
      } else {
        const legacyMode = mapLegacyPaymentMethod(p.payment_method);
        if (legacyMode === 'Cash') {
          totalCash += amt;
        } else if (legacyMode === 'Card') {
          totalCard += amt;
        } else {
          totalUPI += amt;
        }
      }
    }
    
    const revenueBreakdown = {
      cash: parseFloat(totalCash.toFixed(2)),
      upi: parseFloat(totalUPI.toFixed(2)),
      card: parseFloat(totalCard.toFixed(2))
    };

    // 3. Executive visits
    const totalVisits = await query("SELECT count(*)::int as count FROM visits WHERE is_deleted = false");
    const activeExecs = await query(
      "SELECT count(distinct executive_id)::int as count FROM visits WHERE status = 'In Progress' AND is_deleted = false"
    );

    // 4. Hospitals
    const totalHospitals = await query("SELECT count(*)::int as count FROM hospitals WHERE is_deleted = false");
    
    // 4b. Active Users Count (Unfiltered)
    let activeUsersCount = 0;
    const activeUsersResult = await query(
      "SELECT count(distinct user_id)::int as count FROM attendance WHERE (status = 'active' OR punch_out IS NULL) AND is_deleted = false"
    );
    if (activeUsersResult.rows.length > 0) {
      activeUsersCount = activeUsersResult.rows[0].count || 0;
    }

    // 5. Recent Activity Log (Unfiltered)
    const auditLogs = await query(`
      SELECT a.*, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC LIMIT 15
    `);

    // Audit log for Superadmin stats access
    await logAudit(
      req.user?.id || null,
      'REVENUE_ACCESS',
      'superadmin_dashboard',
      0,
      `Superadmin statistics accessed by ${req.user?.name}`
    );

    const payload = {
      stats: {
        totalAppointments: totalApps.rows[0].count,
        todayAppointments: todayApps.rows[0].count,
        completedAppointments: completedApps.rows[0].count,
        categoryStats,
        revenue,
        pendingPayments,
        revenueBreakdown,
        totalVisits: totalVisits.rows[0].count,
        activeExecutives: activeExecs.rows[0].count,
        totalHospitals: totalHospitals.rows[0].count,
        activeUsers: activeUsersCount
      },
      recentActivities: auditLogs.rows
    };

    return res.status(200).json({
      success: true,
      data: payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get all users (including Superadmins and soft-deleted users)
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, phone, is_active, is_deleted, deleted_at, password_change_count, password_change_limit, password_change_locked, created_at FROM users ORDER BY id ASC'
    );
    
    return res.status(200).json({
      success: true,
      data: { users: result.rows }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get all attendance records (including Superadmins)
export const getAttendance = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersResult = await query('SELECT id, name, email, role FROM users');
    const userMap = new Map<number, any>();
    usersResult.rows.forEach((u: any) => {
      userMap.set(u.id, u);
    });

    const attendanceResult = await query('SELECT * FROM attendance WHERE is_deleted = false ORDER BY punch_in DESC');
    
    const enriched = attendanceResult.rows.map((r: any) => {
      const u = userMap.get(r.user_id);
      return {
        ...r,
        user_name: u ? u.name : 'Unknown User',
        user_role: u ? u.role : 'Unknown Role',
        user_email: u ? u.email : ''
      };
    });

    // Audit log for attendance access
    await logAudit(
      req.user?.id || null,
      'ATTENDANCE_ACCESS',
      'superadmin_attendance',
      0,
      `Superadmin attendance logs accessed by ${req.user?.name}`
    );

    return res.status(200).json({
      success: true,
      data: { records: enriched }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get all system audit logs
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT a.*, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);
    
    return res.status(200).json({
      success: true,
      data: { auditLogs: result.rows }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get all appointments (including soft-deleted ones)
export const getAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT a.*, h.name as hospital_name, u.name as doctor_name, t.name as technician_name
      FROM appointments a
      LEFT JOIN hospitals h ON a.hospital_id = h.id
      LEFT JOIN users u ON a.doctor_id = u.id
      LEFT JOIN users t ON a.technician_id = t.id
      ORDER BY a.created_at DESC
    `);
    
    return res.status(200).json({
      success: true,
      data: { appointments: result.rows }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Permanently delete user
export const deleteUserPermanent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const superadminId = req.user?.id;
    const superadminName = req.user?.name;

    if (parseInt(id, 10) === superadminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot permanently delete your own superadmin account.',
        errorCode: 'SELF_DELETION_BLOCKED'
      });
    }

    const checkResult = await query('SELECT name, role FROM users WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const user = checkResult.rows[0];

    // Soft delete attendance records, nullify audit logs, and soft delete the user
    await query('UPDATE attendance SET is_deleted = true, deleted_at = NOW() WHERE user_id = $1', [id]);
    await query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [id]);
    await query('UPDATE users SET is_deleted = true, deleted_at = NOW(), is_active = false WHERE id = $1', [id]);

    await logAudit(
      superadminId || null,
      'SOFT_DELETE_USER',
      'users',
      parseInt(id, 10),
      `User '${user.name}' (Role: ${user.role}) soft deleted by Superadmin ${superadminName}`
    );

    return res.status(200).json({
      success: true,
      message: 'User soft-deleted from system.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Permanently delete appointment
export const deleteAppointmentPermanent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const superadminId = req.user?.id;
    const superadminName = req.user?.name;

    const checkResult = await query('SELECT patient_name FROM appointments WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found.',
        errorCode: 'APPOINTMENT_NOT_FOUND'
      });
    }

    const app = checkResult.rows[0];

    // Soft delete related payments first, then soft delete the appointment
    await query('UPDATE payments SET is_deleted = true, deleted_at = NOW() WHERE appointment_id = $1', [id]);
    await query('UPDATE appointments SET is_deleted = true, deleted_at = NOW() WHERE id = $1', [id]);

    await logAudit(
      superadminId || null,
      'SOFT_DELETE_APPOINTMENT',
      'appointments',
      parseInt(id, 10),
      `Appointment for ${app.patient_name} soft deleted by Superadmin ${superadminName}`
    );

    return res.status(200).json({
      success: true,
      message: 'Appointment soft-deleted from system.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
