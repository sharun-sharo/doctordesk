const { pool } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { logActivity } = require('../utils/activityLogger');
const PDFDocument = require('pdfkit');
const { ROLES } = require('../config/roles');

async function list(req, res, next) {
  try {
    const { patient_id, payment_status, page = 1, limit = 20 } = req.query;
    const perPage = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const conditions = ['i.deleted_at IS NULL'];
    const params = [];
    if (patient_id) {
      conditions.push('i.patient_id = ?');
      params.push(patient_id);
    }
    if (payment_status) {
      conditions.push('i.payment_status = ?');
      params.push(payment_status);
    }
    const join = (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN)
      ? ' LEFT JOIN appointments a ON i.appointment_id = a.id'
      : '';
    if ((req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN)) {
      conditions.push('(a.id IS NULL OR a.doctor_id = ?)');
      params.push(req.user.id);
    }
    const where = conditions.join(' AND ');
    const allParams = [...params];

    const [rows] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.patient_id, i.total, i.payment_status, i.paid_amount, i.created_at,
        p.name AS patient_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       ${join}
       WHERE ${where}
       ORDER BY i.created_at DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      allParams
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM invoices i ${join} WHERE ${where}`,
      allParams
    );

    res.json({
      success: true,
      data: { invoices: rows, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const [inv] = await pool.execute(
      `SELECT i.*, p.name AS patient_name, p.phone AS patient_phone, p.address AS patient_address
       FROM invoices i JOIN patients p ON i.patient_id = p.id
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!inv.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [items] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [req.params.id]
    );
    const data = { ...inv[0], items };
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { patient_id, appointment_id, items, tax_percent = 0, discount = 0 } = req.body;
    const invoiceNumber = await generateInvoiceNumber();
    let subtotal = 0;
    const itemRows = (items || []).map((it) => {
      const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
      const unitPrice = parseFloat(it.unit_price) || 0;
      const total = qty * unitPrice;
      subtotal += total;
      return {
        item_type: it.item_type || 'other',
        description: it.description || '',
        quantity: qty,
        unit_price: unitPrice,
        total,
        medicine_id: it.medicine_id || null,
      };
    });
    const taxAmount = (subtotal * parseFloat(tax_percent)) / 100;
    const total = Math.max(0, subtotal + taxAmount - parseFloat(discount || 0));

    const [result] = await pool.execute(
      `INSERT INTO invoices (invoice_number, patient_id, appointment_id, subtotal, tax_percent, tax_amount, discount, total, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        invoiceNumber,
        patient_id,
        appointment_id || null,
        subtotal,
        tax_percent,
        taxAmount,
        discount,
        total,
        req.user.id,
      ]
    );
    const invoiceId = result.insertId;
    for (const it of itemRows) {
      await pool.execute(
        `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total, medicine_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invoiceId, it.item_type, it.description, it.quantity, it.unit_price, it.total, it.medicine_id]
      );
    }
    const [rows] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.patient_id, i.total, i.payment_status, i.created_at, p.name AS patient_name
       FROM invoices i JOIN patients p ON i.patient_id = p.id WHERE i.id = ?`,
      [invoiceId]
    );
    await logActivity({
      userId: req.user.id,
      action: 'create',
      entityType: 'invoice',
      entityId: invoiceId,
      newValues: { invoice_number: invoiceNumber, patient_id, total },
      req,
    });
    // When billing is added for an appointment, mark it as completed
    if (appointment_id) {
      await pool.execute(
        `UPDATE appointments SET status = 'completed', updated_at = NOW() WHERE id = ? AND status IN ('scheduled', 'in_progress') AND deleted_at IS NULL`,
        [appointment_id]
      );
    }
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updatePayment(req, res, next) {
  try {
    const id = req.params.id;
    const { paid_amount, payment_status } = req.body;
    const [existing] = await pool.execute(
      'SELECT id, total FROM invoices WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const paid = parseFloat(paid_amount) || 0;
    const total = parseFloat(existing[0].total) || 0;
    const status = payment_status || (paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending');
    await pool.execute(
      'UPDATE invoices SET paid_amount = ?, payment_status = ? WHERE id = ?',
      [paid, status, id]
    );
    const [rows] = await pool.execute(
      'SELECT id, invoice_number, total, paid_amount, payment_status FROM invoices WHERE id = ?',
      [id]
    );
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'invoice', entityId: id, req });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const [inv] = await pool.execute(
      `SELECT i.*, p.name AS patient_name, p.phone AS patient_phone, p.address AS patient_address
       FROM invoices i JOIN patients p ON i.patient_id = p.id
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!inv.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [items] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [req.params.id]
    );
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${inv[0].invoice_number}.pdf`
    );
    doc.pipe(res);
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Invoice #: ${inv[0].invoice_number}`);
    doc.text(`Date: ${new Date(inv[0].created_at).toLocaleDateString()}`);
    doc.text(`Patient: ${inv[0].patient_name}`);
    doc.text(`Phone: ${inv[0].patient_phone || '-'}`);
    doc.moveDown();
    doc.text('Items:', { underline: true });
    items.forEach((it) => {
      doc.text(
        `${it.description} x ${it.quantity} @ ${it.unit_price} = ${parseFloat(it.total).toFixed(2)}`
      );
    });
    doc.moveDown();
    doc.text(`Subtotal: ${parseFloat(inv[0].subtotal).toFixed(2)}`);
    doc.text(`Tax: ${parseFloat(inv[0].tax_amount).toFixed(2)}`);
    doc.text(`Discount: ${parseFloat(inv[0].discount).toFixed(2)}`);
    doc.text(`Total: ${parseFloat(inv[0].total).toFixed(2)}`);
    doc.text(`Payment Status: ${inv[0].payment_status}`);
    doc.end();
  } catch (err) {
    next(err);
  }
}

async function destroy(req, res, next) {
  try {
    const { id } = req.params;
    const [existing] = await pool.execute(
      'SELECT id FROM invoices WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    await pool.execute('UPDATE invoices SET deleted_at = NOW() WHERE id = ?', [id]);
    await logActivity({ userId: req.user.id, action: 'delete', entityType: 'invoice', entityId: id, req });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, updatePayment, downloadPdf, destroy };
