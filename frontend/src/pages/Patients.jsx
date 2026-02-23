import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search, Users } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import PageHeader from '../components/ui/PageHeader';
import Badge, { GenderBadge } from '../components/ui/Badge';
import IconButton from '../components/ui/IconButton';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import FormInput from '../components/ui/FormInput';
import EmptyState from '../components/ui/EmptyState';

const DEBOUNCE_MS = 300;
const GENDER_OPTIONS = [
  { value: '', label: 'All genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const AGE_RANGE_OPTIONS = [
  { value: '', label: 'All ages' },
  { value: '0-17', label: '0–17' },
  { value: '18-40', label: '18–40' },
  { value: '41-64', label: '41–64' },
  { value: '65-120', label: '65+' },
];

function getAge(dob) {
  if (!dob) return '—';
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function parseAgeRange(range) {
  if (!range) return { age_min: undefined, age_max: undefined };
  const [min, max] = range.split('-').map(Number);
  return { age_min: min, age_max: max };
}

export default function Patients() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gender, setGender] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPatients = useCallback(
    (page = 1) => {
      setLoading(true);
      const { age_min, age_max } = parseAgeRange(ageRange);
      const params = {
        page,
        limit: 20,
        search: searchQuery || undefined,
        gender: gender || undefined,
        age_min: age_min !== undefined ? age_min : undefined,
        age_max: age_max !== undefined ? age_max : undefined,
        sort: sortKey,
        order: sortOrder,
      };
      api
        .get('/patients', { params })
        .then(({ data }) => {
          setList(data.data.patients);
          setPagination(data.data.pagination);
        })
        .catch((err) => toast.error(err.response?.data?.message || err.message || 'Failed to load patients'))
        .finally(() => setLoading(false));
    },
    [searchQuery, gender, ageRange, sortKey, sortOrder]
  );

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }));
  }, [searchQuery, gender, ageRange, sortKey, sortOrder]);

  useEffect(() => {
    fetchPatients(pagination.page);
  }, [pagination.page, fetchPatients]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setSearchQuery(searchInput);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleSortChange = (key, order) => {
    setSortKey(key);
    setSortOrder(order);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setDeleting(true);
    api
      .delete(`/patients/${deleteId}`)
      .then(() => {
        toast.success('Patient removed');
        setDeleteId(null);
        fetchPatients(pagination.page);
      })
      .catch(() => toast.error('Delete failed'))
      .finally(() => setDeleting(false));
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortKey: 'name',
      render: (_, row) => (
        <Link
          to={`/patients/${row.id}`}
          className="font-medium text-emerald-700 transition-colors duration-150 hover:text-emerald-800 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1 rounded"
        >
          {row.name}
        </Link>
      ),
    },
    { key: 'phone', header: 'Phone', render: (v) => v || '—' },
    { key: 'email', header: 'Email', render: (v) => v || '—' },
    {
      key: 'date_of_birth',
      header: 'Age',
      sortKey: 'age',
      render: (v) => getAge(v),
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (v) => <GenderBadge value={v} />,
    },
    {
      key: 'id',
      header: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <Link
            to={`/patients/${row.id}/edit`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1 active:scale-95"
            title="Edit"
            aria-label={`Edit ${row.name}`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Link>
          <IconButton
            icon={Trash2}
            title="Delete"
            variant="danger"
            aria-label={`Delete ${row.name}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDeleteId(row.id);
            }}
          />
        </div>
      ),
    },
  ];

  const emptyState = (
    <EmptyState
      icon="patients"
      title="No patients found"
      description="Try adjusting your search or filters, or add a new patient."
      actionLabel="Add Patient"
      actionTo="/patients/new"
    />
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Patients"
        description="Manage patient records and demographics."
      >
        <Link
          to="/patients/new"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" aria-hidden />
          Add Patient
        </Link>
      </PageHeader>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-wrap items-end gap-3">
            <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <FormInput
                name="search"
                placeholder="Search by name, phone, or email…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              aria-label="Filter by gender"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              aria-label="Filter by age range"
            >
              {AGE_RANGE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              Search
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 px-4 py-2.5">
          <Users className="h-5 w-5 text-slate-500" aria-hidden />
          <span className="text-sm font-medium text-slate-700">
            Total Patients: <span className="text-slate-900">{pagination.total}</span>
          </span>
        </div>

        <DataTable
          columns={columns}
          data={list}
          keyField="id"
          pagination={pagination}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          loading={loading}
          emptyMessage="No patients found"
          emptyState={emptyState}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          stickyHeader
        />
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remove patient?"
        message="This action cannot be undone. The patient record will be permanently removed."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
