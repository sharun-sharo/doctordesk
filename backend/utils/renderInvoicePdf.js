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

const PDF_ICON = 10;
const PDF_ICON_GAP = 6;
const PDF_CONTACT_ITEM_GAP = 12;

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

function measureAddressRow(doc, address, maxW) {
  const textW = Math.max(40, maxW - PDF_ICON - PDF_ICON_GAP);
  pdfFont(doc, PDF_TYPE.contact, PDF_THEME.body);
  return Math.max(PDF_TYPE.contact + 4, pdfTextBlockHeight(doc, address, textW, PDF_TYPE.contact));
}

function drawAddressRow(doc, x, cy, address, maxW, color) {
  drawPdfMapPinIcon(doc, x, cy + 0.5, color);
  pdfFont(doc, PDF_TYPE.contact, PDF_THEME.body);
  const textW = Math.max(40, maxW - PDF_ICON - PDF_ICON_GAP);
  doc.text(address, x + PDF_ICON + PDF_ICON_GAP, cy, { width: textW, lineGap: 2 });
  return measureAddressRow(doc, address, maxW);
}

function measureContactRow(doc, phone, email, maxW) {
  pdfFont(doc, PDF_TYPE.contact, PDF_THEME.primary, true);
  let usedW = 0;
  if (phone) usedW += PDF_ICON + PDF_ICON_GAP + doc.widthOfString(phone);
  if (phone && email) usedW += PDF_CONTACT_ITEM_GAP;
  if (email) usedW += PDF_ICON + PDF_ICON_GAP + doc.widthOfString(email);
  const singleLineH = PDF_TYPE.contact + 4;
  if (usedW <= maxW) return singleLineH;
  const fallback = [phone, email].filter(Boolean).join('   ·   ');
  return pdfTextBlockHeight(doc, fallback, maxW, PDF_TYPE.contact);
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

function drawContactRow(doc, x, y, phone, email, maxW, color) {
  pdfFont(doc, PDF_TYPE.contact, PDF_THEME.primary, true);
  let cx = x;
  const iconY = y + 0.5;
  const textY = y;

  if (phone) {
    drawPdfPhoneIcon(doc, cx, iconY, color);
    cx += PDF_ICON + PDF_ICON_GAP;
    doc.text(phone, cx, textY, { lineBreak: false });
    cx += doc.widthOfString(phone);
    if (email) cx += PDF_CONTACT_ITEM_GAP;
  }
  if (email) {
    drawPdfMailIcon(doc, cx, iconY, color);
    cx += PDF_ICON + PDF_ICON_GAP;
    const remaining = maxW - (cx - x);
    doc.text(email, cx, textY, { width: Math.max(40, remaining), lineBreak: false });
  }
  return measureContactRow(doc, phone, email, maxW);
}

function formatVisitLine(data) {
  if (!data.appointment_date && !data.start_time) return '';
  const apptDate = data.appointment_date
    ? new Date(data.appointment_date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';
  return [apptDate, formatTime(data.start_time)].filter(Boolean).join(' · ');
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
    const clinicBoxX = left;
    const clinicBoxW = PDF_CONTENT;

    const contactPhone = business.phone || '';
    const contactEmail = business.email || '';
    const hasClinicContact = business.address || contactPhone || contactEmail || business.gstin;
    let clinicBoxH = 0;

    if (hasClinicContact) {
      const boxPad = 8;
      const textW = clinicBoxW - boxPad * 2 - 4;
      const lineGap = 5;
      const hasContactRow = contactPhone || contactEmail;

      let contentH = 0;
      if (business.address) {
        contentH += measureAddressRow(doc, business.address, textW) + lineGap;
      }
      if (hasContactRow) {
        contentH += measureContactRow(doc, contactPhone, contactEmail, textW);
        if (business.gstin) contentH += lineGap;
      }
      if (business.gstin) {
        const gstLine = `GSTIN  ${business.gstin}`;
        pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
        contentH += pdfTextBlockHeight(doc, gstLine, textW, PDF_TYPE.bodySm);
      }

      clinicBoxH = contentH + boxPad * 2;
      doc
        .roundedRect(clinicBoxX, row2Y, clinicBoxW, clinicBoxH, 4)
        .fillAndStroke(PDF_THEME.accentSoft, PDF_THEME.border);
      doc.rect(clinicBoxX, row2Y, 4, clinicBoxH).fill(PDF_THEME.accent);

      let cy = row2Y + boxPad;

      if (business.address) {
        cy += drawAddressRow(doc, clinicBoxX + boxPad + 4, cy, business.address, textW, PDF_THEME.body);
        cy += lineGap;
      }
      if (hasContactRow) {
        cy += drawContactRow(
          doc,
          clinicBoxX + boxPad + 4,
          cy,
          contactPhone,
          contactEmail,
          textW,
          PDF_THEME.primary
        );
        if (business.gstin) cy += lineGap;
      }
      if (business.gstin) {
        pdfFont(doc, PDF_TYPE.bodySm, PDF_THEME.secondary);
        doc.text(`GSTIN  ${business.gstin}`, clinicBoxX + boxPad + 4, cy, { width: textW });
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
    const visitLine = formatVisitLine(data);
    const phonePart = data.patient_phone ? `Phone  ${data.patient_phone}` : 'Phone  —';
    const patientContactLine = visitLine ? `${phonePart}   Visit  ${visitLine}` : phonePart;
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
    const amountWords = amountInWords(data.total);
    const paidLineY = payY + 40;
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
