const express = require('express');
const invoiceController = require('../controllers/invoiceController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRules, updatePaymentRules } = require('../validators/invoiceValidator');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/', invoiceController.list);
router.get('/:id', invoiceController.getOne);
router.get('/:id/download', invoiceController.downloadPdf);
router.delete('/:id', invoiceController.destroy);
router.post('/', createRules, validate, invoiceController.create);
router.patch('/:id/payment', updatePaymentRules, validate, invoiceController.updatePayment);

module.exports = router;
