import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DatePicker from '../components/ui/DatePicker';
import Tabs from '../components/ui/Tabs';
import { Download, FileSpreadsheet, CircleDollarSign, Stethoscope, Users, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { PageSkeleton } from '../components/ui/Skeleton';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const RANGES = [
  { key: '7D', label: '7 days' },
  { key: '30D', label: '30 days' },
  { key: '6M', label: '6 months' },
  { key: '1Y', label: '1 year' },
  { key: 'ALL', label: 'All time' },
  { key: 'CUSTOM', label: 'Custom' },
];

const SUB_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
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

function getPeriodLabel(range, customFrom, customTo) {
  if (range === 'CUSTOM' && customFrom && customTo) return `${customFrom} to ${customTo}`;
  if (range === 'ALL') return 'All time';
  if (range === '7D') return 'Last 7 days';
  if (range === '30D') return 'Last 30 days';
  if (range === '6M') return 'Last 6 months';
  if (range === '1Y') return 'Last 1 year';
  return '';
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Revenue() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useState('30D');
  const defaultCustom = (() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  })();
  const [customFrom, setCustomFrom] = useState(defaultCustom.from);
  const [customTo, setCustomTo] = useState(defaultCustom.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [recepSearch, setRecepSearch] = useState('');

  const { from, to, isAllTime } = getRangeDates(range, customFrom, customTo);

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoading(true);
    const params = isAllTime ? { all: '1' } : { from, to };
    api
      .get('/reports/super-admin-revenue', { params })
      .then((res) => setData(res.data?.data || null))
      .catch(() => {
        setData(null);
        toast.error('Failed to load revenue data');
      })
      .finally(() => setLoading(false));
  }, [isSuperAdmin, from, to, isAllTime]);

  const filteredSubscriptions = useMemo(() => {
    const list = data?.subscriptions ?? [];
    if (!subStatusFilter) return list;
    return list.filter((s) => (s.status || '').toLowerCase() === subStatusFilter);
  }, [data?.subscriptions, subStatusFilter]);

  const filteredDoctors = useMemo(() => {
    const list = data?.doctors ?? [];
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
    );
  }, [data?.doctors, doctorSearch]);

  const filteredReceptionists = useMemo(() => {
    const list = data?.receptionists ?? [];
    const q = recepSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
    );
  }, [data?.receptionists, recepSearch]);

  const periodLabel = getPeriodLabel(range, customFrom, customTo);

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    const token = localStorage.getItem('accessToken');
    const q = new URLSearchParams();
    if (isAllTime) q.set('all', '1');
    else if (from && to) {
      q.set('from', from);
      q.set('to', to);
    }
    fetch(`${API_BASE}/reports/super-admin-revenue-pdf?${q.toString()}`, {
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
        a.download = `revenue-report-${from || 'all'}-${to || ''}-${Date.now()}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF downloaded');
      })
      .catch(() => toast.error('Failed to download PDF'))
      .finally(() => setDownloadingPdf(false));
  };

  const handleDownloadXlsx = () => {
    if (!data) return;
    setDownloadingXlsx(true);
    try {
      const wb = XLSX.utils.book_new();

      const subSheet = XLSX.utils.json_to_sheet(
        (data.subscriptions || []).map((s) => ({
          Doctor: s.doctorName,
          Email: s.doctorEmail,
          'Monthly amount': s.amount,
          'Start date': s.startDate ? String(s.startDate).slice(0, 10) : '',
          'End date': s.endDate ? String(s.endDate).slice(0, 10) : '',
          Status: s.status || '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, subSheet, 'Subscriptions');

      const doctorsSheet = XLSX.utils.json_to_sheet(
        (data.doctors || []).map((d) => ({
          Name: d.name,
          Email: d.email,
          Phone: d.phone || '',
          'Subscription amount': d.subscriptionAmount ?? '',
          'Sub start': d.subscriptionStart ? String(d.subscriptionStart).slice(0, 10) : '',
          'Sub end': d.subscriptionEnd ? String(d.subscriptionEnd).slice(0, 10) : '',
          'Sub status': d.subscriptionStatus || 'No plan',
          'Joined': d.createdAt ? String(d.createdAt).slice(0, 10) : '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, doctorsSheet, 'Doctors');

      const recepSheet = XLSX.utils.json_to_sheet(
        (data.receptionists || []).map((r) => ({
          Name: r.name,
          Email: r.email,
          Phone: r.phone || '',
          'Joined': r.createdAt ? String(r.createdAt).slice(0, 10) : '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, recepSheet, 'Receptionists');

      XLSX.writeFile(wb, `revenue-report-${from || 'all'}-${to || ''}-${Date.now()}.xlsx`);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error('Failed to download Excel');
    }
    setDownloadingXlsx(false);
  };

  if (!isSuperAdmin) {
    navigate('/', { replace: true });
    return null;
  }

  if (loading && !data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Revenue</h1>
          <p className="mt-1 text-sm text-slate-500">
            Subscription details, doctors, and receptionists. Use date range for subscription period.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            aria-label="Date range"
            options={RANGES.map((r) => ({ value: r.key, label: r.label }))}
            value={range}
            onChange={setRange}
          />
          {range === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3">
              <DatePicker label="From" value={customFrom} onChange={setCustomFrom} placeholder="Start date" />
              <DatePicker label="To" value={customTo} onChange={setCustomTo} placeholder="End date" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || loading}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Download className="h-5 w-5" />
              {downloadingPdf ? 'Downloading…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={handleDownloadXlsx}
              disabled={downloadingXlsx || loading || !data}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-5 w-5" />
              {downloadingXlsx ? 'Downloading…' : 'XLSX'}
            </button>
          </div>
        </div>
      </div>

      {periodLabel && (
        <p className="text-sm text-slate-500">{periodLabel}</p>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50">
          <p className="text-slate-500">Loading…</p>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Unable to load revenue data.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CircleDollarSign className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Subscription revenue (active in period)</p>
                <p className="text-2xl font-semibold text-slate-900">₹{Number(data.subscriptionRevenueTotal ?? 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                    Subscriptions
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {filteredSubscriptions.length} subscription(s) in period
                  </p>
                </div>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  aria-label="Filter by status"
                >
                  {SUB_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredSubscriptions.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No subscriptions in this period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Doctor</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Email</th>
                      <th className="px-5 py-3 text-right font-semibold text-slate-600">Amount</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Start</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">End</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscriptions.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{s.doctorName || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{s.doctorEmail || '—'}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">₹{Number(s.amount).toLocaleString()}</td>
                        <td className="px-5 py-3 text-slate-700">{formatDate(s.startDate)}</td>
                        <td className="px-5 py-3 text-slate-700">{formatDate(s.endDate)}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {s.status === 'active' ? 'Active' : 'Expired'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Stethoscope className="h-5 w-5 text-primary-600" />
                    Doctors
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {filteredDoctors.length} doctor(s)
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search by name or email..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label="Search doctors"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredDoctors.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No doctors found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Name</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Email</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Phone</th>
                      <th className="px-5 py-3 text-right font-semibold text-slate-600">Subscription</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Status</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDoctors.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{d.name || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{d.email || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{d.phone || '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-700">
                          {d.subscriptionAmount != null ? `₹${Number(d.subscriptionAmount).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            d.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-700' :
                            d.subscriptionStatus === 'expired' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {d.subscriptionStatus === 'active' ? 'Active' : d.subscriptionStatus === 'expired' ? 'Expired' : 'No plan'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{d.createdAt ? String(d.createdAt).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <Users className="h-5 w-5 text-primary-600" />
                    Receptionists
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {filteredReceptionists.length} receptionist(s)
                  </p>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search by name or email..."
                    value={recepSearch}
                    onChange={(e) => setRecepSearch(e.target.value)}
                    className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    aria-label="Search receptionists"
                  />
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredReceptionists.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No receptionists found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Name</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Email</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Phone</th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-600">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceptionists.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{r.name || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{r.email || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{r.phone || '—'}</td>
                        <td className="px-5 py-3 text-slate-600">{r.createdAt ? String(r.createdAt).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
