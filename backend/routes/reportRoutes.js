const express = require('express');
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { staffOnly, superAdminOnly, adminOnly } = require('../middleware/rbac');

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/revenue', reportController.revenue);
router.get('/appointment-summary', reportController.appointmentSummary);
router.get('/doctor-performance', superAdminOnly, reportController.doctorPerformance);
router.get('/super-admin-summary', superAdminOnly, reportController.superAdminReport);
router.get('/ai-insights', adminOnly, reportController.aiInsights);
router.get('/detailed', adminOnly, reportController.detailedReport);
router.get('/detailed-pdf', adminOnly, reportController.detailedReportPdf);
router.get('/super-admin-revenue', superAdminOnly, reportController.superAdminRevenue);
router.get('/super-admin-revenue-pdf', superAdminOnly, reportController.superAdminRevenuePdf);
router.get('/download-pdf', reportController.downloadPdf);
router.get('/appointments-pdf', reportController.appointmentsExportPdf);

module.exports = router;
