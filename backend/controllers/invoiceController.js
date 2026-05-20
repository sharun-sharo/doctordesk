const { pool } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { logActivity } = require('../utils/activityLogger');
const PDFDocument = require('pdfkit');
const { ROLES } = require('../config/roles');
const { getClinicLogoPath, getClinicBusinessSettings } = require('./settingsController');
const { resolveDoctorIdForBooking } = require('../utils/resolveDoctorId');
const { amountInWords } = require('../utils/amountInWords');
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
              doc.name AS doctor_name
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

// A4: 595.28 x 841.89 pt. Margins 50; content width 495.
const PDF_MARGIN = 48;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const PDF_CONTENT = PDF_WIDTH - PDF_MARGIN * 2;
const CLINIC_NAME = process.env.CLINIC_NAME || 'DoctorDesk';
// Use "Rs." instead of "₹" so PDF renders correctly in all viewers (Helvetica has no rupee glyph).
const CURRENCY = 'Rs. ';

/** Invoice PDF design tokens — optimized for print and on-screen viewing. */
const PDF_THEME = {
  primary: '#1a2b4a',
  body: '#2d3748',
  secondary: '#64748b',
  muted: '#94a3b8',
  accent: '#0d9488',
  accentSoft: '#e6f7f5',
  border: '#e2e8f0',
  surface: '#f8fafc',
  paid: '#047857',
  pending: '#b45309',
  white: '#ffffff',
};

const PDF_TYPE = {
  title: 22,
  subtitle: 11,
  section: 8,
  body: 10,
  bodySm: 9,
  contact: 10,
  tableHead: 9,
  tableRow: 10,
  total: 13,
  footer: 8,
};

