import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function Profile() {
  const [form, setForm] = useState({ name: '', whatsapp_phone: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/users/me')
      .then(({ data }) => {
        const d = data.data || {};
        setForm({
          name: d.name ?? '',
          whatsapp_phone: d.whatsapp_phone ?? '',
          phone: d.phone ?? '',
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', {
        name: form.name.trim(),
        whatsapp_phone: form.whatsapp_phone.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="input-field"
            required
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g. 9876543210"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp phone number</label>
          <p className="text-xs text-gray-500 mb-1.5">
            This number is used when sending WhatsApp messages to appointment patients.
          </p>
          <input
            name="whatsapp_phone"
            type="tel"
            value={form.whatsapp_phone}
            onChange={handleChange}
            className="input-field"
            placeholder="e.g. 91 9876543210 or +919876543210"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
