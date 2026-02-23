const express = require('express');
const medicineController = require('../controllers/medicineController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRules, updateRules, adjustStockRules } = require('../validators/medicineValidator');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/low-stock', medicineController.lowStockAlerts);
router.get('/', medicineController.list);
router.get('/:id', medicineController.getOne);
router.post('/', createRules, validate, medicineController.create);
router.put('/:id', updateRules, validate, medicineController.update);
router.post('/:id/adjust-stock', adjustStockRules, validate, medicineController.adjustStock);
router.delete('/:id', medicineController.remove);

module.exports = router;
