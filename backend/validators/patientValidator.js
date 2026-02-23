const { body, param } = require('express-validator');

// Treat empty string as absent for optional fields (frontend often sends '' for blank inputs)
const createRules = [
  body('name').trim().notEmpty().withMessage('Name required').isLength({ max: 255 }),
  body('phone').trim().notEmpty().withMessage('Phone required'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  body('date_of_birth').optional({ values: 'falsy' }).isDate().withMessage('Invalid date format'),
  body('gender').optional({ values: 'falsy' }).isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name')
    .optional({ values: 'falsy' })
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name must be at most 255 characters'),
  body('phone')
    .optional({ values: 'falsy' })
    .trim()
    .notEmpty()
    .withMessage('Phone is required'),
  body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail().withMessage('Invalid email'),
  body('date_of_birth').optional({ values: 'falsy' }).isDate().withMessage('Invalid date format'),
  body('gender').optional({ values: 'falsy' }).isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
];

module.exports = { createRules, updateRules };
