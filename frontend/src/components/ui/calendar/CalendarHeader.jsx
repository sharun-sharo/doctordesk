import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Calendar header with year (<< >>), month (< >) navigation and clickable month-year label.
 */
function CalendarHeader({
  monthLabel,
  onPrevYear,
  onNextYear,
  onPrevMonth,
  onNextMonth,
  onMonthYearClick,
  ariaLabelMonthYear = 'Choose month and year',
  monthYearPickerOpen = false,
}, ref) {
  return (
    <div className="mb-4 flex items-center justify-between gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevYear}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Previous year"
        >
          <ChevronsLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <button
        ref={ref}
        type="button"
        onClick={onMonthYearClick}
        className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-base font-semibold text-gray-800 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        aria-label={ariaLabelMonthYear}
        aria-haspopup="dialog"
        aria-expanded={monthYearPickerOpen}
      >
        <span className="truncate">{monthLabel}</span>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onNextYear}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Next year"
        >
          <ChevronsRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default forwardRef(CalendarHeader);
