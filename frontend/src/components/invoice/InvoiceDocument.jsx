import { FileText, Mail, Phone, Stethoscope, User, Wallet } from 'lucide-react';
import { amountInWords, formatMoney, patientAge } from '../../utils/amountInWords';

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
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${styles[s] || styles.pending}`}
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
  const visitDate = invoice.appointment_date
    ? new Date(invoice.appointment_date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const visitTime = (() => {
    if (!invoice.start_time) return null;
    const [h, m] = String(invoice.start_time).split(':').map(Number);
    if (Number.isNaN(h)) return null;
    const h12 = h % 12 || 12;
    const ampm = h < 12 ? 'am' : 'pm';
    return m != null ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
  })();

  const logoSrc = clinic.logoUrl || null;

  return (
    <article
      className={`invoice-document relative mx-auto w-full max-w-[210mm] overflow-hidden rounded-2xl border border-slate-200/80 bg-white font-sans shadow-[0_8px_40px_-12px_rgba(15,118,110,0.15),0_4px_24px_-8px_rgba(30,41,59,0.08)] ${className}`}
    >
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-teal-600 via-teal-500 to-slate-800" aria-hidden />

      {/* Watermark */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03]"
        aria-hidden
      >
        <Stethoscope className="h-[280px] w-[280px] text-teal-900" strokeWidth={0.5} />
      </div>

      <div className="relative p-6 sm:p-8 md:p-10 print:p-8">
        {/* Header row 1: logo centered; row 2: clinic (left) + invoice (right) */}
        <header className="mb-8 space-y-4 border-b border-slate-100 pb-8">
          <div className="flex justify-center">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt=""
                className="h-14 max-w-[200px] object-contain sm:h-16"
              />
            ) : (
              <p className="text-center text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                {clinic.name || 'Clinic'}
              </p>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
            {(clinic.address || clinic.phone || clinic.email) && (
              <section className="min-w-0 rounded-xl border border-teal-100/80 border-l-4 border-l-teal-600 bg-gradient-to-br from-teal-50/80 to-slate-50/50 px-4 py-3 shadow-sm">
                <h2 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  Clinic details
                </h2>
                <div className="space-y-1.5 text-sm">
                  {clinic.address && (
                    <p className="leading-snug text-slate-700">{clinic.address}</p>
                  )}
                  {(clinic.phone || clinic.email) && (
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium text-slate-800">
                      {clinic.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
                          {clinic.phone}
                        </span>
                      )}
                      {clinic.phone && clinic.email && (
                        <span className="text-slate-400" aria-hidden>
                          ·
                        </span>
                      )}
                      {clinic.email && (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
                          {clinic.email}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </section>
            )}
            <section className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm md:w-[188px]">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Invoice</span>
                <PaymentStatusPill status={invoice.payment_status} />
              </div>
              <p className="font-mono text-sm font-bold text-slate-900">{invoice.invoice_number}</p>
              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                <p>
                  Date{' '}
                  {new Date(invoice.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
                {(visitDate || visitTime) && (
                  <p>Visit {[visitDate, visitTime].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </section>
          </div>
        </header>

        {/* Doctor + Patient */}
        <div className="mb-8 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-200/60 pb-3">
              <Stethoscope className="h-5 w-5 text-teal-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Consulting doctor</h2>
            </div>
            <div className="space-y-4">
              <DetailRow icon={User} label="Name" value={invoice.doctor_name || '—'} />
              <DetailRow icon={Phone} label="Contact" value={invoice.doctor_phone || '—'} />
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
              <DetailRow icon={Phone} label="Phone" value={invoice.patient_phone || '—'} />
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
            <div className="mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-teal-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">Payment</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Status</span>
                <PaymentStatusPill status={invoice.payment_status} />
              </div>
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
