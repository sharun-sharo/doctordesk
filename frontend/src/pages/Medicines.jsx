import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import FormInput from '../components/ui/FormInput';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function Medicines() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState('in');
  const [saving, setSaving] = useState(false);

  const fetchMedicines = (page = 1) => {
    setLoading(true);
    api.get('/medicines', { params: { page, limit: 20, search: search || undefined, low_stock: lowStock ? '1' : undefined } })
      .then(({ data }) => {
        setList(data.data.medicines);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMedicines(pagination.page);
  }, [pagination.page]);

  const handleAdjust = () => {
    if (!adjustModal || !adjustQty) return;
    setSaving(true);
    api.post(`/medicines/${adjustModal.id}/adjust-stock`, { type: adjustType, quantity: parseInt(adjustQty, 10) })
      .then(() => {
        toast.success('Stock updated');
        setAdjustModal(null);
        setAdjustQty('');
        fetchMedicines(pagination.page);
      })
      .catch(() => toast.error('Failed'))
      .finally(() => setSaving(false));
  };

  const applyFilters = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    fetchMedicines(1);
  };

  const columns = [
    { key: 'name', header: 'Name', render: (v, row) => <span className="font-medium">{v}</span> },
    { key: 'batch_number', header: 'Batch', render: (v) => v || '—' },
    {
      key: 'quantity',
      header: 'Stock',
      render: (v, row) => (
        <span className={row.quantity <= row.min_stock ? 'font-medium text-danger' : ''}>
          {v} {row.quantity <= row.min_stock && '(low)'}
        </span>
      ),
    },
    { key: 'min_stock', header: 'Min' },
    { key: 'price_per_unit', header: 'Price', render: (v) => `₹${Number(v).toFixed(2)}` },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Link to={`/medicines/${row.id}/edit`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button type="button" onClick={() => setAdjustModal(row)} className="text-body text-slate-600 hover:text-primary-600">
            Adjust stock
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <FormInput name="search" placeholder="Search medicines" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[180px]" />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600" />
            <span className="text-body text-slate-600">Low stock only</span>
          </label>
          <button type="button" onClick={applyFilters} className="btn-primary">Apply</button>
        </div>
        <Link to="/medicines/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus className="h-5 w-5" /> Add Medicine
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={list}
        keyField="id"
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        loading={loading}
        emptyMessage="No medicines"
      />
      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={adjustModal ? `Adjust stock: ${adjustModal.name}` : ''}>
        {adjustModal && (
          <>
            <p className="text-body text-slate-600 mb-4">Current: {adjustModal.quantity} {adjustModal.unit}</p>
            <div className="flex gap-3 mb-6">
              <div className="min-w-[100px]">
                <label className="input-label">Type</label>
                <select value={adjustType} onChange={(e) => setAdjustType(e.target.value)} className="input-field">
                  <option value="in">In</option>
                  <option value="out">Out</option>
                  <option value="adjust">Adjust</option>
                </select>
              </div>
              <FormInput label="Quantity" type="number" min={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdjustModal(null)} className="btn-secondary">Cancel</button>
              <button type="button" onClick={handleAdjust} className="btn-primary" disabled={saving || !adjustQty}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
