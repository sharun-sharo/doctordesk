const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/stats', dashboardController.getStats);
router.get('/metrics', dashboardController.getMetrics);
router.get('/revenue-chart', dashboardController.getRevenueChart);
router.get('/patient-chart', dashboardController.getPatientChart);
router.get('/weekly-patient-trend', dashboardController.getWeeklyPatientTrend);
router.get('/daily-appointment-distribution', dashboardController.getDailyAppointmentDistribution);
router.get('/new-vs-returning-chart', dashboardController.getNewVsReturningChart);

module.exports = router;
