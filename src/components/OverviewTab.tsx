import React, { useMemo, useState } from 'react';
import { SubscriptionItem, Transaction } from '../types/finance';
import { Stats } from '../lib/ledger';
import { DAYS_IN_MONTH, DAYS_LEFT, MONTH_PREFIX, TODAY_DAY, TODAY_ISO, daysFromToday } from '../lib/clock';
import { baht, dayLabel, kbaht, niceTicks } from '../lib/format';
import { TransactionRow } from './TransactionRow';
import { Mascot } from './Mascot';

interface OverviewTabProps {
  stats: Stats;
  monthLabel: string;
  subscriptions: SubscriptionItem[];
  onSelectTransaction: (tx: Transaction) => void;
  onViewAllTransactions: () => void;
  onOpenBudgetGoalModal: () => void;
  onOpenSubscriptionCalendar: () => void;
  onOpenReview: () => void;
  onOpenAddMoment: () => void;
  onMarkNoSpend: (days: number[]) => void;
}

const card = 'bg-white dark:bg-neutral-900 rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';
const meta = 'text-[#6E6E73] dark:text-neutral-400';

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  monthLabel,
  subscriptions,
  onSelectTransaction,
  onViewAllTransactions,
  onOpenBudgetGoalModal,
  onOpenSubscriptionCalendar,
  onOpenReview,
  onOpenAddMoment,
  onMarkNoSpend,
}) => {
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const spentPct = (stats.spent / stats.budget) * 100;
  const elapsedPct = (TODAY_DAY / DAYS_IN_MONTH) * 100;
  const over = stats.spent > stats.budget;
  const overPace = stats.paceGap < 0;

  // Status follows pace, not just the total: 80% spent on day 23 is fine, on day 10 it isn't
  const status = over
    ? { text: 'Over budget', classes: 'bg-red-50 text-[#C62828] dark:bg-red-950/40 dark:text-red-400', bar: 'bg-[#E5484D]' }
    : overPace
      ? { text: 'Over pace', classes: 'bg-amber-50 text-[#9A5B00] dark:bg-amber-950/40 dark:text-amber-300', bar: 'bg-[#F5A524]' }
      : { text: 'On track', classes: 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400', bar: 'bg-[#06C755]' };

  const upcoming = useMemo(
    () =>
      subscriptions
        .filter(s => s.status === 'active' && s.nextRenewalDate > TODAY_ISO)
        .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate))
        .slice(0, 2),
    [subscriptions],
  );
  const monthlyCommitment = subscriptions.reduce((a, s) => a + (s.frequency === 'yearly' ? s.amount / 12 : s.amount), 0);

  const reviewCount = stats.review.length;
  const unlogged = stats.unloggedDays;

  return (
    <div className="space-y-3.5 pb-4 animate-fadeIn">
      {/* Title & period */}
      <div className="pt-2 pb-0.5 px-0.5 flex items-end justify-between relative">
        <div>
          <p className={`text-[12px] font-semibold ${meta}`}>{dayLabel(TODAY_ISO)}</p>
          <h1 className="text-[32px] font-bold text-black dark:text-white tracking-tight leading-none">Overview</h1>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsMonthDropdownOpen(o => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[13px] font-semibold text-black dark:text-white whitespace-nowrap active:scale-95 transition"
            aria-expanded={isMonthDropdownOpen}
          >
            <span>{monthLabel}</span>
            <span className={`text-[9px] font-bold ${meta}`}>▼</span>
          </button>
          {isMonthDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-black/5 dark:border-white/10 py-1 z-50 animate-scaleIn">
              <button
                onClick={() => setIsMonthDropdownOpen(false)}
                className="w-full text-left px-3.5 py-2 text-[13px] flex items-center justify-between text-[#008A3D] dark:text-[#06C755] font-semibold bg-[#06C755]/5"
              >
                <span>{monthLabel}</span>
                <span className="material-symbols-outlined text-[16px]">check</span>
              </button>
              <div className={`px-3.5 py-2 text-[12px] ${meta}`}>Other months appear once they have records</div>
            </div>
          )}
        </div>
      </div>

      {/* Monthly budget: how much you can still spend per day */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>You can spend</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.classes}`}>{status.text}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="money text-[32px] font-bold text-black dark:text-white tracking-tight tabular-nums leading-none">
                {baht(stats.perDay)}
              </span>
              <span className={`text-[14px] font-medium ${meta}`}>/ day</span>
            </div>
            <p className={`text-[12px] ${meta} leading-snug`}>
              {over ? (
                <>You're past your {baht(stats.budget)} budget for {monthLabel.split(' ')[0]}.</>
              ) : (
                <>
                  for the next {DAYS_LEFT} days and still stay within your <span className="money">{baht(stats.budget)}</span> budget
                </>
              )}
            </p>
          </div>
          <button
            onClick={onOpenBudgetGoalModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 hover:bg-[#E5E5EA] dark:hover:bg-neutral-700 text-[12px] font-semibold text-neutral-700 dark:text-neutral-200 active:scale-95 transition shrink-0"
            aria-label="Edit monthly budget goal"
          >
            <span className="material-symbols-outlined text-[14px]">tune</span>
            <span>Edit Goal</span>
          </button>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="relative h-3 w-full bg-[#F2F2F7] dark:bg-neutral-800 rounded-full">
            <div className={`h-full rounded-full transition-all duration-700 ease-out ${status.bar}`} style={{ width: `${Math.min(100, spentPct)}%` }} />
            <div
              className="absolute -top-1 -bottom-1 w-[2px] rounded bg-black/55 dark:bg-white/60"
              style={{ left: `${elapsedPct}%` }}
              title={`Expected by today: ${baht(stats.expectedByToday)}`}
            />
          </div>
          <div className={`flex items-center justify-between text-[12px] ${meta} pt-0.5`}>
            <span>
              Spent <strong className="money text-black dark:text-white font-semibold tabular-nums">{baht(stats.spent)}</strong> of{' '}
              <span className="money">{baht(stats.budget)}</span>
            </span>
            <span className={`font-semibold flex items-center gap-0.5 ${overPace ? 'text-[#9A5B00] dark:text-amber-300' : 'text-[#15803D] dark:text-[#4ADE80]'}`}>
              <span className="material-symbols-outlined text-[15px]">{overPace ? 'error' : 'check'}</span>
              <span className="money">{baht(Math.abs(stats.paceGap))}</span> {overPace ? 'over' : 'under'} pace
            </span>
          </div>
        </div>
      </section>

      {/* The bot asks only when it's unsure */}
      {reviewCount > 0 && (
        <section className="flex items-center gap-3 p-3 pl-3.5 rounded-[22px] bg-[#EEF1FF] dark:bg-[#1E2442] border border-[#4A63E0]/15">
          <Mascot size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-black dark:text-white leading-tight">
              {reviewCount} thing{reviewCount > 1 ? 's' : ''} need a quick look
            </p>
            <p className="text-[12px] text-[#3C4466] dark:text-[#C9D2FF] mt-0.5">I logged {stats.loggedCount} records this month on my own</p>
          </div>
          <button onClick={onOpenReview} className="h-9 px-3.5 rounded-xl bg-[#4A63E0] text-white text-[13px] font-semibold shrink-0 active:scale-95 transition">
            Review
          </button>
        </section>
      )}

      {/* Forgetting safety net */}
      {unlogged.length > 0 && (
        <section className="rounded-[22px] border-[1.5px] border-dashed border-[#D1D1D6] dark:border-neutral-700 p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[22px] text-[#9A5B00] dark:text-amber-300">event_busy</span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white leading-tight">
                Nothing logged on {unlogged.map(d => dayLabel(`${MONTH_PREFIX}-${String(d).padStart(2, '0')}`).split(' ').slice(0, 2).join(' ')).join(' & ')}
              </p>
              <p className={`text-[12px] ${meta} mt-0.5`}>Did you really spend nothing, or did some slips get missed?</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onMarkNoSpend(unlogged)} className="h-9 rounded-xl bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 text-[13px] font-semibold active:scale-[0.98] transition">
              Nothing spent
            </button>
            <button onClick={onOpenAddMoment} className="h-9 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/40 text-[#008A3D] dark:text-[#06C755] text-[13px] font-semibold flex items-center justify-center gap-1 active:scale-[0.98] transition">
              <span className="material-symbols-outlined text-[17px]">add</span>Add slips
            </button>
          </div>
        </section>
      )}

      {/* Cumulative trajectory */}
      <TrajectoryCard stats={stats} />

      {/* Income vs expenses */}
      <section className={`${card} p-4`}>
        <div className="grid grid-cols-2 divide-x divide-[#E5E5EA] dark:divide-neutral-800">
          <div className="pr-3 flex flex-col">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>Income</span>
            <span className="money text-[22px] font-bold text-black dark:text-white tracking-tight leading-none tabular-nums mt-1">{baht(stats.income)}</span>
            <Delta change={stats.incomeVsLastMonth} goodWhenUp label={`${stats.depositCount} deposits · vs Aug`} />
          </div>
          <div className="pl-4 flex flex-col">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>Expenses</span>
            <span className="money text-[22px] font-bold text-black dark:text-white tracking-tight leading-none tabular-nums mt-1">{baht(stats.spent)}</span>
            <Delta change={stats.spentVsLastMonth} goodWhenUp={false} label={`vs same day in Aug`} />
          </div>
        </div>
        <div className={`mt-3 pt-3 border-t border-[#E5E5EA] dark:border-neutral-800 flex items-center justify-between text-[12px] ${meta}`}>
          <span>Net so far</span>
          <span className="font-semibold text-[#15803D] dark:text-[#4ADE80]">
            +<span className="money">{baht(stats.net)}</span> · {Math.round(stats.savingsRate * 100)}% saved
          </span>
        </div>
      </section>

      {/* Subscription calendar */}
      <section className={`${card} p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/50 text-[#008A3D] dark:text-[#06C755] flex items-center justify-center">
              <span className="material-symbols-outlined text-[19px]">calendar_month</span>
            </div>
            <div>
              <span className="text-[14px] font-bold text-black dark:text-white block leading-tight">Subscription Calendar</span>
              <span className={`text-[11px] ${meta} block leading-tight mt-0.5`}>
                {subscriptions.length} active services · <span className="money">{baht(monthlyCommitment)}</span>/mo
              </span>
            </div>
          </div>
          <button type="button" onClick={onOpenSubscriptionCalendar} className="text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 hover:underline">
            <span>Open Calendar</span>
            <span className="text-[14px]">›</span>
          </button>
        </div>
        {upcoming.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {upcoming.map(s => {
              const n = daysFromToday(s.nextRenewalDate);
              return (
                <button
                  key={s.id}
                  onClick={onOpenSubscriptionCalendar}
                  className="p-2.5 rounded-xl text-left bg-[#FFF8E6] dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 hover:opacity-90 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                      {n === 1 ? 'Tomorrow' : `In ${n} days`}
                    </span>
                    <span className="money text-[12px] font-bold text-black dark:text-white tabular-nums">{baht(s.amount)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-[12px] font-semibold text-black dark:text-white truncate">{s.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Today */}
      <section className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between px-1">
          <span className={`text-[13px] font-semibold uppercase tracking-wider ${meta}`}>
            Today · <span className="money normal-case tracking-normal">{baht(stats.today.spent)}</span>
          </span>
          <button onClick={onViewAllTransactions} className={`text-[13px] font-medium ${meta} hover:text-black dark:hover:text-white flex items-center gap-0.5`}>
            <span>View all</span>
            <span>›</span>
          </button>
        </div>
        <div className={`${card} rounded-[20px] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800`}>
          {stats.today.items.length ? (
            stats.today.items.map(tx => <TransactionRow key={tx.id} tx={tx} onSelect={onSelectTransaction} />)
          ) : (
            <p className={`p-4 text-[13px] ${meta}`}>No records yet today. Forward a slip to the Thanbaht chat and it lands here.</p>
          )}
        </div>
        {stats.lastSlip && (
          <p className={`text-center text-[11px] ${meta} pt-1`}>
            Last slip read {stats.lastSlip.date === TODAY_ISO ? 'today' : dayLabel(stats.lastSlip.date)} {stats.lastSlip.time}
          </p>
        )}
      </section>
    </div>
  );
};

/* Coloured by meaning, not direction: spending less is good. */
const Delta: React.FC<{ change: number; goodWhenUp: boolean; label: string }> = ({ change, goodWhenUp, label }) => {
  const p = Math.round(change * 100);
  const good = goodWhenUp ? p >= 0 : p <= 0;
  return (
    <span className="text-[12px] mt-1.5 flex items-center gap-1 flex-wrap">
      <span className={`font-semibold flex items-center ${good ? 'text-[#15803D] dark:text-[#4ADE80]' : 'text-[#C62828] dark:text-red-400'}`}>
        <span className="material-symbols-outlined text-[14px]">{p >= 0 ? 'arrow_upward' : 'arrow_downward'}</span>
        {Math.abs(p)}% {p >= 0 ? 'more' : 'less'}
      </span>
      <span className="text-[#6E6E73] dark:text-neutral-400 text-[11px]">{label}</span>
    </span>
  );
};

/* Income steps up on paydays; expenses accumulate; the shaded gap is what you kept. */
const TrajectoryCard: React.FC<{ stats: Stats }> = ({ stats }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 350, H = 160, L = 40, R = 12, T = 12, B = 22;
  const top = Math.max(stats.incomeCumulative[TODAY_DAY], stats.cumulative[TODAY_DAY], 1);
  const ticks = niceTicks(top, 3);
  const max = ticks[ticks.length - 1];
  const x = (d: number) => L + ((d - 1) / (DAYS_IN_MONTH - 1)) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const days = Array.from({ length: TODAY_DAY }, (_, i) => i + 1);

  const stepPath = days.map((d, i) => `${i ? `H${x(d)}V${y(stats.incomeCumulative[d])}` : `M${x(d)},${y(stats.incomeCumulative[d])}`}`).join('');
  const expPath = days.map((d, i) => `${i ? 'L' : 'M'}${x(d)},${y(stats.cumulative[d])}`).join('');
  const gap =
    days.map((d, i) => `${i ? `H${x(d)}V${y(stats.incomeCumulative[d])}` : `M${x(d)},${y(stats.incomeCumulative[d])}`}`).join('') +
    [...days].reverse().map(d => `L${x(d)},${y(stats.cumulative[d])}`).join('') +
    'Z';

  const h = hover ?? null;
  return (
    <section className={`${card} p-4 pb-3`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[12px] font-medium ${meta}`}>Cumulative trajectory</span>
        <div className="flex items-center gap-3 text-[12px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-[3px] rounded bg-[#06C755]" />
            <span className="text-black dark:text-white">Income</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-[3px] rounded bg-[#1C1C1E] dark:bg-neutral-200" />
            <span className="text-black dark:text-white">Spent</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#06C755]/20" />
            <span className={meta}>Kept</span>
          </span>
        </div>
      </div>
      <div className="relative">
        {h !== null && (
          <div
            className="absolute -top-1 z-20 pointer-events-none -translate-x-1/2 bg-neutral-900 text-white text-[11px] px-2.5 py-1 rounded-lg shadow-md whitespace-nowrap"
            style={{ left: `${(x(h) / W) * 100}%` }}
          >
            <b>{h} Sep</b> · in <span className="money">{baht(stats.incomeCumulative[h])}</span> · spent{' '}
            <span className="money">{baht(stats.cumulative[h])}</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto overflow-visible touch-pan-y"
          role="img"
          aria-label="Cumulative income and spending this month"
          onPointerMove={e => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const d = Math.round(((px - L) / (W - L - R)) * (DAYS_IN_MONTH - 1)) + 1;
            setHover(Math.max(1, Math.min(TODAY_DAY, d)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map(v => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-[#E5E5EA] dark:stroke-neutral-800" />
              <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
                {v ? kbaht(v) : '0'}
              </text>
            </g>
          ))}
          <path d={gap} fill="#06C755" fillOpacity="0.14" />
          <path d={stepPath} fill="none" stroke="#06C755" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={expPath} fill="none" stroke="currentColor" className="text-[#1C1C1E] dark:text-neutral-200" strokeWidth="2" strokeLinejoin="round" />
          <circle cx={x(TODAY_DAY)} cy={y(stats.incomeCumulative[TODAY_DAY])} r="4" fill="#06C755" stroke="white" strokeWidth="2" />
          <circle cx={x(TODAY_DAY)} cy={y(stats.cumulative[TODAY_DAY])} r="4" className="fill-[#1C1C1E] dark:fill-neutral-200" stroke="white" strokeWidth="2" />
          {h !== null && <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} className="stroke-neutral-400" strokeDasharray="3 3" />}
          {[1, 8, 15, DAYS_IN_MONTH]
            .filter(d => Math.abs(d - TODAY_DAY) > 2)
            .map(d => (
              <text key={d} x={x(d)} y={H - 5} textAnchor="middle" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
                {d}
              </text>
            ))}
          <text x={x(TODAY_DAY)} y={H - 5} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-black dark:fill-white">
            {TODAY_DAY}
          </text>
        </svg>
      </div>
      <p className={`text-[11px] ${meta} mt-1`}>
        {DAYS_LEFT} days to go · you've kept <span className="money font-semibold text-black dark:text-white">{baht(stats.net)}</span> so far
      </p>
    </section>
  );
};
