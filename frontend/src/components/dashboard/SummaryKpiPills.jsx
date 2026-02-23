/**
 * KPI pills for Clinical Activity summary: Today, Completed, In Progress, Scheduled (or Available).
 */
export default function SummaryKpiPills({ total, completed, inProgress, scheduled }) {
  const pills = [
    { value: total, label: 'Today', aria: 'Total appointments today' },
    { value: completed, label: 'Completed', aria: 'Completed today' },
    { value: inProgress, label: 'In Progress', aria: 'In progress' },
    { value: scheduled, label: 'Scheduled', aria: 'Scheduled' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Today’s summary">
      {pills.map(({ value, label, aria }) => (
        <div
          key={label}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white px-4 py-2 shadow-sm"
          aria-label={aria}
        >
          <span className="text-lg font-bold tabular-nums text-gray-900">{value}</span>
          <span className="text-sm font-medium text-gray-600">{label}</span>
        </div>
      ))}
    </div>
  );
}
