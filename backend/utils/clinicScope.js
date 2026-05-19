const { ROLES } = require('../config/roles');

/** SQL filter for appointment / billing doctor scope by role. */
function appointmentDoctorFilter(roleId, userId, assignedAdminId = null, alias = 'a') {
  const col = `${alias}.doctor_id`;
  if (roleId === ROLES.SUPER_ADMIN) return { sql: '', params: [] };
  if (roleId === ROLES.DOCTOR) {
    return { sql: ` AND ${col} = ?`, params: [userId] };
  }
  if (roleId === ROLES.ADMIN) {
    return {
      sql: ` AND (${col} = ? OR ${col} IN (SELECT id FROM users WHERE assigned_admin_id = ? AND deleted_at IS NULL))`,
      params: [userId, userId],
    };
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    return {
      sql: ` AND (${col} IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (${col} = ? AND ? IS NOT NULL))`,
      params: [userId, assignedAdminId, assignedAdminId],
    };
  }
  return { sql: ' AND 0 = 1', params: [] };
}

/** Invoice billing doctor: COALESCE(invoice.doctor_id, appointment.doctor_id). */
function invoiceBillingDoctorFilter(roleId, userId, assignedAdminId = null) {
  const col = 'COALESCE(i.doctor_id, a.doctor_id)';
  if (roleId === ROLES.SUPER_ADMIN) return { sql: '', params: [] };
  if (roleId === ROLES.DOCTOR) {
    return { sql: ` AND ${col} = ?`, params: [userId] };
  }
  if (roleId === ROLES.ADMIN) {
    return {
      sql: ` AND (${col} = ? OR ${col} IN (SELECT id FROM users WHERE assigned_admin_id = ? AND deleted_at IS NULL))`,
      params: [userId, userId],
    };
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    return {
      sql: ` AND (${col} IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (${col} = ? AND ? IS NOT NULL))`,
      params: [userId, assignedAdminId, assignedAdminId],
    };
  }
  return { sql: ' AND 0 = 1', params: [] };
}

module.exports = { appointmentDoctorFilter, invoiceBillingDoctorFilter };
