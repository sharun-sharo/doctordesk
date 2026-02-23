import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../components/ui/Spinner';

export default function ActivityLogs() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [filters, setFilters] = useState({ entity_type: '', action: '' });
  const [loading, setLoading] = useState(true);

  const fetchLogs = (page = 1) => {
    setLoading(true);
    api.get('/activity/logs', { params: { page, limit: 50, ...filters } })
      .then(({ data }) => {
        setList(data.data.logs);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs(pagination.page);
  }, [pagination.page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Activity Logs</h1>
      <div className="card mb-4 flex flex-wrap gap-2">
        <select value={filters.entity_type} onChange={(e) => setFilters((f) => ({ ...f, entity_type: e.target.value }))} className="input-field w-40">
          <option value="">All types</option>
          <option value="user">User</option>
          <option value="patient">Patient</option>
          <option value="appointment">Appointment</option>
          <option value="invoice">Invoice</option>
          <option value="prescription">Prescription</option>
          <option value="medicine">Medicine</option>
        </select>
        <select value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} className="input-field w-32">
          <option value="">All actions</option>
          <option value="login">Login</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <button type="button" onClick={() => fetchLogs(1)} className="btn-primary">Apply</button>
      </div>
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Action</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Entity</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4">{l.user_name || l.user_email || '-'}</td>
                    <td className="py-3 px-4">{l.action}</td>
                    <td className="py-3 px-4">{l.entity_type}</td>
                    <td className="py-3 px-4">{l.entity_id}</td>
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
