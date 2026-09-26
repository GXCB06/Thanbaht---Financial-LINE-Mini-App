import React, { useState } from 'react';
import { Transaction } from '../types/finance';

interface ReviewTabProps {
  transactions: Transaction[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddMoment: () => void;
  onOpenSubscriptionCalendar?: () => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({
  transactions,
  onSelectTransaction,
  onOpenAddMoment,
  onOpenSubscriptionCalendar
}) => {
  const [reviewItems, setReviewItems] = useState([
    {
      id: 'rev-1',
      title: 'AIS 5G Fiber & Mobile',
      amount: 1190,
      category: 'Bills & Utilities',
      reason: 'Confirm monthly recurring auto-payment',
      date: '20 Sep 2026',
      icon: 'receipt_long',
      iconBg: 'bg-blue-500'
    },
    {
      id: 'rev-2',
      title: 'Sukishi Charcoal Grill',
      amount: 1280,
      category: 'Food & Dining',
      reason: 'Review e-Slip VAT & split with 2 friends',
      date: '18 Sep 2026',
      icon: 'restaurant',
      iconBg: 'bg-[#008A3D]'
    },
    {
      id: 'rev-3',
      title: 'Grab Transport',
      amount: 180,
      category: 'Transport',
      reason: 'Uncategorized business trip commute',
      date: '15 Sep 2026',
      icon: 'local_taxi',
      iconBg: 'bg-purple-500'
    }
  ]);

  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);

  const handleConfirm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmedIds(prev => [...prev, id]);
  };

  const pendingCount = reviewItems.length - confirmedIds.length;

  return (
    <div className="space-y-4 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-black dark:text-white tracking-tight">
              Review
            </h1>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#A05A12] text-white text-[12px] font-bold">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8E8E93] mt-0.5">
            Confirm slips, recurring charges, and notes
          </p>
        </div>

        <button
          onClick={onOpenAddMoment}
          className="h-8 px-3 rounded-full bg-[#008A3D] text-white text-[12px] font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Add</span>
        </button>
      </div>

      {/* Subscription Calendar Quick Access Banner */}
      <div 
        onClick={onOpenSubscriptionCalendar}
        className="p-3.5 bg-gradient-to-r from-[#E8F9EE] to-emerald-50 dark:from-emerald-950/40 dark:to-neutral-900 rounded-[20px] border border-[#008A3D]/25 flex items-center justify-between cursor-pointer hover:shadow-xs transition"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#008A3D] text-white flex items-center justify-center shadow-xs shrink-0">
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-black dark:text-white leading-tight truncate">
              Subscription Renewal Calendar
            </h4>
            <p className="text-[11px] text-[#8E8E93] leading-tight mt-0.5 truncate">
              2 renewals due this week (iCloud+ · YouTube Premium)
            </p>
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-[#008A3D] shrink-0">chevron_right</span>
      </div>

      {/* Review Cards List */}
      <div className="space-y-3">
        {reviewItems.map(item => {
          const isConfirmed = confirmedIds.includes(item.id);

          return (
            <div
              key={item.id}
              className={`p-4 bg-white dark:bg-neutral-900 rounded-[22px] border transition-all ${
                isConfirmed
                  ? 'border-emerald-200 dark:border-emerald-900/50 opacity-60'
                  : 'border-black/[0.04] dark:border-white/[0.06] shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-[12px] text-[#8E8E93] mt-0.5">
                      {item.category} · {item.date}
                    </p>
                  </div>
                </div>

                <span className="text-[16px] font-bold text-black dark:text-white font-sans tabular-nums shrink-0">
                  ฿{item.amount.toLocaleString()}
                </span>
              </div>

              {/* Action reason banner */}
              <div className="mt-3 p-2.5 rounded-xl bg-[#F5F6F5] dark:bg-neutral-800/80 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                  <span className="material-symbols-outlined text-[15px] text-[#008A3D]">info</span>
                  <span className="leading-snug">{item.reason}</span>
                </div>

                {isConfirmed ? (
                  <span className="text-[#008A3D] font-bold flex items-center gap-1 shrink-0 ml-2">
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Confirmed</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => handleConfirm(item.id, e)}
                    className="px-3 py-1 bg-[#008A3D] hover:bg-[#007032] text-white font-semibold rounded-lg shrink-0 ml-2 shadow-xs transition active:scale-95"
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {pendingCount === 0 && (
          <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-[22px] border border-black/5">
            <span className="material-symbols-outlined text-[36px] text-[#008A3D] mb-2">task_alt</span>
            <h3 className="text-[16px] font-bold text-black dark:text-white">All caught up!</h3>
            <p className="text-[13px] text-[#8E8E93] mt-1">
              All bank slips and recurring items have been reviewed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
