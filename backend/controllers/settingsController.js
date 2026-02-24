const fs = require('fs');
const path = require('path');
const { CLINIC_LOGO_DIR } = require('../middleware/upload');

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

async function getSettings(req, res, next) {
  try {
    const filename = getClinicLogoFilename();
    const logoUrl = filename ? `${API_PREFIX}/uploads/clinic/${filename}` : null;
    res.json({
      success: true,
      data: { clinicName: CLINIC_NAME, logoUrl },
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

module.exports = { getSettings, uploadLogo, getClinicLogoPath };
