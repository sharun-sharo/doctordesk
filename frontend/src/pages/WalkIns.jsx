import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { UserPlus, Loader2, Calendar, Pencil, ChevronDown, Search } from 'lucide-react';
import Drawer from '../components/ui/Drawer';
import { useAuth } from '../context/AuthContext';
import { formatTime12h } from '../lib/format';

const DEBOUNCE_MS = 200;
const inputBase =
  'h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-[15px] text-gray-800 transition-all duration-200 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0';

export default function WalkIns() {
  const { user, isDoctor, isAdmin, isReceptionist, isAssistantDoctor } = useAuth();
  const isDoctorOrAdmin = isDoctor || isAdmin;
  const isReceptionistOrAssistant = isReceptionist || isAssistantDoctor;
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const [form, setForm] = useState({ patient_id: '', doctor_id: '' });
  const [saving, setSaving] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [addPatientDrawerOpen, setAddPatientDrawerOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    phone: '',
    email: '',
    age: '',
    gender: '',
  });
  const [newPatientSaving, setNewPatientSaving] = useState(false);
  const patientRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);
  const doctorIdForSubmit = isDoctor ? user?.id : form.doctor_id;

  useEffect(() => {
    api.get('/patients', { params: { limit: 500 } }).then(({ data }) => setPatients(data.data.patients || [])).catch(() => setPatients([]));
  }, []);

  useEffect(() => {
    api.get('/users/doctors').then(({ data }) => setDoctors(data.data || [])).catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    if (isDoctorOrAdmin && user?.id) {
      setForm((f) => ({ ...f, doctor_id: user.id }));
    }
  }, [isDoctorOrAdmin, user?.id]);

  useEffect(() => {
    if (isReceptionistOrAssistant && doctors.length > 0) {
      setForm((f) => {
        if (f.doctor_id !== '' && f.doctor_id != null) return f;
        const firstId = user?.assignedAdminId || doctors[0]?.id;
        return firstId != null ? { ...f, doctor_id: firstId } : f;
      });
    }
  }, [doctors, isReceptionistOrAssistant, user?.assignedAdminId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(patientSearch), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [patientSearch]);

  useEffect(() => {
    const h = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  useEffect(() => {
    setLoadingList(true);
    api
      .get('/appointments', { params: { date_from: today, date_to: today, limit: 50, page: 1 } })
      .then(({ data }) => setTodayAppointments(data.data?.appointments || []))
      .catch(() => setTodayAppointments([]))
      .finally(() => setLoadingList(false));
  }, [today]);

  const filteredPatients = useMemo(
    () =>
      patients.filter(
        (p) =>
          !debouncedSearch.trim() ||
          p.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          p.phone?.includes(debouncedSearch)
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
    if (!name) {
      toast.error('Full name is required');
      return;
    }
    if (!phone) {
      toast.error('Phone is required');
      return;
    }
    setNewPatientSaving(true);
    try {
      const ageNum = newPatientForm.age?.trim() ? parseInt(newPatientForm.age.trim(), 10) : null;
      const date_of_birth =
        ageNum != null && !Number.isNaN(ageNum) && ageNum >= 0 && ageNum <= 150
          ? `${new Date().getFullYear() - ageNum}-01-01`
          : undefined;
      const { data } = await api.post('/patients', {
        name,
        phone,
        email: newPatientForm.email?.trim() || undefined,
        date_of_birth,
        gender: newPatientForm.gender || undefined,
      });
      const created = data.data;
      setPatients((prev) => [created, ...prev]);
      setForm((f) => ({ ...f, patient_id: created.id }));
      setAddPatientDrawerOpen(false);
      setNewPatientForm({ name: '', phone: '', email: '', age: '', gender: '' });
      setPatientSearch('');
      toast.success('Patient added and selected');
    } catch (err) {
      const res = err.response?.data;
      const msg = res?.errors?.length ? res.errors.map((e) => e.message).join('. ') : res?.message || 'Failed to add patient';
      toast.error(msg);
    } finally {
      setNewPatientSaving(false);
    }
  };

  const getCurrentTimeAndEnd = () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    const total = h * 60 + m + 30;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;
    return { startTime, endTime };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_id) {
      toast.error('Select or add a patient');
      return;
    }
    if (!doctorIdForSubmit && !isDoctor) {
      toast.error('Select a doctor.');
      return;
    }
    setSaving(true);
    try {
      const { startTime, endTime } = getCurrentTimeAndEnd();
      await api.post('/appointments', {
        patient_id: parseInt(form.patient_id, 10),
        doctor_id: parseInt(doctorIdForSubmit, 10),
        appointment_date: today,
        start_time: startTime,
        end_time: endTime,
        status: 'completed',
        notes: 'Walk-in',
      });
      toast.success('Walk-in registered');
      setForm((f) => ({ patient_id: '', doctor_id: isDoctor ? user?.id : f.doctor_id }));
      setPatientSearch('');
      const { data: listData } = await api.get('/appointments', {
        params: { date_from: today, date_to: today, limit: 50, page: 1 },
      });
      setTodayAppointments(listData.data?.appointments || []);
    } catch (err) {
      const res = err.response?.data;
      const msg = res?.errors?.length ? res.errors.map((e) => e.message).join('. ') : res?.message || 'Failed to register walk-in';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Walk-ins</h1>
          <p className="mt-1 text-sm text-slate-500">Register walk-in patients and book them for today.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary-600" />
          Register walk-in
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
            <div className="relative sm:col-span-2 lg:col-span-2" ref={patientRef}>
              <label htmlFor="walkin-patient" className="input-label block mb-1">
                Patient <span className="text-red-500">*</span>
              </label>
              <button
                id="walkin-patient"
                type="button"
                onClick={() => setPatientOpen((o) => !o)}
                className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-4 text-left text-[15px] transition-all duration-200 ${
                  patientOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-gray-300'
                }`}
                aria-haspopup="listbox"
                aria-expanded={patientOpen}
                aria-label="Select patient"
              >
                <span className={selectedPatient ? 'text-gray-800' : 'text-gray-500'}>
                  {selectedPatient ? `${selectedPatient.name} – ${selectedPatient.phone}` : 'Search or select a patient'}
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
              </button>
              {patientOpen && (
                <div
                  className="absolute top-full left-0 right-0 z-10 mt-1 flex max-h-[min(400px,70vh)] flex-col rounded-lg border border-slate-200 bg-white shadow-lg"
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
                      <li className="px-4 py-3 text-[14px] text-slate-500">No patients yet</li>
                    ) : filteredPatients.length === 0 ? (
                      <li className="px-4 py-4 text-center text-[14px] text-slate-500">No patient found</li>
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
                            className="w-full px-4 py-2.5 text-left text-[14px] text-slate-800 transition-colors hover:bg-slate-50"
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
            </div>
            {!isDoctor && (
              <div>
                <label htmlFor="walkin-doctor" className="input-label block mb-1">
                  Doctor <span className="text-red-500">*</span>
                </label>
                <select
                  id="walkin-doctor"
                  value={form.doctor_id == null || form.doctor_id === '' ? '' : String(form.doctor_id)}
                  onChange={(e) => setForm((f) => ({ ...f, doctor_id: e.target.value || '' }))}
                  className={inputBase}
                  aria-label="Select doctor"
                >
                  <option value="">Select a doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 w-full sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {saving ? 'Registering…' : 'Register walk-in'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-600" />
          Today&apos;s appointments
        </h2>
        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : todayAppointments.length === 0 ? (
          <p className="py-8 text-center text-slate-500">No appointments today. Register a walk-in above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {todayAppointments
              .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
              .map((apt) => (
                <li key={apt.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div>
                    <span className="font-medium text-slate-800">{apt.patient_name}</span>
                    <span className="text-slate-500 ml-2">{formatTime12h(apt.start_time)}</span>
                    {apt.notes && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate max-w-md">{apt.notes}</p>
                    )}
                  </div>
                  <Link
                    to={`/appointments/${apt.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Link>
                </li>
              ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-slate-500">
          <Link to="/appointments" className="text-primary-600 hover:underline">View all appointments</Link>
        </p>
      </div>

      <Drawer open={addPatientDrawerOpen} onClose={() => setAddPatientDrawerOpen(false)} title="Add New Patient" width="max-w-md">
        <form onSubmit={handleCreatePatient} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Full Name *</label>
            <input
              type="text"
              name="name"
              value={newPatientForm.name}
              onChange={handleNewPatientChange}
              placeholder="Patient full name"
              className={inputBase}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Phone *</label>
            <input
              type="tel"
              name="phone"
              value={newPatientForm.phone}
              onChange={handleNewPatientChange}
              placeholder="Phone number"
              className={inputBase}
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Email</label>
            <input
              type="email"
              name="email"
              value={newPatientForm.email}
              onChange={handleNewPatientChange}
              placeholder="Optional"
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Age</label>
            <input
              type="number"
              name="age"
              min={0}
              max={150}
              value={newPatientForm.age}
              onChange={handleNewPatientChange}
              placeholder="Optional"
              className={inputBase}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Gender</label>
            <select name="gender" value={newPatientForm.gender} onChange={handleNewPatientChange} className={inputBase}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setAddPatientDrawerOpen(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={newPatientSaving} className="btn-primary flex-1" aria-busy={newPatientSaving}>
              {newPatientSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
