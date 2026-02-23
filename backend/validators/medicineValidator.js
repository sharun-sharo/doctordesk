const { body, param } = require('express-validator');

const createRules = [
  body('name').trim().notEmpty().isLength({ max: 255 }),
  body('generic_name').optional().trim(),
  body('batch_number').optional().trim(),
  body('unit').optional().trim(),
  body('price_per_unit').optional().isFloat({ min: 0 }),
  body('quantity').optional().isInt({ min: 0 }),
  body('min_stock').optional().isInt({ min: 0 }),
  body('expiry_date').optional().isDate(),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('generic_name').optional().trim(),
  body('batch_number').optional().trim(),
  body('unit').optional().trim(),
  body('price_per_unit').optional().isFloat({ min: 0 }),
  body('min_stock').optional().isInt({ min: 0 }),
  body('expiry_date').optional().isDate(),
];

const adjustStockRules = [
  param('id').isInt({ min: 1 }),
  body('type').isIn(['in', 'out', 'adjust']),
  body('quantity').isInt({ min: 1 }),
  body('reason').optional().trim(),
];

module.exports = { createRules, updateRules, adjustStockRules };
