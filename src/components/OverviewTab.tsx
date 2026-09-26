import React, { useMemo, useState } from 'react';
import { SubscriptionItem, Transaction } from '../types/finance';
import { Stats, kindOf } from '../lib/ledger';
import { DAYS_IN_MONTH, DAYS_LEFT, LIVE, MONTH, TODAY_DAY, TODAY_ISO, YEAR, daysFromToday } from '../lib/clock';
import { baht, kbaht, niceTicks, time12 } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';

interface OverviewTabProps {
  stats: Stats;
  transactions: Transaction[];
  monthLabel: string;
  subscriptions: SubscriptionItem[];
  onSelectTransaction: (tx: Transaction) => void;
  onViewAllTransactions: () => void;
  onOpenBudgetGoalModal: () => void;
  onOpenSubscriptionCalendar: () => void;
  /** Kept for callers that still pass them; the Overview no longer needs them. */
  onOpenReview?: () => void;
  onOpenAddMoment?: () => void;
  onOpenInsights?: () => void;
  onMarkNoSpend?: (days: number[]) => void;
}

const card = 'bg-white dark:bg-neutral-900 rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';
const muted = 'text-[#8E8E93]';

/** Last month, from the user's own records (the demo keeps its built-in comparison). */
function previousMonth(transactions: Transaction[]) {
  const d = new Date(YEAR, MONTH - 1, 1);
  const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  let income = 0;
  let spentSameDay = 0;
  let any = false;
  for (const t of transactions) {
    if (t.status !== 'ok' || t.excluded || !t.date.startsWith(prefix)) continue;
    any = true;
    const k = kindOf(t);
    if (k === 'income') income += t.amount;
    else if (k === 'expense' && Number(t.date.slice(8)) <= TODAY_DAY) spentSameDay += -t.amount;
  }
  return any ? { income, spent: spentSameDay } : null;
}

