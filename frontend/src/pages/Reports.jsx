import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { PageSkeleton, ChartSkeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import AIInsightsView from '../components/ai-insights/AIInsightsView';
import ReportsDetailView from '../components/reports/ReportsDetailView';
import DatePicker from '../components/ui/DatePicker';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Download, FileSpreadsheet, Stethoscope, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Tabs from '../components/ui/Tabs';
import * as XLSX from 'xlsx';

const RANGES = [
  { key: '7D', label: '7D' },
  { key: '30D', label: '30D' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All time' },
  { key: 'CUSTOM', label: 'Custom' },
];

function getRangeDates(range, customFrom, customTo) {
  if (range === 'ALL') return { from: null, to: null, isAllTime: true };
  if (range === 'CUSTOM' && customFrom && customTo) return { from: customFrom, to: customTo, isAllTime: false };
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  if (range === '7D') from.setDate(from.getDate() - 7);
  else if (range === '30D') from.setDate(from.getDate() - 30);
  else if (range === '6M') from.setMonth(from.getMonth() - 6);
  else from.setFullYear(from.getFullYear() - 1);
  from.setHours(0, 0, 0, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    isAllTime: false,
  };
}

const PIE_COLORS = ['#0EA5A4', '#2563EB', '#94a3b8', '#f59e0b', '#EF4444'];

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function getDefaultCustomDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const REPORT_VIEW_TABS = [
  { value: 'insights', label: 'AI Insights' },
  { value: 'reports', label: 'Reports' },
];

export default function Reports() {
  const { isSuperAdmin, isReceptionist, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDetailedPath = location.pathname === '/reports/detailed' || location.pathname.endsWith('/reports/detailed');
  const [reportView, setReportView] = useState(isDetailedPath ? 'reports' : 'insights');

  useEffect(() => {
    const detailed = location.pathname === '/reports/detailed' || location.pathname.endsWith('/reports/detailed');
    setReportView(detailed ? 'reports' : 'insights');
  }, [location.pathname]);

  const handleReportViewChange = (view) => {
    setReportView(view);
    if (view === 'reports') navigate('/reports/detailed');
    else navigate('/reports');
  };
  const [range, setRange] = useState('6M');
  const defaultCustom = getDefaultCustomDates();
  const [customFrom, setCustomFrom] = useState(defaultCustom.from);
  const [customTo, setCustomTo] = useState(defaultCustom.to);
  const [metrics, setMetrics] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [appointmentSummary, setAppointmentSummary] = useState([]);
  const [doctorPerf, setDoctorPerf] = useState([]);
  const [superAdminSummary, setSuperAdminSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  // Receptionist: appointments report data
  const [reportAppointments, setReportAppointments] = useState([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportLoading, setReportLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  const { from, to, isAllTime } = getRangeDates(range, customFrom, customTo);
  const isDaily = range === '7D' || range === '30D';

  useEffect(() => {
    if (isReceptionist) {
      setReportLoading(true);
      const params = { limit: 500, page: 1 };
      if (!isAllTime && from && to) {
        params.date_from = from;
        params.date_to = to;
      }
      api.get('/appointments', { params })
        .then((res) => {
          const data = res.data?.data;
          setReportAppointments(data?.appointments || []);
          setReportTotal(data?.pagination?.total ?? 0);
        })
        .catch(() => {
          setReportAppointments([]);
          setReportTotal(0);
        })
        .finally(() => setReportLoading(false));
      return;
    }
    if (isSuperAdmin) {
      setLoading(true);
      const params = isAllTime ? { all: '1' } : { from, to };
      api.get('/reports/super-admin-summary', { params })
        .then((res) => setSuperAdminSummary(res.data.data))
        .catch(() => setSuperAdminSummary(null))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    const params = isAllTime ? { all: '1' } : { from, to };
    Promise.all([
      api.get('/dashboard/metrics'),
      api.get('/reports/revenue', {
        params: isAllTime ? { all: '1' } : isDaily ? { period: 'daily', from, to } : { period: 'monthly' },
      }),
      api.get('/reports/appointment-summary', { params }),
      api.get('/reports/doctor-performance', { params }),
    ])
      .then(([m, r, a, d]) => {
        setMetrics(m.data.data || null);
        let revData = r.data.data || [];
        if (!isDaily && revData.length && range !== 'ALL') {
          const take = range === '6M' ? 6 : 12;
          revData = revData.slice(-take);
        }
        setRevenue(revData);
        setAppointmentSummary(a.data.data || []);
        setDoctorPerf(d.data?.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range, isSuperAdmin, isReceptionist, from, to, isAllTime, customFrom, customTo]);


  const handleDownloadAppointmentsPdf = () => {
    setDownloadingPdf(true);
    const token = localStorage.getItem('accessToken');
    const q = new URLSearchParams();
    if (isAllTime) q.set('all', '1');
    else if (from && to) {
      q.set('from', from);
      q.set('to', to);
    }
    fetch(`${API_BASE}/reports/appointments-pdf?${q.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appointments-report-${from || 'all'}-${to || ''}-${Date.now()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF downloaded');
      })
      .catch(() => toast.error('Failed to download PDF'))
      .finally(() => setDownloadingPdf(false));
  };

  const handleDownloadAppointmentsXlsx = () => {
    setDownloadingXlsx(true);
    try {
      const headers = ['Date', 'Time', 'Patient', 'Doctor', 'Status', 'Notes'];
      const rows = reportAppointments.map((a) => [
        a.appointment_date || '',
        [a.start_time, a.end_time].filter(Boolean).join(' – '),
        a.patient_name || '—',
        a.doctor_name || '—',
        (a.status || 'scheduled').replace(/_/g, ' '),
        a.notes || '—',
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Appointments');
      const filename = `appointments-report-${from || 'all'}-${to || ''}-${Date.now()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error('Failed to download Excel');
    }
    setDownloadingXlsx(false);
  };

  const handleDownloadPdf = () => {
    setDownloading(true);
    const token = localStorage.getItem('accessToken');
    fetch(`${API_BASE}/reports/download-pdf?range=${range}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `doctor-desk-report-${range}-${Date.now()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      })
      .catch(() => toast.error('Failed to download report'))
      .finally(() => setDownloading(false));
  };

  if (loading && !isSuperAdmin && !isReceptionist && !revenue.length) return <PageSkeleton />;

  if (isAdmin || isSuperAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            aria-label="Report view"
            options={REPORT_VIEW_TABS}
            value={reportView}
            onChange={handleReportViewChange}
          />
        </div>
        {reportView === 'insights' ? <AIInsightsView /> : <ReportsDetailView />}
      </div>
    );
  }

  const periodLabel = range === 'CUSTOM' && customFrom && customTo
    ? `${customFrom} to ${customTo}`
    : range === 'ALL'
      ? 'All time'
      : range === '7D'
        ? 'Last 7 days'
        : range === '30D'
          ? 'Last 30 days'
          : range === '6M'
            ? 'Last 6 months'
            : range === '1Y'
              ? 'Last 1 year'
              : '';

  if (isReceptionist) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-display text-content">Appointment Reports</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              aria-label="Report range"
              options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
              value={range}
              onChange={setRange}
            />
            {range === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-3">
                <DatePicker label="From" placeholder="From date" value={customFrom} onChange={(v) => setCustomFrom(v || '')} />
                <DatePicker label="To" placeholder="To date" value={customTo} onChange={(v) => setCustomTo(v || '')} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadAppointmentsPdf}
                disabled={downloadingPdf || reportLoading}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                {downloadingPdf ? 'Downloading…' : 'Download PDF'}
              </button>
              <button
                type="button"
                onClick={handleDownloadAppointmentsXlsx}
                disabled={downloadingXlsx || reportLoading || reportAppointments.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="h-5 w-5" />
                {downloadingXlsx ? 'Downloading…' : 'Download XLSX'}
              </button>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500">{periodLabel}</p>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-800">Appointments</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {reportLoading ? 'Loading…' : `${reportTotal} appointment${reportTotal === 1 ? '' : 's'} in this period`}
            </p>
          </div>
          {reportLoading ? (
            <div className="p-8">
              <ChartSkeleton />
            </div>
          ) : reportAppointments.length === 0 ? (
            <div className="py-16 text-center text-slate-500">No appointments in this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Time</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Patient</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Doctor</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {reportAppointments.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-6 py-3 text-slate-800">{a.appointment_date}</td>
                      <td className="px-6 py-3 text-slate-700">
                        {a.start_time}
                        {a.end_time ? ` – ${a.end_time}` : ''}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-800">{a.patient_name || '—'}</td>
                      <td className="px-6 py-3 text-slate-700">{a.doctor_name || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          a.status === 'no_show' ? 'bg-gray-100 text-gray-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {(a.status || 'scheduled').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-6 py-3 text-sm text-slate-600" title={a.notes || ''}>{a.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const pieData = appointmentSummary.map((s) => ({
    name: (s.status || '').replace(/_/g, ' '),
    value: s.count || 0,
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-display text-content">Reports</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            aria-label="Report range"
            options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
            value={range}
            onChange={setRange}
          />
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download className="h-5 w-5" />
            {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Improve Metrics */}
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-xl font-semibold text-gray-800">Improve Metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">Total Patients (This Month)</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">{metrics?.totalPatientsThisMonth ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">New Patients (This Month)</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">{metrics?.newPatientsThisMonth ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">Returning Patients</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">{metrics?.returningPatients ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">Today&apos;s Appointments</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">{metrics?.todayAppointments ?? 0}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">No-show Rate (%)</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">{metrics?.noShowRate ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3.5">
            <span className="text-[12px] font-medium text-gray-500 leading-[1.5]">Avg Revenue per Patient</span>
            <span className="text-[15px] font-semibold text-gray-900 leading-[1.5]">₹{(metrics?.avgRevenuePerPatient ?? 0).toLocaleString()}</span>
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 sm:col-span-1">
            <span className="text-[12px] font-medium text-emerald-700 leading-[1.5]">Collection vs Pending</span>
            <span className="text-[15px] font-semibold text-emerald-700 leading-[1.5]">
              ₹{(metrics?.collected ?? 0).toLocaleString()} / ₹{(metrics?.pending ?? 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="text-h2 text-content mb-6">Revenue</h2>
          <div className="min-h-[280px] rounded-xl bg-slate-50/50">
            {loading ? (
              <ChartSkeleton />
            ) : revenue.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '0.875rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.07)' }}
                    formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0EA5A4"
                    strokeWidth={2}
                    dot={{ fill: '#0EA5A4', strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-body text-content-muted">
                No revenue data for this period
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="text-h2 text-content mb-6">Appointment breakdown</h2>
          <div className="min-h-[280px] rounded-xl bg-slate-50/50">
            {loading ? (
              <ChartSkeleton />
            ) : pieData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 text-body text-content-muted">
                No appointments in this period
              </div>
            )}
          </div>
        </div>
      </div>

      {isSuperAdmin && doctorPerf.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-md">
          <h2 className="text-h2 text-content mb-6">Doctor performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 text-left text-label text-content-muted">Doctor</th>
                  <th className="py-4 text-right text-label text-content-muted">Appointments</th>
                  <th className="py-4 text-right text-label text-content-muted">Completed</th>
                  <th className="py-4 text-right text-label text-content-muted">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {doctorPerf.map((d) => (
                  <tr key={d.doctorId} className="border-b border-slate-50 transition-colors hover:bg-slate-50/80">
                    <td className="py-4 font-medium text-content">{d.doctorName}</td>
                    <td className="py-4 text-right text-content-muted">{d.totalAppointments}</td>
                    <td className="py-4 text-right text-content-muted">{d.completed}</td>
                    <td className="py-4 text-right font-medium text-content">₹{Number(d.totalRevenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
