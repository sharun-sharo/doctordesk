import { useMemo, useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { CircleDollarSign, Plus, Pencil, Search } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import FormInput from '../components/ui/FormInput';
import DatePicker from '../components/ui/DatePicker';
import { PageSkeleton } from '../components/ui/Skeleton';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'No plan' },
];

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function Subscriptions() {
  const [doctors, setDoctors] = useState([]);
  const [subscriptionRevenue, setSubscriptionRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: '', start_date: '', end_date: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchSubscriptions = () => {
    setLoading(true);
    api
      .get('/subscriptions')
      .then(({ data }) => {
        setDoctors(data.data?.doctors ?? []);
        setSubscriptionRevenue(data.data?.subscriptionRevenue ?? 0);
      })
      .catch(() => toast.error('Failed to load subscriptions'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const openModal = (doctor) => {
    setEditingDoctor(doctor);
    setForm({
      amount: doctor?.amount != null ? String(doctor.amount) : '',
      start_date: doctor?.startDate ?? '',
      end_date: doctor?.endDate ?? '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingDoctor(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editingDoctor?.doctorId) return;
    const start = form.start_date || new Date().toISOString().slice(0, 10);
    const end = form.end_date || new Date().toISOString().slice(0, 10);
    if (new Date(end) < new Date(start)) {
      toast.error('End date must be after start date');
      return;
    }
    setSaving(true);
    api
      .post('/subscriptions', {
        doctor_id: editingDoctor.doctorId,
        amount: form.amount ? parseFloat(form.amount) : 0,
        start_date: start,
        end_date: end,
      })
      .then(() => {
        toast.success('Subscription saved');
        closeModal();
        fetchSubscriptions();
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to save'))
      .finally(() => setSaving(false));
  };

  const filteredDoctors = useMemo(() => {
    let list = doctors;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          (d.doctorName || '').toLowerCase().includes(q) ||
          (d.doctorEmail || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      if (statusFilter === 'none') {
        list = list.filter((d) => !d.status);
      } else {
        list = list.filter((d) => (d.status || '').toLowerCase() === statusFilter);
      }
    }
    return list;
  }, [doctors, searchQuery, statusFilter]);

  const columns = [
    { key: 'doctorName', header: 'Doctor', render: (v) => <span className="font-medium text-slate-800">{v || '—'}</span> },
    { key: 'doctorEmail', header: 'Email', render: (v) => v || '—' },
    {
      key: 'amount',
      header: 'Monthly amount',
      render: (v) => (v != null ? `₹${Number(v).toLocaleString()}` : '—'),
    },
    { key: 'startDate', header: 'Start date', render: (v) => formatDate(v) },
    { key: 'endDate', header: 'End date', render: (v) => formatDate(v) },
    {
      key: 'status',
      header: 'Status',
      render: (v) => {
        if (!v) return <Badge variant="other">No plan</Badge>;
        return v === 'active' ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Expired</Badge>;
      },
    },
    {
      key: 'doctorId',
      header: 'Actions',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => openModal(row)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label={row.subscriptionId ? 'Edit subscription' : 'Add subscription'}
        >
          {row.subscriptionId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {row.subscriptionId ? 'Edit' : 'Add'}
        </button>
      ),
    },
  ];

  if (loading && doctors.length === 0) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Subscriptions"
        description="Manage doctor subscription plans and view revenue from subscriptions."
      />

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CircleDollarSign className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Subscription Revenue (active plans)</p>
            <p className="text-2xl font-semibold text-slate-900">₹{Number(subscriptionRevenue).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              placeholder="Search by doctor name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-[220px] rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 sm:w-64"
              aria-label="Search doctors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredDoctors}
        keyField="doctorId"
        loading={loading}
        emptyMessage={doctors.length === 0 ? 'No doctors found. Add Admin/Doctor users first.' : 'No doctors match your search or filter.'}
      />

      <Modal open={modalOpen} onClose={closeModal} title={editingDoctor?.subscriptionId ? 'Edit subscription' : 'Add subscription'} size="md">
        {editingDoctor && (
          <p className="mb-4 text-sm text-slate-600">
            Doctor: <span className="font-medium text-slate-800">{editingDoctor.doctorName}</span>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Monthly amount (₹)"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <DatePicker
            label="Start date"
            value={form.start_date}
            onChange={(v) => setForm((f) => ({ ...f, start_date: v || '' }))}
            placeholder="Start date"
          />
          <DatePicker
            label="End date"
            value={form.end_date}
            onChange={(v) => setForm((f) => ({ ...f, end_date: v || '' }))}
            placeholder="End date"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
