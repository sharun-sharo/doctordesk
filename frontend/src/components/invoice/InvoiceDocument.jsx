import { Fragment } from 'react';
import { FileText, Mail, MapPin, Phone, Stethoscope, User, Wallet } from 'lucide-react';
import { amountInWords, formatInvoiceDateDMY, formatMoney, patientAge } from '../../utils/amountInWords';

/** Contact bar tokens — match invoice reference (#005EB8, light dividers). */
const INVOICE_CONTACT = {
  label: '#005EB8',
  iconFrom: '#5eb8f0',
  iconTo: '#005EB8',
  divider: '#c8d9e8',
  body: '#000000',
};

function InvoiceContactDivider() {
  return (
    <div className="flex shrink-0 items-center self-center py-2" aria-hidden>
      <div className="h-[52px] w-px" style={{ backgroundColor: INVOICE_CONTACT.divider }} />
    </div>
  );
}

function formatContactDisplay(value) {
  return String(value)
    .replace(/\r?\n+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

function InvoiceContactColumn({ icon: Icon, label, value }) {
  if (!value) return null;
  const display = formatContactDisplay(value);
  return (
    <div className="flex min-w-0 flex-1 items-start gap-[10px] py-4 pl-3 pr-3 first:pl-5 last:pr-5 sm:py-3.5">
      <div
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full"
        style={{ background: `linear-gradient(to bottom, ${INVOICE_CONTACT.iconFrom}, ${INVOICE_CONTACT.iconTo})` }}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1 pt-px">
        <p className="text-[13px] font-bold uppercase leading-none" style={{ color: INVOICE_CONTACT.label }}>
          {label}
        </p>
        <p
          className="mt-[4px] text-[12px] font-normal leading-[1.4]"
          style={{ color: INVOICE_CONTACT.body }}
        >
          {display}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  if (!value || value === '—') return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-[15px] font-medium text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

function PaymentStatusPill({ status }) {
  const s = String(status || 'pending').toLowerCase();
  const styles = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    partial: 'bg-amber-50 text-amber-800 ring-amber-200',
    pending: 'bg-slate-100 text-slate-700 ring-slate-200',
  };
  const label = s === 'paid' ? 'Paid' : s === 'partial' ? 'Partial' : 'Pending';
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-3 text-xs font-bold leading-none ring-1 ${styles[s] || styles.pending}`}
    >
      {label}
    </span>
  );
}

/**
 * Premium printable invoice document for dashboard preview.
 */
export default function InvoiceDocument({ invoice, clinic = {}, className = '' }) {
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.paid_amount || 0));
  const words = amountInWords(invoice.total);
  const age = patientAge(invoice.patient_dob);
  const gender = invoice.patient_gender
    ? String(invoice.patient_gender).charAt(0).toUpperCase() + String(invoice.patient_gender).slice(1)
    : null;
  const visitDate = formatInvoiceDateDMY(invoice.appointment_date) || null;

  const headerSrc = clinic.headerUrl || clinic.logoUrl || null;

  const contactColumns = [
    { key: 'address', icon: MapPin, label: 'ADDRESS', value: clinic.address },
    { key: 'email', icon: Mail, label: 'EMAIL', value: clinic.email },
    { key: 'phone', icon: Phone, label: 'PHONE', value: clinic.phone },
  ].filter((c) => c.value);

  return (
    <article
      className={`invoice-document relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-slate-200/80 bg-white font-sans shadow-[0_8px_40px_-12px_rgba(15,118,110,0.15),0_4px_24px_-8px_rgba(30,41,59,0.08)] ${className}`}
    >
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-slate-800" aria-hidden />

      {/* Row 1: edge-to-edge header (no side padding) */}
      {headerSrc ? (
        <div className="w-full overflow-hidden bg-white">
          <img
            src={headerSrc}
            alt=""
            className="block h-auto max-h-48 w-full object-cover object-center sm:max-h-52 print:max-h-48"
          />
        </div>
      ) : (
        <p className="bg-white px-6 py-4 text-center text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {clinic.name || 'Clinic'}
        </p>
      )}

      {/* Watermark */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03]"
        aria-hidden
      >
        <Stethoscope className="h-[280px] w-[280px] text-teal-900" strokeWidth={0.5} />
      </div>

      {contactColumns.length > 0 && (
        <section className="w-full border-b border-slate-100 bg-white">
          <div className="flex w-full flex-col items-stretch px-3 sm:flex-row sm:items-center sm:px-4 print:px-3">
            {contactColumns.map((col, index) => (
              <Fragment key={col.key}>
                {index > 0 && (
                  <>
                    <div
                      className="mx-4 h-px shrink-0 sm:hidden"
                      style={{ backgroundColor: INVOICE_CONTACT.divider }}
                      aria-hidden
                    />
                    <div className="hidden sm:contents">
                      <InvoiceContactDivider />
                    </div>
                  </>
                )}
                <InvoiceContactColumn icon={col.icon} label={col.label} value={col.value} />
              </Fragment>
            ))}
          </div>
          {clinic.gstin && (
            <p
              className="px-4 py-2 text-xs font-normal text-slate-600 sm:px-5"
              style={{ borderTop: `1px solid ${INVOICE_CONTACT.divider}` }}
            >
              GSTIN {clinic.gstin}
            </p>
          )}
        </section>
      )}

      <div className="relative px-6 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5 md:px-10 md:pb-10 print:p-8">
        {/* Doctor + Patient */}
        <div className="mb-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-3">
              <Stethoscope className="h-5 w-5 text-teal-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Consulting doctor</h2>
            </div>
            <div className="space-y-4">
              <DetailRow icon={User} label="Name" value={invoice.doctor_name || '—'} />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Contact</p>
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600">
                  <span>{invoice.doctor_phone || '—'}</span>
                  <span className="font-mono font-semibold text-slate-900">{invoice.invoice_number}</span>
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-3">
              <User className="h-5 w-5 text-teal-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Billed to</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Patient</p>
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-base font-bold text-slate-900">{invoice.patient_name || '—'}</span>
                  {(age != null || gender) && (
                    <span className="text-sm font-normal text-slate-500">
                      {[age != null ? `${age} yrs` : null, gender].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Phone</p>
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-slate-600">
                  <span>{invoice.patient_phone || '—'}</span>
                  {visitDate && <span>{visitDate}</span>}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Billing table */}
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Billing summary</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide">Description</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide">Unit price</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((it, idx) => (
                  <tr
                    key={it.id}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800">{it.description}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{it.quantity}</td>
                    <td className="px-4 py-3.5 text-right text-slate-600">{formatMoney(it.unit_price)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatMoney(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Payment summary */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <Wallet className="h-5 w-5 shrink-0 text-teal-700" />
              <span className="text-xs font-bold uppercase leading-none tracking-wider text-slate-600">
                Payment
              </span>
              <PaymentStatusPill status={invoice.payment_status} />
            </div>
            <div className="space-y-3 text-sm">
              <div className="text-sm text-slate-600">
                <span>Paid </span>
                <span className="font-semibold text-slate-900">{formatMoney(invoice.paid_amount)}</span>
                <span> {words}</span>
              </div>
              <div className="border-t border-slate-100 pt-3 text-sm text-slate-600">
                <span>Balance </span>
                <span className={balance > 0 ? 'font-semibold text-amber-700' : 'font-semibold text-slate-800'}>
                  {formatMoney(balance)}
                </span>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/30 p-5 shadow-sm">
            <div className="space-y-3 text-sm">
              {[
                ['Subtotal', formatMoney(invoice.subtotal)],
                [`Tax (${Number(invoice.tax_percent || 0)}%)`, formatMoney(invoice.tax_amount)],
                ['Discount', `- ${formatMoney(invoice.discount)}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4 text-slate-600">
                  <span>{label}</span>
                  <span className="font-medium text-slate-800">{val}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-teal-200/80 pt-5">
              <span className="text-sm font-bold uppercase tracking-wide text-teal-800">Amount due</span>
              <span className="text-2xl font-bold tracking-tight text-slate-900">{formatMoney(invoice.total)}</span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="space-y-6 border-t border-slate-200 pt-8">
          <p className="text-center text-sm text-slate-600">
            Thank you for choosing our clinic. We appreciate your trust in our care.
          </p>
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between sm:items-end">
            <div className="text-center sm:text-left">
              <div className="mb-2 h-12 w-40 border-b border-slate-300" />
              <p className="text-xs text-slate-500">Authorized signature</p>
            </div>
            <p className="max-w-xs text-center text-[11px] leading-relaxed text-slate-400 sm:text-right">
              This is a computer-generated invoice. Payment is due as per clinic policy. For billing queries,
              contact the clinic using the details above.
            </p>
          </div>
        </footer>
      </div>
    </article>
  );
}
