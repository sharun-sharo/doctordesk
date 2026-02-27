const { pool } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { logActivity } = require('../utils/activityLogger');
const PDFDocument = require('pdfkit');
const { ROLES } = require('../config/roles');
const { getClinicLogoPath, getClinicBusinessSettings } = require('./settingsController');

/** Returns true if the user can access the given invoice (by id). */
async function canAccessInvoice(invoiceId, roleId, userId) {
  const [rows] = await pool.execute(
    `SELECT i.id, i.appointment_id, i.created_by, a.doctor_id AS appointment_doctor_id
     FROM invoices i
     LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL
     WHERE i.id = ? AND i.deleted_at IS NULL`,
    [invoiceId]
  );
  if (!rows || !rows.length) return false;
  const r = rows[0];
  if (roleId === ROLES.SUPER_ADMIN) return true;
  if (roleId === ROLES.DOCTOR || roleId === ROLES.ADMIN) {
    return r.appointment_id == null || r.appointment_doctor_id === userId;
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    if (r.appointment_id == null) return r.created_by === userId;
    const [assigned] = await pool.execute(
      'SELECT 1 FROM receptionist_doctors WHERE receptionist_id = ? AND doctor_id = ? LIMIT 1',
      [userId, r.appointment_doctor_id]
    );
    return (assigned && assigned.length) > 0;
  }
  return false;
}

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
    let join = '';
    if (req.user.roleId === ROLES.DOCTOR || req.user.roleId === ROLES.ADMIN) {
      join = ' LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL';
      conditions.push('(a.id IS NULL OR a.doctor_id = ?)');
      params.push(req.user.id);
    } else if (req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) {
      join = ' LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL';
      conditions.push('(i.appointment_id IS NULL AND i.created_by = ?) OR (a.id IS NOT NULL AND a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?))');
      params.push(req.user.id, req.user.id);
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
    const allowed = await canAccessInvoice(Number(req.params.id), req.user.roleId, req.user.id);
    if (!allowed) {
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

// A4: 595.28 x 841.89 pt. Margins 50; content width 495.
const PDF_MARGIN = 50;
const PDF_WIDTH = 595.28;
const PDF_CONTENT = PDF_WIDTH - PDF_MARGIN * 2;
const CLINIC_NAME = process.env.CLINIC_NAME || 'DoctorDesk';
// Use "Rs." instead of "₹" so PDF renders correctly in all viewers (Helvetica has no rupee glyph).
const CURRENCY = 'Rs. ';

function formatTime(t) {
  if (!t) return '';
  const s = String(t);
  const [h, m] = s.split(':').map(Number);
  if (h == null) return s;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return m != null ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

async function downloadPdf(req, res, next) {
  try {
    const [inv] = await pool.execute(
      `SELECT i.*, p.name AS patient_name, p.phone AS patient_phone, p.address AS patient_address,
              a.appointment_date, a.start_time, u.name AS doctor_name, u.phone AS doctor_phone,
              creator.name AS creator_name, creator.phone AS creator_phone
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       LEFT JOIN appointments a ON i.appointment_id = a.id
       LEFT JOIN users u ON a.doctor_id = u.id
       LEFT JOIN users creator ON i.created_by = creator.id
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!inv.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const allowed = await canAccessInvoice(Number(req.params.id), req.user.roleId, req.user.id);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [items] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [req.params.id]
    );
    const data = inv[0];
    const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${data.invoice_number}.pdf`
    );
    doc.pipe(res);

    let y = PDF_MARGIN;
    const left = PDF_MARGIN;
    const right = PDF_WIDTH - PDF_MARGIN;

    // ----- Header: logo (if uploaded) or clinic name & tagline -----
    const logoPath = getClinicLogoPath();
    const logoWidth = 140;
    const logoMaxHeight = 44;
    if (logoPath) {
      try {
        doc.image(logoPath, left, y, { width: logoWidth, height: logoMaxHeight, fit: [logoWidth, logoMaxHeight] });
        y += logoMaxHeight + 8;
      } catch (_) {
        doc.fontSize(18).fillColor('#0f766e').text(CLINIC_NAME, left, y);
        y += 22;
      }
    } else {
      doc.fontSize(18).fillColor('#0f766e').text(CLINIC_NAME, left, y);
      y += 22;
    }
    doc.fontSize(9).fillColor('#64748b').text('Medical Invoice', left, y);
    y += 14;
    const business = await getClinicBusinessSettings();
    const hasBusiness = business.address || business.phone || business.email || business.gstin;
    if (hasBusiness) {
      const lines = [];
      if (business.address) lines.push(business.address);
      const contact = [business.phone, business.email].filter(Boolean).join(' · ');
      if (contact) lines.push(contact);
      if (business.gstin) lines.push(`GSTIN: ${business.gstin}`);
      doc.fontSize(8).fillColor('#64748b');
      lines.forEach((line) => {
        doc.text(line, left, y, { width: PDF_CONTENT * 0.6 });
        y += 12;
      });
      y += 6;
    }
    doc.moveTo(left, y).lineTo(right, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    y += 16;

    // ----- Invoice # and Date (right) -----
    doc.fontSize(10).fillColor('#1e293b');
    doc.text(`Invoice #: ${data.invoice_number}`, left, y, { width: PDF_CONTENT, align: 'right' });
    y += 14;
    doc.text(`Date: ${new Date(data.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, left, y, { width: PDF_CONTENT, align: 'right' });
    y += 24;

    // ----- Two columns: Doctor Details | Patient Details -----
    const col1End = left + PDF_CONTENT / 2 - 10;
    const col2Start = left + PDF_CONTENT / 2 + 10;
    doc.fontSize(9).fillColor('#64748b').text('Doctor Details', left, y);
    doc.text('Patient Details', col2Start, y);
    y += 16;
    const doctorName = data.doctor_name || data.creator_name || '—';
    const doctorPhone = data.doctor_phone || data.creator_phone || '';
    doc.fontSize(10).fillColor('#1e293b');
    doc.text(doctorName, left, y);
    doc.text(data.patient_name || '—', col2Start, y);
    y += 14;
    doc.fontSize(9).fillColor('#475569');
    doc.text(doctorPhone ? `Phone: ${doctorPhone}` : '—', left, y);
    doc.text(data.patient_phone ? `Phone: ${data.patient_phone}` : '—', col2Start, y);
    y += 14;
    if (data.patient_address) {
      doc.text(`Address: ${data.patient_address}`, col2Start, y, { width: PDF_CONTENT / 2 - 20 });
      y += 14;
    }
    y += 12;

    // ----- Appointment information -----
    if (data.appointment_date || data.start_time) {
      doc.fontSize(9).fillColor('#64748b').text('Appointment', left, y);
      y += 14;
      doc.fontSize(10).fillColor('#1e293b');
      const apptDate = data.appointment_date ? new Date(data.appointment_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const apptTime = formatTime(data.start_time);
      doc.text([apptDate, apptTime].filter(Boolean).join(' · '), left, y);
      y += 20;
    } else {
      y += 8;
    }

    // ----- Billing table -----
    const tableTop = y;
    const colW = [260, 50, 85, 100]; // Description, Qty, Unit Price, Amount
    const tableLeft = left;
    const rowHeight = 20;
    const headerH = 24;

    doc.fontSize(9).fillColor('#64748b');
    doc.rect(tableLeft, tableTop, PDF_CONTENT, headerH).fillAndStroke('#f1f5f9', '#e2e8f0');
    doc.fillColor('#1e293b').text('Description', tableLeft + 8, tableTop + 6, { width: colW[0] - 16 });
    doc.text('Qty', tableLeft + colW[0], tableTop + 6, { width: colW[1], align: 'right' });
    doc.text('Unit Price', tableLeft + colW[0] + colW[1], tableTop + 6, { width: colW[2], align: 'right' });
    doc.text('Amount', tableLeft + colW[0] + colW[1] + colW[2], tableTop + 6, { width: colW[3], align: 'right' });
    y = tableTop + headerH;

    doc.fillColor('#1e293b').fontSize(10);
    (items || []).forEach((it) => {
      doc.rect(tableLeft, y, PDF_CONTENT, rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fillColor('#1e293b').text(String(it.description || '').slice(0, 50), tableLeft + 8, y + 5, { width: colW[0] - 16 });
      doc.text(String(it.quantity), tableLeft + colW[0], y + 5, { width: colW[1], align: 'right' });
      doc.text(`${CURRENCY}${Number(it.unit_price).toFixed(2)}`, tableLeft + colW[0] + colW[1], y + 5, { width: colW[2], align: 'right' });
      doc.text(`${CURRENCY}${Number(it.total).toFixed(2)}`, tableLeft + colW[0] + colW[1] + colW[2], y + 5, { width: colW[3], align: 'right' });
      y += rowHeight;
    });
    doc.rect(tableLeft, y, PDF_CONTENT, rowHeight).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += rowHeight + 20;

    // ----- Totals (right-aligned) -----
    const totLeft = right - 180;
    const totLabelW = 100;
    const totValW = 80;
    doc.fontSize(10).fillColor('#475569');
    doc.text('Subtotal', totLeft, y, { width: totLabelW });
    doc.text(`${CURRENCY}${Number(data.subtotal).toFixed(2)}`, totLeft + totLabelW, y, { width: totValW, align: 'right' });
    y += 16;
    doc.text('Tax', totLeft, y, { width: totLabelW });
    doc.text(`${CURRENCY}${Number(data.tax_amount).toFixed(2)}`, totLeft + totLabelW, y, { width: totValW, align: 'right' });
    y += 16;
    doc.text('Discount', totLeft, y, { width: totLabelW });
    doc.text(`-${CURRENCY}${Number(data.discount).toFixed(2)}`, totLeft + totLabelW, y, { width: totValW, align: 'right' });
    y += 20;
    doc.fontSize(12).fillColor('#0f766e').font('Helvetica-Bold');
    doc.text('Total', totLeft, y, { width: totLabelW });
    doc.text(`${CURRENCY}${Number(data.total).toFixed(2)}`, totLeft + totLabelW, y, { width: totValW, align: 'right' });
    doc.font('Helvetica');
    y += 28;

    // ----- Payment details -----
    doc.fontSize(9).fillColor('#64748b').text('Payment Details', left, y);
    y += 14;
    doc.fontSize(10).fillColor('#1e293b');
    doc.text(`Status: ${String(data.payment_status).charAt(0).toUpperCase() + String(data.payment_status).slice(1)}`, left, y);
    y += 14;
    doc.text(`Paid: ${CURRENCY}${Number(data.paid_amount || 0).toFixed(2)}`, left, y);
    const balance = Math.max(0, Number(data.total) - Number(data.paid_amount || 0));
    doc.text(`Balance: ${CURRENCY}${balance.toFixed(2)}`, left, y + 14);
    y += 40;

    // ----- Footer with terms -----
    const footerY = 841.89 - PDF_MARGIN - 44;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor('#94a3b8').text(
      'Payment is due within 15 days. Thank you for choosing our clinic. For queries contact the clinic.',
      left,
      footerY + 10,
      { width: PDF_CONTENT, align: 'center' }
    );
    doc.text(`Generated by ${CLINIC_NAME}`, left, footerY + 24, { width: PDF_CONTENT, align: 'center' });

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
    const allowed = await canAccessInvoice(Number(id), req.user.roleId, req.user.id);
    if (!allowed) {
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