/** A smooth curve through the points that never overshoots them (so a cumulative line cannot dip below zero). */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const s = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const m = pts.map((_, i) => (i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i];
    const b = m[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s[i];
      m[i + 1] = t * b * s[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const w = dx[i] / 3;
    d += ` C${pts[i][0] + w},${pts[i][1] + m[i] * w} ${pts[i + 1][0] - w},${pts[i + 1][1] - m[i + 1] * w} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  transactions,
  monthLabel,
  subscriptions,
  onSelectTransaction,
  onViewAllTransactions,
  onOpenBudgetGoalModal,
  onOpenSubscriptionCalendar,
}) => {
  const spentPct = (stats.spent / stats.budget) * 100;
  const over = stats.spent > stats.budget;
  const remaining = stats.budget - stats.spent;
  const elapsedPct = (TODAY_DAY / DAYS_IN_MONTH) * 100;

  const status = over
    ? { text: 'Over Budget', pill: 'bg-red-50 text-[#FF3B30] dark:bg-red-950/40 dark:text-red-400', bar: 'bg-[#FF3B30]' }
    : spentPct > 85
      ? { text: 'Approaching Limit', pill: 'bg-amber-50 text-[#B26A00] dark:bg-amber-950/40 dark:text-amber-400', bar: 'bg-[#FF9500]' }
      : { text: 'On Track', pill: 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400', bar: 'bg-[#06C755]' };

  const recent = useMemo(
    () =>
      transactions
        .filter(t => t.status === 'ok')
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
        .slice(0, 5),
    [transactions],
  );

  const prev = useMemo(() => (LIVE ? previousMonth(transactions) : null), [transactions]);
  const incomeDelta = LIVE ? (prev && prev.income > 0 ? stats.income / prev.income - 1 : null) : stats.incomeVsLastMonth;
  const spentDelta = LIVE ? (prev && prev.spent > 0 ? stats.spent / prev.spent - 1 : null) : stats.spentVsLastMonth;

  const active = subscriptions.filter(s => s.status === 'active');
  const monthly = active.reduce((a, s) => a + (s.frequency === 'yearly' ? s.amount / 12 : s.amount), 0);
  const soon = active
    .filter(s => s.nextRenewalDate > TODAY_ISO)
    .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate))
    .slice(0, 2);

  return (
    <div className="space-y-3.5 pb-8 animate-fadeIn">
      {/* Title & period */}
      <div className="pt-2 pb-0.5 px-0.5 flex items-end justify-between">
        <h1 className="text-[32px] font-bold text-black dark:text-white tracking-tight leading-none">Overview</h1>
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[13px] font-semibold text-black dark:text-white">
          {monthLabel}
        </span>
      </div>

      {/* Monthly budget */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>MONTHLY BUDGET</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.pill}`}>{status.text}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="money text-[24px] font-bold text-black dark:text-white tracking-tight tabular-nums">{baht(stats.spent)}</span>
              <span className={`money text-[13px] font-medium ${muted}`}>/ {baht(stats.budget)}</span>
            </div>
          </div>
          <button
            onClick={onOpenBudgetGoalModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 hover:bg-[#E5E5EA] dark:hover:bg-neutral-700 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200 active:scale-95 transition"
            aria-label="Edit monthly budget goal"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Edit Goal</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="relative h-3 w-full bg-[#F2F2F7] dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${status.bar}`} style={{ width: `${Math.min(100, Math.max(0, spentPct))}%` }} />
            <div className="absolute top-0 bottom-0 w-[2px] bg-black/40 dark:bg-white/40 pointer-events-none" style={{ left: `${elapsedPct}%` }} title={`Day ${TODAY_DAY} of ${DAYS_IN_MONTH}`} />
          </div>
          <div className={`flex items-center justify-between text-[11px] ${muted} pt-0.5`}>
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">{spentPct.toFixed(1)}% spent</span>
            <span>
              {over ? (
                <strong className="money text-[#FF3B30]">{baht(-remaining)} over budget</strong>
              ) : (
                <>
                  <strong className="money text-black dark:text-white font-semibold">{baht(remaining)}</strong> remaining
                </>
              )}
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 min-w-0 truncate">
            <span>🗓️</span>
            <span className="truncate">
              {over ? (
                <>Budget ceiling reached for {monthLabel.split(' ')[0]}.</>
              ) : DAYS_LEFT > 0 ? (
                <>
                  Safe pace: <strong className="money text-black dark:text-white font-semibold">{baht(stats.perDay)}</strong> / day for {DAYS_LEFT} {DAYS_LEFT === 1 ? 'day' : 'days'}
                </>
              ) : (
                <>Last day of the month</>
              )}
            </span>
          </div>
          <button onClick={onOpenBudgetGoalModal} className="text-[#06C755] font-semibold text-[11px] hover:underline shrink-0 ml-2">
            Adjust
          </button>
        </div>
      </section>

      <Trajectory stats={stats} />

      {/* Income / expenses */}
      <section className={`${card} rounded-[20px] p-4`}>
        <div className="grid grid-cols-2 divide-x divide-[#E5E5EA] dark:divide-neutral-800">
          <div className="pr-3 flex flex-col">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Income</span>
            <span className="money text-[22px] font-bold text-black dark:text-white tracking-tight leading-none tabular-nums mt-1">{baht(stats.income)}</span>
            <Delta change={incomeDelta} goodWhenUp />
          </div>
          <div className="pl-4 flex flex-col">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>Expenses</span>
            <span className="money text-[22px] font-bold text-[#1C1C1E] dark:text-neutral-100 tracking-tight leading-none tabular-nums mt-1">{baht(stats.spent)}</span>
            <Delta change={spentDelta} goodWhenUp={false} />
          </div>
        </div>
      </section>

      {/* Subscription calendar */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/50 text-[#008A3D] dark:text-[#06C755] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[19px]">calendar_month</span>
            </div>
            <div>
              <span className="text-[14px] font-bold text-black dark:text-white block leading-tight">Subscription Calendar</span>
              <span className={`text-[11px] ${muted} block leading-tight mt-0.5`}>
                {active.length} active {active.length === 1 ? 'service' : 'services'} · <span className="money">{baht(monthly)}</span>/mo
              </span>
            </div>
          </div>
          <button type="button" onClick={onOpenSubscriptionCalendar} className="text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 hover:underline">
            <span>Open Calendar</span>
            <span className="text-[14px]">›</span>
          </button>
        </div>
        {soon.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {soon.map(s => {
              const n = daysFromToday(s.nextRenewalDate);
              return (
                <div key={s.id} onClick={onOpenSubscriptionCalendar} className="p-2.5 rounded-xl bg-[#FFF8E6] dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 cursor-pointer hover:opacity-90 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">{n === 1 ? 'Tomorrow' : `In ${n} days`}</span>
                    <span className="money text-[12px] font-bold text-black dark:text-white tabular-nums">{baht(s.amount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[12px] font-semibold text-black dark:text-white truncate">{s.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[13px] font-semibold text-[#6E6E73] dark:text-neutral-400 uppercase tracking-wider">RECENT ACTIVITY</span>
          <button onClick={onViewAllTransactions} className={`text-[13px] font-medium ${muted} hover:text-black dark:hover:text-white flex items-center gap-0.5 active:opacity-60 transition`}>
            <span>View all</span>
            <span>›</span>
          </button>
        </div>
        <div className={`${card} rounded-[20px] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800`}>
          {recent.length === 0 && <p className={`px-4 py-6 text-center text-[14px] ${muted}`}>Nothing yet. Tap + to add your first slip.</p>}
          {recent.map(tx => {
            const income = kindOf(tx) === 'income';
            return (
              <div key={tx.id} onClick={() => onSelectTransaction(tx)} className="min-h-[56px] px-4 py-3 flex items-center justify-between active:bg-[#F2F2F7] dark:active:bg-neutral-800 transition cursor-pointer group">
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon category={tx.category} isIncome={income} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold text-black dark:text-white truncate leading-tight">{tx.title}</span>
                    <span className={`text-[12px] ${muted} mt-0.5`}>
                      {tx.category} · {time12(tx.time)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <span className={`money text-[15px] font-semibold tracking-tight tabular-nums ${income ? 'text-[#06C755]' : 'text-[#1C1C1E] dark:text-neutral-100'}`}>
                    {income ? '+' : '−'}
                    {baht(tx.amount)}
                  </span>
                  <span className="text-[#C7C7CC] group-hover:text-[#8E8E93] text-[15px] transition-colors">›</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

/* Spending less is good, earning less is not: colour by meaning. Nothing to compare with → nothing shown. */
const Delta: React.FC<{ change: number | null; goodWhenUp: boolean }> = ({ change, goodWhenUp }) => {
  if (change === null || !Number.isFinite(change)) return <span className="mt-1.5 h-[18px]" />;
  const p = Math.round(change * 100);
  const good = goodWhenUp ? p >= 0 : p <= 0;
  return (
    <span className={`text-[12px] font-medium mt-1.5 flex items-center gap-0.5 ${good ? 'text-[#06C755]' : 'text-[#8E8E93]'}`}>
      {p >= 0 ? '↑ +' : '↓ −'}
      {Math.abs(p)}% <span className="text-[#8E8E93] font-normal text-[11px] ml-0.5">vs last mo.</span>
    </span>
  );
};

/* Income and spending so far this month, drawn as two smooth lines. Press or hover to read a day. */
const Trajectory: React.FC<{ stats: Stats }> = ({ stats }) => {
  const [day, setDay] = useState<number | null>(null);
  const L = 40;
  const R = 340;
  const TOP = 20;
  const BASE = 125;
  const days = Array.from({ length: TODAY_DAY }, (_, i) => i + 1);
  const ticks = niceTicks(Math.max(stats.incomeCumulative[TODAY_DAY] ?? 0, stats.cumulative[TODAY_DAY] ?? 0, 500), 3);
  const max = ticks[ticks.length - 1];
  const x = (d: number) => L + ((d - 1) / (DAYS_IN_MONTH - 1)) * (R - L);
  const y = (v: number) => BASE - (v / max) * (BASE - TOP);
  const income: [number, number][] = days.map(d => [x(d), y(stats.incomeCumulative[d])]);
  const spent: [number, number][] = days.map(d => [x(d), y(stats.cumulative[d])]);
  const area = `${smoothPath(income)} L${x(TODAY_DAY)},${BASE} L${L},${BASE} Z`;
  const labels = [1, 7, 14, 21, DAYS_IN_MONTH];

  return (
    <section className={`${card} p-4 pt-4 pb-3`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[12px] font-medium ${muted}`}>Cumulative Trajectory</span>
        <div className="flex items-center gap-3.5 text-[12px] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#06C755]" />
            <span className="text-black dark:text-white font-semibold">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1C1C1E] dark:bg-neutral-300" />
            <span className={muted}>Expenses</span>
          </div>
        </div>
      </div>

      <div
        className="w-full relative cursor-crosshair touch-pan-y select-none"
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * 350;
          setDay(Math.max(1, Math.min(TODAY_DAY, Math.round(((px - L) / (R - L)) * (DAYS_IN_MONTH - 1)) + 1)));
        }}
        onPointerLeave={() => setDay(null)}
      >
        {day !== null && (
          <div
            className="absolute top-0 -translate-y-2 pointer-events-none z-20 bg-neutral-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-full shadow-md -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap"
            style={{ left: `${Math.max(18, Math.min(82, (x(day) / 350) * 100))}%` }}
          >
            <span>Day {day}:</span>
            <span className="money text-[#06C755] font-semibold">{baht(stats.incomeCumulative[day])}</span>
            <span className="text-neutral-400">/</span>
            <span className="money text-neutral-200">{baht(stats.cumulative[day])}</span>
          </div>
        )}
        <svg aria-label="Income and expenses so far this month" className="w-full h-[168px] overflow-visible" viewBox="0 0 350 150">
          <defs>
            <linearGradient id="incomeGlow" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#06C755" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#06C755" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map(v => (
            <g key={v}>
              <text fill="#8E8E93" fontSize="10" fontWeight="500" x={v ? 0 : 18} y={y(v) + 3}>
                {v ? kbaht(v) : '0'}
              </text>
              <line className={v ? 'stroke-[#E5E5EA] dark:stroke-neutral-800' : 'stroke-[#D1D1D6] dark:stroke-neutral-700'} strokeWidth="1" x1="38" x2="350" y1={y(v)} y2={y(v)} />
            </g>
          ))}
          <path d={area} fill="url(#incomeGlow)" />
          <path d={smoothPath(income)} fill="none" stroke="#06C755" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <path d={smoothPath(spent)} fill="none" stroke="currentColor" className="text-[#1C1C1E] dark:text-neutral-200" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          {day !== null && <line x1={x(day)} x2={x(day)} y1={TOP - 6} y2={BASE} className="stroke-neutral-400" strokeDasharray="3 3" />}
          <circle cx={x(day ?? TODAY_DAY)} cy={y(stats.incomeCumulative[day ?? TODAY_DAY])} fill="#06C755" r="4.5" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx={x(day ?? TODAY_DAY)} cy={y(stats.cumulative[day ?? TODAY_DAY])} fill="#1C1C1E" r="4" stroke="#FFFFFF" strokeWidth="2" />
        </svg>
        <div className="relative text-[#8E8E93] text-[11px] font-medium h-4 mt-1" style={{ marginLeft: `${(L / 350) * 100}%`, marginRight: `${((350 - R) / 350) * 100}%` }}>
          {labels.map(d => (
            <span key={d} className={`absolute -translate-x-1/2 ${d === DAYS_IN_MONTH ? 'text-black dark:text-white font-semibold' : ''}`} style={{ left: `${((d - 1) / (DAYS_IN_MONTH - 1)) * 100}%` }}>
              {d}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};
