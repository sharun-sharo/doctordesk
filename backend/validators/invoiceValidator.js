const { body } = require('express-validator');

const createRules = [
  body('patient_id').isInt({ min: 1 }),
  body('appointment_id').optional().isInt({ min: 1 }),
  body('items').isArray().withMessage('Items array required'),
  body('items.*.description').optional().trim(),
  body('items.*.item_type').optional().isIn(['consultation', 'medicine', 'other']),
  body('items.*.quantity').optional().isInt({ min: 1 }),
  body('items.*.unit_price').optional().isFloat({ min: 0 }),
  body('items.*.medicine_id').optional().isInt({ min: 1 }),
  body('tax_percent').optional().isFloat({ min: 0, max: 100 }),
  body('discount').optional().isFloat({ min: 0 }),
];

const updatePaymentRules = [
  body('paid_amount').isFloat({ min: 0 }),
  body('payment_status').optional().isIn(['pending', 'partial', 'paid']),
];

module.exports = { createRules, updatePaymentRules };
