const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { ROLES } = require('../config/roles');
const { sendSms } = require('../services/sms');

async function list(req, res, next) {
  try {
    const { doctor_id, patient_id, status, date_from, date_to, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const conditions = ['a.deleted_at IS NULL', 'p.id IS NOT NULL'];
    const params = [];

    if (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) {
      conditions.push('a.doctor_id = ?');
      params.push(req.user.id);
    } else if ((req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) && doctor_id) {
      // Receptionist/Assistant doctor: filter by selected doctor (must be one of their assigned)
      conditions.push('a.doctor_id = ?');
      params.push(doctor_id);
    } else if (req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) {
      // Receptionist/Assistant doctor: only appointments for doctors they are assigned to
      conditions.push('a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?)');
      params.push(req.user.id);
    } else if (doctor_id) {
      conditions.push('a.doctor_id = ?');
      params.push(doctor_id);
    }
    if (patient_id) {
      conditions.push('a.patient_id = ?');
      params.push(patient_id);
    }
    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (date_from) {
      conditions.push('a.appointment_date >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('a.appointment_date <= ?');
      params.push(date_to);
    }
    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes, a.created_at,
        COALESCE(p.name, 'Deleted patient') AS patient_name,
        COALESCE(p.phone, '') AS patient_phone,
        u.name AS doctor_name,
        (SELECT COUNT(*) FROM prescriptions pr WHERE pr.appointment_id = a.id AND pr.deleted_at IS NULL) AS prescription_count,
        (SELECT COUNT(*) FROM invoices i WHERE i.appointment_id = a.id AND i.deleted_at IS NULL) AS invoice_count
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       JOIN users u ON a.doctor_id = u.id
       WHERE ${where}
       ORDER BY a.appointment_date DESC, a.start_time DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id AND p.deleted_at IS NULL
       JOIN users u ON a.doctor_id = u.id
       WHERE ${where}`,
      params
    );

    res.json({
      success: true,
      data: { appointments: rows, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.email AS patient_email,
        u.name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.id
       WHERE a.id = ? AND a.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getSlots(req, res, next) {
  try {
    const { doctor_id, date } = req.query;
    if (!doctor_id || !date) {
      return res.status(400).json({ success: false, message: 'doctor_id and date required' });
    }
    const [booked] = await pool.execute(
      `SELECT start_time, end_time FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND deleted_at IS NULL AND status IN ('scheduled','completed')`,
      [doctor_id, date]
    );
    const slotMinutes = 30;
    const start = 0;
    const end = 24 * 60;
    const slots = [];
    for (let m = start; m < end; m += slotMinutes) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const t = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
      const conflict = booked.some((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = b.end_time ? timeToMinutes(b.end_time) : bStart + slotMinutes;
        return m >= bStart && m < bEnd;
      });
      if (!conflict) slots.push(t);
    }
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

async function create(req, res, next) {
  try {
    let { patient_id, doctor_id, appointment_date, start_time, end_time, status, notes } = req.body;
    status = status && ['scheduled', 'completed', 'cancelled', 'no_show'].includes(status) ? status : 'scheduled';
    if (req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) {
      if (doctor_id) {
        const [allowed] = await pool.execute(
          'SELECT 1 FROM receptionist_doctors WHERE receptionist_id = ? AND doctor_id = ?',
          [req.user.id, doctor_id]
        );
        const [isAssistant] = await pool.execute(
          'SELECT 1 FROM users WHERE id = ? AND role_id = ? AND deleted_at IS NULL',
          [doctor_id, ROLES.ASSISTANT_DOCTOR]
        );
        if (!allowed.length && !isAssistant.length) doctor_id = null;
      }
      if (!doctor_id && req.user.assignedAdminId) doctor_id = req.user.assignedAdminId;
    }
    if (req.user.roleId === ROLES.ADMIN || req.user.roleId === ROLES.DOCTOR) {
      doctor_id = req.user.id;
    }
    // Only check slot conflict for scheduled appointments (allow multiple completed e.g. walk-ins)
    if (status === 'scheduled') {
      const [conflict] = await pool.execute(
        `SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND deleted_at IS NULL
         AND status = 'scheduled' AND (
           (start_time <= ? AND (end_time IS NULL OR end_time > ?))
           OR (start_time < ? AND (end_time IS NULL OR end_time > ?))
         )`,
        [doctor_id, appointment_date, start_time, start_time, end_time || start_time, start_time]
      );
      if (conflict.length) {
        return res.status(400).json({ success: false, message: 'Time slot already booked' });
      }
    }
    const [result] = await pool.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient_id, doctor_id, appointment_date, start_time, end_time || null, status, notes || null, req.user.id]
    );
    const [rows] = await pool.execute(
      `SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.status,
        p.name AS patient_name, p.phone AS patient_phone, u.name AS doctor_name
       FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.id = ?`,
      [result.insertId]
    );
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'appointment',
      entityId: result.insertId,
      newValues: { patient_id, doctor_id, appointment_date, start_time },
      req,
    });
    const appointment = rows[0];
    if (appointment && appointment.patient_phone) {
      try {
        const apptDate = new Date(appointment.appointment_date);
        const dateStr = `${apptDate.getMonth() + 1}/${apptDate.getDate()}`;
        let timeStr = '—';
        if (appointment.start_time) {
          const [h, m] = String(appointment.start_time).split(':').map(Number);
          const h12 = h % 12 || 12;
          const ampm = h < 12 ? 'am' : 'pm';
          timeStr = m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
        }
        const longDateStr = apptDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const body = `Hi ${appointment.patient_name}, your appointment with ${appointment.doctor_name} is on ${longDateStr}${timeStr !== '—' ? ` at ${timeStr}` : ''}. - DoctorDesk`;
        await sendSms(appointment.patient_phone, body);
      } catch (smsErr) {
        // Don't fail appointment creation if SMS fails (e.g. not configured or delivery error)
        console.error('SMS send after book appointment:', smsErr.message);
      }
    }
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute(
      'SELECT id, doctor_id FROM appointments WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && existing[0].doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your appointment' });
    }
    if ((req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) && req.user.assignedAdminId && existing[0].doctor_id !== req.user.assignedAdminId) {
      return res.status(403).json({ success: false, message: 'Not your appointment' });
    }
    const { appointment_date, start_time, end_time, status, notes } = req.body;
    const updates = [];
    const params = [];
    if (appointment_date !== undefined) {
      updates.push('appointment_date = ?');
      params.push(appointment_date);
    }
    if (start_time !== undefined) {
      updates.push('start_time = ?');
      params.push(start_time);
    }
    if (end_time !== undefined) {
      updates.push('end_time = ?');
      params.push(end_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (updates.length) {
      params.push(id);
      await pool.execute(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await pool.execute(
      `SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
        p.name AS patient_name, u.name AS doctor_name
       FROM appointments a JOIN patients p ON a.patient_id = p.id JOIN users u ON a.doctor_id = u.id WHERE a.id = ?`,
      [id]
    );
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'appointment', entityId: id, req });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute(
      'SELECT id, doctor_id FROM appointments WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && existing[0].doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your appointment' });
    }
    if ((req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) && req.user.assignedAdminId && existing[0].doctor_id !== req.user.assignedAdminId) {
      return res.status(403).json({ success: false, message: 'Not your appointment' });
    }
    await pool.execute('UPDATE appointments SET deleted_at = NOW(), status = ? WHERE id = ?', ['cancelled', id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'appointment', entityId: id, req });
    res.json({ success: true, message: 'Appointment cancelled' });
  } catch (err) {
    next(err);
  }
}

async function sendSmsMessage(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const [rows] = await pool.execute(
      `SELECT a.id, a.doctor_id, a.appointment_date, a.start_time, a.end_time,
        p.name AS patient_name, p.phone AS patient_phone,
        u.name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.doctor_id = u.id
       WHERE a.id = ? AND a.deleted_at IS NULL`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    const appointment = rows[0];
    if (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) {
      if (appointment.doctor_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your appointment' });
      }
    }

    const customMessage = req.body.message && String(req.body.message).trim();
    const apptDate = new Date(appointment.appointment_date);
    let timeStr = '—';
    if (appointment.start_time) {
      const [h, m] = String(appointment.start_time).split(':').map(Number);
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? 'am' : 'pm';
      timeStr = m ? `${h12}:${String(m).padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
    }
    const longDateStr = new Date(appointment.appointment_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const defaultBody = `Hi ${appointment.patient_name}, your appointment with ${appointment.doctor_name} is on ${longDateStr}${timeStr !== '—' ? ` at ${timeStr}` : ''}. - DoctorDesk`;
    await sendSms(appointment.patient_phone, customMessage || defaultBody);
    await logActivity({ userId: req.user.id, action: 'send_sms', entityType: 'appointment', entityId: id, req });
    res.json({ success: true, message: 'SMS sent' });
  } catch (err) {
    const status = err.message && (err.message.includes('not configured') || err.message.includes('Invalid')) ? 400 : 500;
    res.status(status).json({ success: false, message: err.message || 'Failed to send SMS' });
  }
}

module.exports = { list, getOne, getSlots, create, update, remove, sendSmsMessage };
