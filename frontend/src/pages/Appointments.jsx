import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Calendar as CalendarIcon, List, Pencil, MessageCircle, Trash2 } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import { formatTime12h } from '../lib/format';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import DatePicker from '../components/ui/DatePicker';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { PageSkeleton } from '../components/ui/Skeleton';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No show' },
];

function getDaysInMonth(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = last.getDate();
  return { startPad, days, first, last };
}

export default function Appointments() {
  const { isDoctor, isAdmin, user } = useAuth();
  const isDoctorOrAdmin = isDoctor || isAdmin;
  const canChangeStatus = [1, 2, 4, 5].includes(user?.roleId);
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [filters, setFilters] = useState(() => {
    const toYMD = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const d = new Date();
    const from = new Date(d);
    from.setDate(from.getDate() - 14);
    const to = new Date(d);
    to.setDate(to.getDate() + 14);
    return {
      status: '',
      date_from: toYMD(from),
      date_to: toYMD(to),
      doctor_id: '',
    };
  });
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState(null);
  const [smsId, setSmsId] = useState(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [view, setView] = useState('list');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [expandedDayKey, setExpandedDayKey] = useState(null);

  const fetch = (page = 1) => {
    setLoading(true);
    const params = { page, limit: 20, ...filters };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    api
      .get('/appointments', { params })
      .then(({ data }) => {
        setList(data.data.appointments);
        setPagination(data.data.pagination);
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  // List view: fetch when page or filters change (via applyFilters / pagination)
  useEffect(() => {
    if (view === 'list') fetch(pagination.page);
  }, [view, pagination.page]);

  // Calendar view: fetch appointments for the displayed month
  useEffect(() => {
    if (view !== 'calendar') return;
    const first = new Date(calendarMonth.year, calendarMonth.month, 1);
    const last = new Date(calendarMonth.year, calendarMonth.month + 1, 0);
    const date_from = first.toISOString().slice(0, 10);
    const date_to = last.toISOString().slice(0, 10);
    setLoading(true);
    const params = { page: 1, limit: 100, date_from, date_to, ...filters };
    Object.keys(params).forEach((k) => !params[k] && delete params[k]);
    api
      .get('/appointments', { params })
      .then(({ data }) => setList(data.data.appointments || []))
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [view, calendarMonth.year, calendarMonth.month, filters.status, filters.doctor_id]);

  useEffect(() => {
    if (!isDoctorOrAdmin) api.get('/users/doctors').then(({ data }) => setDoctors(data.data || []));
  }, [isDoctorOrAdmin]);

  const handleDelete = (id, patientName) => {
    if (!window.confirm(`Delete this appointment${patientName ? ` with ${patientName}` : ''}? This cannot be undone.`)) return;
    api
      .delete(`/appointments/${id}`)
      .then(() => {
        toast.success('Appointment deleted');
        setList((prev) => prev.filter((a) => a.id !== id));
        setPagination((p) => ({ ...p, total: Math.max(0, (p.total || 1) - 1) }));
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Delete failed'));
  };

  const handleCancel = (id) => {
    api.put(`/appointments/${id}`, { status: 'cancelled' }).then(() => {
      toast.success('Appointment cancelled');
      setCancelId(null);
      fetch(pagination.page);
    }).catch(() => toast.error('Failed'));
  };

  const handleStatusChange = (id, newStatus) => {
    api.put(`/appointments/${id}`, { status: newStatus }).then(() => {
      toast.success('Status updated');
      fetch(pagination.page);
    }).catch(() => toast.error('Failed to update'));
  };

  const getDefaultSmsMessage = (row) => {
    const longDateStr = new Date(row.appointment_date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = formatTime12h(row.start_time);
    return `Hi ${row.patient_name}, your appointment with ${row.doctor_name || 'your doctor'} is on ${longDateStr}${timeStr !== '—' ? ` at ${timeStr}` : ''}. - DoctorDesk`;
  };

  const handleSendSms = (row) => {
    setSmsId(row.id);
    setSmsMessage(getDefaultSmsMessage(row));
  };

  const confirmSendSms = () => {
    if (!smsId) return;
    setSmsSending(true);
    const payload = smsMessage.trim() ? { message: smsMessage.trim() } : {};
    api
      .post(`/appointments/${smsId}/send-sms`, payload)
      .then(() => {
        toast.success('SMS sent');
        setSmsId(null);
        setSmsMessage('');
        fetch(pagination.page);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'Failed to send SMS';
        if (msg.includes('not configured')) {
          toast.error('SMS not set up. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM to backend/.env');
        } else {
          toast.error(msg);
        }
      })
      .finally(() => setSmsSending(false));
  };

  const columns = [
    { key: 'appointment_date', header: 'Date', render: (v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) },
    { key: 'start_time', header: 'Time', render: (v) => formatTime12h(v) },
    { key: 'patient_name', header: 'Patient' },
    ...(!isDoctorOrAdmin ? [{ key: 'doctor_name', header: 'Doctor' }] : []),
    {
      key: 'status',
      header: 'Status',
      render: (v, row) =>
        canChangeStatus ? (
          <select
            value={v}
            onChange={(e) => handleStatusChange(row.id, e.target.value)}
            className={`min-h-[38px] rounded-lg border bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-0 ${
              v === 'completed'
                ? 'text-green-600 border-green-200 focus:border-green-500 focus:ring-green-500/20'
                : v === 'cancelled'
                  ? 'text-red-600 border-red-200 focus:border-red-500 focus:ring-red-500/20'
                  : 'text-slate-700 border-slate-200 focus:border-primary-500 focus:ring-primary-500/20'
            }`}
          >
            {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={v} />
        ),
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSendSms(row)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm text-slate-600 border border-slate-200 transition-colors hover:bg-green-50 hover:border-green-200 hover:text-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            aria-label="Send SMS"
            title="Send SMS to patient"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>Send SMS</span>
          </button>
          <Link
            to={`/appointments/${row.id}/edit`}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => handleDelete(row.id, row.patient_name)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            aria-label="Delete appointment"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {row.status === 'scheduled' && (
            <>
              <span className="h-4 w-px bg-slate-200" aria-hidden />
              <button
                type="button"
                onClick={() => setCancelId(row.id)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const applyFilters = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    fetch(1);
  };

  const { startPad, days, first, last } = getDaysInMonth(calendarMonth.year, calendarMonth.month);
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const calendarDays = [];
  for (let i = 0; i < startPad; i++) calendarDays.push(null);
  for (let d = 1; d <= days; d++) calendarDays.push(new Date(calendarMonth.year, calendarMonth.month, d));
  const getAppointmentsForDay = (date) => {
    if (!date) return [];
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const toYMD = (v) => (v && typeof v === 'string' ? v.slice(0, 10) : v ? new Date(v).toISOString().slice(0, 10) : '');
    return list.filter((a) => toYMD(a.appointment_date) === key);
  };

  const emptyState = (
    <EmptyState
      icon="appointments"
      title="No appointments"
      description="Filter by date or status, or book a new appointment."
      actionLabel="New appointment"
      actionTo="/appointments/new"
    />
  );

  return (
    <div className="space-y-8">
      {/* Page title + primary action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Appointments</h1>
        <Link
          to="/appointments/new"
          className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="h-5 w-5 shrink-0" /> New Appointment
        </Link>
      </div>

      {/* View toggle */}
      <div>
        <p className="mb-3 text-sm font-medium text-slate-600">View</p>
        <div className="tabs-pill inline-flex w-full sm:w-auto flex sm:inline-flex" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={`tab-pill flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 touch-manipulation ${view === 'list' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
          >
            <List className="h-4 w-4 shrink-0" /> List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'calendar'}
            onClick={() => setView('calendar')}
            className={`tab-pill flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 touch-manipulation ${view === 'calendar' ? 'tab-pill-active' : 'tab-pill-inactive'}`}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" /> Calendar
          </button>
        </div>
      </div>

      {/* Filters card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <p className="mb-4 text-sm font-medium text-slate-600">Filters</p>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-4 sm:gap-x-6 sm:gap-y-5">
          {!isDoctorOrAdmin && (
            <div className="w-full sm:min-w-[160px] sm:max-w-[200px]">
              <label className="input-label block mb-1.5">Doctor</label>
              <select
                value={filters.doctor_id || ''}
                onChange={(e) => setFilters((f) => ({ ...f, doctor_id: e.target.value || undefined }))}
                className="input-field w-full min-h-[44px]"
              >
                <option value="">All</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="w-full min-w-0 sm:min-w-[240px]">
            <label className="input-label block mb-1.5">Status</label>
            <div className="flex flex-wrap gap-2 min-h-[44px] items-center touch-manipulation">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value || 'all'}
                  type="button"
                  onClick={() => setFilters((f) => ({ ...f, status: opt.value }))}
                  className={`min-h-[38px] px-4 rounded-lg border text-sm font-medium transition-colors ${
                    (filters.status || '') === opt.value
                      ? 'bg-primary-100 text-primary-700 border-primary-200'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full sm:min-w-[160px] sm:max-w-[180px]">
            <DatePicker
              label="From"
              value={filters.date_from || ''}
              onChange={(v) => setFilters((f) => ({ ...f, date_from: v || undefined }))}
              placeholder="Start date"
            />
          </div>
          <div className="w-full sm:min-w-[160px] sm:max-w-[180px]">
            <DatePicker
              label="To"
              value={filters.date_to || ''}
              onChange={(v) => setFilters((f) => ({ ...f, date_to: v || undefined }))}
              placeholder="End date"
            />
          </div>
          <button
            type="button"
            onClick={applyFilters}
            className="btn-primary min-h-[44px] w-full sm:w-auto px-5"
          >
            Apply
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 shadow-sm overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 leading-relaxed">Calendar</h2>
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="min-w-[200px] text-center text-base font-semibold text-gray-800">{monthLabel}</span>
              <button
                type="button"
                onClick={() => setCalendarMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 }))}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                aria-label="Next month"
              >
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="bg-gray-50 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                {d}
              </div>
            ))}
            {calendarDays.map((date, i) => {
              const appointments = getAppointmentsForDay(date);
              const isToday = date && new Date().toDateString() === date.toDateString();
              const dayKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : null;
              const isExpanded = expandedDayKey === dayKey;
              const showMore = appointments.length > 2 && !isExpanded;
              return (
                <div
                  key={i}
                  className={`min-h-[88px] p-2 relative ${date ? 'bg-white' : 'bg-gray-50/80'}`}
                >
                  {date && (
                    <>
                      <span className={`inline-flex h-8 min-w-[1.75rem] items-center justify-center rounded-lg px-1.5 text-sm font-medium ${isToday ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}>
                        {date.getDate()}
                      </span>
                      <div className="mt-1.5 space-y-1">
                        {!isExpanded && appointments.slice(0, 2).map((a) => (
                          <Link
                            key={a.id}
                            to={`/appointments/${a.id}/edit`}
                            className={`block truncate rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                              a.status === 'completed' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : a.status === 'cancelled' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {formatTime12h(a.start_time)} {a.patient_name}
                          </Link>
                        ))}
                        {showMore && (
                          <button
                            type="button"
                            onClick={() => setExpandedDayKey(dayKey)}
                            className="w-full rounded-lg px-2 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors text-left"
                          >
                            +{appointments.length - 2} more
                          </button>
                        )}
                        {isExpanded && (
                          <div className="max-h-[160px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm py-1 pr-0.5 space-y-0.5">
                            {appointments.map((a) => (
                              <Link
                                key={a.id}
                                to={`/appointments/${a.id}/edit`}
                                className={`block truncate rounded-md px-2 py-1.5 text-xs font-medium transition-colors mx-1 ${
                                  a.status === 'completed' ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : a.status === 'cancelled' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {formatTime12h(a.start_time)} {a.patient_name}
                              </Link>
                            ))}
                            <button
                              type="button"
                              onClick={() => setExpandedDayKey(null)}
                              className="w-full rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 mt-1 mx-1"
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <DataTable
            columns={columns}
            data={list}
            keyField="id"
            pagination={pagination}
            onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
            loading={loading}
            emptyState={emptyState}
            emptyMessage="No appointments"
          />
        </div>
      )}

      {/* Floating CTA (visible on scroll on list view) */}
      <Link
        to="/appointments/new"
        className="fixed bottom-8 right-8 z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-elevated transition-all hover:bg-primary-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 lg:hidden"
        aria-label="New appointment"
      >
        <Plus className="h-7 w-7" />
      </Link>

      <Modal open={!!cancelId} onClose={() => setCancelId(null)} title="Cancel appointment?">
        <p className="text-body text-content-muted mb-6">The patient can be rebooked later.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setCancelId(null)} className="btn-secondary">Keep</button>
          <button type="button" onClick={() => handleCancel(cancelId)} className="btn-danger">Cancel appointment</button>
        </div>
      </Modal>

      <Modal open={!!smsId} onClose={() => { setSmsId(null); setSmsMessage(''); }} title="Send SMS to patient">
        <p className="text-sm text-slate-600 mb-3">A message will be sent to the patient&apos;s phone. Edit the text below if you want to change the reminder.</p>
        <textarea
          value={smsMessage}
          onChange={(e) => setSmsMessage(e.target.value)}
          placeholder="Appointment reminder message..."
          className="input-field w-full min-h-[100px] resize-y mb-4"
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => { setSmsId(null); setSmsMessage(''); }} className="btn-secondary">Cancel</button>
          <button type="button" onClick={confirmSendSms} disabled={smsSending} className="btn-primary inline-flex items-center gap-2">
            {smsSending ? 'Sending…' : 'Send SMS'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
