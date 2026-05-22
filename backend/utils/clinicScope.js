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

const INVOICE_REVENUE_FROM = `
  FROM invoices i
  LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL
  INNER JOIN patients p ON i.patient_id = p.id AND p.deleted_at IS NULL
  WHERE i.deleted_at IS NULL`;

/** Sum invoice totals with role-scoped billing doctor (includes assistant doctors for Admin). */
function invoiceRevenueSumQuery(roleId, userId, assignedAdminId = null, dateSql = '') {
  const inv = invoiceBillingDoctorFilter(roleId, userId, assignedAdminId);
  return {
    sql: `SELECT COALESCE(SUM(i.total), 0) AS total ${INVOICE_REVENUE_FROM}${inv.sql}${dateSql}`,
    params: [...inv.params],
  };
}

/** Sum paid_amount / pending with same scope. */
function invoiceCollectionSumQuery(roleId, userId, assignedAdminId = null) {
  const inv = invoiceBillingDoctorFilter(roleId, userId, assignedAdminId);
  return {
    sql: `SELECT COALESCE(SUM(i.paid_amount), 0) AS collected, COALESCE(SUM(i.total - i.paid_amount), 0) AS pending ${INVOICE_REVENUE_FROM}${inv.sql}`,
    params: [...inv.params],
  };
}

module.exports = {
  appointmentDoctorFilter,
  invoiceBillingDoctorFilter,
  INVOICE_REVENUE_FROM,
  invoiceRevenueSumQuery,
  invoiceCollectionSumQuery,
};
