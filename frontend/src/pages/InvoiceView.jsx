import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FormInput from '../components/ui/FormInput';
import StatusBadge from '../components/ui/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/invoices/${id}`).then(({ data }) => setInvoice(data.data)).catch(() => toast.error('Not found')).finally(() => setLoading(false));
  }, [id]);

  const updatePayment = () => {
    const paid = parseFloat(paidAmount) || 0;
    setSaving(true);
    api.patch(`/invoices/${id}/payment`, { paid_amount: paid })
      .then(() => {
        setInvoice((i) => ({ ...i, paid_amount: paid, payment_status: paid >= (invoice?.total || 0) ? 'paid' : paid > 0 ? 'partial' : 'pending' }));
        setPayModal(false);
        toast.success('Updated');
      })
      .catch(() => toast.error('Failed'))
      .finally(() => setSaving(false));
  };

  if (loading || !invoice) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-display text-slate-900">Invoice {invoice.invoice_number}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPayModal(true)} className="btn-primary">Update payment</button>
          <button
            type="button"
            onClick={async () => {
              try {
                const token = localStorage.getItem('accessToken');
                const res = await fetch(`${API_BASE}/invoices/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                if (!res.ok) throw new Error('Download failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `invoice-${invoice.invoice_number}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (_) {
                toast.error('Download failed');
              }
            }}
            className="btn-secondary"
          >
            Download PDF
          </button>
          <Link to="/invoices" className="btn-secondary">Back</Link>
        </div>
      </div>
      <div className="card max-w-2xl">
        <dl className="grid grid-cols-2 gap-2 text-body mb-4">
          <dt className="text-caption text-slate-500">Patient</dt><dd>{invoice.patient_name}</dd>
          <dt className="text-caption text-slate-500">Phone</dt><dd>{invoice.patient_phone || '-'}</dd>
          <dt className="text-caption text-slate-500">Date</dt><dd>{new Date(invoice.created_at).toLocaleDateString()}</dd>
          <dt className="text-caption text-slate-500">Status</dt><dd><StatusBadge status={invoice.payment_status} /></dd>
        </dl>
        <table className="w-full text-body">
          <thead><tr className="border-b border-slate-100"><th className="text-left py-3 text-label text-slate-600">Item</th><th className="text-right py-3 text-label text-slate-600">Qty</th><th className="text-right py-3 text-label text-slate-600">Price</th><th className="text-right py-3 text-label text-slate-600">Total</th></tr></thead>
          <tbody>
            {(invoice.items || []).map((it) => (
              <tr key={it.id} className="border-b border-slate-50">
                <td className="py-2">{it.description}</td>
                <td className="text-right">{it.quantity}</td>
                <td className="text-right">₹{Number(it.unit_price).toFixed(2)}</td>
                <td className="text-right">₹{Number(it.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-6 text-right space-y-1 text-body">
          <p>Subtotal: ₹{Number(invoice.subtotal).toFixed(2)}</p>
          <p>Tax: ₹{Number(invoice.tax_amount).toFixed(2)}</p>
          <p>Discount: ₹{Number(invoice.discount).toFixed(2)}</p>
          <p className="text-title text-slate-900">Total: ₹{Number(invoice.total).toFixed(2)}</p>
          <p>Paid: ₹{Number(invoice.paid_amount).toFixed(2)}</p>
        </div>
      </div>
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Update payment">
        <FormInput label="Paid amount" type="number" min={0} step={0.01} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={updatePayment} className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </Modal>
    </div>
  );
}
