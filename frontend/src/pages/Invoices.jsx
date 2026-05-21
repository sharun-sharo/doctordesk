import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Download, Trash2, Upload, Image } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import { logoImageSrc } from '../utils/logoImageSrc';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const API_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/v1\/?$/, '') : '';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
];

export default function Invoices() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    headerUrl: null,
    invoiceAddress: '',
    invoicePhone: '',
    invoiceEmail: '',
    invoiceGstin: '',
  });
  const [headerUploading, setHeaderUploading] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSettings = () => {
    api.get('/settings').then(({ data }) => {
      const d = data.data || {};
      setSettings((s) => ({
        ...s,
        headerUrl: d.headerUrl ?? d.logoUrl ?? s.headerUrl,
        invoiceAddress: d.invoiceAddress ?? '',
        invoicePhone: d.invoicePhone ?? '',
        invoiceEmail: d.invoiceEmail ?? '',
        invoiceGstin: d.invoiceGstin ?? '',
      }));
    }).catch(() => {});
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchInvoices = (page = 1) => {
    setLoading(true);
    api.get('/invoices', { params: { page, limit: 20, payment_status: status || undefined } })
      .then(({ data }) => {
        setList(data.data.invoices);
        setPagination(data.data.pagination);
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices(pagination.page);
  }, [pagination.page, status]);

  const handlePaymentStatusChange = (row, newStatus) => {
    const total = parseFloat(row.total) || 0;
    const paidAmount = newStatus === 'paid' ? total : 0;
    api
      .patch(`/invoices/${row.id}/payment`, { paid_amount: paidAmount, payment_status: newStatus })
      .then(() => {
        toast.success('Status updated');
        fetchInvoices(pagination.page);
      })
      .catch(() => toast.error('Failed to update'));
  };

  const handleDelete = (id, invoiceNumber) => {
    if (!window.confirm(`Delete invoice ${invoiceNumber}?`)) return;
    api
      .delete(`/invoices/${id}`)
      .then(() => {
        toast.success('Invoice deleted');
        setList((prev) => prev.filter((inv) => inv.id !== id));
        setPagination((p) => ({ ...p, total: Math.max(0, (p.total || 1) - 1) }));
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Delete failed'));
  };

  const handleDownload = async (id, invoiceNumber) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/invoices/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      toast.error('Download failed');
    }
  };

  const [headerBuster, setHeaderBuster] = useState(Date.now());

  const handleHeaderUpload = (e) => {
    const file = e.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image (PNG, JPG, etc.)');
      return;
    }
    setHeaderUploading(true);
    const formData = new FormData();
    formData.append('logo', file);
    api
      .post('/settings/header', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(({ data }) => {
        const bust = Date.now();
        const newUrl = data.data?.headerUrl ?? data.data?.logoUrl ?? data.headerUrl ?? data.logoUrl ?? null;
        setSettings((s) => ({ ...s, headerUrl: newUrl }));
        setHeaderBuster(bust);
        toast.success('Invoice header updated. It will appear on downloaded PDFs.');
      })
      .catch(() => toast.error('Failed to upload invoice header'))
      .finally(() => {
        setHeaderUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const headerSrc = logoImageSrc(settings.headerUrl, API_ORIGIN || window.location.origin, headerBuster);

  const handleSaveBusiness = () => {
    setBusinessSaving(true);
    api
      .patch('/settings/business', {
        address: settings.invoiceAddress,
        phone: settings.invoicePhone,
        email: settings.invoiceEmail,
        gstin: settings.invoiceGstin,
      })
      .then(() => {
        toast.success('Business details saved. They will appear on downloaded PDFs.');
        fetchSettings();
      })
      .catch(() => toast.error('Failed to save'))
      .finally(() => setBusinessSaving(false));
  };

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'patient_name', header: 'Patient' },
    { key: 'doctor_name', header: 'Doctor', render: (v) => v || '—' },
    { key: 'total', header: 'Total', render: (v) => `₹${Number(v).toLocaleString()}` },
    {
      key: 'payment_status',
      header: 'Status',
      render: (v, row) => {
        const displayValue = v === 'partial' ? 'pending' : v;
        return (
          <select
            value={displayValue}
            onChange={(e) => handlePaymentStatusChange(row, e.target.value)}
            className={`rounded-lg border bg-white px-2.5 py-1.5 text-body font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
              displayValue === 'paid'
                ? 'text-green-600 border-green-200 focus:border-green-500'
                : 'text-amber-600 border-amber-200 focus:border-amber-500'
            }`}
          >
            {PAYMENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      },
    },
    { key: 'created_at', header: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Link
            to={`/invoices/${row.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-body font-medium text-primary-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            View
          </Link>
          <button
            type="button"
            onClick={() => handleDownload(row.id, row.invoice_number)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-body font-medium text-slate-700 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <Download className="h-4 w-4" /> Download Bill
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.id, row.invoice_number)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-body font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            aria-label={`Delete invoice ${row.invoice_number}`}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Invoice</h1>
        <p className="text-sm text-slate-500 mt-1">
          Download payment receipts as PDF. Upload a header image for the top of every invoice.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Invoice header</h3>
          <p className="text-body text-slate-500 mb-3">
            Wide banner shown at the top of PDF invoices (e.g. clinic name and branding). JPEG, PNG, WebP or GIF, max 2MB.
          </p>
          <div className="space-y-3">
            <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
              {headerSrc ? (
                <img
                  src={headerSrc}
                  alt="Invoice header preview"
                  className="h-auto max-h-44 w-full object-contain object-center sm:max-h-48"
                />
              ) : (
                <div className="flex h-28 flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400 sm:h-32">
                  <Image className="h-8 w-8" aria-hidden />
                  <span className="text-xs">No header uploaded</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              onChange={handleHeaderUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={headerUploading}
              className="btn-secondary inline-flex items-center gap-2"
            >
              {headerUploading ? (
                <span className="animate-pulse">Uploading…</span>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload header image
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Business details on invoice</h3>
          <p className="text-body text-slate-500 mb-4">Address, phone, email and GST appear in the header of downloaded PDFs.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={settings.invoiceAddress}
                onChange={(e) => setSettings((s) => ({ ...s, invoiceAddress: e.target.value }))}
                placeholder="Clinic address"
                className="input-field w-full"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={settings.invoicePhone}
                  onChange={(e) => setSettings((s) => ({ ...s, invoicePhone: e.target.value }))}
                  placeholder="Phone"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.invoiceEmail}
                  onChange={(e) => setSettings((s) => ({ ...s, invoiceEmail: e.target.value }))}
                  placeholder="Email"
                  className="input-field w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">GST number (optional)</label>
              <input
                type="text"
                value={settings.invoiceGstin}
                onChange={(e) => setSettings((s) => ({ ...s, invoiceGstin: e.target.value }))}
                placeholder="GSTIN"
                className="input-field w-full"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveBusiness}
              disabled={businessSaving}
              className="btn-primary mt-2"
            >
              {businessSaving ? 'Saving…' : 'Save details'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="input-label mb-0">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field w-40">
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <Link to="/invoices/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus className="h-5 w-5" /> New Invoice
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={list}
        keyField="id"
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        loading={loading}
        emptyMessage="No invoices"
      />
    </div>
  );
}
