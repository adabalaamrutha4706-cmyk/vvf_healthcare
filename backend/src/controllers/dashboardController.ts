import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../config/audit';

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Log revenue access audit trail for dashboard stats
    await logAudit(
      userId || null,
      'REVENUE_ACCESS',
      'dashboard',
      0,
      `Dashboard statistics accessed by ${req.user?.name} (Role: ${userRole})`
    );

    // 1. Appointment Counts
    const totalApps = await query('SELECT count(*)::int as count FROM appointments WHERE is_deleted = false');
    const todayApps = await query(
      "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND appointment_date::text LIKE $1",
      [`%${today}%`]
    );
    const completedApps = await query("SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND payment_status = 'Completed'");

    // 2. Financial Metrics (Hardened Revenue Privacy Boundaries)
    let revenue = 0.00;
    let pendingPayments = 0.00;
    let pendingPaymentsCount = 0;

    if (userRole === 'Admin' || userRole === 'Superadmin') {
      const revenueResult = await query("SELECT sum(amount)::float as revenue FROM payments");
      const totalDueResult = await query(
        "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false AND total_amount > paid_amount"
      );
      const countRes = await query(
        "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND (payment_status != 'Completed' AND payment_status != 'Paid' AND payment_status != 'Fully Paid' AND total_amount > paid_amount)"
      );
      revenue = revenueResult.rows[0].revenue || 0.00;
      pendingPayments = totalDueResult.rows[0].pending || 0.00;
      pendingPaymentsCount = countRes.rows[0].count || 0;
    } else if (userRole === 'Reception') {
      // Reception can see pending payments operational stats, but revenue remains 0.00
      const totalDueResult = await query(
        "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false AND total_amount > paid_amount"
      );
      const countRes = await query(
        "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND (payment_status != 'Completed' AND payment_status != 'Paid' AND payment_status != 'Fully Paid' AND total_amount > paid_amount)"
      );
      revenue = 0.00;
      pendingPayments = totalDueResult.rows[0].pending || 0.00;
      pendingPaymentsCount = countRes.rows[0].count || 0;
    } else if (userRole === 'Doctor') {
      const revenueResult = await query(
        `SELECT sum(p.amount)::float as revenue 
         FROM payments p
         JOIN appointments a ON p.appointment_id = a.id
         WHERE a.doctor_id = $1 AND a.is_deleted = false`,
        [userId]
      );
      const totalDueResult = await query(
        `SELECT sum(total_amount - paid_amount)::float as pending 
         FROM appointments 
         WHERE is_deleted = false AND doctor_id = $1 AND total_amount > paid_amount`,
        [userId]
      );
      const countRes = await query(
        `SELECT count(*)::int as count 
         FROM appointments 
         WHERE is_deleted = false AND doctor_id = $1 AND (payment_status != 'Completed' AND payment_status != 'Paid' AND payment_status != 'Fully Paid' AND total_amount > paid_amount)`,
        [userId]
      );
      revenue = revenueResult.rows[0].revenue || 0.00;
      pendingPayments = totalDueResult.rows[0].pending || 0.00;
      pendingPaymentsCount = countRes.rows[0].count || 0;
    }

    // 3. Executive visits
    const totalVisits = await query("SELECT count(*)::int as count FROM visits WHERE is_deleted = false");
    const activeExecs = await query(
      "SELECT count(distinct executive_id)::int as count FROM visits WHERE status IN ('Checked In', 'Partially Completed', 'Pending Evidence', 'In Progress') AND is_deleted = false"
    );

    // 4. Hospitals
    const totalHospitals = await query("SELECT count(*)::int as count FROM hospitals WHERE is_deleted = false");
    
    // 4b. Active Users Count (attendance status = 'active' or punch_out IS NULL)
    // Filter out Superadmin counts for standard Admins to maintain concealment
    let activeUsersCount = 0;
    try {
      let activeQuery = '';
      let activeParams: any[] = [];
      
      if (userRole === 'Admin') {
        activeQuery = `
          SELECT count(distinct a.user_id)::int as count 
          FROM attendance a
          JOIN users u ON a.user_id = u.id
          WHERE (a.status = 'active' OR a.punch_out IS NULL) AND u.role != 'Superadmin'
        `;
      } else {
        activeQuery = "SELECT count(distinct user_id)::int as count FROM attendance WHERE status = 'active' OR punch_out IS NULL";
      }

      const activeUsersResult = await query(activeQuery, activeParams);
      if (activeUsersResult.rows.length > 0) {
        activeUsersCount = activeUsersResult.rows[0].count || 0;
      }
    } catch (e) {
      // safe fallback
    }

    // 5. Recent Activity Log (Superadmin activities filtered out for standard Admins)
    let auditLogsQuery = `
      SELECT a.*, u.name as user_name, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
    `;
    if (userRole === 'Admin') {
      auditLogsQuery += " WHERE u.role IS NULL OR u.role != 'Superadmin'";
    }
    auditLogsQuery += " ORDER BY a.created_at DESC LIMIT 6";
    
    const auditLogs = await query(auditLogsQuery);

    const payload = {
      stats: {
        totalAppointments: totalApps.rows[0].count,
        todayAppointments: todayApps.rows[0].count,
        completedAppointments: completedApps.rows[0].count,
        revenue,
        pendingPayments,
        pendingPaymentsCount,
        totalVisits: totalVisits.rows[0].count,
        activeExecutives: activeExecs.rows[0].count,
        totalHospitals: totalHospitals.rows[0].count,
        activeUsers: activeUsersCount
      },
      recentActivities: auditLogs.rows
    };

    return res.status(200).json({
      success: true,
      data: payload,
      // Backward compatibility keys
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getChartData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // Log revenue access audit trail for dashboard charts
    await logAudit(
      userId || null,
      'REVENUE_ACCESS',
      'dashboard',
      0,
      `Dashboard chart data accessed by ${req.user?.name} (Role: ${userRole})`
    );

    // 1. Appointment trend (last 7 days)
    const appTrend = await query(
      `SELECT date(appointment_date) as date, count(*)::int as appointments
       FROM appointments
       WHERE is_deleted = false
       GROUP BY date(appointment_date)
       ORDER BY date ASC LIMIT 7`
    );

    // 2. Revenue collected trend (last 7 days) - respecting boundaries
    let revTrend = { rows: [] as any[] };
    if (userRole === 'Admin' || userRole === 'Superadmin') {
      revTrend = await query(
        `SELECT date(created_at) as date, sum(amount)::float as revenue
         FROM payments
         GROUP BY date(created_at)
         ORDER BY date ASC LIMIT 7`
      );
    } else if (userRole === 'Doctor') {
      revTrend = await query(
        `SELECT date(p.created_at) as date, sum(p.amount)::float as revenue
         FROM payments p
         JOIN appointments a ON p.appointment_id = a.id
         WHERE a.doctor_id = $1 AND a.is_deleted = false
         GROUP BY date(p.created_at)
         ORDER BY date ASC LIMIT 7`,
        [userId]
      );
    }

    // 3. Executive visits trend (last 7 days)
    const visitTrend = await query(
      `SELECT date(start_time) as date, count(*)::int as visits
       FROM visits
       WHERE is_deleted = false
       GROUP BY date(start_time)
       ORDER BY date ASC LIMIT 7`
    );

    const payload = {
      appointmentsTrend: appTrend.rows,
      revenueTrend: revTrend.rows,
      visitsTrend: visitTrend.rows
    };

    return res.status(200).json({
      success: true,
      data: payload,
      // Backward compatibility keys
      ...payload
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    // Get notifications for this user (or global notifications where user_id is null)
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    // Hide notifications related to Superadmin activities if recipient is an Admin
    let filteredNotifications = result.rows;
    if (userRole === 'Admin') {
      filteredNotifications = result.rows.filter((n: any) => {
        const text = (n.title + ' ' + n.message).toLowerCase();
        return !text.includes('superadmin') && !text.includes('super administrator');
      });
    }

    return res.status(200).json({
      success: true,
      data: { notifications: filteredNotifications },
      // Backward compatibility key
      notifications: filteredNotifications
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [id]
    );
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
