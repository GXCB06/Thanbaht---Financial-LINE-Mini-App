import React, { useState, useMemo } from 'react';
import { Transaction } from '../types/finance';
import { CategoryIcon } from './CategoryIcon';
import { MONTHLY_SPEND_DAYS } from '../data/mockData';

interface TransactionsTabProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenAddModal: () => void;
}

export const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  onSelectTransaction,
  selectedMonth,
  onSelectMonth,
  onOpenAddModal
}) => {
  const [viewCadence, setViewCadence] = useState<'Daily' | 'Monthly' | 'Yearly'>('Monthly');
  const [filterType, setFilterType] = useState<'All' | 'Income' | 'Expenses'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(23);

  // Month navigation
  const monthList = ['August 2026', 'September 2026', 'October 2026'];
  const currentMonthIdx = monthList.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (currentMonthIdx > 0) {
      onSelectMonth(monthList[currentMonthIdx - 1]);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIdx < monthList.length - 1) {
      onSelectMonth(monthList[currentMonthIdx + 1]);
    }
  };

  // Selected day spend info
  const selectedDayInfo = useMemo(() => {
    const found = MONTHLY_SPEND_DAYS.find(d => d.day === selectedDayNumber);
    if (found) {
      return {
        dayStr: `${selectedDayNumber} Sep`,
        count: found.txCount,
        amount: found.amount
      };
    }
    return {
      dayStr: `${selectedDayNumber} Sep`,
      count: 0,
      amount: 0
    };
  }, [selectedDayNumber]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Type filter
      if (filterType === 'Income' && tx.amount <= 0) return false;
      if (filterType === 'Expenses' && tx.amount >= 0) return false;

      // Search query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = tx.title.toLowerCase().includes(q);
        const matchesCategory = tx.category.toLowerCase().includes(q);
        const matchesNote = tx.note?.toLowerCase().includes(q);
        const matchesPayment = tx.paymentMethod.toLowerCase().includes(q);
        const matchesAmount = Math.abs(tx.amount).toString().includes(q);
        return matchesTitle || matchesCategory || matchesNote || matchesPayment || matchesAmount;
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [dateStr: string]: Transaction[] } = {};
    filteredTransactions.forEach(tx => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }
      groups[tx.date].push(tx);
    });

    // Sort dates descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  // Helper to format date header
  const formatDateHeader = (dateStr: string, txs: Transaction[]) => {
    const [year, month, day] = dateStr.split('-');
    const dayNum = parseInt(day, 10);
    const monthsThaiEng = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const monthName = monthsThaiEng[parseInt(month, 10) - 1];

    const net = txs.reduce((sum, tx) => sum + tx.amount, 0);
    const spentOnly = txs.filter(tx => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    let summaryText = '';
    if (dayNum === 23) {
      summaryText = `Spent ฿${spentOnly.toLocaleString()} · ${txs.length} transactions`;
    } else if (net > 0) {
      summaryText = `Net +฿${net.toLocaleString()}`;
    } else {
      summaryText = `Spent ฿${spentOnly.toLocaleString()} · ${txs.length} transactions`;
    }

    return {
      title: `${dayNum} ${monthName} ${year}`,
      summary: summaryText,
      isPositiveNet: net > 0
    };
  };

  return (
    <div className="space-y-3 pb-8 animate-fadeIn">
      {/* Top Search Bar */}
      <div className="space-y-1.5 pt-0.5">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8E8E93]">
            <span className="material-symbols-outlined text-[19px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search merchant, description, or amount..."
            className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl text-[14px] text-black dark:text-white placeholder-[#8E8E93] focus:outline-hidden focus:ring-2 focus:ring-[#06C755]/30 transition shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8E8E93] hover:text-black dark:hover:text-white transition"
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
        </div>

        {/* Quick Search Suggestions when empty */}
        {!searchQuery && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px] px-0.5">
            <span className="text-[#8E8E93] font-medium shrink-0">Quick:</span>
            {['Starbucks', '7-Eleven', 'Grab', 'BTS', 'AIS', 'Netflix'].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white shrink-0 transition active:scale-95 shadow-2xs"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Active Search Result Pill Banner */}
        {searchQuery && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/40 border border-[#06C755]/20 text-[12px] text-[#006e2b] dark:text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-[#06C755] shrink-0">filter_list</span>
              <span className="truncate">
                Found <strong>{filteredTransactions.length}</strong> {filteredTransactions.length === 1 ? 'transaction' : 'transactions'} matching "<strong>{searchQuery}</strong>"
              </span>
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="font-bold underline text-[11px] text-[#06C755] shrink-0 ml-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Top View Selector: Daily | Monthly | Yearly */}
      <div className="flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-neutral-800 rounded-xl max-w-sm mx-auto shadow-inner">
        {(['Daily', 'Monthly', 'Yearly'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setViewCadence(tab)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-[13px] font-semibold transition-all ${
              viewCadence === tab
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Month Navigator Header */}
      <div className="flex items-center justify-between px-1 pt-1 pb-0.5">
        <button
          onClick={handlePrevMonth}
          disabled={currentMonthIdx <= 0}
          className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-30 active:scale-95 transition"
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>

        <div className="flex items-center gap-1.5 font-bold text-[17px] text-black dark:text-white tracking-tight">
          <span>{selectedMonth}</span>
          <span className="material-symbols-outlined text-[18px] text-[#8E8E93]">calendar_today</span>
        </div>

        <button
          onClick={handleNextMonth}
          disabled={currentMonthIdx >= monthList.length - 1}
          className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-black/5 dark:border-white/5 flex items-center justify-center text-neutral-700 dark:text-neutral-200 disabled:opacity-30 active:scale-95 transition"
          aria-label="Next month"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>

      {/* Money Flow Card with Interactive Bar Chart */}
      <section className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#06C755]"></span>
            <span className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              MONEY FLOW
            </span>
          </div>
          <span className="text-[11px] font-medium text-[#8E8E93]">
            Tap a bar to inspect
          </span>
        </div>

        {/* Selected Day Inspect Pill Banner */}
        <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800/60 mb-3 transition-all">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-black dark:text-white">
            <span>{selectedDayInfo.dayStr}</span>
            <span className="text-[#8E8E93] font-normal">·</span>
            <span className="text-[#8E8E93] font-normal text-[13px]">
              {selectedDayInfo.count} Transactions
            </span>
          </div>
          <span className="text-[16px] font-bold text-black dark:text-white font-sans tabular-nums">
            ฿{selectedDayInfo.amount.toLocaleString()}
          </span>
        </div>

        {/* Interactive Month Bar Chart */}
        <div className="h-28 flex items-end justify-between gap-1 pt-1 pb-1">
          {MONTHLY_SPEND_DAYS.map(item => {
            const isSelected = item.day === selectedDayNumber;
            return (
              <button
                key={item.day}
                onClick={() => setSelectedDayNumber(item.day)}
                title={`Day ${item.day}: ฿${item.amount} (${item.txCount} txs)`}
                className="flex-1 flex flex-col items-center justify-end h-full group focus:outline-hidden"
              >
                <div
                  className={`w-full rounded-t-[3px] transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#06C755] shadow-xs'
                      : 'bg-[#E5E5EA] dark:bg-neutral-700 group-hover:bg-[#06C755]/50'
                  }`}
                  style={{ height: `${Math.max(12, item.height)}%` }}
                ></div>
                {/* Active dot marker */}
                <div className="h-2 w-full flex items-center justify-center mt-1">
                  {isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#06C755]"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Date Markers on bottom */}
        <div className="flex items-center justify-between text-[11px] font-medium text-[#8E8E93] pt-1 px-1">
          <span>1 Sep</span>
          <span>10 Sep</span>
          <span className={selectedDayNumber === 23 ? 'text-[#06C755] font-semibold' : ''}>
            23 Sep
          </span>
          <span>30 Sep</span>
        </div>
      </section>

      {/* 3-Column Financial Summary Tile */}
      <section className="bg-white dark:bg-neutral-900 rounded-[20px] p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05]">
        <div className="grid grid-cols-3 divide-x divide-[#E5E5EA] dark:divide-neutral-800 text-center">
          {/* Income */}
          <div className="px-1 flex flex-col items-center">
            <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              INCOME
            </span>
            <span className="text-[17px] font-bold text-[#06C755] mt-0.5 tracking-tight font-sans tabular-nums">
              +฿32,400
            </span>
          </div>

          {/* Expenses */}
          <div className="px-1 flex flex-col items-center">
            <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              EXPENSES
            </span>
            <span className="text-[17px] font-bold text-[#FF3B30] mt-0.5 tracking-tight font-sans tabular-nums">
              −฿18,920
            </span>
          </div>

          {/* Net Flow */}
          <div className="px-1 flex flex-col items-center">
            <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
              NET FLOW
            </span>
            <span className="text-[17px] font-bold text-[#06C755] mt-0.5 tracking-tight font-sans tabular-nums">
              +฿13,480
            </span>
          </div>
        </div>
      </section>

      {/* Filter Segmented Pills & Quick Add Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-neutral-900 rounded-xl border border-black/5 dark:border-white/5 shadow-xs flex-1">
          {(['All', 'Income', 'Expenses'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`flex-1 py-1 px-3 rounded-lg text-[13px] font-medium transition-all ${
                filterType === tab
                  ? 'bg-[#F2F2F7] dark:bg-neutral-800 text-black dark:text-white font-semibold shadow-xs'
                  : 'text-[#8E8E93] hover:text-black dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Quick Add Button */}
        <button
          onClick={onOpenAddModal}
          className="h-9 px-3 bg-[#06C755] hover:bg-[#05B34C] text-white rounded-xl flex items-center gap-1 text-[13px] font-semibold shadow-xs active:scale-95 transition shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Add</span>
        </button>
      </div>

      {/* Grouped Transaction List */}
      <div className="space-y-4 pt-1">
        {groupedTransactions.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-8 text-center border border-black/5">
            <span className="material-symbols-outlined text-4xl text-[#8E8E93] mb-2">search_off</span>
            <p className="text-[15px] font-medium text-black dark:text-white">No transactions found</p>
            <p className="text-[13px] text-[#8E8E93] mt-1">Try adjusting your filters or search keywords</p>
          </div>
        ) : (
          groupedTransactions.map(([dateStr, txs]) => {
            const headerInfo = formatDateHeader(dateStr, txs);

            return (
              <div key={dateStr} className="space-y-1.5">
                {/* Date Header Row */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                    {headerInfo.title}
                  </span>
                  <span
                    className={`text-[12px] font-medium ${
                      headerInfo.isPositiveNet
                        ? 'text-[#06C755]'
                        : 'text-[#8E8E93]'
                    }`}
                  >
                    {headerInfo.summary}
                  </span>
                </div>

                {/* Container for date transactions */}
                <div className="bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800">
                  {txs.map(tx => {
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
                              {tx.verifiedFromSlip && (
                                <span className="material-symbols-outlined text-[14px] text-[#06C755] shrink-0" title="Verified from e-Slip">
                                  check_circle
                                </span>
                              )}
                              {tx.isRecurring && (
                                <span className="material-symbols-outlined text-[14px] text-[#3055C6] dark:text-[#6C8CFF] shrink-0" title={`Recurring ${tx.recurringFrequency || 'monthly'}`}>
                                  event_repeat
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] text-[#8E8E93] mt-0.5">
                              {tx.category} · {tx.time} {tx.isRecurring && `· ${tx.recurringLabel || 'Recurring'}`}
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
