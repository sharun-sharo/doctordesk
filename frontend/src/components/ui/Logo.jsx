/**
 * DoctorDesk.me wordmark – premium SaaS style.
 * Use compact={true} for collapsed sidebar (abbreviated).
 * Size: pass className e.g. text-lg, text-xl, text-2xl to control scale.
 */
export default function Logo({ compact = false, className = '' }) {
  return (
    <div className={`inline-flex items-baseline min-w-0 shrink-0 select-none text-lg ${className}`}>
      {compact ? (
        <span className="truncate font-bold tracking-tighter text-slate-900">
          D<span className="text-primary-600">D</span>
        </span>
      ) : (
        <span className="truncate font-bold tracking-tighter text-slate-900">
          DoctorDesk<span className="font-semibold text-primary-600">.me</span>
        </span>
      )}
    </div>
  );
}
