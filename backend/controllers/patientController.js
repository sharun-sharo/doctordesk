const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');
const { ROLES } = require('../config/roles');

/**
 * Returns SQL condition and params to restrict patients to the current user's scope.
 * - SUPER_ADMIN: no restriction (sees all).
 * - ADMIN/DOCTOR: patients with at least one appointment for this doctor, or created_by this user.
 * - RECEPTIONIST/ASSISTANT_DOCTOR: patients with appointment for an assigned doctor (receptionist_doctors or assigned_admin_id fallback), or created_by this user.
 */
function getPatientScopeCondition(roleId, userId, assignedAdminId = null) {
  if (roleId === ROLES.SUPER_ADMIN) {
    return { condition: '', params: [] };
  }
  if (roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN) {
    return {
      condition: ' AND (p.id IN (SELECT patient_id FROM appointments WHERE doctor_id = ? AND deleted_at IS NULL) OR p.created_by = ?)',
      params: [userId, userId],
    };
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    // Include receptionist_doctors OR assigned_admin_id so staff see data even if table wasn't populated
    return {
      condition: ' AND (p.id IN (SELECT a.patient_id FROM appointments a WHERE a.deleted_at IS NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))) OR p.created_by = ?)',
      params: [userId, assignedAdminId, assignedAdminId, userId],
    };
  }
  // Fallback: restrict to nothing (no rows) if unknown role
  return { condition: ' AND 0 = 1', params: [] };
}

/**
 * Check if the current user can access the given patient (by id). Resolves true/false.
 */
async function canAccessPatient(patientId, roleId, userId, assignedAdminId = null) {
  if (roleId === ROLES.SUPER_ADMIN) return true;
  if (roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN) {
    const [rows] = await pool.execute(
      `SELECT 1 FROM patients p WHERE p.id = ? AND p.deleted_at IS NULL
       AND (p.created_by = ? OR EXISTS (SELECT 1 FROM appointments a WHERE a.patient_id = p.id AND a.deleted_at IS NULL AND a.doctor_id = ?))`,
      [patientId, userId, userId]
    );
    return (rows && rows.length) > 0;
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    const [rows] = await pool.execute(
      `SELECT 1 FROM patients p WHERE p.id = ? AND p.deleted_at IS NULL
       AND (p.created_by = ? OR EXISTS (
         SELECT 1 FROM appointments a
         WHERE a.patient_id = p.id AND a.deleted_at IS NULL
         AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL))
       ))`,
      [patientId, userId, userId, assignedAdminId, assignedAdminId]
    );
    return (rows && rows.length) > 0;
  }
  return false;
}

function buildPatientWhere(query, roleId, userId, assignedAdminId = null) {
  const conditions = ['p.deleted_at IS NULL'];
  const params = [];
  const scope = getPatientScopeCondition(roleId, userId, assignedAdminId);
  if (scope.condition) {
    conditions.push(scope.condition.trim().replace(/^\s*AND\s+/i, ''));
    params.push(...scope.params);
  }
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const likeTerm = `%${term}%`;
    let idMatch = null;
    if (/^\d+$/.test(term)) {
      idMatch = parseInt(term, 10);
    } else if (/^PAT-?\d+$/i.test(term)) {
      idMatch = parseInt(term.replace(/^PAT-?/i, ''), 10);
    }
    if (idMatch != null && !Number.isNaN(idMatch)) {
      conditions.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ? OR p.id = ?)');
      params.push(likeTerm, likeTerm, likeTerm, idMatch);
    } else {
      conditions.push('(p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)');
      params.push(likeTerm, likeTerm, likeTerm);
    }
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
    const { where, params } = buildPatientWhere({ search, gender, age_min, age_max }, req.user.roleId, req.user.id, req.user.assignedAdminId);
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
    const allowed = await canAccessPatient(Number(req.params.id), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
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
    const allowed = await canAccessPatient(Number(id), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
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
    const allowed = await canAccessPatient(Number(id), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
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
    const allowed = await canAccessPatient(Number(patientId), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
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

/**
 * Parse a single CSV line respecting quoted fields (e.g. "a,b" stays one field).
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += c;
  }
  result.push(current.trim());
  return result;
}

function parseCSVBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { header: [], rows: [] };
  const header = parseCSVLine(lines[0]).map((h) => String(h).toLowerCase().replace(/\s+/g, '_'));
  const rows = lines.slice(1).map((line) => {
    const vals = parseCSVLine(line);
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = vals[i] != null ? String(vals[i]).trim() : '';
    });
    return obj;
  });
  return { header, rows };
}

function ageToDateOfBirth(ageStr) {
  const n = parseInt(String(ageStr).trim(), 10);
  if (Number.isNaN(n) || n < 0 || n > 150) return null;
  const year = new Date().getFullYear() - n;
  return `${year}-01-01`;
}

async function bulkCreate(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded' });
    }
    const { rows } = parseCSVBuffer(req.file.buffer);
    const errors = [];
    let added = 0;
    const createdBy = req.user.id;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-based, + header
      const name = (row.name || row.full_name || '').trim();
      const phone = (row.phone || row.phone_number || '').trim().replace(/\s/g, '');
      if (!name) {
        errors.push({ row: rowNum, message: 'Name is required' });
        continue;
      }
      if (!phone) {
        errors.push({ row: rowNum, message: 'Phone is required' });
        continue;
      }
      const email = (row.email || '').trim() || null;
      const ageStr = row.age != null ? row.age : row.date_of_birth;
      const date_of_birth = ageToDateOfBirth(ageStr) || (row.date_of_birth || '').trim() || null;
      const gender = (row.gender || '').toLowerCase().trim();
      const validGender = ['male', 'female', 'other'].includes(gender) ? gender : null;
      const address = (row.address || '').trim() || null;
      const blood_group = (row.blood_group || row.bloodgroup || '').trim() || null;
      const allergies = (row.allergies || '').trim() || null;
      const medical_notes = (row.medical_notes || row.notes || '').trim() || null;

      try {
        await pool.execute(
          `INSERT INTO patients (name, email, phone, date_of_birth, gender, address, blood_group, allergies, medical_notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            email,
            phone,
            date_of_birth,
            validGender,
            address,
            blood_group,
            allergies,
            medical_notes,
            createdBy,
          ]
        );
        added++;
      } catch (err) {
        const msg = err.code === 'ER_DUP_ENTRY' ? 'Duplicate phone or email' : (err.message || 'Insert failed');
        errors.push({ row: rowNum, message: msg });
      }
    }

    await logActivity({
      userId: req.user.id,
      action: 'bulk_create',
      entityType: 'patient',
      entityId: null,
      newValues: { added, failed: errors.length, total: rows.length },
      req,
    });

    res.status(201).json({
      success: true,
      data: { added, failed: errors.length, total: rows.length, errors: errors.slice(0, 50) },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, getMedicalHistory, bulkCreate };
