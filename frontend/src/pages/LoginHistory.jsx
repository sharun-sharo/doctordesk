import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';

export default function LoginHistory() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/activity/login-history', { params: { page: 1, limit: 50 } })
      .then(({ data }) => {
        setList(data.data.logs);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Login History</h1>
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="h-10 w-10" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">IP</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">{new Date(l.logged_in_at).toLocaleString()}</td>
                    <td className="py-3 px-4">{l.user_name || '-'}</td>
                    <td className="py-3 px-4">{l.email || '-'}</td>
                    <td className="py-3 px-4">{l.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
