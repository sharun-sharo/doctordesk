const express = require('express');
const settingsController = require('../controllers/settingsController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { clinicLogoUpload } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/', settingsController.getSettings);
router.post('/logo', clinicLogoUpload, settingsController.uploadLogo);
router.patch('/business', settingsController.updateBusinessDetails);

module.exports = router;
