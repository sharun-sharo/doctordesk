const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { ROLES } = require('../config/roles');

function buildPatientWhere(query, roleId, userId) {
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];
  if (query.search && query.search.trim()) {
    conditions.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
    const term = `%${query.search.trim()}%`;
    params.push(term, term, term);
  }
  if (query.gender) {
    conditions.push('p.gender = ?');
    params.push(query.gender);
  }
  if (query.age_min != null && query.age_min !== '') {
    conditions.push('TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) >= ?');
    params.push(parseInt(query.age_min, 10));
  }
  if (query.age_max != null && query.age_max !== '') {
    conditions.push('TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) <= ?');
    params.push(parseInt(query.age_max, 10));
  }
  return { where: conditions.join(' AND '), params };
}

function getPatientOrder(sort, order) {
  const dir = order === 'asc' ? 'ASC' : 'DESC';
  if (sort === 'name') return `p.name ${dir}`;
  if (sort === 'age') return `TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) ${dir}`;
  return `p.created_at ${dir}`;
}

async function list(req, res, next) {
  try {
    const { search, gender, age_min, age_max, page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const { where, params } = buildPatientWhere({ search, gender, age_min, age_max }, req.user.roleId, req.user.id);
    const orderBy = getPatientOrder(sort, order);

    const [rows] = await pool.execute(
      `SELECT p.id, p.name, p.email, p.phone, p.date_of_birth, p.gender, p.address, p.blood_group, p.created_at
       FROM patients p
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM patients p WHERE ${where}`, params);

    res.json({
      success: true,
      data: { patients: rows, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, date_of_birth, gender, address, blood_group, allergies, medical_notes, created_at
       FROM patients WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      blood_group,
      allergies,
      medical_notes,
    } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO patients (name, email, phone, date_of_birth, gender, address, blood_group, allergies, medical_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        email || null,
        phone,
        date_of_birth || null,
        gender || null,
        address || null,
        blood_group || null,
        allergies || null,
        medical_notes || null,
        req.user.id,
      ]
    );
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, date_of_birth, gender, address, blood_group, created_at FROM patients WHERE id = ?',
      [result.insertId]
    );
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'patient',
      entityId: result.insertId,
      newValues: { name, phone },
      req,
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute(
      'SELECT id FROM patients WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    const {
      name,
      email,
      phone,
      date_of_birth,
      gender,
      address,
      blood_group,
      allergies,
      medical_notes,
    } = req.body;
    await pool.execute(
      `UPDATE patients SET name=?, email=?, phone=?, date_of_birth=?, gender=?, address=?, blood_group=?, allergies=?, medical_notes=?
       WHERE id = ?`,
      [
        name,
        email || null,
        phone,
        date_of_birth || null,
        gender || null,
        address || null,
        blood_group || null,
        allergies || null,
        medical_notes || null,
        id,
      ]
    );
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, date_of_birth, gender, address, blood_group, medical_notes, updated_at FROM patients WHERE id = ?',
      [id]
    );
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'patient', entityId: id, req });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = req.params.id;
    const [existing] = await pool.execute('SELECT id FROM patients WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    await pool.execute('UPDATE patients SET deleted_at = NOW() WHERE id = ?', [id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'patient', entityId: id, req });
    res.json({ success: true, message: 'Patient deleted' });
  } catch (err) {
    next(err);
  }
}

async function getMedicalHistory(req, res, next) {
  try {
    const patientId = req.params.id;
    const [patient] = await pool.execute(
      'SELECT id, name FROM patients WHERE id = ? AND deleted_at IS NULL',
      [patientId]
    );
    if (!patient.length) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }
    const [appointments] = await pool.execute(
      `SELECT a.id, a.appointment_date, a.start_time, a.status, u.name AS doctor_name
       FROM appointments a JOIN users u ON a.doctor_id = u.id
       WHERE a.patient_id = ? AND a.deleted_at IS NULL ORDER BY a.appointment_date DESC, a.start_time DESC LIMIT 50`,
      [patientId]
    );
    const [prescriptions] = await pool.execute(
      `SELECT id, diagnosis, notes, medicines, created_at FROM prescriptions
       WHERE patient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50`,
      [patientId]
    );
    res.json({
      success: true,
      data: {
        patient: patient[0],
        appointments,
        prescriptions: prescriptions.map((p) => ({
          ...p,
          medicines: typeof p.medicines === 'string' ? JSON.parse(p.medicines || '[]') : p.medicines || [],
        })),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, getMedicalHistory };
