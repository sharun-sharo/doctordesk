// Confirmed/Completed → Green, Pending/Scheduled → Yellow, Cancelled → Red
const variants = {
  scheduled: 'bg-amber-100 text-amber-800',
  completed: 'bg-success-light text-success-dark',
  confirmed: 'bg-success-light text-success-dark',
  cancelled: 'bg-danger-light text-danger',
  no_show: 'bg-amber-100 text-amber-800',
  pending: 'bg-amber-100 text-amber-800',
  partial: 'bg-amber-100 text-amber-800',
  paid: 'bg-success-light text-success-dark',
  active: 'bg-success-light text-success-dark',
  inactive: 'bg-slate-100 text-content-muted',
};

export default function StatusBadge({ status, className = '' }) {
  const s = (status || '').toLowerCase();
  const style = variants[s] || 'bg-slate-100 text-content-muted';
  return (
    <span className={`pill ${style} ${className}`}>
      {status}
    </span>
  );
}
