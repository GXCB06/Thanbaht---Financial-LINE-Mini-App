import React from 'react';
import { Transaction } from '../types/finance';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge, SourceIcon } from './Badges';
import { TONE_CLASS, signedBaht, toneOf } from '../lib/format';

interface TransactionRowProps {
  tx: Transaction;
  onSelect: (tx: Transaction) => void;
  showDate?: boolean;
}

/** One list row: category tile · name · category · time · bank · source · amount. */
export const TransactionRow: React.FC<TransactionRowProps> = ({ tx, onSelect, showDate }) => {
  const tone = toneOf(tx);
  return (
    <button
      type="button"
      onClick={() => onSelect(tx)}
      className="w-full min-h-[58px] px-4 py-3 flex items-center justify-between gap-3 text-left active:bg-[#F2F2F7] dark:active:bg-neutral-800 transition cursor-pointer group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <CategoryIcon category={tx.category} />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-semibold text-black dark:text-white truncate leading-tight">{tx.title}</span>
            {tx.isRecurring && (
              <span className="material-symbols-outlined text-[14px] text-[#3055C6] dark:text-[#8FA8FF] shrink-0" title="Recurring">
                event_repeat
              </span>
            )}
          </div>
          <span className="text-[12px] text-[#6E6E73] dark:text-neutral-400 mt-0.5 flex items-center gap-1.5 min-w-0 whitespace-nowrap">
            <span className="truncate">{tx.category}</span>
            <span>·</span>
            <span className="tabular-nums">
              {showDate ? `${Number(tx.date.slice(8))} Sep ` : ''}
              {tx.time}
            </span>
            <BankBadge account={tx.account} />
            <SourceIcon source={tx.source} />
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
        <span className={`money text-[15px] font-semibold tracking-tight tabular-nums ${TONE_CLASS[tone]}`}>{signedBaht(tx)}</span>
        {tx.status === 'review' ? (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF3DC] text-[#9A5B00] dark:bg-amber-950/50 dark:text-amber-300">
            Review
          </span>
        ) : tone === 'transfer' ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#6E6E73] dark:bg-neutral-800 dark:text-neutral-400">
            not counted
          </span>
        ) : tx.excluded ? (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#6E6E73] dark:bg-neutral-800 dark:text-neutral-400">
            excluded
          </span>
        ) : null}
      </div>
    </button>
  );
};
