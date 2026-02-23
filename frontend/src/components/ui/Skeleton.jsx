export default function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200 ${className}`}
      {...props}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      <Skeleton className="h-9 w-52" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-[280px] flex-col justify-end gap-2 rounded-xl border border-slate-100 bg-white p-6">
      {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
        <Skeleton
          key={i}
          className="w-full rounded-lg"
          style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}
