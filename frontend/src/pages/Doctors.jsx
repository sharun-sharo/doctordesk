import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Stethoscope, Mail, Phone, Pencil, User } from 'lucide-react';
import { PageSkeleton } from '../components/ui/Skeleton';
import StatusBadge from '../components/ui/StatusBadge';

export default function Doctors() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/users', { params: { role_id: 2, limit: 100 } })
      .then(({ data }) => setList(data.data?.users || []))
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Doctors</h1>
        <p className="mt-1 text-sm text-slate-500">Admin logins — view profile details and manage access.</p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <Stethoscope className="mx-auto h-12 w-12 text-slate-300" strokeWidth={1.5} />
          <p className="mt-4 text-slate-600 font-medium">No doctors yet</p>
          <p className="mt-1 text-sm text-slate-500">Add an Admin user from Users to appear here.</p>
          <Link to="/users/new" className="mt-6 btn-primary inline-flex items-center gap-2">
            Add User
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                  <User className="h-6 w-6" />
                </div>
                <StatusBadge status={doc.is_active ? 'active' : 'inactive'} />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-800">{doc.name || '—'}</h2>
              <p className="mt-1 text-sm text-slate-500 capitalize">{doc.role_name || 'Admin'}</p>
              <dl className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-slate-700">{doc.email || '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-slate-700">{doc.phone || '—'}</span>
                </div>
                {doc.created_at && (
                  <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                    Joined {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                )}
              </dl>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <Link
                  to={`/users/${doc.id}/edit`}
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
