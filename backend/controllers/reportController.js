const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');
const PDFDocument = require('pdfkit');

async function revenue(req, res, next) {
  try {
    const { period = 'monthly', from, to, all } = req.query;
    const userId = req.user.id;
    const roleId = req.user.roleId;
    const isAllTime = all === '1' || all === 'true';

    let query;
    const params = [];
    if (period === 'daily' && !isAllTime) {
      const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const toDate = to || new Date().toISOString().slice(0, 10);
      query = `
        SELECT DATE(created_at) AS date, SUM(total) AS revenue
        FROM invoices WHERE deleted_at IS NULL
        AND DATE(created_at) >= ? AND DATE(created_at) <= ?
        GROUP BY DATE(created_at) ORDER BY date
      `;
      params.push(fromDate, toDate);
    } else {
      query = `
        SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, SUM(total) AS revenue
        FROM invoices WHERE deleted_at IS NULL
        ${isAllTime ? '' : 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'}
        GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY period
      `;
    }
    if ((roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN)) {
      if (period === 'daily' && !isAllTime) {
        query = `
          SELECT DATE(i.created_at) AS date, SUM(i.total) AS revenue
          FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
          WHERE i.deleted_at IS NULL AND a.doctor_id = ?
          AND DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?
          GROUP BY DATE(i.created_at) ORDER BY date
        `;
        params.unshift(userId);
      } else {
        query = `
          SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS period, SUM(i.total) AS revenue
          FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id
          WHERE i.deleted_at IS NULL AND a.doctor_id = ?
          ${isAllTime ? '' : 'AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'}
          GROUP BY DATE_FORMAT(i.created_at, '%Y-%m') ORDER BY period
        `;
        params.unshift(userId);
      }
    }
    const [rows] = await pool.execute(query, params);
    res.json({
      success: true,
      data: rows.map((r) => ({
        period: r.period || r.date,
        revenue: parseFloat(r.revenue) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function appointmentSummary(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    if (!isAllTime) {
      const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const toDate = to || new Date().toISOString().slice(0, 10);
      conditions.push('a.appointment_date >= ?', 'a.appointment_date <= ?');
      params.push(fromDate, toDate);
    }
    if (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) {
      conditions.push('a.doctor_id = ?');
      params.push(req.user.id);
    }
    const [rows] = await pool.execute(
      `SELECT a.status, COUNT(*) AS count FROM appointments a
       WHERE ${conditions.join(' AND ')}
       GROUP BY a.status`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function doctorPerformance(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);
    const dateJoin = isAllTime ? '' : ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
    const params = isAllTime ? [ROLES.ADMIN, ROLES.DOCTOR] : [fromDate, toDate, ROLES.ADMIN, ROLES.DOCTOR];
    const [rows] = await pool.execute(
      `SELECT u.id, u.name,
        COUNT(DISTINCT a.id) AS total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed,
        COALESCE(SUM(i.total), 0) AS total_revenue
       FROM users u
       LEFT JOIN appointments a ON a.doctor_id = u.id AND a.deleted_at IS NULL${dateJoin}
       LEFT JOIN invoices i ON i.appointment_id = a.id AND i.deleted_at IS NULL
       WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL
       GROUP BY u.id, u.name`,
      params
    );
    res.json({
      success: true,
      data: rows.map((r) => ({
        doctorId: r.id,
        doctorName: r.name,
        totalAppointments: r.total_appointments,
        completed: r.completed,
        totalRevenue: parseFloat(r.total_revenue) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const { range = '6M' } = req.query;
    const userId = req.user.id;
    const roleId = req.user.roleId;
    const isSuperAdmin = roleId === ROLES.SUPER_ADMIN;

    const isAllTime = range === 'ALL';
    let fromDate, toDate, periodLabel;
    if (isAllTime) {
      periodLabel = 'All time';
    } else {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      if (range === '7D') { from.setDate(from.getDate() - 7); periodLabel = 'Last 7 days'; }
      else if (range === '30D') { from.setDate(from.getDate() - 30); periodLabel = 'Last 30 days'; }
      else if (range === '6M') { from.setMonth(from.getMonth() - 6); periodLabel = 'Last 6 months'; }
      else { from.setFullYear(from.getFullYear() - 1); periodLabel = 'Last 1 year'; }
      from.setHours(0, 0, 0, 0);
      fromDate = from.toISOString().slice(0, 10);
      toDate = to.toISOString().slice(0, 10);
    }

    let revQuery, revParams;
    const isDaily = !isAllTime && (range === '7D' || range === '30D');
    if ((roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN)) {
      if (isDaily) {
        revQuery = `SELECT DATE(i.created_at) AS period, SUM(i.total) AS revenue FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ? AND i.created_at >= ? AND i.created_at <= ? GROUP BY DATE(i.created_at) ORDER BY period`;
        revParams = [userId, fromDate, toDate];
      } else {
        revQuery = `SELECT DATE_FORMAT(i.created_at, '%Y-%m') AS period, SUM(i.total) AS revenue FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id WHERE i.deleted_at IS NULL AND a.doctor_id = ? ${isAllTime ? '' : 'AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'} GROUP BY DATE_FORMAT(i.created_at, '%Y-%m') ORDER BY period`;
        revParams = [userId];
      }
    } else {
      if (isDaily) {
        revQuery = `SELECT DATE(created_at) AS period, SUM(total) AS revenue FROM invoices WHERE deleted_at IS NULL AND created_at >= ? AND created_at <= ? GROUP BY DATE(created_at) ORDER BY period`;
        revParams = [fromDate, toDate];
      } else {
        revQuery = `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, SUM(total) AS revenue FROM invoices WHERE deleted_at IS NULL ${isAllTime ? '' : 'AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)'} GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY period`;
        revParams = [];
      }
    }

    const sumConditions = ['a.deleted_at IS NULL'];
    const sumParams = [];
    if (!isAllTime) { sumConditions.push('a.appointment_date >= ?', 'a.appointment_date <= ?'); sumParams.push(fromDate, toDate); }
    if ((roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN)) { sumConditions.push('a.doctor_id = ?'); sumParams.push(userId); }
    const sumQuery = `SELECT a.status, COUNT(*) AS count FROM appointments a WHERE ${sumConditions.join(' AND ')} GROUP BY a.status`;

    const dateJoin = isAllTime ? '' : ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
    const perfParams = isAllTime ? [ROLES.ADMIN, ROLES.DOCTOR] : [fromDate, toDate, ROLES.ADMIN, ROLES.DOCTOR];
    const perfQuery = `SELECT u.name, COUNT(DISTINCT a.id) AS total_appointments, COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed, COALESCE(SUM(i.total), 0) AS total_revenue FROM users u LEFT JOIN appointments a ON a.doctor_id = u.id AND a.deleted_at IS NULL${dateJoin} LEFT JOIN invoices i ON i.appointment_id = a.id AND i.deleted_at IS NULL WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL GROUP BY u.id, u.name`;

    const [revRes, sumRes, perfRes] = await Promise.all([
      pool.execute(revQuery, revParams),
      pool.execute(sumQuery, sumParams),
      isSuperAdmin ? pool.execute(perfQuery, perfParams) : Promise.resolve([[]]),
    ]);

    const revenueRows = revRes[0];
    const summaryRows = sumRes[0];
    const doctorRows = perfRes[0] || [];

    const totalRevenue = revenueRows.reduce((s, r) => s + (parseFloat(r.revenue) || 0), 0);

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="doctor-desk-report-${range}-${Date.now()}.pdf"`);
    doc.pipe(res);

    doc.fontSize(20).text('Doctor Desk — Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#64748b').text(periodLabel, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1E293B').text('Revenue summary', { continued: false });
    doc.fontSize(10).fillColor('#1E293B').text(`Total revenue: ₹${Number(totalRevenue).toLocaleString()}`, { continued: false });
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#1E293B').text('Appointment breakdown', { continued: false });
    doc.moveDown(0.5);
    summaryRows.forEach((r) => {
      doc.fontSize(10).fillColor('#475569').text(`${(r.status || '').replace(/_/g, ' ')}: ${r.count}`, { continued: false });
    });
    doc.moveDown(1);

    if (isSuperAdmin && doctorRows.length > 0) {
      doc.fontSize(12).fillColor('#1E293B').text('Doctor performance', { continued: false });
      doc.moveDown(0.5);
      doctorRows.forEach((r) => {
        doc.fontSize(10).fillColor('#475569').text(
          `${r.name}: ${r.total_appointments} appointments, ${r.completed} completed, ₹${Number(r.total_revenue || 0).toLocaleString()} revenue`,
          { continued: false }
        );
      });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function superAdminReport(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    const [[doctorsRow]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND role_id IN (?, ?)',
      [ROLES.ADMIN, ROLES.DOCTOR]
    );
    const [[receptionistsRow]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL AND role_id = ?',
      [ROLES.RECEPTIONIST]
    );

    const dateJoin = isAllTime ? '' : ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
    const params = isAllTime ? [ROLES.ADMIN, ROLES.DOCTOR] : [fromDate, toDate, ROLES.ADMIN, ROLES.DOCTOR];
    const [rows] = await pool.execute(
      `SELECT u.id, u.name,
        COUNT(DISTINCT a.id) AS total_appointments,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed,
        COUNT(DISTINCT a.patient_id) AS total_patients,
        COALESCE(SUM(i.total), 0) AS total_revenue
       FROM users u
       LEFT JOIN appointments a ON a.doctor_id = u.id AND a.deleted_at IS NULL${dateJoin}
       LEFT JOIN invoices i ON i.appointment_id = a.id AND i.deleted_at IS NULL
       WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL
       GROUP BY u.id, u.name`,
      params
    );

    res.json({
      success: true,
      data: {
        totalDoctors: Number(doctorsRow.total) || 0,
        totalReceptionists: Number(receptionistsRow.total) || 0,
        from: isAllTime ? null : fromDate,
        to: isAllTime ? null : toDate,
        isAllTime,
        doctorStats: rows.map((r) => ({
          doctorId: r.id,
          doctorName: r.name,
          totalPatients: Number(r.total_patients) || 0,
          totalAppointments: Number(r.total_appointments) || 0,
          completed: Number(r.completed) || 0,
          totalRevenue: parseFloat(r.total_revenue) || 0,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function appointmentsExportPdf(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const conditions = ['a.deleted_at IS NULL'];
    const params = [];
    if (!isAllTime && from && to) {
      conditions.push('a.appointment_date >= ?', 'a.appointment_date <= ?');
      params.push(from, to);
    }
    if (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) {
      conditions.push('a.doctor_id = ?');
      params.push(req.user.id);
    } else if (req.user.roleId === ROLES.RECEPTIONIST && req.user.assignedAdminId && req.query.doctor_id) {
      conditions.push('a.doctor_id = ?');
      params.push(req.query.doctor_id);
    }
    const where = conditions.join(' AND ');
    const [rows] = await pool.execute(
      `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
        COALESCE(p.name, 'Deleted patient') AS patient_name,
        u.name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       JOIN users u ON a.doctor_id = u.id
       WHERE ${where}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT 500`,
      params
    );
    const formatDate = (d) => {
      if (!d) return '';
      if (d instanceof Date) return d.toISOString().slice(0, 10);
      return String(d).slice(0, 10);
    };
    const formatTime = (t) => (t ? String(t).slice(0, 5) : '');
    const periodLabel = isAllTime ? 'All time' : `${from || ''} to ${to || ''}`;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="appointments-report-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(18).text('Appointment Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(periodLabel, { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#1E293B').text(`Total: ${rows.length} appointment(s)`, { continued: false });
    doc.moveDown(1.5);
    if (rows.length === 0) {
      doc.fontSize(10).fillColor('#475569').text('No appointments in this period.', { continued: false });
    } else {
      rows.forEach((r, idx) => {
        const dateStr = formatDate(r.appointment_date);
        const timeStr = [r.start_time, r.end_time].filter(Boolean).map(formatTime).join(' – ') || '—';
        const patient = String(r.patient_name || '—').slice(0, 30);
        const doctor = String(r.doctor_name || '—').slice(0, 25);
        const status = (r.status || 'scheduled').replace(/_/g, ' ');
        const notes = String(r.notes || '—').slice(0, 40);
        doc.fontSize(9).fillColor('#1E293B').text(`${dateStr}  ${timeStr}  ${patient}  ${doctor}  ${status}  ${notes}`, { continued: false });
        if (idx < rows.length - 1) doc.moveDown(0.3);
      });
    }
    doc.end();
  } catch (err) {
    next(err);
  }
}

/**
 * AI Insights: heuristic-based metrics for Admin/Super Admin.
 * Scoped by doctor_id when role is ADMIN.
 */
async function aiInsights(req, res, next) {
  try {
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const isAdmin = roleId === ROLES.ADMIN;
    const doctorFilter = isAdmin ? ' AND a.doctor_id = ?' : '';
    const doctorParams = isAdmin ? [userId] : [];

    const now = new Date();
    const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStartStr = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

    // Patients with age & gender (for demographics) – patients who have appointments (optionally for this doctor)
    const patientWhere = isAdmin
      ? `WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.deleted_at IS NULL AND a.doctor_id = ?)`
      : 'WHERE p.deleted_at IS NULL';
    const [patientsRows] = await pool.execute(
      `SELECT p.id, p.name, p.date_of_birth, p.gender FROM patients p ${patientWhere}`,
      doctorParams
    );

    const ageRanges = [
      { range: '0-17', min: 0, max: 17 },
      { range: '18-30', min: 18, max: 30 },
      { range: '31-45', min: 31, max: 45 },
      { range: '46-60', min: 46, max: 60 },
      { range: '60+', min: 61, max: 150 },
    ];
    const getAge = (dob) => {
      if (!dob) return null;
      const d = new Date(dob);
      const today = new Date();
      return today.getFullYear() - d.getFullYear() - (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate()) ? 1 : 0);
    };
    const ageDistribution = ageRanges.map(({ range, min, max }) => ({
      range,
      count: patientsRows.filter((p) => {
        const age = getAge(p.date_of_birth);
        if (age == null) return false;
        if (max === 150) return age >= min;
        return age >= min && age <= max;
      }).length,
    }));
    const genderCounts = {};
    patientsRows.forEach((p) => {
      const g = p.gender || 'other';
      genderCounts[g] = (genderCounts[g] || 0) + 1;
    });
    const genderDistribution = Object.entries(genderCounts).map(([gender, count]) => ({ gender, count }));

    // Appointments this month per patient (for frequent visitors & high-risk)
    const [apptsThisMonthRows] = await pool.execute(
      `SELECT a.patient_id, COUNT(*) AS visit_count
       FROM appointments a
       WHERE a.deleted_at IS NULL AND a.appointment_date >= ? ${doctorFilter}
       GROUP BY a.patient_id`,
      [thisMonthStart, ...doctorParams]
    );
    const visitCountByPatient = {};
    apptsThisMonthRows.forEach((r) => { visitCountByPatient[r.patient_id] = Number(r.visit_count) || 0; });

    // New vs returning (ever): first visit vs 2+
    const [newReturningRows] = await pool.execute(
      `SELECT patient_id, COUNT(*) AS total FROM appointments WHERE deleted_at IS NULL ${doctorFilter.replace('a.', '')} GROUP BY patient_id`,
      doctorParams
    );
    let newCount = 0;
    let returningCount = 0;
    newReturningRows.forEach((r) => (r.total >= 2 ? returningCount++ : newCount++));

    // High-risk: age > 60 or > 5 visits this month (top 3)
    const patientMap = {};
    patientsRows.forEach((p) => { patientMap[p.id] = p; });
    const highRisk = patientsRows
      .map((p) => {
        const age = getAge(p.date_of_birth);
        const visits = visitCountByPatient[p.id] || 0;
        const reasons = [];
        if (age != null && age > 60) reasons.push('Age > 60');
        if (visits > 5) reasons.push('High visit frequency');
        if (reasons.length === 0) return null;
        return { id: p.id, name: p.name, age: age ?? '—', visitCountThisMonth: visits, reasons };
      })
      .filter(Boolean)
      .slice(0, 3);

    // Frequent visitors: top 5 this month
    const frequentVisitors = apptsThisMonthRows
      .map((r) => ({ id: r.patient_id, name: (patientMap[r.patient_id] && patientMap[r.patient_id].name) || `Patient #${r.patient_id}`, visitCount: Number(r.visit_count) || 0 }))
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, 5);

    // Revenue: this month, last month, last week, this week, pending
    let revBase = `FROM invoices i WHERE i.deleted_at IS NULL`;
    if (isAdmin) revBase = `FROM invoices i INNER JOIN appointments a ON i.appointment_id = a.id AND a.doctor_id = ? WHERE i.deleted_at IS NULL`;
    const revParams = isAdmin ? [userId] : [];

    const [revThisMonth] = await pool.execute(
      `SELECT COALESCE(SUM(i.total), 0) AS total ${revBase} AND i.created_at >= ?`,
      [...revParams, thisMonthStart]
    );
    const [revLastMonth] = await pool.execute(
      `SELECT COALESCE(SUM(i.total), 0) AS total ${revBase} AND i.created_at >= ? AND i.created_at < ?`,
      [...revParams, lastMonthStartStr, thisMonthStart]
    );
    const [revThisWeek] = await pool.execute(
      `SELECT COALESCE(SUM(i.total), 0) AS total ${revBase} AND DATE(i.created_at) >= ?`,
      [...revParams, oneWeekAgoStr]
    );
    const [revLastWeek] = await pool.execute(
      `SELECT COALESCE(SUM(i.total), 0) AS total ${revBase} AND DATE(i.created_at) >= ? AND DATE(i.created_at) < ?`,
      [...revParams, twoWeeksAgoStr, oneWeekAgoStr]
    );
    const yearStartStr = `${now.getFullYear()}-01-01`;
    const [revYtd] = await pool.execute(
      `SELECT COALESCE(SUM(i.total), 0) AS total ${revBase} AND DATE(i.created_at) >= ?`,
      [...revParams, yearStartStr]
    );
    const [pendingRow] = await pool.execute(
      `SELECT COALESCE(SUM(i.total - i.paid_amount), 0) AS total ${revBase} AND i.payment_status IN ('pending','partial')`,
      revParams
    );
    const [unpaidInvoices] = await pool.execute(
      `SELECT i.patient_id, p.name AS patient_name, SUM(i.total - i.paid_amount) AS outstanding
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id AND p.deleted_at IS NULL
       ${isAdmin ? 'INNER JOIN appointments a ON i.appointment_id = a.id AND a.doctor_id = ?' : ''}
       WHERE i.deleted_at IS NULL AND i.payment_status IN ('pending','partial')
       GROUP BY i.patient_id, p.name
       ORDER BY outstanding DESC
       LIMIT 20`,
      doctorParams
    );

    const currentMonthRevenue = parseFloat(revThisMonth[0]?.total || 0);
    const lastMonthRevenue = parseFloat(revLastMonth[0]?.total || 0);
    const thisWeekRevenue = parseFloat(revThisWeek[0]?.total || 0);
    const lastWeekRevenue = parseFloat(revLastWeek[0]?.total || 0);
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const avgDailyThisMonth = daysElapsed > 0 ? currentMonthRevenue / daysElapsed : 0;
    const forecastEom = Math.round(avgDailyThisMonth * daysInMonth);
    const growthVsLastMonth = lastMonthRevenue > 0 ? Math.round(((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : (currentMonthRevenue > 0 ? 100 : 0);
    const revenueDropPercent = lastWeekRevenue > 0 ? Math.round(((lastWeekRevenue - thisWeekRevenue) / lastWeekRevenue) * 100) : 0;

    // Prescriptions: top 5 medicines this month; polypharmacy (>5 meds per prescription); follow-up 30+ days
    const ninetyDaysAgoStr = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [rxRows] = await pool.execute(
      `SELECT pr.id, pr.patient_id, pr.medicines, pr.created_at
       FROM prescriptions pr
       WHERE pr.deleted_at IS NULL AND pr.created_at >= ? ${isAdmin ? 'AND pr.doctor_id = ?' : ''}`,
      isAdmin ? [thisMonthStart, userId] : [thisMonthStart]
    );
    const [rxRowsFollowUp] = await pool.execute(
      `SELECT pr.patient_id, pr.created_at
       FROM prescriptions pr
       WHERE pr.deleted_at IS NULL AND pr.created_at >= ? ${isAdmin ? 'AND pr.doctor_id = ?' : ''}`,
      isAdmin ? [ninetyDaysAgoStr, userId] : [ninetyDaysAgoStr]
    );
    const medicineCounts = {};
    const patientMedicineCounts = {};
    const prescriptionsForFollowUp = rxRowsFollowUp.map((r) => ({ patient_id: r.patient_id, prescription_date: r.created_at }));
    rxRows.forEach((r) => {
      let meds = r.medicines;
      if (typeof meds === 'string') try { meds = JSON.parse(meds); } catch (_) { meds = []; }
      if (!Array.isArray(meds)) meds = [];
      const names = meds.map((m) => (m && (m.name || m.medicine_name)) || 'Unknown').filter(Boolean);
      names.forEach((name) => { medicineCounts[name] = (medicineCounts[name] || 0) + 1; });
      const pid = r.patient_id;
      patientMedicineCounts[pid] = (patientMedicineCounts[pid] || 0) + meds.length;
    });
    const topMedicines = Object.entries(medicineCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    const polypharmacyPatients = Object.entries(patientMedicineCounts)
      .filter(([, count]) => count > 5)
      .map(([pid, count]) => ({ id: Number(pid), name: (patientMap[pid] && patientMap[pid].name) || `Patient #${pid}`, medicineCount: count }));

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const [lastApptPerPatient] = await pool.execute(
      `SELECT patient_id, MAX(appointment_date) AS last_date
       FROM appointments WHERE deleted_at IS NULL AND status IN ('scheduled','completed') ${doctorFilter.replace('a.', '')}
       GROUP BY patient_id`,
      doctorParams
    );
    const lastVisitByPatient = {};
    lastApptPerPatient.forEach((r) => { lastVisitByPatient[r.patient_id] = r.last_date; });
    const addDays = (dateStr, days) => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const followUpReminders = prescriptionsForFollowUp
      .filter((pr) => {
        const rxDate = pr.prescription_date ? String(pr.prescription_date).slice(0, 10) : null;
        if (!rxDate || rxDate > thirtyDaysAgoStr) return false;
        const followUpBy = addDays(rxDate, 30);
        const lastVisit = lastVisitByPatient[pr.patient_id];
        return !lastVisit || String(lastVisit).slice(0, 10) < followUpBy;
      })
      .slice(0, 10)
      .map((pr) => ({
        patient_id: pr.patient_id,
        patient_name: (patientMap[pr.patient_id] && patientMap[pr.patient_id].name) || `Patient #${pr.patient_id}`,
        prescription_date: pr.prescription_date,
        last_visit: lastVisitByPatient[pr.patient_id] || null,
      }));

    // Efficiency score: completion rate, no-show %, revenue growth, return rate → 0–100
    const [apptStats] = await pool.execute(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) AS no_shows
       FROM appointments WHERE deleted_at IS NULL AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) ${doctorFilter.replace('a.', '')}`,
      doctorParams
    );
    const totalAppts = Number(apptStats[0]?.total || 0);
    const completedAppts = Number(apptStats[0]?.completed || 0);
    const noShows = Number(apptStats[0]?.no_shows || 0);
    const completionRate = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;
    const noShowPercent = totalAppts > 0 ? Math.round((noShows / totalAppts) * 100) : 0;
    const returnRate = patientsRows.length > 0 ? Math.round((returningCount / (newCount + returningCount)) * 100) || 0 : 0;
    const revenueGrowth = growthVsLastMonth;
    const scoreWeights = { completion: 0.3, noShow: 0.2, revenue: 0.3, return: 0.2 };
    let score = Math.round(
      (Math.min(100, completionRate) * scoreWeights.completion +
        (100 - Math.min(100, noShowPercent * 2)) * scoreWeights.noShow +
        (50 + Math.min(50, Math.max(-50, revenueGrowth))) * scoreWeights.revenue +
        returnRate * scoreWeights.return)
    );
    score = Math.max(0, Math.min(100, score));
    const suggestions = [];
    if (completionRate < 80) suggestions.push('Improve appointment completion rate by reducing cancellations.');
    if (noShowPercent > 10) suggestions.push('Consider reminders or follow-ups to reduce no-shows.');
    if (revenueGrowth < 0) suggestions.push('Focus on retention and follow-up visits to improve revenue.');
    if (returnRate < 40) suggestions.push('Encourage follow-up visits to improve patient return rate.');
    if (suggestions.length === 0) suggestions.push('Clinic performance is on track. Keep it up.');

    // Burnout Monitor: this week (Mon–Sun) for the doctor
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    const [burnoutRows] = await pool.execute(
      `SELECT
         COUNT(DISTINCT a.appointment_date) AS days_worked,
         COALESCE(SUM(TIMESTAMPDIFF(MINUTE, CONCAT(a.appointment_date, ' ', a.start_time), CONCAT(a.appointment_date, ' ', COALESCE(a.end_time, ADDTIME(a.start_time, '00:30:00'))))), 0) AS total_mins
       FROM appointments a
       WHERE a.deleted_at IS NULL AND a.appointment_date >= ? AND a.appointment_date <= ? ${doctorFilter.replace('a.', '')}`,
      [weekStartStr, weekEndStr, ...doctorParams]
    );
    const daysWorked = Number(burnoutRows[0]?.days_worked || 0);
    const totalMins = Number(burnoutRows[0]?.total_mins || 0);
    const avgHoursPerDay = daysWorked > 0 ? Math.round((totalMins / 60 / daysWorked) * 10) / 10 : 0;
    let burnoutRisk = 'Low';
    if (daysWorked >= 6 && avgHoursPerDay >= 8) burnoutRisk = 'High';
    else if (daysWorked >= 5 || avgHoursPerDay >= 7) burnoutRisk = 'Medium';
    const burnoutAiTip = burnoutRisk === 'High'
      ? 'Consider blocking one low-demand day and reducing back-to-back slots.'
      : burnoutRisk === 'Medium'
        ? 'Consider blocking one low-demand slot next week.'
        : 'Your schedule looks balanced. Keep it up.';

    // Clinic Health Score: revenue trend, retention, no-shows, burnout (0–100) + status
    const burnoutScore = burnoutRisk === 'High' ? 35 : burnoutRisk === 'Medium' ? 65 : 95;
    const revenueTrendScore = Math.min(100, 50 + Math.max(-50, revenueGrowth));
    const retentionScore = returnRate;
    const noShowScore = Math.max(0, 100 - noShowPercent * 3);
    const healthScore = Math.round(
      (revenueTrendScore * 0.25) + (retentionScore * 0.25) + (noShowScore * 0.25) + (burnoutScore * 0.25)
    );
    const healthScoreClamped = Math.max(0, Math.min(100, healthScore));
    let healthStatus = 'Stable';
    if (healthScoreClamped >= 75) healthStatus = 'Healthy & Optimized';
    else if (healthScoreClamped >= 60) healthStatus = 'Stable but Under-Optimized';
    else if (healthScoreClamped >= 40) healthStatus = 'Needs Attention';
    else healthStatus = 'At Risk';

    res.json({
      success: true,
      data: {
        patientDemographics: { ageDistribution, genderDistribution, newVsReturning: { new: newCount, returning: returningCount } },
        highRiskPatients: highRisk,
        frequentVisitors,
        revenueForecast: {
          currentMonth: currentMonthRevenue,
          lastMonth: lastMonthRevenue,
          yearToDate: parseFloat(revYtd[0]?.total || 0),
          forecastEom,
          growthVsLastMonth,
          thisWeekRevenue,
          lastWeekRevenue,
          revenueDropPercent,
        },
        pendingPayments: {
          totalOutstanding: parseFloat(pendingRow[0]?.total || 0),
          patients: unpaidInvoices.map((r) => ({ id: r.patient_id, name: r.patient_name, amount: parseFloat(r.outstanding || 0) })),
        },
        topMedicines,
        polypharmacyPatients,
        followUpReminders,
        efficiencyScore: { score, completionRate, noShowPercent, revenueGrowth, returnRate, suggestions },
        clinicHealthScore: { score: healthScoreClamped, status: healthStatus },
        burnoutMonitor: { daysWorkedThisWeek: daysWorked, avgHoursPerDay, burnoutRisk, aiTip: burnoutAiTip },
        aiRecommendation: 'Consider opening extra slots on Friday evenings.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Detailed report for Admin: patients, revenue, appointments in date range.
 */
async function detailedReport(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const userId = req.user.id;
    const roleId = req.user.roleId;
    const isAdmin = roleId === ROLES.ADMIN;
    const doctorFilter = isAdmin ? ' AND a.doctor_id = ?' : '';
    const doctorParams = isAdmin ? [userId] : [];
    const dateCond = isAllTime ? '' : ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
    const dateParams = isAllTime ? [] : [from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), to || new Date().toISOString().slice(0, 10)];
    const allParams = [...doctorParams, ...dateParams];

    const [patientsRows] = await pool.execute(
      `SELECT DISTINCT p.id, p.name, p.phone, p.email, p.date_of_birth, p.gender, p.created_at
       FROM patients p
       INNER JOIN appointments a ON a.patient_id = p.id AND a.deleted_at IS NULL ${doctorFilter.replace('a.', '')}
       WHERE p.deleted_at IS NULL ${isAllTime ? '' : 'AND a.appointment_date >= ? AND a.appointment_date <= ?'}
       ORDER BY p.name`,
      allParams
    );

    const invJoin = isAdmin ? ' INNER JOIN appointments a ON i.appointment_id = a.id AND a.doctor_id = ?' : '';
    const invWhere = isAllTime ? '' : ' AND DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?';
    const invParams = isAdmin ? [userId, ...dateParams] : dateParams;
    const [invoicesRows] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.patient_id, i.total, i.payment_status, i.created_at, p.name AS patient_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id AND p.deleted_at IS NULL
       ${invJoin}
       WHERE i.deleted_at IS NULL ${invWhere}
       ORDER BY i.created_at DESC
       LIMIT 500`,
      invParams
    );
    const revenueSummary = {
      total: invoicesRows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0),
      count: invoicesRows.length,
    };

    const [appointmentsRows] = await pool.execute(
      `SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
        p.name AS patient_name, p.phone AS patient_phone,
        u.name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       JOIN users u ON a.doctor_id = u.id
       WHERE a.deleted_at IS NULL ${doctorFilter.replace('a.', '')} ${isAllTime ? '' : 'AND a.appointment_date >= ? AND a.appointment_date <= ?'}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT 500`,
      allParams
    );

    res.json({
      success: true,
      data: {
        patients: patientsRows,
        revenueSummary,
        revenueItems: invoicesRows.map((r) => ({
          id: r.id,
          invoice_number: r.invoice_number,
          patient_name: r.patient_name,
          total: parseFloat(r.total) || 0,
          payment_status: r.payment_status,
          created_at: r.created_at,
        })),
        appointments: appointmentsRows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function detailedReportPdf(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const userId = req.user.id;
    const roleId = req.user.roleId;
    const isAdmin = roleId === ROLES.ADMIN;
    const doctorFilter = isAdmin ? ' AND a.doctor_id = ?' : '';
    const doctorParams = isAdmin ? [userId] : [];
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);
    const dateCond = isAllTime ? '' : ' AND a.appointment_date >= ? AND a.appointment_date <= ?';
    const dateParams = isAllTime ? [] : [fromDate, toDate];
    const allParams = [...doctorParams, ...dateParams];

    const [patientsRows] = await pool.execute(
      `SELECT DISTINCT p.id, p.name, p.phone, p.email, p.created_at
       FROM patients p
       INNER JOIN appointments a ON a.patient_id = p.id AND a.deleted_at IS NULL ${doctorFilter.replace('a.', '')}
       WHERE p.deleted_at IS NULL ${isAllTime ? '' : 'AND a.appointment_date >= ? AND a.appointment_date <= ?'}
       ORDER BY p.name LIMIT 300`,
      allParams
    );
    const invJoin = isAdmin ? ' INNER JOIN appointments a ON i.appointment_id = a.id AND a.doctor_id = ?' : '';
    const invWhere = isAllTime ? '' : ' AND DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?';
    const invParams = isAdmin ? [userId, ...dateParams] : dateParams;
    const [invoicesRows] = await pool.execute(
      `SELECT i.invoice_number, p.name AS patient_name, i.total, i.payment_status, i.created_at
       FROM invoices i JOIN patients p ON i.patient_id = p.id ${invJoin}
       WHERE i.deleted_at IS NULL ${invWhere}
       ORDER BY i.created_at DESC LIMIT 300`,
      invParams
    );
    const [appointmentsRows] = await pool.execute(
      `SELECT a.appointment_date, a.start_time, a.end_time, a.status, p.name AS patient_name, u.name AS doctor_name
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.id
       WHERE a.deleted_at IS NULL ${doctorFilter.replace('a.', '')} ${isAllTime ? '' : 'AND a.appointment_date >= ? AND a.appointment_date <= ?'}
       ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 300`,
      allParams
    );

    const periodLabel = isAllTime ? 'All time' : `${fromDate} to ${toDate}`;
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="detailed-report-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).fillColor('#0EA5A4').text('Doctor Desk — Detailed Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(periodLabel, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1E293B').text('Patients', { continued: false });
    doc.fontSize(9).fillColor('#475569').text(`${patientsRows.length} patient(s)`, { continued: false });
    doc.moveDown(0.5);
    if (patientsRows.length === 0) doc.fontSize(9).fillColor('#64748b').text('No patients in this period.', { continued: false });
    else patientsRows.slice(0, 50).forEach((r, i) => {
      doc.fontSize(9).fillColor('#1E293B').text(`${r.name || '—'}  |  ${r.phone || '—'}  |  ${r.email || '—'}  |  ${String(r.created_at || '').slice(0, 10)}`, { continued: false });
      if (i < Math.min(49, patientsRows.length - 1)) doc.moveDown(0.2);
    });
    if (patientsRows.length > 50) doc.fontSize(9).fillColor('#64748b').text(`... and ${patientsRows.length - 50} more`, { continued: false });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1E293B').text('Revenue', { continued: false });
    const totalRev = invoicesRows.reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
    doc.fontSize(9).fillColor('#475569').text(`${invoicesRows.length} invoice(s)  |  Total: ₹${Number(totalRev).toLocaleString()}`, { continued: false });
    doc.moveDown(0.5);
    if (invoicesRows.length === 0) doc.fontSize(9).fillColor('#64748b').text('No invoices in this period.', { continued: false });
    else invoicesRows.slice(0, 50).forEach((r, i) => {
      doc.fontSize(9).fillColor('#1E293B').text(`${r.invoice_number || '—'}  |  ${r.patient_name || '—'}  |  ₹${Number(r.total).toLocaleString()}  |  ${(r.payment_status || '—')}  |  ${String(r.created_at || '').slice(0, 10)}`, { continued: false });
      if (i < Math.min(49, invoicesRows.length - 1)) doc.moveDown(0.2);
    });
    if (invoicesRows.length > 50) doc.fontSize(9).fillColor('#64748b').text(`... and ${invoicesRows.length - 50} more`, { continued: false });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1E293B').text('Appointments', { continued: false });
    doc.fontSize(9).fillColor('#475569').text(`${appointmentsRows.length} appointment(s)`, { continued: false });
    doc.moveDown(0.5);
    if (appointmentsRows.length === 0) doc.fontSize(9).fillColor('#64748b').text('No appointments in this period.', { continued: false });
    else appointmentsRows.slice(0, 50).forEach((r, i) => {
      const dt = String(r.appointment_date || '').slice(0, 10);
      const tm = [r.start_time, r.end_time].filter(Boolean).map((t) => String(t).slice(0, 5)).join('–') || '—';
      doc.fontSize(9).fillColor('#1E293B').text(`${dt}  ${tm}  |  ${r.patient_name || '—'}  |  ${r.doctor_name || '—'}  |  ${(r.status || '').replace(/_/g, ' ')}`, { continued: false });
      if (i < Math.min(49, appointmentsRows.length - 1)) doc.moveDown(0.2);
    });
    if (appointmentsRows.length > 50) doc.fontSize(9).fillColor('#64748b').text(`... and ${appointmentsRows.length - 50} more`, { continued: false });

    doc.end();
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin Revenue: subscriptions (filtered by date range), doctors list, receptionists list.
 * GET ?from=&to=&all=1
 */
async function superAdminRevenue(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);

    let subscriptions = [];
    try {
      const subWhere = isAllTime
        ? ''
        : ' WHERE s.start_date <= ? AND s.end_date >= ?';
      const subParams = isAllTime ? [] : [toDate, fromDate];
      const [subRows] = await pool.execute(
        `SELECT s.id, s.doctor_id, s.amount, s.start_date, s.end_date, s.created_at,
          u.name AS doctor_name, u.email AS doctor_email,
          CASE WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS status
         FROM subscriptions s
         JOIN users u ON u.id = s.doctor_id AND u.deleted_at IS NULL
         ${subWhere}
         ORDER BY s.start_date DESC`,
        subParams
      );
      subscriptions = subRows.map((r) => ({
        id: r.id,
        doctorId: r.doctor_id,
        doctorName: r.doctor_name,
        doctorEmail: r.doctor_email,
        amount: parseFloat(r.amount) || 0,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        createdAt: r.created_at,
      }));
    } catch (_) {
      // subscriptions table may not exist
    }

    const [doctorRows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
        s.id AS subscription_id, s.amount, s.start_date, s.end_date,
        CASE WHEN s.end_date IS NULL THEN NULL WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS sub_status
       FROM users u
       LEFT JOIN subscriptions s ON s.doctor_id = u.id
       WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL
       ORDER BY u.name`,
      [ROLES.ADMIN, ROLES.DOCTOR]
    );
    const doctors = doctorRows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone || null,
      createdAt: r.created_at,
      subscriptionId: r.subscription_id,
      subscriptionAmount: r.amount != null ? parseFloat(r.amount) : null,
      subscriptionStart: r.start_date,
      subscriptionEnd: r.end_date,
      subscriptionStatus: r.sub_status,
    }));

    const [recepRows] = await pool.execute(
      `SELECT id, name, email, phone, created_at
       FROM users
       WHERE role_id = ? AND deleted_at IS NULL
       ORDER BY name`,
      [ROLES.RECEPTIONIST]
    );
    const receptionists = recepRows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone || null,
      createdAt: r.created_at,
    }));

    const subscriptionRevenueTotal = subscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    res.json({
      success: true,
      data: {
        from: isAllTime ? null : fromDate,
        to: isAllTime ? null : toDate,
        isAllTime,
        subscriptions,
        doctors,
        receptionists,
        subscriptionRevenueTotal,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin Revenue PDF export.
 */
async function superAdminRevenuePdf(req, res, next) {
  try {
    const { from, to, all } = req.query;
    const isAllTime = all === '1' || all === 'true';
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || new Date().toISOString().slice(0, 10);
    const periodLabel = isAllTime ? 'All time' : `${fromDate} to ${toDate}`;

    let subscriptions = [];
    try {
      const subWhere = isAllTime ? '' : ' WHERE s.start_date <= ? AND s.end_date >= ?';
      const subParams = isAllTime ? [] : [toDate, fromDate];
      const [subRows] = await pool.execute(
        `SELECT s.amount, s.start_date, s.end_date, u.name AS doctor_name, u.email AS doctor_email,
          CASE WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS status
         FROM subscriptions s JOIN users u ON u.id = s.doctor_id AND u.deleted_at IS NULL
         ${subWhere} ORDER BY s.start_date DESC`,
        subParams
      );
      subscriptions = subRows;
    } catch (_) {}

    const [doctorRows] = await pool.execute(
      `SELECT u.name, u.email, u.created_at, s.amount, s.start_date, s.end_date,
        CASE WHEN s.end_date IS NULL THEN NULL WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS sub_status
       FROM users u LEFT JOIN subscriptions s ON s.doctor_id = u.id
       WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL ORDER BY u.name`,
      [ROLES.ADMIN, ROLES.DOCTOR]
    );
    const [recepRows] = await pool.execute(
      `SELECT name, email, phone, created_at FROM users WHERE role_id = ? AND deleted_at IS NULL ORDER BY name`,
      [ROLES.RECEPTIONIST]
    );

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="revenue-report-${Date.now()}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).fillColor('#0EA5A4').text('Doctor Desk — Revenue Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(periodLabel, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1E293B').text('Subscriptions', { continued: false });
    doc.fontSize(9).fillColor('#475569').text(`${subscriptions.length} subscription(s) in period`, { continued: false });
    doc.moveDown(0.5);
    if (subscriptions.length === 0) doc.fontSize(9).fillColor('#64748b').text('No subscriptions in this period.', { continued: false });
    else subscriptions.slice(0, 80).forEach((r, i) => {
      doc.fontSize(9).fillColor('#1E293B').text(
        `${r.doctor_name || '—'}  |  ${r.doctor_email || '—'}  |  ₹${Number(r.amount || 0).toLocaleString()}  |  ${String(r.start_date || '').slice(0, 10)} – ${String(r.end_date || '').slice(0, 10)}  |  ${r.status || '—'}`,
        { continued: false }
      );
      if (i < Math.min(79, subscriptions.length - 1)) doc.moveDown(0.2);
    });
    if (subscriptions.length > 80) doc.fontSize(9).fillColor('#64748b').text(`... and ${subscriptions.length - 80} more`, { continued: false });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1E293B').text('Doctors', { continued: false });
    doc.fontSize(9).fillColor('#475569').text(`${doctorRows.length} doctor(s)`, { continued: false });
    doc.moveDown(0.5);
    if (doctorRows.length === 0) doc.fontSize(9).fillColor('#64748b').text('No doctors.', { continued: false });
    else doctorRows.slice(0, 80).forEach((r, i) => {
      const sub = r.amount != null ? `₹${Number(r.amount).toLocaleString()}  ${String(r.start_date || '').slice(0, 10)} – ${String(r.end_date || '').slice(0, 10)}  ${r.sub_status || '—'}` : 'No plan';
      doc.fontSize(9).fillColor('#1E293B').text(`${r.name || '—'}  |  ${r.email || '—'}  |  ${sub}  |  Joined ${String(r.created_at || '').slice(0, 10)}`, { continued: false });
      if (i < Math.min(79, doctorRows.length - 1)) doc.moveDown(0.2);
    });
    if (doctorRows.length > 80) doc.fontSize(9).fillColor('#64748b').text(`... and ${doctorRows.length - 80} more`, { continued: false });
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1E293B').text('Receptionists', { continued: false });
    doc.fontSize(9).fillColor('#475569').text(`${recepRows.length} receptionist(s)`, { continued: false });
    doc.moveDown(0.5);
    if (recepRows.length === 0) doc.fontSize(9).fillColor('#64748b').text('No receptionists.', { continued: false });
    else recepRows.slice(0, 80).forEach((r, i) => {
      doc.fontSize(9).fillColor('#1E293B').text(`${r.name || '—'}  |  ${r.email || '—'}  |  ${r.phone || '—'}  |  Joined ${String(r.created_at || '').slice(0, 10)}`, { continued: false });
      if (i < Math.min(79, recepRows.length - 1)) doc.moveDown(0.2);
    });
    if (recepRows.length > 80) doc.fontSize(9).fillColor('#64748b').text(`... and ${recepRows.length - 80} more`, { continued: false });

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { revenue, appointmentSummary, doctorPerformance, downloadPdf, superAdminReport, appointmentsExportPdf, aiInsights, detailedReport, detailedReportPdf, superAdminRevenue, superAdminRevenuePdf };
