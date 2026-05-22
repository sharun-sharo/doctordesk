const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');
const {
  appointmentDoctorFilter,
  invoiceBillingDoctorFilter,
  INVOICE_REVENUE_FROM,
  invoiceRevenueSumQuery,
  invoiceCollectionSumQuery,
} = require('../utils/clinicScope');

/** Patient scope for dashboard counts/charts: same as patient list (assigned doctors only). assignedAdminId fallback for staff when receptionist_doctors is empty. */
function getPatientScopeForDashboard(roleId, userId, assignedAdminId = null) {
  if (roleId === ROLES.SUPER_ADMIN) return { condition: '', params: [] };
  if (roleId === ROLES.DOCTOR) {
    return {
      condition: ' AND (p.id IN (SELECT patient_id FROM appointments WHERE doctor_id = ? AND deleted_at IS NULL) OR p.created_by = ?)',
      params: [userId, userId],
    };
  }
  if (roleId === ROLES.ADMIN) {
    return {
      condition:
        ' AND (p.id IN (SELECT patient_id FROM appointments WHERE deleted_at IS NULL AND (doctor_id = ? OR doctor_id IN (SELECT id FROM users WHERE assigned_admin_id = ? AND deleted_at IS NULL))) OR p.created_by = ?)',
      params: [userId, userId, userId],
    };
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    // Include patients created by assigned doctor (e.g. CSV upload) so dashboard count matches patient list.
    return {
      condition: ' AND (p.id IN (SELECT a.patient_id FROM appointments a WHERE a.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))) OR p.created_by = ? OR (p.created_by = ? AND ? IS NOT NULL))',
      params: [userId, assignedAdminId, assignedAdminId, userId, assignedAdminId, assignedAdminId],
    };
  }
  return { condition: ' AND 0 = 1', params: [] };
}

