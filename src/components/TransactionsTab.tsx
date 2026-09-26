import React, { useEffect, useMemo, useState } from 'react';
import { CategoryType, Transaction } from '../types/finance';
import { Stats, kindOf } from '../lib/ledger';
import { ACCOUNTS } from '../lib/categories';
import { TODAY, TODAY_ISO } from '../lib/clock';
import { baht, dayLabel, time12 } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';
import { FlowBar, MoneyFlowCard } from './MoneyFlowCard';

type Cadence = 'Daily' | 'Monthly' | 'Yearly';
type TypeFilter = 'All' | 'Income' | 'Expenses';

interface TransactionsTabProps {
  transactions: Transaction[];
  stats?: Stats;
  initialFilter: { category?: CategoryType; review?: boolean } | null;
  onConsumeFilter: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddModal: () => void;
  onMarkNoSpend?: (days: number[]) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map(m => m.slice(0, 3));
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const hour12 = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

/** Counts towards income / spending totals. */
const counted = (t: Transaction) => t.status === 'ok' && !t.excluded && kindOf(t) !== 'transfer';
const spentOf = (txs: Transaction[]) => txs.filter(t => counted(t) && kindOf(t) === 'expense').reduce((a, t) => a - t.amount, 0);
const earnedOf = (txs: Transaction[]) => txs.filter(t => counted(t) && kindOf(t) === 'income').reduce((a, t) => a + t.amount, 0);

const muted = 'text-[#8E8E93]';

export const TransactionsTab: React.FC<TransactionsTabProps> = ({ transactions, initialFilter, onConsumeFilter, onSelectTransaction, onOpenAddModal }) => {
  const [cadence, setCadence] = useState<Cadence>('Monthly');
  const [cursor, setCursor] = useState<Date>(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate()));
  const [type, setType] = useState<TypeFilter>('All');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryType | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const picked = scrub ?? pinned;

  // Arriving from Insights with a category tapped
  useEffect(() => {
    if (initialFilter?.category) setCategory(initialFilter.category);
    if (initialFilter) onConsumeFilter();
  }, [initialFilter, onConsumeFilter]);

  // A different period means a different set of bars
  useEffect(() => {
    setPinned(null);
    setScrub(null);
  }, [cadence, cursor]);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const d = cursor.getDate();

  const inPeriod = (t: Transaction) =>
    t.status !== 'deleted' && (cadence === 'Monthly' ? t.date.startsWith(`${y}-${pad(m + 1)}`) : cadence === 'Daily' ? t.date === isoOf(cursor) : t.date.startsWith(`${y}-`));
  const period = useMemo(() => transactions.filter(inPeriod), [transactions, cadence, cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- the bars ---- */
  const { bars, ticks, summary } = useMemo(() => {
    const cur = TODAY.getFullYear() * 12 + TODAY.getMonth();
    let list: FlowBar[] = [];
    let tk: { index: number; text: string }[] = [];
    let title = '';

    if (cadence === 'Monthly') {
      const n = daysIn(y, m);
      list = Array.from({ length: n }, (_, i) => {
        const day = period.filter(t => Number(t.date.slice(8)) === i + 1);
        return { label: `${i + 1} ${MON[m]}`, amount: spentOf(day), count: day.length, future: `${y}-${pad(m + 1)}-${pad(i + 1)}` > TODAY_ISO };
      });
      const mid = y * 12 + m === cur ? TODAY.getDate() - 1 : 19;
      const raw = [0, 9, mid, n - 1];
      const idx = raw.filter((v, i) => raw.indexOf(v) === i).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] >= 4 || v === n - 1);
      tk = idx.map(i => ({ index: i, text: `${i + 1} ${MON[m]}` }));
      title = `${MONTHS[m]} ${y}`;
    } else if (cadence === 'Daily') {
      list = Array.from({ length: 24 }, (_, h) => {
        const hourTxs = period.filter(t => Number(t.time.slice(0, 2)) === h);
        return { label: hour12(h), amount: spentOf(hourTxs), count: hourTxs.length };
      });
      tk = [0, 6, 12, 18].map(i => ({ index: i, text: hour12(i) }));
      title = `${d} ${MON[m]}`;
    } else {
      list = Array.from({ length: 12 }, (_, mo) => {
        const monthTxs = period.filter(t => Number(t.date.slice(5, 7)) === mo + 1);
        return { label: MONTHS[mo], amount: spentOf(monthTxs), count: monthTxs.length, future: y * 12 + mo > cur };
      });
      tk = [0, 3, 6, 9, 11].map(i => ({ index: i, text: MON[i] }));
      title = String(y);
    }
    return { bars: list, ticks: tk, summary: { label: title, amount: spentOf(period), count: period.length } };
  }, [cadence, period, y, m, d]);

