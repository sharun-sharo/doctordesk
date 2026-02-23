import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ChevronDown, Search, UserPlus, Paperclip, X } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';
import Drawer from '../components/ui/Drawer';
import DatePicker from '../components/ui/DatePicker';
import { useAuth } from '../context/AuthContext';

const DEBOUNCE_MS = 200;

function getAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

const inputBase =
  'h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-[15px] text-gray-800 transition-all duration-200 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0';

export default function PrescriptionForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const prePatient = searchParams.get('patient_id');
  const preAppointment = searchParams.get('appointment_id');
  const isEdit = !!id;
  const { isDoctor, isAdmin } = useAuth();
  const isDoctorOrAdmin = isDoctor || isAdmin;
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ patient_id: prePatient || '', appointment_id: preAppointment || '', diagnosis: '', notes: '', medicines: [{ name: '', dosage: '', duration: '', instructions: '' }], attachments: [] });
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const [addPatientDrawerOpen, setAddPatientDrawerOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({ name: '', phone: '', email: '', date_of_birth: '', gender: '' });
  const [newPatientSaving, setNewPatientSaving] = useState(false);
  const patientRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(patientSearch), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [patientSearch]);

  useEffect(() => {
    api.get('/patients', { params: { limit: 500 } }).then(({ data }) => setPatients(data.data.patients || []));
    if (!isDoctorOrAdmin) api.get('/users/doctors').then(({ data }) => setDoctors(data.data || []));
  }, [isDoctorOrAdmin]);

  useEffect(() => {
    if (isEdit)
      api.get(`/prescriptions/${id}`).then(({ data }) => {
        const d = data.data;
        setForm({
          patient_id: d.patient_id,
          doctor_id: d.doctor_id,
          appointment_id: d.appointment_id,
          diagnosis: d.diagnosis,
          notes: d.notes,
          medicines: Array.isArray(d.medicines) && d.medicines.length ? d.medicines : [{ name: '', dosage: '', duration: '', instructions: '' }],
          attachments: Array.isArray(d.attachments) ? d.attachments : [],
        });
      }).catch(() => toast.error('Not found')).finally(() => setLoading(false));
    else if (prePatient || preAppointment) setForm((f) => ({ ...f, patient_id: prePatient || f.patient_id, appointment_id: preAppointment || f.appointment_id }));
  }, [id, isEdit, prePatient, preAppointment]);
  const existingAttachments = form.attachments || [];
  const [downloadingId, setDownloadingId] = useState(null);

  const downloadAttachment = async (att) => {
    if (!id || !att) return;
    const isLegacy = att.id === 'legacy';
    const url = isLegacy ? `/prescriptions/${id}/attachment` : `/prescriptions/${id}/attachments/${att.id}`;
    setDownloadingId(att.id);
    try {
      const { data } = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.original_name || 'attachment';
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Could not download attachment');
    } finally {
      setDownloadingId(null);
    }
  };

  const removeExistingAttachment = async (att) => {
    if (att.id === 'legacy') {
      toast.error('Legacy attachment cannot be removed here');
      return;
    }
    try {
      await api.delete(`/prescriptions/${id}/attachments/${att.id}`);
      setForm((f) => ({ ...f, attachments: (f.attachments || []).filter((a) => a.id !== att.id) }));
      toast.success('Attachment removed');
    } catch {
      toast.error('Could not remove attachment');
    }
  };

  useEffect(() => {
    const onMouseDown = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filteredPatients = useMemo(
    () =>
      !debouncedSearch.trim()
        ? patients
        : patients.filter(
            (p) =>
              (p.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
              (p.phone || '').replace(/\s/g, '').includes(debouncedSearch.replace(/\s/g, ''))
          ),
    [patients, debouncedSearch]
  );
  const selectedPatient = patients.find((p) => String(p.id) === String(form.patient_id));

  const handleAddPatientClick = () => {
    setPatientOpen(false);
    setAddPatientDrawerOpen(true);
  };

  const handleNewPatientChange = (e) => {
    const { name, value } = e.target;
    setNewPatientForm((f) => ({ ...f, [name]: value }));
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    const name = newPatientForm.name?.trim();
    const phone = newPatientForm.phone?.trim();
    if (!name || !phone) {
      toast.error('Name and phone are required');
      return;
    }
    setNewPatientSaving(true);
    try {
      const { data } = await api.post('/patients', {
        name,
        phone,
        email: newPatientForm.email?.trim() || undefined,
        date_of_birth: newPatientForm.date_of_birth || undefined,
        gender: newPatientForm.gender || undefined,
      });
      const created = data.data;
      setPatients((prev) => [created, ...prev]);
      setForm((f) => ({ ...f, patient_id: created.id }));
      setAddPatientDrawerOpen(false);
      setNewPatientForm({ name: '', phone: '', email: '', date_of_birth: '', gender: '' });
      setPatientSearch('');
      toast.success('Patient added and selected');
    } catch (res) {
      const msg = res?.response?.data?.errors?.length ? res.response.data.errors.map((e) => e.message).join('. ') : res?.response?.data?.message || 'Failed to add patient';
      toast.error(msg);
    } finally {
      setNewPatientSaving(false);
    }
  };

  const addMedicine = () => setForm((f) => ({ ...f, medicines: [...f.medicines, { name: '', dosage: '', duration: '', instructions: '' }] }));
  const removeMedicine = (idx) => setForm((f) => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }));
  const updateMedicine = (idx, field, value) => setForm((f) => ({ ...f, medicines: f.medicines.map((m, i) => (i === idx ? { ...m, [field]: value } : m)) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && (!form.patient_id || String(form.patient_id).trim() === '')) {
      toast.error('Please select a patient');
      return;
    }
    const medicinesPayload = form.medicines.filter((m) => m.name?.trim());
    setSaving(true);
    try {
      const hasNewFiles = attachmentFiles.length > 0;
      if (hasNewFiles) {
        const fd = new FormData();
        if (isEdit) {
          fd.append('diagnosis', form.diagnosis ?? '');
          fd.append('notes', form.notes ?? '');
          fd.append('medicines', JSON.stringify(form.medicines));
        } else {
          fd.append('patient_id', String(form.patient_id));
          if (!isDoctorOrAdmin) fd.append('doctor_id', String(form.doctor_id));
          if (form.appointment_id) fd.append('appointment_id', String(form.appointment_id));
          fd.append('diagnosis', form.diagnosis ?? '');
          fd.append('notes', form.notes ?? '');
          fd.append('medicines', JSON.stringify(medicinesPayload));
        }
        attachmentFiles.forEach((file) => fd.append('attachments', file));
        const formDataHeaders = { 'Content-Type': undefined };
        if (isEdit) {
          await api.put(`/prescriptions/${id}`, fd, { headers: formDataHeaders });
          toast.success('Updated');
          navigate(`/prescriptions/${id}`);
          return;
        } else {
          const { data } = await api.post('/prescriptions', fd, { headers: formDataHeaders });
          toast.success('Prescription created');
          if (data?.data?.id) navigate(`/prescriptions/${data.data.id}`);
          else navigate('/prescriptions');
          return;
        }
      } else {
        const payload = { ...form, patient_id: parseInt(form.patient_id, 10), medicines: medicinesPayload };
        if (!isEdit && !isDoctorOrAdmin) payload.doctor_id = parseInt(form.doctor_id, 10);
        if (isEdit) {
          await api.put(`/prescriptions/${id}`, { diagnosis: form.diagnosis, notes: form.notes, medicines: form.medicines });
          toast.success('Updated');
        } else {
          await api.post('/prescriptions', payload);
          toast.success('Prescription created');
        }
      }
      navigate('/prescriptions');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Prescription' : 'New Prescription'}</h1>
      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-4">
        <div className="relative" ref={patientRef}>
          <label htmlFor="field-patient_id" className="mb-1.5 block text-sm font-medium text-gray-700">
            Patient <span className="text-red-500" aria-hidden>*</span>
          </label>
          <button
            id="field-patient_id"
            type="button"
            onClick={() => !isEdit && setPatientOpen((o) => !o)}
            disabled={isEdit}
            className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-4 text-left text-[15px] transition-all duration-200 ${patientOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-gray-300'} disabled:bg-gray-50 disabled:cursor-not-allowed`}
            aria-haspopup="listbox"
            aria-expanded={patientOpen}
            aria-label="Select patient"
          >
            <span className={selectedPatient ? 'text-gray-800' : 'text-gray-500'}>
              {selectedPatient ? `${selectedPatient.name} – ${selectedPatient.phone}` : 'Search or select a patient'}
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          </button>
          <input type="hidden" name="patient_id" value={form.patient_id} readOnly aria-hidden required />
          {patientOpen && !isEdit && (
            <div
              className="absolute top-full left-0 right-0 z-10 mt-1 flex max-h-[min(400px,70vh)] flex-col rounded-lg border border-[#E2E8F0] bg-white shadow-lg"
              role="listbox"
            >
              <div className="shrink-0 border-b border-slate-100 px-2 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by name or phone…"
                    className="h-10 w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-[15px] text-gray-800 placeholder-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    aria-label="Search patients by name or phone"
                  />
                </div>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {filteredPatients.length === 0 && !debouncedSearch.trim() ? (
                  <li className="px-4 py-3 text-[14px] text-[#64748B]">No patients yet</li>
                ) : filteredPatients.length === 0 ? (
                  <li className="px-4 py-4 text-center text-[14px] text-[#64748B]">No patient found</li>
                ) : (
                  filteredPatients.map((p) => (
                    <li key={p.id} role="option" aria-selected={form.patient_id === p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, patient_id: p.id }));
                          setPatientOpen(false);
                          setPatientSearch('');
                        }}
                        className="w-full px-4 py-2.5 text-left text-[14px] text-[#1E293B] transition-colors hover:bg-slate-50"
                      >
                        {p.name} – {p.phone}
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="shrink-0 border-t border-slate-200 bg-slate-50/50 px-2 py-2">
                <button
                  type="button"
                  onClick={handleAddPatientClick}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 hover:border-emerald-300"
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  + Add New Patient
                </button>
              </div>
            </div>
          )}
          {selectedPatient && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-[14px] text-[#64748B]">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {getAge(selectedPatient.date_of_birth) != null && <span>Age {getAge(selectedPatient.date_of_birth)}</span>}
                <span>{selectedPatient.phone}</span>
              </div>
            </div>
          )}
        </div>
        {!isDoctorOrAdmin && !isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
            <select value={form.doctor_id} onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value }))} className="input-field" required>
              <option value="">Select</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
          <input value={form.diagnosis} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} className="input-field" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medicines</label>
          {form.medicines.map((m, idx) => (
            <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <input placeholder="Medicine" value={m.name} onChange={(e) => updateMedicine(idx, 'name', e.target.value)} className="input-field" />
              <input placeholder="Dosage" value={m.dosage} onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)} className="input-field" />
              <input placeholder="Duration" value={m.duration} onChange={(e) => updateMedicine(idx, 'duration', e.target.value)} className="input-field" />
              <div className="flex gap-1">
                <input placeholder="Instructions" value={m.instructions} onChange={(e) => updateMedicine(idx, 'instructions', e.target.value)} className="input-field flex-1" />
                <button type="button" onClick={() => removeMedicine(idx)} className="text-red-600">×</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addMedicine} className="btn-secondary text-sm">+ Add medicine</button>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="input-field" rows={2} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            multiple
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              setAttachmentFiles((prev) => [...prev, ...list]);
              e.target.value = '';
            }}
            className="hidden"
            aria-label="Attach files"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <Paperclip className="h-4 w-4" />
              Attach files
            </button>
            {attachmentFiles.map((file, idx) => (
              <span key={`${file.name}-${idx}`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                {file.name}
                <button type="button" onClick={() => setAttachmentFiles((p) => p.filter((_, i) => i !== idx))} className="text-slate-500 hover:text-red-600" aria-label="Remove file">
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
          {existingAttachments.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-xs font-medium text-slate-500">Current attachments:</span>
              <ul className="flex flex-wrap gap-2">
                {existingAttachments.map((att) => (
                  <li key={att.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                    <button type="button" onClick={() => downloadAttachment(att)} disabled={downloadingId === att.id} className="text-emerald-600 hover:underline focus:outline-none">
                      {downloadingId === att.id ? 'Downloading…' : att.original_name}
                    </button>
                    {att.id !== 'legacy' && (
                      <button type="button" onClick={() => removeExistingAttachment(att)} className="text-slate-500 hover:text-red-600" aria-label="Remove attachment">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Any file type, max 10 files, 25 MB each.</p>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => navigate('/prescriptions')} className="btn-secondary">Cancel</button>
        </div>
      </form>

      <Drawer open={addPatientDrawerOpen} onClose={() => setAddPatientDrawerOpen(false)} title="Add New Patient" width="max-w-md">
        <form onSubmit={handleCreatePatient} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">Full Name *</label>
            <input type="text" name="name" value={newPatientForm.name} onChange={handleNewPatientChange} placeholder="Patient full name" className={inputBase} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">Phone *</label>
            <input type="tel" name="phone" value={newPatientForm.phone} onChange={handleNewPatientChange} placeholder="Phone number" className={inputBase} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">Email</label>
            <input type="email" name="email" value={newPatientForm.email} onChange={handleNewPatientChange} placeholder="Optional" className={inputBase} />
          </div>
          <div>
            <DatePicker label="Date of Birth" placeholder="mm/dd/yyyy" value={newPatientForm.date_of_birth} onChange={(v) => setNewPatientForm((f) => ({ ...f, date_of_birth: v || '' }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">Gender</label>
            <select name="gender" value={newPatientForm.gender} onChange={handleNewPatientChange} className={inputBase}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setAddPatientDrawerOpen(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={newPatientSaving} className="btn-primary flex-1" aria-busy={newPatientSaving}>{newPatientSaving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
