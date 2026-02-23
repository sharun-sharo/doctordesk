/**
 * Role-based access control (RBAC)
 * Role IDs must match database roles.id
 */
const ROLES = {
  SUPER_ADMIN: 1,
  ADMIN: 2,
  DOCTOR: 3,
  RECEPTIONIST: 4,
};

const ROLE_NAMES = {
  [ROLES.SUPER_ADMIN]: 'super_admin',
  [ROLES.ADMIN]: 'admin',
  [ROLES.DOCTOR]: 'doctor',
  [ROLES.RECEPTIONIST]: 'receptionist',
};

// Who can create which roles. Super Admin creates Admin and Reception only (3 roles: super_admin, admin, reception).
const CAN_CREATE_ROLES = {
  [ROLES.SUPER_ADMIN]: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  [ROLES.ADMIN]: [],
  [ROLES.DOCTOR]: [],
  [ROLES.RECEPTIONIST]: [],
};

module.exports = { ROLES, ROLE_NAMES, CAN_CREATE_ROLES };
