import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import FormInput from '../components/ui/FormInput';
import { PageSkeleton } from '../components/ui/Skeleton';

function dateOfBirthToAge(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : '';
}

function ageToDateOfBirth(age) {
  const n = parseInt(age, 10);
  if (Number.isNaN(n) || n < 0 || n > 150) return '';
  const year = new Date().getFullYear() - n;
  return `${year}-01-01`;
}

const initial = {
  name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  address: '',
  blood_group: '',
  allergies: '',
  medical_notes: '',
};

export default function PatientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/patients/${id}`)
        .then(({ data }) => setForm({ ...initial, ...data.data }))
        .catch(() => toast.error('Patient not found'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      name: typeof form.name === 'string' ? form.name.trim() : (form.name ?? ''),
      phone: typeof form.phone === 'string' ? form.phone.trim() : (form.phone ?? ''),
      email: typeof form.email === 'string' ? form.email.trim() : (form.email ?? ''),
      address: typeof form.address === 'string' ? form.address.trim() : (form.address ?? ''),
      blood_group: typeof form.blood_group === 'string' ? form.blood_group.trim() : (form.blood_group ?? ''),
      allergies: typeof form.allergies === 'string' ? form.allergies.trim() : (form.allergies ?? ''),
      medical_notes: typeof form.medical_notes === 'string' ? form.medical_notes.trim() : (form.medical_notes ?? ''),
    };
    try {
      if (isEdit) {
        await api.put(`/patients/${id}`, payload);
        toast.success('Patient updated');
      } else {
        await api.post('/patients', payload);
        toast.success('Patient added');
      }
      navigate('/patients');
    } catch (err) {
      const data = err.response?.data;
      const message = data?.errors?.length
        ? data.errors.map((e) => e.message).join('. ')
        : data?.message || 'Save failed';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-display text-slate-900 mb-6">{isEdit ? 'Edit Patient' : 'Add Patient'}</h1>
      {isEdit && form.id != null && (
        <p className="text-body text-slate-600 mb-4">
          Patient ID: <span className="font-mono font-medium text-slate-800">PAT-{String(form.id).padStart(5, '0')}</span>
        </p>
      )}
      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormInput label="Name *" name="name" value={form.name} onChange={handleChange} required />
          <FormInput label="Phone *" name="phone" value={form.phone} onChange={handleChange} required />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} />
          <FormInput
            label="Age"
            name="age"
            type="number"
            min={0}
            max={150}
            value={form.date_of_birth ? dateOfBirthToAge(form.date_of_birth) : ''}
            onChange={(e) => {
              const age = e.target.value;
              setForm((f) => ({ ...f, date_of_birth: age === '' ? '' : ageToDateOfBirth(age) }));
            }}
            placeholder="e.g. 25"
          />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="input-label">Gender</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="input-field">
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <FormInput label="Blood group" name="blood_group" value={form.blood_group} onChange={handleChange} placeholder="e.g. O+" />
        </div>
        <FormInput label="Address" name="address" value={form.address} onChange={handleChange} />
        <FormInput label="Allergies" name="allergies" value={form.allergies} onChange={handleChange} />
        <FormInput label="Medical notes" name="medical_notes" value={form.medical_notes} onChange={handleChange} />
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/patients')} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
