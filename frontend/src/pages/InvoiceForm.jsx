import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Trash2, ChevronDown, Search } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function InvoiceForm() {
  const [searchParams] = useSearchParams();
  const prePatient = searchParams.get('patient_id');
  const preAppointment = searchParams.get('appointment_id');
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [items, setItems] = useState([{ item_type: 'consultation', description: 'Consultation', quantity: 1, unit_price: 0 }]);
  const [form, setForm] = useState({ patient_id: prePatient || '', appointment_id: preAppointment || '', tax_percent: 0, discount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOpen, setPatientOpen] = useState(false);
  const patientRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/patients', { params: { limit: 500 } }),
      api.get('/medicines', { params: { limit: 500 } }),
    ]).then(([p, m]) => {
      setPatients(p.data.data.patients || []);
      setMedicines(m.data.data.medicines || []);
      if (prePatient || preAppointment) setForm((f) => ({ ...f, patient_id: prePatient || f.patient_id, appointment_id: preAppointment || f.appointment_id }));
    }).finally(() => setLoading(false));
  }, [prePatient, preAppointment]);

  useEffect(() => {
    const h = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) setPatientOpen(false);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const filteredPatients = patients.filter(
    (p) =>
      !patientSearch.trim() ||
      p.name?.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.phone?.includes(patientSearch)
  );
  const selectedPatient = patients.find((p) => String(p.id) === String(form.patient_id));

  const addItem = () => setItems((i) => [...i, { item_type: 'other', description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (idx) => setItems((i) => i.filter((_, k) => k !== idx));
  const updateItem = (idx, field, value) => {
    setItems((i) =>
      i.map((it, k) =>
        k === idx
          ? {
              ...it,
              [field]:
                field === 'quantity' || field === 'unit_price' ? parseFloat(value) || 0 : value,
            }
          : it
      )
    );
  };

  const subtotal = items.reduce((s, it) => s + (it.quantity || 1) * (it.unit_price || 0), 0);
  const tax = (subtotal * (form.tax_percent || 0)) / 100;
  const total = Math.max(0, subtotal + tax - (form.discount || 0));
  const hasAnyCharge = items.some((it) => (it.unit_price || 0) > 0 || (it.description || '').trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.patient_id) {
      toast.error('Select patient');
      return;
    }
    const payload = {
      patient_id: parseInt(form.patient_id, 10),
      appointment_id: form.appointment_id ? parseInt(form.appointment_id, 10) : undefined,
      items: items.map((it) => ({
        ...it,
        item_type: it.item_type || 'other',
        unit_price: it.unit_price || 0,
        quantity: it.quantity || 1,
      })),
      tax_percent: form.tax_percent || 0,
      discount: form.discount || 0,
    };
    setSaving(true);
    try {
      await api.post('/invoices', payload);
      toast.success('Invoice created');
      navigate('/invoices');
    } catch (err) {
      const data = err.response?.data;
      const message = data?.errors?.length
        ? data.errors.map((e) => e.message).join('. ')
        : data?.message || 'Failed to create invoice';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="min-h-[60vh] bg-[#F8FAFC]">
      <div className="mb-8">
        <nav className="mb-2 flex items-center gap-2 text-body text-[#64748B]">
          <Link to="/invoices" className="transition-colors hover:text-[#1E293B]">
            Billing
          </Link>
          <span aria-hidden>/</span>
          <span className="text-[#1E293B]">New Invoice</span>
        </nav>
        <h1 className="text-[1.75rem] font-bold tracking-tight text-[#1E293B]">New Invoice</h1>
        <div className="mt-3 h-px bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
          {/* Patient Details */}
          <section className="mb-8 sm:mb-10">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Patient Details
            </h2>
            <p className="mb-5 text-body text-[#64748B]">Select the patient for this invoice.</p>
            <div className="relative max-w-md" ref={patientRef}>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                Patient *
              </label>
              <button
                type="button"
                onClick={() => setPatientOpen((o) => !o)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-body text-[#1E293B] transition-all duration-200 hover:border-slate-300 focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
              >
                <span className={selectedPatient ? '' : 'text-[#64748B]'}>
                  {selectedPatient ? `${selectedPatient.name} – ${selectedPatient.phone}` : 'Select patient'}
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
              {patientOpen && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                  <div className="border-b border-slate-100 px-2 pb-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search by name or phone…"
                        className="h-10 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-body text-[#1E293B] placeholder-[#94a3b8] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                      />
                    </div>
                  </div>
                  <ul className="max-h-56 overflow-y-auto">
                    {filteredPatients.length === 0 ? (
                      <li className="px-4 py-3 text-body text-[#64748B]">No patients match</li>
                    ) : (
                      filteredPatients.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setForm((f) => ({ ...f, patient_id: String(p.id) }));
                              setPatientOpen(false);
                              setPatientSearch('');
                            }}
                            className="w-full px-4 py-2.5 text-left text-body text-[#1E293B] transition-colors hover:bg-slate-50"
                          >
                            {p.name} – {p.phone}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          </section>

          {/* Invoice Items */}
          <section>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Invoice Items
            </h2>
            <p className="mb-5 text-body text-[#64748B]">
              Add consultation, medicines, or other charges.
            </p>

            {!hasAnyCharge && (
              <p className="mb-5 rounded-lg bg-slate-50 px-4 py-3 text-body text-[#64748B]">
                Add services or consultation charges to generate invoice.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      Item Type
                    </th>
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      Description
                    </th>
                    <th className="w-24 pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      Qty
                    </th>
                    <th className="w-28 pb-3 pr-4 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                      Price
                    </th>
                    <th className="w-12 pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-100 transition-colors duration-200 hover:bg-slate-50/80"
                    >
                      <td className="py-3 pr-4">
                        <select
                          value={it.item_type}
                          onChange={(e) => updateItem(idx, 'item_type', e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                        >
                          <option value="consultation">Consultation</option>
                          <option value="medicine">Medicine</option>
                          <option value="other">Other</option>
                        </select>
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          placeholder="Description"
                          value={it.description ?? ''}
                          onChange={(e) => updateItem(idx, 'description', e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] placeholder-[#94a3b8] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={1}
                          value={it.quantity ?? ''}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0"
                          value={it.unit_price || ''}
                          onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] placeholder-[#94a3b8] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                        />
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          title="Remove item"
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-200 hover:bg-red-50 hover:text-[#EF4444] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/20"
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="btn-outline mt-4 inline-flex items-center gap-2"
            >
              <Plus className="h-5 w-5" /> Add Line
            </button>
          </section>
        </div>

        {/* Summary card + Actions */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
            <button type="button" onClick={() => navigate('/invoices')} className="btn-secondary">
              Cancel
            </button>
          </div>

          <div className="w-full rounded-xl bg-slate-50 p-6 lg:min-w-[300px] lg:max-w-sm">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Summary
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                  Tax %
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                value={form.tax_percent ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, tax_percent: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                value={form.discount ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-body text-[#1E293B] focus:border-[#0EA5A4] focus:outline-none focus:ring-2 focus:ring-[#0EA5A4]/20"
                />
              </div>
            </div>
            <div className="mt-5 space-y-2 text-body text-[#1E293B]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Tax ({form.tax_percent || 0}%)</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Discount</span>
                <span>-₹{(form.discount || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex justify-between items-baseline">
                <span className="text-body font-semibold text-[#1E293B]">Total</span>
                <span className="text-xl font-bold text-[#0EA5A4]">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
