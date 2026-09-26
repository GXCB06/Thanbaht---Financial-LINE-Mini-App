import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { SubscriptionItem } from '../types/finance';

interface Subscription12MonthChartProps {
  subscriptions: SubscriptionItem[];
  compact?: boolean;
  onExploreSavings?: () => void;
}

export interface MonthExpensePoint {
  key: string;
  monthIndex: number;
  fullMonth: string;
  utilities: number;
  entertainment: number;
  cloud: number;
  mobile: number;
  total: number;
  annualNote?: string;
}

export const Subscription12MonthChart: React.FC<Subscription12MonthChartProps> = ({
  subscriptions,
  compact = false,
  onExploreSavings
}) => {
  const [chartMode, setChartMode] = useState<'stacked' | 'sparkline'>('stacked');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  // Derive baseline recurring categories from active subscriptions
  const categoryBaselines = useMemo(() => {
    let utilities = 0;
    let entertainment = 0;
    let cloud = 0;
    let mobile = 0;

    subscriptions.forEach(s => {
      if (s.name.includes('Condo') || s.name.includes('MEA') || s.name.includes('Fiber')) {
        utilities += s.amount;
      } else if (s.category === 'Entertainment') {
        entertainment += s.amount;
      } else if (s.iconName === 'cloud' || s.iconName === 'smart_toy') {
        cloud += s.amount;
      } else {
        mobile += s.amount;
      }
    });

    return { utilities, entertainment, cloud, mobile };
  }, [subscriptions]);

  // Generate 12 months starting October 2026 to September 2027
  const twelveMonthsData: MonthExpensePoint[] = useMemo(() => {
    const monthsMeta = [
      { key: 'Oct', fullMonth: 'October 2026', annualExtra: 0, extraCat: 'none', note: '' },
      { key: 'Nov', fullMonth: 'November 2026', annualExtra: 650, extraCat: 'cloud', note: 'Annual Domain & Hosting Renewal' },
      { key: 'Dec', fullMonth: 'December 2026', annualExtra: 1200, extraCat: 'cloud', note: 'Year-end Cloud Storage Tier Renewal' },
      { key: 'Jan', fullMonth: 'January 2027', annualExtra: 1500, extraCat: 'utilities', note: 'Annual Condo Insurance & Building Fund' },
      { key: 'Feb', fullMonth: 'February 2027', annualExtra: 0, extraCat: 'none', note: '' },
      { key: 'Mar', fullMonth: 'March 2027', annualExtra: 300, extraCat: 'utilities', note: 'Seasonal AC Cooling Power Increment' },
      { key: 'Apr', fullMonth: 'April 2027', annualExtra: 650, extraCat: 'utilities', note: 'Peak Summer Electricity Wave' },
      { key: 'May', fullMonth: 'May 2027', annualExtra: 400, extraCat: 'utilities', note: 'Summer Electricity Offset' },
      { key: 'Jun', fullMonth: 'June 2027', annualExtra: 0, extraCat: 'none', note: '' },
      { key: 'Jul', fullMonth: 'July 2027', annualExtra: 800, extraCat: 'cloud', note: 'Mid-year Developer Tool Renewal' },
      { key: 'Aug', fullMonth: 'August 2027', annualExtra: 0, extraCat: 'none', note: '' },
      { key: 'Sep', fullMonth: 'September 2027', annualExtra: 0, extraCat: 'none', note: '' }
    ];

    return monthsMeta.map((m, idx) => {
      const u = categoryBaselines.utilities + (m.extraCat === 'utilities' ? m.annualExtra : 0);
      const e = categoryBaselines.entertainment + (m.extraCat === 'entertainment' ? m.annualExtra : 0);
      const c = categoryBaselines.cloud + (m.extraCat === 'cloud' ? m.annualExtra : 0);
      const mob = categoryBaselines.mobile + (m.extraCat === 'mobile' ? m.annualExtra : 0);
      const total = u + e + c + mob;

      return {
        key: m.key,
        monthIndex: idx,
        fullMonth: m.fullMonth,
        utilities: u,
        entertainment: e,
        cloud: c,
        mobile: mob,
        total,
        annualNote: m.note
      };
    });
  }, [categoryBaselines]);

  // Aggregate calculations
  const total12Months = useMemo(() => {
    return twelveMonthsData.reduce((acc, m) => acc + m.total, 0);
  }, [twelveMonthsData]);

  const averageMonthly = Math.round(total12Months / 12);
  const peakMonth = useMemo(() => {
    return twelveMonthsData.reduce((max, m) => m.total > max.total ? m : max, twelveMonthsData[0]);
  }, [twelveMonthsData]);

  const lowestMonth = useMemo(() => {
    return twelveMonthsData.reduce((min, m) => m.total < min.total ? m : min, twelveMonthsData[0]);
  }, [twelveMonthsData]);

  const selectedMonthData = twelveMonthsData[selectedMonthIndex] || twelveMonthsData[0];

  // =========================================================================
  // COMPACT MINI SPARKLINE (Used in Renewal Calendar View)
  // =========================================================================
  if (compact) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-[24px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8F9EE] dark:bg-emerald-950/50 text-[#008A3D] dark:text-[#06C755] flex items-center justify-center">
              <span className="material-symbols-outlined text-[17px]">timeline</span>
            </div>
            <div>
              <span className="text-[13px] font-bold text-black dark:text-white leading-tight block">
                Next 12 Months Outlook
              </span>
              <span className="text-[11px] text-[#8E8E93] leading-tight block">
                ฿{total12Months.toLocaleString()} projected total · Avg ฿{averageMonthly.toLocaleString()}/mo
              </span>
            </div>
          </div>

          {onExploreSavings && (
            <button
              type="button"
              onClick={onExploreSavings}
              className="text-[12px] font-bold text-[#008A3D] dark:text-[#06C755] hover:underline flex items-center gap-0.5"
            >
              <span>Audit</span>
              <span className="text-[14px]">›</span>
            </button>
          )}
        </div>

        {/* Mini Recharts Sparkline */}
        <div className="h-16 w-full -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={twelveMonthsData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="miniSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#008A3D" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#008A3D" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as MonthExpensePoint;
                    return (
                      <div className="bg-neutral-900 text-white px-2 py-1 rounded-md text-[10px] shadow-md font-sans">
                        <span className="font-bold">{d.fullMonth}: </span>
                        <span>฿{d.total.toLocaleString()}</span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#008A3D"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#miniSparklineGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Mini 12-Month Bar Ticks */}
        <div className="flex items-center justify-between text-[10px] font-semibold text-[#8E8E93] px-1 border-t border-neutral-100 dark:border-neutral-800 pt-2">
          <span>Oct 26</span>
          <span className="text-amber-600 dark:text-amber-400 font-bold">Peak: Jan (฿{peakMonth.total.toLocaleString()})</span>
          <span>Sep 27</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // FULL 12-MONTH EXPENSE DISTRIBUTION (Stacked Bar & Sparkline Analyzer)
  // =========================================================================
  return (
    <section className="bg-white dark:bg-neutral-900 rounded-[26px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.04] dark:border-white/[0.05] space-y-4">
      {/* Header and Toggle */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[19px] text-[#008A3D]">bar_chart</span>
            <h3 className="text-[16px] font-bold text-black dark:text-white leading-tight">
              12-Month Expense Distribution
            </h3>
          </div>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">
            Distribution of recurring costs by category over the next 12 months
          </p>
        </div>

        {/* Stacked Bar vs Sparkline Toggle */}
        <div className="flex bg-[#F2F2F7] dark:bg-neutral-800 p-0.5 rounded-xl text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setChartMode('stacked')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              chartMode === 'stacked'
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-2xs'
                : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">view_column</span>
            <span>Stacked</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('sparkline')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              chartMode === 'sparkline'
                ? 'bg-white dark:bg-neutral-900 text-[#008A3D] dark:text-[#06C755] shadow-2xs'
                : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">show_chart</span>
            <span>Sparkline</span>
          </button>
        </div>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F9FA] dark:bg-neutral-800/60 rounded-2xl border border-black/[0.03] dark:border-white/[0.04]">
        <div>
          <span className="text-[10px] font-bold text-[#8E8E93] uppercase block">12-Mo Total</span>
          <span className="text-[15px] font-black text-black dark:text-white font-sans tabular-nums mt-0.5 block">
            ฿{total12Months.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-[#8E8E93] uppercase block">Monthly Avg</span>
          <span className="text-[15px] font-black text-black dark:text-white font-sans tabular-nums mt-0.5 block">
            ฿{averageMonthly.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Peak Month</span>
          <span className="text-[15px] font-black text-amber-600 dark:text-amber-400 font-sans tabular-nums mt-0.5 block">
            {peakMonth.key} <span className="text-[11px] font-semibold">(฿{peakMonth.total.toLocaleString()})</span>
          </span>
        </div>
      </div>

      {/* Recharts Chart Area */}
      <div className="h-52 w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'stacked' ? (
            <BarChart
              data={twelveMonthsData}
              margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setSelectedMonthIndex(Number(state.activeTooltipIndex));
                }
              }}
            >
              <XAxis
                dataKey="key"
                tick={{ fill: '#8E8E93', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#8E8E93', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `฿${Math.round(val / 1000)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as MonthExpensePoint;
                    return (
                      <div className="bg-white dark:bg-neutral-800 p-2.5 rounded-xl shadow-xl border border-black/5 dark:border-white/10 text-[11px] space-y-1 z-30">
                        <span className="font-bold text-black dark:text-white block text-[12px]">
                          {data.fullMonth}
                        </span>
                        <div className="flex items-center justify-between gap-4 text-neutral-600 dark:text-neutral-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#5856D6]" /> Utilities
                          </span>
                          <span className="font-semibold text-black dark:text-white">฿{data.utilities.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-neutral-600 dark:text-neutral-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#FF2D55]" /> Entertainment
                          </span>
                          <span className="font-semibold text-black dark:text-white">฿{data.entertainment.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-neutral-600 dark:text-neutral-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#007AFF]" /> Cloud & AI
                          </span>
                          <span className="font-semibold text-black dark:text-white">฿{data.cloud.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-neutral-600 dark:text-neutral-300">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-[#06C755]" /> Telco
                          </span>
                          <span className="font-semibold text-black dark:text-white">฿{data.mobile.toLocaleString()}</span>
                        </div>
                        <div className="pt-1 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between font-bold text-black dark:text-white text-[12px]">
                          <span>Month Total</span>
                          <span className="text-[#008A3D] dark:text-[#06C755]">฿{data.total.toLocaleString()}</span>
                        </div>
                        {data.annualNote && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-0.5">
                            ⚡ {data.annualNote}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="utilities" stackId="a" fill="#5856D6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="entertainment" stackId="a" fill="#FF2D55" radius={[0, 0, 0, 0]} />
              <Bar dataKey="cloud" stackId="a" fill="#007AFF" radius={[0, 0, 0, 0]} />
              <Bar dataKey="mobile" stackId="a" fill="#06C755" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart
              data={twelveMonthsData}
              margin={{ top: 12, right: 8, left: -16, bottom: 0 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  setSelectedMonthIndex(Number(state.activeTooltipIndex));
                }
              }}
            >
              <defs>
                <linearGradient id="fullSparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#008A3D" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#008A3D" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="key"
                tick={{ fill: '#8E8E93', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#8E8E93', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `฿${Math.round(val / 1000)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as MonthExpensePoint;
                    return (
                      <div className="bg-neutral-900 text-white p-2.5 rounded-xl shadow-lg text-[11px] font-sans">
                        <span className="font-bold block text-[12px]">{data.fullMonth}</span>
                        <span className="text-[#06C755] font-bold text-[14px]">฿{data.total.toLocaleString()}</span>
                        {data.annualNote && (
                          <span className="text-amber-400 block text-[10px] mt-0.5">⚡ {data.annualNote}</span>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#008A3D"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#fullSparklineGrad)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Category Color Legend */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-neutral-100 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#5856D6]" />
          <span>Utilities</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF2D55]" />
          <span>Entertainment</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF]" />
          <span>Cloud & AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#06C755]" />
          <span>Telco</span>
        </div>
      </div>

      {/* Selected Month Deep-Dive Box */}
      <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/70 rounded-2xl border border-black/[0.03] dark:border-white/[0.04] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
            Inspecting: {selectedMonthData.fullMonth}
          </span>
          <span className="text-[15px] font-extrabold text-[#008A3D] dark:text-[#06C755] font-sans tabular-nums">
            ฿{selectedMonthData.total.toLocaleString()}
          </span>
        </div>

        {selectedMonthData.annualNote ? (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0">info</span>
            <span>
              <strong>Scheduled Renewal:</strong> {selectedMonthData.annualNote}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-[#8E8E93]">
            Standard baseline recurring cadence with no scheduled annual spikes.
          </div>
        )}

        {/* 12 Month Quick Scroller Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pt-1 no-scrollbar">
          {twelveMonthsData.map((m, idx) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSelectedMonthIndex(idx)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition ${
                selectedMonthIndex === idx
                  ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
                  : 'bg-white dark:bg-neutral-800 text-[#8E8E93] hover:text-black dark:hover:text-white border border-black/5 dark:border-white/5'
              }`}
            >
              {m.key} {m.annualNote ? '⚡' : ''}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
