const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

/** Patient scope for dashboard counts/charts: same as patient list (assigned doctors only). assignedAdminId fallback for staff when receptionist_doctors is empty. */
function getPatientScopeForDashboard(roleId, userId, assignedAdminId = null) {
  if (roleId === ROLES.SUPER_ADMIN) return { condition: '', params: [] };
  if (roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN) {
    return {
      condition: ' AND (p.id IN (SELECT patient_id FROM appointments WHERE doctor_id = ? AND deleted_at IS NULL) OR p.created_by = ?)',
      params: [userId, userId],
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
    // Doctor/Admin: only their data. Receptionist/Assistant: only assigned doctors' appointments.
    const isDoctorOrAdmin = roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;
    const doctorId = isDoctorOrAdmin ? userId : null;
    const receptionistFilter = isReceptionistOrAssistant
      ? ' AND (doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (doctor_id = ? AND ? IS NOT NULL))'
      : '';

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
    const appointmentParams = doctorId != null ? [doctorId] : (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : []);
    if (doctorId != null) {
      upcomingSql += ' AND a.doctor_id = ?';
      todaySql += ' AND a.doctor_id = ?';
    } else if (isReceptionistOrAssistant) {
      upcomingSql += receptionistFilter.replace('doctor_id', 'a.doctor_id');
      todaySql += receptionistFilter.replace('doctor_id', 'a.doctor_id');
    }
    const [appointmentsCount] = await pool.execute(upcomingSql, appointmentParams);
    const [todayAppointments] = await pool.execute(todaySql, appointmentParams);

    let revenueQuery = 'SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE deleted_at IS NULL';
    const revenueParams = [];
    if (isDoctorOrAdmin) {
      revenueQuery =
        'SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ?';
      revenueParams.push(userId);
    } else if (isReceptionistOrAssistant) {
      revenueQuery =
        'SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))';
      revenueParams.push(userId, req.user.assignedAdminId, req.user.assignedAdminId);
    }
    const [revenue] = await pool.execute(revenueQuery, revenueParams);

    let appointmentsQuery = `
      SELECT COUNT(*) AS total FROM appointments a
      INNER JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
      WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
    if (isDoctorOrAdmin) {
      appointmentsQuery += ' AND a.doctor_id = ?';
    } else if (isReceptionistOrAssistant) {
      appointmentsQuery += ' AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))';
    }
    const [last30Appointments] = await pool.execute(
      appointmentsQuery,
      isDoctorOrAdmin ? [userId] : (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [])
    );

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
    const isDoctorOrAdmin = roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;

    if (range === 'weekly') {
      // Current week Monday–Sunday (MySQL WEEKDAY: 0=Mon, 6=Sun)
      let query = `
        SELECT DATE(created_at) AS d, SUM(total) AS revenue
        FROM invoices WHERE deleted_at IS NULL
        AND DATE(created_at) BETWEEN
          DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
          AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
      `;
      const params = [];
      if (isDoctorOrAdmin) {
        query = `
          SELECT DATE(i.created_at) AS d, SUM(i.total) AS revenue
          FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
          WHERE i.deleted_at IS NULL AND a.doctor_id = ?
          AND DATE(i.created_at) BETWEEN
            DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
            AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
          GROUP BY DATE(i.created_at)
        `;
        params.push(userId);
      } else if (isReceptionistOrAssistant) {
        query = `
          SELECT DATE(i.created_at) AS d, SUM(i.total) AS revenue
          FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
          WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))
          AND DATE(i.created_at) BETWEEN
            DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
            AND DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)
          GROUP BY DATE(i.created_at)
        `;
        params.push(userId, req.user.assignedAdminId, req.user.assignedAdminId);
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
    let query = `
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS revenue
      FROM invoices WHERE deleted_at IS NULL
      AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    `;
    const params = [months];
    if (isDoctorOrAdmin) {
      query = `
        SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month, SUM(i.total) AS revenue
        FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
        WHERE i.deleted_at IS NULL AND a.doctor_id = ?
        AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(i.created_at, '%Y-%m') ORDER BY month
      `;
      params.unshift(userId);
    } else if (isReceptionistOrAssistant) {
      query = `
        SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS month, SUM(i.total) AS revenue
        FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
        WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))
        AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        GROUP BY DATE_FORMAT(i.created_at, '%Y-%m') ORDER BY month
      `;
      params.unshift(userId, req.user.assignedAdminId, req.user.assignedAdminId);
    } else {
      query += ' GROUP BY DATE_FORMAT(created_at, \'%Y-%m\') ORDER BY month';
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

    const isDoctorOrAdmin = roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN;
    const isReceptionistOrAssistant = roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR;
    const baseWhere = isDoctorOrAdmin ? ' AND a.doctor_id = ?' : (isReceptionistOrAssistant ? ' AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))' : '');
    const baseWhereNoAlias = isDoctorOrAdmin ? ' AND doctor_id = ?' : (isReceptionistOrAssistant ? ' AND (doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (doctor_id = ? AND ? IS NOT NULL))' : '');
    const baseParams = (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : [];

    // Total patients this month (with appointments)
    const [totalPatientsThisMonth] = await pool.execute(
      `SELECT COUNT(DISTINCT a.patient_id) AS total FROM appointments a
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${baseWhere}`,
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
    const retQuery = isDoctorOrAdmin
      ? `SELECT COUNT(*) AS total FROM (SELECT a.patient_id FROM appointments a WHERE a.deleted_at IS NULL AND a.doctor_id = ? GROUP BY a.patient_id HAVING COUNT(*) >= 2) t`
      : isReceptionistOrAssistant
        ? `SELECT COUNT(*) AS total FROM (SELECT a.patient_id FROM appointments a WHERE a.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL)) GROUP BY a.patient_id HAVING COUNT(*) >= 2) t`
        : `SELECT COUNT(*) AS total FROM (SELECT patient_id FROM appointments WHERE deleted_at IS NULL GROUP BY patient_id HAVING COUNT(*) >= 2) t`;
    const [returning] = await pool.execute(retQuery, (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : []);

    // Today's appointments
    const [todayAppts] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments WHERE deleted_at IS NULL
       AND appointment_date = CURDATE() AND status IN ('scheduled','completed')${baseWhereNoAlias}`,
      baseParams
    );

    // No-show rate
    const [noShowStats] = await pool.execute(
      `SELECT
         SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_shows,
         SUM(CASE WHEN status IN ('scheduled','completed','no_show','cancelled') THEN 1 ELSE 0 END) AS total
       FROM appointments WHERE deleted_at IS NULL AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)${baseWhereNoAlias}`,
      baseParams
    );
    const totalForNoShow = parseInt(noShowStats[0]?.total || 0, 10);
    const noShows = parseInt(noShowStats[0]?.no_shows || 0, 10);
    const noShowRate = totalForNoShow > 0 ? Math.round((noShows / totalForNoShow) * 100) : 0;

    // Revenue this month
    let revThisMonthQuery = `SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE deleted_at IS NULL AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    if (isDoctorOrAdmin) {
      revThisMonthQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ? AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    } else if (isReceptionistOrAssistant) {
      revThisMonthQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL)) AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    }
    const [revThisMonth] = await pool.execute(revThisMonthQuery, (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : []);

    // Revenue last month
    let revLastMonthQuery = `SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE deleted_at IS NULL AND created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    if (isDoctorOrAdmin) {
      revLastMonthQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ? AND i.created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND i.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    } else if (isReceptionistOrAssistant) {
      revLastMonthQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL)) AND i.created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01') AND i.created_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
    }
    const [revLastMonth] = await pool.execute(revLastMonthQuery, (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : []);

    const revThis = parseFloat(revThisMonth[0]?.total || 0);
    const revLast = parseFloat(revLastMonth[0]?.total || 0);
    const revChangePercent = revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : (revThis > 0 ? 100 : 0);
    const achievementPercent = revenueTarget > 0 ? Math.round((revThis / revenueTarget) * 1000) / 10 : 0;

    // Avg revenue per patient (this month)
    const [patientCountForAvg] = await pool.execute(
      `SELECT COUNT(DISTINCT a.patient_id) AS total FROM appointments a
       WHERE a.deleted_at IS NULL AND a.appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')${baseWhere}`,
      baseParams
    );
    const patientsWithAppts = parseInt(patientCountForAvg[0]?.total || 0, 10);
    const avgRevenuePerPatient = patientsWithAppts > 0 ? Math.round((revThis / patientsWithAppts) * 100) / 100 : 0;

    // Year to Date revenue (from January 1st of current year)
    let yearToDateRevenueQuery = `SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE deleted_at IS NULL AND created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')`;
    if (isDoctorOrAdmin) {
      yearToDateRevenueQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ? AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')`;
    } else if (isReceptionistOrAssistant) {
      yearToDateRevenueQuery = `SELECT COALESCE(SUM(i.total), 0) AS total FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL)) AND i.created_at >= DATE_FORMAT(CURDATE(), '%Y-01-01')`;
    }
    const [yearToDateRevenue] = await pool.execute(yearToDateRevenueQuery, (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : []);

    // Collection vs Pending
    let collectionQuery = `SELECT COALESCE(SUM(paid_amount), 0) AS collected, COALESCE(SUM(total - paid_amount), 0) AS pending FROM invoices WHERE deleted_at IS NULL`;
    if (isDoctorOrAdmin) {
      collectionQuery = `SELECT COALESCE(SUM(i.paid_amount), 0) AS collected, COALESCE(SUM(i.total - i.paid_amount), 0) AS pending FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ?`;
    } else if (isReceptionistOrAssistant) {
      collectionQuery = `SELECT COALESCE(SUM(i.paid_amount), 0) AS collected, COALESCE(SUM(i.total - i.paid_amount), 0) AS pending FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))`;
    }
    const [collection] = await pool.execute(collectionQuery, (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : []);

    // Avg consultation time (from completed appointments with end_time)
    const avgConsultQuery = `SELECT AVG(TIMESTAMPDIFF(MINUTE, CONCAT(a.appointment_date, ' ', a.start_time), CONCAT(a.appointment_date, ' ', COALESCE(a.end_time, ADDTIME(a.start_time, '00:30:00'))))) AS avg_mins
       FROM appointments a WHERE a.deleted_at IS NULL AND a.status = 'completed'${baseWhere}`;
    const [avgConsult] = await pool.execute(avgConsultQuery, baseParams);
    const avgConsultMins = avgConsult[0]?.avg_mins != null ? Math.round(parseFloat(avgConsult[0].avg_mins)) : null;

    // Appointment utilization (completed+scheduled this month / estimated slots)
    const [utilized] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments WHERE deleted_at IS NULL AND appointment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND status IN ('scheduled','completed')${baseWhereNoAlias}`,
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
    const baseWhere = isDoctorOrAdmin ? ' AND doctor_id = ?' : (isReceptionistOrAssistant ? ' AND (doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (doctor_id = ? AND ? IS NOT NULL))' : '');
    const params = (isDoctorOrAdmin || isReceptionistOrAssistant) ? (isReceptionistOrAssistant ? [userId, req.user.assignedAdminId, req.user.assignedAdminId] : [userId]) : [];
    const [rows] = await pool.execute(
      `SELECT DAYNAME(appointment_date) AS day_name, COUNT(*) AS count
       FROM appointments WHERE deleted_at IS NULL
       AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK)${baseWhere}
       GROUP BY DAYOFWEEK(appointment_date), day_name ORDER BY DAYOFWEEK(appointment_date)`,
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

module.exports = { getStats, getRevenueChart, getPatientChart, getMetrics, getWeeklyPatientTrend, getDailyAppointmentDistribution, getNewVsReturningChart };
