const { amountInWords } = require('./amountInWords');

// A4: 595.28 x 841.89 pt.
const PDF_MARGIN = 48;
const PDF_MARGIN_TOP = 10;
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const PDF_CONTENT = PDF_WIDTH - PDF_MARGIN * 2;
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

const PDF_ICON = 10;
const PDF_ICON_GAP = 6;

function pdfIconStyle(doc, color) {
  doc.save();
  doc.strokeColor(color).fillColor(color);
  doc.lineWidth(1.05).lineCap('round').lineJoin('round');
}

/** Lucide-style map pin */
function drawPdfMapPinIcon(doc, x, y, color) {
  pdfIconStyle(doc, color);
  const cx = x + PDF_ICON / 2;
  doc.circle(cx, y + 2.6, 2.3).stroke();
  doc.moveTo(cx - 2.1, y + 4.4).lineTo(cx, y + 9.4).lineTo(cx + 2.1, y + 4.4).stroke();
  doc.circle(cx, y + 2.6, 0.9).fill();
  doc.restore();
}

/** Lucide-style smartphone */
function drawPdfPhoneIcon(doc, x, y, color) {
  pdfIconStyle(doc, color);
  doc.roundedRect(x + 1.8, y + 0.6, 6.4, 8.8, 1.3).stroke();
  doc.roundedRect(x + 4.2, y + 1.4, 1.6, 0.9, 0.3).stroke();
  doc.circle(x + PDF_ICON / 2, y + 7.6, 0.65).stroke();
  doc.restore();
}

/** Lucide-style mail envelope */
function drawPdfMailIcon(doc, x, y, color) {
  pdfIconStyle(doc, color);
  doc.rect(x + 1.2, y + 2.4, 7.6, 5.4).stroke();
  doc.moveTo(x + 1.2, y + 2.4).lineTo(x + PDF_ICON / 2, y + 6.1).lineTo(x + 8.8, y + 2.4).stroke();
  doc.restore();
}

/** Contact bar — match invoice reference layout and colours. */
const PDF_CONTACT = {
  label: '#005EB8',
  iconTop: '#5eb8f0',
  iconBottom: '#005EB8',
  divider: '#c8d9e8',
  body: '#000000',
};

/** Wider contact band — uses left/right page space (less inset than body). */
const PDF_CONTACT_MARGIN = 28;

const PDF_COL_ICON_R = 12;
const PDF_COL_PAD = 8;
const PDF_COL_ICON_GAP = 8;
const PDF_COL_LABEL_SIZE = 9;
const PDF_COL_BODY_SIZE = 8;
const PDF_COL_LABEL_GAP = 3;
const PDF_COL_DIVIDER_HEIGHT = 52;

