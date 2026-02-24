import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Bell, ChevronDown, Plus, Calendar } from 'lucide-react';
import { Menu as HeadlessMenu } from '@headlessui/react';
import Logo from './Logo';
import api from '../../api/axios';

const pageTitles = {
  '/': 'Dashboard',
  '/doctors': 'Doctors',
  '/receptionists': 'Receptionists',
  '/patients': 'Patients',
  '/patients/new': 'Add Patient',
  '/walk-ins': 'Walk-ins',
  '/appointments': 'Appointments',
  '/appointments/new': 'New Appointment',
  '/invoices': 'Billing',
  '/invoices/new': 'New Invoice',
  '/prescriptions': 'Prescriptions',
  '/prescriptions/new': 'New Prescription',
  '/medicines': 'Inventory',
  '/medicines/new': 'Add Medicine',
  '/reports': 'AI Insights',
  '/reports/detailed': 'Reports',
  '/revenue': 'Revenue',
  '/users': 'Users',
  '/users/new': 'Add User',
  '/activity/logs': 'Activity Logs',
  '/activity/login-history': 'Login History',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

function getPageTitle(pathname) {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith('/patients/')) return pathname.endsWith('/edit') ? 'Edit Patient' : 'Patient';
  if (pathname.startsWith('/appointments/')) return pathname.endsWith('/edit') ? 'Edit Appointment' : 'Appointment';
  if (pathname.startsWith('/invoices/')) return 'Invoice';
  if (pathname.startsWith('/prescriptions/')) return pathname.endsWith('/edit') ? 'Edit Prescription' : 'Prescription';
  if (pathname.startsWith('/medicines/')) return pathname.endsWith('/edit') ? 'Edit Medicine' : 'Medicine';
  if (pathname.startsWith('/users/')) return pathname.endsWith('/edit') ? 'Edit User' : 'User';
  return 'DoctorDesk.me';
}

function getInitials(name) {
  const s = typeof name === 'string' ? name.trim() : '';
  if (!s) return '?';
  return s
    .split(/\s+/)
    .map((part) => (part && part[0]) || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
}

function formatTime(str) {
  if (!str) return '—';
  const [h, m] = String(str).split(':').map(Number);
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

export default function Header({
  onMenuClick,
  searchValue,
  onSearchChange,
  user,
}) {
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);
  const [notificationAppointments, setNotificationAppointments] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const fetchNotificationAppointments = () => {
    setNotificationLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    api
      .get('/appointments', { params: { date_from: today, date_to: tomorrow, limit: 15, page: 1 } })
      .then(({ data }) => {
        const list = data?.data?.appointments || [];
        const sorted = [...list].sort((a, b) => {
          const d = (x) => (x.appointment_date || '') + (x.start_time || '');
          return d(a).localeCompare(d(b));
        });
        setNotificationAppointments(sorted);
      })
      .catch(() => setNotificationAppointments([]))
      .finally(() => setNotificationLoading(false));
  };

  useEffect(() => {
    fetchNotificationAppointments();
    const interval = setInterval(fetchNotificationAppointments, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 min-h-[44px] sm:h-16 items-center gap-2 sm:gap-3 border-b border-slate-200/80 bg-white/80 px-3 pt-[env(safe-area-inset-top,0)] shadow-glass backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-xl p-2 text-content-muted transition-colors hover:bg-slate-100 hover:text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
      <Link
        to="/"
        className="hidden items-center sm:flex lg:hidden"
        aria-label="DoctorDesk.me – Home"
      >
        <Logo compact className="py-0.5" />
      </Link>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-content sm:text-h1">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-3">
        {onSearchChange && (
          <div className="hidden max-w-[220px] flex-1 md:block lg:max-w-xs">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchValue || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50/80 py-2.5 pl-10 pr-4 text-body text-content placeholder-slate-400 shadow-soft transition-all duration-200 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        )}

        <Link
          to="/appointments/new"
          className="btn-primary hidden items-center gap-2 sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">New Appointment</span>
          <span className="lg:hidden">New</span>
        </Link>

        <HeadlessMenu as="div" className="relative">
          <HeadlessMenu.Button
            type="button"
            className="relative rounded-xl p-2.5 text-content-muted transition-colors hover:bg-slate-100 hover:text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {notificationAppointments.length > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" aria-hidden />
            )}
          </HeadlessMenu.Button>
          <HeadlessMenu.Items className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-[min(70vh,420px)] overflow-auto origin-top-right rounded-2xl border border-slate-200 bg-white shadow-elevated focus:outline-none z-50">
            <div className="sticky top-0 border-b border-slate-100 bg-white px-4 py-3 rounded-t-2xl">
              <h3 className="font-semibold text-content flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary-600" />
                Appointments
              </h3>
              <p className="text-xs text-content-muted mt-0.5">Today &amp; tomorrow</p>
            </div>
            <div className="py-1">
              {notificationLoading ? (
                <div className="px-4 py-6 text-center text-sm text-content-muted">Loading…</div>
              ) : notificationAppointments.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-content-muted">No upcoming appointments</div>
              ) : (
                notificationAppointments.map((a) => (
                  <HeadlessMenu.Item key={a.id}>
                    {({ active }) => (
                      <Link
                        to={`/appointments/${a.id}/edit`}
                        className={`flex flex-col gap-0.5 px-4 py-3 border-b border-slate-50 last:border-0 ${active ? 'bg-slate-50' : ''}`}
                      >
                        <span className="font-medium text-content truncate">{a.patient_name}</span>
                        <span className="text-xs text-content-muted">
                          {a.appointment_date} · {formatTime(a.start_time)}
                          {a.doctor_name ? ` · ${a.doctor_name}` : ''}
                        </span>
                        {a.status && (
                          <span className="text-xs text-primary-600 capitalize">{a.status.replace('_', ' ')}</span>
                        )}
                      </Link>
                    )}
                  </HeadlessMenu.Item>
                ))
              )}
            </div>
            <div className="sticky bottom-0 border-t border-slate-100 bg-slate-50/80 px-4 py-2 rounded-b-2xl">
              <Link
                to="/appointments"
                className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700 py-1.5"
              >
                View all appointments
              </Link>
            </div>
          </HeadlessMenu.Items>
        </HeadlessMenu>

        <HeadlessMenu as="div" className="relative">
          <HeadlessMenu.Button className="flex min-h-[44px] min-w-[44px] items-center justify-center sm:justify-start gap-2 rounded-xl py-1.5 pl-1 pr-2.5 text-body font-medium text-content transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 touch-manipulation">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white shadow-soft">
              {getInitials(user?.name)}
            </span>
            <span className="hidden max-w-[8rem] truncate sm:inline">{user?.name}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 hidden sm:block" />
          </HeadlessMenu.Button>
          <HeadlessMenu.Items className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] origin-top-right rounded-2xl border border-slate-200 bg-white py-1 shadow-elevated focus:outline-none z-50">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate font-medium text-content">{user?.name}</p>
              <p className="truncate text-caption text-content-muted">{user?.email}</p>
            </div>
            <HeadlessMenu.Item>
              {({ active }) => (
                <span
                  className={`block px-4 py-2.5 text-body capitalize text-content-muted ${active ? 'bg-slate-50' : ''}`}
                >
                  {user?.roleName?.replace('_', ' ')}
                </span>
              )}
            </HeadlessMenu.Item>
          </HeadlessMenu.Items>
        </HeadlessMenu>
      </div>
    </header>
  );
}
