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

function getClinicLogoFilenameFromDisk(prefix = 'logo.') {
  if (!fs.existsSync(CLINIC_LOGO_DIR)) return null;
  const files = fs.readdirSync(CLINIC_LOGO_DIR);
  const normalizedPrefix = String(prefix || 'logo.').toLowerCase();
  const logo = files.find((f) => f.toLowerCase().startsWith(normalizedPrefix));
  return logo || null;
}

async function ensureClinicLogoFileFromDb(userId = null) {
  if (!fs.existsSync(CLINIC_LOGO_DIR)) {
    fs.mkdirSync(CLINIC_LOGO_DIR, { recursive: true });
  }
  const [rows] = userId
    ? await pool.execute(
      `SELECT logo_data, logo_mime, logo_filename
       FROM clinic_settings
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [userId]
    )
    : await pool.execute(
      `SELECT logo_data, logo_mime, logo_filename
       FROM clinic_settings
       WHERE user_id IS NULL
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`
    );
  const row = rows[0];
  if (!row || !row.logo_data) return null;
  const ext = path.extname(row.logo_filename || '') || getExtFromMime(row.logo_mime);
  const safeExt = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext.toLowerCase()) ? ext.toLowerCase() : '.png';
  const filename = userId != null ? `logo-user-${userId}${safeExt}` : `logo${safeExt}`;
  const fullPath = path.join(CLINIC_LOGO_DIR, filename);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, row.logo_data);
  }
  return filename;
}

async function getClinicLogoFilename(userId = null) {
  const onDisk = userId != null
    ? getClinicLogoFilenameFromDisk(`logo-user-${userId}.`)
    : getClinicLogoFilenameFromDisk();
  if (onDisk) return onDisk;
  return ensureClinicLogoFileFromDb(userId);
}

async function getClinicLogoPath(userId = null) {
  const filename = await getClinicLogoFilename(userId);
  return filename ? path.join(CLINIC_LOGO_DIR, filename) : null;
}

async function getClinicBusinessSettings(userId = null) {
  try {
    const [rows] = userId
      ? await pool.execute(
        `SELECT address, phone, email, gstin
         FROM clinic_settings
         WHERE user_id = ?
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`,
        [userId]
      )
      : await pool.execute(
        `SELECT address, phone, email, gstin
         FROM clinic_settings
         WHERE user_id IS NULL
         ORDER BY updated_at DESC, id DESC
         LIMIT 1`
      );
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
      user_id int unsigned DEFAULT NULL,
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
       AND COLUMN_NAME IN ('user_id','logo_data','logo_mime','logo_filename')`
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (!names.has('user_id')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN user_id INT UNSIGNED DEFAULT NULL');
  if (!names.has('logo_data')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_data LONGBLOB');
  if (!names.has('logo_mime')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_mime VARCHAR(100) DEFAULT NULL');
  if (!names.has('logo_filename')) await pool.execute('ALTER TABLE clinic_settings ADD COLUMN logo_filename VARCHAR(255) DEFAULT NULL');
  const [idxRows] = await pool.execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'clinic_settings'
       AND INDEX_NAME = 'uniq_clinic_settings_user_id'
     LIMIT 1`
  );
  if (!idxRows.length) {
    await pool.execute('CREATE UNIQUE INDEX uniq_clinic_settings_user_id ON clinic_settings (user_id)');
  }
  await pool.execute('INSERT IGNORE INTO clinic_settings (id) VALUES (1)');
}

async function getSettings(req, res, next) {
  try {
    await ensureClinicSettingsTable();
    const resolvedFilename = await getClinicLogoFilename(req.user?.id || null);
    const logoUrl = resolvedFilename ? `${API_PREFIX}/uploads/clinic/${resolvedFilename}` : null;
    const business = await getClinicBusinessSettings(req.user?.id || null);
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
    const [updateResult] = await pool.execute(
      `UPDATE clinic_settings
       SET logo_data = ?, logo_mime = ?, logo_filename = ?
       WHERE user_id = ?`,
      [fileBuffer, req.file.mimetype || null, req.file.filename || null, req.user.id]
    );
    if (!updateResult.affectedRows) {
      await pool.execute(
        `INSERT INTO clinic_settings (user_id, logo_data, logo_mime, logo_filename)
         VALUES (?, ?, ?, ?)`,
        [req.user.id, fileBuffer, req.file.mimetype || null, req.file.filename || null]
      );
    }
    const filename = await getClinicLogoFilename(req.user.id);
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
    const [updateResult] = await pool.execute(
      `UPDATE clinic_settings SET address = ?, phone = ?, email = ?, gstin = ? WHERE user_id = ?`,
      [
        address != null ? String(address).trim() : null,
        phone != null ? String(phone).trim() || null : null,
        email != null ? String(email).trim() || null : null,
        gstin != null ? String(gstin).trim() || null : null,
        req.user.id,
      ]
    );
    if (!updateResult.affectedRows) {
      await pool.execute(
        `INSERT INTO clinic_settings (user_id, address, phone, email, gstin)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.user.id,
          address != null ? String(address).trim() : null,
          phone != null ? String(phone).trim() || null : null,
          email != null ? String(email).trim() || null : null,
          gstin != null ? String(gstin).trim() || null : null,
        ]
      );
    }
    const business = await getClinicBusinessSettings(req.user.id);
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
