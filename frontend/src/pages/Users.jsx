import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';

export default function Users() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);

  const fetchUsers = (page = 1) => {
    setLoading(true);
    api.get('/users', { params: { page, limit: 20, role_id: roleFilter || undefined } })
      .then(({ data }) => {
        setList(data.data.users);
        setPagination(data.data.pagination);
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers(pagination.page);
  }, [pagination.page, roleFilter]);

  const handleDelete = (id) => {
    api.delete(`/users/${id}`).then(() => {
      toast.success('User deactivated');
      setDeleteId(null);
      fetchUsers(pagination.page);
    }).catch(() => toast.error('Failed'));
  };

  const roleName = (r) => ({ 2: 'Admin', 3: 'Doctor', 4: 'Receptionist' }[r] || '');

  const columns = [
    { key: 'name', header: 'Name', render: (v) => <span className="font-medium">{v}</span> },
    { key: 'email', header: 'Email' },
    { key: 'role_id', header: 'Role', render: (v, row) => roleName(v) || row.role_name },
    { key: 'assigned_doctor_names', header: 'Assigned to', render: (v, row) => (row.role_id === 4 ? (v || row.assigned_admin_name || '—') : '—') },
    { key: 'is_active', header: 'Status', render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} /> },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) =>
        row.role_id === 1 ? null : (
          <div className="flex items-center gap-2">
            <Link to={`/users/${row.id}/edit`} className="inline-flex items-center gap-1 text-primary-600 hover:underline">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
            <button type="button" onClick={() => setDeleteId(row.id)} className="text-body text-slate-600 hover:text-danger">
              Deactivate
            </button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="input-label mb-0">Role</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-field w-48">
            <option value="">All roles</option>
            <option value="2">Admin</option>
            <option value="4">Reception</option>
          </select>
        </div>
        <Link to="/users/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus className="h-5 w-5" /> Add User
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={list}
        keyField="id"
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        loading={loading}
        emptyMessage="No users"
      />
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Deactivate user?">
        <p className="text-body text-slate-600 mb-6">The user will not be able to log in.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setDeleteId(null)} className="btn-secondary">Cancel</button>
          <button type="button" onClick={() => handleDelete(deleteId)} className="btn-danger">Deactivate</button>
        </div>
      </Modal>
    </div>
  );
}