function formatTime(t) {
  if (!t) return '';
  const s = String(t);
  const [h, m] = s.split(':').map(Number);
  if (h == null) return s;
  const h12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return m != null ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

function pdfFont(doc, size, color, bold = false) {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
}

/** PDFKit heightOfString can underestimate; use line box + small buffer for layout. */
function pdfTextBlockHeight(doc, text, width, fontSize) {
  const measured = doc.heightOfString(String(text || ''), { width });
  return Math.max(measured, fontSize * 1.4) + 4;
}

function formatMoney(n) {
  return `${CURRENCY}${Number(n || 0).toFixed(2)}`;
}

function formatInvoiceDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function patientAgeGender(data) {
  const parts = [];
  if (data.patient_dob) {
    const today = new Date();
    const birth = new Date(data.patient_dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    parts.push(`${age} yrs`);
  }
  if (data.patient_gender) {
    parts.push(String(data.patient_gender).charAt(0).toUpperCase() + String(data.patient_gender).slice(1));
  }
  return parts.join(' · ');
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
    const doc = new PDFDocument({ size: 'A4', margin: PDF_MARGIN, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=invoice-${data.invoice_number}.pdf`
    );
    doc.pipe(res);

    const left = PDF_MARGIN;
    const right = PDF_WIDTH - PDF_MARGIN;
    const business = await getClinicBusinessSettings(req.user?.id || null);
    const logoPath = await getClinicLogoPath(req.user?.id || null);
    const doctorName = data.doctor_name || data.creator_name || '—';
    const doctorPhone = data.doctor_phone || data.creator_phone || '';
    const balance = Math.max(0, Number(data.total) - Number(data.paid_amount || 0));
    const payStatus = String(data.payment_status || 'pending').toLowerCase();
    const isPaid = payStatus === 'paid';

    // Accent top bar
    doc.rect(0, 0, PDF_WIDTH, 4).fill(PDF_THEME.accent);

    let y = PDF_MARGIN;

    // ----- Header: invoice meta (top right), centered logo, clinic details -----
    const metaBoxW = 200;
    const metaBoxX = right - metaBoxW;
    const headerStartY = y;

    const logoW = 240;
    const logoH = 68;
    const logoX = left + (PDF_CONTENT - logoW) / 2;
    const logoY = headerStartY + 6;
    if (logoPath) {
      try {
        doc.image(logoPath, logoX, logoY, { width: logoW, height: logoH, fit: [logoW, logoH] });
        y = logoY + logoH + 14;
      } catch (_) {
        pdfFont(doc, PDF_TYPE.title + 2, PDF_THEME.primary, true);
        doc.text(CLINIC_NAME, left, logoY, { width: PDF_CONTENT, align: 'center' });
        y = logoY + 32;
      }
    } else {
      pdfFont(doc, PDF_TYPE.title + 2, PDF_THEME.primary, true);
      doc.text(CLINIC_NAME, left, logoY, { width: PDF_CONTENT, align: 'center' });
      y = logoY + 32;
    }

    const contactPhone = business.phone || '';
    const contactEmail = business.email || '';
    const hasClinicContact = business.address || contactPhone || contactEmail || business.gstin;
    if (hasClinicContact) {
      const boxPad = 12;
      const boxInner = 6;
      const textW = PDF_CONTENT - 28;
      const boxX = left;
      let innerH = 14;

      pdfFont(doc, PDF_TYPE.contact, PDF_THEME.body);
      if (business.address) {
        innerH += doc.heightOfString(business.address, { width: textW, lineGap: 3 }) + 8;
      }
      if (contactPhone || contactEmail) {
        const contactLine = [contactPhone, contactEmail].filter(Boolean).join('   ·   ');
        pdfFont(doc, PDF_TYPE.contact, PDF_THEME.primary, true);
        innerH += doc.heightOfString(contactLine, { width: textW }) + 8;
      }
      if (business.gstin) {
        innerH += PDF_TYPE.bodySm + 6;
      }

      const boxH = innerH + boxPad * 2;
      doc.roundedRect(boxX, y, PDF_CONTENT, boxH, 5).fillAndStroke(PDF_THEME.accentSoft, PDF_THEME.border);
      doc.rect(boxX, y, 4, boxH).fill(PDF_THEME.accent);

      pdfFont(doc, PDF_TYPE.section, PDF_THEME.accent, true);
      doc.text('CLINIC DETAILS', boxX, y + boxPad, { width: PDF_CONTENT, align: 'center' });

      let cy = y + boxPad + 14;
      if (business.address) {
        pdfFont(doc, PDF_TYPE.contact, PDF_THEME.body);
        doc.text(business.address, boxX + boxPad, cy, { width: PDF_CONTENT - boxPad * 2, lineGap: 3, align: 'center' });
        cy += doc.heightOfString(business.address, { width: PDF_CONTENT - boxPad * 2, lineGap: 3 }) + 8;
      }
      if (contactPhone || contactEmail) {
        const contactLine = [contactPhone, contactEmail].filter(Boolean).join('   ·   ');
        pdfFont(doc, PDF_TYPE.contact, PDF_THEME.primary, true);
        doc.text(contactLine, boxX + boxPad, cy, { width: PDF_CONTENT - boxPad * 2, align: 'center' });
        cy += doc.heightOfString(contactLine, { width: PDF_CONTENT - boxPad * 2 }) + 8;
      }
      if (business.gstin) {
        pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
        doc.text(`GSTIN  ${business.gstin}`, boxX + boxPad, cy, { width: PDF_CONTENT - boxPad * 2, align: 'center' });
      }
      y += boxH + 12;
    }

    const metaH = 72;
    doc.roundedRect(metaBoxX, headerStartY, metaBoxW, metaH, 4).fill(PDF_THEME.surface);
    doc.rect(metaBoxX, headerStartY, metaBoxW, 3).fill(PDF_THEME.accent);
    pdfFont(doc, PDF_TYPE.section, PDF_THEME.accent, true);
    doc.text('INVOICE', metaBoxX + 14, headerStartY + 12);
    pdfFont(doc, PDF_TYPE.body, PDF_THEME.primary, true);
    doc.text(data.invoice_number, metaBoxX + 14, headerStartY + 26, { width: metaBoxW - 28 });
    pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
    doc.text(`Date  ${formatInvoiceDate(data.created_at)}`, metaBoxX + 14, headerStartY + 44);
    if (data.appointment_date || data.start_time) {
      const apptDate = data.appointment_date
        ? new Date(data.appointment_date).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
        : '';
      const apptLine = [apptDate, formatTime(data.start_time)].filter(Boolean).join(' · ');
      doc.text(`Visit  ${apptLine}`, metaBoxX + 14, headerStartY + 58, { width: metaBoxW - 28 });
    }

    y = Math.max(y, headerStartY + metaH) + 20;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(PDF_THEME.border).lineWidth(0.75).stroke();
    y += 18;

    // ----- Doctor & patient panels -----
    const panelGap = 14;
    const panelW = (PDF_CONTENT - panelGap) / 2;
    const panelPad = 12;
    const col2X = left + panelW + panelGap;

    const partyTextW = panelW - panelPad * 2;
    const partyLineGap = 7;

    const measurePartyPanel = (title, name, lines) => {
      let inner = panelPad;
      pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
      inner += pdfTextBlockHeight(doc, title, partyTextW, PDF_TYPE.section) + 5;
      pdfFont(doc, PDF_TYPE.body + 1, PDF_THEME.primary, true);
      inner += pdfTextBlockHeight(doc, name || '—', partyTextW, PDF_TYPE.body + 1) + 8;
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      lines.forEach((line) => {
        inner += pdfTextBlockHeight(doc, line, partyTextW, PDF_TYPE.bodySm) + partyLineGap;
      });
      return inner + panelPad;
    };

    const drawPartyPanel = (x, title, name, lines, panelH) => {
      doc.roundedRect(x, y, panelW, panelH, 4).fillAndStroke(PDF_THEME.surface, PDF_THEME.border);
      let cy = y + panelPad;
      pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
      doc.text(title, x + panelPad, cy, { width: partyTextW });
      cy += pdfTextBlockHeight(doc, title, partyTextW, PDF_TYPE.section) + 5;
      pdfFont(doc, PDF_TYPE.body + 1, PDF_THEME.primary, true);
      doc.text(name || '—', x + panelPad, cy, { width: partyTextW });
      cy += pdfTextBlockHeight(doc, name || '—', partyTextW, PDF_TYPE.body + 1) + 8;
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      lines.forEach((line) => {
        doc.text(line, x + panelPad, cy, { width: partyTextW });
        cy += pdfTextBlockHeight(doc, line, partyTextW, PDF_TYPE.bodySm) + partyLineGap;
      });
    };

    const patientLines = [
      data.patient_phone ? `Phone  ${data.patient_phone}` : 'Phone  —',
    ];
    const ag = patientAgeGender(data);
    if (ag) patientLines.push(ag);
    if (data.patient_address) patientLines.push(`Address  ${data.patient_address}`);

    const doctorLines = [doctorPhone ? `Phone  ${doctorPhone}` : 'Phone  —'];
    const panelH = Math.max(
      measurePartyPanel('Consulting Doctor', doctorName, doctorLines),
      measurePartyPanel('BILLED TO', data.patient_name || '—', patientLines),
      72
    );
    drawPartyPanel(left, 'Consulting Doctor', doctorName, doctorLines, panelH);
    drawPartyPanel(col2X, 'BILLED TO', data.patient_name || '—', patientLines, panelH);
    y += panelH + 22;

    // ----- Line items table -----
    const colW = [238, 42, 98, 117];
    const tableLeft = left;
    const rowH = 22;
    const headH = 26;
    const tableTop = y;

    doc.rect(tableLeft, tableTop, PDF_CONTENT, headH).fill(PDF_THEME.primary);
    pdfFont(doc, PDF_TYPE.tableHead, PDF_THEME.white, true);
    const headY = tableTop + 8;
    doc.text('Description', tableLeft + 10, headY, { width: colW[0] - 12 });
    doc.text('Qty', tableLeft + colW[0], headY, { width: colW[1], align: 'right' });
    doc.text('Unit price', tableLeft + colW[0] + colW[1], headY, { width: colW[2], align: 'right' });
    doc.text('Amount', tableLeft + colW[0] + colW[1] + colW[2], headY, { width: colW[3] - 8, align: 'right' });
    y = tableTop + headH;

    (items || []).forEach((it, idx) => {
      if (idx % 2 === 1) {
        doc.rect(tableLeft, y, PDF_CONTENT, rowH).fill(PDF_THEME.surface);
      }
      doc.moveTo(tableLeft, y + rowH).lineTo(tableLeft + PDF_CONTENT, y + rowH).strokeColor(PDF_THEME.border).lineWidth(0.5).stroke();
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.body);
      doc.text(String(it.description || '—').slice(0, 55), tableLeft + 10, y + 6, { width: colW[0] - 14 });
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.secondary);
      doc.text(String(it.quantity), tableLeft + colW[0], y + 6, { width: colW[1], align: 'right' });
      doc.text(formatMoney(it.unit_price), tableLeft + colW[0] + colW[1], y + 6, { width: colW[2], align: 'right' });
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.primary, true);
      doc.text(formatMoney(it.total), tableLeft + colW[0] + colW[1] + colW[2], y + 6, {
        width: colW[3] - 8,
        align: 'right',
      });
      y += rowH;
    });
    doc.rect(tableLeft, tableTop, PDF_CONTENT, y - tableTop).strokeColor(PDF_THEME.border).lineWidth(0.75).stroke();
    y += 18;

    // ----- Totals + payment (two columns) -----
    const totalsBoxW = 232;
    const totalsBoxX = right - totalsBoxW;
    const totalsPad = 14;
    const totalsInnerW = totalsBoxW - totalsPad * 2;
    const totalsLabelW = 98;
    const totalsValueW = totalsInnerW - totalsLabelW;
    const totalsValueX = totalsBoxX + totalsPad + totalsLabelW;

    const totalsBoxTop = y;
    const totalsBoxH = 106;
    doc.roundedRect(totalsBoxX, totalsBoxTop, totalsBoxW, totalsBoxH, 4).fillAndStroke(PDF_THEME.surface, PDF_THEME.border);
    y = totalsBoxTop + 12;

    const drawTotalRow = (label, value, bold = false, accent = false) => {
      pdfFont(doc, bold ? PDF_TYPE.total : PDF_TYPE.body, accent ? PDF_THEME.accent : PDF_THEME.secondary, bold);
      doc.text(label, totalsBoxX + totalsPad, y, { width: totalsLabelW });
      pdfFont(doc, bold ? PDF_TYPE.total : PDF_TYPE.body, bold ? PDF_THEME.primary : PDF_THEME.body, bold);
      doc.text(value, totalsValueX, y, { width: totalsValueW, align: 'right' });
      y += bold ? 22 : 16;
    };

    drawTotalRow('Subtotal', formatMoney(data.subtotal));
    drawTotalRow(`Tax (${Number(data.tax_percent || 0)}%)`, formatMoney(data.tax_amount));
    drawTotalRow('Discount', `- ${formatMoney(data.discount)}`);
    const dividerY = y;
    doc
      .moveTo(totalsBoxX + totalsPad, dividerY)
      .lineTo(totalsBoxX + totalsBoxW - totalsPad, dividerY)
      .strokeColor(PDF_THEME.border)
      .lineWidth(0.5)
      .stroke();
    y += 10;
    drawTotalRow('Amount due', formatMoney(data.total), true, true);

    const wordsY = totalsBoxTop + totalsBoxH + 10;
    const amountWords = amountInWords(data.total);
    pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary, true);
    doc.text('Amount in words', left, wordsY, { width: PDF_CONTENT });
    pdfFont(doc, PDF_TYPE.body, PDF_THEME.body);
    doc.text(amountWords, left, wordsY + 12, { width: PDF_CONTENT, lineGap: 3 });

    const payY = totalsBoxTop + 12;
    pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
    doc.text('PAYMENT', left, payY);
    const badgeW = 58;
    const badgeH = 18;
    const badgeColor = isPaid ? PDF_THEME.paid : PDF_THEME.pending;
    const badgeBg = isPaid ? '#ecfdf5' : '#fffbeb';
    doc.roundedRect(left, payY + 14, badgeW, badgeH, 3).fill(badgeBg);
    pdfFont(doc, PDF_TYPE.bodySm, badgeColor, true);
    doc.text(
      payStatus.charAt(0).toUpperCase() + payStatus.slice(1),
      left,
      payY + 18,
      { width: badgeW, align: 'center' }
    );
    pdfFont(doc, PDF_TYPE.body, PDF_THEME.body);
    doc.text(`Paid  ${formatMoney(data.paid_amount)}`, left, payY + 40);
    pdfFont(doc, PDF_TYPE.body, balance > 0 ? PDF_THEME.pending : PDF_THEME.secondary, balance > 0);
    doc.text(`Balance  ${formatMoney(balance)}`, left, payY + 56);

    y = Math.max(y, payY + 78, wordsY + pdfTextBlockHeight(doc, amountWords, PDF_CONTENT, PDF_TYPE.body) + 22) + 16;

    // ----- Footer -----
    const footerY = PDF_HEIGHT - PDF_MARGIN - 36;
    doc.moveTo(left, footerY).lineTo(right, footerY).strokeColor(PDF_THEME.border).lineWidth(0.5).stroke();
    pdfFont(doc, PDF_TYPE.footer, PDF_THEME.muted);
    doc.text(
      'Thank you for choosing our clinic. Please retain this invoice for your records.',
      left,
      footerY + 10,
      { width: PDF_CONTENT, align: 'center' }
    );
    doc.text(`Issued via ${CLINIC_NAME}`, left, footerY + 22, { width: PDF_CONTENT, align: 'center' });

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
