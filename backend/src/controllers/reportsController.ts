import { Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getDailyReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'Admin' && userRole !== 'Superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        errorCode: 'ACCESS_DENIED'
      });
    }

    const { startDate, endDate, role, userId, page = 1, limit = 50 } = req.query;

    const pNum = parseInt(page as string, 10);
    const lNum = parseInt(limit as string, 10);
    const offset = (pNum - 1) * lNum;

    // Date boundaries calculations
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = `${todayStr}T00:00:00.000Z`;
    const todayEnd = `${todayStr}T23:59:59.999Z`;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

    const rangeStart = startDate ? `${startDate}T00:00:00.000Z` : new Date(0).toISOString();
    const rangeEnd = endDate ? `${endDate}T23:59:59.999Z` : new Date().toISOString();

    // 1. Fetch filtered users list (the subject of the reports)
    let userFilterClause = "WHERE is_deleted = false AND role IN ('Reception', 'Telecaller', 'Executive', 'Doctor', 'Dental Doctor', 'Dentist Junior', 'Dental Assistant', 'OP Technician', 'SOP Technician')";
    const userParams: any[] = [];
    let userParamIdx = 1;

    if (role && role !== 'All') {
      userFilterClause += ` AND role = $${userParamIdx++}`;
      userParams.push(role);
    }

    if (userId && userId !== 'All') {
      userFilterClause += ` AND id = $${userParamIdx++}`;
      userParams.push(parseInt(userId as string, 10));
    }

    // Get total users count for pagination
    const totalUsersRes = await query(
      `SELECT COUNT(*)::int as count FROM users ${userFilterClause}`,
      userParams
    );
    const totalUsersCount = totalUsersRes.rows[0].count || 0;

    // Get paginated users
    const usersRes = await query(
      `SELECT id, name, role, monthly_target FROM users 
       ${userFilterClause} 
       ORDER BY role ASC, name ASC 
       LIMIT $${userParamIdx++} OFFSET $${userParamIdx++}`,
      [...userParams, lNum, offset]
    );

    const users = usersRes.rows;
    const userIds = users.map(u => u.id);

    // 2. Optimized database aggregation queries (bulk fetch grouped by user_id)
    // Initialize stats containers
    const recStatsMap: Record<number, any> = {};
    const telStatsMap: Record<number, any> = {};
    const exeStatsMap: Record<number, any> = {};
    const docStatsMap: Record<number, any> = {};
    const denStatsMap: Record<number, any> = {};
    const techStatsMap: Record<number, any> = {};

    if (userIds.length > 0) {
      // Group receptionists stats
      const recRes = await query(
        `SELECT 
           created_by as user_id,
           COUNT(*)::int as total_created,
           COUNT(DISTINCT contact_number)::int as total_patients,
           COUNT(CASE WHEN created_at >= $1 AND created_at <= $2 THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN created_at >= $3 AND created_at <= $4 THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN created_at >= $5 AND created_at <= $6 THEN 1 END)::int as range_count,
           MAX(created_at) as last_activity
         FROM appointments
         WHERE is_deleted = false AND created_by = ANY($7)
         GROUP BY created_by`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      recRes.rows.forEach(row => { recStatsMap[row.user_id] = row; });

      // Group telecallers stats
      const telRes = await query(
        `SELECT 
           assigned_to as user_id,
           COUNT(*)::int as total_calls,
           COUNT(CASE WHEN status IN ('Connected', 'Interested', 'Confirmed', 'Follow-up', 'Follow Up') THEN 1 END)::int as connected_calls,
           COUNT(CASE WHEN status IN ('Follow-up', 'Follow Up', 'Callback Requested') THEN 1 END)::int as followup_calls,
           COUNT(CASE WHEN created_at >= $1 AND created_at <= $2 THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN created_at >= $3 AND created_at <= $4 THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN created_at >= $5 AND created_at <= $6 THEN 1 END)::int as range_count,
           MAX(created_at) as last_activity
         FROM leads
         WHERE is_deleted = false AND assigned_to = ANY($7)
         GROUP BY assigned_to`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      telRes.rows.forEach(row => { telStatsMap[row.user_id] = row; });

      // Group executives stats
      const exeRes = await query(
        `SELECT 
           executive_id as user_id,
           COUNT(*)::int as total_visits,
           COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int as completed_visits,
           COUNT(CASE WHEN status != 'Completed' THEN 1 END)::int as pending_visits,
           COUNT(CASE WHEN start_time >= $1 AND start_time <= $2 THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN start_time >= $3 AND start_time <= $4 THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN start_time >= $5 AND start_time <= $6 THEN 1 END)::int as range_count,
           MAX(start_time) as last_activity
         FROM visits
         WHERE is_deleted = false AND executive_id = ANY($7)
         GROUP BY executive_id`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      exeRes.rows.forEach(row => { exeStatsMap[row.user_id] = row; });

      // Group doctors stats
      const docRes = await query(
        `SELECT 
           doctor_id as user_id,
           COUNT(*)::int as total_assigned,
           COUNT(CASE WHEN status != 'Scheduled' THEN 1 END)::int as handled_count,
           COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int as completed_count,
           COUNT(CASE WHEN status = 'Cancelled' THEN 1 END)::int as cancelled_count,
           COUNT(CASE WHEN appointment_date >= $1 AND appointment_date <= $2 AND status != 'Cancelled' THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN appointment_date >= $3 AND appointment_date <= $4 AND status != 'Cancelled' THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN appointment_date >= $5 AND appointment_date <= $6 AND status != 'Cancelled' THEN 1 END)::int as range_count,
           MAX(appointment_date) as last_activity
         FROM appointments
         WHERE is_deleted = false AND doctor_id = ANY($7) AND appointment_type = 'doctor'
         GROUP BY doctor_id`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      docRes.rows.forEach(row => { docStatsMap[row.user_id] = row; });

      // Group dental doctors stats
      const denRes = await query(
        `SELECT 
           doctor_id as user_id,
           COUNT(*)::int as total_assigned,
           COUNT(CASE WHEN status != 'Scheduled' THEN 1 END)::int as handled_count,
           COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int as completed_count,
           COUNT(CASE WHEN status = 'Cancelled' THEN 1 END)::int as cancelled_count,
           COUNT(CASE WHEN appointment_date >= $1 AND appointment_date <= $2 AND status != 'Cancelled' THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN appointment_date >= $3 AND appointment_date <= $4 AND status != 'Cancelled' THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN appointment_date >= $5 AND appointment_date <= $6 AND status != 'Cancelled' THEN 1 END)::int as range_count,
           MAX(appointment_date) as last_activity
         FROM appointments
         WHERE is_deleted = false AND doctor_id = ANY($7) AND appointment_type = 'dental'
         GROUP BY doctor_id`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      denRes.rows.forEach(row => { denStatsMap[row.user_id] = row; });

      // Group technicians stats
      const techRes = await query(
        `SELECT 
           technician_id as user_id,
           COUNT(*)::int as total_assigned,
           COUNT(CASE WHEN status = 'Completed' THEN 1 END)::int as completed_count,
           COUNT(CASE WHEN status != 'Completed' AND status != 'Cancelled' THEN 1 END)::int as pending_count,
           COUNT(CASE WHEN appointment_date >= $1 AND appointment_date <= $2 AND status != 'Cancelled' THEN 1 END)::int as daily_count,
           COUNT(CASE WHEN appointment_date >= $3 AND appointment_date <= $4 AND status != 'Cancelled' THEN 1 END)::int as monthly_count,
           COUNT(CASE WHEN appointment_date >= $5 AND appointment_date <= $6 AND status != 'Cancelled' THEN 1 END)::int as range_count,
           MAX(appointment_date) as last_activity
         FROM appointments
         WHERE is_deleted = false AND technician_id = ANY($7) AND appointment_type = 'services'
         GROUP BY technician_id`,
        [todayStart, todayEnd, startOfMonth, endOfMonth, rangeStart, rangeEnd, userIds]
      );
      techRes.rows.forEach(row => { techStatsMap[row.user_id] = row; });
    }

    // Map stats back to users grouped by role sections
    const roleSections: Record<string, any[]> = {
      'Reception': [],
      'Telecaller': [],
      'Executive': [],
      'Doctor': [],
      'Dental Doctor': [],
      'Dentist Junior': [],
      'Dental Assistant': [],
      'OP Technician': [],
      'SOP Technician': []
    };

    users.forEach(u => {
      const eId = `EMP-${u.id}`;
      const mTarget = u.monthly_target || 0;
      let data: any = { id: u.id, name: u.name, employeeId: eId };

      if (u.role === 'Reception') {
        const stats = recStatsMap[u.id] || {};
        data = {
          ...data,
          totalAppointmentsCreated: stats.total_created || 0,
          totalPatientsRegistered: stats.total_patients || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      } else if (u.role === 'Telecaller') {
        const stats = telStatsMap[u.id] || {};
        data = {
          ...data,
          totalCallsMade: stats.total_calls || 0,
          connectedCalls: stats.connected_calls || 0,
          followupCalls: stats.followup_calls || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      } else if (u.role === 'Executive') {
        const stats = exeStatsMap[u.id] || {};
        data = {
          ...data,
          totalVisitsLogged: stats.total_visits || 0,
          visitsCompleted: stats.completed_visits || 0,
          visitsPending: stats.pending_visits || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      } else if (u.role === 'Doctor') {
        const stats = docStatsMap[u.id] || {};
        data = {
          ...data,
          appointmentsAssigned: stats.total_assigned || 0,
          appointmentsHandled: stats.handled_count || 0,
          appointmentsCompleted: stats.completed_count || 0,
          appointmentsCancelled: stats.cancelled_count || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      } else if (u.role === 'Dental Doctor' || u.role === 'Dentist Junior' || u.role === 'Dental Assistant') {
        const stats = denStatsMap[u.id] || {};
        data = {
          ...data,
          dentalAppointmentsAssigned: stats.total_assigned || 0,
          dentalAppointmentsHandled: stats.handled_count || 0,
          dentalAppointmentsCompleted: stats.completed_count || 0,
          dentalAppointmentsCancelled: stats.cancelled_count || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      } else if (u.role === 'OP Technician' || u.role === 'SOP Technician') {
        const stats = techStatsMap[u.id] || {};
        data = {
          ...data,
          serviceAppointmentsAssigned: stats.total_assigned || 0,
          serviceAppointmentsCompleted: stats.completed_count || 0,
          serviceAppointmentsPending: stats.pending_count || 0,
          dailyCount: stats.daily_count || 0,
          monthlyCount: stats.monthly_count || 0,
          rangeCount: stats.range_count || 0
        };
      }

      // Map targets & activity audit metrics
      const currentRoleStats = 
        u.role === 'Reception' ? recStatsMap[u.id] :
        u.role === 'Telecaller' ? telStatsMap[u.id] :
        u.role === 'Executive' ? exeStatsMap[u.id] :
        u.role === 'Doctor' ? docStatsMap[u.id] :
        u.role === 'Dental Doctor' ? denStatsMap[u.id] :
        techStatsMap[u.id];

      const lastActivity = currentRoleStats?.last_activity || null;
      const mCount = data.monthlyCount || 0;
      const achievement = mTarget > 0 ? parseFloat(((mCount / mTarget) * 100).toFixed(1)) : 0.0;

      data = {
        ...data,
        monthlyTarget: mTarget,
        achievementPercentage: achievement,
        lastActivityTime: lastActivity
      };

      if (roleSections[u.role]) {
        roleSections[u.role].push(data);
      }
    });

    // 3. Centralized Dashboard Cards Queries (filtered by target user/role if provided)
    let appTodayClause = "WHERE is_deleted = false AND appointment_date >= $1 AND appointment_date <= $2 AND status != 'Cancelled'";
    let leadTodayClause = "WHERE is_deleted = false AND created_at >= $1 AND created_at <= $2";
    let visitTodayClause = "WHERE is_deleted = false AND start_time >= $1 AND start_time <= $2";
    let activeUsersClause = "WHERE (status = 'active' OR punch_out IS NULL) AND date::text LIKE $1 AND a.is_deleted = false";
    
    // monthly activities counts clauses
    let appMonthClause = "WHERE is_deleted = false AND status = 'Completed' AND appointment_date >= $1 AND appointment_date <= $2";
    let leadMonthClause = "WHERE is_deleted = false AND status IN ('Connected', 'Interested', 'Confirmed') AND created_at >= $1 AND created_at <= $2";
    let visitMonthClause = "WHERE is_deleted = false AND status = 'Completed' AND start_time >= $1 AND start_time <= $2";

    const appTodayParams: any[] = [todayStart, todayEnd];
    const leadTodayParams: any[] = [todayStart, todayEnd];
    const visitTodayParams: any[] = [todayStart, todayEnd];
    const activeUsersParams: any[] = [`%${todayStr}%`];

    const appMonthParams: any[] = [startOfMonth, endOfMonth];
    const leadMonthParams: any[] = [startOfMonth, endOfMonth];
    const visitMonthParams: any[] = [startOfMonth, endOfMonth];

    let filterIdx = 3;
    let activeUsersFilterIdx = 2;

    if (role && role !== 'All') {
      if (role === 'Doctor' || role === 'Dental Doctor' || role === 'Dentist Junior' || role === 'Dental Assistant') {
        const typeFilter = role === 'Doctor' ? 'doctor' : 'dental';
        appTodayClause += ` AND appointment_type = $${filterIdx}`;
        appMonthClause += ` AND appointment_type = $${filterIdx}`;
        appTodayParams.push(typeFilter);
        appMonthParams.push(typeFilter);
        filterIdx++;

        // Doctors/Dental Doctors don't make calls or visits
        leadTodayClause += " AND 1=0";
        leadMonthClause += " AND 1=0";
        visitTodayClause += " AND 1=0";
        visitMonthClause += " AND 1=0";
      } else if (role === 'Telecaller') {
        appTodayClause += " AND 1=0";
        appMonthClause += " AND 1=0";
        visitTodayClause += " AND 1=0";
        visitMonthClause += " AND 1=0";
      } else if (role === 'Executive') {
        appTodayClause += " AND 1=0";
        appMonthClause += " AND 1=0";
        leadTodayClause += " AND 1=0";
        leadMonthClause += " AND 1=0";
      } else if (role === 'OP Technician' || role === 'SOP Technician') {
        appTodayClause += " AND appointment_type = 'services'";
        appMonthClause += " AND appointment_type = 'services'";
        leadTodayClause += " AND 1=0";
        leadMonthClause += " AND 1=0";
        visitTodayClause += " AND 1=0";
        visitMonthClause += " AND 1=0";
      } else if (role === 'Reception') {
        leadTodayClause += " AND 1=0";
        leadMonthClause += " AND 1=0";
        visitTodayClause += " AND 1=0";
        visitMonthClause += " AND 1=0";
      }

      // Active users of this role
      activeUsersClause += ` AND role = $${activeUsersFilterIdx++}`;
      activeUsersParams.push(role);
    }

    if (userId && userId !== 'All') {
      const uId = parseInt(userId as string, 10);
      if (role === 'Doctor' || role === 'Dental Doctor' || role === 'Dentist Junior' || role === 'Dental Assistant') {
        appTodayClause += ` AND doctor_id = $${filterIdx}`;
        appMonthClause += ` AND doctor_id = $${filterIdx}`;
        appTodayParams.push(uId);
        appMonthParams.push(uId);
        filterIdx++;
      } else if (role === 'Telecaller') {
        leadTodayClause += ` AND assigned_to = $${filterIdx}`;
        leadMonthClause += ` AND assigned_to = $${filterIdx}`;
        leadTodayParams.push(uId);
        leadMonthParams.push(uId);
        filterIdx++;
      } else if (role === 'Executive') {
        visitTodayClause += ` AND executive_id = $${filterIdx}`;
        visitMonthClause += ` AND executive_id = $${filterIdx}`;
        visitTodayParams.push(uId);
        visitMonthParams.push(uId);
        filterIdx++;
      } else if (role === 'OP Technician' || role === 'SOP Technician') {
        appTodayClause += ` AND technician_id = $${filterIdx}`;
        appMonthClause += ` AND technician_id = $${filterIdx}`;
        appTodayParams.push(uId);
        appMonthParams.push(uId);
        filterIdx++;
      } else if (role === 'Reception') {
        appTodayClause += ` AND created_by = $${filterIdx}`;
        appMonthClause += ` AND created_by = $${filterIdx}`;
        appTodayParams.push(uId);
        appMonthParams.push(uId);
        filterIdx++;
      }

      // Active user count should check specifically for this ID
      activeUsersClause = `WHERE (status = 'active' OR punch_out IS NULL) AND date::text LIKE $1 AND user_id = $2 AND a.is_deleted = false`;
      activeUsersParams.push(uId);
    }

    // Run Today Cards
    const appTodayRes = await query(`SELECT count(*)::int as count FROM appointments ${appTodayClause}`, appTodayParams);
    const leadTodayRes = await query(`SELECT count(*)::int as count FROM leads ${leadTodayClause}`, leadTodayParams);
    const visitTodayRes = await query(`SELECT count(*)::int as count FROM visits ${visitTodayClause}`, visitTodayParams);
    const activeUsersRes = await query(
      `SELECT count(distinct user_id)::int as count 
       FROM attendance a 
       JOIN users u ON a.user_id = u.id 
       ${activeUsersClause}`,
      activeUsersParams
    );

    // Service Appointments Today
    let serviceTodayClause = "WHERE is_deleted = false AND appointment_type = 'services' AND appointment_date >= $1 AND appointment_date <= $2 AND status != 'Cancelled'";
    const serviceTodayParams: any[] = [todayStart, todayEnd];
    if (userId && userId !== 'All' && (role === 'OP Technician' || role === 'SOP Technician')) {
      serviceTodayClause += ` AND technician_id = $3`;
      serviceTodayParams.push(parseInt(userId as string, 10));
    } else if (role && (role === 'OP Technician' || role === 'SOP Technician')) {
      // no user ID specified, already scoped by services type
    } else if (role && role !== 'All') {
      // If a non-technician role is filtered, service appointments counts is 0
      serviceTodayClause += " AND 1=0";
    }
    const serviceTodayRes = await query(`SELECT count(*)::int as count FROM appointments ${serviceTodayClause}`, serviceTodayParams);

    // Run Month Activities
    const appMonthRes = await query(`SELECT count(*)::int as count FROM appointments ${appMonthClause}`, appMonthParams);
    const leadMonthRes = await query(`SELECT count(*)::int as count FROM leads ${leadMonthClause}`, leadMonthParams);
    const visitMonthRes = await query(`SELECT count(*)::int as count FROM visits ${visitMonthClause}`, visitMonthParams);

    const monthlyActivities = (appMonthRes.rows[0].count || 0) + (leadMonthRes.rows[0].count || 0) + (visitMonthRes.rows[0].count || 0);

    const stats = {
      totalAppointmentsToday: appTodayRes.rows[0].count || 0,
      totalCallsToday: leadTodayRes.rows[0].count || 0,
      totalVisitsToday: visitTodayRes.rows[0].count || 0,
      totalServiceAppointmentsToday: serviceTodayRes.rows[0].count || 0,
      activeUsersToday: activeUsersRes.rows[0].count || 0,
      totalActivitiesThisMonth: monthlyActivities
    };

    return res.status(200).json({
      success: true,
      data: {
        stats,
        rolesData: roleSections,
        pagination: {
          total: totalUsersCount,
          page: pNum,
          limit: lNum,
          totalPages: Math.ceil(totalUsersCount / lNum)
        }
      }
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error.',
      errorCode: 'INTERNAL_ERROR',
      error: err.message || 'Internal server error.'
    });
  }
};
