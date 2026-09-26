import React, { useState } from 'react';
import { Transaction } from '../types/finance';

interface TransactionDetailViewProps {
  transaction: Transaction;
  onBack: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onViewOriginalInLine: (tx: Transaction) => void;
}

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
  transaction,
  onBack,
  onEdit,
  onDelete,
  onViewOriginalInLine
}) => {
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isIncome = transaction.amount > 0;
  const absAmount = Math.abs(transaction.amount);

  return (
    <div className="space-y-4 pb-12 animate-slideIn">
      {/* Top Navigation */}
      <div className="flex items-center justify-between py-1 -mx-1">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[17px] text-[#007AFF] hover:opacity-75 active:opacity-50 transition"
          aria-label="Back to transactions"
        >
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
          <span>Transactions</span>
        </button>

        <button
          onClick={() => onEdit(transaction)}
          className="w-9 h-9 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shadow-xs active:scale-95 transition"
          aria-label="More options"
        >
          <span className="material-symbols-outlined text-[20px]">more_horiz</span>
        </button>
      </div>

      {/* Hero Transaction Header */}
      <div className="text-center pt-2 pb-3 space-y-1">
        <span className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider block">
          {isIncome ? 'INCOME' : 'EXPENSE'}
        </span>

        <h1
          className={`text-[46px] font-bold tracking-tight font-sans leading-none tabular-nums ${
            isIncome ? 'text-[#06C755]' : 'text-black dark:text-white'
          }`}
        >
          {isIncome ? `+฿${absAmount.toLocaleString()}` : `−฿${absAmount.toLocaleString()}`}
        </h1>

        <h2 className="text-[19px] font-semibold text-black dark:text-white pt-1">
          {transaction.title}
        </h2>

        <p className="text-[13px] text-[#8E8E93]">
          {transaction.category} · {transaction.date.split('-')[2]} Sep · {transaction.time}
        </p>

        {/* Verified & Recurring Badges */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
          {transaction.verifiedFromSlip && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F9EE] text-[#006e2b] text-[12px] font-semibold border border-[#06C755]/20 shadow-xs">
              <span className="material-symbols-outlined text-[15px] text-[#06C755]">check</span>
              <span>Verified from slip</span>
            </div>
          )}
          {transaction.isRecurring && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#3055C6] dark:bg-blue-950/40 dark:text-blue-300 text-[12px] font-semibold border border-blue-200 dark:border-blue-800 shadow-xs">
              <span className="material-symbols-outlined text-[15px]">event_repeat</span>
              <span>{transaction.recurringLabel || 'Monthly Subscription'}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: TRANSACTION DETAILS */}
      <div className="space-y-1.5">
        <span className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1">
          TRANSACTION DETAILS
        </span>

        <div className="bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800">
          {/* Category */}
          <div
            onClick={() => onEdit(transaction)}
            className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition"
          >
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Category</span>
            <div className="flex items-center gap-1">
              <span className="text-[14px] font-medium text-black dark:text-white">
                {transaction.category}
              </span>
              <span className="text-[#C7C7CC] text-[15px]">›</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Payment</span>
            <span className="text-[14px] font-medium text-black dark:text-white">
              {transaction.paymentMethod}
            </span>
          </div>

          {/* Date & Time */}
          <div className="px-4 py-3.5 flex items-center justify-between">
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Date &amp; Time</span>
            <span className="text-[14px] font-medium text-black dark:text-white">
              {transaction.date.split('-')[2]} Sep 2026 · {transaction.time.replace(/ (AM|PM)/, '')}
            </span>
          </div>

          {/* Recurring Schedule Row */}
          {transaction.isRecurring && (
            <div className="px-4 py-3.5 flex items-center justify-between">
              <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Recurring Schedule</span>
              <span className="text-[13px] font-semibold text-black dark:text-white capitalize flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#06C755]">autorenew</span>
                <span>{transaction.recurringFrequency || 'Monthly'} (Day {transaction.billingDay || 25})</span>
              </span>
            </div>
          )}

          {/* Optional Expanded Details */}
          {showMoreDetails && (
            <>
              {transaction.note && (
                <div className="px-4 py-3.5 flex items-start justify-between gap-4">
                  <span className="text-[14px] text-neutral-600 dark:text-neutral-400 shrink-0">Note</span>
                  <span className="text-[14px] text-right font-medium text-black dark:text-white">
                    {transaction.note}
                  </span>
                </div>
              )}
              {transaction.slip?.refNo && (
                <div className="px-4 py-3.5 flex items-center justify-between">
                  <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Bank Ref</span>
                  <span className="text-[13px] font-mono text-neutral-700 dark:text-neutral-300">
                    {transaction.slip.refNo}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* More Details Toggle */}
        <div className="px-1 pt-0.5">
          <button
            onClick={() => setShowMoreDetails(!showMoreDetails)}
            className="text-[12px] font-medium text-[#8E8E93] hover:text-black dark:hover:text-white flex items-center gap-1 transition"
          >
            <span>{showMoreDetails ? 'Less details ▴' : 'More details ▾'}</span>
          </button>
        </div>
      </div>

      {/* SECTION: SOURCE RECEIPT (Authentic Thai Bank e-Slip) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider">
            SOURCE RECEIPT
          </span>
          <span className="text-[12px] text-[#8E8E93] font-mono">
            Ref {transaction.slip?.refNo ? transaction.slip.refNo.slice(-6) : '882194'}
          </span>
        </div>

        {/* Authentic Thai Bank e-Slip Container */}
        <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/5 dark:border-white/10 space-y-4">
          {/* Slip Outer Card with green accent header */}
          <div className="rounded-xl border border-[#06C755]/20 bg-[#FBFDFB] dark:bg-neutral-800/80 p-4 relative overflow-hidden">
            {/* Top Slip Brand Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-700/50">
              <div className="flex items-center gap-2">
                {/* Bank Circular Icon */}
                <div className="w-8 h-8 rounded-full bg-[#00A950] text-white flex items-center justify-center font-bold text-[12px] shadow-xs">
                  KB
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-neutral-900 dark:text-white leading-tight">
                    {transaction.slip?.slipType || 'K PLUS · e-Slip'}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E8F9EE] text-[#006e2b] text-[11px] font-medium border border-[#06C755]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06C755]"></span>
                <span>{transaction.slip?.status || 'โอนเงินสำเร็จ'}</span>
                <span className="material-symbols-outlined text-[12px] ml-0.5">search</span>
              </div>
            </div>

            {/* Slip Details Body */}
            <div className="pt-3.5 space-y-2.5">
              {/* Amount */}
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-neutral-500">จำนวนเงิน</span>
                <span className="text-[20px] font-bold text-neutral-900 dark:text-white font-sans tabular-nums">
                  ฿{(transaction.slip?.amount || absAmount).toFixed(2)}
                </span>
              </div>

              {/* From */}
              <div className="flex items-start justify-between">
                <span className="text-[13px] text-neutral-500">จาก</span>
                <div className="text-right">
                  <span className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200 block">
                    {transaction.slip?.senderName || 'นาย ธัญญ์พิสิษฐ์ โ.'}
                  </span>
                </div>
              </div>

              {/* To */}
              <div className="flex items-start justify-between">
                <span className="text-[13px] text-neutral-500">ไปยัง</span>
                <div className="text-right">
                  <span className="text-[13px] font-medium text-neutral-900 dark:text-white block">
                    {transaction.slip?.recipientName || transaction.title}
                  </span>
                  <span className="text-[11px] text-neutral-500 block">
                    PromptPay {transaction.slip?.recipientPromptPay || 'xxx-xxx-8819'}
                  </span>
                </div>
              </div>

              {/* Hairline Reference & Date */}
              <div className="pt-3 mt-1 border-t border-dashed border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                <span>{transaction.slip?.refNo || 'KB-20260923-882194'}</span>
                <span>{transaction.slip?.dateTimeStr || '23/09/69 12:42'}</span>
              </div>
            </div>
          </div>

          {/* Green CTA Button: View original in LINE */}
          <button
            onClick={() => onViewOriginalInLine(transaction)}
            className="w-full py-3 px-4 rounded-xl bg-[#06C755] hover:bg-[#05B34C] text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
          >
            <span className="text-base">💬</span>
            <span>View original in LINE →</span>
          </button>
        </div>
      </div>

      {/* SECTION: ACTIONS */}
      <div className="bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800">
        <button
          onClick={() => onEdit(transaction)}
          className="w-full px-4 py-3.5 flex items-center justify-between text-left text-[15px] font-medium text-[#007AFF] hover:bg-neutral-50 dark:hover:bg-neutral-800 active:bg-neutral-100 transition"
        >
          <span>Edit Transaction</span>
          <span className="text-[#C7C7CC] text-[15px]">›</span>
        </button>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-4 py-3.5 text-left text-[15px] font-medium text-[#FF3B30] hover:bg-red-50 dark:hover:bg-red-950/20 active:bg-red-100 transition"
        >
          Delete Transaction
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
            <h3 className="text-[17px] font-bold text-black dark:text-white">
              Delete Transaction?
            </h3>
            <p className="text-[13px] text-neutral-600 dark:text-neutral-300">
              Are you sure you want to delete &ldquo;{transaction.title}&rdquo;? This will update your monthly balance and trajectory.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(transaction.id);
                  onBack();
                }}
                className="py-2.5 rounded-xl bg-[#FF3B30] text-white font-semibold text-[13px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
