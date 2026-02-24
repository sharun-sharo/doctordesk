import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { PageSkeleton } from '../components/ui/Skeleton';

const initial = { email: '', password: '', name: '', phone: '', role_id: 2, assigned_admin_id: '', assigned_doctor_ids: [] };

export default function UserForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api.get(`/users/${id}`).then(({ data }) => {
        const d = data.data;
        setForm({
          ...initial,
          ...d,
          password: '',
          assigned_doctor_ids: Array.isArray(d.assigned_doctor_ids) ? d.assigned_doctor_ids : (d.assigned_admin_id ? [d.assigned_admin_id] : []),
        });
      }).catch(() => toast.error('Not found')).finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const [doctors, setDoctors] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  useEffect(() => {
    if (isEdit && (form.role_id === 4 || form.role_id === 5)) {
      api.get('/users/doctors').then(({ data }) => setDoctors(data.data || [])).catch(() => {});
    }
  }, [isEdit, form.role_id]);

  const filteredDoctors = useMemo(() => {
    const list = doctors || [];
    const q = (doctorSearch || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((d) => (d.name || '').toLowerCase().includes(q));
  }, [doctors, doctorSearch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'role_id' ? parseInt(value, 10) : name === 'assigned_admin_id' ? (value === '' ? '' : parseInt(value, 10)) : value }));
  };

  const toggleDoctor = (doctorId) => {
    setForm((f) => {
      const ids = f.assigned_doctor_ids || [];
      const next = ids.includes(doctorId) ? ids.filter((id) => id !== doctorId) : [...ids, doctorId];
      return { ...f, assigned_doctor_ids: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.password) { toast.error('Password required'); return; }
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, phone: form.phone, is_active: form.is_active, ...(form.password ? { password: form.password } : {}) };
        if (form.role_id === 4 || form.role_id === 5) payload.assigned_doctor_ids = form.assigned_doctor_ids || [];
        await api.put(`/users/${id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/users', { ...form, role_id: form.role_id });
        toast.success('User created');
      }
      navigate('/users');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit User' : 'Add User'}</h1>
      <form onSubmit={handleSubmit} className="card max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" value={form.name} onChange={handleChange} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" name="email" value={form.email} onChange={handleChange} className="input-field" required disabled={isEdit} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{isEdit ? 'New password (leave blank to keep)' : 'Password *'}</label>
          <input type="password" name="password" value={form.password} onChange={handleChange} className="input-field" minLength={8} required={!isEdit} />
        </div>
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select name="role_id" value={form.role_id} onChange={handleChange} className="input-field" required>
              <option value={2}>Admin</option>
              <option value={4}>Receptionist</option>
              <option value={5}>Assistant doctor</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input name="phone" value={form.phone} onChange={handleChange} className="input-field" />
        </div>
        {isEdit && (form.role_id === 4 || form.role_id === 5) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned to (Doctors)</label>
            <p className="text-xs text-gray-500 mb-2">Select one or more doctors this user is assigned to.</p>
            <input
              type="text"
              value={doctorSearch}
              onChange={(e) => setDoctorSearch(e.target.value)}
              placeholder="Search by name…"
              className="input-field mb-2"
              aria-label="Search doctors by name"
            />
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-3">
              {filteredDoctors.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/80 rounded px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={(form.assigned_doctor_ids || []).includes(doc.id)}
                    onChange={() => toggleDoctor(doc.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-800">{doc.name}</span>
                </label>
              ))}
              {(!doctors || doctors.length === 0) && (
                <p className="text-sm text-gray-500">No doctors found. Add Admin/Doctor users first.</p>
              )}
              {doctors.length > 0 && filteredDoctors.length === 0 && (
                <p className="text-sm text-gray-500">No doctor matches &quot;{doctorSearch}&quot;.</p>
              )}
            </div>
          </div>
        )}
        {isEdit && (
          <div>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/users')} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
