import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CategoryType, SubscriptionItem, Transaction } from '../types/finance';
import { Stats, projectMonthEnd } from '../lib/ledger';
import { CATEGORY_META } from '../lib/categories';
import { DAYS_IN_MONTH, DAYS_LEFT, TODAY_DAY, TODAY_ISO } from '../lib/clock';
import { baht, dayLabel, kbaht, niceTicks } from '../lib/format';
import { SubscriptionView } from './SubscriptionView';
import { CategoryIcon } from './CategoryIcon';
import { Mascot } from './Mascot';

interface InsightsTabProps {
  stats: Stats;
  monthLabel: string;
  subscriptions: SubscriptionItem[];
  onAddSubscription: (sub: SubscriptionItem) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onSelectCategoryFilter: (category: CategoryType) => void;
  onShare: () => void;
}

const meta = 'text-[#6E6E73] dark:text-neutral-400';
const card = 'p-4 bg-white dark:bg-neutral-900 rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';
const LEAN_RATE = 250;

export const InsightsTab: React.FC<InsightsTabProps> = ({
  stats,
  monthLabel,
  subscriptions,
  onAddSubscription,
  onSelectTransaction,
  onSelectCategoryFilter,
  onShare,
}) => {
  const [insightSubTab, setInsightSubTab] = useState<'Subscriptions' | 'Analytics'>('Subscriptions');
  const [scenario, setScenario] = useState<'current' | 'budget' | 'lean'>('current');
  const [activeSlice, setActiveSlice] = useState<number | null>(null);

  const rates = { current: stats.currentDailyRate, budget: stats.perDay, lean: LEAN_RATE };
  const proj = projectMonthEnd(stats, rates[scenario]);
  const deltaPct = Math.round(stats.spentVsLastMonth * 100);
  const spending = stats.categories.filter(c => c.spent > 0);
  const hot = [...stats.categories]
    .filter(c => c.budget && c.spent > (c.budget * TODAY_DAY) / DAYS_IN_MONTH)
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)[0];
  const lastSlip = stats.lastSlip ? `${stats.lastSlip.date === TODAY_ISO ? '' : dayLabel(stats.lastSlip.date) + ' '}${stats.lastSlip.time}` : '—';
  const recurringTotal = stats.recurring.reduce((a, t) => a - t.amount, 0);
  const slice = activeSlice !== null ? spending[activeSlice] : null;

  return (
    <div className="space-y-4 pb-4 animate-fadeIn">
      <div className="flex items-end justify-between pt-2 pb-1 px-1">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#06C755]" />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>Last slip read {lastSlip}</span>
          </div>
          <h1 className="text-[26px] font-bold text-black dark:text-white tracking-tight leading-none">Insights</h1>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 text-[13px] font-semibold text-black dark:text-white whitespace-nowrap">
          {monthLabel}
        </span>
      </div>

      <div className="flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-neutral-800 rounded-xl">
        {(['Subscriptions', 'Analytics'] as const).map(t => (
          <button
            key={t}
            onClick={() => setInsightSubTab(t)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-semibold transition-all ${
              insightSubTab === t ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs' : `${meta} hover:text-black dark:hover:text-white`
            }`}
          >
            {t === 'Analytics' ? 'Spending Analytics' : t}
          </button>
        ))}
      </div>

      {insightSubTab === 'Subscriptions' ? (
        <SubscriptionView subscriptions={subscriptions} onAddSubscription={onAddSubscription} />
      ) : (
        <>
          {/* Spending pace vs last month and budget */}
          <section className={card}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>Spent so far</span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="money text-[34px] font-bold text-black dark:text-white leading-none tracking-tight tabular-nums">{baht(stats.spent)}</span>
              <span className={`text-[12px] font-semibold flex items-center ${deltaPct > 0 ? 'text-[#C62828] dark:text-red-400' : 'text-[#15803D] dark:text-[#4ADE80]'}`}>
                <span className="material-symbols-outlined text-[14px]">{deltaPct > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                {Math.abs(deltaPct)}% {deltaPct > 0 ? 'more' : 'less'} than August
              </span>
            </div>
            <p className={`text-[12px] ${meta} mt-1`}>
              vs <span className="money">{baht(stats.lastMonthSameDay)}</span> by {TODAY_DAY} Aug · on track to finish near{' '}
              <span className="money">{baht(stats.currentDailyRate * DAYS_IN_MONTH)}</span>
            </p>
            <PaceChart stats={stats} />
          </section>

          {hot && (
            <section className="flex items-center gap-3 p-3 pl-3.5 rounded-[22px] bg-[#EEF1FF] dark:bg-[#1E2442] border border-[#4A63E0]/15">
              <Mascot size={36} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black dark:text-white leading-tight">{hot.category} is running hot</p>
                <p className="text-[12px] text-[#3C4466] dark:text-[#C9D2FF] mt-0.5">
                  {Math.round((hot.spent / hot.budget) * 100)}% of its budget used with {DAYS_LEFT} days left ·{' '}
                  <span className="money">{baht(Math.max(0, hot.budget - hot.spent))}</span> to go
                </p>
              </div>
            </section>
          )}

          {/* Predictive projection */}
          <section className={`${card} space-y-3.5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#06C755]">insights</span>
                <h2 className="text-[15px] font-bold text-black dark:text-white tracking-tight">Month-end projection</h2>
              </div>
              <span className={`text-[11px] font-medium ${meta}`}>{DAYS_LEFT} days remaining</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/80 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`text-[11px] font-semibold uppercase tracking-wider block ${meta}`}>Estimated month-end spending</span>
                  <span className="money text-[28px] font-bold text-black dark:text-white tracking-tight tabular-nums">{baht(proj.total)}</span>
                  <span className={`text-[12px] ${meta} ml-1.5`}>(+<span className="money">{baht(proj.rest)}</span>)</span>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                    proj.vsBudget > 0 ? 'bg-amber-50 text-[#9A5B00] dark:bg-amber-950/40 dark:text-amber-300' : 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400'
                  }`}
                >
                  {proj.vsBudget > 0 ? `${baht(proj.vsBudget)} over budget` : 'Within budget'}
                </span>
              </div>
              <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-[#1C1C1E] dark:bg-neutral-200" style={{ width: `${Math.min(100, (stats.spent / Math.max(stats.budget, proj.total)) * 100)}%` }} />
                <div className="h-full bg-[#06C755] border-l border-white/40" style={{ width: `${Math.min(100, (proj.rest / Math.max(stats.budget, proj.total)) * 100)}%` }} />
                {stats.budget < proj.total && (
                  <div className="absolute top-0 bottom-0 w-[2px] bg-[#E5484D]" style={{ left: `${(stats.budget / proj.total) * 100}%` }} title="Budget" />
                )}
              </div>
              <div className={`flex items-center gap-3 text-[11px] ${meta}`}>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#1C1C1E] dark:bg-neutral-200" />
                  Recorded <span className="money">{baht(stats.spent)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#06C755]" />
                  Projected +<span className="money">{baht(proj.rest)}</span>
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className={`text-[11px] font-semibold uppercase tracking-wider block ${meta}`}>Try a pace for the last {DAYS_LEFT} days</span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl">
                {(
                  [
                    ['current', 'Current pace', rates.current],
                    ['budget', 'Budget cap', rates.budget],
                    ['lean', 'Lean pace', rates.lean],
                  ] as const
                ).map(([key, label, rate]) => (
                  <button
                    key={key}
                    onClick={() => setScenario(key)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                      scenario === key ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs' : `${meta} hover:text-black dark:hover:text-white`
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{label}</div>
                    <div className="money text-[10px] tabular-nums">{baht(rate)}/day</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[12px]">
              <div>
                <span className={`${meta} text-[10px] uppercase font-semibold block`}>Daily burn</span>
                <span className="money font-bold text-black dark:text-white tabular-nums">{baht(proj.rate)}/day</span>
              </div>
              <div>
                <span className={`${meta} text-[10px] uppercase font-semibold block`}>{DAYS_LEFT}-day outflow</span>
                <span className="money font-bold text-black dark:text-white tabular-nums">{baht(proj.rest)}</span>
              </div>
              <div>
                <span className={`${meta} text-[10px] uppercase font-semibold block`}>Est. net saved</span>
                <span className="money font-bold text-[#15803D] dark:text-[#4ADE80] tabular-nums">+{baht(proj.netSaved)}</span>
              </div>
            </div>
          </section>

          {/* Where did it go */}
          <section className={card}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-[#06C755]">pie_chart</span>
                <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">Where did it go?</h2>
              </div>
              <span className={`text-[12px] ${meta}`}>vs each budget</span>
            </div>
            <div className="relative w-full h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spending}
                    dataKey="spent"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    isAnimationActive={false}
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={2}
                    stroke="none"
                    onMouseEnter={(_, i) => setActiveSlice(i)}
                    onMouseLeave={() => setActiveSlice(null)}
                    onClick={(_, i) => setActiveSlice(i)}
                  >
                    {spending.map((c, i) => (
                      <Cell key={c.category} fill={CATEGORY_META[c.category].color} opacity={activeSlice === null || activeSlice === i ? 1 : 0.35} className="cursor-pointer" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta}`}>{slice ? slice.category : 'Total spent'}</span>
                <span className="money text-[18px] font-bold text-black dark:text-white tabular-nums">{baht(slice ? slice.spent : stats.spent)}</span>
                <span className={`text-[11px] ${meta}`}>{slice ? `${Math.round(slice.share * 100)}% of spending` : 'Tap a slice'}</span>
              </div>
            </div>
            <div className="divide-y divide-[#F2F2F7] dark:divide-neutral-800">
              {stats.categories.map(c => {
                const pct = c.budget ? (c.spent / c.budget) * 100 : 0;
                return (
                  <button key={c.category} onClick={() => onSelectCategoryFilter(c.category)} className="w-full flex items-center gap-3 py-2.5 text-left group">
                    <CategoryIcon category={c.category} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-black dark:text-white truncate">{c.category}</span>
                        <span className="tabular-nums text-black dark:text-white">
                          <span className="money font-semibold">{baht(c.spent)}</span>
                          <span className={meta}> / {baht(c.budget)}</span>
                        </span>
                      </div>
                      <div className="relative h-2 mt-1.5 mb-1 rounded-full bg-[#F2F2F7] dark:bg-neutral-800">
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: CATEGORY_META[c.category].color }} />
                        <div
                          className="absolute -top-[3px] -bottom-[3px] w-[2px] rounded bg-black/60 dark:bg-white/70"
                          style={{ left: `${(TODAY_DAY / DAYS_IN_MONTH) * 100}%` }}
                          title="Where you'd be on pace today"
                        />
                      </div>
                      <div className={`flex items-center justify-between text-[11px] ${meta}`}>
                        <span>
                          {Math.round(c.share * 100)}% of spending · {c.count} records
                        </span>
                        <span>Aug {baht(c.lastMonth)}</span>
                      </div>
                    </div>
                    <span className={`material-symbols-outlined text-[18px] ${meta} group-hover:translate-x-0.5 transition-transform`}>chevron_right</span>
                  </button>
                );
              })}
            </div>
            <p className={`text-[11px] ${meta} mt-2`}>The | mark shows where you'd be if you spent evenly through the month.</p>
          </section>

          {/* When do you spend */}
          <section className={card}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">When do you spend?</h2>
              <span className={`text-[12px] ${meta}`}>avg per day, excl. bills</span>
            </div>
            <WeekdayChart stats={stats} />
            {stats.weekdayPeak && (
              <div className="mt-3 p-3 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/80 flex items-start gap-2 text-[13px] text-neutral-700 dark:text-neutral-200">
                <span className="material-symbols-outlined text-[18px] text-[#4A63E0] dark:text-[#9FB0FF] shrink-0">auto_awesome</span>
                <p>
                  <b className="text-black dark:text-white">
                    {stats.weekdayPeak.label} averages <span className="money">{baht(stats.weekdayPeak.avg)}</span>
                  </b>
                  , about {stats.weekdayPeak.ratio.toFixed(1)}× your other days. {Math.round(stats.weekdayPeak.topShare * 100)}% of it is {stats.weekdayPeak.topCategory}.
                  Bills and unlogged days are left out.
                </p>
              </div>
            )}
          </section>

          {/* Recurring */}
          <section className={card}>
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">Recurring bills</h2>
              <span className={`text-[12px] ${meta}`}>
                <span className="money">{baht(recurringTotal)}</span> this month
              </span>
            </div>
            <p className={`text-[12px] ${meta} mb-1`}>Detected from repeat payments</p>
            <div className="divide-y divide-[#F2F2F7] dark:divide-neutral-800">
              {stats.recurring.map(t => (
                <button key={t.id} onClick={() => onSelectTransaction(t)} className="w-full flex items-center gap-3 py-2.5 text-left">
                  <CategoryIcon category={t.category} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-black dark:text-white truncate">{t.title}</p>
                    <p className={`text-[12px] ${meta} flex items-center gap-1`}>
                      <span className="material-symbols-outlined text-[13px]">event_repeat</span>next on {t.billingDay} Oct
                    </p>
                  </div>
                  <span className="money text-[14px] font-semibold text-black dark:text-white tabular-nums">{baht(t.amount)}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Top merchants */}
          <section className={card}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">Where you go most</h2>
              <span className={`text-[12px] ${meta}`}>excl. bills</span>
            </div>
            <div className="divide-y divide-[#F2F2F7] dark:divide-neutral-800">
              {stats.topMerchants.map(m => (
                <div key={m.title} className="flex items-center gap-3 py-2.5">
                  <CategoryIcon category={m.category} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-black dark:text-white truncate">{m.title}</p>
                    <p className={`text-[12px] ${meta}`}>
                      {m.visits} visit{m.visits > 1 ? 's' : ''} · avg <span className="money">{baht(m.total / m.visits)}</span>
                    </p>
                  </div>
                  <span className="money text-[14px] font-semibold text-black dark:text-white tabular-nums">{baht(m.total)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Savings rate */}
          <section className={card}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">Savings rate</h2>
              <span className={`text-[12px] ${meta}`}>share of income kept</span>
            </div>
            <SavingsChart history={[...stats.savingsHistory, ['Sep', Math.round(stats.savingsRate * 100)]]} />
            <p className={`text-[11px] ${meta} mt-2`}>September is striped: the month isn't over, so it will come down as you keep spending.</p>
          </section>

          <button
            onClick={onShare}
            className="w-full py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 text-[14px] font-semibold text-black dark:text-white flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <span className="material-symbols-outlined text-[18px]">ios_share</span>Share my {monthLabel.split(' ')[0]} recap
          </button>
        </>
      )}
    </div>
  );
};

/* Cumulative spend this month vs last month, with the budget as a reference line. */
const PaceChart: React.FC<{ stats: Stats }> = ({ stats }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = 180, L = 38, R = 42, T = 10, B = 20;
  const top = Math.max(stats.budget, stats.lastMonthCumulative[DAYS_IN_MONTH] ?? 0, stats.cumulative[TODAY_DAY]) * 1.02;
  const ticks = niceTicks(top, 4);
  const max = ticks[ticks.length - 1];
  const x = (d: number) => L + ((d - 1) / (DAYS_IN_MONTH - 1)) * (W - L - R);
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const line = (arr: number[], to: number) =>
    Array.from({ length: to }, (_, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(arr[i + 1] ?? 0).toFixed(1)}`).join('');
  const aug = stats.lastMonthCumulative;

  return (
    <div className="relative mt-3">
      {hover !== null && (
        <div
          className="absolute top-0 z-10 -translate-x-1/2 pointer-events-none bg-neutral-900 text-white text-[11px] px-2.5 py-1 rounded-lg whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <b>Day {hover}</b>
          {hover <= TODAY_DAY && (
            <>
              {' '}· Sep <span className="money">{baht(stats.cumulative[hover])}</span>
            </>
          )}{' '}
          · Aug <span className="money">{baht(aug[hover] ?? 0)}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto overflow-visible touch-pan-y"
        role="img"
        aria-label="Cumulative spending in September compared with August and the budget"
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(1, Math.min(DAYS_IN_MONTH, Math.round(((px - L) / (W - L - R)) * (DAYS_IN_MONTH - 1)) + 1)));
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
        <line x1={L} x2={W - R} y1={y(stats.budget)} y2={y(stats.budget)} stroke="#E5484D" strokeDasharray="4 3" strokeWidth="1.5" />
        <text x={W - R + 4} y={y(stats.budget) + 3} fontSize="10" fill="#E5484D">
          Budget
        </text>
        <path d={line(aug, DAYS_IN_MONTH)} fill="none" className="stroke-[#8E8E93]" strokeWidth="2" strokeDasharray="5 4" />
        <text x={W - R + 4} y={y(aug[DAYS_IN_MONTH] ?? 0) + 12} fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
          Aug
        </text>
        <path d={line(stats.cumulative, TODAY_DAY)} fill="none" stroke="currentColor" className="text-[#1C1C1E] dark:text-white" strokeWidth="2.25" strokeLinejoin="round" />
        <circle cx={x(TODAY_DAY)} cy={y(stats.cumulative[TODAY_DAY])} r="4.5" className="fill-[#1C1C1E] dark:fill-white" stroke="white" strokeWidth="2" />
        <text x={x(TODAY_DAY) + 8} y={y(stats.cumulative[TODAY_DAY]) + 4} fontSize="10" fontWeight="700" className="fill-black dark:fill-white">
          Sep
        </text>
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="stroke-neutral-400" />}
        {[1, 8, 15, 22, DAYS_IN_MONTH].map(d => (
          <text key={d} x={x(d)} y={H - 4} textAnchor="middle" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
            {d}
          </text>
        ))}
      </svg>
      <div className={`flex gap-3.5 text-[11px] ${meta} mt-1`}>
        <span className="flex items-center gap-1">
          <span className="w-3.5 border-t-2 border-[#1C1C1E] dark:border-white" />
          September
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3.5 border-t-2 border-dashed border-[#8E8E93]" />
          August
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3.5 border-t-2 border-dashed border-[#E5484D]" />
          Budget <span className="money">{baht(stats.budget)}</span>
        </span>
      </div>
    </div>
  );
};

/* Average day-to-day spend per weekday. The value label is overlaid so it never
   takes height away from the bar it describes. */
const WeekdayChart: React.FC<{ stats: Stats }> = ({ stats }) => {
  const W = 340, H = 130, B = 18, T = 20;
  const top = Math.max(...stats.weekday.map(w => w.avg), 1);
  const ticks = niceTicks(top, 2);
  const max = ticks[ticks.length - 1];
  const bw = W / 7;
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const peak = stats.weekdayPeak?.label;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Average spending per weekday">
      {stats.weekday.map((w, i) => {
        const x = i * bw + bw * 0.2;
        const bwid = bw * 0.6;
        const h = Math.max(3, H - B - y(w.avg));
        const isPeak = w.label === peak;
        return (
          <g key={w.label}>
            <title>{`${w.label}: avg ${baht(w.avg)} over ${w.days} days`}</title>
            <path d={`M${x},${H - B} v${-(h - 4)} q0,-4 4,-4 h${bwid - 8} q4,0 4,4 v${h - 4}z`} className={isPeak ? 'fill-[#06C755]' : 'fill-[#E5E5EA] dark:fill-neutral-700'} />
            {isPeak && (
              <text x={x + bwid / 2} y={y(w.avg) - 6} textAnchor="middle" fontSize="11" fontWeight="700" className="fill-black dark:fill-white money">
                {kbaht(w.avg)}
              </text>
            )}
            <text x={x + bwid / 2} y={H - 4} textAnchor="middle" fontSize="11" fontWeight={isPeak ? 700 : 400} className={isPeak ? 'fill-black dark:fill-white' : 'fill-[#6E6E73] dark:fill-neutral-400'}>
              {w.label[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const SavingsChart: React.FC<{ history: [string, number][] }> = ({ history }) => {
  const W = 340, H = 110, B = 18, T = 18, max = 60;
  const bw = W / history.length;
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Savings rate by month">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#06C755" fillOpacity="0.3" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#06C755" strokeWidth="2.5" />
        </pattern>
      </defs>
      {history.map(([m, v], i) => {
        const x = i * bw + bw * 0.22;
        const w = bw * 0.56;
        const h = Math.max(3, H - B - y(v));
        const last = i === history.length - 1;
        return (
          <g key={m}>
            <path d={`M${x},${H - B} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4}z`} fill={last ? 'url(#hatch)' : undefined} className={last ? '' : 'fill-[#E5E5EA] dark:fill-neutral-700'} />
            <text x={x + w / 2} y={y(v) - 5} textAnchor="middle" fontSize="10" fontWeight={last ? 700 : 400} className="fill-black dark:fill-white">
              {v}%
            </text>
            <text x={x + w / 2} y={H - 4} textAnchor="middle" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
              {m}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
