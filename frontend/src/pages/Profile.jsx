import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function Profile() {
  const [form, setForm] = useState({ name: '', email: '', whatsapp_phone: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    api
      .get('/users/me')
      .then(({ data }) => {
        const d = data.data || {};
        setForm({
          name: d.name ?? '',
          email: d.email ?? '',
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

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
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

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters and include a number, uppercase and lowercase letter');
      return;
    }
    setChangingPassword(true);
    try {
      await api.post('/users/me/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password updated');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Account details</h2>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="input-field"
            required
            placeholder="you@example.com"
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

      <form onSubmit={handleChangePassword} className="card max-w-xl space-y-4">
        <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">Change password</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current password *</label>
          <input
            name="current_password"
            type="password"
            value={passwordForm.current_password}
            onChange={handlePasswordChange}
            className="input-field"
            required
            placeholder="Enter current password"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New password *</label>
          <p className="text-xs text-gray-500 mb-1.5">
            At least 8 characters, with a number, uppercase and lowercase letter.
          </p>
          <input
            name="new_password"
            type="password"
            value={passwordForm.new_password}
            onChange={handlePasswordChange}
            className="input-field"
            required
            placeholder="Enter new password"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password *</label>
          <input
            name="confirm_password"
            type="password"
            value={passwordForm.confirm_password}
            onChange={handlePasswordChange}
            className="input-field"
            required
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={changingPassword}>
            {changingPassword ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
