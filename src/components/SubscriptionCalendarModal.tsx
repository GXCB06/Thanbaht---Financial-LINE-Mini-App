import React from 'react';
import { SubscriptionItem } from '../types/finance';
import { SubscriptionView } from './SubscriptionView';

interface SubscriptionCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions?: SubscriptionItem[];
  onAddSubscription?: (sub: SubscriptionItem) => void;
}

export const SubscriptionCalendarModal: React.FC<SubscriptionCalendarModalProps> = ({
  isOpen,
  onClose,
  subscriptions,
  onAddSubscription
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn p-0 sm:p-4">
      {/* Click outside backdrop to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md bg-[#F2F2F7] dark:bg-[#121212] rounded-t-[32px] sm:rounded-[32px] max-h-[92%] flex flex-col shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden animate-slideUp">
        {/* Top Header Bar */}
        <div className="p-4 pb-2 bg-white dark:bg-neutral-900 border-b border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-2 sm:hidden" />
          
          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <span className="text-[17px] font-bold text-black dark:text-white">
              Subscriptions & Renewals
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-black dark:hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
          <SubscriptionView onClose={onClose} subscriptions={subscriptions} onAddSubscription={onAddSubscription} />
        </div>
      </div>
    </div>
  );
};
