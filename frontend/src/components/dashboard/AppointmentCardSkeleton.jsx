/**
 * Loading skeleton for AppointmentSmartCard. Mirrors card layout for smooth loading state.
 */
export default function AppointmentCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-gray-100 bg-white p-0 shadow-sm"
      aria-hidden
    >
      <div className="flex flex-col gap-0 sm:flex-row sm:items-stretch">
        {/* Left: time block */}
        <div className="flex shrink-0 flex-row items-center gap-4 border-b border-gray-100 bg-gray-50/50 px-5 py-4 sm:min-w-[140px] sm:flex-col sm:items-start sm:border-b-0 sm:border-r sm:py-5">
          <div className="h-8 w-24 rounded-lg bg-gray-200" />
          <div className="h-4 w-14 rounded bg-gray-200" />
        </div>
        {/* Center: patient block */}
        <div className="min-w-0 flex-1 px-5 py-4 sm:py-5">
          <div className="h-5 w-32 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-20 rounded bg-gray-100" />
          <div className="mt-1 h-3 w-16 rounded bg-gray-100" />
        </div>
        {/* Right: status + actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:border-t-0 sm:border-l sm:justify-end sm:py-5">
          <div className="h-7 w-20 rounded-full bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
            <div className="h-9 w-9 rounded-lg bg-gray-200" />
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 px-5 py-3">
        <div className="h-4 w-28 rounded bg-gray-100" />
      </div>
    </div>
  );
}
