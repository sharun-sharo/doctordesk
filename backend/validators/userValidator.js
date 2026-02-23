const { body, param } = require('express-validator');
const { ROLES } = require('../config/roles');

const createRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password at least 8 characters')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[A-Z]/).withMessage('Password must contain uppercase')
    .matches(/[a-z]/).withMessage('Password must contain lowercase'),
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('phone').optional().trim(),
  body('role_id').isIn([ROLES.ADMIN, ROLES.RECEPTIONIST]).withMessage('Invalid role (Admin or Reception only)'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('phone').optional().trim(),
  body('is_active').optional().isBoolean(),
  body('password').optional().isLength({ min: 8 }),
  body('assigned_admin_id').optional({ nullable: true }).custom((v) => v === '' || v === null || v === undefined || (Number.isInteger(Number(v)) && Number(v) >= 1)).withMessage('Assigned admin must be a valid user id or empty'),
  body('assigned_doctor_ids')
    .optional()
    .isArray()
    .withMessage('Assigned doctors must be an array'),
  body('assigned_doctor_ids.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Each assigned doctor must be a valid user id'),
];

const profileUpdateRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 255 }).withMessage('Name must be 1–255 characters'),
  body('phone').optional().trim().isLength({ max: 20 }),
  body('whatsapp_phone').optional().trim().isLength({ max: 20 }).withMessage('WhatsApp number max 20 characters'),
];

module.exports = { createRules, updateRules, profileUpdateRules };
