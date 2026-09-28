import React, { useState } from 'react';
import { Transaction, CategoryType } from '../types/finance';
import { detectCategoryFromTitle, DetectedCategoryResult } from '../utils/categoryMatcher';
import { EDITABLE_CATEGORIES } from '../lib/categories';

interface EditTransactionModalProps {
  transaction: Transaction;
  onSave: (updated: Transaction) => void;
  onClose: () => void;
}

const CATEGORIES: CategoryType[] = EDITABLE_CATEGORIES;

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onSave,
  onClose
}) => {
  const [title, setTitle] = useState(transaction.title);
  const [amount, setAmount] = useState(Math.abs(transaction.amount).toString());
  const [isIncome, setIsIncome] = useState(transaction.amount > 0);
  const [category, setCategory] = useState<CategoryType>(transaction.category);
  const [paymentMethod, setPaymentMethod] = useState(transaction.paymentMethod);
  const [note, setNote] = useState(transaction.note || '');
  const [isRecurring, setIsRecurring] = useState(transaction.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'weekly' | 'yearly'>(
    transaction.recurringFrequency || 'monthly'
  );
  const [billingDay, setBillingDay] = useState(transaction.billingDay || 25);

  const [detectedCategory, setDetectedCategory] = useState<DetectedCategoryResult | null>(() =>
    detectCategoryFromTitle(transaction.title)
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    const match = detectCategoryFromTitle(newTitle);
    setDetectedCategory(match);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount) || 0;
    const finalAmount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

    onSave({
      ...transaction,
      title,
      category,
      amount: finalAmount,
      paymentMethod,
      note,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      billingDay: isRecurring ? billingDay : undefined,
      recurringLabel: isRecurring
        ? category === 'Bills & Utilities'
          ? 'Monthly Bill'
          : 'Monthly Subscription'
        : undefined
    });
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-[22px] max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4 max-h-[90%] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[17px] font-bold text-black dark:text-white">
            Edit Transaction
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-[14px]">
          {/* Income vs Expense Toggle */}
          <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
            <button
              type="button"
              onClick={() => setIsIncome(false)}
              className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition ${
                !isIncome
                  ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              Expense (−)
            </button>
            <button
              type="button"
              onClick={() => setIsIncome(true)}
              className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition ${
                isIncome
                  ? 'bg-white dark:bg-neutral-900 text-[#06C755] shadow-xs'
                  : 'text-neutral-500'
              }`}
            >
              Income (+)
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
              Amount (THB)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-lg font-bold text-neutral-400">
                ฿
              </span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-lg font-bold text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Title / Merchant
              </label>
              {detectedCategory && (
                <span className="text-[10px] font-semibold text-[#06C755] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                  <span>Matched "{detectedCategory.matchedKeyword}"</span>
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
            />

            {/* Category Suggestion Banner */}
            {detectedCategory && (
              <div className="flex items-center justify-between mt-2 px-2.5 py-1.5 rounded-xl bg-[#E8F9EE] dark:bg-emerald-950/40 border border-[#06C755]/25 text-[11px] text-[#006e2b] dark:text-emerald-300 animate-fadeIn">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-[#06C755] shrink-0">
                    auto_awesome
                  </span>
                  <span className="truncate">
                    Suggested Category: <strong className="font-bold underline decoration-[#06C755]">{detectedCategory.category}</strong>
                  </span>
                </div>
                {category !== detectedCategory.category && (
                  <button
                    type="button"
                    onClick={() => setCategory(detectedCategory.category)}
                    className="text-[11px] font-bold text-[#06C755] hover:underline shrink-0 ml-2"
                  >
                    Apply
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Category
              </label>
              {detectedCategory && category === detectedCategory.category && (
                <span className="text-[10px] text-[#06C755] font-semibold flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  <span>Matches Keyword</span>
                </span>
              )}
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryType)}
              className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Recurring Transaction Toggle Card */}
          <div className="p-3 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl space-y-2.5 border border-black/5 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isRecurring ? 'bg-[#06C755] text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                }`}>
                  <span className="material-symbols-outlined text-[17px]">event_repeat</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold text-black dark:text-white block leading-tight truncate">
                    Recurring Bill / Subscription
                  </span>
                  <span className="text-[11px] text-[#8E8E93] block leading-tight">
                    Monthly repeating charge
                  </span>
                </div>
              </div>

              {/* iOS switch toggle */}
              <button
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out shrink-0 ${
                  isRecurring ? 'bg-[#06C755]' : 'bg-neutral-300 dark:bg-neutral-700'
                }`}
                aria-label="Toggle recurring transaction"
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                    isRecurring ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Expanded Frequency & Billing Cycle Controls */}
            {isRecurring && (
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/80 space-y-2 animate-fadeIn text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#8E8E93] font-medium">Frequency:</span>
                  <div className="flex rounded-lg bg-neutral-200 dark:bg-neutral-700 p-0.5">
                    {(['monthly', 'weekly', 'yearly'] as const).map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() => setRecurringFrequency(freq)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded capitalize transition ${
                          recurringFrequency === freq
                            ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                            : 'text-neutral-500 hover:text-black dark:hover:text-white'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#8E8E93] font-medium">Billing Date:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-neutral-500 text-[11px]">Repeats on day</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={billingDay}
                      onChange={(e) => setBillingDay(parseInt(e.target.value) || 1)}
                      className="w-12 px-2 py-0.5 text-center font-bold font-sans tabular-nums bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-md text-black dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#06C755]"
                    />
                    <span className="text-neutral-500 text-[11px]">of month</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
              Payment Method
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
            />
          </div>

          {/* Note */}
          <div>
            <label className="text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch with team"
              className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
            />
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-semibold text-[13px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#06C755] text-white font-semibold text-[13px] shadow-xs active:scale-95 transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
