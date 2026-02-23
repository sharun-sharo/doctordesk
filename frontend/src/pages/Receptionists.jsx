import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Users, Mail, Phone, Pencil, User, UserCheck } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';

export default function Receptionists() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/users', { params: { role_id: 4, limit: 100 } })
      .then(({ data }) => setList(data.data?.users || []))
      .catch(() => toast.error('Failed to load receptionists'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Receptionists</h1>
        <p className="mt-1 text-sm text-slate-500">Reception staff — view profile details and assigned doctor.</p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
          <p className="mt-4 text-slate-600 font-medium">No receptionists yet</p>
          <p className="mt-1 text-sm text-slate-500">Add a Reception user from Users to appear here.</p>
          <Link to="/users/new" className="mt-6 btn-primary inline-flex items-center gap-2">
            Add User
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                  <User className="h-6 w-6" />
                </div>
                <StatusBadge status={rec.is_active ? 'active' : 'inactive'} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">{rec.name || '—'}</h2>
              <p className="mt-1 text-sm text-slate-500 capitalize">{rec.role_name || 'Receptionist'}</p>
              <dl className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-slate-700">{rec.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-slate-700">{rec.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <UserCheck className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-slate-700">Assigned to: {rec.assigned_doctor_names || rec.assigned_admin_name || '—'}</span>
                </div>
                {rec.created_at && (
                  <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                    Joined {new Date(rec.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </dl>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={`/users/${rec.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  <Pencil className="h-4 w-4" /> Edit profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
