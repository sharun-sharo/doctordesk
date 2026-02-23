import { Navigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Super Admin only: view all clinics (multi-location overview).
 * Currently single-clinic mode; this page is the entry point for future multi-clinic data.
 */
export default function AllClinics() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-display text-slate-900">All Clinics</h1>
      <div className="card max-w-2xl">
        <div className="flex items-center gap-4 text-slate-600">
          <div className="rounded-xl bg-primary-50 p-3 text-primary-600">
            <Building2 className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-body font-medium text-slate-800">Clinic overview</p>
            <p className="text-caption text-slate-500 mt-1">
              You have full access to view and manage all clinic locations. This system is currently in single-clinic mode.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
