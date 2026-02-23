import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const gradientByIndex = [
  'from-teal-500 to-emerald-400',   // Teal → Mint
  'from-primary-500 to-cyan-400',   // Teal → Aqua
  'from-blue-500 to-sky-400',       // Blue → Aqua
  'from-emerald-500 to-teal-400',  // Emerald
];

export default function StatCard({
  title,
  value,
  icon: Icon,
  to,
  trend,
  sparklineData = [],
  className = '',
  gradientIndex = 0,
  isToday = false,
}) {
  const gradient = gradientByIndex[gradientIndex % gradientByIndex.length];
  const content = (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-[34px]">
            {value}
          </p>
          {trend !== undefined && trend !== null && (
            <div
              className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${
                trend >= 0 ? 'text-emerald-600' : 'text-rose-500'
              }`}
            >
              {trend >= 0 ? <TrendingUp className="h-3.5 w-3.5 shrink-0" /> : <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              <span>{trend >= 0 ? '+' : ''}{trend}%</span>
              <span className="text-gray-400">vs last</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-sm transition-transform duration-300 ease-out group-hover:scale-105`}
            aria-hidden
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
        )}
      </div>
      {sparklineData.length > 1 && (
        <div className="mt-5 h-[48px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={`url(#statGrad-${gradientIndex})`}
                strokeWidth={2}
                dot={false}
              />
              <defs>
                <linearGradient id={`statGrad-${gradientIndex}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#2dd4bf" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  const cardClass =
    `group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-md focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:ring-offset-2 ${
      isToday ? 'border-l-4 border-l-emerald-500' : ''
    } ` +
    className;

  if (to) {
    return (
      <Link to={to} className={`block outline-none ${cardClass} sm:p-6`}>
        {content}
      </Link>
    );
  }

  return <div className={`outline-none ${cardClass} sm:p-6`}>{content}</div>;
}
