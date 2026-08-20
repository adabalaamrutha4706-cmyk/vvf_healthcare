import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../config/audit';
import { mapLegacyPaymentMethod } from './paymentController';

const getCount = (result: any): number => {
  if (!result || !result.rows || result.rows.length === 0) return 0;
  if (result.rows[0].count !== undefined && result.rows[0].count !== null) {
    return parseInt(result.rows[0].count, 10) || 0;
  }
  return result.rows.length;
};

const getSum = (result: any, fieldName: string, calcFn?: (row: any) => number): number => {
  if (!result || !result.rows || result.rows.length === 0) return 0.00;
  if (result.rows[0][fieldName] !== undefined && result.rows[0][fieldName] !== null) {
    return parseFloat(result.rows[0][fieldName]) || 0.00;
  }
  if (calcFn) {
    return result.rows.reduce((sum: number, row: any) => sum + (calcFn(row) || 0.00), 0.00);
  }
  return 0.00;
};

export const getStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();
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

    // 1. Appointment Counts (Role-Scoped counts of all categories)
    let whereClause = "WHERE is_deleted = false";
    const baseParams: any[] = [];

    if (userRole === 'Doctor') {
      whereClause += " AND appointment_type = 'doctor' AND doctor_id = $1";
      baseParams.push(userId);
    } else if (userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      whereClause += " AND appointment_type = 'dental' AND doctor_id = $1";
      baseParams.push(userId);
    } else if (userRole === 'OP Technician' || userRole === 'SOP Technician') {
      whereClause += " AND appointment_type = 'services'";
    }

    const totalApps = await query(
      `SELECT count(*)::int as count FROM appointments ${whereClause}`,
      baseParams
    );

    const todayParamIdx = baseParams.length + 1;
    const todayApps = await query(
      `SELECT count(*)::int as count FROM appointments ${whereClause} AND appointment_date::text LIKE $${todayParamIdx} AND status != 'Cancelled'`,
      [...baseParams, `%${today}%`]
    );

    const upcomingParamIdx = baseParams.length + 1;
    const upcomingApps = await query(
      `SELECT count(*)::int as count FROM appointments ${whereClause} AND appointment_date > $${upcomingParamIdx} AND status = 'Scheduled'`,
      [...baseParams, nowIso]
    );

    const completedApps = await query(
      `SELECT count(*)::int as count FROM appointments ${whereClause} AND status = 'Completed'`,
      baseParams
    );

    const cancelledApps = await query(
      `SELECT count(*)::int as count FROM appointments ${whereClause} AND status = 'Cancelled'`,
      baseParams
    );

    // Restructured Categories Stats calculation
    const categories = ['doctor', 'dental', 'services'];
    const categoryStats: Record<string, { today: number; upcoming: number; completed: number; cancelled: number }> = {};

    for (const cat of categories) {
      // Role-based scoping: Doctors only see doctor category, Dental Doctors only see dental, Technicians only see services category
      if (userRole === 'Doctor' && cat !== 'doctor') {
        categoryStats[cat] = { today: 0, upcoming: 0, completed: 0, cancelled: 0 };
        continue;
      }
      if ((userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') && cat !== 'dental') {
        categoryStats[cat] = { today: 0, upcoming: 0, completed: 0, cancelled: 0 };
        continue;
      }
      if ((userRole === 'OP Technician' || userRole === 'SOP Technician') && cat !== 'services') {
        categoryStats[cat] = { today: 0, upcoming: 0, completed: 0, cancelled: 0 };
        continue;
      }

      let queryBase = "FROM appointments WHERE is_deleted = false AND appointment_type = $1";
      const paramsBase: any[] = [cat];
      let paramIdx = 2;

      if (userRole === 'Doctor' || userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
        queryBase += ` AND doctor_id = $${paramIdx++}`;
        paramsBase.push(userId);
      }

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
        today: getCount(todayRes),
        upcoming: getCount(upcomingRes),
        completed: getCount(completedRes),
        cancelled: getCount(cancelledRes)
      };
    }

    // 2. Financial Metrics (Hardened Revenue Privacy Boundaries)
    let revenue = 0.00;
    let pendingPayments = 0.00;
    let pendingPaymentsCount = 0;

    if (userRole === 'Admin' || userRole === 'Superadmin') {
      const revenueResult = await query("SELECT sum(amount)::float as revenue FROM payments WHERE is_deleted = false");
      const totalDueResult = await query(
        "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false AND total_amount > paid_amount"
      );
      const countRes = await query(
        "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND (payment_status != 'Completed' AND payment_status != 'Paid' AND payment_status != 'Fully Paid' AND total_amount > paid_amount)"
      );
      revenue = getSum(revenueResult, 'revenue', (row) => row.amount);
      pendingPayments = getSum(totalDueResult, 'pending', (row) => row.total_amount - row.paid_amount);
      pendingPaymentsCount = getCount(countRes);
    } else if (userRole === 'Reception') {
      // Reception can see pending payments operational stats, but revenue remains 0.00
      const totalDueResult = await query(
        "SELECT sum(total_amount - paid_amount)::float as pending FROM appointments WHERE is_deleted = false AND total_amount > paid_amount"
      );
      const countRes = await query(
        "SELECT count(*)::int as count FROM appointments WHERE is_deleted = false AND (payment_status != 'Completed' AND payment_status != 'Paid' AND payment_status != 'Fully Paid' AND total_amount > paid_amount)"
      );
      revenue = 0.00;
      pendingPayments = getSum(totalDueResult, 'pending', (row) => row.total_amount - row.paid_amount);
      pendingPaymentsCount = getCount(countRes);
    } else if (userRole === 'Doctor' || userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      const revenueResult = await query(
        `SELECT sum(p.amount)::float as revenue 
         FROM payments p
         JOIN appointments a ON p.appointment_id = a.id
         WHERE a.doctor_id = $1 AND a.is_deleted = false AND p.is_deleted = false`,
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
      revenue = getSum(revenueResult, 'revenue', (row) => row.amount);
      pendingPayments = getSum(totalDueResult, 'pending', (row) => row.total_amount - row.paid_amount);
      pendingPaymentsCount = getCount(countRes);
    }

    // Compute revenue breakdown
    let revenueBreakdown = { cash: 0.00, upi: 0.00, card: 0.00 };
    if (userRole === 'Admin' || userRole === 'Superadmin' || userRole === 'Doctor' || userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      let paymentsQuery = "";
      let paymentsParams: any[] = [];
      if (userRole === 'Admin' || userRole === 'Superadmin') {
        paymentsQuery = "SELECT amount, payment_method, payment_splits FROM payments WHERE is_deleted = false";
      } else {
        paymentsQuery = `
          SELECT p.amount, p.payment_method, p.payment_splits 
          FROM payments p
          JOIN appointments a ON p.appointment_id = a.id
          WHERE a.doctor_id = $1 AND a.is_deleted = false AND p.is_deleted = false`;
        paymentsParams.push(userId);
      }
      
      const paymentsRes = await query(paymentsQuery, paymentsParams);
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
      
      revenueBreakdown = {
        cash: parseFloat(totalCash.toFixed(2)),
        upi: parseFloat(totalUPI.toFixed(2)),
        card: parseFloat(totalCard.toFixed(2))
      };
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
          WHERE (a.status = 'active' OR a.punch_out IS NULL) AND u.role != 'Superadmin' AND a.is_deleted = false
        `;
      } else {
        activeQuery = "SELECT count(distinct user_id)::int as count FROM attendance WHERE (status = 'active' OR punch_out IS NULL) AND is_deleted = false";
      }

      const activeUsersResult = await query(activeQuery, activeParams);
      activeUsersCount = getCount(activeUsersResult);
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

    let attendanceSummary = null;
    if (['Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant', 'OP Technician', 'SOP Technician'].includes(userRole || '')) {
      const attendanceRes = await query(
        `SELECT 
           COUNT(DISTINCT date)::int as completed_days,
           COALESCE(SUM(duration_minutes), 0)::int as total_minutes
         FROM attendance
         WHERE user_id = $1 AND (status = 'completed' OR punch_out IS NOT NULL) AND is_deleted = false`,
        [userId]
      );
      if (attendanceRes.rows.length > 0) {
        const row = attendanceRes.rows[0];
        const completedDays = row.completed_days || 0;
        const totalMinutes = row.total_minutes || 0;
        const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
        attendanceSummary = {
          completedDays,
          totalHours
        };
      } else {
        attendanceSummary = {
          completedDays: 0,
          totalHours: 0
        };
      }
    }

    // User Performance target calculations
    let myPerformance = null;
    if (['Reception', 'Telecaller', 'Executive', 'Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant', 'OP Technician', 'SOP Technician'].includes(userRole || '')) {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.999Z`;

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      let dailyCount = 0;
      let monthlyCount = 0;

      if (userRole === 'Reception') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND created_by = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND created_by = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      } else if (userRole === 'Telecaller') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM leads 
           WHERE is_deleted = false AND assigned_to = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM leads 
           WHERE is_deleted = false AND assigned_to = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      } else if (userRole === 'Executive') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM visits 
           WHERE is_deleted = false AND executive_id = $1 AND status = 'Completed' AND start_time >= $2 AND start_time <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM visits 
           WHERE is_deleted = false AND executive_id = $1 AND status = 'Completed' AND start_time >= $2 AND start_time <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      } else if (userRole === 'Doctor') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND doctor_id = $1 AND appointment_type = 'doctor' AND status != 'Cancelled' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND doctor_id = $1 AND appointment_type = 'doctor' AND status != 'Cancelled' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      } else if (userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND doctor_id = $1 AND appointment_type = 'dental' AND status != 'Cancelled' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND doctor_id = $1 AND appointment_type = 'dental' AND status != 'Cancelled' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      } else if (userRole === 'OP Technician' || userRole === 'SOP Technician') {
        const dailyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND technician_id = $1 AND appointment_type = 'services' AND status = 'Completed' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyRes = await query(
          `SELECT count(*)::int as count FROM appointments 
           WHERE is_deleted = false AND technician_id = $1 AND appointment_type = 'services' AND status = 'Completed' AND appointment_date >= $2 AND appointment_date <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        dailyCount = getCount(dailyRes);
        monthlyCount = getCount(monthlyRes);
      }

      // Fetch target config from DB
      const userRes = await query('SELECT monthly_target FROM users WHERE id = $1', [userId]);
      const monthlyTarget = userRes.rows[0]?.monthly_target || 0;

      const achievementPercentage = monthlyTarget > 0 
        ? parseFloat(((monthlyCount / monthlyTarget) * 100).toFixed(1))
        : 0.0;

      myPerformance = {
        dailyCount,
        monthlyCount,
        monthlyTarget,
        achievementPercentage
      };
    }

    // Field appointment stats calculation
    let fieldAppointmentStats: any = null;
    
    if (userRole === 'Executive') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.999Z`;

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      try {
        const totalFieldRes = await query(
          `SELECT count(*)::int as count FROM field_appointments WHERE executive_id = $1`,
          [userId]
        );
        const todayFieldRes = await query(
          `SELECT count(*)::int as count FROM field_appointments 
           WHERE executive_id = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, todayStart, todayEnd]
        );
        const monthlyFieldRes = await query(
          `SELECT count(*)::int as count FROM field_appointments 
           WHERE executive_id = $1 AND created_at >= $2 AND created_at <= $3`,
          [userId, startOfMonth, endOfMonth]
        );
        const convertedFieldRes = await query(
          `SELECT count(*)::int as count FROM field_appointments WHERE executive_id = $1 AND status = 'Converted'`,
          [userId]
        );

        fieldAppointmentStats = {
          totalSubmitted: getCount(totalFieldRes),
          todaySubmitted: getCount(todayFieldRes),
          monthlySubmitted: getCount(monthlyFieldRes),
          convertedCount: getCount(convertedFieldRes)
        };
      } catch (e) {
        console.error('Failed to query executive field appointment stats:', e);
      }
    } else if (userRole === 'Admin' || userRole === 'Superadmin') {
      try {
        const totalFieldRes = await query(
          `SELECT count(*)::int as count FROM field_appointments`
        );
        const typeStatsRes = await query(
          `SELECT appointment_type, count(*)::int as count FROM field_appointments GROUP BY appointment_type`
        );
        const topExecsRes = await query(
          `SELECT executive_id, executive_name, count(*)::int as count 
           FROM field_appointments 
           GROUP BY executive_id, executive_name 
           ORDER BY count DESC LIMIT 5`
        );
        const conversionStatsRes = await query(
          `SELECT status, count(*)::int as count FROM field_appointments GROUP BY status`
        );

        const byType = {
          doctor: 0,
          dental: 0,
          therapy: 0
        };
        typeStatsRes.rows.forEach((row: any) => {
          const type = (row.appointment_type || '').toLowerCase();
          if (type.includes('doctor')) byType.doctor += row.count;
          else if (type.includes('dental')) byType.dental += row.count;
          else if (type.includes('therapy')) byType.therapy += row.count;
        });

        fieldAppointmentStats = {
          total: getCount(totalFieldRes),
          byType,
          topExecutives: topExecsRes.rows,
          conversion: conversionStatsRes.rows
        };
      } catch (e) {
        console.error('Failed to query admin field appointment stats:', e);
      }
    }

    const payload = {
      stats: {
        totalAppointments: getCount(totalApps),
        todayAppointments: getCount(todayApps),
        upcomingAppointments: getCount(upcomingApps),
        completedAppointments: getCount(completedApps),
        cancelledAppointments: getCount(cancelledApps),
        categoryStats,
        revenue,
        pendingPayments,
        pendingPaymentsCount,
        revenueBreakdown,
        totalVisits: getCount(totalVisits),
        activeExecutives: getCount(activeExecs),
        totalHospitals: getCount(totalHospitals),
        activeUsers: activeUsersCount,
        attendanceSummary,
        myPerformance,
        fieldAppointmentStats
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
    let appTrendQuery = `
      SELECT date(appointment_date) as date, count(*)::int as appointments
      FROM appointments
      WHERE is_deleted = false
    `;
    const appTrendParams: any[] = [];
    if (userRole === 'Doctor') {
      appTrendQuery += " AND appointment_type = 'doctor' AND doctor_id = $1";
      appTrendParams.push(userId);
    } else if (userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      appTrendQuery += " AND appointment_type = 'dental' AND doctor_id = $1";
      appTrendParams.push(userId);
    } else if (userRole === 'OP Technician' || userRole === 'SOP Technician') {
      appTrendQuery += " AND appointment_type = 'services'";
    }
    appTrendQuery += `
      GROUP BY date(appointment_date)
      ORDER BY date ASC LIMIT 7
    `;
    const appTrend = await query(appTrendQuery, appTrendParams);

    // 2. Revenue collected trend (last 7 days) - respecting boundaries
    let revTrend = { rows: [] as any[] };
    if (userRole === 'Admin' || userRole === 'Superadmin') {
      revTrend = await query(
        `SELECT date(created_at) as date, sum(amount)::float as revenue
         FROM payments
         WHERE is_deleted = false
         GROUP BY date(created_at)
         ORDER BY date ASC LIMIT 7`
      );
    } else if (userRole === 'Doctor' || userRole === 'Dental Doctor' || userRole === 'Dentist Junior' || userRole === 'Dental Assistant') {
      revTrend = await query(
        `SELECT date(p.created_at) as date, sum(p.amount)::float as revenue
         FROM payments p
         JOIN appointments a ON p.appointment_id = a.id
         WHERE a.doctor_id = $1 AND a.is_deleted = false AND p.is_deleted = false
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

export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL',
      [userId]
    );
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};
