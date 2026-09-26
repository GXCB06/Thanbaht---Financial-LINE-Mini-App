import React from 'react';
import { SubscriptionItem, Transaction } from '../types/finance';
import { Stats } from '../lib/ledger';
import { DAYS_IN_MONTH, DAYS_LEFT, TODAY_DAY, TODAY_ISO } from '../lib/clock';
import { baht, dayLabel } from '../lib/format';
import { TransactionRow } from './TransactionRow';
import { Mascot } from './Mascot';

interface OverviewTabProps {
  stats: Stats;
  monthLabel: string;
  /** Kept for the callers; subscriptions now live under Insights. */
  subscriptions?: SubscriptionItem[];
  onSelectTransaction: (tx: Transaction) => void;
  onViewAllTransactions: () => void;
  onOpenBudgetGoalModal: () => void;
  onOpenSubscriptionCalendar?: () => void;
  onOpenReview: () => void;
  onOpenAddMoment: () => void;
  onOpenInsights: () => void;
  onMarkNoSpend: (days: number[]) => void;
}

const card = 'bg-white dark:bg-neutral-900 rounded-[24px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';
const meta = 'text-[#6E6E73] dark:text-neutral-400';

/** Rows shown under "Today" before the rest hide behind "See all". */
const TODAY_ROWS = 4;

