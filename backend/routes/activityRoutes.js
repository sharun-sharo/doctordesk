const express = require('express');
const activityController = require('../controllers/activityController');
const loginHistoryController = require('../controllers/loginHistoryController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);
router.use(superAdminOnly);

router.get('/logs', activityController.list);
router.get('/login-history', loginHistoryController.list);

module.exports = router;
