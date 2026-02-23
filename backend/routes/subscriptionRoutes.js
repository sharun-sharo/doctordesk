const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);
router.use(superAdminOnly);

router.get('/', subscriptionController.list);
router.post('/', subscriptionController.upsert);
router.get('/revenue', subscriptionController.getRevenue);

module.exports = router;
