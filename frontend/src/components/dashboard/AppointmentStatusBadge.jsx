/**
 * Premium status badge for appointments.
 * Scheduled → amber, In Progress → blue, Completed → green, Cancelled → red, No Show → gray.
 */
import { Clock, Circle, CheckCircle, XCircle, UserX } from 'lucide-react';

export const STATUS_CONFIG = {
  scheduled: {
    label: 'Scheduled',
    icon: Clock,
    className: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dotClassName: 'bg-amber-500',
  },
  in_progress: {
    label: 'In Progress',
    icon: Circle,
    className: 'bg-blue-50 text-blue-700 border-blue-200/80',
    dotClassName: 'bg-blue-500',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dotClassName: 'bg-emerald-500',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200/80',
    dotClassName: 'bg-red-500',
  },
  no_show: {
    label: 'No Show',
    icon: UserX,
    className: 'bg-gray-100 text-gray-700 border-gray-200/80',
    dotClassName: 'bg-gray-500',
  },
};

/** Options for status dropdown (stored values). in_progress is derived from time, not stored. */
export const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? dateStr : dateStr.toISOString?.() ?? '';
  return String(d).slice(0, 10);
}

/** Returns effective status key: scheduled | in_progress | completed | cancelled | no_show */
export function getAppointmentStatusKey(status, appointment) {
  const s = (status || 'scheduled').toLowerCase();
  if (s === 'scheduled' && appointment) {
    const today = normalizeDate(new Date().toISOString());
    const isToday = normalizeDate(appointment.appointment_date) === today;
    const start = appointment.start_time || '';
    const [h, m] = start.split(':').map(Number);
    const now = new Date();
    const slotStart = new Date(now);
    slotStart.setHours(h || 0, m || 0, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
    if (isToday && now >= slotStart && now < slotEnd) return 'in_progress';
  }
  return s in STATUS_CONFIG ? s : 'scheduled';
}

export function getAppointmentStatusConfig(status, appointment) {
  const key = getAppointmentStatusKey(status, appointment);
  return STATUS_CONFIG[key] || STATUS_CONFIG.scheduled;
}

export default function AppointmentStatusBadge({ status, appointment, showIcon = true, className = '' }) {
  const config = getAppointmentStatusConfig(status, appointment);
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${config.className} ${className}`}
      role="status"
      aria-label={`Status: ${config.label}`}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {config.label}
    </span>
  );
}
