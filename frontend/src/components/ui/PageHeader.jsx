/**
 * Reusable page header with title, optional description, and action slot.
 * Uses 8px grid spacing; supports responsive layout.
 */
export default function PageHeader({ title, description, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
