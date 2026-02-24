import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    });
  }, [user?.id, user?.name, user?.phone]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    api
      .patch('/users/me', { name: form.name.trim(), phone: form.phone.trim() || undefined })
      .then(({ data }) => {
        toast.success('Profile updated');
        if (data.data && setUser) {
          setUser((prev) => (prev ? { ...prev, name: data.data.name, phone: data.data.phone ?? prev.phone } : prev));
        }
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Update failed'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6">
      <div className="card max-w-2xl">
        <h2 className="text-title text-slate-900 mb-4">Profile</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className="input-label block mb-1">Name</label>
            <input
              id="profile-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="input-field w-full"
              placeholder="Your name"
              maxLength={255}
            />
          </div>
          <div>
            <label htmlFor="profile-phone" className="input-label block mb-1">Mobile number</label>
            <input
              id="profile-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="input-field w-full"
              placeholder="Mobile number"
              maxLength={20}
            />
          </div>
          <div className="sm:col-span-2">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption text-slate-500">Email</dt>
                <dd className="text-body text-slate-800">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-caption text-slate-500">Role</dt>
                <dd className="text-body text-slate-800">{user?.roleName?.replace('_', ' ')}</dd>
              </div>
            </dl>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
