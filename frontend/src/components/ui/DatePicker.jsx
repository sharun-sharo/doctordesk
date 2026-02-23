import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import {
  toYYYYMMDD,
  parseDate,
  addDays,
  addMonths,
  addYears,
  clampDate,
  DEFAULT_YEAR_MIN,
  DEFAULT_YEAR_MAX,
} from './calendar/calendarUtils';
import CalendarHeader from './calendar/CalendarHeader';
import YearMonthPicker from './calendar/YearMonthPicker';
import DateGrid from './calendar/DateGrid';

export default function DatePicker({
  value = '',
  onChange,
  min = '',
  max = '',
  placeholder = 'Select date',
  id,
  label,
  disabled = false,
  className = '',
  error,
  'aria-describedby': ariaDescribedby,
  yearMin = DEFAULT_YEAR_MIN,
  yearMax = DEFAULT_YEAR_MAX,
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDate(value) || new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState(null);
  const containerRef = useRef(null);
  const headerButtonRef = useRef(null);
  const focusedCellRef = useRef(null);

  const valueDate = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  const clamp = useCallback(
    (d) => clampDate(d, minDate, maxDate),
    [minDate, maxDate]
  );

  useEffect(() => {
    const d = parseDate(value) || new Date();
    setViewDate(d);
  }, [value]);

  useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      return;
    }
    const initial = valueDate || new Date();
    const c = clamp(initial);
    setFocusedDate(c);
  }, [open, valueDate, clamp]);

  useEffect(() => {
    if (!open) return;
    if (focusedDate) {
      const t = setTimeout(() => focusedCellRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, focusedDate]);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const escape = (e) => {
      if (e.key === 'Escape') {
        setPickerOpen(false);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const handleCalendarKeyDown = (e) => {
    if (pickerOpen) return;
    const key = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    const target = e.target;
    if (!target.closest('[role="grid"]')) return;
    e.preventDefault();
    const current = focusedDate || viewDate;
    let next;
    if (e.shiftKey) {
      if (key === 'ArrowLeft') next = addMonths(current, -1);
      else if (key === 'ArrowRight') next = addMonths(current, 1);
      else if (key === 'ArrowUp') next = addMonths(current, -1);
      else if (key === 'ArrowDown') next = addMonths(current, 1);
      else return;
      setViewDate(next);
      const day = Math.min(current.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate());
      next = new Date(next.getFullYear(), next.getMonth(), day);
      setFocusedDate(clamp(next));
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      if (key === 'ArrowLeft') next = addYears(current, -1);
      else if (key === 'ArrowRight') next = addYears(current, 1);
      else if (key === 'ArrowUp') next = addYears(current, -1);
      else if (key === 'ArrowDown') next = addYears(current, 1);
      else return;
      setViewDate(next);
      setFocusedDate(clamp(next));
      return;
    }
    if (key === 'ArrowLeft') next = addDays(current, -1);
    else if (key === 'ArrowRight') next = addDays(current, 1);
    else if (key === 'ArrowUp') next = addDays(current, -7);
    else if (key === 'ArrowDown') next = addDays(current, 7);
    else return;
    next = clamp(next);
    setFocusedDate(next);
    const newView = new Date(next.getFullYear(), next.getMonth(), 1);
    setViewDate((prev) => {
      if (prev.getFullYear() !== newView.getFullYear() || prev.getMonth() !== newView.getMonth()) return newView;
      return prev;
    });
  };

  const displayLabel = valueDate
    ? valueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const goPrevMonth = () => {
    const next = addMonths(viewDate, -1);
    setViewDate(next);
    setFocusedDate(clamp(new Date(next.getFullYear(), next.getMonth(), Math.min(focusedDate?.getDate() || 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))));
  };
  const goNextMonth = () => {
    const next = addMonths(viewDate, 1);
    setViewDate(next);
    setFocusedDate(clamp(new Date(next.getFullYear(), next.getMonth(), Math.min(focusedDate?.getDate() || 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))));
  };
  const goPrevYear = () => {
    const next = addYears(viewDate, -1);
    setViewDate(next);
    setFocusedDate(clamp(new Date(next.getFullYear(), next.getMonth(), Math.min(focusedDate?.getDate() || 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))));
  };
  const goNextYear = () => {
    const next = addYears(viewDate, 1);
    setViewDate(next);
    setFocusedDate(clamp(new Date(next.getFullYear(), next.getMonth(), Math.min(focusedDate?.getDate() || 1, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()))));
  };

  const handleMonthYearSelect = (year, month) => {
    const next = new Date(year, month, Math.min(focusedDate?.getDate() || 1, new Date(year, month + 1, 0).getDate()));
    setViewDate(next);
    setFocusedDate(clamp(next));
    setPickerOpen(false);
  };

  const handleSelect = (date) => {
    if (!date) return;
    const str = toYYYYMMDD(date);
    if (minDate && date < minDate) return;
    if (maxDate && date > maxDate) return;
    onChange(str);
    setOpen(false);
  };

  const isDisabled = (date) => {
    if (!date) return true;
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={value ? `Date selected: ${displayLabel}. Click to change.` : `Choose date. ${placeholder}`}
        aria-describedby={error ? ariaDescribedby : undefined}
        aria-invalid={!!error}
        className={`flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border bg-white px-4 text-left text-[15px] transition-all duration-200 ${
          error ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
        } ${!value ? 'text-gray-500' : 'text-gray-800'} focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className="truncate">{displayLabel}</span>
        <CalendarIcon className="h-5 w-5 shrink-0 text-gray-400 pointer-events-none" aria-hidden />
      </button>
      {error && (
        <p id={ariaDescribedby} className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[320px] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl ring-1 ring-black/5 transition-all duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Calendar"
          onKeyDown={handleCalendarKeyDown}
        >
          <div className="relative">
            <CalendarHeader
              ref={headerButtonRef}
              monthLabel={monthLabel}
              onPrevYear={goPrevYear}
              onNextYear={goNextYear}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
              onMonthYearClick={() => setPickerOpen((o) => !o)}
              monthYearPickerOpen={pickerOpen}
              ariaLabelMonthYear="Choose month and year"
            />
            <YearMonthPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              viewDate={viewDate}
              onSelect={handleMonthYearSelect}
              yearMin={yearMin}
              yearMax={yearMax}
              anchorRef={headerButtonRef}
              aria-label="Choose month and year"
            />
          </div>

          <div className="transition-opacity duration-200">
            <DateGrid
              viewDate={viewDate}
              value={value}
              minDate={minDate}
              maxDate={maxDate}
              onSelect={handleSelect}
              focusedDate={focusedDate}
              focusedCellRef={focusedCellRef}
              isDisabled={isDisabled}
              aria-label="Calendar"
            />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="rounded-lg px-2 py-1 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleSelect(clamp(new Date()))}
              className="rounded-lg px-2 py-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
