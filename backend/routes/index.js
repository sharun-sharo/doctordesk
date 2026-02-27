const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const patientRoutes = require('./patientRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const prescriptionRoutes = require('./prescriptionRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const medicineRoutes = require('./medicineRoutes');
const reportRoutes = require('./reportRoutes');
const activityRoutes = require('./activityRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const settingsRoutes = require('./settingsRoutes');
const internalRoutes = require('./internalRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/medicines', medicineRoutes);
router.use('/reports', reportRoutes);
router.use('/activity', activityRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/settings', settingsRoutes);
router.use('/internal', internalRoutes);

module.exports = router;
