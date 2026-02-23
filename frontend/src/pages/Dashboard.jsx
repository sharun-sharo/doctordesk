import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Users, Calendar, DollarSign, FileText, TrendingUp, TrendingDown, CalendarDays, CircleDollarSign, Stethoscope, UserCircle } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import ClinicalActivityPanel from '../components/dashboard/ClinicalActivityPanel';
import EmptyState from '../components/ui/EmptyState';
import { PageSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function Avatar({ name, className = '' }) {
  const initials = (name || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-teal-100 text-body font-semibold text-primary-700 ${className}`}
    >
      {initials}
    </div>
  );
}

const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">
        ₹{Number(payload[0]?.value ?? 0).toLocaleString('en-IN')}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">Revenue</p>
    </div>
  );
};

export default function Dashboard() {
  const { user, isReceptionist, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [dailyAppointments, setDailyAppointments] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeOverviewTab, setActiveOverviewTab] = useState('today');
  const [allAppointments, setAllAppointments] = useState([]);
  const [allTotal, setAllTotal] = useState(0);
  const [allPage, setAllPage] = useState(1);
  const [allLoading, setAllLoading] = useState(false);

  const ALL_PAGE_SIZE = 25;

  const fetchAppointments = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);
    return api.get('/appointments', { params: { limit: 50, page: 1, date_from: dateFrom } })
      .then((a) => setRecentAppointments(a.data.data?.appointments || []));
  };

  const fetchAllAppointments = (page = 1) => {
    setAllLoading(true);
    api
      .get('/appointments', { params: { limit: ALL_PAGE_SIZE, page } })
      .then((res) => {
        const data = res.data.data;
        setAllAppointments(data?.appointments || []);
        setAllTotal(data?.pagination?.total ?? 0);
      })
      .catch(() => {
        setAllAppointments([]);
        setAllTotal(0);
      })
      .finally(() => setAllLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    if (isSuperAdmin) {
      api.get('/dashboard/stats')
        .then((res) => setStats(res.data.data))
        .catch((err) => console.error('Dashboard fetch error:', err))
        .finally(() => setLoading(false));
      return;
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30);
    const dateFrom = sevenDaysAgo.toISOString().slice(0, 10);

    const requests = [
      api.get('/dashboard/stats'),
      isReceptionist ? Promise.resolve({ data: { data: null } }) : api.get('/dashboard/metrics'),
      isReceptionist ? Promise.resolve({ data: { data: [] } }) : api.get('/dashboard/revenue-chart?range=weekly'),
      api.get('/dashboard/daily-appointment-distribution'),
      api.get('/appointments', { params: { limit: 50, page: 1, date_from: dateFrom } }),
      api.get('/appointments', { params: { limit: 1, page: 1 } }),
    ];
    Promise.all(requests)
      .then(([s, m, r, d, a, allCountRes]) => {
        setStats(s.data.data);
        setMetrics(m.data.data);
        setRevenueChart(r.data.data || []);
        setDailyAppointments(d.data.data || []);
        setRecentAppointments(a.data.data?.appointments || []);
        setAllTotal(allCountRes?.data?.data?.pagination?.total ?? 0);
      })
      .catch((err) => {
        console.error('Dashboard fetch error:', err);
      })
      .finally(() => setLoading(false));
  }, [isReceptionist, isSuperAdmin]);

  useEffect(() => {
    if (activeOverviewTab === 'all') fetchAllAppointments(allPage);
  }, [activeOverviewTab, allPage]);

  const handleAppointmentStatusChange = async (id, newStatus) => {
    await api.put(`/appointments/${id}`, { status: newStatus });
    fetchAppointments();
    if (activeOverviewTab === 'all') fetchAllAppointments(allPage);
  };

  if (loading) return <PageSkeleton />;

  const greeting = getGreeting();
  const displayName = user?.name?.split(/\s+/)[0] || user?.name || 'there';
  const revThisMonth = metrics?.revenueThisMonth ?? stats?.totalRevenue ?? 0;

  const cards = isSuperAdmin
    ? [
        { title: 'Total Doctors', value: stats?.totalDoctors ?? 0, icon: Stethoscope, to: '/doctors', gradientIndex: 0 },
        { title: 'Total Receptionists', value: stats?.totalReceptionists ?? 0, icon: UserCircle, to: '/receptionists', gradientIndex: 1 },
        { title: 'Subscription Revenue', value: `₹${Number(stats?.subscriptionRevenue ?? 0).toLocaleString()}`, icon: CircleDollarSign, to: '/subscriptions', gradientIndex: 2 },
      ]
    : [
        {
          title: 'Total Patients',
          value: stats?.totalPatients ?? 0,
          icon: Users,
          to: '/patients',
          gradientIndex: 0,
        },
        {
          title: "Today's Appointments",
          value: stats?.todayAppointments ?? 0,
          icon: Calendar,
          to: '/appointments',
          gradientIndex: 1,
        },
        ...(isReceptionist
          ? []
          : [
              {
                title: 'Revenue This Month',
                value: `₹${Number(revThisMonth).toLocaleString()}`,
                icon: DollarSign,
                gradientIndex: 2,
              },
            ]),
        {
          title: 'Upcoming',
          value: stats?.upcomingAppointments ?? 0,
          icon: FileText,
          to: '/appointments',
          gradientIndex: 3,
        },
      ];

  const recentEmptyState = (
    <EmptyState
      icon="appointments"
      title="No recent appointments"
      description="Appointments will show here once scheduled."
      actionLabel="Book appointment"
      actionTo="/appointments/new"
    />
  );

  const revenueEmptyState = (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 py-14 px-6 text-center sm:py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <DollarSign className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-slate-800 sm:text-lg">No revenue data yet</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Revenue will appear here once you have invoices.
      </p>
    </div>
  );

  const barFill = (entry, index) => {
    const ratio = revenueChart.length ? entry.revenue / Math.max(...revenueChart.map((d) => d.revenue || 0), 1) : 0;
    const opacity = 0.5 + ratio * 0.5;
    return `rgba(14, 165, 164, ${opacity})`;
  };

  return (
    <div className="min-h-0 space-y-10">
      {/* Greeting */}
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 px-6 py-6 shadow-sm sm:px-8 sm:py-7">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {greeting}, {displayName} 👋
        </h1>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          {isSuperAdmin ? 'Staff and role overview — manage doctors and receptionists.' : 'Here’s your clinic overview for today.'}
        </p>
      </div>

      {/* Stats */}
      <section aria-labelledby="dashboard-overview">
        <h2 id="dashboard-overview" className="sr-only">
          Overview
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {cards.map((c, i) => (
            <StatCard
              key={c.title}
              title={c.title}
              value={c.value}
              icon={c.icon}
              to={c.to}
              gradientIndex={c.gradientIndex ?? i}
            />
          ))}
        </div>
      </section>

      {/* Appointment Overview – hidden for Super Admin */}
      {!isSuperAdmin && (
      <ClinicalActivityPanel
        activeTab={activeOverviewTab}
        onTabChange={(tab) => { setActiveOverviewTab(tab); if (tab === 'all') setAllPage(1); }}
        appointments={activeOverviewTab === 'all' ? allAppointments : recentAppointments}
        loading={loading}
        allLoading={activeOverviewTab === 'all' ? allLoading : false}
        emptyState={recentEmptyState}
        onRefresh={() => { fetchAppointments(); if (activeOverviewTab === 'all') fetchAllAppointments(allPage); }}
        onStatusChange={handleAppointmentStatusChange}
        allTotal={allTotal}
        allPage={allPage}
        allPageSize={ALL_PAGE_SIZE}
        onAllPageChange={(page) => setAllPage(page)}
      />
      )}

      {/* Revenue – hidden for receptionist and Super Admin */}
      {!isReceptionist && !isSuperAdmin && (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 sm:text-2xl">Revenue</h2>
            <p className="mt-1 text-sm text-slate-500">This week (Mon–Sun)</p>
          </div>
        </div>
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="group rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-all duration-200 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600 transition-transform duration-200 group-hover:scale-105">
                <CalendarDays className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">This Month</p>
            </div>
            <p className="mt-3 text-lg font-bold tabular-nums text-slate-900 sm:text-xl">
              ₹{(metrics?.revenueThisMonth ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="group rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-all duration-200 hover:border-slate-200 hover:shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600">
                <Calendar className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Month</p>
            </div>
            <p className="mt-3 text-lg font-bold tabular-nums text-slate-900 sm:text-xl">
              ₹{(metrics?.revenueLastMonth ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="group rounded-xl border border-slate-100 bg-slate-50/80 p-4 transition-all duration-200 hover:shadow-sm">
            <div className="flex items-center gap-2.5">
              {((metrics?.revenueThisMonth ?? 0) - (metrics?.revenueLastMonth ?? 0)) >= 0 ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <TrendingUp className="h-4 w-4" strokeWidth={2} />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <TrendingDown className="h-4 w-4" strokeWidth={2} />
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vs last month</p>
            </div>
            <p className={`mt-3 text-lg font-bold tabular-nums sm:text-xl ${((metrics?.revenueThisMonth ?? 0) - (metrics?.revenueLastMonth ?? 0)) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {((metrics?.revenueThisMonth ?? 0) - (metrics?.revenueLastMonth ?? 0)) >= 0 ? '+' : ''}₹{Math.abs((metrics?.revenueThisMonth ?? 0) - (metrics?.revenueLastMonth ?? 0)).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="group rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 transition-all duration-200 hover:border-emerald-200 hover:shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-200/80 text-emerald-700">
                <CircleDollarSign className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Year to Date</p>
            </div>
            <p className="mt-3 text-lg font-bold tabular-nums text-emerald-800 sm:text-xl">
              ₹{(metrics?.yearToDateRevenue ?? 0).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
        <div className="min-h-[280px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-4 sm:p-5">
          {revenueChart.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={revenueChart}
                margin={{ top: 20, right: 16, left: 8, bottom: 8 }}
                barCategoryGap="16%"
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.7} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  width={44}
                />
                <Tooltip
                  content={<RevenueTooltip />}
                  cursor={{ fill: 'rgba(14, 165, 164, 0.08)' }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} animationDuration={500} animationEasing="ease-out">
                  {revenueChart.map((entry, index) => (
                    <Cell key={index} fill={barFill(entry, index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            revenueEmptyState
          )}
        </div>
      </section>
      )}

      {/* Daily Appointment Distribution – hidden for Super Admin */}
      {!isSuperAdmin && (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800 sm:text-2xl">Daily Appointment Distribution</h2>
          <p className="mt-1 text-sm text-slate-500">Appointments by weekday (Mon–Sun)</p>
        </div>
        {dailyAppointments.length ? (
          <div className="min-h-[220px] rounded-xl border border-slate-100 bg-gradient-to-b from-slate-50/60 to-white p-4 sm:p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyAppointments} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} strokeOpacity={0.6} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip content={({ active, payload, label }) => (active && payload?.length ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg ring-1 ring-black/5">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-1 text-base font-semibold tabular-nums text-slate-900">{payload[0]?.value ?? 0} appointments</p>
                  </div>
                ) : null)} />
                <Bar dataKey="count" fill="#0ea5a4" radius={[6, 6, 0, 0]} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 text-sm text-slate-500">
            No data yet
          </div>
        )}
      </section>
      )}

    </div>
  );
}
