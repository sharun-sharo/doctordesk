import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Pencil, Printer } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import FormInput from '../components/ui/FormInput';
import DatePicker from '../components/ui/DatePicker';
import InvoiceDocument from '../components/invoice/InvoiceDocument';
import { toYYYYMMDD } from '../components/ui/calendar/calendarUtils';
import { logoImageSrc } from '../utils/logoImageSrc';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
const API_ORIGIN = API_BASE.startsWith('http') ? API_BASE.replace(/\/api\/v1\/?$/, '') : '';

export default function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [clinic, setClinic] = useState({ name: 'DoctorDesk', logoUrl: null });
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(false);
  const [dateModal, setDateModal] = useState(false);
  const [paidAmount, setPaidAmount] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  useEffect(() => {
    Promise.all([
      api.get(`/invoices/${id}`),
      api.get('/settings').catch(() => ({ data: { data: {} } })),
    ])
      .then(([invRes, settingsRes]) => {
        setInvoice(invRes.data.data);
        const d = settingsRes.data?.data || {};
        const bust = Date.now();
        setClinic({
          name: import.meta.env.VITE_CLINIC_NAME || 'DoctorDesk',
          logoUrl: logoImageSrc(d.logoUrl, API_ORIGIN, bust),
          address: d.invoiceAddress || '',
          phone: d.invoicePhone || '',
          email: d.invoiceEmail || '',
          gstin: d.invoiceGstin || '',
        });
      })
      .catch(() => toast.error('Not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const openDateModal = () => {
    setInvoiceDate(toYYYYMMDD(new Date(invoice.created_at)) || '');
    setDateModal(true);
  };

  const updateDate = () => {
    if (!invoiceDate) {
      toast.error('Select a date');
      return;
    }
    setSavingDate(true);
    api.patch(`/invoices/${id}/date`, { invoice_date: invoiceDate })
      .then(({ data }) => {
        setInvoice((i) => ({ ...i, created_at: data.data.created_at }));
        setDateModal(false);
        toast.success('Date updated');
      })
      .catch(() => toast.error('Failed to update date'))
      .finally(() => setSavingDate(false));
  };

  const updatePayment = () => {
    const paid = parseFloat(paidAmount) || 0;
    setSaving(true);
    api.patch(`/invoices/${id}/payment`, { paid_amount: paid })
      .then(() => {
        setInvoice((i) => ({
          ...i,
          paid_amount: paid,
          payment_status: paid >= (invoice?.total || 0) ? 'paid' : paid > 0 ? 'partial' : 'pending',
        }));
        setPayModal(false);
        toast.success('Updated');
      })
      .catch(() => toast.error('Failed'))
      .finally(() => setSaving(false));
  };

  const downloadPdf = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_BASE}/invoices/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
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
  };

  const handlePrint = () => window.print();

  if (loading || !invoice) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="invoice-page min-h-full bg-slate-100/80 pb-12 print:bg-white print:pb-0">
      {/* Toolbar — hidden when printing */}
      <div className="invoice-toolbar sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-md print:hidden sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Billing</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Invoice {invoice.invoice_number}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setPaidAmount(String(invoice.paid_amount ?? '')); setPayModal(true); }} className="btn-primary">
              Update payment
            </button>
            <button type="button" onClick={openDateModal} className="btn-secondary inline-flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit date
            </button>
            <button type="button" onClick={handlePrint} className="btn-secondary inline-flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button type="button" onClick={downloadPdf} className="btn-secondary inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              PDF
            </button>
            <Link to="/invoices" className="btn-ghost">
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Invoice canvas */}
      <div className="invoice-print-area mx-auto max-w-5xl px-4 py-8 print:max-w-none print:p-0 sm:px-6">
        <InvoiceDocument invoice={invoice} clinic={clinic} />
      </div>

      <Modal open={dateModal} onClose={() => setDateModal(false)} title="Edit invoice date">
        <DatePicker label="Invoice date" value={invoiceDate} onChange={setInvoiceDate} placeholder="Select date" />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setDateModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={updateDate} className="btn-primary" disabled={savingDate}>
            {savingDate ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Update payment">
        <FormInput
          label="Paid amount"
          type="number"
          min={0}
          step={0.01}
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          placeholder="0.00"
        />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={updatePayment} className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
