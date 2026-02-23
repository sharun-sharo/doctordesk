const { pool } = require('../config/database');

/**
 * Generate next invoice number: INV-YYYYMM-XXXX
 */
async function generateInvoiceNumber() {
  const prefix = 'INV';
  const now = new Date();
  const monthPart = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
  const [rows] = await pool.execute(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${monthPart}-%`]
  );
  const nextSeq = rows.length && rows[0].invoice_number
    ? parseInt(String(rows[0].invoice_number).split('-').pop(), 10) + 1
    : 1;
  return `${prefix}-${monthPart}-${String(nextSeq).padStart(4, '0')}`;
}

module.exports = { generateInvoiceNumber };
