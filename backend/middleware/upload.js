const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'prescriptions');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    cb(null, `${uuidv4()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, true),
});

module.exports = {
  singlePrescriptionAttachment: upload.single('attachment'),
  arrayPrescriptionAttachments: upload.array('attachments', 10),
  UPLOAD_DIR,
};