async function getStats(req, res, next) {
  try {
    const userId = req.user.id;
    const roleId = req.user.roleId;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;
    const apptFilter = appointmentDoctorFilter(roleId, userId, req.user.assignedAdminId, 'a');
    const invFilter = invoiceBillingDoctorFilter(roleId, userId, req.user.assignedAdminId);

    const patientScope = getPatientScopeForDashboard(roleId, userId, req.user.assignedAdminId);
    const [patientsCount] = await pool.execute(
      `SELECT COUNT(*) AS total FROM patients p WHERE p.deleted_at IS NULL${patientScope.condition}`,
      patientScope.params
    );

    // Only count appointments whose patient is not deleted (match appointments list behavior)
    let upcomingSql = `SELECT COUNT(*) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.status = 'scheduled' AND a.appointment_date >= CURDATE()`;
    let todaySql = `SELECT COUNT(*) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date = CURDATE() AND a.status IN ('scheduled','completed')`;
    upcomingSql += apptFilter.sql;
    todaySql += apptFilter.sql;
    const appointmentParams = apptFilter.params;
    const [appointmentsCount] = await pool.execute(upcomingSql, appointmentParams);
    const [todayAppointments] = await pool.execute(todaySql, appointmentParams);

    let revenueQuery =
      'SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL INNER JOIN patients p ON i.patient_id = p.id AND p.deleted_at IS NULL WHERE i.deleted_at IS NULL';
    revenueQuery += invFilter.sql;
    const [revenue] = await pool.execute(revenueQuery, invFilter.params);

    let appointmentsQuery = `
      SELECT COUNT(*) AS total FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
      WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
    appointmentsQuery += apptFilter.sql;
    const [last30Appointments] = await pool.execute(appointmentsQuery, apptFilter.params);

    const data = {
      totalPatients: patientsCount[0].total,
      upcomingAppointments: appointmentsCount[0].total,
      todayAppointments: todayAppointments[0].total,
      totalRevenue: parseFloat(revenue[0].total) || 0,
      last30DaysAppointments: last30Appointments[0].total,
    };

    if (roleId === ROLES.SUPER_ADMIN) {
      const [[doctorsRow]] = await pool.execute(
        'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND role_id IN (?, ?)',
        [ROLES.ADMIN, ROLES.DOCTOR]
      );
      const [[receptionistsRow]] = await pool.execute(
        'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND role_id IN (?, ?)',
        [ROLES.RECEPTIONIST, ROLES.ASSISTANT_DOCTOR]
      );
      data.totalDoctors = doctorsRow.total;
      data.totalReceptionists = receptionistsRow.total;
      let subscriptionRevenue = 0;
      try {
        const [[subRevRow]] = await pool.execute(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM subscriptions WHERE end_date >= CURDATE()'
        );
        subscriptionRevenue = parseFloat(subRevRow?.total ?? 0);
      } catch (subErr) {
        // Subscriptions table may not exist if migration not run; keep counts intact
      }
      data.subscriptionRevenue = subscriptionRevenue;
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

async function getRevenueChart(req, res, next) {
  try {
    const range = req.query.range;
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const invFilter = invoiceBillingDoctorFilter(roleId, userId, req.user.assignedAdminId);
    const weekBetween = ` AND DATE(i.created_at) BETWEEN
          DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
          AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)`;

    if (range === 'weekly') {
      let query = `
        SELECT DATE(created_at) AS d, SUM(total) AS revenue
        FROM invoices WHERE deleted_at IS NULL
        ${weekBetween.replace(/i\./g, '')}
        GROUP BY DATE(created_at)
      `;
      let params = [];
      if (invFilter.sql) {
        query = `
          SELECT DATE(i.created_at) AS d, SUM(i.total) AS revenue
          ${INVOICE_REVENUE_FROM}${invFilter.sql}${weekBetween}
          GROUP BY DATE(i.created_at)
        `;
        params = [...invFilter.params];
      }
      const [rows] = await pool.execute(query, params);
      const byDate = {};
      const toYMD = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
      rows.forEach((r) => { byDate[toYMD(r.d)] = parseFloat(r.revenue) || 0; });
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + (monday.getDay() === 0 ? -6 : 1));
      const data = WEEKDAY_LABELS.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = d.toISOString().slice(0, 10);
        return { day: label, revenue: byDate[key] || 0 };
      });
      return res.json({ success: true, data });
    }

    const months = parseInt(req.query.months, 10) || 6;
    const monthRange = ' AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
    let query = `
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS revenue
      FROM invoices WHERE deleted_at IS NULL
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month
    `;
    let params = [months];
    if (invFilter.sql) {
      query = `
        SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month, SUM(i.total) AS revenue
        ${INVOICE_REVENUE_FROM}${invFilter.sql}${monthRange}
        GROUP BY DATE_FORMAT(i.created_at, '%Y-%m') ORDER BY month
      `;
      params = [...invFilter.params, months];
    }
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows.map((r) => ({ month: r.month, revenue: parseFloat(r.revenue) || 0 })) });
  } catch (err) {
    next(err);
  }
}

async function getPatientChart(req, res, next) {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const patientScope = getPatientScopeForDashboard(roleId, userId, req.user.assignedAdminId);
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(p.created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM patients p WHERE p.deleted_at IS NULL
       AND p.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)${patientScope.condition}
       GROUP BY DATE_FORMAT(p.created_at, '%Y-%m') ORDER BY month`,
      [months, ...patientScope.params]
    );
    res.json({
      success: true,
      data: rows.map((r) => ({ month: r.month, count: r.count })),
    });
  } catch (err) {
    next(err);
  }
}