export const OverviewTab: React.FC<OverviewTabProps> = ({
  stats,
  monthLabel,
  onSelectTransaction,
  onViewAllTransactions,
  onOpenBudgetGoalModal,
  onOpenReview,
  onOpenAddMoment,
  onOpenInsights,
  onMarkNoSpend,
}) => {
  const over = stats.spent > stats.budget;
  const overPace = stats.paceGap < 0;
  const status = over
    ? { text: 'Over budget', pill: 'bg-red-50 text-[#C62828] dark:bg-red-950/40 dark:text-red-400', ring: '#E5484D' }
    : overPace
      ? { text: 'A little fast', pill: 'bg-amber-50 text-[#9A5B00] dark:bg-amber-950/40 dark:text-amber-300', ring: '#F5A524' }
      : { text: 'On track', pill: 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400', ring: '#06C755' };

  const reviewCount = stats.review.length;
  const emptyDays = stats.unloggedDays;
  const items = stats.today.items;

  return (
    <div className="space-y-4 pb-4 animate-fadeIn">
      {/* Today's date is the title: LINE already draws the app header above us */}
      <div className="pt-2 px-0.5 flex items-center justify-between">
        <h1 className="text-[28px] font-bold text-black dark:text-white tracking-tight leading-none">{dayLabel(TODAY_ISO)}</h1>
        <span className={`text-[13px] font-medium ${meta}`}>{monthLabel}</span>
      </div>

      {/* The one number that matters */}
      <section className={`${card} p-5 relative`}>
        <button
          onClick={onOpenBudgetGoalModal}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center active:scale-95 transition"
          aria-label="Change monthly budget"
        >
          <span className="material-symbols-outlined text-[19px]">tune</span>
        </button>

        <BudgetRing stats={stats} color={status.ring} over={over} />

        <div className="flex justify-center -mt-1">
          <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${status.pill}`}>{status.text}</span>
        </div>

        <div className="grid grid-cols-3 mt-4 pt-4 border-t border-[#EDEDF0] dark:border-neutral-800 text-center">
          <Stat label="Spent" value={baht(stats.spent)} />
          <Stat label={over ? 'Over by' : 'Left'} value={baht(Math.abs(stats.budget - stats.spent))} tone={over ? 'bad' : undefined} />
          <Stat label="Days left" value={String(DAYS_LEFT)} plain />
        </div>
      </section>

      {/* Only what needs you, one line each */}
      {(reviewCount > 0 || emptyDays.length > 0) && (
        <section className="space-y-2">
          {reviewCount > 0 && (
            <button
              onClick={onOpenReview}
              className="w-full flex items-center gap-3 p-3 pr-4 rounded-[20px] bg-[#EEF1FF] dark:bg-[#1E2442] border border-[#4A63E0]/15 active:scale-[0.99] transition text-left"
            >
              <Mascot size={36} />
              <span className="flex-1 text-[15px] font-bold text-black dark:text-white">{reviewCount} to check</span>
              <span className="material-symbols-outlined text-[22px] text-[#4A63E0]">chevron_right</span>
            </button>
          )}
          {emptyDays.length > 0 && (
            <div className="flex items-center gap-2 pl-4 pr-2 py-2 rounded-[20px] border-[1.5px] border-dashed border-[#D1D1D6] dark:border-neutral-700">
              <span className="material-symbols-outlined text-[20px] text-[#9A5B00] dark:text-amber-300">event_busy</span>
              <span className="flex-1 text-[14px] font-semibold text-black dark:text-white">
                {emptyDays.length} empty {emptyDays.length === 1 ? 'day' : 'days'}
              </span>
              <button onClick={() => onMarkNoSpend(emptyDays)} className="h-9 px-3 rounded-full text-[13px] font-semibold text-neutral-700 dark:text-neutral-200 active:scale-95 transition">
                No spend
              </button>
              <button onClick={onOpenAddMoment} className="h-9 px-3.5 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/40 text-[#008A3D] dark:text-[#06C755] text-[13px] font-semibold flex items-center gap-0.5 active:scale-95 transition">
                <span className="material-symbols-outlined text-[17px]">add</span>Add
              </button>
            </div>
          )}
        </section>
      )}

      {/* Today */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-[19px] font-bold text-black dark:text-white tracking-tight">
            Today <span className={`money text-[15px] font-semibold ${meta}`}>{baht(stats.today.spent)}</span>
          </h2>
          {items.length > TODAY_ROWS && (
            <button onClick={onViewAllTransactions} className="text-[14px] font-semibold text-[#008A3D] dark:text-[#06C755]">
              See all
            </button>
          )}
        </div>
        {items.length ? (
          <div className={`${card} rounded-[22px] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800`}>
            {items.slice(0, TODAY_ROWS).map(tx => (
              <TransactionRow key={tx.id} tx={tx} onSelect={onSelectTransaction} />
            ))}
          </div>
        ) : (
          <button
            onClick={onOpenAddMoment}
            className={`${card} w-full py-7 flex flex-col items-center gap-2 active:scale-[0.99] transition`}
          >
            <span className="w-11 h-11 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/40 text-[#008A3D] dark:text-[#06C755] flex items-center justify-center">
              <span className="material-symbols-outlined text-[26px]">add</span>
            </span>
            <span className="text-[15px] font-semibold text-black dark:text-white">Nothing yet today</span>
          </button>
        )}
      </section>

      {/* The month in three numbers; the charts live under Insights */}
      <button onClick={onOpenInsights} className={`${card} w-full p-4 text-left active:scale-[0.99] transition`}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-bold text-black dark:text-white">This month</span>
          <span className="material-symbols-outlined text-[20px] text-neutral-400">chevron_right</span>
        </div>
        <div className="grid grid-cols-3 text-center">
          <Stat label="In" value={`+${baht(stats.income)}`} tone="good" />
          <Stat label="Out" value={baht(stats.spent)} />
          <Stat label="Kept" value={`${stats.net < 0 ? '−' : ''}${baht(Math.abs(stats.net))}`} tone={stats.net < 0 ? 'bad' : 'good'} />
        </div>
      </button>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'good' | 'bad'; plain?: boolean }> = ({ label, value, tone, plain }) => (
  <div>
    <p className={`${plain ? '' : 'money '}text-[18px] font-bold tabular-nums leading-tight ${tone === 'good' ? 'text-[#15803D] dark:text-[#4ADE80]' : tone === 'bad' ? 'text-[#C62828] dark:text-red-400' : 'text-black dark:text-white'}`}>
      {value}
    </p>
    <p className={`text-[12px] font-medium ${meta} mt-0.5`}>{label}</p>
  </div>
);

/* How much of the budget is used, with a small notch where an even pace would be by now. */
const BudgetRing: React.FC<{ stats: Stats; color: string; over: boolean }> = ({ stats, color, over }) => {
  const S = 208;
  const STROKE = 15;
  const r = (S - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const used = Math.min(1, stats.spent / stats.budget);
  const paceAngle = (TODAY_DAY / DAYS_IN_MONTH) * 2 * Math.PI - Math.PI / 2;
  const px = S / 2 + r * Math.cos(paceAngle);
  const py = S / 2 + r * Math.sin(paceAngle);
  const nx = Math.cos(paceAngle);
  const ny = Math.sin(paceAngle);

  return (
    <div className="relative mx-auto" style={{ width: S, height: S }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="-rotate-90 absolute inset-0" role="img" aria-label={`${Math.round(used * 100)}% of the monthly budget used`}>
        <circle cx={S / 2} cy={S / 2} r={r} fill="none" strokeWidth={STROKE} className="stroke-[#EFEFF3] dark:stroke-neutral-800" />
        <circle
          cx={S / 2}
          cy={S / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(used * c, used > 0 ? 0.001 : 0)} ${c}`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {/* pace notch: drawn unrotated, so it sits exactly where the ring's clock would be */}
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} className="absolute inset-0 pointer-events-none">
        <line
          x1={px - nx * (STROKE / 2 + 3)}
          y1={py - ny * (STROKE / 2 + 3)}
          x2={px + nx * (STROKE / 2 + 3)}
          y2={py + ny * (STROKE / 2 + 3)}
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-black/70 dark:stroke-white/80"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`text-[13px] font-semibold ${meta}`}>{over ? 'Budget used' : 'You can spend'}</span>
        <span className="money text-[44px] leading-[48px] font-bold tracking-tight tabular-nums text-black dark:text-white">
          {over ? '100%+' : baht(stats.perDay)}
        </span>
        <span className={`text-[13px] font-medium ${meta}`}>{over ? 'this month' : 'a day'}</span>
      </div>
    </div>
  );
};
