import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, FileText, Download, Trash2 } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import { PageSkeleton } from '../components/ui/Skeleton';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
];

export default function Invoices() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchInvoices = (page = 1) => {
    setLoading(true);
    api.get('/invoices', { params: { page, limit: 20, payment_status: status || undefined } })
      .then(({ data }) => {
        setList(data.data.invoices);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load'))
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

  const columns = [
    { key: 'invoice_number', header: 'Invoice #', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'patient_name', header: 'Patient' },
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
          <Link to={`/invoices/${row.id}`} className="text-body font-medium text-primary-600 hover:underline">View</Link>
          <button
            type="button"
            onClick={() => handleDownload(row.id, row.invoice_number)}
            className="inline-flex items-center gap-1 text-body text-slate-600 hover:text-primary-600"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            onClick={() => handleDelete(row.id, row.invoice_number)}
            className="inline-flex items-center gap-1 text-body font-medium text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
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
