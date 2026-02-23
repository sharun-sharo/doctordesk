const { body, param } = require('express-validator');

const createRules = [
  body('patient_id').isInt({ min: 1 }),
  body('doctor_id').isInt({ min: 1 }),
  body('appointment_date').isDate(),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('Time format HH:mm or HH:mm:ss'),
  body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('notes').optional().trim(),
];

const updateRules = [
  param('id').isInt({ min: 1 }),
  body('appointment_date').optional().isDate(),
  body('start_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('end_time').optional().matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('status').optional().isIn(['scheduled', 'completed', 'cancelled', 'no_show']),
  body('notes').optional().trim(),
];

module.exports = { createRules, updateRules };