function formatPdfContactValue(value, type) {
  const s = String(value || '')
    .replace(/\r?\n+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

function drawPdfIconBadge(doc, x, y, type) {
  const cx = x + PDF_COL_ICON_R;
  const cy = y + PDF_COL_ICON_R;
  const r = PDF_COL_ICON_R;
  const grad = doc.linearGradient(cx, cy - r, cx, cy + r);
  grad.stop(0, PDF_CONTACT.iconTop).stop(1, PDF_CONTACT.iconBottom);
  doc.circle(cx, cy, r).fill(grad);
  const white = PDF_THEME.white;
  const ix = x + PDF_COL_ICON_R - PDF_ICON / 2;
  const iy = y + PDF_COL_ICON_R - PDF_ICON / 2 + 0.5;
  if (type === 'address') drawPdfMapPinIcon(doc, ix, iy, white);
  else if (type === 'email') drawPdfMailIcon(doc, ix, iy, white);
  else drawPdfPhoneIcon(doc, ix, iy, white);
}

function measurePdfContactColumn(doc, label, value, type, colW) {
  const displayValue = formatPdfContactValue(value, type);
  const iconD = PDF_COL_ICON_R * 2;
  const textLeft = PDF_COL_PAD + iconD + PDF_COL_ICON_GAP;
  const contentW = Math.max(40, colW - textLeft - PDF_COL_PAD);
  const labelH = PDF_COL_LABEL_SIZE + 2;
  pdfFont(doc, PDF_COL_BODY_SIZE, PDF_CONTACT.body);
  const valueH = pdfTextBlockHeight(doc, displayValue, contentW, PDF_COL_BODY_SIZE);
  const textBlockH = labelH + PDF_COL_LABEL_GAP + valueH;
  return PDF_COL_PAD + Math.max(iconD, textBlockH) + PDF_COL_PAD;
}

function drawPdfContactColumn(doc, colX, colY, colW, { type, label, value }) {
  const displayValue = formatPdfContactValue(value, type);
  const topY = colY + PDF_COL_PAD;
  const iconX = colX + PDF_COL_PAD;
  drawPdfIconBadge(doc, iconX, topY, type);

  const textLeft = colX + PDF_COL_PAD + PDF_COL_ICON_R * 2 + PDF_COL_ICON_GAP;
  const contentW = Math.max(40, colW - (textLeft - colX) - PDF_COL_PAD);

  pdfFont(doc, PDF_COL_LABEL_SIZE, PDF_CONTACT.label, true);
  doc.text(label, textLeft, topY + 1, { lineBreak: false });

  const labelH = PDF_COL_LABEL_SIZE + 2;
  const contentY = topY + 1 + labelH + PDF_COL_LABEL_GAP;
  pdfFont(doc, PDF_COL_BODY_SIZE, PDF_CONTACT.body);
  doc.text(displayValue, textLeft, contentY, { width: contentW, lineGap: 2 });
}

function buildPdfContactColumns(business, contactPhone, contactEmail) {
  const columns = [];
  if (business.address) columns.push({ type: 'address', label: 'ADDRESS', value: business.address });
  if (contactEmail) columns.push({ type: 'email', label: 'EMAIL', value: contactEmail });
  if (contactPhone) columns.push({ type: 'phone', label: 'PHONE', value: contactPhone });
  return columns;
}

function measurePdfContactColumns(doc, columns, boxW) {
  if (!columns.length) return 0;
  const dividerW = columns.length > 1 ? 1 : 0;
  const colW = (boxW - (columns.length - 1) * dividerW) / columns.length;
  let columnsH = 0;
  for (const col of columns) {
    columnsH = Math.max(columnsH, measurePdfContactColumn(doc, col.label, col.value, col.type, colW));
  }
  return columnsH;
}

function measurePdfGstinRow(doc, gstin, boxW) {
  if (!gstin) return 0;
  const gstLine = `GSTIN  ${gstin}`;
  pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
  return 8 + pdfTextBlockHeight(doc, gstLine, boxW - PDF_COL_PAD * 2, PDF_TYPE.bodySm);
}

function drawPdfContactBar(doc, boxX, boxY, boxW, columnsH, columns, gstin) {
  const dividerW = columns.length > 1 ? 1 : 0;
  const colW = (boxW - (columns.length - 1) * dividerW) / columns.length;

  const dividerH = Math.min(PDF_COL_DIVIDER_HEIGHT, Math.max(28, columnsH - 16));
  const dividerY0 = boxY + (columnsH - dividerH) / 2;

  for (let i = 0; i < columns.length; i++) {
    const colX = boxX + i * (colW + dividerW);
    if (i > 0) {
      doc
        .moveTo(colX, dividerY0)
        .lineTo(colX, dividerY0 + dividerH)
        .strokeColor(PDF_CONTACT.divider)
        .lineWidth(0.75)
        .stroke();
    }
    drawPdfContactColumn(doc, colX, boxY, colW, columns[i]);
  }

  if (gstin) {
    const gstY = boxY + columnsH + 4;
    doc
      .moveTo(boxX + PDF_COL_PAD, gstY - 3)
      .lineTo(boxX + boxW - PDF_COL_PAD, gstY - 3)
      .strokeColor(PDF_CONTACT.divider)
      .lineWidth(0.5)
      .stroke();
    pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
    doc.text(`GSTIN  ${gstin}`, boxX + PDF_COL_PAD, gstY, {
      width: boxW - PDF_COL_PAD * 2,
      lineBreak: false,
    });
  }
}

/** Edge-to-edge header: full page width, height capped, image covers the band (like CSS object-cover). */
const HEADER_BAND_HEIGHT_PT = 130;

function drawInvoiceHeader(doc, imagePath, startY) {
  const boxW = PDF_WIDTH;
  const boxH = HEADER_BAND_HEIGHT_PT;
  const img = doc.openImage(imagePath);
  const scale = Math.max(boxW / img.width, boxH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const x = (boxW - drawW) / 2;
  const y = startY + (boxH - drawH) / 2;

  doc.save();
  doc.rect(0, startY, boxW, boxH).clip();
  doc.image(imagePath, x, y, { width: drawW, height: drawH });
  doc.restore();

  return boxH + 6;
}

function formatInvoiceDateDMY(dateInput) {
  if (!dateInput) return '';
  const iso = String(dateInput).slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
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


async function renderInvoicePdf(
  doc,
  {
    data,
    items,
    business = {},
    headerPath = null,
    logoPath = null,
    clinicName = process.env.CLINIC_NAME || 'DoctorDesk',
  }
) {
    const headerImagePath = headerPath || logoPath;
    const left = PDF_MARGIN;
    const right = PDF_WIDTH - PDF_MARGIN;
            const doctorName = data.doctor_name || data.creator_name || '—';
    const doctorPhone = data.doctor_phone || data.creator_phone || '';
    const balance = Math.max(0, Number(data.total) - Number(data.paid_amount || 0));
    const payStatus = String(data.payment_status || 'pending').toLowerCase();
    const isPaid = payStatus === 'paid';

    // Accent top bar
    doc.rect(0, 0, PDF_WIDTH, 4).fill(PDF_THEME.accent);

    // ----- Row 1: edge-to-edge header; row 2: clinic (left) + invoice (right) with margins -----
    const headerStartY = 4;
    let y = headerStartY;
    const rowGap = 10;

    let headerBlockH = 0;
    if (headerImagePath) {
      try {
        headerBlockH = drawInvoiceHeader(doc, headerImagePath, headerStartY);
      } catch (_) {
        /* fall through to clinic name */
      }
    }
    if (!headerBlockH && clinicName) {
      pdfFont(doc, PDF_TYPE.title + 2, PDF_THEME.primary, true);
      doc.text(clinicName, left, headerStartY + 8, { width: PDF_CONTENT, align: 'center' });
      headerBlockH = pdfTextBlockHeight(doc, clinicName, PDF_CONTENT, PDF_TYPE.title + 2) + 10;
    }

    const row2Y = headerStartY + headerBlockH + rowGap;
    const clinicBoxX = PDF_CONTACT_MARGIN;
    const clinicBoxW = PDF_WIDTH - PDF_CONTACT_MARGIN * 2;

    const contactPhone = business.phone || '';
    const contactEmail = business.email || '';
    const hasClinicContact = business.address || contactPhone || contactEmail || business.gstin;
    let clinicBoxH = 0;

    if (hasClinicContact) {
      const columns = buildPdfContactColumns(business, contactPhone, contactEmail);
      const columnsH = measurePdfContactColumns(doc, columns, clinicBoxW);
      const gstinH = measurePdfGstinRow(doc, business.gstin, clinicBoxW);
      clinicBoxH = columnsH + gstinH;

      if (clinicBoxH > 0) {
        drawPdfContactBar(doc, clinicBoxX, row2Y, clinicBoxW, columnsH, columns, business.gstin);
      }
    }

    y = row2Y + clinicBoxH + 12;

    doc.moveTo(left, y).lineTo(right, y).strokeColor(PDF_THEME.border).lineWidth(0.75).stroke();
    y += 14;

    // ----- Doctor & patient panels -----
    const panelGap = 14;
    const panelW = (PDF_CONTENT - panelGap) / 2;
    const panelPad = 10;
    const col2X = left + panelW + panelGap;

    const partyTextW = panelW - panelPad * 2 - 4;
    const partyLineGap = 5;

    const measureNameRow = (displayName, nameSuffix) => {
      pdfFont(doc, PDF_TYPE.body, PDF_THEME.primary, true);
      const nameH = pdfTextBlockHeight(doc, displayName, partyTextW, PDF_TYPE.body);
      if (!nameSuffix) return nameH;
      pdfFont(doc, PDF_TYPE.body, PDF_THEME.primary, true);
      const nameW = doc.widthOfString(displayName);
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      const suffixW = partyTextW - nameW - 8;
      const suffixH =
        suffixW > 40
          ? pdfTextBlockHeight(doc, nameSuffix, suffixW, PDF_TYPE.bodySm)
          : pdfTextBlockHeight(doc, nameSuffix, partyTextW, PDF_TYPE.bodySm);
      return Math.max(nameH, suffixH);
    };

    const drawNameRow = (x, cy, displayName, nameSuffix) => {
      const textX = x + panelPad + 2;
      pdfFont(doc, PDF_TYPE.body, PDF_THEME.primary, true);
      if (!nameSuffix) {
        doc.text(displayName, textX, cy, { width: partyTextW });
        return cy + pdfTextBlockHeight(doc, displayName, partyTextW, PDF_TYPE.body) + 6;
      }
      doc.text(displayName, textX, cy, { lineBreak: false });
      const nameW = doc.widthOfString(displayName);
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      const suffixX = textX + nameW + 6;
      const suffixW = partyTextW - (suffixX - textX);
      if (suffixW > 40) {
        doc.text(nameSuffix, suffixX, cy + 1, { width: suffixW, lineBreak: false });
      } else {
        doc.text(nameSuffix, textX, cy + pdfTextBlockHeight(doc, displayName, partyTextW, PDF_TYPE.body), {
          width: partyTextW,
        });
      }
      return cy + measureNameRow(displayName, nameSuffix) + 6;
    };

    const measurePartyPanel = (title, name, lines, nameSuffix = '') => {
      const displayName = name || '—';
      let inner = panelPad;
      pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
      inner += pdfTextBlockHeight(doc, title, partyTextW, PDF_TYPE.section) + 4;
      inner += measureNameRow(displayName, nameSuffix) + 6;
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      lines.forEach((line, i) => {
        inner += pdfTextBlockHeight(doc, line, partyTextW, PDF_TYPE.bodySm);
        if (i < lines.length - 1) inner += partyLineGap;
      });
      return inner + panelPad;
    };

    const drawPartyPanel = (x, title, name, lines, panelH, nameSuffix = '') => {
      const displayName = name || '—';
      doc.roundedRect(x, y, panelW, panelH, 4).fillAndStroke(PDF_THEME.surface, PDF_THEME.border);
      let cy = y + panelPad;
      pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
      doc.text(title, x + panelPad, cy, { width: partyTextW });
      cy += pdfTextBlockHeight(doc, title, partyTextW, PDF_TYPE.section) + 4;
      cy = drawNameRow(x, cy, displayName, nameSuffix);
      pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
      lines.forEach((line, i) => {
        doc.text(line, x + panelPad + 2, cy, { width: partyTextW });
        cy += pdfTextBlockHeight(doc, line, partyTextW, PDF_TYPE.bodySm);
        if (i < lines.length - 1) cy += partyLineGap;
      });
    };

    const patientAg = patientAgeGender(data);
    const visitDate = formatInvoiceDateDMY(data.appointment_date);
    const phonePart = data.patient_phone ? `Phone  ${data.patient_phone}` : 'Phone  —';
    const patientContactLine = visitDate ? `${phonePart}   Visited on: ${visitDate}` : phonePart;
    const patientLines = [patientContactLine];
    if (data.patient_address) patientLines.push(`Address  ${data.patient_address}`);

    const doctorPhonePart = doctorPhone ? `Phone  ${doctorPhone}` : 'Phone  —';
    const doctorLines = [`${doctorPhonePart}   ${data.invoice_number || '—'}`];
    const doctorPanelH = measurePartyPanel('Consulting Doctor', doctorName, doctorLines);
    const patientPanelH = measurePartyPanel('BILLED TO', data.patient_name || '—', patientLines, patientAg);
    drawPartyPanel(left, 'Consulting Doctor', doctorName, doctorLines, doctorPanelH);
    drawPartyPanel(col2X, 'BILLED TO', data.patient_name || '—', patientLines, patientPanelH, patientAg);
    y += Math.max(doctorPanelH, patientPanelH) + 14;

    // ----- Line items table (numeric columns anchored from right edge) -----
    const tableLeft = left;
    const tablePad = 14;
    const tableRight = tableLeft + PDF_CONTENT - tablePad;
    const wMoney = 88;
    const wUnit = 78;
    const wQty = 36;
    const xMoney = tableRight - wMoney;
    const xUnit = xMoney - wUnit - 8;
    const xQty = xUnit - wQty - 8;
    const xDesc = tableLeft + tablePad;
    const wDesc = xQty - xDesc - 8;
    const rowH = 22;
    const headH = 26;
    const tableTop = y;

    doc.rect(tableLeft, tableTop, PDF_CONTENT, headH).fill(PDF_THEME.primary);
    pdfFont(doc, PDF_TYPE.tableHead, PDF_THEME.white, true);
    const headY = tableTop + 8;
    doc.text('Description', xDesc, headY, { width: wDesc });
    doc.text('Qty', xQty, headY, { width: wQty, align: 'right' });
    doc.text('Unit price', xUnit, headY, { width: wUnit, align: 'right' });
    doc.text('Amount', xMoney, headY, { width: wMoney, align: 'right' });
    y = tableTop + headH;

    (items || []).forEach((it, idx) => {
      if (idx % 2 === 1) {
        doc.rect(tableLeft, y, PDF_CONTENT, rowH).fill(PDF_THEME.surface);
      }
      doc.moveTo(tableLeft, y + rowH).lineTo(tableLeft + PDF_CONTENT, y + rowH).strokeColor(PDF_THEME.border).lineWidth(0.5).stroke();
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.body);
      doc.text(String(it.description || '—').slice(0, 55), xDesc, y + 6, { width: wDesc });
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.secondary);
      doc.text(String(it.quantity), xQty, y + 6, { width: wQty, align: 'right' });
      doc.text(formatMoney(it.unit_price), xUnit, y + 6, { width: wUnit, align: 'right' });
      pdfFont(doc, PDF_TYPE.tableRow, PDF_THEME.primary, true);
      doc.text(formatMoney(it.total), xMoney, y + 6, { width: wMoney, align: 'right' });
      y += rowH;
    });
    doc.rect(tableLeft, tableTop, PDF_CONTENT, y - tableTop).strokeColor(PDF_THEME.border).lineWidth(0.75).stroke();
    y += 18;

    // ----- Totals + payment (two columns) -----
    const totalsBoxW = 248;
    const totalsBoxX = right - totalsBoxW;
    const totalsPad = 16;
    const totalsRight = totalsBoxX + totalsBoxW - totalsPad;
    const totalsValueW = 100;
    const totalsValueX = totalsRight - totalsValueW;
    const totalsLabelW = totalsValueX - totalsBoxX - totalsPad - 8;

    const totalsBoxTop = y;
    const totalsBoxH = 112;
    doc.roundedRect(totalsBoxX, totalsBoxTop, totalsBoxW, totalsBoxH, 4).fillAndStroke(PDF_THEME.surface, PDF_THEME.border);
    y = totalsBoxTop + 14;

    const drawTotalRow = (label, value, bold = false, accent = false) => {
      pdfFont(doc, PDF_TYPE.body, accent ? PDF_THEME.accent : PDF_THEME.secondary, accent);
      doc.text(label, totalsBoxX + totalsPad, y, { width: totalsLabelW });
      pdfFont(doc, PDF_TYPE.body, PDF_THEME.primary, bold);
      doc.text(value, totalsValueX, y, { width: totalsValueW, align: 'right' });
      y += bold ? 22 : 17;
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

    const payRowTop = totalsBoxTop + 12;
    const badgeH = 18;
    const badgeColor = isPaid ? PDF_THEME.paid : PDF_THEME.pending;
    const badgeBg = isPaid ? '#ecfdf5' : '#fffbeb';
    const statusLabel = payStatus.charAt(0).toUpperCase() + payStatus.slice(1);

    pdfFont(doc, PDF_TYPE.bodySm, badgeColor, true);
    const badgeW = Math.max(52, doc.widthOfString(statusLabel) + 16);
    pdfFont(doc, PDF_TYPE.section, PDF_THEME.secondary, true);
    const labelSize = PDF_TYPE.section;
    const labelY = payRowTop + (badgeH - labelSize) / 2 + 2;
    doc.text('PAYMENT', left, labelY, { lineBreak: false });
    const badgeX = left + doc.widthOfString('PAYMENT') + 10;
    doc.roundedRect(badgeX, payRowTop, badgeW, badgeH, 3).fill(badgeBg);
    pdfFont(doc, PDF_TYPE.bodySm, badgeColor, true);
    const statusSize = PDF_TYPE.bodySm;
    const statusY = payRowTop + (badgeH - statusSize) / 2 + 2;
    doc.text(statusLabel, badgeX, statusY, { width: badgeW, align: 'center' });

    const amountWords = amountInWords(data.total);
    const paidLineY = payRowTop + badgeH + 8;
    const paidLabel = `Paid  ${formatMoney(data.paid_amount)}`;
    pdfFont(doc, PDF_TYPE.body, PDF_THEME.body);
    doc.text(paidLabel, left, paidLineY, { lineBreak: false });
    const paidW = doc.widthOfString(paidLabel);
    const wordsX = left + paidW + 8;
    const wordsMaxW = Math.max(80, totalsBoxX - wordsX - 8);
    doc.text(amountWords, wordsX, paidLineY, { width: wordsMaxW, lineGap: 3 });
    const paidRowH = Math.max(
      pdfTextBlockHeight(doc, paidLabel, totalsBoxX - left, PDF_TYPE.body),
      pdfTextBlockHeight(doc, amountWords, wordsMaxW, PDF_TYPE.body)
    );

    const balanceLineY = paidLineY + paidRowH + 6;
    const balanceColor = balance > 0 ? PDF_THEME.pending : PDF_THEME.secondary;
    pdfFont(doc, PDF_TYPE.body, balanceColor, balance > 0);
    doc.text(`Balance  ${formatMoney(balance)}`, left, balanceLineY);
    y = Math.max(totalsBoxTop + totalsBoxH, balanceLineY + 17) + 14;

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
    doc.text(`Issued via ${clinicName}`, left, footerY + 22, { width: PDF_CONTENT, align: 'center' });


}

module.exports = {
  renderInvoicePdf,
  PDF_MARGIN,
  PDF_MARGIN_TOP,
  PDF_WIDTH,
  PDF_CONTENT,
};
