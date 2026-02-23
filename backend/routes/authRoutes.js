const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  loginRules,
  refreshRules,
  forgotPasswordRules,
  resetPasswordRules,
} = require('../validators/authValidator');

const router = express.Router();

router.post('/login', loginRules, validate, authController.login);
router.post('/refresh', refreshRules, validate, authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', forgotPasswordRules, validate, authController.forgotPassword);
router.post('/reset-password', resetPasswordRules, validate, authController.resetPassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
