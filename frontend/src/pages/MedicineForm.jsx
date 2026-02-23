import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { PageSkeleton } from '../components/ui/Skeleton';
import DatePicker from '../components/ui/DatePicker';

const initial = { name: '', generic_name: '', batch_number: '', unit: 'strip', price_per_unit: 0, quantity: 0, min_stock: 5, expiry_date: '' };

export default function MedicineForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) api.get(`/medicines/${id}`).then(({ data }) => setForm({ ...initial, ...data.data })).catch(() => toast.error('Not found')).finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'price_per_unit' || name === 'quantity' || name === 'min_stock' ? (parseFloat(value) || 0) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) await api.put(`/medicines/${id}`, form);
      else await api.post('/medicines', form);
      toast.success(isEdit ? 'Updated' : 'Medicine added');
      navigate('/medicines');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Medicine' : 'Add Medicine'}</h1>
      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input name="name" value={form.name} onChange={handleChange} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Generic name</label>
            <input name="generic_name" value={form.generic_name} onChange={handleChange} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Batch number</label>
            <input name="batch_number" value={form.batch_number} onChange={handleChange} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input name="unit" value={form.unit} onChange={handleChange} className="input-field" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per unit</label>
            <input type="number" min="0" step="0.01" name="price_per_unit" value={form.price_per_unit} onChange={handleChange} className="input-field" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Initial quantity</label>
              <input type="number" min="0" name="quantity" value={form.quantity} onChange={handleChange} className="input-field" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min stock (alert)</label>
            <input type="number" min="0" name="min_stock" value={form.min_stock} onChange={handleChange} className="input-field" />
          </div>
        </div>
        <DatePicker label="Expiry date" value={form.expiry_date} onChange={(v) => setForm((f) => ({ ...f, expiry_date: v || '' }))} placeholder="Select expiry date" />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/medicines')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
