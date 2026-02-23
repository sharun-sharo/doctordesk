import { useMemo } from 'react';
import { DAY_LABELS } from './calendarUtils';

/**
 * Renders the 7-column day grid for a given month.
 * Receives viewDate, selection state, min/max, and callbacks.
 */
export default function DateGrid({
  viewDate,
  value,
  minDate,
  maxDate,
  onSelect,
  focusedDate,
  focusedCellRef,
  isDisabled: isDisabledProp,
  isToday: isTodayProp,
  isSelected: isSelectedProp,
  'aria-label': ariaLabel = 'Calendar',
}) {
  const { startPad, days } = useMemo(() => {
    const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const last = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    return { startPad: first.getDay(), days: last.getDate() };
  }, [viewDate]);

  const gridDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < startPad; i++) list.push(null);
    for (let d = 1; d <= days; d++) list.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    return list;
  }, [startPad, days, viewDate]);

  const isDisabled = (date) => {
    if (!date) return true;
    if (typeof isDisabledProp === 'function') return isDisabledProp(date);
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isToday = (date) => {
    if (!date) return false;
    if (typeof isTodayProp === 'function') return isTodayProp(date);
    const t = new Date();
    return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
  };

  const isSelected = (date) => {
    if (typeof isSelectedProp === 'function') return isSelectedProp(date);
    return value && date && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
  };

  const isFocused = (date) => {
    if (!focusedDate || !date) return false;
    return date.getDate() === focusedDate.getDate() && date.getMonth() === focusedDate.getMonth() && date.getFullYear() === focusedDate.getFullYear();
  };

  const handleSelect = (date) => {
    if (!date || isDisabled(date)) return;
    onSelect?.(date);
  };

  return (
    <div role="grid" aria-label={ariaLabel} className="grid grid-cols-7 gap-1">
      {DAY_LABELS.map((d) => (
        <div key={d} className="py-1 text-center text-xs font-medium text-gray-500" role="columnheader">
          {d}
        </div>
      ))}
      {gridDays.map((date, i) => {
        const disabled = isDisabled(date);
        const today = isToday(date);
        const selected = isSelected(date);
        const focused = isFocused(date);
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-selected={!!date && selected}
            aria-disabled={disabled}
            disabled={disabled}
            tabIndex={focused ? 0 : -1}
            ref={focused ? focusedCellRef : undefined}
            onClick={() => handleSelect(date)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
              !date
                ? 'invisible'
                : disabled
                  ? 'cursor-not-allowed text-gray-300'
                  : selected
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : today
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'text-gray-800 hover:bg-gray-100'
            }`}
            aria-label={date ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''}
          >
            {date ? date.getDate() : ''}
          </button>
        );
      })}
    </div>
  );
}
