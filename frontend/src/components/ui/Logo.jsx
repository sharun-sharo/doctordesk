/**
 * DoctorDesk.me wordmark only (icon removed).
 * Use compact={true} for collapsed sidebar (abbreviated).
 */
export default function Logo({ compact = false, className = '' }) {
  return (
    <div className={`flex items-center min-w-0 ${className}`}>
      <span className="truncate font-semibold tracking-tight text-slate-800">
        {compact ? (
          'DD'
        ) : (
          <>
            DoctorDesk<span className="text-primary-600">.me</span>
          </>
        )}
      </span>
    </div>
  );
}
