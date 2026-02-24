import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { ChevronDown, Search, Loader2, UserPlus, MessageCircle } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';
import Drawer from '../components/ui/Drawer';
import DatePicker from '../components/ui/DatePicker';
import { useAuth } from '../context/AuthContext';
import { formatTime12h } from '../lib/format';

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
  'h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-[15px] text-gray-800 transition-all duration-200 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:ring-offset-0 aria-invalid:border-red-500 aria-invalid:focus:ring-red-500/20';

export default function AppointmentForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const prePatient = searchParams.get('patient_id');
  const isEdit = !!id;
  const { isDoctor, isAdmin, user } = useAuth();
  const isDoctorOrAdmin = isDoctor || isAdmin;
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [form, setForm] = useState({
    patient_id: prePatient || '',
    doctor_id: '',
    appointment_date: '',
    start_time: '',
    end_time: '',
    status: 'scheduled',
    notes: '',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const [addPatientDrawerOpen, setAddPatientDrawerOpen] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    phone: '',
    email: '',
    age: '',
    gender: '',
  });
  const [newPatientSaving, setNewPatientSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [lastVisitAppointment, setLastVisitAppointment] = useState(null);
  const [customTime, setCustomTime] = useState('');
  const patientRef = useRef(null);

  function add30Minutes(timeStr) {
    if (!timeStr) return '';
    const [h, m] = String(timeStr).split(':').map(Number);
    const total = (h || 0) * 60 + (m || 0) + 30;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}:00`;
  }

  function normalizeTimeForApi(value) {
    if (!value) return '';
    const [h, m] = String(value).split(':').map(Number);
    return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`;
  }

  useEffect(() => {
    if (!form.patient_id) {
      setLastVisitAppointment(null);
      return;
    }
    api.get('/appointments', { params: { patient_id: form.patient_id, limit: 1 } })
      .then(({ data }) => {
        const list = data?.data?.appointments || [];
        setLastVisitAppointment(list.length ? list[0] : null);
      })
      .catch(() => setLastVisitAppointment(null));
  }, [form.patient_id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(patientSearch), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [patientSearch]);

  useEffect(() => {
    if (isDoctorOrAdmin && user?.id) {
      setForm((f) => ({ ...f, doctor_id: user.id }));
    }
  }, [isDoctorOrAdmin, user?.id]);

  useEffect(() => {
    api.get('/users/doctors').then(({ data }) => {
      const list = Array.isArray(data?.data) ? data.data : [];
      setDoctors(list);
    }).catch(() => setDoctors([]));
    api.get('/patients', { params: { limit: 500 } }).then(({ data }) => {
      setPatients(data.data.patients || []);
    });
  }, []);

  // Default doctor to first when doctors load on New Appointment (reception / super admin)
  useEffect(() => {
    if (isEdit || isDoctorOrAdmin || doctors.length === 0) return;
    const firstId = doctors[0].id;
    if (firstId == null) return;
    setForm((f) => {
      const current = f.doctor_id;
      if (current === '' || current === undefined || current === null) return { ...f, doctor_id: firstId };
      return f;
    });
  }, [doctors, isEdit, isDoctorOrAdmin]);

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/appointments/${id}`)
        .then(({ data }) => {
          const d = data.data;
          setForm((f) => ({
            ...f,
            ...d,
            patient_id: d.patient_id,
            doctor_id: d.doctor_id,
          }));
        })
        .catch(() => toast.error('Not found'))
        .finally(() => setLoading(false));
    } else if (prePatient) {
      setForm((f) => ({ ...f, patient_id: prePatient }));
    }
  }, [id, isEdit, prePatient]);

  useEffect(() => {
    if (form.doctor_id && form.appointment_date) {
      setSlotsLoading(true);
      setErrors((e) => ({ ...e, start_time: null }));
      api
        .get('/appointments/slots', {
          params: { doctor_id: form.doctor_id, date: form.appointment_date },
        })
        .then(({ data }) => {
          const list = data.data || [];
          setSlots(list);
          // Smart default: auto-select first available slot that is not in the past
          if (list.length > 0) {
            setForm((f) => {
              const current = f.start_time;
              const date = f.appointment_date;
              const today = new Date().toISOString().slice(0, 10);
              const isPast = (slot) => {
                if (date !== today || !slot) return false;
                const [h, m] = String(slot).split(':').map(Number);
                const slotStart = new Date();
                slotStart.setHours(h || 0, m || 0, 0, 0);
                return new Date() >= slotStart;
              };
              if (!current || !list.includes(current) || isPast(current)) {
                const first = list.find((s) => !isPast(s)) || list[0];
                return { ...f, start_time: first, end_time: first };
              }
              return f;
            });
          }
        })
        .catch(() => setSlots([]))
        .finally(() => setSlotsLoading(false));
    } else {
      setSlots([]);
    }
  }, [form.doctor_id, form.appointment_date]);

  useEffect(() => {
    if (form.doctor_id && form.appointment_date && slots.length > 0 && !slots.includes(form.start_time)) {
      if (!customTime) setForm((f) => ({ ...f, start_time: '', end_time: '' }));
    }
  }, [slots, form.doctor_id, form.appointment_date, customTime]);

  // Clear selected slot if it is now in the past (e.g. user left page open on today)
  useEffect(() => {
    if (!form.appointment_date || !form.start_time) return;
    const today = new Date().toISOString().slice(0, 10);
    if (form.appointment_date !== today) return;
    const [h, m] = String(form.start_time).split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(h || 0, m || 0, 0, 0);
    if (new Date() >= slotStart) {
      setForm((f) => ({ ...f, start_time: '', end_time: '' }));
      setCustomTime('');
    }
  }, [form.appointment_date, form.start_time]);

  useEffect(() => {
    const h = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

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
      const { data } = await api.post('/patients', {
        name,
        phone,
        email: newPatientForm.email?.trim() || undefined,
        date_of_birth: (() => {
          const ageNum = newPatientForm.age?.trim() ? parseInt(newPatientForm.age.trim(), 10) : null;
          if (ageNum == null || Number.isNaN(ageNum) || ageNum < 0 || ageNum > 150) return undefined;
          return `${new Date().getFullYear() - ageNum}-01-01`;
        })(),
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

  const handleSendWhatsApp = () => {
    if (!id) return;
    setWhatsappSending(true);
    api
      .post(`/appointments/${id}/send-whatsapp`, {})
      .then(() => toast.success('WhatsApp sent'))
      .catch((err) => toast.error(err.response?.data?.message || 'Failed to send WhatsApp'))
      .finally(() => setWhatsappSending(false));
  };

  const clearError = (field) => setErrors((e) => ({ ...e, [field]: null }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    clearError(name);
    const next = { ...form, [name]: value };
    if (name === 'doctor_id' || name === 'appointment_date') {
      next.start_time = '';
      next.end_time = '';
    }
    if (name === 'patient_id' || name === 'doctor_id') {
      next[name] = value ? parseInt(value, 10) : '';
    }
    setForm(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    const newErrors = {};
    if (!form.patient_id) newErrors.patient_id = 'Select a patient';
    if (!isDoctorOrAdmin && !form.doctor_id) newErrors.doctor_id = 'Select a doctor';
    if (!form.appointment_date) newErrors.appointment_date = 'Select a date';
    if (!form.start_time) newErrors.start_time = 'Select a time slot or enter a custom time';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const first = Object.keys(newErrors)[0];
      const el = document.getElementById(`field-${first}`);
      el?.focus?.();
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }
    const payload = {
      ...form,
      patient_id: parseInt(form.patient_id, 10),
      doctor_id: parseInt(form.doctor_id, 10),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/appointments/${id}`, {
          appointment_date: form.appointment_date,
          start_time: form.start_time,
          end_time: form.end_time,
          status: form.status,
          notes: form.notes,
        });
        toast.success('Appointment updated');
        setSaveSuccess(true);
      } else {
        await api.post('/appointments', payload);
        toast.success('Appointment booked successfully');
        setSaveSuccess(true);
      }
      navigate('/appointments');
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      const msg = data?.message || 'Something went wrong. Please try again.';

      if (status === 401) {
        toast.error('Your session may have expired. Please sign in again.');
        return;
      }
      if (msg.toLowerCase().includes('already booked') || msg.toLowerCase().includes('slot')) {
        setErrors((e) => ({ ...e, start_time: 'This slot was just taken. Please choose another time.' }));
        setSlots((prev) => prev.filter((s) => s !== form.start_time));
        setForm((f) => ({ ...f, start_time: '', end_time: '' }));
      } else if (status === 400 && Array.isArray(data?.errors)) {
        const byField = {};
        data.errors.forEach((e) => { byField[e.field] = e.message; });
        setErrors((prev) => ({ ...prev, ...byField }));
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const formatSlotDisplay = (t) => formatTime12h(t) || '';

  // True if the slot is in the past on the selected date (for today: slot start time has passed)
  const isSlotPast = (slot) => {
    if (!form.appointment_date || !slot) return false;
    const today = new Date().toISOString().slice(0, 10);
    if (form.appointment_date !== today) return false;
    const [h, m] = String(slot).split(':').map(Number);
    const slotStart = new Date();
    slotStart.setHours(h || 0, m || 0, 0, 0);
    return new Date() >= slotStart;
  };

  // For dropdown: show only available slots; when date is today, exclude past times
  const slotsForDropdown = useMemo(() => {
    if (!form.appointment_date || !slots.length) return slots;
    const today = new Date().toISOString().slice(0, 10);
    if (form.appointment_date !== today) return slots;
    const now = new Date();
    return slots.filter((s) => {
      const [h, m] = String(s).split(':').map(Number);
      const slotStart = new Date(now);
      slotStart.setHours(h || 0, m || 0, 0, 0);
      return now < slotStart;
    });
  }, [slots, form.appointment_date]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-[60vh] bg-gray-50">
      <header className="mb-8">
        <nav className="mb-2 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link to="/appointments" className="transition-colors hover:text-gray-800">
            Appointments
          </Link>
          <span aria-hidden>/</span>
          <span className="text-gray-800">
            {isEdit ? 'Edit appointment' : 'New appointment'}
          </span>
        </nav>
        <h1 className="text-2xl font-semibold text-gray-800 tracking-tight leading-relaxed">
          {isEdit ? 'Edit appointment' : 'Book an appointment'}
        </h1>
        <p className="mt-1 text-sm text-gray-500 leading-relaxed">
          {isEdit ? 'Update date, time, or status.' : 'Choose patient, doctor, date and time.'}
        </p>
        <div className="mt-4 h-px bg-gray-200" />
      </header>

      <form onSubmit={handleSubmit} className="space-y-8" noValidate aria-label={isEdit ? 'Edit appointment form' : 'New appointment form'}>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="mx-auto max-w-2xl space-y-10">
            {/* Step 1: Who & when – Patient, Doctor, Date, Time */}
            <section className="space-y-6" aria-labelledby="section-schedule">
              <h2 id="section-schedule" className="text-sm font-semibold text-gray-800 leading-relaxed">
                1. Patient
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="relative sm:col-span-2" ref={patientRef}>
                      <label htmlFor="field-patient_id" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Patient <span className="text-red-500" aria-hidden>*</span>
                      </label>
                      <button
                        id="field-patient_id"
                        type="button"
                        onClick={() => setPatientOpen((o) => !o)}
                        className={`flex h-11 w-full items-center justify-between rounded-lg border bg-white px-4 text-left text-[15px] transition-all duration-200 ${patientOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-200 hover:border-gray-300'} ${errors.patient_id ? 'border-red-500' : ''}`}
                        aria-haspopup="listbox"
                        aria-expanded={patientOpen}
                        aria-label="Select patient"
                        aria-describedby={errors.patient_id ? 'error-patient_id' : undefined}
                        aria-invalid={!!errors.patient_id}
                      >
                        <span className={selectedPatient ? 'text-gray-800' : 'text-gray-500'}>
                          {selectedPatient
                            ? `${selectedPatient.name} – ${selectedPatient.phone}`
                            : 'Search or select a patient'}
                        </span>
                        <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
                      </button>
                      {errors.patient_id && (
                        <p id="error-patient_id" className="mt-1.5 text-sm text-red-600" role="alert">
                          {errors.patient_id}
                        </p>
                      )}
                      <input
                        type="hidden"
                        name="patient_id"
                        value={form.patient_id}
                        readOnly
                        aria-hidden
                      />
                      {patientOpen && (
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
                              <li className="px-4 py-3 text-[14px] text-[#64748B]">
                                No patients yet
                              </li>
                            ) : filteredPatients.length === 0 ? (
                              <li className="px-4 py-4 text-center text-[14px] text-[#64748B]">
                                No patient found
                              </li>
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
                    </div>
                    {selectedPatient && (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-[14px] text-[#64748B]">
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {getAge(selectedPatient.date_of_birth) != null && (
                            <span>Age {getAge(selectedPatient.date_of_birth)}</span>
                          )}
                          <span>{selectedPatient.phone}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200/80">
                          <span className="font-medium text-slate-600">Last visit: </span>
                          {lastVisitAppointment ? (
                            <span>
                              {new Date(lastVisitAppointment.appointment_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                              {lastVisitAppointment.start_time && (
                                <> at {formatTime12h(lastVisitAppointment.start_time)}</>
                              )}
                              {lastVisitAppointment.doctor_name && (
                                <> with {lastVisitAppointment.doctor_name}</>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">No previous visits</span>
                          )}
                        </div>
                      </div>
                    )}
                {!isDoctorOrAdmin && (
                    <div className="sm:col-span-2">
                      <label htmlFor="field-doctor_id" className="mb-1.5 block text-sm font-medium text-gray-700">
                        Doctor <span className="text-red-500" aria-hidden>*</span>
                      </label>
                      <select
                        id="field-doctor_id"
                        name="doctor_id"
                        value={form.doctor_id == null || form.doctor_id === '' ? '' : String(form.doctor_id)}
                        onChange={handleChange}
                        className={inputBase}
                        required
                        aria-label="Select doctor"
                        aria-describedby={errors.doctor_id ? 'error-doctor_id' : undefined}
                        aria-invalid={!!errors.doctor_id}
                      >
                        <option value="">Select a doctor</option>
                        {doctors.length > 0 && (
                          <option value={String(doctors[0].id)}>
                            {doctors[0].name}
                          </option>
                        )}
                        {doctors.slice(1).map((d) => (
                          <option key={d.id} value={String(d.id)}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {errors.doctor_id && (
                        <p id="error-doctor_id" className="mt-1.5 text-sm text-red-600" role="alert">
                          {errors.doctor_id}
                        </p>
                      )}
                    </div>
                )}
              </div>
            </section>

            {/* 2. Date & time */}
            <section className="space-y-6" aria-labelledby="section-datetime">
              <h2 id="section-datetime" className="text-sm font-semibold text-gray-800 leading-relaxed">
                2. Date &amp; time
              </h2>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <DatePicker
                    id="field-appointment_date"
                    label="Date *"
                    value={form.appointment_date}
                    onChange={(v) => { clearError('appointment_date'); setForm((f) => ({ ...f, appointment_date: v || '' })); }}
                    min={isEdit ? undefined : new Date().toISOString().slice(0, 10)}
                    placeholder="Select date"
                    error={errors.appointment_date}
                    aria-describedby="error-appointment_date"
                  />
                </div>
                <div>
                  <label htmlFor="field-start_time" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Time slot <span className="text-red-500" aria-hidden>*</span>
                  </label>
                  {!form.doctor_id || !form.appointment_date ? (
                    <div
                      className="flex h-11 items-center rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500"
                      role="status"
                      aria-live="polite"
                    >
                      Select doctor and date first
                    </div>
                  ) : slotsLoading ? (
                    <div
                      className="flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading times…
                    </div>
                  ) : (
                    <>
                      <select
                        id="field-start_time"
                        value={slotsForDropdown.includes(form.start_time) ? form.start_time : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          clearError('start_time');
                          setCustomTime('');
                          setForm((f) => ({ ...f, start_time: value, end_time: value }));
                        }}
                        className={`w-full ${inputBase} min-w-0 pr-10 ${errors.start_time ? 'border-red-500' : ''}`}
                        aria-label="Choose time slot (available times only)"
                        aria-describedby={errors.start_time ? 'error-start_time' : 'helper-start_time'}
                        aria-invalid={!!errors.start_time}
                      >
                        <option value="">Choose a time…</option>
                        {slotsForDropdown.map((slot) => (
                          <option key={slot} value={slot}>
                            {formatSlotDisplay(slot)}
                          </option>
                        ))}
                      </select>
                      <div className="mt-3">
                        <label htmlFor="field-custom_time" className="mb-1 block text-xs font-medium text-gray-600">
                          Or enter custom time
                        </label>
                        <input
                          id="field-custom_time"
                          type="time"
                          value={customTime || (form.start_time && !slots.includes(form.start_time) ? String(form.start_time).slice(0, 5) : '')}
                          onChange={(e) => {
                            const value = e.target.value;
                            clearError('start_time');
                            setCustomTime(value);
                            if (value) {
                              const start = normalizeTimeForApi(value);
                              setForm((f) => ({ ...f, start_time: start, end_time: add30Minutes(start) }));
                            } else {
                              setForm((f) => ({ ...f, start_time: '', end_time: '' }));
                            }
                          }}
                          className={`w-full max-w-[10rem] ${inputBase} min-w-0 ${errors.start_time ? 'border-red-500' : ''}`}
                          aria-label="Custom time (manual entry)"
                        />
                      </div>
                      {slotsForDropdown.length === 0 && !customTime && !form.start_time && (
                        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
                          No slots available this day. Try another date or enter a custom time.
                        </p>
                      )}
                      {errors.start_time ? (
                        <p id="error-start_time" className="mt-1.5 text-sm text-red-600" role="alert">
                          {errors.start_time}
                        </p>
                      ) : (
                        <p id="helper-start_time" className="mt-1.5 text-xs text-gray-500">
                          Pick a slot or enter a custom time. 30 min duration.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isEdit && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                    Status
                  </label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={inputBase}
                    aria-label="Appointment status"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="no_show">No show</option>
                  </select>
                </div>
              )}
            </section>

            {/* 3. Notes (optional) */}
            <section className="space-y-4" aria-labelledby="section-notes">
              <h2 id="section-notes" className="text-sm font-semibold text-gray-800 leading-relaxed">
                3. Notes <span className="font-normal text-gray-500">(optional)</span>
              </h2>
              <div>
                <label htmlFor="field-notes" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="field-notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={4}
                  placeholder="e.g. follow-up, reason for visit…"
                  className="min-h-[100px] w-full resize-y rounded-lg border border-gray-200 bg-white px-4 py-3 text-[15px] text-gray-800 placeholder-gray-400 transition-all duration-200 hover:border-gray-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  aria-label="Additional notes for this appointment"
                />
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end sm:gap-3" role="group" aria-label="Form actions">
              <button type="button" onClick={() => navigate('/appointments')} className="btn-secondary">
                Cancel
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={whatsappSending}
                  className="btn-secondary inline-flex items-center gap-2 text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300"
                  aria-label="Send WhatsApp to patient"
                >
                  <MessageCircle className="h-4 w-4" />
                  {whatsappSending ? 'Sending…' : 'Send WhatsApp'}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
                aria-busy={saving}
                aria-live="polite"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : isEdit ? (
                  'Update appointment'
                ) : (
                  'Book appointment'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      <Drawer
        open={addPatientDrawerOpen}
        onClose={() => setAddPatientDrawerOpen(false)}
        title="Add New Patient"
        width="max-w-md"
      >
        <form onSubmit={handleCreatePatient} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              Full Name *
            </label>
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
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              Phone *
            </label>
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
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              Email
            </label>
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
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              Age
            </label>
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
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              Gender
            </label>
            <select
              name="gender"
              value={newPatientForm.gender}
              onChange={handleNewPatientChange}
              className={inputBase}
            >
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
