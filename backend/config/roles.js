/**
 * Role-based access control (RBAC)
 * Role IDs must match database roles.id
 */
const ROLES = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  DOCTOR: 3,
  RECEPTIONIST: 4,
  ASSISTANT_DOCTOR: 5,
};

const ROLE_NAMES = {
  [ROLES.SUPER_ADMIN]: 'super_admin',
  [ROLES.ADMIN]: 'admin',
  [ROLES.DOCTOR]: 'doctor',
  [ROLES.RECEPTIONIST]: 'receptionist',
  [ROLES.ASSISTANT_DOCTOR]: 'assistant_doctor',
};

// Who can create which roles. Super Admin creates Admin, Receptionist, and Assistant doctor.
const CAN_CREATE_ROLES = {
  [ROLES.SUPER_ADMIN]: [ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.ASSISTANT_DOCTOR],
  [ROLES.ADMIN]: [],
  [ROLES.DOCTOR]: [],
  [ROLES.RECEPTIONIST]: [],
  [ROLES.ASSISTANT_DOCTOR]: [],
};

module.exports = { ROLES, ROLE_NAMES, CAN_CREATE_ROLES };
