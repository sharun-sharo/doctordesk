const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { superAdminOnly, adminOnly } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRules, updateRules, profileUpdateRules } = require('../validators/userValidator');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/doctors', userController.getDoctors);
router.get('/me', userController.getProfile);
router.patch('/me', profileUpdateRules, validate, userController.updateProfile);

router.get('/', superAdminOnly, userController.list);
router.get('/:id', superAdminOnly, userController.getOne);
router.post('/', superAdminOnly, createRules, validate, userController.create);
router.put('/:id', superAdminOnly, updateRules, validate, userController.update);
router.delete('/:id', superAdminOnly, userController.remove);

module.exports = router;
