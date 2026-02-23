import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, FileText } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import { PageSkeleton } from '../components/ui/Skeleton';

export default function Prescriptions() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPrescriptions = (page = 1) => {
    setLoading(true);
    api.get('/prescriptions', { params: { page, limit: 20 } })
      .then(({ data }) => {
        setList(data.data.prescriptions);
        setPagination(data.data.pagination);
      })
      .catch((err) => toast.error(err.response?.data?.message || err.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPrescriptions(pagination.page);
  }, [pagination.page]);

  const columns = [
    { key: 'created_at', header: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'patient_name', header: 'Patient' },
    { key: 'doctor_name', header: 'Doctor' },
    { key: 'diagnosis', header: 'Diagnosis', render: (v) => v || '—' },
    {
      key: 'id',
      header: '',
      render: (_, row) => (
        <Link
          to={`/prescriptions/${row.id}`}
          className="inline-flex items-center gap-1 text-body font-medium text-primary-600 hover:underline"
        >
          <FileText className="h-4 w-4" /> View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <h1 className="text-display text-slate-900">Prescriptions</h1>
        <Link to="/prescriptions/new" className="btn-primary inline-flex items-center gap-2">
          <Plus className="h-5 w-5" /> New Prescription
        </Link>
      </div>
      <DataTable
        columns={columns}
        data={list}
        keyField="id"
        pagination={pagination}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        loading={loading}
        emptyMessage="No prescriptions"
      />
    </div>
  );
}
