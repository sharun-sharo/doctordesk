const { pool } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { logActivity } = require('../utils/activityLogger');
const PDFDocument = require('pdfkit');
const { ROLES } = require('../config/roles');
const { getClinicLogoPath, getClinicBusinessSettings } = require('./settingsController');
const { resolveDoctorIdForBooking } = require('../utils/resolveDoctorId');
const { renderInvoicePdf, PDF_MARGIN, PDF_MARGIN_TOP } = require('../utils/renderInvoicePdf');
let invoiceSchemaEnsured = false;

async function ensureInvoiceSchema() {
  if (invoiceSchemaEnsured) return;
  const [cols] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'
       AND COLUMN_NAME IN ('paid_amount', 'doctor_id')`
  );
  const names = new Set((cols || []).map((c) => c.COLUMN_NAME));
  if (!names.has('paid_amount')) {
    await pool.execute('ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0.00');
  }
  if (!names.has('doctor_id')) {
    await pool.execute(
      'ALTER TABLE invoices ADD COLUMN doctor_id int unsigned DEFAULT NULL AFTER appointment_id'
    );
    await pool.execute(
      'ALTER TABLE invoices ADD KEY idx_inv_doctor (doctor_id), ADD CONSTRAINT fk_invoice_doctor FOREIGN KEY (doctor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE'
    ).catch(() => {});
  }
  invoiceSchemaEnsured = true;
}

async function adminCanAccessDoctor(adminId, doctorId) {
  if (doctorId == null) return false;
  if (Number(doctorId) === Number(adminId)) return true;
  const [team] = await pool.execute(
    'SELECT 1 FROM users WHERE id = ? AND assigned_admin_id = ? AND deleted_at IS NULL LIMIT 1',
    [doctorId, adminId]
  );
  return team.length > 0;
}

/** Returns true if the user can access the given invoice (by id). assignedAdminId fallback when receptionist_doctors is empty. */
async function canAccessInvoice(invoiceId, roleId, userId, assignedAdminId = null) {
  const [rows] = await pool.execute(
    `SELECT i.id, i.appointment_id, i.created_by, i.doctor_id AS invoice_doctor_id,
            a.doctor_id AS appointment_doctor_id
     FROM invoices i
     LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL
     WHERE i.id = ? AND i.deleted_at IS NULL`,
    [invoiceId]
  );
  if (!rows || !rows.length) return false;
  const r = rows[0];
  const billingDoctorId = r.appointment_doctor_id ?? r.invoice_doctor_id;
  if (roleId === ROLES.SUPER_ADMIN) return true;
  if (roleId === ROLES.DOCTOR) {
    if (billingDoctorId == null) return r.created_by === userId;
    return Number(billingDoctorId) === Number(userId);
  }
  if (roleId === ROLES.ADMIN) {
    if (billingDoctorId == null) return r.created_by === userId;
    return adminCanAccessDoctor(userId, billingDoctorId);
  }
  if (roleId === ROLES.RECEPTIONIST || roleId === ROLES.ASSISTANT_DOCTOR) {
    if (billingDoctorId == null) return r.created_by === userId;
    const [assigned] = await pool.execute(
      'SELECT 1 FROM receptionist_doctors WHERE receptionist_id = ? AND doctor_id = ? LIMIT 1',
      [userId, billingDoctorId]
    );
    return (assigned && assigned.length) > 0 || (assignedAdminId != null && Number(billingDoctorId) === Number(assignedAdminId));
  }
  return false;
}

async function list(req, res, next) {
  try {
    await ensureInvoiceSchema();
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
    let join = ' LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL';
    if (req.user.roleId === ROLES.DOCTOR) {
      conditions.push('(COALESCE(a.doctor_id, i.doctor_id) = ? OR (i.appointment_id IS NULL AND i.doctor_id IS NULL AND i.created_by = ?))');
      params.push(req.user.id, req.user.id);
    } else if (req.user.roleId === ROLES.ADMIN) {
      conditions.push(
        `(COALESCE(a.doctor_id, i.doctor_id) = ? OR COALESCE(a.doctor_id, i.doctor_id) IN (SELECT id FROM users WHERE assigned_admin_id = ? AND deleted_at IS NULL) OR (i.appointment_id IS NULL AND i.doctor_id IS NULL AND i.created_by = ?))`
      );
      params.push(req.user.id, req.user.id, req.user.id);
    } else if (req.user.roleId === ROLES.RECEPTIONIST || req.user.roleId === ROLES.ASSISTANT_DOCTOR) {
      conditions.push(
        `(i.appointment_id IS NULL AND (i.created_by = ? OR COALESCE(i.doctor_id, 0) IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (i.doctor_id = ? AND ? IS NOT NULL))) OR (a.id IS NOT NULL AND (a.doctor_id IN (SELECT doctor_id FROM receptionist_doctors WHERE receptionist_id = ?) OR (a.doctor_id = ? AND ? IS NOT NULL)))`
      );
      params.push(
        req.user.id,
        req.user.id,
        req.user.assignedAdminId,
        req.user.assignedAdminId,
        req.user.id,
        req.user.assignedAdminId,
        req.user.assignedAdminId
      );
    }
    const where = conditions.join(' AND ');
    const allParams = [...params];

    const [rows] = await pool.execute(
      `SELECT i.id, i.invoice_number, i.patient_id, i.total, i.payment_status, i.paid_amount, i.created_at,
        p.name AS patient_name, doc.name AS doctor_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       ${join}
       LEFT JOIN users doc ON doc.id = COALESCE(i.doctor_id, a.doctor_id) AND doc.deleted_at IS NULL
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
    await ensureInvoiceSchema();
    const [inv] = await pool.execute(
      `SELECT i.*, p.name AS patient_name, p.phone AS patient_phone, p.address AS patient_address,
              p.gender AS patient_gender, p.date_of_birth AS patient_dob,
              doc.name AS doctor_name, doc.phone AS doctor_phone,
              a.appointment_date, a.start_time
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       LEFT JOIN appointments a ON i.appointment_id = a.id AND a.deleted_at IS NULL
       LEFT JOIN users doc ON doc.id = COALESCE(i.doctor_id, a.doctor_id) AND doc.deleted_at IS NULL
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!inv.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const allowed = await canAccessInvoice(Number(req.params.id), req.user.roleId, req.user.id, req.user.assignedAdminId);
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
    await ensureInvoiceSchema();
    const { patient_id, appointment_id, doctor_id: bodyDoctorId, items, tax_percent = 0, discount = 0 } = req.body;
    let doctor_id = await resolveDoctorIdForBooking(req, bodyDoctorId);
    if (appointment_id) {
      const [appt] = await pool.execute(
        'SELECT doctor_id FROM appointments WHERE id = ? AND deleted_at IS NULL',
        [appointment_id]
      );
      if (appt.length && appt[0].doctor_id) doctor_id = appt[0].doctor_id;
    }
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
      `INSERT INTO invoices (invoice_number, patient_id, appointment_id, doctor_id, subtotal, tax_percent, tax_amount, discount, total, payment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        invoiceNumber,
        patient_id,
        appointment_id || null,
        doctor_id || null,
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
      `SELECT i.id, i.invoice_number, i.patient_id, i.total, i.payment_status, i.created_at, p.name AS patient_name,
              doc.name AS doctor_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       LEFT JOIN users doc ON doc.id = i.doctor_id AND doc.deleted_at IS NULL
       WHERE i.id = ?`,
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

async function updateDate(req, res, next) {
  try {
    await ensureInvoiceSchema();
    const id = req.params.id;
    const { invoice_date } = req.body;
    const allowed = await canAccessInvoice(Number(id), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [existing] = await pool.execute(
      'SELECT id, created_at FROM invoices WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const prev = existing[0].created_at ? new Date(existing[0].created_at) : new Date();
    const [y, m, d] = invoice_date.split('-').map(Number);
    const updated = new Date(prev);
    updated.setFullYear(y, m - 1, d);
    await pool.execute('UPDATE invoices SET created_at = ? WHERE id = ?', [updated, id]);
    const [rows] = await pool.execute(
      'SELECT id, invoice_number, created_at FROM invoices WHERE id = ?',
      [id]
    );
    await logActivity({ userId: req.user.id, action: 'update', entityType: 'invoice', entityId: id, req });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updatePayment(req, res, next) {
  try {
    await ensureInvoiceSchema();
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
    await ensureInvoiceSchema();
    const [inv] = await pool.execute(
      `SELECT i.*, p.name AS patient_name, p.phone AS patient_phone, p.address AS patient_address, p.date_of_birth AS patient_dob, p.gender AS patient_gender,
              a.appointment_date, a.start_time, u.name AS doctor_name, u.phone AS doctor_phone,
              creator.name AS creator_name, creator.phone AS creator_phone
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       LEFT JOIN appointments a ON i.appointment_id = a.id
       LEFT JOIN users u ON u.id = COALESCE(i.doctor_id, a.doctor_id) AND u.deleted_at IS NULL
       LEFT JOIN users creator ON i.created_by = creator.id
       WHERE i.id = ? AND i.deleted_at IS NULL`,
      [req.params.id]
    );
    if (!inv.length) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const allowed = await canAccessInvoice(Number(req.params.id), req.user.roleId, req.user.id, req.user.assignedAdminId);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }
    const [items] = await pool.execute(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id',
      [req.params.id]
    );
    const data = inv[0];
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PDF_MARGIN_TOP, bottom: PDF_MARGIN, left: PDF_MARGIN, right: PDF_MARGIN },
      bufferPages: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${data.invoice_number}.pdf`
    );
    doc.pipe(res);

    const business = await getClinicBusinessSettings(req.user?.id || null);
    const logoPath = await getClinicLogoPath(req.user?.id || null);
    await renderInvoicePdf(doc, {
      data,
      items,
      business,
      logoPath,
      clinicName: process.env.CLINIC_NAME || 'DoctorDesk',
    });

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
    const allowed = await canAccessInvoice(Number(id), req.user.roleId, req.user.id, req.user.assignedAdminId);
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

module.exports = { list, getOne, create, updateDate, updatePayment, downloadPdf, destroy };
