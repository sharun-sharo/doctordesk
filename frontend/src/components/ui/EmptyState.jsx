import { Link } from 'react-router-dom';
import { CalendarPlus, Users, FileText, Inbox } from 'lucide-react';

const icons = {
  default: Inbox,
  appointments: CalendarPlus,
  patients: Users,
  prescriptions: FileText,
};

export default function EmptyState({
  title = 'No data yet',
  description,
  actionLabel,
  actionTo,
  onAction,
  icon = 'default',
  className = '',
}) {
  const Icon = icons[icon] || icons.default;

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 px-6 text-center ${className}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <h3 className="text-h2 text-content">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-body text-content-muted">{description}</p>
      )}
      {(actionLabel && (actionTo || onAction)) && (
        <div className="mt-6">
          {actionTo ? (
            <Link to={actionTo} className="btn-primary">
              {actionLabel}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className="btn-primary">
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
