import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Stethoscope } from 'lucide-react';
import FormInput from '../components/ui/FormInput';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('If the email exists, you will receive a reset link.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50/80 to-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card shadow-soft">
          <div className="text-center mb-8">
            <div className="inline-flex rounded-xl bg-primary-50 p-3 text-primary-600 mb-4">
              <Stethoscope className="h-10 w-10" strokeWidth={1.5} />
            </div>
            <h1 className="text-display text-slate-900">Reset password</h1>
            <p className="mt-2 text-body text-slate-500">Enter your email to receive a reset link</p>
          </div>
          {sent ? (
            <p className="text-body text-slate-600 text-center">
              Check your email. <Link to="/login" className="font-medium text-primary-600 hover:underline">Back to login</Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormInput label="Email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link to="/login" className="text-body text-primary-600 hover:underline">Back to login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
