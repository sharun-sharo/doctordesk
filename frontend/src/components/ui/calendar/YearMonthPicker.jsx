import { useState, useRef, useEffect } from 'react';
import { MONTH_NAMES_SHORT } from './calendarUtils';
import { DEFAULT_YEAR_MIN, DEFAULT_YEAR_MAX } from './calendarUtils';

/**
 * Dropdown to pick year (scrollable list) and month (grid).
 * Configurable year range; keyboard accessible.
 */
export default function YearMonthPicker({
  open,
  onClose,
  viewDate,
  onSelect,
  yearMin = DEFAULT_YEAR_MIN,
  yearMax = DEFAULT_YEAR_MAX,
  anchorRef,
  'aria-label': ariaLabel = 'Choose month and year',
}) {
  const [year, setYear] = useState(viewDate.getFullYear());
  const listRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setYear(viewDate.getFullYear());
      setTimeout(() => listRef.current?.focus(), 0);
    }
  }, [open, viewDate]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const option = el.querySelector(`[data-year="${year}"]`);
    if (option) option.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open, year]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClickOutside = (e) => {
      if (containerRef.current && anchorRef?.current && !containerRef.current.contains(e.target) && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose, anchorRef]);

  const handleMonthClick = (monthIndex) => {
    onSelect(year, monthIndex);
    onClose();
  };

  const years = [];
  for (let y = yearMin; y <= yearMax; y++) years.push(y);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="absolute left-1/2 top-0 z-[60] w-[280px] -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl ring-1 ring-black/5 transition-opacity duration-150"
    >
      <div className="flex gap-4">
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Year</p>
          <div
            ref={listRef}
            tabIndex={0}
            role="listbox"
            aria-label="Year"
            className="max-h-[200px] overflow-y-auto rounded-lg border border-gray-200 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            {years.map((y) => (
              <div
                key={y}
                data-year={y}
                role="option"
                aria-selected={y === year}
                tabIndex={-1}
                onClick={() => setYear(y)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setYear(y);
                  }
                }}
                className={`cursor-pointer px-3 py-1.5 text-sm ${y === year ? 'bg-emerald-100 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-100'}`}
              >
                {y}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Month</p>
          <div className="grid grid-cols-3 gap-1" role="group" aria-label="Month">
            {MONTH_NAMES_SHORT.map((name, monthIndex) => (
              <button
                key={monthIndex}
                type="button"
                onClick={() => handleMonthClick(monthIndex)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                aria-label={`${name} ${year}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
