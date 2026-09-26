import React, { useState } from 'react';
import { Transaction, CategoryType } from '../types/finance';
import { detectCategoryFromTitle, DetectedCategoryResult } from '../utils/categoryMatcher';

interface AddTransactionModalProps {
  onAdd: (newTx: Transaction) => void;
  onClose: () => void;
}

const CATEGORIES: CategoryType[] = [
  'Food & Dining',
  'Bills & Utilities',
  'Shopping',
  'Transport',
  'Entertainment',
  'Income'
];

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  onAdd,
  onClose
}) => {
  const [mode, setMode] = useState<'manual' | 'slip'>('slip');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [category, setCategory] = useState<CategoryType>('Food & Dining');
  const [paymentMethod, setPaymentMethod] = useState('KBank Transfer');
  const [note, setNote] = useState('');
  
  // Intelligent category suggestion state
  const [detectedCategory, setDetectedCategory] = useState<DetectedCategoryResult | null>(null);
  const [isCategoryManuallyOverridden, setIsCategoryManuallyOverridden] = useState(false);

  // Recurring transaction states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'monthly' | 'weekly' | 'yearly'>('monthly');
  const [billingDay, setBillingDay] = useState(25);

  const quickMerchants = ['Starbucks Cafe', '7-Eleven', 'BTS Skytrain', 'MEA Electric', 'Netflix'];

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    const match = detectCategoryFromTitle(newTitle);
    setDetectedCategory(match);

    if (match && !isCategoryManuallyOverridden) {
      setCategory(match.category);
      if (match.suggestRecurring && !isRecurring) {
        setIsRecurring(true);
      }
    }
  };

  const handleCategorySelect = (newCat: CategoryType) => {
    setCategory(newCat);
    setIsCategoryManuallyOverridden(true);
  };

  // Preset slips to simulate
  const slipPresets = [
    {
      title: 'Netflix & Spotify Family',
      amount: 549,
      category: 'Entertainment' as CategoryType,
      bank: 'K PLUS · e-Slip',
      ref: 'KB-20260924-992104',
      recipientPromptPay: '0105559012349',
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      isRecurring: true,
      recurringFrequency: 'monthly' as const,
      billingDay: 15,
      recurringLabel: 'Monthly Streaming'
    },
    {
      title: 'AIS 5G Fiber & Mobile',
      amount: 1190,
      category: 'Bills & Utilities' as CategoryType,
      bank: 'K PLUS · e-Slip',
      ref: 'KB-20260924-441829',
      recipientPromptPay: '0105536098192',
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      isRecurring: true,
      recurringFrequency: 'monthly' as const,
      billingDay: 1,
      recurringLabel: 'Monthly Internet'
    },
    {
      title: 'Starbucks Siam Square One',
      amount: 195,
      category: 'Food & Dining' as CategoryType,
      bank: 'K PLUS · e-Slip',
      ref: 'KB-20260924-551029',
      recipientPromptPay: '0105541098124',
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      isRecurring: false
    },
    {
      title: 'Sukishi Charcoal Grill',
      amount: 699,
      category: 'Food & Dining' as CategoryType,
      bank: 'K PLUS · e-Slip',
      ref: 'KB-20260924-884102',
      recipientPromptPay: '0105537024190',
      senderName: 'นาย ธัญญ์พิสิษฐ์ โ.',
      isRecurring: false
    }
  ];

  const handleSelectPresetSlip = (preset: typeof slipPresets[0]) => {
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      title: preset.title,
      category: preset.category,
      amount: -preset.amount,
      date: '2026-09-24',
      time: '13:10 PM',
      verifiedFromSlip: true,
      paymentMethod: 'KBank Transfer',
      note: preset.isRecurring ? 'Recurring monthly auto-payment' : 'Auto-scanned from LINE slip upload',
      isRecurring: preset.isRecurring,
      recurringFrequency: preset.recurringFrequency,
      billingDay: preset.billingDay,
      recurringLabel: preset.recurringLabel,
      slip: {
        bankName: 'KBank',
        bankCode: 'KBANK',
        slipType: preset.bank,
        status: 'โอนเงินสำเร็จ',
        amount: preset.amount,
        senderName: preset.senderName,
        recipientName: preset.title,
        recipientPromptPay: preset.recipientPromptPay,
        refNo: preset.ref,
        dateTimeStr: '24/09/69 13:10',
        rawLineMessageId: `msg_${Date.now()}`
      }
    };
    onAdd(newTx);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount) || 0;
    const finalAmount = isIncome ? Math.abs(parsedAmount) : -Math.abs(parsedAmount);

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      title: title.trim() || 'Untitled Transaction',
      category: category,
      amount: finalAmount,
      date: '2026-09-24',
      time: '14:00 PM',
      verifiedFromSlip: false,
      paymentMethod: paymentMethod || 'PromptPay',
      note: note.trim(),
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : undefined,
      billingDay: isRecurring ? billingDay : undefined,
      recurringLabel: isRecurring
        ? category === 'Bills & Utilities'
          ? 'Monthly Bill'
          : 'Monthly Subscription'
        : undefined
    };
    onAdd(newTx);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-neutral-900 rounded-[24px] max-w-sm w-full p-5 shadow-2xl border border-black/10 dark:border-white/10 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-[17px] font-bold text-black dark:text-white">
            Add Record
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab mode toggle */}
        <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            type="button"
            onClick={() => setMode('slip')}
            className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition flex items-center justify-center gap-1.5 ${
              mode === 'slip'
                ? 'bg-white dark:bg-neutral-900 text-[#06C755] shadow-xs'
                : 'text-neutral-500'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">document_scanner</span>
            <span>Scan e-Slip</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-1.5 rounded-lg text-[13px] font-semibold transition flex items-center justify-center gap-1.5 ${
              mode === 'manual'
                ? 'bg-white dark:bg-neutral-900 text-black dark:text-white shadow-xs'
                : 'text-neutral-500'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Manual Entry</span>
          </button>
        </div>

        {mode === 'slip' ? (
          <div className="space-y-3">
            <p className="text-[13px] text-neutral-600 dark:text-neutral-300">
              Select a simulated bank e-slip to test instant OCR parsing and verification:
            </p>

            <div className="space-y-2">
              {slipPresets.map((preset) => (
                <button
                  key={preset.ref}
                  onClick={() => handleSelectPresetSlip(preset)}
                  className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-[#06C755] bg-neutral-50 dark:bg-neutral-800/50 hover:bg-[#E8F9EE]/30 text-left transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#00A950] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                      KB
                    </div>
                    <div>
                      <span className="text-[13px] font-bold text-black dark:text-white block group-hover:text-[#06C755]">
                        {preset.title}
                      </span>
                      <span className="text-[11px] text-[#8E8E93]">
                        {preset.category} · {preset.ref}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[14px] font-bold text-black dark:text-white font-sans tabular-nums block">
                      −฿{preset.amount}
                    </span>
                    <span className="text-[10px] text-[#06C755] font-semibold">
                      Auto-verify
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-[12px] text-neutral-500 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#06C755]">info</span>
              <span>In real LINE Mini App, users simply drop a slip image in chat.</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3 text-[14px]">
            {/* Income vs Expense Toggle */}
            <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
              <button
                type="button"
                onClick={() => setIsIncome(false)}
                className={`flex-1 py-1 rounded-lg text-[12px] font-semibold transition ${
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
                className={`flex-1 py-1 rounded-lg text-[12px] font-semibold transition ${
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
              <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1">
                Amount (THB)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-base font-bold text-neutral-400">
                  ฿
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-base font-bold text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
                />
              </div>
            </div>

            {/* Title / Merchant */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                  Merchant / Item
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
                placeholder="e.g. Starbucks, BTS, MEA ค่าไฟ, 7-11"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#F2F2F7] dark:bg-neutral-800 rounded-xl text-black dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#06C755]"
              />

              {/* Quick Preset Merchant Pills */}
              {!title && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-[#8E8E93] self-center">Try:</span>
                  {quickMerchants.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => handleTitleChange(m)}
                      className="px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[11px] text-neutral-600 dark:text-neutral-300 transition"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}

              {/* Real-time Category Suggestion Banner */}
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
                      onClick={() => {
                        setCategory(detectedCategory.category);
                        setIsCategoryManuallyOverridden(false);
                      }}
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
                <label className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                  Category
                </label>
                {detectedCategory && category === detectedCategory.category && (
                  <span className="text-[10px] text-[#06C755] font-semibold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    <span>Auto-selected</span>
                  </span>
                )}
              </div>
              <select
                value={category}
                onChange={(e) => handleCategorySelect(e.target.value as CategoryType)}
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
                      Auto-repeating charge
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
                Record Entry
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
