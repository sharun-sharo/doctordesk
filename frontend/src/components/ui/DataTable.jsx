import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

export default function DataTable({
  columns,
  data,
  keyField = 'id',
  onRowClick,
  pagination,
  onPageChange,
  loading,
  emptyMessage = 'No data found',
  emptyState,
  className = '',
  sortKey,
  sortOrder = 'asc',
  onSortChange,
  stickyHeader = true,
}) {
  const handleSort = (col) => {
    if (!col.sortKey || !onSortChange) return;
    const nextOrder = sortKey === col.sortKey && sortOrder === 'asc' ? 'desc' : 'asc';
    onSortChange(col.sortKey, nextOrder);
  };

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}
    >
      <div className="overflow-x-auto -mx-2 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/90">
              {columns.map((col) => {
                const isSortable = col.sortKey && onSortChange;
                const isActive = sortKey === col.sortKey;
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-3 sm:px-5 sm:py-4 text-xs font-semibold uppercase tracking-wider text-slate-600 ${
                      stickyHeader ? 'sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]' : ''
                    } ${isSortable ? 'cursor-pointer select-none' : ''} ${col.headerClassName || ''}`}
                    style={col.width ? { width: col.width } : undefined}
                    onClick={isSortable ? () => handleSort(col) : undefined}
                    onKeyDown={
                      isSortable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSort(col);
                            }
                          }
                        : undefined
                    }
                    role={isSortable ? 'columnheader button' : 'columnheader'}
                    aria-sort={isSortable && isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                    tabIndex={isSortable ? 0 : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.header}
                      {isSortable && (
                        <span className="inline-flex text-slate-400" aria-hidden>
                          {isActive && sortOrder === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : isActive && sortOrder === 'desc' ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4 opacity-50" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={8} cols={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {emptyState || (
                    <div className="px-6 py-16 text-center text-sm text-slate-500">
                      {emptyMessage}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row[keyField]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-slate-100/80 transition-colors duration-150 last:border-0 ${
                    rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  } ${onRowClick ? 'cursor-pointer hover:bg-emerald-50/60' : 'hover:bg-slate-50/80'}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-3 text-sm text-slate-800 sm:px-5 sm:py-4 ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > 0 && !loading && (
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-3 border-t border-slate-100 px-3 py-3 sm:px-5">
          <p className="text-sm text-slate-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1 active:scale-95"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4rem] px-2 text-center text-sm font-medium text-slate-600" aria-live="polite">
              Page {pagination.page}
            </span>
            <button
              type="button"
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page * pagination.limit >= pagination.total}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-1 active:scale-95"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100/80">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <div className="h-5 max-w-[8rem] animate-pulse rounded-lg bg-slate-200/80" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
