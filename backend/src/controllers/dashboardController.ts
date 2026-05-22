import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Appointment Counts
    const totalApps = await query('SELECT count(*)::int as count FROM appointments WHERE is_deleted = false');
    const todayApps = await query(
      "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND appointment_date::text LIKE $1",
      [`%${today}%`]
    );
    const completedApps = await query("SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND payment_status = 'Completed'");

    // 2. Financial Metrics
    const revenueResult = await query("SELECT sum(amount)::float as revenue FROM payments");
    const totalDueResult = await query(
      "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false"
    );

    const revenue = revenueResult.rows[0].revenue || 0.00;
    const pendingPayments = totalDueResult.rows[0].pending || 0.00;

    // 3. Executive visits
    const totalVisits = await query("SELECT count(*)::int as count FROM visits WHERE is_deleted = false");
    const activeExecs = await query(
      "SELECT count(distinct executive_id)::int as count FROM visits WHERE status = 'In Progress' AND is_deleted = false"
    );

    // 4. Hospitals
    const totalHospitals = await query("SELECT count(*)::int as count FROM hospitals WHERE is_deleted = false");

    // 5. Recent Activity Log
    const auditLogs = await query(
      `SELECT a.*, u.name as user_name, u.role as user_role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT 6`
    );

    return res.status(200).json({
      stats: {
        totalAppointments: totalApps.rows[0].count,
        todayAppointments: todayApps.rows[0].count,
        completedAppointments: completedApps.rows[0].count,
        revenue,
        pendingPayments,
        totalVisits: totalVisits.rows[0].count,
        activeExecutives: activeExecs.rows[0].count,
        totalHospitals: totalHospitals.rows[0].count
      },
      recentActivities: auditLogs.rows
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getChartData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Generate analytics chart data
    // 1. Appointment trend (last 7 days)
    const appTrend = await query(
      `SELECT date(appointment_date) as date, count(*)::int as appointments
       FROM appointments
       WHERE is_deleted = false
       GROUP BY date(appointment_date)
       ORDER BY date ASC LIMIT 7`
    );

    // 2. Revenue collected trend (last 7 days)
    const revTrend = await query(
      `SELECT date(created_at) as date, sum(amount)::float as revenue
       FROM payments
       GROUP BY date(created_at)
       ORDER BY date ASC LIMIT 7`
    );

    // 3. Executive visits trend (last 7 days)
    const visitTrend = await query(
      `SELECT date(start_time) as date, count(*)::int as visits
       FROM visits
       WHERE is_deleted = false
       GROUP BY date(start_time)
       ORDER BY date ASC LIMIT 7`
    );

    return res.status(200).json({
      appointmentsTrend: appTrend.rows,
      revenueTrend: revTrend.rows,
      visitsTrend: visitTrend.rows
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    // Get notifications for this user (or global notifications where user_id is null)
    const result = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    return res.status(200).json({ notifications: result.rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [id]
    );
    return res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
};
