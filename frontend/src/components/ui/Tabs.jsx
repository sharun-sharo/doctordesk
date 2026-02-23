/**
 * Pill-style tab group. Use for switching views (e.g. List/Calendar, Today/Upcoming, Weekly/Monthly).
 * @param {{ options: { value: string, label: string }[], value: string, onChange: (value: string) => void, 'aria-label'?: string }} props
 */
export default function Tabs({ options, value, onChange, 'aria-label': ariaLabel = 'Tabs' }) {
  return (
    <div className="tabs-pill" role="tablist" aria-label={ariaLabel}>
      {options.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className={`tab-pill ${value === tab.value ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
