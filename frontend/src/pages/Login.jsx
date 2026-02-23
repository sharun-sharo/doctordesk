import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import FormInput from '../components/ui/FormInput';
import Logo from '../components/ui/Logo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50/80 to-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card shadow-soft">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center">
              <Logo className="scale-125" />
            </div>
            <p className="mt-2 text-body text-slate-500">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              required
              autoComplete="email"
            />
            <FormInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-body text-slate-600">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-body font-medium text-primary-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <button
              type="submit"
              className="btn-primary w-full py-3 text-body-lg"
              disabled={loading}
            >
              {loading ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
