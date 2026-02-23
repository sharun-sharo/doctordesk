const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const { authenticate } = require('../middleware/auth');
const { staffOnly } = require('../middleware/rbac');
const { arrayPrescriptionAttachments } = require('../middleware/upload');

const optionalAttachments = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    arrayPrescriptionAttachments(req, res, (err) => (err ? next(err) : next()));
  } else {
    next();
  }
};

const router = express.Router();
router.use(authenticate);
router.use(staffOnly);

router.get('/', prescriptionController.list);
router.get('/:id', prescriptionController.getOne);
router.get('/:id/attachment', prescriptionController.getAttachment);
router.get('/:id/attachments/:attachmentId', prescriptionController.getAttachment);
router.delete('/:id/attachments/:attachmentId', prescriptionController.deleteAttachment);
router.post('/', optionalAttachments, prescriptionController.create);
router.put('/:id', optionalAttachments, prescriptionController.update);

module.exports = router;
