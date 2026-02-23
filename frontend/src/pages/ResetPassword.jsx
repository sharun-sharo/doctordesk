import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Stethoscope } from 'lucide-react';
import FormInput from '../components/ui/FormInput';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!token) {
      toast.error('Invalid reset link');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
      toast.success('Password reset. You can log in now.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token && !done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md text-center">
          <p className="text-body text-slate-600">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="btn-primary mt-6 inline-block">Request new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50/80 to-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card shadow-soft">
          <div className="text-center mb-8">
            <div className="inline-flex rounded-xl bg-primary-50 p-3 text-primary-600 mb-4">
              <Stethoscope className="h-10 w-10" strokeWidth={1.5} />
            </div>
            <h1 className="text-display text-slate-900">Set new password</h1>
          </div>
          {done ? (
            <p className="text-center text-body text-slate-600">
              <Link to="/login" className="font-medium text-primary-600 hover:underline">Go to login</Link>
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormInput
                label="New password *"
                type="password"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
              <FormInput
                label="Confirm password *"
                type="password"
                name="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <p className="text-caption text-slate-500">Min 8 characters, include a number and uppercase letter.</p>
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
