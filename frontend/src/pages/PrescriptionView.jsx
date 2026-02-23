import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';
import { Paperclip, Download } from 'lucide-react';

export default function PrescriptionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    setError(false);
    api.get(`/prescriptions/${id}`)
      .then(({ data }) => { setPrescription(data.data); setError(false); })
      .catch(() => { setPrescription(null); setError(true); toast.error('Prescription not found'); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-12"><Spinner className="h-10 w-10" /></div>;
  if (error || !prescription) {
    return (
      <div className="card max-w-md mx-auto mt-8 p-6 text-center">
        <p className="text-gray-600 mb-4">Prescription not found or failed to load.</p>
        <button type="button" onClick={() => navigate('/prescriptions')} className="btn-primary">Back to Prescriptions</button>
      </div>
    );
  }

  let medicines = prescription.medicines;
  if (!Array.isArray(medicines)) {
    if (typeof medicines === 'string') {
      try {
        medicines = JSON.parse(medicines || '[]');
      } catch {
        medicines = [];
      }
    } else {
      medicines = [];
    }
  }
  medicines = Array.isArray(medicines) ? medicines : [];

  let attachments = Array.isArray(prescription.attachments) ? prescription.attachments : [];
  if (attachments.length === 0 && (prescription.attachment_original_name || prescription.attachment_path)) {
    attachments = [{ id: 'legacy', original_name: prescription.attachment_original_name || prescription.attachment_path }];
  }
  const downloadAttachment = async (att) => {
    if (!att) return;
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Prescription</h1>
        <Link to={`/prescriptions/${id}/edit`} className="btn-primary">Edit</Link>
      </div>
      <div className="card max-w-2xl printable">
        <div className="grid grid-cols-2 gap-2 text-sm mb-6">
          <p><span className="text-gray-500">Patient:</span> {prescription.patient_name}</p>
          <p><span className="text-gray-500">Phone:</span> {prescription.patient_phone || '-'}</p>
          <p><span className="text-gray-500">Doctor:</span> {prescription.doctor_name}</p>
          <p><span className="text-gray-500">Date:</span> {new Date(prescription.created_at).toLocaleDateString()}</p>
        </div>
        {prescription.diagnosis && <p className="mb-2"><span className="font-medium text-gray-700">Diagnosis:</span> {prescription.diagnosis}</p>}
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-gray-300"><th className="text-left py-2">Medicine</th><th className="text-left py-2">Dosage</th><th className="text-left py-2">Duration</th><th className="text-left py-2">Instructions</th></tr></thead>
          <tbody>
            {medicines.map((m, i) => (
              <tr key={i} className="border-b border-gray-100"><td className="py-2">{m.name}</td><td>{m.dosage}</td><td>{m.duration}</td><td>{m.instructions}</td></tr>
            ))}
          </tbody>
        </table>
        {prescription.notes && <p className="mt-4 text-sm text-gray-600">{prescription.notes}</p>}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
          </h3>
          {attachments.length > 0 ? (
            <ul className="space-y-2">
              {attachments.map((att) => (
                <li key={att.id}>
                  <button
                    type="button"
                    onClick={() => downloadAttachment(att)}
                    disabled={downloadingId === att.id}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-emerald-600 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    {downloadingId === att.id ? 'Downloading…' : (att.original_name || 'Attachment')}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No attachments. Add them via Edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
