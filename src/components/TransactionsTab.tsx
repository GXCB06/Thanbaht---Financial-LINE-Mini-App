import React, { useEffect, useMemo, useState } from 'react';
import { CategoryType, Transaction } from '../types/finance';
import { Stats, kindOf } from '../lib/ledger';
import { ACCOUNTS } from '../lib/categories';
import { DAYS_IN_MONTH, MONTH_LABEL, MONTH_PREFIX, TODAY_DAY, TODAY_ISO, dayInMonth, isoOf } from '../lib/clock';
import { baht, dayLabel, kbaht, niceTicks } from '../lib/format';
import { TransactionRow } from './TransactionRow';

type Filter = 'all' | 'spent' | 'income' | 'transfer' | 'review';

interface TransactionsTabProps {
  transactions: Transaction[];
  stats: Stats;
  initialFilter: { category?: CategoryType; review?: boolean } | null;
  onConsumeFilter: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddModal: () => void;
  onMarkNoSpend: (days: number[]) => void;
}

const meta = 'text-[#6E6E73] dark:text-neutral-400';
const card = 'bg-white dark:bg-neutral-900 rounded-[22px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]';

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  stats,
  initialFilter,
  onConsumeFilter,
  onSelectTransaction,
  onOpenAddModal,
  onMarkNoSpend,
}) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showChart, setShowChart] = useState(true);

  // Arriving from Insights with a category tapped
  useEffect(() => {
    if (initialFilter?.category) setCategory(initialFilter.category);
    if (initialFilter?.review) setFilter('review');
    if (initialFilter) onConsumeFilter();
  }, [initialFilter, onConsumeFilter]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter(tx => {
      if (tx.status === 'deleted' || !tx.date.startsWith(MONTH_PREFIX)) return false;
      const k = kindOf(tx);
      if (filter === 'spent' && (k !== 'expense' || tx.status !== 'ok')) return false;
      if (filter === 'income' && k !== 'income') return false;
      if (filter === 'transfer' && k !== 'transfer') return false;
      if (filter === 'review' && tx.status !== 'review') return false;
      if (category && tx.category !== category) return false;
      if (selectedDay && dayInMonth(tx.date) !== selectedDay) return false;
      if (q) {
        const hay = [tx.title, tx.category, tx.note, tx.said, tx.paymentMethod, ACCOUNTS[tx.account].name, String(Math.abs(tx.amount))]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [transactions, filter, category, selectedDay, searchQuery]);

  // Group by date; show unlogged days as their own rows so gaps are visible
  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    filtered.forEach(tx => byDate.set(tx.date, [...(byDate.get(tx.date) ?? []), tx]));
    const showGaps = filter === 'all' && !category && !selectedDay && !searchQuery.trim();
    if (showGaps) stats.unloggedDays.forEach(d => byDate.has(isoOf(d)) || byDate.set(isoOf(d), []));
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, txs]) => [date, txs.sort((a, b) => b.time.localeCompare(a.time))] as const);
  }, [filtered, filter, category, selectedDay, searchQuery, stats.unloggedDays]);

  const chips: { key: Filter; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'spent', label: 'Spent' },
    { key: 'income', label: 'Income' },
    { key: 'transfer', label: 'Transfers' },
    { key: 'review', label: 'Needs review', count: stats.review.length },
  ];

  return (
    <div className="space-y-3 pb-4 animate-fadeIn">
      {/* Search */}
      <div className="space-y-1.5 pt-0.5">
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${meta}`}>
            <span className="material-symbols-outlined text-[19px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search merchant, bank, note or amount"
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl text-[14px] text-black dark:text-white placeholder-[#6E6E73] focus:outline-hidden focus:ring-2 focus:ring-[#06C755]/30 transition shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className={`absolute inset-y-0 right-0 pr-3 flex items-center ${meta}`} aria-label="Clear search">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>
        {!searchQuery && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] px-0.5">
            <span className={`${meta} font-medium shrink-0`}>Quick:</span>
            {['Roots Coffee', 'Grab', '7-Eleven', 'KBank', 'SCB', 'Netflix'].map(tag => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white shrink-0 transition active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`h-8 px-3 rounded-full text-[13px] font-semibold shrink-0 flex items-center gap-1.5 border transition active:scale-95 ${
              filter === c.key
                ? 'bg-[#1C1C1E] text-white border-[#1C1C1E] dark:bg-white dark:text-black dark:border-white'
                : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-black/5 dark:border-white/10'
            }`}
          >
            {c.label}
            {!!c.count && <span className="text-[11px] px-1.5 rounded-full bg-[#FFF3DC] text-[#9A5B00]">{c.count}</span>}
          </button>
        ))}
        <button
          onClick={onOpenAddModal}
          className="h-8 px-3 bg-[#008A3D] hover:bg-[#007333] text-white rounded-full flex items-center gap-1 text-[13px] font-semibold active:scale-95 transition shrink-0"
        >
          <span className="material-symbols-outlined text-[17px]">add</span>Add
        </button>
      </div>

      {category && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/40 text-[12px] text-[#006e2b] dark:text-emerald-300">
          <span>
            Showing <strong>{category}</strong> only
          </span>
          <button onClick={() => setCategory(null)} className="font-bold underline">
            Clear
          </button>
        </div>
      )}

      {/* Daily spend */}
      <section className={`${card} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta}`}>Daily spend · {MONTH_LABEL}</span>
            <p className="text-[13px] text-black dark:text-white mt-0.5">
              Spent <b className="money tabular-nums">{baht(stats.spent)}</b> · In{' '}
              <b className="money tabular-nums text-[#15803D] dark:text-[#4ADE80]">+{baht(stats.income)}</b>
            </p>
          </div>
          <button onClick={() => setShowChart(s => !s)} className="text-[12px] font-semibold text-[#008A3D] dark:text-[#06C755]">
            {showChart ? 'Hide' : 'Show'} chart
          </button>
        </div>
        {showChart && <DailyBars stats={stats} selected={selectedDay} onSelect={setSelectedDay} />}
        {selectedDay && (
          <div className="mt-2 flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/60 text-[13px]">
            <span className="text-black dark:text-white">
              <b>{dayLabel(isoOf(selectedDay))}</b> · <span className="money">{baht(stats.byDay[selectedDay])}</span> · {stats.countByDay[selectedDay]} records
            </span>
            <button onClick={() => setSelectedDay(null)} className="text-[#008A3D] dark:text-[#06C755] font-semibold">
              Clear ✕
            </button>
          </div>
        )}
      </section>

      {searchQuery && (
        <p className={`px-1 text-[12px] ${meta}`}>
          Found <strong className="text-black dark:text-white">{filtered.length}</strong> matching “{searchQuery}”
        </p>
      )}

      {/* Grouped list */}
      <div className="space-y-4 pt-1">
        {groups.length === 0 ? (
          <div className={`${card} p-8 text-center`}>
            <span className={`material-symbols-outlined text-4xl ${meta} mb-2`}>search_off</span>
            <p className="text-[15px] font-medium text-black dark:text-white">Nothing here</p>
            <p className={`text-[13px] ${meta} mt-1`}>Try another word or clear the filters.</p>
          </div>
        ) : (
          groups.map(([date, txs]) => {
            const spent = txs.filter(t => t.status === 'ok' && kindOf(t) === 'expense' && !t.excluded).reduce((a, t) => a - t.amount, 0);
            const inc = txs.filter(t => t.status === 'ok' && kindOf(t) === 'income').reduce((a, t) => a + t.amount, 0);
            const day = dayInMonth(date)!;
            return (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[12px] font-semibold uppercase tracking-wider ${meta}`}>
                    {date === TODAY_ISO ? 'Today · ' : ''}
                    {dayLabel(date)}
                  </span>
                  <span className={`text-[12px] font-medium ${meta} tabular-nums`}>
                    {spent > 0 && (
                      <>
                        Spent <span className="money">{baht(spent)}</span>
                      </>
                    )}
                    {inc > 0 && (
                      <span className="text-[#15803D] dark:text-[#4ADE80]">
                        {spent > 0 ? ' · ' : ''}In +<span className="money">{baht(inc)}</span>
                      </span>
                    )}
                  </span>
                </div>
                {txs.length === 0 ? (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-[20px] border-[1.5px] border-dashed border-[#D1D1D6] dark:border-neutral-700 text-[13px]">
                    <span className="material-symbols-outlined text-[20px] text-[#9A5B00] dark:text-amber-300">help</span>
                    <span className="flex-1 text-neutral-700 dark:text-neutral-300">Nothing logged. Missed a slip?</span>
                    <button onClick={() => onMarkNoSpend([day])} className="font-semibold text-[#008A3D] dark:text-[#06C755]">
                      No spend
                    </button>
                    <button onClick={onOpenAddModal} className="font-semibold text-[#008A3D] dark:text-[#06C755]">
                      Add
                    </button>
                  </div>
                ) : (
                  <div className={`${card} rounded-[20px] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800`}>
                    {txs.map(tx => (
                      <TransactionRow key={tx.id} tx={tx} onSelect={onSelectTransaction} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* Every day of the month: logged days are bars, "?" marks days with nothing
   logged, dashed outlines are days still to come. Tap a bar to filter the list. */
const DailyBars: React.FC<{ stats: Stats; selected: number | null; onSelect: (d: number | null) => void }> = ({ stats, selected, onSelect }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 340, H = 120, B = 18, T = 10;
  const ticks = niceTicks(Math.max(...stats.byDay.slice(1), 1), 2);
  const max = ticks[ticks.length - 1];
  const bw = W / DAYS_IN_MONTH;
  const y = (v: number) => H - B - (v / max) * (H - B - T);

  return (
    <div className="relative mt-3">
      {hover !== null && (
        <div
          className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full pointer-events-none bg-neutral-900 text-white text-[11px] px-2 py-1 rounded-lg whitespace-nowrap"
          style={{ left: `${((hover - 0.5) * bw * 100) / W}%` }}
        >
          <b>{dayLabel(isoOf(hover))}</b>{' '}
          {hover > TODAY_DAY ? '· upcoming' : stats.countByDay[hover] ? `· ${baht(stats.byDay[hover])} · ${stats.countByDay[hover]} records` : '· nothing logged'}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Daily spending this month; question marks are days with nothing logged">
        {ticks.slice(1).map(v => (
          <g key={v}>
            <line x1="0" x2={W} y1={y(v)} y2={y(v)} className="stroke-[#E5E5EA] dark:stroke-neutral-800" />
            <text x={W} y={y(v) - 3} textAnchor="end" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
              {kbaht(v)}
            </text>
          </g>
        ))}
        {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map(d => {
          const x = (d - 1) * bw + 1.5;
          const w = bw - 3;
          const v = stats.byDay[d];
          const base = H - B;
          let mark: React.ReactNode;
          if (d > TODAY_DAY) {
            mark = <rect x={x} y={base - 10} width={w} height={10} rx={3} fill="none" className="stroke-[#D1D1D6] dark:stroke-neutral-700" strokeDasharray="2 2" />;
          } else if (!stats.countByDay[d]) {
            mark = stats.unloggedDays.includes(d) ? (
              <g>
                <rect x={x} y={base - 8} width={w} height={8} rx={3} fill="none" stroke="#9A5B00" strokeDasharray="2 1.5" />
                <text x={x + w / 2} y={base - 12} textAnchor="middle" fontSize="10" fontWeight="700" fill="#9A5B00">
                  ?
                </text>
              </g>
            ) : (
              <rect x={x} y={base - 2} width={w} height={2} rx={1} className="fill-[#E5E5EA] dark:fill-neutral-700" />
            );
          } else {
            const h = Math.max(3, base - y(v));
            const fill = selected === d ? 'fill-[#06C755]' : d === TODAY_DAY && !selected ? 'fill-[#6E6E73] dark:fill-neutral-400' : 'fill-[#E5E5EA] dark:fill-neutral-700';
            mark = <path d={`M${x},${base} v${-(h - 3)} q0,-3 3,-3 h${w - 6} q3,0 3,3 v${h - 3}z`} className={fill} />;
          }
          return (
            <g
              key={d}
              onPointerEnter={() => setHover(d)}
              onPointerLeave={() => setHover(null)}
              onClick={() => d <= TODAY_DAY && onSelect(selected === d ? null : d)}
              className={d <= TODAY_DAY ? 'cursor-pointer' : ''}
            >
              {mark}
              <rect x={(d - 1) * bw} y={0} width={bw} height={H - B} fill="transparent" />
            </g>
          );
        })}
        {[1, 8, 15, DAYS_IN_MONTH]
          .filter(d => Math.abs(d - TODAY_DAY) > 2)
          .map(d => (
            <text key={d} x={(d - 0.5) * bw} y={H - 4} textAnchor="middle" fontSize="10" className="fill-[#6E6E73] dark:fill-neutral-400">
              {d}
            </text>
          ))}
        <text x={(TODAY_DAY - 0.5) * bw} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="700" className="fill-black dark:fill-white">
          {TODAY_DAY}
        </text>
      </svg>
      <div className={`flex gap-3 text-[11px] ${meta} mt-1`}>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#E5E5EA] dark:bg-neutral-700" />
          Logged
        </span>
        <span className="flex items-center gap-1 text-[#9A5B00] dark:text-amber-300">
          <b>?</b> Nothing logged
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#D1D1D6] dark:border-neutral-600" />
          Upcoming
        </span>
      </div>
    </div>
  );
};
