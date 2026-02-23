import { useState, useEffect } from 'react';
import api from '../../api/axios';
import DatePicker from '../ui/DatePicker';
import Tabs from '../ui/Tabs';
import { Download, FileSpreadsheet, Users, CreditCard, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const RANGES = [
  { key: '7D', label: '7 days' },
  { key: '30D', label: '30 days' },
  { key: '6M', label: '6 months' },
  { key: '1Y', label: '1 year' },
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

function getPeriodLabel(range, customFrom, customTo) {
  if (range === 'CUSTOM' && customFrom && customTo) return `${customFrom} to ${customTo}`;
  if (range === 'ALL') return 'All time';
  if (range === '7D') return 'Last 7 days';
  if (range === '30D') return 'Last 30 days';
  if (range === '6M') return 'Last 6 months';
  if (range === '1Y') return 'Last 1 year';
  return '';
}

export default function ReportsDetailView() {
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

  const { from, to, isAllTime } = getRangeDates(range, customFrom, customTo);

  useEffect(() => {
    setLoading(true);
    const params = isAllTime ? { all: '1' } : { from, to };
    api
      .get('/reports/detailed', { params })
      .then((res) => setData(res.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to, isAllTime]);

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
    fetch(`${API_BASE}/reports/detailed-pdf?${q.toString()}`, {
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
        a.download = `report-${from || 'all'}-${to || ''}-${Date.now()}.pdf`;
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

      const patientsSheet = XLSX.utils.json_to_sheet(
        (data.patients || []).map((p) => ({
          Name: p.name,
          Phone: p.phone,
          Email: p.email || '',
          'Date of birth': p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '',
          Gender: p.gender || '',
          'Created at': p.created_at ? String(p.created_at).slice(0, 10) : '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, patientsSheet, 'Patients');

      const revenueSheet = XLSX.utils.json_to_sheet(
        (data.revenueItems || []).map((r) => ({
          'Invoice #': r.invoice_number,
          Patient: r.patient_name,
          Total: r.total,
          Status: r.payment_status,
          Date: r.created_at ? String(r.created_at).slice(0, 10) : '',
        }))
      );
      XLSX.utils.book_append_sheet(wb, revenueSheet, 'Revenue');

      const appointmentsSheet = XLSX.utils.json_to_sheet(
        (data.appointments || []).map((a) => ({
          Date: a.appointment_date ? String(a.appointment_date).slice(0, 10) : '',
          'Start time': a.start_time ? String(a.start_time).slice(0, 5) : '',
          'End time': a.end_time ? String(a.end_time).slice(0, 5) : '',
          Patient: a.patient_name,
          Doctor: a.doctor_name,
          Status: (a.status || '').replace(/_/g, ' '),
        }))
      );
      XLSX.utils.book_append_sheet(wb, appointmentsSheet, 'Appointments');

      XLSX.writeFile(wb, `report-${from || 'all'}-${to || ''}-${Date.now()}.xlsx`);
      toast.success('Excel downloaded');
    } catch (e) {
      toast.error('Failed to download Excel');
    }
    setDownloadingXlsx(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-content">Reports</h1>
          <p className="mt-1 text-body text-content-muted">
            Patient, revenue, and appointment details by date range.
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
              className="btn-outline inline-flex items-center gap-2"
            >
              <FileSpreadsheet className="h-5 w-5" />
              {downloadingXlsx ? 'Downloading…' : 'XLSX'}
            </button>
          </div>
        </div>
      </div>

      {periodLabel && (
        <p className="text-body text-slate-500">{periodLabel}</p>
      )}

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50">
          <p className="text-body text-slate-500">Loading report…</p>
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Unable to load report data.
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <h2 className="flex items-center gap-2 text-h3 text-slate-800">
                <Users className="h-5 w-5 text-primary-600" />
                Patient details
              </h2>
              <p className="mt-0.5 text-body text-slate-600">
                {(data.patients || []).length} patient(s) in this period
              </p>
            </div>
            <div className="overflow-x-auto">
              {(data.patients || []).length === 0 ? (
                <div className="p-8 text-center text-slate-500">No patients in this period.</div>
              ) : (
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Name</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Phone</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Email</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.patients || []).map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{p.name}</td>
                        <td className="px-5 py-3 text-slate-700">{p.phone || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{p.email || '—'}</td>
                        <td className="px-5 py-3 text-slate-600">{p.created_at ? String(p.created_at).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <h2 className="flex items-center gap-2 text-h3 text-slate-800">
                <CreditCard className="h-5 w-5 text-primary-600" />
                Revenue details
              </h2>
              <p className="mt-0.5 text-body text-slate-600">
                {(data.revenueItems || []).length} invoice(s) · Total: ₹{Number(data.revenueSummary?.total ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="overflow-x-auto">
              {(data.revenueItems || []).length === 0 ? (
                <div className="p-8 text-center text-slate-500">No invoices in this period.</div>
              ) : (
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Invoice #</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Patient</th>
                      <th className="px-5 py-3 text-right text-label font-semibold text-slate-600">Total</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Status</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.revenueItems || []).map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-800">{r.invoice_number}</td>
                        <td className="px-5 py-3 text-slate-700">{r.patient_name}</td>
                        <td className="px-5 py-3 text-right font-medium text-slate-800">₹{Number(r.total).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-caption font-medium ${
                            r.payment_status === 'paid' ? 'bg-success-light text-success-dark' :
                            r.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {r.payment_status || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{r.created_at ? String(r.created_at).slice(0, 10) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4">
              <h2 className="flex items-center gap-2 text-h3 text-slate-800">
                <Calendar className="h-5 w-5 text-primary-600" />
                Appointment details
              </h2>
              <p className="mt-0.5 text-body text-slate-600">
                {(data.appointments || []).length} appointment(s) in this period
              </p>
            </div>
            <div className="overflow-x-auto">
              {(data.appointments || []).length === 0 ? (
                <div className="p-8 text-center text-slate-500">No appointments in this period.</div>
              ) : (
                <table className="w-full text-body">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Date</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Time</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Patient</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Doctor</th>
                      <th className="px-5 py-3 text-left text-label font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.appointments || []).map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-3 text-slate-800">{a.appointment_date ? String(a.appointment_date).slice(0, 10) : '—'}</td>
                        <td className="px-5 py-3 text-slate-700">
                          {a.start_time ? String(a.start_time).slice(0, 5) : '—'}
                          {a.end_time ? ` – ${String(a.end_time).slice(0, 5)}` : ''}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-800">{a.patient_name || '—'}</td>
                        <td className="px-5 py-3 text-slate-700">{a.doctor_name || '—'}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-caption font-medium ${
                            a.status === 'completed' ? 'bg-success-light text-success-dark' :
                            a.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            a.status === 'no_show' ? 'bg-slate-100 text-slate-600' : 'bg-primary-100 text-primary-700'
                          }`}>
                            {(a.status || 'scheduled').replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
