import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="card max-w-2xl">
        <h2 className="text-title text-slate-900 mb-4">Profile</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-slate-500">Name</dt>
            <dd className="text-body font-medium text-slate-900">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-caption text-slate-500">Email</dt>
            <dd className="text-body text-slate-800">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-caption text-slate-500">Role</dt>
            <dd className="text-body text-slate-800">{user?.roleName?.replace('_', ' ')}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
