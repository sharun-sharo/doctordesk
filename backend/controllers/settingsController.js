const fs = require('fs');
const path = require('path');
const { CLINIC_LOGO_DIR } = require('../middleware/upload');
const { pool } = require('../config/database');

const API_PREFIX = process.env.API_PREFIX || '/api/v1';
const CLINIC_NAME = process.env.CLINIC_NAME || 'DoctorDesk';

function getExtFromMime(mime) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[String(mime || '').toLowerCase()] || '.png';
}

function getClinicLogoFilenameFromDisk() {
  if (!fs.existsSync(CLINIC_LOGO_DIR)) return null;
  const files = fs.readdirSync(CLINIC_LOGO_DIR);
  const logo = files.find((f) => f.toLowerCase().startsWith('logo.'));
  return logo || null;
}

async function ensureClinicLogoFileFromDb() {
  if (!fs.existsSync(CLINIC_LOGO_DIR)) {
    fs.mkdirSync(CLINIC_LOGO_DIR, { recursive: true });
  }
  const [rows] = await pool.execute(
    'SELECT logo_data, logo_mime, logo_filename FROM clinic_settings WHERE id = 1 LIMIT 1'
  );
  const row = rows[0];
  if (!row || !row.logo_data) return null;
  const ext = path.extname(row.logo_filename || '') || getExtFromMime(row.logo_mime);
  const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.png';
  const filename = `logo${safeExt}`;
  const fullPath = path.join(CLINIC_LOGO_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, row.logo_data);
  }
  return filename;
}

async function getClinicLogoFilename() {
  const onDisk = getClinicLogoFilenameFromDisk();
  if (onDisk) return onDisk;
  return ensureClinicLogoFileFromDb();
}

async function getClinicLogoPath() {
  const filename = await getClinicLogoFilename();
  return filename ? path.join(CLINIC_LOGO_DIR, filename) : null;
}

async function getClinicBusinessSettings() {
  try {
    const [rows] = await pool.execute('SELECT address, phone, email, gstin FROM clinic_settings WHERE id = 1 LIMIT 1');
    return rows[0] || { address: null, phone: null, email: null, gstin: null };
  } catch (_) {
    return { address: null, phone: null, email: null, gstin: null };
  }
}

/** Create clinic_settings table and default row if missing (e.g. in production). Safe to call repeatedly. */
async function ensureClinicSettingsTable() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS clinic_settings (
      id int unsigned NOT NULL AUTO_INCREMENT,
      address text,
      phone varchar(50) DEFAULT NULL,
      email varchar(255) DEFAULT NULL,
      gstin varchar(50) DEFAULT NULL,
      logo_data longblob,
      logo_mime varchar(100) DEFAULT NULL,
      logo_filename varchar(255) DEFAULT NULL,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [cols] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'clinic_settings'
       AND COLUMN_NAME IN ('logo_data','logo_mime','logo_filename')`
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!names.has('logo_data')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_data LONGBLOB');
  if (!names.has('logo_mime')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_mime VARCHAR(100) DEFAULT NULL');
  if (!names.has('logo_filename')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_filename VARCHAR(255) DEFAULT NULL');
  await pool.execute('INSERT IGNORE INTO clinic_settings (id) VALUES (1)');
}

async function getSettings(req, res, next) {
  try {
    await ensureClinicSettingsTable();
    const filename = getClinicLogoFilename();
    const resolvedFilename = await filename;
    const logoUrl = resolvedFilename ? `${API_PREFIX}/uploads/clinic/${resolvedFilename}` : null;
    const business = await getClinicBusinessSettings();
    res.json({
      success: true,
      data: {
        clinicName: CLINIC_NAME,
        logoUrl,
        invoiceAddress: business.address || '',
        invoicePhone: business.phone || '',
        invoiceEmail: business.email || '',
        invoiceGstin: business.gstin || '',
      },
    });
  } catch (err) {
    next(err);
  }
}

async function uploadLogo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    await ensureClinicSettingsTable();
    const fileBuffer = fs.readFileSync(req.file.path);
    await pool.execute(
      `UPDATE clinic_settings
       SET logo_data = ?, logo_mime = ?, logo_filename = ?
       WHERE id = 1`,
      [fileBuffer, req.file.mimetype || null, req.file.filename || null]
    );
    const filename = await getClinicLogoFilename();
    const logoUrl = filename ? `${API_PREFIX}/uploads/clinic/${filename}` : null;
    res.json({ success: true, data: { logoUrl }, message: 'Logo updated' });
  } catch (err) {
    next(err);
  }
}

async function updateBusinessDetails(req, res, next) {
  try {
    await ensureClinicSettingsTable();
    const { address, phone, email, gstin } = req.body;
    await pool.execute(
      `UPDATE clinic_settings SET address = ?, phone = ?, email = ?, gstin = ? WHERE id = 1`,
      [
        address != null ? String(address).trim() : null,
        phone != null ? String(phone).trim() || null : null,
        email != null ? String(email).trim() || null : null,
        gstin != null ? String(gstin).trim() || null : null,
      ]
    );
    const business = await getClinicBusinessSettings();
    res.json({
      success: true,
      data: {
        invoiceAddress: business.address || '',
        invoicePhone: business.phone || '',
        invoiceEmail: business.email || '',
        invoiceGstin: business.gstin || '',
      },
      message: 'Business details saved',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, uploadLogo, updateBusinessDetails, getClinicLogoPath, getClinicBusinessSettings };