async function getMetrics(req, res, next) {
  try {
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const revenueTarget = parseFloat(process.env.REVENUE_TARGET || '50000') || 50000;

    const apptFilter = appointmentDoctorFilter(roleId, userId, req.user.assignedAdminId, 'a');
    const baseWhereWithAlias = apptFilter.sql;
    const baseParams = apptFilter.params;
    const hasApptScope = Boolean(apptFilter.sql);

    // Total patients this month (with appointments)
    const [totalPatientsThisMonth] = await pool.execute(
      `SELECT COUNT(DISTINCT a.patient_id) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${baseWhereWithAlias}`,
      baseParams
    );

    // New patients this month (created this month, in scope)
    const newPatientScope = getPatientScopeForDashboard(roleId, userId, req.user.assignedAdminId);
    const [newPatientsThisMonth] = await pool.execute(
      `SELECT COUNT(*) AS total FROM patients p WHERE p.deleted_at IS NULL
       AND p.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${newPatientScope.condition}`,
      newPatientScope.params
    );

    // Returning patients (2+ appointments ever)
    const retQuery = hasApptScope
      ? `SELECT COUNT(*) AS total FROM (SELECT a.patient_id FROM appointments a INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL WHERE a.deleted_at IS NULL${baseWhereWithAlias} GROUP BY a.patient_id HAVING COUNT(*) >= 2) t`
      : `SELECT COUNT(*) AS total FROM (SELECT a.patient_id FROM appointments a INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL WHERE a.deleted_at IS NULL GROUP BY a.patient_id HAVING COUNT(*) >= 2) t`;
    const [returning] = await pool.execute(retQuery, hasApptScope ? baseParams : []);

    // Today's appointments
    const [todayAppts] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date = CURDATE() AND a.status IN ('scheduled','completed')${baseWhereWithAlias}`,
      baseParams
    );

    // No-show rate
    const [noShowStats] = await pool.execute(
      `SELECT
         SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
         SUM(CASE WHEN a.status IN ('scheduled','completed','no_show','cancelled') THEN 1 ELSE 0 END) AS total
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)${baseWhereWithAlias}`,
      baseParams
    );
    const totalForNoShow = parseInt(noShowStats[0]?.total || 0, 10);
    const noShows = parseInt(noShowStats[0]?.no_shows || 0, 10);
    const noShowRate = totalForNoShow > 0 ? Math.round((noShows / totalForNoShow) * 100) : 0;

    const revThisQ = invoiceRevenueSumQuery(
      roleId,
      userId,
      req.user.assignedAdminId,
      ` AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    const [revThisMonth] = await pool.execute(revThisQ.sql, revThisQ.params);

    const revLastQ = invoiceRevenueSumQuery(
      roleId,
      userId,
      req.user.assignedAdminId,
      ` AND i.created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND i.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    const [revLastMonth] = await pool.execute(revLastQ.sql, revLastQ.params);

    const revThis = parseFloat(revThisMonth[0]?.total || 0);
    const revLast = parseFloat(revLastMonth[0]?.total || 0);
    const revChangePercent = revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : (revThis > 0 ? 100 : 0);
    const achievementPercent = revenueTarget > 0 ? Math.round((revThis / revenueTarget) * 1000) / 10 : 0;

    // Avg revenue per patient (this month)
    const [patientCountForAvg] = await pool.execute(
      `SELECT COUNT(DISTINCT a.patient_id) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${baseWhereWithAlias}`,
      baseParams
    );
    const patientsWithAppts = parseInt(patientCountForAvg[0]?.total || 0, 10);
    const avgRevenuePerPatient = patientsWithAppts > 0 ? Math.round((revThis / patientsWithAppts) * 100) / 100 : 0;

    const ytdQ = invoiceRevenueSumQuery(
      roleId,
      userId,
      req.user.assignedAdminId,
      ` AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')`
    );
    const [yearToDateRevenue] = await pool.execute(ytdQ.sql, ytdQ.params);

    const collQ = invoiceCollectionSumQuery(roleId, userId, req.user.assignedAdminId);
    const [collection] = await pool.execute(collQ.sql, collQ.params);

    // Avg consultation time (from completed appointments with end_time)
    const avgConsultQuery = `SELECT AVG(TIMESTAMPDIFF(MINUTE, CONCAT(a.appointment_date, ' ', a.start_time), CONCAT(a.appointment_date, ' ', COALESCE(a.end_time, ADDTIME(a.start_time, '00:30:00'))))) AS avg_mins
       FROM appointments a WHERE a.deleted_at IS NULL AND a.status = 'completed'${baseWhereWithAlias}`;
    const [avgConsult] = await pool.execute(avgConsultQuery, baseParams);
    const avgConsultMins = avgConsult[0]?.avg_mins != null ? Math.round(parseFloat(avgConsult[0].avg_mins)) : null;

    // Appointment utilization (completed+scheduled this month / estimated slots)
    const [utilized] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND a.status IN ('scheduled','completed')${baseWhereWithAlias}`,
      baseParams
    );
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const estimatedSlots = 18 * daysInMonth; // 18 slots/day * days
    const utilizationRate = estimatedSlots > 0 ? Math.round((parseInt(utilized[0]?.total || 0, 10) / estimatedSlots) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalPatientsThisMonth: parseInt(totalPatientsThisMonth[0]?.total || 0, 10),
        newPatientsThisMonth: parseInt(newPatientsThisMonth[0]?.total || 0, 10),
        returningPatients: parseInt(returning[0]?.total || 0, 10),
        todayAppointments: parseInt(todayAppts[0]?.total || 0, 10),
        noShowRate,
        avgRevenuePerPatient,
        totalPatientsWithAppts: patientsWithAppts,
        revenueThisMonth: revThis,
        revenueLastMonth: revLast,
        revenueChangePercent: revChangePercent,
        revenueTarget,
        achievementPercent,
        yearToDateRevenue: parseFloat(yearToDateRevenue[0]?.total || 0),
        collected: parseFloat(collection[0]?.collected || 0),
        pending: parseFloat(collection[0]?.pending || 0),
        avgConsultationMinutes: avgConsultMins,
        utilizationRate,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getWeeklyPatientTrend(req, res, next) {
  try {
    const weeks = parseInt(req.query.weeks, 10) || 4;
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const patientScope = getPatientScopeForDashboard(roleId, userId, req.user.assignedAdminId);
    const [rows] = await pool.execute(
      `SELECT YEARWEEK(p.created_at, 3) AS week_num, MIN(p.created_at) AS week_start, COUNT(*) AS count
       FROM patients p WHERE p.deleted_at IS NULL
       AND p.created_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)${patientScope.condition}
       GROUP BY YEARWEEK(p.created_at, 3) ORDER BY week_num`,
      [weeks, ...patientScope.params]
    );
    res.json({
      success: true,
      data: rows.map((r, i) => ({
        week: `Week ${i + 1}`,
        weekNum: r.week_num,
        label: r.week_start ? new Date(r.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `W${r.week_num}`,
        count: r.count,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getDailyAppointmentDistribution(req, res, next) {
  try {
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const isDoctorOrAdmin = roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;
    const baseWhereWithAlias = isDoctorOrAdmin ? ' AND a.doctor_id = ?' : (isReceptionistOrAssistant ? ' AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))' : '');
    const params = (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : [];
    const [rows] = await pool.execute(
      `SELECT DAYNAME(a.appointment_date) AS day_name, COUNT(*) AS count
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL
       AND a.status IN ('scheduled', 'completed')
       AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)${baseWhereWithAlias}
       GROUP BY DAYOFWEEK(a.appointment_date), day_name ORDER BY DAYOFWEEK(a.appointment_date)`,
      params
    );
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const byDay = {};
    rows.forEach((r) => {
      const d = r.day_name?.slice(0, 3) || '—';
      byDay[d] = r.count;
    });
    const data = dayOrder.map((d) => ({ day: d, count: byDay[d] || 0 }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getNewVsReturningChart(req, res, next) {
  try {
    const months = parseInt(req.query.months, 10) || 6;
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const isDoctorOrAdmin = roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;
    const doctorFilter = isDoctorOrAdmin ? ' AND a.doctor_id = ?' : (isReceptionistOrAssistant ? ' AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))' : '');
    const params = (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [months, userId, req.user.assignedAdminId, req.user.assignedAdminId] : [months, userId]) : [months];
    const [rows] = await pool.execute(
      `SELECT DATE_FORMAT(a.appointment_date, '%Y-%m') AS month,
         COUNT(DISTINCT CASE WHEN p.created_at >= DATE_FORMAT(a.appointment_date, '%Y-%m-01') AND p.created_at < DATE_ADD(DATE_FORMAT(a.appointment_date, '%Y-%m-01'), INTERVAL 1 MONTH) THEN a.patient_id END) AS new_patients,
         COUNT(DISTINCT CASE WHEN p.created_at < DATE_FORMAT(a.appointment_date, '%Y-%m-01') THEN a.patient_id END) AS returning
       FROM appointments a
       INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)${doctorFilter}
       GROUP BY DATE_FORMAT(a.appointment_date, '%Y-%m') ORDER BY month`,
      params
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        month: r.month,
        newPatients: r.new_patients || 0,
        returning: r.returning || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** Admin dashboard: revenue this month / YTD per billing doctor (you + assistant doctors). */
async function getAssistantDoctorRevenue(req, res, next) {
  try {
    if (req.user.roleId !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const adminId = req.user.id;
    const inv = invoiceBillingDoctorFilter(ROLES.ADMIN, adminId, null);
    const billingCol = 'COALESCE(i.doctor_id, a.doctor_id)';

    const [rows] = await pool.execute(
      `SELECT
         ${billingCol} AS doctor_id,
         bill.name AS doctor_name,
         bill.role_id AS role_id,
         COALESCE(SUM(CASE WHEN i.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN i.total ELSE 0 END), 0) AS revenue_this_month,
         COALESCE(SUM(CASE WHEN i.created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01') THEN i.total ELSE 0 END), 0) AS revenue_ytd
       FROM invoices i
       LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL
       INNER JOIN patients p ON i.patient_id = p.id AND p.deleted_at IS NULL
       INNER JOIN users bill ON bill.id = ${billingCol} AND bill.deleted_at IS NULL
       WHERE i.deleted_at IS NULL${inv.sql}
       AND ${billingCol} IS NOT NULL
       GROUP BY ${billingCol}, bill.name, bill.role_id
       ORDER BY revenue_this_month DESC, bill.name ASC`,
      inv.params
    );

    const breakdown = rows.map((r) => ({
      doctorId: r.doctor_id,
      doctorName: r.doctor_name || '—',
      isAssistant: r.role_id === ROLES.ASSISTANT_DOCTOR,
      revenueThisMonth: parseFloat(r.revenue_this_month) || 0,
      revenueYtd: parseFloat(r.revenue_ytd) || 0,
    }));

    const own = breakdown.find((b) => b.doctorId === adminId);
    const assistants = breakdown.filter((b) => b.isAssistant);
    const assistantTotalThisMonth = assistants.reduce((s, b) => s + b.revenueThisMonth, 0);
    const assistantTotalYtd = assistants.reduce((s, b) => s + b.revenueYtd, 0);

    res.json({
      success: true,
      data: {
        breakdown,
        ownRevenueThisMonth: own?.revenueThisMonth ?? 0,
        ownRevenueYtd: own?.revenueYtd ?? 0,
        assistantTotalThisMonth,
        assistantTotalYtd,
        assistants,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  getRevenueChart,
  getPatientChart,
  getMetrics,
  getWeeklyPatientTrend,
  getDailyAppointmentDistribution,
  getNewVsReturningChart,
  getAssistantDoctorRevenue,
};
