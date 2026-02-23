import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  Circle,
  XCircle,
  UserX,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Modal from '../ui/Modal';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import AppointmentSmartCard from './AppointmentSmartCard';
import AppointmentCardSkeleton from './AppointmentCardSkeleton';

const TAB_VALUES = [
  { value: 'all' },
  { value: 'today' },
  { value: 'upcoming' },
  { value: 'completed' },
  { value: 'cancelled' },
];

const STATUS_CONFIG = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full',
    icon: Clock,
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full',
    icon: CheckCircle,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full',
    icon: Circle,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full',
    icon: XCircle,
  },
  no_show: {
    label: 'No Show',
    className: 'bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full',
    icon: UserX,
  },
};

function getStatusConfig(status, appointment) {
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
    if (isToday && now >= slotStart && now < slotEnd) {
      return STATUS_CONFIG.in_progress;
    }
  }
  return STATUS_CONFIG[s] || STATUS_CONFIG.scheduled;
}

// Normalize date to YYYY-MM-DD format for comparison
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  // Handle both Date objects and strings
  const d = typeof dateStr === 'string' ? dateStr : dateStr.toISOString();
  return d.slice(0, 10);
}

// Parse start_time to minutes since midnight for sorting (e.g. "09:30" or "09:30:00" -> 570)
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.trim().split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  return h * 60 + m;
}

