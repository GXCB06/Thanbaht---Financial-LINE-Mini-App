import React, { useState } from 'react';
import { Transaction } from '../types/finance';
import { CategoryIcon } from './CategoryIcon';

interface OverviewTabProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onViewAllTransactions: () => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  monthlyBudgetGoal: number;
  onOpenBudgetGoalModal: () => void;
  onOpenSubscriptionCalendar?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  transactions,
  onSelectTransaction,
  onViewAllTransactions,
  selectedMonth,
  onSelectMonth,
  monthlyBudgetGoal,
  onOpenBudgetGoalModal,
  onOpenSubscriptionCalendar
}) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  // Compute total monthly spending dynamically
  const totalSpending = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const remainingBudget = monthlyBudgetGoal - totalSpending;
  const spentPercentage = (totalSpending / monthlyBudgetGoal) * 100;
  const clampedProgress = Math.min(100, Math.max(0, spentPercentage));
  const isOverBudget = totalSpending > monthlyBudgetGoal;
  const daysRemaining = 7;
  const dailySafePace = remainingBudget > 0 ? Math.round(remainingBudget / daysRemaining) : 0;
  const monthElapsedPercent = (23 / 30) * 100; // 76.7% of month passed

  // Recent 5 transactions for the list
  const recentTransactions = transactions.slice(0, 5);

  const months = ['August 2026', 'September 2026', 'October 2026'];

  // Color logic for budget progress
  const getProgressBarColor = () => {
    if (spentPercentage > 100) return 'bg-[#FF3B30]';
    if (spentPercentage > 85) return 'bg-[#FF9500]';
    return 'bg-[#06C755]';
  };

  const getStatusBadge = () => {
    if (spentPercentage > 100) {
      return {
        text: 'Over Budget',
        classes: 'bg-red-50 text-[#FF3B30] dark:bg-red-950/40 dark:text-red-400'
      };
    }
    if (spentPercentage > 85) {
      return {
        text: 'Approaching Limit',
        classes: 'bg-amber-50 text-[#FF9500] dark:bg-amber-950/40 dark:text-amber-400'
      };
    }
    return {
      text: 'On Track',
      classes: 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400'
    };
  };

  const status = getStatusBadge();

  return (
    <div className="space-y-3.5 pb-8 animate-fadeIn">
      {/* Title & Period Selector */}
      <div className="pt-2 pb-0.5 px-0.5 flex items-end justify-between relative">
        <h1 className="text-[32px] font-bold text-black dark:text-white tracking-tight leading-none font-sans">
          Overview
        </h1>

        {/* Native iOS minimal dropdown pill */}
        <div className="relative">
          <button
            onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-[13px] font-semibold text-black dark:text-white active:scale-95 transition"
            aria-expanded={isMonthDropdownOpen}
          >
            <span>{selectedMonth}</span>
            <span className="text-[9px] text-[#8E8E93] font-bold transition-transform">▼</span>
          </button>

          {isMonthDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-black/5 dark:border-white/10 py-1 z-50 animate-scaleIn">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onSelectMonth(m);
                    setIsMonthDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors ${
                    m === selectedMonth
                      ? 'text-[#06C755] font-semibold bg-[#06C755]/5'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span>{m}</span>
                  {m === selectedMonth && (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NEW: Monthly Budget Goal & Progress Card */}
      <section className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] space-y-3">
        {/* Top Header of Budget */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                MONTHLY BUDGET
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.classes}`}>
                {status.text}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-bold text-black dark:text-white font-sans tracking-tight tabular-nums">
                ฿{totalSpending.toLocaleString()}
              </span>
              <span className="text-[13px] font-medium text-[#8E8E93]">
                / ฿{monthlyBudgetGoal.toLocaleString()}
              </span>
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

        {/* Progress Bar with Day Marker */}
        <div className="space-y-1.5">
          <div className="relative h-3 w-full bg-[#F2F2F7] dark:bg-neutral-800 rounded-full overflow-hidden">
            {/* Progress Fill */}
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressBarColor()}`}
              style={{ width: `${clampedProgress}%` }}
            ></div>

            {/* Time passed marker (Day 23 indicator at 76.7%) */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-black/40 dark:bg-white/40 pointer-events-none"
              style={{ left: `${monthElapsedPercent}%` }}
              title="Current calendar pace: Day 23 of 30"
            ></div>
          </div>

          {/* Under-bar labels */}
          <div className="flex items-center justify-between text-[11px] text-[#8E8E93] pt-0.5">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {spentPercentage.toFixed(1)}% spent
            </span>
            <span>
              {isOverBudget ? (
                <strong className="text-[#FF3B30]">
                  ฿{Math.abs(remainingBudget).toLocaleString()} over budget
                </strong>
              ) : (
                <>
                  <strong className="text-black dark:text-white font-semibold">
                    ฿{remainingBudget.toLocaleString()}
                  </strong>{' '}
                  remaining
                </>
              )}
            </span>
          </div>
        </div>

        {/* Compact Companion Insight Note */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 min-w-0 truncate">
            <span>🗓️</span>
            <span className="truncate">
              {isOverBudget ? (
                <span>Budget ceiling reached for September.</span>
              ) : (
                <span>
                  Safe pace: <strong className="text-black dark:text-white font-semibold">฿{dailySafePace.toLocaleString()}</strong> / day for 7 days
                </span>
              )}
            </span>
          </div>

          <button
            onClick={onOpenBudgetGoalModal}
            className="text-[#06C755] font-semibold text-[11px] hover:underline shrink-0 ml-2"
          >
            Adjust
          </button>
        </div>
      </section>

      {/* SECTION 1: Hero Financial Visualization (Trajectory Graph) */}
      <section className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 pt-4 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        {/* Minimal Inline Legend & Context */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-[#8E8E93]">Cumulative Trajectory</span>
          <div className="flex items-center gap-3.5 text-[12px] font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
              <span className="text-black dark:text-white font-semibold">Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1C1C1E] dark:bg-neutral-300"></span>
              <span className="text-[#8E8E93]">Expenses</span>
            </div>
          </div>
        </div>

        {/* Apple Health / Finance Clean Trajectory Graph */}
        <div 
          className="w-full relative cursor-crosshair touch-pan-x"
          onMouseLeave={() => setHoveredDay(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.width * 0.1));
            const day = Math.max(1, Math.min(30, Math.round((relX / (rect.width * 0.9)) * 30)));
            setHoveredDay(day);
          }}
        >
          {hoveredDay !== null && (
            <div 
              className="absolute top-0 -translate-y-2 pointer-events-none z-20 bg-neutral-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-full shadow-md transition-all -translate-x-1/2 flex items-center gap-1.5"
              style={{ left: `${Math.max(15, Math.min(85, (hoveredDay / 30) * 100))}%` }}
            >
              <span>Day {hoveredDay}:</span>
              <span className="text-[#06C755] font-semibold">
                ฿{Math.round(27400 + (hoveredDay >= 22 ? 5000 : 0)).toLocaleString()}
              </span>
              <span className="text-neutral-400">/</span>
              <span className="text-neutral-200">
                ฿{Math.round((hoveredDay / 30) * 18920).toLocaleString()}
              </span>
            </div>
          )}

          <svg
            aria-label="Income vs Expenses trajectory chart"
            className="w-full h-[168px] overflow-visible"
            viewBox="0 0 350 150"
          >
            <defs>
              <linearGradient id="incomeGlow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#06C755" stopOpacity="0.18"></stop>
                <stop offset="100%" stopColor="#06C755" stopOpacity="0.0"></stop>
              </linearGradient>
            </defs>

            {/* Subtle horizontal grid lines & Y-axis labels */}
            {/* ฿30k (y=20) */}
            <text fill="#8E8E93" fontSize="10" fontWeight="500" x="0" y="23">฿30k</text>
            <line className="stroke-[#E5E5EA] dark:stroke-neutral-800" strokeWidth="1" x1="38" x2="350" y1="20" y2="20"></line>

            {/* ฿20k (y=55) */}
            <text fill="#8E8E93" fontSize="10" fontWeight="500" x="0" y="58">฿20k</text>
            <line className="stroke-[#E5E5EA] dark:stroke-neutral-800" strokeWidth="1" x1="38" x2="350" y1="55" y2="55"></line>

            {/* ฿10k (y=90) */}
            <text fill="#8E8E93" fontSize="10" fontWeight="500" x="0" y="93">฿10k</text>
            <line className="stroke-[#E5E5EA] dark:stroke-neutral-800" strokeWidth="1" x1="38" x2="350" y1="90" y2="90"></line>

            {/* 0 (y=125) */}
            <text fill="#8E8E93" fontSize="10" fontWeight="500" x="18" y="128">0</text>
            <line className="stroke-[#D1D1D6] dark:stroke-neutral-700" strokeWidth="1" x1="38" x2="350" y1="125" y2="125"></line>

            {/* Income Soft Green Gradient Fill Area */}
            <path
              d="M 40,125 C 90,123 110,65 160,50 C 220,38 275,20 340,14 L 340,125 Z"
              fill="url(#incomeGlow)"
            ></path>

            {/* Cumulative Income Curve (Solid Thanbaht Green #06C755 tracking up to ฿32,400) */}
            <path
              d="M 40,125 C 90,123 110,65 160,50 C 220,38 275,20 340,14"
              fill="none"
              stroke="#06C755"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            ></path>

            {/* Cumulative Expenses Curve (Crisp solid charcoal line tracking up to ฿18,920) */}
            <path
              d="M 40,125 C 80,120 120,95 180,82 C 240,70 290,62 340,58"
              fill="none"
              stroke="currentColor"
              className="text-[#1C1C1E] dark:text-neutral-200"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            ></path>

            {/* Endpoint Markers with Clean Rings */}
            <circle cx="340" cy="14" fill="#06C755" r="4.5" stroke="#FFFFFF" strokeWidth="2"></circle>
            <circle cx="340" cy="58" fill="#1C1C1E" r="4" stroke="#FFFFFF" strokeWidth="2"></circle>
          </svg>

          {/* Minimal Day Markers (1, 7, 14, 21, 30) */}
          <div className="flex items-center justify-between text-[#8E8E93] text-[11px] font-medium pt-1 pl-9 pr-1">
            <span>1</span>
            <span>7</span>
            <span>14</span>
            <span>21</span>
            <span className="text-black dark:text-white font-semibold">30</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: Flatter Side-by-Side Summary */}
      <section className="bg-white dark:bg-neutral-900 rounded-[20px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="grid grid-cols-2 divide-x divide-[#E5E5EA] dark:divide-neutral-800">
          {/* Left: Income */}
          <div className="pr-3 flex flex-col">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Income</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[22px] font-bold text-black dark:text-white tracking-tight leading-none font-sans tabular-nums">
                ฿32,400
              </span>
            </div>
            <span className="text-[12px] font-medium text-[#06C755] mt-1.5 flex items-center gap-0.5">
              ↑ +8.2% <span className="text-[#8E8E93] font-normal text-[11px] ml-0.5">vs last mo.</span>
            </span>
          </div>

          {/* Right: Expenses */}
          <div className="pl-4 flex flex-col">
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">Expenses</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[22px] font-bold text-[#1C1C1E] dark:text-neutral-100 tracking-tight leading-none font-sans tabular-nums">
                ฿18,920
              </span>
            </div>
            <span className="text-[12px] font-medium text-[#8E8E93] mt-1.5 flex items-center gap-0.5">
              ↓ −4.1% <span className="text-[#8E8E93] font-normal text-[11px] ml-0.5">vs last mo.</span>
            </span>
          </div>
        </div>
      </section>

      {/* SECTION: Subscription Calendar Widget */}
      <section className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/50 text-[#008A3D] dark:text-[#06C755] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[19px]">calendar_month</span>
            </div>
            <div>
              <span className="text-[14px] font-bold text-black dark:text-white block leading-tight">
                Subscription Calendar
              </span>
              <span className="text-[11px] text-[#8E8E93] block leading-tight mt-0.5">
                8 active services · ฿7,736/mo
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSubscriptionCalendar}
            className="text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] flex items-center gap-0.5 hover:underline"
          >
            <span>Open Calendar</span>
            <span className="text-[14px]">›</span>
          </button>
        </div>

        {/* Imminent Renewals Highlights (27 Sep & 28 Sep) */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div 
            onClick={onOpenSubscriptionCalendar}
            className="p-2.5 rounded-xl bg-[#FFF8E6] dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 cursor-pointer hover:opacity-90 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">In 2 Days</span>
              <span className="text-[12px] font-bold text-black dark:text-white font-sans tabular-nums">฿99</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#007AFF] shrink-0" />
              <span className="text-[12px] font-semibold text-black dark:text-white truncate">iCloud+ 200GB</span>
            </div>
          </div>

          <div 
            onClick={onOpenSubscriptionCalendar}
            className="p-2.5 rounded-xl bg-[#FFF8E6] dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 cursor-pointer hover:opacity-90 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">In 3 Days</span>
              <span className="text-[12px] font-bold text-black dark:text-white font-sans tabular-nums">฿299</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#FF0000] shrink-0" />
              <span className="text-[12px] font-semibold text-black dark:text-white truncate">YouTube Premium</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Recent Activity (iOS Inset Grouped List) */}
      <section className="space-y-1.5 pt-0.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[13px] font-semibold text-[#6E6E73] dark:text-neutral-400 uppercase tracking-wider">
            RECENT ACTIVITY
          </span>
          <button
            onClick={onViewAllTransactions}
            className="text-[13px] font-medium text-[#8E8E93] hover:text-black dark:hover:text-white flex items-center gap-0.5 active:opacity-60 transition"
          >
            <span>View all</span>
            <span className="text-[13px]">›</span>
          </button>
        </div>

        {/* Inset Grouped White Container */}
        <div className="bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800">
          {recentTransactions.map((tx) => {
            const isIncome = tx.amount > 0;
            const formattedAmount = isIncome
              ? `+฿${tx.amount.toLocaleString()}`
              : `−฿${Math.abs(tx.amount).toLocaleString()}`;

            return (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction(tx)}
                className="min-h-[56px] px-4 py-3 flex items-center justify-between active:bg-[#F2F2F7] dark:active:bg-neutral-800 transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CategoryIcon category={tx.category} isIncome={isIncome} />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-semibold text-black dark:text-white truncate leading-tight group-hover:text-[#06C755] transition-colors">
                        {tx.title}
                      </span>
                      {tx.isRecurring && (
                        <span className="material-symbols-outlined text-[14px] text-[#3055C6] dark:text-[#6C8CFF] shrink-0" title="Recurring subscription">
                          event_repeat
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-[#8E8E93] mt-0.5">
                      {tx.category} · {tx.time}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                  <span
                    className={`text-[15px] font-semibold tracking-tight font-sans tabular-nums ${
                      isIncome ? 'text-[#06C755]' : 'text-[#1C1C1E] dark:text-neutral-100'
                    }`}
                  >
                    {formattedAmount}
                  </span>
                  <span className="text-[#C7C7CC] group-hover:text-[#8E8E93] text-[15px] transition-colors">
                    ›
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
