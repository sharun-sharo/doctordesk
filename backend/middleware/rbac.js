const { ROLES } = require('../config/roles');

/**
 * Require at least one of the given roles
 * Usage: requireRole(ROLES.ADMIN, ROLES.SUPER_ADMIN)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.roleId)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

const superAdminOnly = requireRole(ROLES.SUPER_ADMIN);
const adminOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN);
const doctorOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR);
const receptionistOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.ASSISTANT_DOCTOR);
const staffOnly = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.ASSISTANT_DOCTOR);

module.exports = {
  requireRole,
  superAdminOnly,
  adminOnly,
  doctorOnly,
  receptionistOnly,
  staffOnly,
};
