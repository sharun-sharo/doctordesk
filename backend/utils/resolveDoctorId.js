const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

const BOOKABLE_ROLES = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT_DOCTOR];

/** Resolve and validate doctor_id when booking on behalf of a doctor. */
async function resolveDoctorIdForBooking(req, doctorIdFromBody) {
  let doctor_id =
    doctorIdFromBody != null && doctorIdFromBody !== ''
      ? parseInt(doctorIdFromBody, 10)
      : null;
  if (doctor_id != null && Number.isNaN(doctor_id)) doctor_id = null;

  const roleId = req.user.roleId;
  const userId = req.user.id;

  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    if (doctor_id) {
      const [allowed] = await pool.execute(
        'SELECT 1 FROM receptionist_doctors WHERE receptionist_id = ? AND doctor_id = ?',
        [userId, doctor_id]
      );
      const [isAssistant] = await pool.execute(
        'SELECT 1 FROM users WHERE id = ? AND role_id = ? AND deleted_at IS NULL',
        [doctor_id, ROLES.ASSISTANT_DOCTOR]
      );
      const allowedByAdmin =
        req.user.assignedAdminId && Number(doctor_id) === Number(req.user.assignedAdminId);
      if (!allowed.length && !isAssistant.length && !allowedByAdmin) doctor_id = null;
    }
    if (!doctor_id && req.user.assignedAdminId) doctor_id = req.user.assignedAdminId;
    return doctor_id;
  }

  if (roleId === ROLES.DOCTOR) {
    if (!doctor_id) return userId;
    if (doctor_id === userId) return userId;
    const [team] = await pool.execute(
      `SELECT 1 FROM users WHERE id = ? AND deleted_at IS NULL AND is_active = 1
       AND (id = ? OR (role_id = ? AND assigned_admin_id = ?))`,
      [doctor_id, userId, ROLES.ASSISTANT_DOCTOR, userId]
    );
    return team.length ? doctor_id : userId;
  }

  if (roleId === ROLES.ADMIN || roleId === ROLES.SUPER_ADMIN) {
    if (doctor_id) {
      const [valid] = await pool.execute(
        `SELECT 1 FROM users WHERE id = ? AND role_id IN (?, ?, ?) AND deleted_at IS NULL AND is_active = 1`,
        [doctor_id, ROLES.ADMIN, ROLES.DOCTOR, ROLES.ASSISTANT_DOCTOR]
      );
      if (valid.length) return doctor_id;
    }
    return userId;
  }

  return doctor_id || userId;
}

module.exports = { resolveDoctorIdForBooking, BOOKABLE_ROLES };
