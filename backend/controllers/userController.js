const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { ROLES, CAN_CREATE_ROLES } = require('../config/roles');
const { logActivity } = require('../utils/activityLogger');

async function list(req, res, next) {
  try {
    const { role_id, search, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;

    let where = 'u.deleted_at IS NULL AND u.role_id != ?';
    const params = [ROLES.SUPER_ADMIN];

    if (role_id) {
      const rid = parseInt(role_id, 10);
      if ([ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.ASSISTANT_DOCTOR].includes(rid)) {
        where += ' AND u.role_id = ?';
        params.push(rid);
      }
    }
    if (search && search.trim()) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name, u.phone, u.role_id, u.assigned_admin_id, u.is_active, u.created_at, r.name AS role_name,
        a.name AS assigned_admin_name
       FROM users u JOIN roles r ON u.role_id = r.id
       LEFT JOIN users a ON u.assigned_admin_id = a.id AND a.deleted_at IS NULL
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );

    const staffWithDoctorsIds = (rows || []).filter((r) => r.role_id === ROLES.RECEPTIONIST || r.role_id === ROLES.ASSISTANT_DOCTOR).map((r) => r.id);
    let assignmentMap = {};
    if (staffWithDoctorsIds.length > 0) {
      const placeholders = staffWithDoctorsIds.map(() => '?').join(',');
      const [assignments] = await pool.execute(
        `SELECT rd.receptionist_id, rd.doctor_id, d.name AS doctor_name
         FROM receptionist_doctors rd
         JOIN users d ON rd.doctor_id = d.id AND d.deleted_at IS NULL
         WHERE rd.receptionist_id IN (${placeholders})
         ORDER BY rd.receptionist_id, d.name`,
        staffWithDoctorsIds
      );
      for (const row of assignments || []) {
        if (!assignmentMap[row.receptionist_id]) {
          assignmentMap[row.receptionist_id] = { ids: [], names: [] };
        }
        assignmentMap[row.receptionist_id].ids.push(row.doctor_id);
        assignmentMap[row.receptionist_id].names.push(row.doctor_name);
      }
    }
    const usersWithAssignments = (rows || []).map((u) => {
      const out = { ...u };
      if ((u.role_id === ROLES.RECEPTIONIST || u.role_id === ROLES.ASSISTANT_DOCTOR) && assignmentMap[u.id]) {
        out.assigned_doctor_ids = assignmentMap[u.id].ids;
        out.assigned_doctor_names = assignmentMap[u.id].names.join(', ');
      }
      return out;
    });

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM users u WHERE ${where}`,
      params
    );

    res.json({
      success: true,
      data: { users: usersWithAssignments, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name, u.phone, u.role_id, u.assigned_admin_id, u.is_active, u.created_at, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const data = { ...rows[0] };
    if (data.role_id === ROLES.RECEPTIONIST || data.role_id === ROLES.ASSISTANT_DOCTOR) {
      const [assignments] = await pool.execute(
        'SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ? ORDER BY doctor_id',
        [req.params.id]
      );
      data.assigned_doctor_ids = (assignments || []).map((r) => r.doctor_id);
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const allowed = CAN_CREATE_ROLES[req.user.roleId] || [];
    if (!allowed.includes(req.body.role_id)) {
      return res.status(403).json({ success: false, message: 'Cannot create this role' });
    }
    const { email, password, name, phone, role_id } = req.body;
    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (email, password, name, phone, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [email, hashed, name, phone || null, role_id]
    );
    const newId = result.insertId;
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'user',
      entityId: newId,
      newValues: { email, name, role_id },
      req,
    });
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name, u.phone, u.role_id, u.is_active, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [newId]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.execute(
      'SELECT id, email, name, phone, role_id, assigned_admin_id, is_active FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = existing[0];
    if (user.role_id === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Cannot edit Super Admin' });
    }
    const allowedRoles = CAN_CREATE_ROLES[req.user.roleId] || [];
    if (!allowedRoles.includes(user.role_id) && req.user.roleId !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const { name, phone, is_active, password, assigned_admin_id, assigned_doctor_ids } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (password && String(password).length >= 8) {
      updates.push('password = ?');
      params.push(await bcrypt.hash(password, 12));
    }
    // Super Admin can assign receptionist/assistant doctor to one or more doctors
    if ((user.role_id === ROLES.RECEPTIONIST || user.role_id === ROLES.ASSISTANT_DOCTOR) && req.user.roleId === ROLES.SUPER_ADMIN) {
      if (Array.isArray(assigned_doctor_ids)) {
        await pool.execute('DELETE FROM receptionist_doctors WHERE receptionist_id = ?', [id]);
        const ids = assigned_doctor_ids.filter((v) => Number.isInteger(Number(v)) && Number(v) >= 1);
        if (ids.length > 0) {
          await pool.query(
            `INSERT INTO receptionist_doctors (receptionist_id, doctor_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
            ids.flatMap((doctorId) => [id, doctorId])
          );
          updates.push('assigned_admin_id = ?');
          params.push(ids[0]);
        } else {
          updates.push('assigned_admin_id = ?');
          params.push(null);
        }
      } else if (assigned_admin_id !== undefined) {
        const aid = assigned_admin_id === '' || assigned_admin_id === null ? null : parseInt(assigned_admin_id, 10);
        if (aid === null || aid > 0) {
          updates.push('assigned_admin_id = ?');
          params.push(aid);
        }
      }
    }
    if (updates.length) {
      params.push(id);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name, u.phone, u.role_id, u.assigned_admin_id, u.is_active, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );
    const data = rows[0] ? { ...rows[0] } : null;
    if (data && (data.role_id === ROLES.RECEPTIONIST || data.role_id === ROLES.ASSISTANT_DOCTOR)) {
      const [assignments] = await pool.execute(
        'SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ? ORDER BY doctor_id',
        [id]
      );
      data.assigned_doctor_ids = (assignments || []).map((r) => r.doctor_id);
    }
    await logActivity({
      userId: req.user.id,
      action: 'update',
      entityType: 'user',
      entityId: id,
      req,
    });
    res.json({ success: true, data: data || rows[0] });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await pool.execute(
      'SELECT id, role_id FROM users WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (existing[0].role_id === ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Admin' });
    }
    await pool.execute('UPDATE users SET deleted_at = NOW(), is_active = 0 WHERE id = ?', [id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'user', entityId: id, req });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, name, phone, whatsapp_phone FROM users WHERE id = ? AND deleted_at IS NULL`,
      [req.user.id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const u = rows[0];
    res.json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        name: u.name || '',
        phone: u.phone || '',
        whatsapp_phone: u.whatsapp_phone != null ? u.whatsapp_phone : '',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone === '' ? null : phone);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    params.push(req.user.id);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.execute(
      `SELECT id, email, name, phone FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] || {} });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    const [rows] = await pool.execute('SELECT id, password FROM users WHERE id = ? AND deleted_at IS NULL', [req.user.id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    const hashed = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

async function getDoctors(req, res, next) {
  try {
    const roleId = req.user.roleId;
    const userId = req.user.id;
    const assignedAdminId = req.user.assignedAdminId;

    // Reception / Assistant doctor: assigned doctors (from receptionist_doctors) + all Assistant doctors (for appointment "doctor" list)
    if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
      const [assigned] = await pool.execute(
        `SELECT u.id, u.name, u.email, u.phone FROM users u
         INNER JOIN receptionist_doctors rd ON rd.doctor_id = u.id
         WHERE rd.receptionist_id = ? AND u.deleted_at IS NULL AND u.is_active = 1`,
        [userId]
      );
      const [assistants] = await pool.execute(
        `SELECT id, name, email, phone FROM users WHERE role_id = ? AND deleted_at IS NULL AND is_active = 1`,
        [ROLES.ASSISTANT_DOCTOR]
      );
      const byId = new Map((assigned || []).map((r) => [r.id, r]));
      (assistants || []).forEach((a) => { if (!byId.has(a.id)) byId.set(a.id, a); });
      const merged = Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return res.json({ success: true, data: merged });
    }
    if (roleId === ROLES.ADMIN || roleId === ROLES.DOCTOR) {
      const [rows] = await pool.execute(
        `SELECT id, name, email, phone FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1`,
        [userId]
      );
      return res.json({ success: true, data: rows });
    }
    // Super Admin: all users who can be selected as "doctor" for appointments (Admin, Doctor, Assistant doctor)
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone FROM users WHERE role_id IN (?, ?, ?) AND deleted_at IS NULL AND is_active = 1 ORDER BY name`,
      [ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT_DOCTOR]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

/** Returns doctors with receptionist names for each (for Walk-ins dropdown). */
async function getDoctorsWithReceptionists(req, res, next) {
  try {
    const roleId = req.user.roleId;
    const userId = req.user.id;

    if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
      const [rows] = await pool.execute(
        `SELECT d.id, d.name, d.email, d.phone,
                GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS receptionist_names
         FROM users d
         INNER JOIN receptionist_doctors rd ON rd.doctor_id = d.id
         LEFT JOIN users r ON rd.receptionist_id = r.id AND r.deleted_at IS NULL
         WHERE rd.receptionist_id = ? AND d.deleted_at IS NULL AND d.is_active = 1
         GROUP BY d.id, d.name, d.email, d.phone ORDER BY d.name`,
        [userId]
      );
      const data = (rows || []).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        receptionistNames: r.receptionist_names ? r.receptionist_names.split(', ') : [],
      }));
      return res.json({ success: true, data });
    }
    if (roleId === ROLES.DOCTOR) {
      const [docRows] = await pool.execute(
        `SELECT id, name, email, phone FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1`,
        [userId]
      );
      const [recRows] = await pool.execute(
        `SELECT r.name FROM receptionist_doctors rd
         JOIN users r ON rd.receptionist_id = r.id AND r.deleted_at IS NULL
         WHERE rd.doctor_id = ? ORDER BY r.name`,
        [userId]
      );
      const receptionistNames = (recRows || []).map((r) => r.name);
      const data = (docRows || []).map((d) => ({ ...d, receptionistNames }));
      return res.json({ success: true, data });
    }
    // Admin and Super Admin: all doctors with their receptionists (so Walk-ins can show all 3+ with checkboxes)
    const [rows] = await pool.execute(
      `SELECT d.id, d.name, d.email, d.phone,
              GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS receptionist_names
       FROM users d
       LEFT JOIN receptionist_doctors rd ON rd.doctor_id = d.id
       LEFT JOIN users r ON rd.receptionist_id = r.id AND r.deleted_at IS NULL
       WHERE d.role_id IN (?, ?) AND d.deleted_at IS NULL AND d.is_active = 1
       GROUP BY d.id, d.name, d.email, d.phone ORDER BY d.name`,
      [ROLES.ADMIN, ROLES.DOCTOR]
    );
    const data = (rows || []).map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      receptionistNames: r.receptionist_names ? r.receptionist_names.split(', ').filter(Boolean) : [],
    }));
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, getProfile, updateProfile, changePassword, getDoctors, getDoctorsWithReceptionists };
