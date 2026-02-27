const fs = require('fs');
const path = require('path');
const { CLINIC_LOGO_DIR } = require('../middleware/upload');
const { pool } = require('../config/database');

const API_PREFIX = process.env.API_PREFIX || '/api/v1';
const CLINIC_NAME = process.env.CLINIC_NAME || 'DoctorDesk';

function getClinicLogoFilename() {
  if (!fs.existsSync(CLINIC_LOGO_DIR)) return null;
  const files = fs.readdirSync(CLINIC_LOGO_DIR);
  const logo = files.find((f) => f.toLowerCase().startsWith('logo.'));
  return logo || null;
}

function getClinicLogoPath() {
  const filename = getClinicLogoFilename();
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

async function getSettings(req, res, next) {
  try {
    const filename = getClinicLogoFilename();
    const logoUrl = filename ? `${API_PREFIX}/uploads/clinic/${filename}` : null;
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
    const filename = getClinicLogoFilename();
    const logoUrl = filename ? `${API_PREFIX}/uploads/clinic/${filename}` : null;
    res.json({ success: true, data: { logoUrl }, message: 'Logo updated' });
  } catch (err) {
    next(err);
  }
}

async function updateBusinessDetails(req, res, next) {
  try {
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