  const income = earnedOf(period);
  const expenses = spentOf(period);
  const net = income - expenses;

  /* ---- the list ---- */
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      period.filter(t => {
        const k = kindOf(t);
        if (type === 'Income' && k !== 'income') return false;
        if (type === 'Expenses' && k !== 'expense') return false;
        if (category && t.category !== category) return false;
        if (picked !== null) {
          const idx = cadence === 'Monthly' ? Number(t.date.slice(8)) - 1 : cadence === 'Daily' ? Number(t.time.slice(0, 2)) : Number(t.date.slice(5, 7)) - 1;
          if (idx !== picked) return false;
        }
        if (q) {
          const hay = [t.title, t.category, t.note, t.said, t.paymentMethod, ACCOUNTS[t.account].name, String(Math.abs(t.amount))].join(' ').toLowerCase();
          return hay.includes(q);
        }
        return true;
      }),
    [period, type, category, picked, q, cadence],
  );

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    visible.forEach(t => byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]));
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, txs]) => [date, [...txs].sort((a, b) => b.time.localeCompare(a.time))] as const);
  }, [visible]);

  const quick = useMemo(() => {
    const seen = new Map<string, number>();
    transactions.filter(t => t.status === 'ok').forEach(t => seen.set(t.title, (seen.get(t.title) ?? 0) + 1));
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([title]) => title);
  }, [transactions]);

  /* ---- moving between periods ---- */
  const step = (dir: -1 | 1) =>
    setCursor(c => (cadence === 'Monthly' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : cadence === 'Daily' ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir) : new Date(c.getFullYear() + dir, c.getMonth(), 1)));
  const nextStart = cadence === 'Monthly' ? new Date(y, m + 1, 1) : cadence === 'Daily' ? new Date(y, m, d + 1) : new Date(y + 1, 0, 1);
  const atEnd = isoOf(nextStart) > TODAY_ISO;
  const heading = cadence === 'Monthly' ? `${MONTHS[m]} ${y}` : cadence === 'Daily' ? `${dayLabel(isoOf(cursor))} ${y}` : String(y);

  return (
    <div className="space-y-3.5 pb-8 animate-fadeIn">
      {/* Search */}
      <div className="space-y-1.5 pt-0.5">
        <div className="relative">
          <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${muted}`}>
            <span className="material-symbols-outlined text-[19px]">search</span>
          </div>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search merchant, description, or amount..."
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl text-[14px] text-black dark:text-white placeholder-[#8E8E93] focus:outline-hidden focus:ring-2 focus:ring-[#06C755]/30 transition shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          />
          {query && (
            <button onClick={() => setQuery('')} className={`absolute inset-y-0 right-0 pr-3 flex items-center ${muted}`} aria-label="Clear search">
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>
        {!query && quick.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] px-0.5">
            <span className={`${muted} font-medium shrink-0`}>Quick:</span>
            {quick.map(tag => (
              <button key={tag} onClick={() => setQuery(tag)} className="px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white shrink-0 transition active:scale-95 shadow-2xs">
                {tag}
              </button>
            ))}
          </div>
        )}
        {query && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/40 border border-[#06C755]/20 text-[12px] text-[#006e2b] dark:text-emerald-300 animate-fadeIn">
            <span className="truncate">
              Found <strong>{visible.length}</strong> {visible.length === 1 ? 'transaction' : 'transactions'} matching “<strong>{query}</strong>”
            </span>
            <button onClick={() => setQuery('')} className="font-bold underline text-[11px] text-[#06C755] shrink-0 ml-2">
              Clear
            </button>
          </div>
        )}
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
      </div>

      {/* Daily | Monthly | Yearly */}
      <div className="flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-neutral-800 rounded-xl max-w-sm mx-auto shadow-inner">
        {(['Daily', 'Monthly', 'Yearly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setCadence(tab)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-semibold transition-all ${
              cadence === tab ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs' : `${muted} hover:text-black dark:hover:text-white`
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
        <button onClick={() => step(-1)} className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-neutral-700 dark:text-neutral-200 active:scale-95 transition" aria-label="Earlier">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        <div className="flex items-center gap-1.5 font-bold text-[17px] text-black dark:text-white tracking-tight">
          <span>{heading}</span>
          <span className={`material-symbols-outlined text-[18px] ${muted}`}>calendar_today</span>
        </div>
        <button
          onClick={() => step(1)}
          disabled={atEnd}
          className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-30 active:scale-95 transition"
          aria-label="Later"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      <MoneyFlowCard bars={bars} summary={summary} ticks={ticks} pinned={pinned} onPin={setPinned} onScrub={setScrub} />

      {/* Income / Expenses / Net */}
      <section className="bg-white dark:bg-neutral-900 rounded-[20px] p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="grid grid-cols-3 divide-x divide-[#E5E5EA] dark:divide-neutral-800 text-center">
          <div className="px-1 flex flex-col items-center">
            <span className={`text-[10px] font-semibold ${muted} uppercase tracking-wider`}>INCOME</span>
            <span className="money text-[17px] font-bold text-[#06C755] mt-0.5 tracking-tight tabular-nums">+{baht(income)}</span>
          </div>
          <div className="px-1 flex flex-col items-center">
            <span className={`text-[10px] font-semibold ${muted} uppercase tracking-wider`}>EXPENSES</span>
            <span className="money text-[17px] font-bold text-[#FF3B30] mt-0.5 tracking-tight tabular-nums">−{baht(expenses)}</span>
          </div>
          <div className="px-1 flex flex-col items-center">
            <span className={`text-[10px] font-semibold ${muted} uppercase tracking-wider`}>NET FLOW</span>
            <span className={`money text-[17px] font-bold mt-0.5 tracking-tight tabular-nums ${net >= 0 ? 'text-[#06C755]' : 'text-[#FF3B30]'}`}>
              {net >= 0 ? '+' : '−'}
              {baht(net)}
            </span>
          </div>
        </div>
      </section>

      {/* All | Income | Expenses  +  Add */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-neutral-900 rounded-xl border border-black/5 dark:border-white/5 shadow-xs flex-1">
          {(['All', 'Income', 'Expenses'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setType(tab)}
              className={`flex-1 py-1 px-3 rounded-lg text-[13px] font-medium transition-all ${
                type === tab ? 'bg-[#F2F2F7] dark:bg-neutral-800 text-black dark:text-white font-semibold shadow-xs' : `${muted} hover:text-black dark:hover:text-white`
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <button onClick={onOpenAddModal} className="h-9 px-3 bg-[#06C755] hover:bg-[#05B34C] text-white rounded-xl flex items-center gap-1 text-[13px] font-semibold shadow-xs active:scale-95 transition shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add</span>
        </button>
      </div>

      {/* The list, grouped by day */}
      <div className="space-y-4 pt-1">
        {groups.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center border border-black/5 dark:border-white/5">
            <span className={`material-symbols-outlined text-4xl ${muted} mb-2`}>search_off</span>
            <p className="text-[15px] font-medium text-black dark:text-white">No transactions found</p>
            <p className={`text-[13px] ${muted} mt-1`}>Try another period, filter or word</p>
          </div>
        ) : (
          groups.map(([date, txs]) => {
            const spent = spentOf(txs);
            const inc = earnedOf(txs);
            const dayNet = inc - spent;
            const [gy, gm, gd] = date.split('-').map(Number);
            return (
              <div key={date} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className={`text-[12px] font-semibold ${muted} uppercase tracking-wider`}>
                    {gd} {MONTHS[gm - 1]} {gy}
                  </span>
                  <span className={`money text-[12px] font-medium ${inc > 0 && dayNet > 0 ? 'text-[#06C755]' : muted}`}>
                    {inc > 0 ? `Net ${dayNet >= 0 ? '+' : '−'}${baht(dayNet)}` : `Spent ${baht(spent)} · ${txs.length} ${txs.length === 1 ? 'transaction' : 'transactions'}`}
                  </span>
                </div>
                <div className="bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800">
                  {txs.map(tx => {
                    const isIncome = kindOf(tx) === 'income';
                    return (
                      <div key={tx.id} onClick={() => onSelectTransaction(tx)} className="min-h-[56px] px-4 py-3 flex items-center justify-between active:bg-[#F2F2F7] dark:active:bg-neutral-800 transition cursor-pointer group">
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryIcon category={tx.category} isIncome={isIncome} />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[15px] font-semibold text-black dark:text-white truncate leading-tight">{tx.title}</span>
                              {tx.verifiedFromSlip && (
                                <span className="material-symbols-outlined text-[14px] text-[#06C755] shrink-0" title="Verified from e-Slip">
                                  check_circle
                                </span>
                              )}
                              {tx.isRecurring && <span className="material-symbols-outlined text-[14px] text-[#3055C6] dark:text-[#6C8CFF] shrink-0">event_repeat</span>}
                              {tx.status === 'review' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF3DC] text-[#9A5B00] shrink-0">Review</span>}
                            </div>
                            <span className={`text-[12px] ${muted} mt-0.5`}>
                              {tx.category} · {time12(tx.time)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <span className={`money text-[15px] font-semibold tracking-tight tabular-nums ${isIncome ? 'text-[#06C755]' : 'text-[#1C1C1E] dark:text-neutral-100'}`}>
                            {isIncome ? '+' : '−'}
                            {baht(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
