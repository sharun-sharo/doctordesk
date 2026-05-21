const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'prescriptions');
const CLINIC_LOGO_DIR = path.join(process.cwd(), 'uploads', 'clinic');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(CLINIC_LOGO_DIR)) {
  fs.mkdirSync(CLINIC_LOGO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    cb(null, `${uuidv4()}-${base}${ext}`);
  },
});

const CLINIC_IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif']);

function clinicImageExt(file) {
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  if (CLINIC_IMAGE_EXT.has(ext)) return ext;
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('heic') || mime.includes('heif')) return '.heic';
  return '.jpg';
}

function clinicImageFileFilter(_req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = (path.extname(file.originalname) || '').toLowerCase();
  const okMime = !mime || mime.startsWith('image/') || mime === 'application/octet-stream';
  const okExt = !ext || CLINIC_IMAGE_EXT.has(ext);
  if (okMime && okExt) return cb(null, true);
  cb(new Error('Please upload an image file (JPG, PNG, WebP, or GIF).'));
}

const clinicLogoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CLINIC_LOGO_DIR),
  filename: (req, file, cb) => {
    const safe = clinicImageExt(file);
    const uid = req.user?.id;
    const name = uid != null ? `logo-user-${uid}${safe}` : `logo${safe}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, true),
});

const clinicLogoMulter = multer({
  storage: clinicLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: clinicImageFileFilter,
});

/** Multer middleware with clear errors for mobile uploads (size, type). */
function clinicLogoUpload(req, res, next) {
  clinicLogoMulter.single('logo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Image is too large. Maximum size is 5 MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message || 'Invalid image upload',
    });
  });
}

const memoryStorage = multer.memoryStorage();
const csvUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    cb(null, !!ok);
  },
});

module.exports = {
  singlePrescriptionAttachment: upload.single('attachment'),
  arrayPrescriptionAttachments: upload.array('attachments', 10),
  clinicLogoUpload,
  csvUpload: csvUpload.single('file'),
  UPLOAD_DIR,
  CLINIC_LOGO_DIR,
};
