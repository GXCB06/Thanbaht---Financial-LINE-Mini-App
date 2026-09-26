import React, { useEffect, useMemo, useState } from 'react';
import { CategoryType, Transaction } from '../types/finance';
import { Stats, kindOf } from '../lib/ledger';
import { ACCOUNTS } from '../lib/categories';
import { MONTH_PREFIX, TODAY_ISO, dayInMonth, isoOf } from '../lib/clock';
import { baht, dayLabel } from '../lib/format';
import { DayScrubChart } from './DayScrubChart';
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
  // A tap on the chart keeps a day; sliding a finger across it previews days without keeping them
  const [pinnedDay, setPinnedDay] = useState<number | null>(null);
  const [scrubDay, setScrubDay] = useState<number | null>(null);
  const selectedDay = scrubDay ?? pinnedDay;

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

      <DayScrubChart stats={stats} pinned={pinnedDay} onPin={setPinnedDay} onScrub={setScrubDay} />

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
