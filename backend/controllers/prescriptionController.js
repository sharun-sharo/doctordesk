const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { ROLES } = require('../config/roles');
const { UPLOAD_DIR } = require('../middleware/upload');

function parseMedicines(medicines) {
  if (medicines === undefined || medicines === null) return [];
  if (Buffer.isBuffer(medicines)) {
    try {
      return JSON.parse(medicines.toString('utf8') || '[]');
    } catch {
      return [];
    }
  }
  if (typeof medicines === 'string') {
    try {
      return JSON.parse(medicines || '[]');
    } catch {
      return [];
    }
  }
  return Array.isArray(medicines) ? medicines : [];
}

async function list(req, res, next) {
  try {
    const { patient_id, doctor_id, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const conditions = [];
    const params = [];
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN)) {
      conditions.push('pr.doctor_id = ?');
      params.push(req.user.id);
    }
    if (patient_id) {
      conditions.push('pr.patient_id = ?');
      params.push(patient_id);
    }
    if (doctor_id && (req.user.roleId !== ROLES.DOCTOR && req.user.roleId !== ROLES.ADMIN)) {
      conditions.push('pr.doctor_id = ?');
      params.push(doctor_id);
    }
    const where = conditions.length ? conditions.join(' AND ') : '1=1';

    const [rows] = await pool.execute(
      `SELECT pr.id, pr.patient_id, pr.doctor_id, pr.appointment_id, pr.diagnosis, pr.notes, pr.medicines, pr.created_at,
        p.name AS patient_name, u.name AS doctor_name
       FROM prescriptions pr
       JOIN patients p ON pr.patient_id = p.id
       JOIN users u ON pr.doctor_id = u.id
       WHERE ${where}
       ORDER BY pr.created_at DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM prescriptions pr WHERE ${where}`, params);

    const data = rows.map((r) => ({
      ...r,
      medicines: parseMedicines(r.medicines),
    }));

    res.json({
      success: true,
      data: { prescriptions: data, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT pr.id, pr.patient_id, pr.doctor_id, pr.appointment_id, pr.diagnosis, pr.notes, pr.medicines, pr.created_at,
        p.name AS patient_name, p.phone AS patient_phone, p.date_of_birth, p.gender, p.blood_group,
        u.name AS doctor_name
       FROM prescriptions pr
       LEFT JOIN patients p ON pr.patient_id = p.id
       LEFT JOIN users u ON pr.doctor_id = u.id
       WHERE pr.id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    const r = rows[0];
    r.medicines = parseMedicines(r.medicines);
    let attRows = [];
    try {
      const [a] = await pool.execute(
        'SELECT id, file_path, original_name FROM prescription_attachments WHERE prescription_id = ? ORDER BY id',
        [req.params.id]
      );
      attRows = a || [];
    } catch (_) {
      // prescription_attachments table may not exist yet
    }
    r.attachments = attRows.map((a) => ({ id: a.id, original_name: a.original_name || a.file_path }));
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
}

async function getAttachment(req, res, next) {
  try {
    const id = req.params.id;
    const attachmentId = req.params.attachmentId;
    if (attachmentId && attachmentId !== 'legacy') {
      const [attRows] = await pool.execute(
        'SELECT pa.id, pa.file_path, pa.original_name, pr.doctor_id FROM prescription_attachments pa JOIN prescriptions pr ON pa.prescription_id = pr.id WHERE pr.id = ? AND pa.id = ?',
        [id, attachmentId]
      );
      if (!attRows.length) {
        return res.status(404).json({ success: false, message: 'Attachment not found' });
      }
      const a = attRows[0];
      if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && a.doctor_id !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not your prescription' });
      }
      const filePath = path.join(UPLOAD_DIR, a.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }
      res.download(filePath, a.original_name || a.file_path);
      return;
    }
    const [attRows] = await pool.execute(
      'SELECT pa.id, pa.file_path, pa.original_name, pr.doctor_id FROM prescription_attachments pa JOIN prescriptions pr ON pa.prescription_id = pr.id WHERE pr.id = ? ORDER BY pa.id LIMIT 1',
      [id]
    );
    if (!attRows.length) {
      return res.status(404).json({ success: false, message: 'No attachment' });
    }
    const a = attRows[0];
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && a.doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your prescription' });
    }
    const filePath = path.join(UPLOAD_DIR, a.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    res.download(filePath, a.original_name || a.file_path);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { patient_id, appointment_id, diagnosis, notes, medicines } = req.body;
    const doctorId = (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) ? req.user.id : req.body.doctor_id;
    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor required' });
    }
    const patientId = patient_id != null && patient_id !== '' ? parseInt(patient_id, 10) : null;
    if (!patientId || Number.isNaN(patientId)) {
      return res.status(400).json({ success: false, message: 'Patient is required' });
    }
    const medicinesArr = parseMedicines(medicines);
    const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
    const [result] = await pool.execute(
      `INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, notes, medicines)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        doctorId,
        appointment_id || null,
        diagnosis || null,
        notes || null,
        JSON.stringify(medicinesArr),
      ]
    );
    const prescriptionId = result.insertId;
    for (const file of files) {
      await pool.execute(
        'INSERT INTO prescription_attachments (prescription_id, file_path, original_name) VALUES (?, ?, ?)',
        [prescriptionId, path.basename(file.path), file.originalname || null]
      );
    }
    const [rows] = await pool.execute(
      `SELECT pr.id, pr.patient_id, pr.doctor_id, pr.diagnosis, pr.notes, pr.medicines, pr.created_at,
        p.name AS patient_name, u.name AS doctor_name
       FROM prescriptions pr JOIN patients p ON pr.patient_id = p.id JOIN users u ON pr.doctor_id = u.id
       WHERE pr.id = ?`,
      [prescriptionId]
    );
    const r = rows[0];
    r.medicines = parseMedicines(r.medicines);
    const [attRows] = await pool.execute('SELECT id, original_name FROM prescription_attachments WHERE prescription_id = ? ORDER BY id', [prescriptionId]);
    r.attachments = (attRows || []).map((a) => ({ id: a.id, original_name: a.original_name }));
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'prescription',
      entityId: prescriptionId,
      newValues: { patient_id, doctor_id: doctorId },
      req,
    });
    res.status(201).json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute(
      'SELECT id, doctor_id FROM prescriptions WHERE id = ?',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && existing[0].doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your prescription' });
    }
    const { diagnosis, notes, medicines } = req.body;
    const updates = [];
    const params = [];
    if (diagnosis !== undefined) {
      updates.push('diagnosis = ?');
      params.push(diagnosis);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (medicines !== undefined) {
      updates.push('medicines = ?');
      params.push(JSON.stringify(parseMedicines(medicines)));
    }
    if (updates.length) {
      params.push(id);
      await pool.execute(`UPDATE prescriptions SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const files = req.files && req.files.length ? req.files : req.file ? [req.file] : [];
    for (const file of files) {
      await pool.execute(
        'INSERT INTO prescription_attachments (prescription_id, file_path, original_name) VALUES (?, ?, ?)',
        [id, path.basename(file.path), file.originalname || null]
      );
    }
    const [rows] = await pool.execute(
      `SELECT pr.id, pr.patient_id, pr.doctor_id, pr.diagnosis, pr.notes, pr.medicines, pr.created_at,
        p.name AS patient_name, u.name AS doctor_name
       FROM prescriptions pr JOIN patients p ON pr.patient_id = p.id JOIN users u ON pr.doctor_id = u.id
       WHERE pr.id = ?`,
      [id]
    );
    const r = rows[0];
    r.medicines = parseMedicines(r.medicines);
    const [attRows] = await pool.execute('SELECT id, original_name FROM prescription_attachments WHERE prescription_id = ? ORDER BY id', [id]);
    r.attachments = (attRows || []).map((a) => ({ id: a.id, original_name: a.original_name }));
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'prescription', entityId: id, req });
    res.json({ success: true, data: r });
  } catch (err) {
    next(err);
  }
}

async function deleteAttachment(req, res, next) {
  try {
    const { id: prescriptionId, attachmentId } = req.params;
    if (attachmentId === 'legacy') {
      return res.status(400).json({ success: false, message: 'Legacy attachment cannot be deleted via this endpoint' });
    }
    const [existing] = await pool.execute(
      'SELECT id, doctor_id FROM prescriptions WHERE id = ?',
      [prescriptionId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Prescription not found' });
    }
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) && existing[0].doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your prescription' });
    }
    const [att] = await pool.execute(
      'SELECT id, file_path FROM prescription_attachments WHERE prescription_id = ? AND id = ?',
      [prescriptionId, attachmentId]
    );
    if (!att.length) {
      return res.status(404).json({ success: false, message: 'Attachment not found' });
    }
    const filePath = path.join(UPLOAD_DIR, att[0].file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.execute('DELETE FROM prescription_attachments WHERE id = ?', [attachmentId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, getAttachment, create, update, deleteAttachment };
