const express = require('express');
const patientController = require('../controllers/patientController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRules, updateRules } = require('../validators/patientValidator');
const { csvUpload } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/', patientController.list);
router.get('/:id/medical-history', patientController.getMedicalHistory);
router.get('/:id', patientController.getOne);
router.post('/', createRules, validate, patientController.create);
router.post('/bulk', csvUpload, patientController.bulkCreate);
router.put('/:id', updateRules, validate, patientController.update);
router.delete('/:id', patientController.remove);

module.exports = router;
