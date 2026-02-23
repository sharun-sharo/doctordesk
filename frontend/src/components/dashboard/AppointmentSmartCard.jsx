import { Link } from 'react-router-dom';
import { Menu as HeadlessMenu } from '@headlessui/react';
import {
  ChevronDown,
  FileText,
  CreditCard,
  Check,
} from 'lucide-react';
import AppointmentStatusBadge, {
  getAppointmentStatusKey,
  getAppointmentStatusConfig,
  STATUS_CONFIG,
  APPOINTMENT_STATUS_OPTIONS,
} from './AppointmentStatusBadge';
import { formatTime12h } from '../../lib/format';

/** Return end time for display: use end_time if valid and different from start, else start + 30 min. */
function getDisplayEndTime(start, end) {
  if (!start) return null;
  const [sh, sm] = String(start).split(':').map(Number);
  const startMins = (sh || 0) * 60 + (sm || 0);
  if (end) {
    const [eh, em] = String(end).split(':').map(Number);
    const endMins = (eh || 0) * 60 + (em || 0);
    if (endMins > startMins) return end;
  }
  const endMins = startMins + 30;
  const eh = Math.floor(endMins / 60) % 24;
  const em = endMins % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function formatDuration(start, end) {
  if (!start) return '—';
  const displayEnd = getDisplayEndTime(start, end);
  if (!displayEnd) return '30 min';
  const [sh, sm] = String(start).split(':').map(Number);
  const [eh, em] = String(displayEnd).split(':').map(Number);
  const mins = (eh - sh) * 60 + (em - (sm || 0));
  return mins > 0 ? `${mins} min` : '30 min';
}

function getVisitType(notes) {
  if (!notes?.trim()) return 'Consultation';
  const n = notes.toLowerCase();
  if (n.includes('follow') || n.includes('follow-up')) return 'Follow-up';
  if (n.includes('emergency') || n.includes('urgent')) return 'Emergency';
  return 'Consultation';
}

const STATUS_BORDER_COLORS = {
  scheduled: 'border-l-amber-500',
  in_progress: 'border-l-blue-500',
  completed: 'border-l-emerald-500',
  cancelled: 'border-l-red-500',
  no_show: 'border-l-gray-500',
};

export default function AppointmentSmartCard({
  appointment,
  onStatusChange,
  isUpdating,
}) {
  const {
    id,
    patient_id,
    patient_name,
    appointment_date,
    start_time,
    end_time,
    status,
    notes,
    doctor_name,
    prescription_count,
    invoice_count,
  } = appointment;
  const hasPrescription = (prescription_count ?? 0) > 0;
  const hasInvoice = (invoice_count ?? 0) > 0;
  const visitType = getVisitType(notes);
  const statusKey = getAppointmentStatusKey(status, appointment);
  const borderClass = STATUS_BORDER_COLORS[statusKey] || STATUS_BORDER_COLORS.scheduled;
  const displayEndTime = getDisplayEndTime(start_time, end_time);
  const badgeConfig = getAppointmentStatusConfig(status, appointment);
  const BadgeIcon = badgeConfig.icon;

  const handleStatusSelect = (newStatus) => {
    if (newStatus !== status) onStatusChange?.(id, newStatus);
  };

  return (
    <article
      className={`group relative overflow-visible rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md ${borderClass} border-l-4`}
    >
      {/* Main row: Time | Center | Status + Actions */}
      <div className="relative z-10 flex flex-col gap-4 p-0 sm:flex-row sm:items-stretch sm:gap-0">
        {/* LEFT: Time + Duration */}
        <div className="flex shrink-0 flex-row items-center gap-4 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:min-w-[140px] sm:flex-col sm:items-start sm:border-b-0 sm:border-r sm:py-5">
          <p className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-[1.75rem]">
            {formatTime12h(start_time)} to {formatTime12h(displayEndTime || end_time)}
          </p>
          <p className="text-sm font-medium text-gray-500">{formatDuration(start_time, end_time)}</p>
        </div>

        {/* CENTER: Patient + Visit + ID + Doctor + Add prescription/billing */}
        <div className="min-w-0 flex-1 px-5 py-4 sm:py-5">
          <p className="font-semibold text-gray-900 truncate text-lg leading-tight">
            {patient_name || '—'}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">{visitType}</p>
          <p className="text-xs text-gray-400">ID #{patient_id}</p>
          {doctor_name && (
            <p className="mt-1 text-xs font-medium text-gray-600">{doctor_name}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {hasPrescription ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                aria-label="Prescription added"
              >
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Prescription added
              </span>
            ) : (
              <Link
                to={`/prescriptions/new?patient_id=${patient_id}&appointment_id=${id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Add prescription
              </Link>
            )}
            {hasInvoice ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                aria-label="Billing added"
              >
                <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Billing added
              </span>
            ) : (
              <Link
                to={`/invoices/new?patient_id=${patient_id}&appointment_id=${id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Add billing
              </Link>
            )}
          </div>
        </div>

        {/* RIGHT: Status dropdown + View/Edit */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:border-t-0 sm:border-l sm:border-gray-100 sm:justify-end sm:py-5 sm:pl-5">
          <HeadlessMenu as="div" className="relative inline-block">
            <HeadlessMenu.Button
              disabled={isUpdating}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex min-w-[8.75rem] items-center justify-between gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 ${badgeConfig.className}`}
              aria-label="Change status"
            >
              <span className="flex items-center gap-1.5">
                <BadgeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {badgeConfig.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </HeadlessMenu.Button>
            <HeadlessMenu.Items
              onClick={(e) => e.stopPropagation()}
              className="absolute left-0 top-full z-50 mt-1.5 max-h-[16rem] w-full min-w-[8.75rem] origin-top-left overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg focus:outline-none"
            >
              {APPOINTMENT_STATUS_OPTIONS.map((opt) => {
                const optConfig = STATUS_CONFIG[opt.value] || STATUS_CONFIG.scheduled;
                const OptIcon = optConfig.icon;
                return (
                  <HeadlessMenu.Item key={opt.value}>
                    {({ active }) => (
                      <button
                        type="button"
                        onClick={() => handleStatusSelect(opt.value)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium ${
                          active ? 'bg-gray-50' : ''
                        } ${opt.value === status ? 'text-primary-600' : 'text-gray-700'}`}
                      >
                        <OptIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {opt.label}
                      </button>
                    )}
                  </HeadlessMenu.Item>
                );
              })}
            </HeadlessMenu.Items>
          </HeadlessMenu>
          <Link
            to={`/appointments/${id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-9 items-center justify-center rounded-lg border-2 border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="View or edit appointment"
          >
            View/Edit
          </Link>
        </div>
      </div>
    </article>
  );
}
