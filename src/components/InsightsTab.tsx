import React, { useState } from 'react';
import { CATEGORIES_DATA, WEEKLY_CADENCE } from '../data/mockData';
import { CategoryType, Transaction } from '../types/finance';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { SubscriptionView } from './SubscriptionView';

interface InsightsTabProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  transactions?: Transaction[];
  monthlyBudgetGoal?: number;
  onSelectCategoryFilter?: (category: CategoryType) => void;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  selectedMonth,
  onSelectMonth,
  transactions,
  monthlyBudgetGoal = 22000,
  onSelectCategoryFilter
}) => {
  const [metricTab, setMetricTab] = useState<'Spending' | 'Income' | 'Net'>('Spending');
  const [insightSubTab, setInsightSubTab] = useState<'Subscriptions' | 'Analytics'>('Subscriptions');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [showFridayInsightModal, setShowFridayInsightModal] = useState(false);
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null);
  const [projectionScenario, setProjectionScenario] = useState<'current' | 'budget' | 'frugal'>('current');
  const [activeDonutIndex, setActiveDonutIndex] = useState<number | null>(null);

  const DONUT_CATEGORIES = [
    { name: 'Food & Dining', value: 5240, color: '#06C755', percentage: '27.7%' },
    { name: 'Bills & Utilities', value: 5040, color: '#3055C6', percentage: '26.6%' },
    { name: 'Shopping', value: 4620, color: '#FF9500', percentage: '24.4%' },
    { name: 'Transport', value: 2180, color: '#5856D6', percentage: '11.5%' },
    { name: 'Entertainment', value: 1840, color: '#FF2D55', percentage: '9.7%' }
  ];

  const activeCategory = activeDonutIndex !== null ? DONUT_CATEGORIES[activeDonutIndex] : null;

  const months = ['August 2026', 'September 2026', 'October 2026'];

  // Predictive Spending Calculations (September 2026: 30 days total, current day = 23, 7 days remaining)
  const currentDay = 23;
  const daysInMonth = 30;
  const daysRemaining = daysInMonth - currentDay; // 7 days

  const totalSpentSoFar = transactions
    ? transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    : 18920;

  const totalIncome = transactions
    ? transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    : 32400;

  const currentDailyRate = totalSpentSoFar / currentDay; // ~822.61 THB/day
  const budgetSafeDailyRate = Math.max(0, monthlyBudgetGoal - totalSpentSoFar) / daysRemaining; // ~440 THB/day
  const frugalDailyRate = 250; // 250 THB/day

  // Dynamic values depending on active scenario
  const getScenarioValues = () => {
    switch (projectionScenario) {
      case 'current': {
        const remainingEst = currentDailyRate * daysRemaining;
        const totalEst = totalSpentSoFar + remainingEst;
        return {
          rate: Math.round(currentDailyRate),
          remainingEst: Math.round(remainingEst),
          totalEst: Math.round(totalEst),
          diffVsBudget: Math.round(totalEst - monthlyBudgetGoal),
          netSavings: Math.round(totalIncome - totalEst),
          status: 'Over Target Pace'
        };
      }
      case 'budget': {
        const remainingEst = budgetSafeDailyRate * daysRemaining;
        const totalEst = totalSpentSoFar + remainingEst;
        return {
          rate: Math.round(budgetSafeDailyRate),
          remainingEst: Math.round(remainingEst),
          totalEst: Math.round(totalEst),
          diffVsBudget: 0,
          netSavings: Math.round(totalIncome - totalEst),
          status: 'Exact Budget Target'
        };
      }
      case 'frugal': {
        const remainingEst = frugalDailyRate * daysRemaining;
        const totalEst = totalSpentSoFar + remainingEst;
        return {
          rate: frugalDailyRate,
          remainingEst: Math.round(remainingEst),
          totalEst: Math.round(totalEst),
          diffVsBudget: Math.round(totalEst - monthlyBudgetGoal),
          netSavings: Math.round(totalIncome - totalEst),
          status: 'Under Budget'
        };
      }
    }
  };

  const scenario = getScenarioValues();

  // Metric values based on active tab
  const getHeroMetric = () => {
    switch (metricTab) {
      case 'Spending':
        return {
          title: 'Total Spending',
          amount: '฿18,920',
          change: '↓ 4.2%',
          isPositive: true,
          peak: '฿2,340 Peak',
          peakX: 230,
          peakY: 14,
          splinePath: 'M 0,105 Q 35,95 70,88 T 140,82 T 210,65 Q 225,12 235,16 T 255,85 T 300,75',
          areaPath: 'M 0,105 Q 35,95 70,88 T 140,82 T 210,65 Q 225,12 235,16 T 255,85 T 300,75 L 300,130 L 0,130 Z',
          color: '#06C755'
        };
      case 'Income':
        return {
          title: 'Total Income',
          amount: '฿32,400',
          change: '↑ 8.2%',
          isPositive: true,
          peak: '฿27,400 Payday',
          peakX: 30,
          peakY: 18,
          splinePath: 'M 0,120 Q 25,20 40,25 T 140,28 T 210,32 Q 225,16 240,18 T 300,18',
          areaPath: 'M 0,120 Q 25,20 40,25 T 140,28 T 210,32 Q 225,16 240,18 T 300,18 L 300,130 L 0,130 Z',
          color: '#06C755'
        };
      case 'Net':
        return {
          title: 'Net Saved',
          amount: '฿13,480',
          change: '↑ 12.5%',
          isPositive: true,
          peak: '฿13.4k Stored',
          peakX: 270,
          peakY: 42,
          splinePath: 'M 0,110 Q 50,45 100,55 T 180,60 T 240,48 T 300,42',
          areaPath: 'M 0,110 Q 50,45 100,55 T 180,60 T 240,48 T 300,42 L 300,130 L 0,130 Z',
          color: '#3055c6'
        };
    }
  };

  const hero = getHeroMetric();

  return (
    <div className="space-y-4 pb-8 animate-fadeIn">
      {/* Top Header & Period Selector */}
      <div className="flex items-end justify-between pt-2 pb-1 px-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              LINE MINI APP • SYNC ACTIVE
            </span>
          </div>
          <h1 className="text-[26px] font-bold text-black dark:text-white tracking-tight leading-none font-sans">
            Insights
          </h1>
        </div>

        {/* Period Selector Pill */}
        <div className="relative">
          <button
            onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-neutral-50 active:scale-95 transition"
            type="button"
          >
            <span className="text-[13px] font-semibold text-black dark:text-white">
              {selectedMonth}
            </span>
            <span className="material-symbols-outlined text-[18px] text-[#8E8E93]">expand_more</span>
          </button>

          {isMonthDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-black/5 dark:border-white/10 py-1 z-50 animate-scaleIn">
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
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700'
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

      {/* Top View Selector: Subscriptions (Matches screen.png) | Analytics */}
      <div className="flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-neutral-800 rounded-xl max-w-sm mx-auto shadow-inner">
        <button
          onClick={() => setInsightSubTab('Subscriptions')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-semibold transition-all ${
            insightSubTab === 'Subscriptions'
              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
              : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setInsightSubTab('Analytics')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-semibold transition-all ${
            insightSubTab === 'Analytics'
              ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
              : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
          }`}
        >
          Spending Analytics
        </button>
      </div>

      {insightSubTab === 'Subscriptions' ? (
        <SubscriptionView />
      ) : (
        <>
          {/* SECTION 1: SPENDING TREND (HERO GRAPH) */}
          <section className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        {/* Category & Big Metric Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93] block mb-1">
              {hero.title}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[36px] font-semibold text-black dark:text-white leading-none font-sans tracking-tight tabular-nums">
                {hero.amount}
              </span>
              <span className="text-[12px] font-semibold text-[#06C755] flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                {hero.change}
              </span>
            </div>
          </div>

          {/* Mascot Wallet Icon */}
          <div className="w-10 h-10 rounded-full bg-[#dce1ff] dark:bg-neutral-800 flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[#3055c6] dark:text-[#6C8CFF] text-[22px]">
              account_balance_wallet
            </span>
          </div>
        </div>

        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1 mt-4 p-1 bg-[#F2F2F7] dark:bg-neutral-800/80 rounded-xl">
          {(['Spending', 'Income', 'Net'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMetricTab(tab)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-medium text-center transition-all ${
                metricTab === tab
                  ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold'
                  : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Visual Chart Stage (SVG Spark-trajectory) */}
        <div className="mt-5 relative h-44 w-full">
          {/* Horizontal Grid Guides */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="flex items-center justify-between">
              <div className="w-full h-[1px] bg-[#E5E5EA] dark:bg-neutral-800"></div>
              <span className="text-[11px] font-medium text-[#8E8E93] pl-2 w-8 text-right">฿2k</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-full h-[1px] bg-[#E5E5EA] dark:bg-neutral-800"></div>
              <span className="text-[11px] font-medium text-[#8E8E93] pl-2 w-8 text-right">฿1k</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="w-full h-[1px] bg-[#E5E5EA] dark:bg-neutral-800"></div>
              <span className="text-[11px] font-medium text-[#8E8E93] pl-2 w-8 text-right">0</span>
            </div>
          </div>

          {/* Trend Area & Line Curve */}
          <svg
            className="absolute inset-0 h-full w-[calc(100%-36px)] overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 300 130"
          >
            <defs>
              <linearGradient id="insightsGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                <stop offset="0%" stopColor={hero.color} stopOpacity="0.28"></stop>
                <stop offset="70%" stopColor={hero.color} stopOpacity="0.04"></stop>
                <stop offset="100%" stopColor={hero.color} stopOpacity="0.0"></stop>
              </linearGradient>
            </defs>

            {/* Shaded Area */}
            <path d={hero.areaPath} fill="url(#insightsGradient)"></path>

            {/* Spline Stroke Line */}
            <path
              d={hero.splinePath}
              fill="none"
              stroke={hero.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            ></path>

            {/* Peak Marker Node */}
            <circle cx={hero.peakX} cy={hero.peakY} fill="#FFFFFF" r="4.5" stroke={hero.color} strokeWidth="2.5"></circle>
            <circle cx={hero.peakX} cy={hero.peakY} fill={hero.color} fillOpacity="0.2" r="8"></circle>
          </svg>

          {/* Spike Tooltip Chip */}
          <div
            className="absolute top-0 -translate-y-2 bg-[#1C1C1E] dark:bg-white text-white dark:text-black text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-md pointer-events-none transition-all duration-300"
            style={{ left: `${(hero.peakX / 300) * 85}%` }}
          >
            {hero.peak}
          </div>
        </div>

        {/* Minimal Date X-Axis */}
        <div className="flex justify-between w-[calc(100%-36px)] mt-2 text-[11px] font-medium text-[#8E8E93]">
          <span>1</span>
          <span>7</span>
          <span>14</span>
          <span>21</span>
          <span>30</span>
        </div>
      </section>

      {/* SECTION 2: PREDICTIVE SPENDING PROJECTION */}
      <section className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#06C755]">
              insights
            </span>
            <h2 className="text-[15px] font-bold text-black dark:text-white tracking-tight">
              Predictive Spending Projection
            </h2>
          </div>
          <span className="text-[11px] font-medium text-[#8E8E93]">
            {daysRemaining} days remaining
          </span>
        </div>

        {/* Hero Projection Callout */}
        <div className="p-3.5 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/80 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                Estimated Month-End Spending
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-[28px] font-bold text-black dark:text-white tracking-tight font-sans tabular-nums">
                  ฿{scenario.totalEst.toLocaleString()}
                </span>
                <span className="text-[12px] text-[#8E8E93]">
                  (+฿{scenario.remainingEst.toLocaleString()} est.)
                </span>
              </div>
            </div>

            {/* Target comparison pill */}
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              scenario.diffVsBudget > 0
                ? 'bg-amber-50 text-[#FF9500] dark:bg-amber-950/40 dark:text-amber-400'
                : 'bg-[#E8F9EE] text-[#006e2b] dark:bg-emerald-950/40 dark:text-emerald-400'
            }`}>
              {scenario.diffVsBudget > 0
                ? `+฿${scenario.diffVsBudget.toLocaleString()} over ฿${(monthlyBudgetGoal/1000).toFixed(0)}k budget`
                : `Within ฿${(monthlyBudgetGoal/1000).toFixed(0)}k budget`}
            </span>
          </div>

          {/* Visual 2-Stage Progress Bar: Spent vs Projected */}
          <div className="space-y-1 pt-1">
            <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex relative">
              {/* Recorded so far */}
              <div
                className="h-full bg-[#1C1C1E] dark:bg-neutral-200 transition-all duration-500"
                style={{ width: `${Math.min(100, (totalSpentSoFar / Math.max(monthlyBudgetGoal, scenario.totalEst)) * 100)}%` }}
                title={`Recorded so far: ฿${totalSpentSoFar.toLocaleString()}`}
              ></div>

              {/* Projected remaining */}
              <div
                className="h-full bg-[#06C755] opacity-80 border-l border-white/40 dark:border-black/40 transition-all duration-500"
                style={{ width: `${Math.min(100 - (totalSpentSoFar / Math.max(monthlyBudgetGoal, scenario.totalEst)) * 100, (scenario.remainingEst / Math.max(monthlyBudgetGoal, scenario.totalEst)) * 100)}%` }}
                title={`Projected 7 days: +฿${scenario.remainingEst.toLocaleString()}`}
              ></div>

              {/* Target budget vertical line marker */}
              {monthlyBudgetGoal < scenario.totalEst && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-[#FF3B30] z-10 pointer-events-none"
                  style={{ left: `${(monthlyBudgetGoal / scenario.totalEst) * 100}%` }}
                  title={`Budget Target: ฿${monthlyBudgetGoal.toLocaleString()}`}
                ></div>
              )}
            </div>

            {/* Legend underneath bar */}
            <div className="flex items-center justify-between text-[11px] text-[#8E8E93] pt-0.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#1C1C1E] dark:bg-neutral-200"></span>
                  <span>Recorded (฿{totalSpentSoFar.toLocaleString()})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
                  <span>Projected (+฿{scenario.remainingEst.toLocaleString()})</span>
                </div>
              </div>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Sept 30
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Scenario Buttons */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
            Simulate Pacing for Remaining 7 Days:
          </span>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl">
            <button
              onClick={() => setProjectionScenario('current')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                projectionScenario === 'current'
                  ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs font-semibold'
                  : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
              }`}
            >
              <div className="text-[11px] font-semibold">Current Pace</div>
              <div className="text-[10px] text-neutral-500 font-sans tabular-nums">฿{Math.round(currentDailyRate)}/day</div>
            </button>

            <button
              onClick={() => setProjectionScenario('budget')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                projectionScenario === 'budget'
                  ? 'bg-white dark:bg-neutral-900 text-[#06C755] shadow-xs font-semibold'
                  : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
              }`}
            >
              <div className="text-[11px] font-semibold">Budget Cap</div>
              <div className="text-[10px] text-neutral-500 font-sans tabular-nums">฿{Math.round(budgetSafeDailyRate)}/day</div>
            </button>

            <button
              onClick={() => setProjectionScenario('frugal')}
              className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                projectionScenario === 'frugal'
                  ? 'bg-white dark:bg-neutral-900 text-[#06C755] shadow-xs font-semibold'
                  : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
              }`}
            >
              <div className="text-[11px] font-semibold">Lean Pace</div>
              <div className="text-[10px] text-neutral-500 font-sans tabular-nums">฿{frugalDailyRate}/day</div>
            </button>
          </div>
        </div>

        {/* 3-Point Forecast Stat Row */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800 text-[12px]">
          <div>
            <span className="text-[#8E8E93] text-[10px] uppercase font-semibold block">Daily Burn</span>
            <span className="font-bold text-black dark:text-white font-sans tabular-nums">฿{scenario.rate}/day</span>
          </div>
          <div>
            <span className="text-[#8E8E93] text-[10px] uppercase font-semibold block">7-Day Outflow</span>
            <span className="font-bold text-black dark:text-white font-sans tabular-nums">฿{scenario.remainingEst.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[#8E8E93] text-[10px] uppercase font-semibold block">Est. Net Saved</span>
            <span className="font-bold text-[#06C755] font-sans tabular-nums">+฿{scenario.netSavings.toLocaleString()}</span>
          </div>
        </div>

        {/* Companion Intelligent Suggestion */}
        <div className="p-2.5 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/30 border border-[#06C755]/20 flex items-start gap-2 text-[12px] text-[#006e2b] dark:text-emerald-300">
          <span className="text-base shrink-0">💡</span>
          <p className="leading-snug">
            {projectionScenario === 'current' ? (
              <span>
                At your current <strong>฿{Math.round(currentDailyRate)}/day</strong> rate, month-end spending will reach <strong>฿{scenario.totalEst.toLocaleString()}</strong>. Moderating to <strong>฿{Math.round(budgetSafeDailyRate)}/day</strong> keeps you within budget!
              </span>
            ) : projectionScenario === 'budget' ? (
              <span>
                Maintaining <strong>฿{Math.round(budgetSafeDailyRate)}/day</strong> will land your September expenses precisely on target at <strong>฿{monthlyBudgetGoal.toLocaleString()}</strong>, preserving <strong>฿{scenario.netSavings.toLocaleString()}</strong> in net savings.
              </span>
            ) : (
              <span>
                Adopting a lean pace of <strong>฿{frugalDailyRate}/day</strong> accelerates your savings to <strong>฿{scenario.netSavings.toLocaleString()}</strong> (a 36.2% savings rate).
              </span>
            )}
          </p>
        </div>
      </section>

      {/* SECTION 3: WHERE DID IT GO? (SPENDING CATEGORIES DONUT & BARS) */}
      <section className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px] text-[#06C755]">pie_chart</span>
            <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">
              Where did it go?
            </h2>
          </div>
          <span className="text-[12px] text-[#8E8E93] font-normal">5 categories</span>
        </div>

        {/* Recharts Donut Chart Stage */}
        <div className="relative w-full h-[210px] flex items-center justify-center my-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DONUT_CATEGORIES}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                onMouseEnter={(_, index) => setActiveDonutIndex(index)}
                onMouseLeave={() => setActiveDonutIndex(null)}
              >
                {DONUT_CATEGORIES.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    className="transition-opacity cursor-pointer duration-200"
                    opacity={activeDonutIndex === null || activeDonutIndex === index ? 1 : 0.4}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Interactive Center Readout inside Donut Hole */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
            {activeCategory ? (
              <div className="animate-fadeIn">
                <span className="text-[10px] font-semibold text-[#8E8E93] truncate max-w-[120px] block">
                  {activeCategory.name}
                </span>
                <span className="text-[18px] font-bold text-black dark:text-white font-sans tabular-nums leading-tight block">
                  ฿{activeCategory.value.toLocaleString()}
                </span>
                <span className="text-[11px] font-semibold text-[#06C755]">
                  {activeCategory.percentage}
                </span>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
                  Total Spent
                </span>
                <span className="text-[18px] font-bold text-black dark:text-white font-sans tabular-nums leading-tight block">
                  ฿18,920
                </span>
                <span className="text-[10px] text-[#8E8E93]">
                  Tap a slice
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Clean Interactive Category Pills Legend */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 pb-3.5 mb-3 border-b border-neutral-100 dark:border-neutral-800">
          {DONUT_CATEGORIES.map((item, index) => (
            <button
              key={item.name}
              onMouseEnter={() => setActiveDonutIndex(index)}
              onMouseLeave={() => setActiveDonutIndex(null)}
              onClick={() => {
                setActiveDonutIndex(index);
                setSelectedCategoryModal(item.name);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-all ${
                activeDonutIndex === index
                  ? 'bg-neutral-100 dark:bg-neutral-800 font-semibold scale-105 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
              <span className="text-[#8E8E93] font-sans tabular-nums font-medium">{item.percentage}</span>
            </button>
          ))}
        </div>

        {/* Category Horizontal Bars List */}
        <div className="flex flex-col gap-3.5">
          {CATEGORIES_DATA.map((item) => (
            <div
              key={item.category}
              onClick={() => {
                setSelectedCategoryModal(item.category);
                if (onSelectCategoryFilter) {
                  onSelectCategoryFilter(item.category);
                }
              }}
              className="flex items-center gap-3 group cursor-pointer active:opacity-75 transition-opacity"
            >
              <div className="w-8 h-8 rounded-full bg-[#F2F2F7] dark:bg-neutral-800 flex items-center justify-center text-[#1C1C1E] dark:text-neutral-200 shrink-0">
                <span className="material-symbols-outlined text-[18px]">{item.iconName}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-black dark:text-white truncate">
                    {item.category}
                  </span>
                  <span className="text-[13px] font-semibold text-black dark:text-white tabular-nums">
                    ฿{item.amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#F2F2F7] dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1C1C1E] dark:bg-neutral-200 rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>

              <span className="material-symbols-outlined text-[#8E8E93] text-[18px] shrink-0 group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: WHEN DO YOU SPEND? (BEHAVIORAL PATTERN & ONE-LINE AI OBSERVATION) */}
      <section className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[17px] font-bold text-black dark:text-white tracking-tight">
            When do you spend?
          </h2>
          <span className="text-[12px] text-[#8E8E93]">Weekly cadence</span>
        </div>

        {/* Weekday Bar Visualization */}
        <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2 pb-1">
          {WEEKLY_CADENCE.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
              {item.isPeak && (
                <span className="text-[11px] text-[#06C755] font-semibold">
                  {item.amount}
                </span>
              )}
              <div
                className={`w-full max-w-[28px] rounded-t-md transition-all ${
                  item.isPeak
                    ? 'bg-[#06C755] shadow-xs'
                    : 'bg-[#E5E5EA] dark:bg-neutral-700'
                }`}
                style={{ height: `${item.heightPercent}%` }}
              ></div>
              <span
                className={`text-[12px] ${
                  item.isPeak
                    ? 'text-black dark:text-white font-semibold'
                    : 'text-[#8E8E93]'
                }`}
              >
                {item.day}
              </span>
            </div>
          ))}
        </div>

        {/* One-Line AI Observation Callout */}
        <div className="mt-3.5 pt-2.5 border-t border-[#E5E5EA] dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[15px]">💡</span>
            <span className="text-[13px] text-black dark:text-white font-medium truncate">
              Friday is your highest-spending day.
            </span>
          </div>
          <button
            onClick={() => setShowFridayInsightModal(true)}
            className="text-[12px] font-semibold text-[#06C755] shrink-0 ml-2 hover:underline active:opacity-70 transition"
          >
            See why →
          </button>
        </div>
      </section>

      {/* SECTION 4: SEPTEMBER AT A GLANCE (COMPACT SUMMARY) */}
      <section className="p-4 bg-white dark:bg-neutral-900 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <h2 className="text-[17px] font-bold text-black dark:text-white mb-3 tracking-tight">
          September at a glance
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {/* Income Column */}
          <div className="flex flex-col p-2.5 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/70">
            <div className="flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px] text-[#006d30]">add</span>
              <span className="text-[11px] font-medium text-[#8E8E93]">Income</span>
            </div>
            <span className="text-[18px] font-bold text-black dark:text-white tracking-tight font-sans tabular-nums">
              ฿32,400
            </span>
            <span className="text-[11px] text-[#8E8E93] mt-1">2 deposits</span>
          </div>

          {/* Spending Column */}
          <div className="flex flex-col p-2.5 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/70">
            <div className="flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px] text-[#ba1a1a]">remove</span>
              <span className="text-[11px] font-medium text-[#8E8E93]">Spending</span>
            </div>
            <span className="text-[18px] font-bold text-black dark:text-white tracking-tight font-sans tabular-nums">
              ฿18,920
            </span>
            <span className="text-[11px] text-[#8E8E93] mt-1">48 records</span>
          </div>

          {/* Net Saved Column */}
          <div className="flex flex-col p-2.5 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/70">
            <div className="flex items-center gap-1 mb-1">
              <span className="material-symbols-outlined text-[14px] text-[#06C755]">savings</span>
              <span className="text-[11px] font-medium text-[#8E8E93]">Net Saved</span>
            </div>
            <span className="text-[18px] font-bold text-[#06C755] tracking-tight font-sans tabular-nums">
              +฿13,480
            </span>
            <span className="text-[11px] text-[#06C755] font-semibold mt-1">41.6% rate</span>
          </div>
        </div>
      </section>

      {/* Friday Spending Breakdown Modal */}
      {showFridayInsightModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💡</span>
                <h3 className="text-[17px] font-bold text-black dark:text-white">
                  Friday Spending Behavior
                </h3>
              </div>
              <button
                onClick={() => setShowFridayInsightModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <p className="text-[13px] text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Your Friday spending averages <strong>฿4,100</strong>, which is <strong>2.8×</strong> higher than your weekday average (฿1,460).
            </p>

            <div className="space-y-2 p-3 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[12px]">
              <div className="flex justify-between text-neutral-700 dark:text-neutral-200">
                <span>🍣 Dining Out / Social Gathering</span>
                <span className="font-semibold text-black dark:text-white">45% (฿1,850)</span>
              </div>
              <div className="flex justify-between text-neutral-700 dark:text-neutral-200">
                <span>🛍️ Weekend Shopping & Supplies</span>
                <span className="font-semibold text-black dark:text-white">35% (฿1,450)</span>
              </div>
              <div className="flex justify-between text-neutral-700 dark:text-neutral-200">
                <span>🍸 Nightlife & Entertainment</span>
                <span className="font-semibold text-black dark:text-white">20% (฿800)</span>
              </div>
            </div>

            <div className="p-3 bg-[#E8F9EE] rounded-xl text-[12px] text-[#006e2b] flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#06C755] shrink-0">check_circle</span>
              <p>
                <strong>Thanbaht Tip:</strong> Setting a Friday cap of ฿3,000 would save you an extra <strong>฿4,400/month</strong> towards your annual emergency fund.
              </p>
            </div>

            <button
              onClick={() => setShowFridayInsightModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#06C755] text-white font-semibold text-[14px] active:scale-98 transition shadow-xs"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Category Insight Modal */}
      {selectedCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-black dark:text-white">
                {selectedCategoryModal} Analysis
              </h3>
              <button
                onClick={() => setSelectedCategoryModal(null)}
                className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <p className="text-[13px] text-neutral-600 dark:text-neutral-300">
              Total spent in {selectedCategoryModal}:
            </p>
            <div className="text-[28px] font-bold text-black dark:text-white font-sans tabular-nums">
              ฿{CATEGORIES_DATA.find(c => c.category === selectedCategoryModal)?.amount.toLocaleString()}
            </div>

            <div className="text-[12px] text-neutral-500">
              Top merchant: ร้านอาหารข้าวต้มปลา XYZ, After You Dessert Cafe, Roots Coffee.
            </div>

            <button
              onClick={() => setSelectedCategoryModal(null)}
              className="w-full py-2.5 rounded-xl bg-[#1C1C1E] dark:bg-white text-white dark:text-black font-semibold text-[13px]"
            >
              Close
            </button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
