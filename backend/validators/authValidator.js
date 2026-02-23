const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const refreshRules = [body('refreshToken').notEmpty().withMessage('Refresh token required')];

const forgotPasswordRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
];

const resetPasswordRules = [
  body('token').notEmpty().withMessage('Reset token required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter'),
];

module.exports = { loginRules, refreshRules, forgotPasswordRules, resetPasswordRules };
