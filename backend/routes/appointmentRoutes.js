const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRules, updateRules } = require('../validators/appointmentValidator');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/slots', appointmentController.getSlots);
router.get('/', appointmentController.list);
router.get('/:id', appointmentController.getOne);
router.post('/', createRules, validate, appointmentController.create);
router.post('/:id/send-sms', appointmentController.sendSmsMessage);
router.put('/:id', updateRules, validate, appointmentController.update);
router.delete('/:id', appointmentController.remove);

module.exports = router;
