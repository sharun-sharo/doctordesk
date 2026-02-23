import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import { Calendar, FileText, CreditCard, Pencil } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { formatTime12h } from '../lib/format';

export default function PatientView() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/patients/${id}`).then(({ data }) => setPatient(data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) api.get(`/patients/${id}/medical-history`).then(({ data }) => setHistory(data.data)).catch(() => {});
  }, [id]);

  if (loading || !patient) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display text-slate-900">{patient.name}</h1>
        <Link to={`/patients/${id}/edit`} className="btn-primary inline-flex items-center gap-2">
          <Pencil className="h-4 w-4" /> Edit
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-title text-slate-900 mb-4">Details</h2>
          <dl className="space-y-3 text-body">
            <div><dt className="text-caption text-slate-500">Phone</dt><dd>{patient.phone}</dd></div>
            <div><dt className="text-caption text-slate-500">Email</dt><dd>{patient.email || '—'}</dd></div>
            <div><dt className="text-caption text-slate-500">DOB</dt><dd>{patient.date_of_birth || '—'}</dd></div>
            <div><dt className="text-caption text-slate-500">Gender</dt><dd>{patient.gender || '—'}</dd></div>
            <div><dt className="text-caption text-slate-500">Blood group</dt><dd>{patient.blood_group || '—'}</dd></div>
            <div><dt className="text-caption text-slate-500">Address</dt><dd>{patient.address || '—'}</dd></div>
            {patient.allergies && <div><dt className="text-caption text-slate-500">Allergies</dt><dd className="text-warning-dark">{patient.allergies}</dd></div>}
            {patient.medical_notes && <div><dt className="text-caption text-slate-500">Medical notes</dt><dd>{patient.medical_notes}</dd></div>}
          </dl>
        </div>
        <div className="card">
          <h2 className="text-title text-slate-900 mb-4">Quick actions</h2>
          <div className="flex flex-wrap gap-3">
            <Link to={`/appointments/new?patient_id=${id}`} className="btn-primary inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" /> New Appointment
            </Link>
            <Link to={`/prescriptions/new?patient_id=${id}`} className="btn-secondary inline-flex items-center gap-2">
              <FileText className="h-4 w-4" /> Prescription
            </Link>
            <Link to={`/invoices/new?patient_id=${id}`} className="btn-secondary inline-flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Invoice
            </Link>
          </div>
        </div>
      </div>
      {history && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="text-title text-slate-900 mb-4">Recent Appointments</h2>
            <ul className="space-y-2">
              {(history.appointments || []).slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between text-body">
                  <span>{new Date(a.appointment_date).toLocaleDateString()} {formatTime12h(a.start_time)}</span>
                  <span>{a.doctor_name} · {a.status}</span>
                </li>
              ))}
              {(history.appointments || []).length === 0 && <li className="text-slate-500">No appointments</li>}
            </ul>
          </div>
          <div className="card">
            <h2 className="text-title text-slate-900 mb-4">Recent Prescriptions</h2>
            <ul className="space-y-2">
              {(history.prescriptions || []).slice(0, 5).map((p) => (
                <li key={p.id} className="flex justify-between text-body">
                  <Link to={`/prescriptions/${p.id}`} className="text-primary-600 hover:underline">
                    {new Date(p.created_at).toLocaleDateString()}
                  </Link>
                  <span>{p.diagnosis || '—'}</span>
                </li>
              ))}
              {(history.prescriptions || []).length === 0 && <li className="text-slate-500">No prescriptions</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
