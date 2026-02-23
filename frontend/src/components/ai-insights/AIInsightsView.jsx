import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useState, useEffect } from 'react';
import {
  Users,
  Heart,
  Repeat,
  TrendingUp,
  AlertTriangle,
  Pill,
  Zap,
  Lightbulb,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Brain,
  Activity,
} from 'lucide-react';
import { useAIInsights } from '../../hooks/useAIInsights';
import { PageSkeleton, ChartSkeleton } from '../ui/Skeleton';
import api from '../../api/axios';
import DatePicker from '../ui/DatePicker';

const CHART_COLORS = ['#0EA5A4', '#2563EB', '#94a3b8', '#f59e0b', '#EF4444'];
const PIE_COLORS = ['#0EA5A4', '#6366f1', '#94a3b8'];

function SectionCard({ title, subtitle, icon: Icon, iconBg = 'bg-primary-100', iconColor = 'text-primary-600', children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition-all duration-200 hover:shadow-elevated hover:border-slate-200 ${className}`}
      aria-labelledby={title.replace(/\s+/g, '-').toLowerCase()}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2
              id={title.replace(/\s+/g, '-').toLowerCase()}
              className="text-h3 text-slate-800"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-body text-slate-500">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message, hint }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 px-4 text-center">
      <p className="text-body font-medium text-slate-600">{message}</p>
      {hint && <p className="mt-1 text-caption text-slate-400">{hint}</p>}
    </div>
  );
}

const DEMO_CARD_CLASS = 'flex min-h-[240px] flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-soft transition-colors hover:border-slate-200 hover:shadow-card';

function PatientDemographics({ demographics }) {
  if (!demographics) return null;
  const { ageDistribution, genderDistribution, newVsReturning } = demographics;
  const total = (newVsReturning?.new ?? 0) + (newVsReturning?.returning ?? 0);
  const newPct = total > 0 ? Math.round(((newVsReturning?.new ?? 0) / total) * 100) : 0;
  const returnPct = total > 0 ? Math.round(((newVsReturning?.returning ?? 0) / total) * 100) : 0;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className={`${DEMO_CARD_CLASS}`} role="img" aria-label="Age distribution">
        <p className="mb-4 text-left text-label font-semibold uppercase tracking-wide text-slate-600">Age distribution</p>
        <div className="flex-1 min-h-[180px]">
          {(ageDistribution || []).some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ageDistribution || []} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="#64748b" width={28} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                  formatter={(v) => [v, 'Patients']}
                />
                <Bar dataKey="count" fill="#0EA5A4" name="Patients" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No age data" hint="Add date of birth to patients" />
          )}
        </div>
      </div>
      <div className={`${DEMO_CARD_CLASS}`} role="img" aria-label="Gender distribution">
        <p className="mb-4 text-left text-label font-semibold uppercase tracking-wide text-slate-600">Gender distribution</p>
        <div className="flex-1 min-h-[180px]">
          {(genderDistribution || []).some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart margin={{ top: 4, right: 4, bottom: 28, left: 4 }}>
                <Pie
                  data={genderDistribution || []}
                  dataKey="count"
                  nameKey="gender"
                  cx="50%"
                  cy="45%"
                  innerRadius={46}
                  outerRadius={68}
                  paddingAngle={3}
                >
                  {(genderDistribution || []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                  formatter={(v) => [v, 'Patients']}
                />
                <Legend
                  layout="horizontal"
                  align="center"
                  verticalAlign="bottom"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }}
                  formatter={(value, entry) => (
                    <span className="text-slate-700">{value} ({entry.payload?.count ?? entry.payload?.value ?? 0})</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No gender data" hint="Add gender to patient profiles" />
          )}
        </div>
      </div>
      <div className={`${DEMO_CARD_CLASS} sm:col-span-2 lg:col-span-1`}>
        <p className="mb-4 text-left text-label font-semibold uppercase tracking-wide text-slate-600">New vs Returning</p>
        <div className="flex flex-1 flex-col justify-center gap-5">
          {total > 0 && (
            <p className="text-center text-caption font-medium text-slate-500">Total: {total} patients</p>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-body">
              <span className="text-slate-600">New</span>
              <span className="font-semibold tabular-nums text-slate-800">{newVsReturning?.new ?? 0}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{ width: `${Math.max(newPct, 2)}%` }}
                role="progressbar"
                aria-valuenow={newPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="New patients percentage"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-body">
              <span className="text-slate-600">Returning</span>
              <span className="font-semibold tabular-nums text-slate-800">{newVsReturning?.returning ?? 0}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary-600 transition-all duration-500"
                style={{ width: `${Math.max(returnPct, 2)}%` }}
                role="progressbar"
                aria-valuenow={returnPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Returning patients percentage"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighRiskPatients({ patients }) {
  if (!Array.isArray(patients) || patients.length === 0) {
    return (
      <EmptyState message="No high-risk patients flagged" hint="Patients with age > 60 or > 5 visits/month appear here" />
    );
  }
  return (
    <ul className="space-y-3" role="list">
      {patients.map((p, idx) => (
        <li
          key={p.id}
          className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-3 align-middle transition-colors hover:border-amber-300 hover:bg-amber-50/80"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg bg-amber-200 text-caption font-bold text-amber-900">
            {idx + 1}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">{p.name}</p>
            <p className="mt-0.5 text-caption text-slate-600">
              Age {p.age} · {p.visitCountThisMonth} visits this month
            </p>
          </div>
          <span className="self-center shrink-0 rounded-full bg-amber-200/90 px-2.5 py-1 text-left text-caption font-medium text-amber-900">
            {(p.reasons || []).join(' · ')}
          </span>
        </li>
      ))}
    </ul>
  );
}

function FrequentVisitors({ visitors }) {
  if (!Array.isArray(visitors) || visitors.length === 0) {
    return <EmptyState message="No frequent visitors this month" hint="Top 5 by visit count" />;
  }
  const rankStyles = [
    'bg-primary-100 text-primary-800',
    'bg-primary-50 text-primary-700',
    'bg-slate-100 text-slate-700',
    'bg-slate-100 text-slate-600',
    'bg-slate-50 text-slate-600',
  ];
  return (
    <ul className="space-y-3" role="list">
      {visitors.map((v, i) => (
        <li
          key={v.id || i}
          className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 align-middle transition-colors hover:border-primary-200 hover:bg-primary-50/30"
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg text-caption font-bold ${rankStyles[i] ?? rankStyles[4]}`}>
            {i + 1}
          </span>
          <span className="self-center min-w-0 truncate font-medium text-slate-800">{v.name}</span>
          <span className="self-center shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-caption font-semibold text-primary-700 tabular-nums">
            {v.visitCount} visits
          </span>
        </li>
      ))}
    </ul>
  );
}

