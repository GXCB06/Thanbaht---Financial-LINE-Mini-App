import React from 'react';
import { AccountId, TransactionSource } from '../types/finance';
import { ACCOUNTS } from '../lib/categories';

export const BankBadge: React.FC<{ account: AccountId; className?: string }> = ({ account, className = '' }) => {
  const a = ACCOUNTS[account];
  return (
    <span
      title={a.name}
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-[5px] text-[9px] font-bold leading-none shrink-0 ${className}`}
      style={{ background: a.bg, color: a.fg }}
    >
      {a.short}
    </span>
  );
};

const SOURCE: Record<TransactionSource, { icon: string; label: string }> = {
  slip: { icon: 'receipt_long', label: 'From slip' },
  voice: { icon: 'mic', label: 'From voice note' },
  text: { icon: 'chat', label: 'Typed in chat' },
  manual: { icon: 'edit', label: 'Added by hand' },
};

export const SourceIcon: React.FC<{ source: TransactionSource }> = ({ source }) => (
  <span className="material-symbols-outlined text-[14px] text-[#6E6E73] dark:text-neutral-400 shrink-0" title={SOURCE[source].label}>
    {SOURCE[source].icon}
  </span>
);

export const sourceLabel = (s: TransactionSource) => SOURCE[s].label;
