#!/usr/bin/env node
/**
 * Generates a sample invoice PDF for preview (no database required).
 * Run: node backend/scripts/generate-sample-invoice-pdf.js
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { renderInvoicePdf, PDF_MARGIN, PDF_MARGIN_TOP } = require('../utils/renderInvoicePdf');

const outPath = path.resolve(__dirname, '../../frontend/public/sample-invoice.pdf');

const mockData = {
  invoice_number: 'INV-202605-SAMPLE',
  created_at: new Date().toISOString(),
  appointment_date: new Date().toISOString().slice(0, 10),
  start_time: '20:17:00',
  patient_name: 'ANBU SELVI M',
  patient_phone: '9551100559',
  patient_gender: 'female',
  patient_dob: '1991-05-15',
  patient_address: null,
  doctor_name: 'Dr. M K Ameer Ali Sha BDS',
  doctor_phone: '8682853988',
  subtotal: 200,
  tax_percent: 0,
  tax_amount: 0,
  discount: 0,
  total: 200,
  paid_amount: 200,
  payment_status: 'paid',
};

const mockItems = [
  {
    id: 1,
    description: 'Consultation',
    quantity: 1,
    unit_price: 200,
    total: 200,
  },
];

const mockBusiness = {
  address: 'Plot no 04, Metro grand city main road, Metha nagar, Kundrathur, Chennai-600069',
  phone: '8682853988',
  email: 'alhamdentalcare@gmail.com',
  gstin: '',
};

function findSampleLogoPath() {
  if (process.env.LOGO_PATH && fs.existsSync(process.env.LOGO_PATH)) {
    return process.env.LOGO_PATH;
  }
  const logoDir = path.resolve(__dirname, '../uploads/clinic');
  if (!fs.existsSync(logoDir)) return null;
  const file = fs
    .readdirSync(logoDir)
    .find((name) => /\.(png|jpe?g|webp)$/i.test(name));
  return file ? path.join(logoDir, file) : null;
}

async function main() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PDF_MARGIN_TOP, bottom: PDF_MARGIN, left: PDF_MARGIN, right: PDF_MARGIN },
    bufferPages: true,
  });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const logoPath = findSampleLogoPath();
  await renderInvoicePdf(doc, {
    data: mockData,
    items: mockItems,
    business: mockBusiness,
    headerPath: logoPath,
    clinicName: 'ALHAM DENTAL CARE',
  });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  console.log('Sample PDF written to:', outPath);
  console.log(logoPath ? `Logo: ${logoPath}` : 'Logo: none (upload in Settings or set LOGO_PATH)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