const REVENUE_PERIODS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'ytd', label: 'YTD' },
  { key: 'custom', label: 'Custom' },
];

function toDateString(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function RevenueIntelligence({ forecast, pending, revenueDropPercent }) {
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customTotal, setCustomTotal] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [ytdTotal, setYtdTotal] = useState(null);
  const [ytdLoading, setYtdLoading] = useState(false);

  const today = toDateString(new Date());
  const yearStart = today ? `${today.slice(0, 4)}-01-01` : '';

  useEffect(() => {
    if (period !== 'custom' || !customFrom || !customTo) {
      setCustomTotal(null);
      return;
    }
    const from = toDateString(customFrom);
    const to = toDateString(customTo);
    if (!from || !to) return;
    setCustomLoading(true);
    api
      .get('/reports/revenue', { params: { period: 'daily', from, to } })
      .then((res) => {
        const rows = res.data?.data || [];
        const total = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
        setCustomTotal(total);
      })
      .catch(() => setCustomTotal(null))
      .finally(() => setCustomLoading(false));
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (period !== 'ytd' || !yearStart || !today) {
      setYtdTotal(null);
      return;
    }
    setYtdLoading(true);
    api
      .get('/reports/revenue', { params: { period: 'daily', from: yearStart, to: today } })
      .then((res) => {
        const rows = res.data?.data || [];
        const total = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
        setYtdTotal(total);
      })
      .catch(() => setYtdTotal(null))
      .finally(() => setYtdLoading(false));
  }, [period, yearStart, today]);

  if (!forecast && !pending) return null;
  const dropPercent = revenueDropPercent ?? forecast?.revenueDropPercent ?? 0;
  const hasDrop = dropPercent > 0;
  const growth = forecast?.growthVsLastMonth ?? 0;
  const isPositiveGrowth = growth >= 0;

  const thisMonthRevenue = Number(forecast?.currentMonth ?? 0);
  const lastMonthRevenue = Number(forecast?.lastMonth ?? 0);
  const ytdRevenue = period === 'ytd' && (ytdTotal != null || ytdLoading)
    ? (ytdTotal ?? 0)
    : Number(forecast?.yearToDate ?? 0);

  let periodLabel = '';
  let displayTotal = 0;
  if (period === 'this_month') {
    periodLabel = 'This month';
    displayTotal = thisMonthRevenue;
  } else if (period === 'last_month') {
    periodLabel = 'Last month';
    displayTotal = lastMonthRevenue;
  } else if (period === 'ytd') {
    periodLabel = 'Year to date';
    displayTotal = ytdRevenue;
  } else {
    periodLabel = customFrom && customTo ? `${customFrom} – ${customTo}` : 'Custom range';
    displayTotal = customTotal ?? 0;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label font-medium text-slate-600">Period:</span>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Revenue period">
          {REVENUE_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1.5 text-caption font-medium transition-colors ${
                period === p.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <DatePicker label="From" value={customFrom} onChange={setCustomFrom} placeholder="Start date" />
          <DatePicker label="To" value={customTo} onChange={setCustomTo} placeholder="End date" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-soft">
          <p className="text-label font-medium uppercase tracking-wide text-slate-500">{periodLabel}</p>
          {(period === 'custom' && customLoading) || (period === 'ytd' && ytdLoading) ? (
            <p className="mt-2 text-body text-slate-500">Loading…</p>
          ) : (
            <p className="mt-2 text-metric text-slate-800">
              ₹{Number(displayTotal).toLocaleString()}
            </p>
          )}
          {period === 'this_month' && (
            <>
              <p className="mt-1 text-body text-slate-600">End-of-month forecast: ₹{Number(forecast?.forecastEom ?? 0).toLocaleString()}</p>
              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-caption font-semibold ${isPositiveGrowth ? 'bg-success-light text-success-dark' : 'bg-danger-light text-danger'}`}>
                {isPositiveGrowth ? '+' : ''}{growth}% vs last month
              </span>
            </>
          )}
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-5">
          <p className="text-label font-medium uppercase tracking-wide text-slate-500">Pending payments</p>
          <p className="mt-2 text-metric text-slate-800">
            ₹{Number(pending?.totalOutstanding ?? 0).toLocaleString()}
          </p>
          <p className="mt-0.5 text-body text-slate-600">Total outstanding</p>
          {(pending?.patients?.length ?? 0) > 0 && (
            <ul className="mt-4 space-y-2" role="list">
              {(pending.patients || []).slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-body">
                  <span className="font-medium text-slate-700 truncate pr-2">{p.name}</span>
                  <span className="font-semibold text-slate-800 shrink-0">₹{Number(p.amount).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {period === 'this_month' && hasDrop && (
        <div
          className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3.5 text-amber-800 shadow-soft"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-body font-medium">
            Revenue is down {dropPercent}% compared to last week.
          </span>
        </div>
      )}
    </div>
  );
}

function PrescriptionIntelligence({ topMedicines, followUpReminders }) {
  const rankBg = ['bg-primary-100 text-primary-700', 'bg-primary-50 text-primary-600', 'bg-slate-100 text-slate-600', 'bg-slate-50 text-slate-500', 'bg-slate-50 text-slate-400'];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-label font-medium uppercase tracking-wide text-slate-500">Most prescribed (this month)</p>
        {(!topMedicines || topMedicines.length === 0) ? (
          <EmptyState message="No data" hint="Prescriptions this month" />
        ) : (
          <ul className="space-y-2" role="list">
            {topMedicines.map((m, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition-colors hover:border-slate-200 hover:bg-slate-50/50">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-caption font-bold ${rankBg[i] || rankBg[4]}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-body font-medium text-slate-800 truncate">{m.name}</span>
                <span className="text-caption font-semibold text-slate-600">{m.count}×</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-3 text-label font-medium uppercase tracking-wide text-slate-500">Follow-up reminders (30+ days)</p>
        {(!followUpReminders || followUpReminders.length === 0) ? (
          <EmptyState message="No reminders" hint="Patients with no visit 30+ days after prescription" />
        ) : (
          <ul className="space-y-2" role="list">
            {followUpReminders.slice(0, 5).map((r, i) => (
              <li key={i} className="rounded-xl border border-slate-100 px-3 py-2.5 text-body transition-colors hover:border-slate-200 hover:bg-slate-50/50">
                <span className="font-medium text-slate-800">{r.patient_name}</span>
                <span className="mt-0.5 block text-caption text-slate-600">Prescribed {String(r.prescription_date).slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EfficiencyScore({ efficiencyScore }) {
  if (!efficiencyScore) return null;
  const score = Math.max(0, Math.min(100, efficiencyScore.score ?? 0));
  const scoreColor = score >= 70 ? 'text-success-dark' : score >= 40 ? 'text-warning-dark' : 'text-danger';
  const barColor = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-danger';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-4xl font-bold tracking-tight ${scoreColor}`}>{score}</span>
          <span className="text-xl font-semibold text-slate-400">/ 100</span>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-body font-medium text-slate-600">
          Clinic Efficiency Score
        </span>
      </div>
      <div
        className="h-5 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Efficiency score"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {(efficiencyScore.suggestions || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-label font-medium text-slate-600">Improvement suggestions</p>
          <ul className="space-y-2" role="list">
            {(efficiencyScore.suggestions || []).map((s, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" aria-hidden />
                <span className="text-body text-slate-700">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ClinicHealthScore({ clinicHealthScore }) {
  if (!clinicHealthScore) return null;
  const score = Math.max(0, Math.min(100, clinicHealthScore.score ?? 0));
  const status = clinicHealthScore.status || 'Stable';
  const scoreColor = score >= 75 ? 'text-success-dark' : score >= 60 ? 'text-primary-600' : score >= 40 ? 'text-warning-dark' : 'text-danger';
  const barColor = score >= 75 ? 'bg-success' : score >= 60 ? 'bg-primary-500' : score >= 40 ? 'bg-warning' : 'bg-danger';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className={`text-4xl font-bold tracking-tight ${scoreColor}`}>{score}</span>
        <span className="text-xl font-semibold text-slate-400">/ 100</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-body font-medium text-slate-600">
          Status: {status}
        </span>
      </div>
      <div
        className="h-4 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Clinic health score"
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-caption text-slate-500">
        Based on: Revenue trend · Patient retention · No-shows · Burnout risk
      </p>
    </div>
  );
}

function BurnoutMonitor({ burnoutMonitor }) {
  if (!burnoutMonitor) return null;
  const { daysWorkedThisWeek, burnoutRisk, aiTip } = burnoutMonitor;
  const riskColor = burnoutRisk === 'High' ? 'bg-red-100 text-red-800' : burnoutRisk === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-success-light text-success-dark';

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-body">
          <span className="text-slate-600">Days worked this week</span>
          <span className="font-semibold tabular-nums text-slate-800">{daysWorkedThisWeek ?? 0}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body text-slate-600">Burnout risk</span>
          <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${riskColor}`}>
            {burnoutRisk || 'Low'}
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-primary-200/80 bg-primary-50/50 px-3 py-2">
          <p className="text-caption font-semibold text-primary-700">AI Tip</p>
          <p className="mt-0.5 text-body text-slate-700">{aiTip || '—'}</p>
        </div>
      </div>
    </div>
  );
}

function AIRecommendationBox({ text }) {
  if (!text) return null;
  return (
    <div
      className="relative flex items-start gap-4 overflow-hidden rounded-2xl border border-primary-200/80 bg-gradient-to-r from-primary-50/90 to-white p-5 shadow-soft"
      role="complementary"
      aria-label="AI recommendation"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100">
        <Lightbulb className="h-6 w-6 text-primary-600" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-label font-semibold uppercase tracking-wide text-primary-700">AI Recommendation</p>
        <p className="mt-1 text-body font-medium text-slate-800">{text}</p>
      </div>
      <Sparkles className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-300/60" aria-hidden />
    </div>
  );
}

export default function AIInsightsView() {
  const { data, loading, error, lastFetched, refresh } = useAIInsights();

  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-800 shadow-soft" role="alert">
        <p className="text-h3 font-semibold">Unable to load AI Insights</p>
        <p className="mt-2 text-body">{error}</p>
        <button type="button" onClick={refresh} className="btn-outline mt-4">
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card">
        <p className="text-body text-slate-500">No insights data available.</p>
        <button type="button" onClick={refresh} className="btn-ghost mt-4">Refresh</button>
      </div>
    );
  }

  const lastUpdated = lastFetched
    ? lastFetched.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="space-y-8 pb-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display text-content flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary-500" aria-hidden />
            AI Insights
          </h1>
          <p className="mt-1 text-body text-content-muted">
            Data-driven insights for your clinic. Heuristic-based metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-caption text-slate-500">Updated {lastUpdated}</span>
          )}
          <button
            type="button"
            onClick={refresh}
            className="btn-ghost inline-flex items-center gap-2"
            aria-label="Refresh insights"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </header>

      <AIRecommendationBox text={data.aiRecommendation} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Operational Efficiency Score"
          subtitle="Based on completion rate, no-shows, revenue growth, and return rate"
          icon={Zap}
          iconBg="bg-warning-light"
          iconColor="text-warning-dark"
        >
          <EfficiencyScore efficiencyScore={data.efficiencyScore} />
        </SectionCard>
        <SectionCard
          title="Revenue Intelligence"
          subtitle="Forecast, alerts, and pending payments"
          icon={TrendingUp}
          iconBg="bg-secondary-100"
          iconColor="text-secondary-500"
        >
          <RevenueIntelligence
            forecast={data.revenueForecast}
            pending={data.pendingPayments}
            revenueDropPercent={data.revenueForecast?.revenueDropPercent}
          />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Clinic Health Score"
          subtitle="Revenue trend, patient retention, no-shows, burnout risk"
          icon={Brain}
          iconBg="bg-primary-100"
          iconColor="text-primary-600"
        >
          <ClinicHealthScore clinicHealthScore={data.clinicHealthScore} />
        </SectionCard>
        <SectionCard
          title="Burnout Monitor"
          subtitle="This week's workload and AI tip"
          icon={Activity}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        >
          <BurnoutMonitor burnoutMonitor={data.burnoutMonitor} />
        </SectionCard>
      </div>

      <SectionCard
        title="Patient Insights"
        subtitle="Demographics, high-risk flags, and frequent visitors"
        icon={Users}
        iconBg="bg-primary-100"
        iconColor="text-primary-600"
      >
        <p className="mb-6 text-body text-slate-600">
          Overview of patient mix and who needs attention.
        </p>
        <div className="space-y-6">
          <div>
            <h3 className="mb-4 text-left text-label font-semibold uppercase tracking-wide text-slate-500">
              Patient demographics
            </h3>
            <PatientDemographics demographics={data.patientDemographics} />
          </div>
          <div className="border-t border-slate-200 pt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="flex flex-col">
                <h3 className="mb-4 flex items-center gap-3 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                    <Heart className="h-4 w-4 text-amber-600" aria-hidden />
                  </span>
                  <span className="text-h2 text-slate-800">High-risk patients</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-caption font-semibold text-amber-800">
                    Top 3
                  </span>
                </h3>
                <div className="flex-1 rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
                  <HighRiskPatients patients={data.highRiskPatients} />
                </div>
              </div>
              <div className="flex flex-col">
                <h3 className="mb-4 flex items-center gap-3 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100">
                    <Repeat className="h-4 w-4 text-primary-600" aria-hidden />
                  </span>
                  <span className="text-h2 text-slate-800">Frequent visitors</span>
                  <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-caption font-semibold text-primary-700">
                    Top 5
                  </span>
                </h3>
                <div className="flex-1 rounded-xl border border-slate-200/80 bg-slate-50/30 p-4">
                  <FrequentVisitors visitors={data.frequentVisitors} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Prescription Intelligence"
        subtitle="Top medicines and follow-up reminders"
        icon={Pill}
        iconBg="bg-primary-100"
        iconColor="text-primary-600"
      >
        <PrescriptionIntelligence
          topMedicines={data.topMedicines}
          followUpReminders={data.followUpReminders}
        />
      </SectionCard>
    </div>
  );
}