// Sort appointments by date then start_time (current time to next / chronological)
function sortByTimeAsc(list) {
  return [...list].sort((a, b) => {
    const dateA = normalizeDate(a.appointment_date);
    const dateB = normalizeDate(b.appointment_date);
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
}

export default function ClinicalActivityPanel({
  appointments = [],
  loading = false,
  allLoading = false,
  activeTab: controlledActiveTab,
  onTabChange,
  emptyState,
  onRefresh,
  onStatusChange: onStatusChangeProp,
  allTotal = 0,
  allPage = 1,
  allPageSize = 5,
  onAllPageChange,
}) {
  const [internalTab, setInternalTab] = useState('today');
  const activeTab = controlledActiveTab !== undefined && controlledActiveTab !== null ? controlledActiveTab : internalTab;
  const setActiveTab = (tab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };
  const [cancelAppointment, setCancelAppointment] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const today = normalizeDate(new Date().toISOString());

  const handleStatusChange = async (id, newStatus) => {
    if (!onStatusChangeProp) return;
    setUpdatingId(id);
    try {
      await onStatusChangeProp(id, newStatus);
    } catch (e) {
      toast.error('Could not update appointment');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelRequest = (appointment) => setCancelAppointment(appointment);
  const handleCancelConfirm = async () => {
    if (!cancelAppointment) return;
    setCancelling(true);
    try {
      await api.put(`/appointments/${cancelAppointment.id}`, { status: 'cancelled' });
      toast.success('Appointment cancelled');
      setCancelAppointment(null);
      onRefresh?.();
    } catch (e) {
      toast.error('Could not cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  const filtered = useMemo(() => {
    if (!appointments.length) return [];
    let list;
    switch (activeTab) {
      case 'today':
        list = appointments.filter((a) => normalizeDate(a.appointment_date) === today);
        break;
      case 'upcoming':
        list = appointments.filter(
          (a) => normalizeDate(a.appointment_date) >= today && (a.status === 'scheduled' || a.status === 'no_show')
        );
        break;
      case 'completed':
        list = appointments.filter((a) => a.status === 'completed');
        break;
      case 'cancelled':
        list = appointments.filter((a) => a.status === 'cancelled');
        break;
      default:
        list = appointments;
    }
    return sortByTimeAsc(list);
  }, [appointments, activeTab, today]);

  const tabCounts = useMemo(() => {
    const todayList = appointments.filter((a) => normalizeDate(a.appointment_date) === today);
    const upcomingList = appointments.filter(
      (a) => normalizeDate(a.appointment_date) >= today && (a.status === 'scheduled' || a.status === 'no_show')
    );
    return {
      all: onTabChange != null ? allTotal : appointments.length,
      today: todayList.length,
      upcoming: upcomingList.length,
      completed: appointments.filter((a) => a.status === 'completed').length,
      cancelled: appointments.filter((a) => a.status === 'cancelled').length,
    };
  }, [appointments, today, onTabChange, allTotal]);

  const tabOptions = useMemo(
    () =>
      TAB_VALUES.map(({ value }) => ({
        value,
        label: value === 'all' ? `All (${tabCounts.all})` : `${value.charAt(0).toUpperCase() + value.slice(1)} (${tabCounts[value]})`,
      })),
    [tabCounts]
  );

  const showLoading = activeTab === 'all' ? allLoading : loading;
  const totalAllPages = allPageSize > 0 ? Math.ceil(allTotal / allPageSize) : 0;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm mb-8 transition-shadow hover:shadow-md">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">Appointment Overview</h2>
          <p className="mt-1 text-sm text-slate-500">Manage and track your appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/appointments"
            className="text-sm font-medium text-slate-600 hover:text-primary-600 transition-colors rounded-lg px-3 py-1.5 hover:bg-slate-50"
          >
            View all
          </Link>
          <Link
            to="/appointments/new"
            className="btn-primary inline-flex items-center justify-center gap-2 text-sm min-h-[40px] px-4 shadow-sm hover:shadow-md transition-shadow"
          >
            Book appointment
          </Link>
        </div>
      </div>

      {/* Filter tabs with counts */}
      <div className="mb-6 rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50/50 to-white p-1.5 shadow-sm">
        <div className="tabs-pill border-0 bg-transparent p-0" role="tablist" aria-label="Appointments filter">
          {tabOptions.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.value)}
                className={`relative rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:ring-offset-1 ${
                  isActive
                    ? 'bg-white text-primary-700 shadow-md font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span className="relative z-10">{tab.label}</span>
                {isActive && (
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-50 to-white border border-primary-100/50" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards list */}
      {showLoading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
          <AppointmentCardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        appointments.length === 0 && emptyState ? (
          emptyState
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white/60 py-14 text-center">
            <p className="text-body text-content-muted">
              {activeTab === 'today'
                ? 'No appointments today.'
                : activeTab === 'upcoming'
                  ? 'No upcoming appointments.'
                  : `No ${activeTab} appointments.`}
            </p>
          </div>
        )
      ) : (
        <>
          <div className="space-y-4">
            {filtered.map((apt) => (
              <AppointmentSmartCard
                key={apt.id}
                appointment={apt}
                onStatusChange={onStatusChangeProp ? handleStatusChange : undefined}
                isUpdating={updatingId === apt.id}
              />
            ))}
          </div>
          {activeTab === 'all' && onAllPageChange && totalAllPages > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4">
            <p className="text-sm text-slate-600">
              Page {allPage} of {totalAllPages}
              {allTotal > 0 && (
                <span className="ml-1 text-slate-500">({allTotal} total)</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAllPageChange(allPage - 1)}
                disabled={allPage <= 1 || allLoading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => onAllPageChange(allPage + 1)}
                disabled={allPage >= totalAllPages || allLoading}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          )}
        </>
      )}

      {/* Cancel confirmation modal */}
      <Modal
        open={!!cancelAppointment}
        onClose={() => !cancelling && setCancelAppointment(null)}
        title="Cancel appointment?"
        size="sm"
      >
        {cancelAppointment && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Cancel appointment with <strong>{cancelAppointment.patient_name}</strong>
              {cancelAppointment.appointment_date && (
                <> on {new Date(cancelAppointment.appointment_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</>
              )}
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelAppointment(null)}
                disabled={cancelling}
                className="btn-secondary"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={cancelling}
                className="btn-danger inline-flex items-center gap-2"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel appointment
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
