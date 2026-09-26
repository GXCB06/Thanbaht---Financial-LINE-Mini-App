import React, { useState } from 'react';
import { CategoryType, Transaction } from '../types/finance';
import { ACCOUNTS, EDITABLE_CATEGORIES } from '../lib/categories';
import { baht, longDate, slipDateTime, signedBaht, toneOf, TONE_CLASS } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge } from './Badges';
import { Mascot } from './Mascot';
import { Sheet, Switch } from './Sheet';

interface TransactionDetailViewProps {
  transaction: Transaction;
  transactions: Transaction[];
  onBack: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Transaction>) => void;
  onSetCategory: (id: string, category: CategoryType, always: boolean) => void;
  onShowInChat: (tx: Transaction) => void;
  hasRule: boolean;
}

const meta = 'text-[#6E6E73] dark:text-neutral-400';
const group = 'bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800';
const row = 'w-full px-4 py-3.5 min-h-[50px] flex items-center justify-between gap-3 text-left';

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
  transaction: tx,
  transactions,
  onBack,
  onEdit,
  onDelete,
  onUpdate,
  onSetCategory,
  onShowInChat,
  hasRule,
}) => {
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [sheet, setSheet] = useState<null | 'category' | 'split' | 'slip'>(null);
  const [always, setAlways] = useState(hasRule);
  const [splitN, setSplitN] = useState(tx.split?.n ?? 2);

  const tone = toneOf(tx);
  const abs = Math.abs(tx.amount);
  const account = ACCOUNTS[tx.account];
  const samePayee = transactions.filter(t => t.title === tx.title && t.status === 'ok' && t.amount < 0);
  const kindLabel = tx.status === 'review' ? 'Needs review' : tone === 'income' ? 'Income' : tone === 'transfer' ? 'Transfer · not counted' : 'Expense';

  const provenance =
    tx.source === 'slip'
      ? tx.verifiedFromSlip
        ? { icon: 'verified', text: 'Verified · QR ref matched', cls: 'bg-[#E8F9EE] text-[#006e2b] border-[#06C755]/25 dark:bg-emerald-950/40 dark:text-emerald-300' }
        : { icon: 'receipt_long', text: 'Read from slip', cls: 'bg-[#F2F2F7] text-neutral-700 border-black/5 dark:bg-neutral-800 dark:text-neutral-300' }
      : tx.source === 'voice'
        ? { icon: 'mic', text: 'From voice note', cls: 'bg-[#EEF1FF] text-[#3A4FC0] border-[#4A63E0]/20 dark:bg-[#1E2442] dark:text-[#C9D2FF]' }
        : tx.source === 'text'
          ? { icon: 'chat', text: 'Typed in chat', cls: 'bg-[#EEF1FF] text-[#3A4FC0] border-[#4A63E0]/20 dark:bg-[#1E2442] dark:text-[#C9D2FF]' }
          : { icon: 'edit', text: 'Added by hand', cls: 'bg-[#F2F2F7] text-neutral-700 border-black/5 dark:bg-neutral-800 dark:text-neutral-300' };

  const toggleTransfer = () =>
    tx.category === 'Transfer'
      ? onUpdate(tx.id, { category: tx.prevCategory ?? 'Food & Dining', prevCategory: undefined })
      : onUpdate(tx.id, { prevCategory: tx.category, category: 'Transfer' });

  const slipCard = (large = false) => (
    <div className={`rounded-xl border border-black/5 dark:border-white/10 bg-[#FBFDFB] dark:bg-neutral-800/80 overflow-hidden text-left ${large ? 'w-full max-w-[320px]' : ''}`}>
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: account.bg, color: account.fg }}>
        <span className="text-[13px] font-bold">{tx.slip?.slipType ?? `${account.name} · e-Slip`}</span>
        <span className="text-[11px] font-semibold">{tx.slip?.status ?? 'โอนเงินสำเร็จ'}</span>
      </div>
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-neutral-500">จำนวนเงิน</span>
          <span className="money text-[20px] font-bold text-neutral-900 dark:text-white tabular-nums">{(tx.slip?.amount ?? abs).toFixed(2)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] text-neutral-500">จาก</span>
          <span className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200 text-right">
            {tx.slip?.senderName}
            <span className="block text-[11px] text-neutral-500">{tx.slip?.senderAccount ?? account.full}</span>
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] text-neutral-500">ไปยัง</span>
          <span className="text-[13px] font-medium text-neutral-900 dark:text-white text-right">
            {tx.slip?.recipientName ?? tx.title}
            <span className="block text-[11px] text-neutral-500">PromptPay {tx.slip?.recipientPromptPay}</span>
          </span>
        </div>
        <div className="pt-3 mt-1 border-t border-dashed border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span>{tx.slip?.refNo}</span>
          <span>{tx.slip?.dateTimeStr ?? slipDateTime(tx.date, tx.time)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-6 animate-slideIn">
      <div className="flex items-center justify-between py-1 -mx-1">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-0.5 h-11 text-[17px] font-medium text-[#008A3D] dark:text-[#06C755] active:opacity-50 transition"
          aria-label="Back"
        >
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
          <span>Activity</span>
        </button>
        <button
          onClick={() => onEdit(tx)}
          className="w-9 h-9 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300 shadow-xs active:scale-95 transition"
          aria-label="Edit"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </button>
      </div>

      {/* Hero */}
      <div className="text-center pt-1 pb-2 space-y-1">
        <CategoryIcon category={tx.category} className="w-14 h-14 rounded-[18px] mx-auto mb-2" size={28} />
        <span className={`text-[12px] font-semibold uppercase tracking-wider block ${tx.status === 'review' ? 'text-[#9A5B00] dark:text-amber-300' : meta}`}>
          {kindLabel}
        </span>
        <h1 className={`money text-[44px] font-bold tracking-tight leading-none tabular-nums ${TONE_CLASS[tone]}`}>{signedBaht(tx)}</h1>
        <h2 className="text-[19px] font-semibold text-black dark:text-white pt-1">{tx.title}</h2>
        <p className={`text-[13px] ${meta} tabular-nums`}>
          {longDate(tx.date)} · {tx.time}
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold border ${provenance.cls}`}>
            <span className="material-symbols-outlined text-[15px]">{provenance.icon}</span>
            {provenance.text}
          </span>
          {tx.isRecurring && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#3055C6] dark:bg-blue-950/40 dark:text-blue-300 text-[12px] font-semibold border border-blue-200 dark:border-blue-800">
              <span className="material-symbols-outlined text-[15px]">event_repeat</span>
              {tx.recurringLabel ?? 'Monthly'}
            </span>
          )}
        </div>
        {tx.said && (
          <p className="inline-block mt-2 px-3 py-2 rounded-xl bg-[#F2F2F7] dark:bg-neutral-800 text-[13px] text-neutral-700 dark:text-neutral-200">
            “{tx.said}”
          </p>
        )}
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <span className={`text-[12px] font-semibold uppercase tracking-wider px-1 ${meta}`}>Details</span>
        <div className={group}>
          <button onClick={() => setSheet('category')} className={`${row} hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Category</span>
            <span className="flex items-center gap-1.5 text-[14px] font-medium text-black dark:text-white">
              <CategoryIcon category={tx.category} className="w-6 h-6 rounded-md" size={14} />
              {tx.category}
              <span className="text-[#C7C7CC] text-[15px]">›</span>
            </span>
          </button>
          <div className={row}>
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Account</span>
            <span className="flex items-center gap-1.5 text-[14px] font-medium text-black dark:text-white">
              <BankBadge account={tx.account} />
              {account.full}
            </span>
          </div>
          <label className={row}>
            <span className="text-[14px] text-neutral-600 dark:text-neutral-400 shrink-0">Note</span>
            <input
              defaultValue={tx.note ?? ''}
              placeholder="Add a note"
              onBlur={e => e.target.value !== (tx.note ?? '') && onUpdate(tx.id, { note: e.target.value })}
              className="flex-1 min-w-0 bg-transparent text-right text-[14px] text-black dark:text-white placeholder-[#6E6E73] outline-none"
            />
          </label>
          {tx.split && (
            <div className={row}>
              <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Split</span>
              <span className="text-[14px] font-medium text-black dark:text-white">
                {tx.split.n} ways · you're owed <span className="money">{baht(abs - abs / tx.split.n)}</span>
              </span>
            </div>
          )}
          {tx.isRecurring && (
            <div className={row}>
              <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Repeats</span>
              <span className="text-[13px] font-semibold text-black dark:text-white capitalize flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] text-[#06C755]">autorenew</span>
                {tx.recurringFrequency ?? 'monthly'} · day {tx.billingDay}
              </span>
            </div>
          )}
          {showMoreDetails && tx.slip?.refNo && (
            <div className={row}>
              <span className="text-[14px] text-neutral-600 dark:text-neutral-400">Bank ref</span>
              <span className="text-[13px] font-mono text-neutral-700 dark:text-neutral-300 select-all">{tx.slip.refNo}</span>
            </div>
          )}
        </div>
        {tx.slip?.refNo && (
          <button onClick={() => setShowMoreDetails(s => !s)} className={`px-1 text-[12px] font-medium ${meta} hover:text-black dark:hover:text-white`}>
            {showMoreDetails ? 'Less details ▴' : 'More details ▾'}
          </button>
        )}
      </div>

      {/* Merchant memory */}
      {samePayee.length > 1 && tone === 'expense' && (
        <section className="flex items-center gap-3 p-3 rounded-[20px] bg-[#EEF1FF] dark:bg-[#1E2442] border border-[#4A63E0]/15">
          <Mascot size={36} />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-black dark:text-white leading-tight">You pay here often</p>
            <p className="text-[12px] text-[#3C4466] dark:text-[#C9D2FF] mt-0.5">
              {samePayee.length} payments this month · <span className="money">{baht(samePayee.reduce((a, t) => a - t.amount, 0))}</span> total.{' '}
              {hasRule ? `Always filed as ${tx.category}.` : `I file it as ${tx.category} automatically.`}
            </p>
          </div>
        </section>
      )}

      {/* Actions */}
      {tone !== 'income' && (
        <div className={group}>
          <button onClick={() => setSheet('split')} className={`${row} hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
            <span className="flex items-center gap-3 text-[14px] text-black dark:text-white">
              <span className="material-symbols-outlined text-[20px] text-[#6E6E73]">group</span>Split bill (หารกัน)
            </span>
            <span className="text-[#C7C7CC] text-[15px]">›</span>
          </button>
          <button onClick={toggleTransfer} className={row} role="switch" aria-checked={tx.category === 'Transfer'}>
            <span className="flex items-center gap-3 text-[14px] text-black dark:text-white">
              <span className="material-symbols-outlined text-[20px] text-[#6E6E73]">swap_horiz</span>Transfer between my accounts
            </span>
            <Switch on={tx.category === 'Transfer'} />
          </button>
          <button onClick={() => onUpdate(tx.id, { excluded: !tx.excluded })} className={row} role="switch" aria-checked={!!tx.excluded}>
            <span className="flex items-center gap-3 text-[14px] text-black dark:text-white">
              <span className="material-symbols-outlined text-[20px] text-[#6E6E73]">block</span>Exclude from stats
            </span>
            <Switch on={!!tx.excluded} />
          </button>
        </div>
      )}

      {/* Source slip */}
      {tx.source === 'slip' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className={`text-[12px] font-semibold uppercase tracking-wider ${meta}`}>Source slip</span>
            <span className={`text-[12px] ${meta}`}>tap to enlarge</span>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/5 dark:border-white/10 space-y-3">
            <button onClick={() => setSheet('slip')} className="w-full cursor-zoom-in" aria-label="Enlarge slip">
              {slipCard()}
            </button>
            <button
              onClick={() => setSheet('slip')}
              className="w-full py-3 px-4 rounded-xl bg-[#008A3D] hover:bg-[#007333] text-white font-semibold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <span className="material-symbols-outlined text-[18px]">image</span>
              View slip image
            </button>
            <button onClick={() => onShowInChat(tx)} className="w-full text-[13px] font-semibold text-[#008A3D] dark:text-[#06C755]">
              Show in chat history
            </button>
          </div>
        </div>
      )}

      <div className={group}>
        <button onClick={() => onEdit(tx)} className={`${row} text-[15px] font-medium text-[#008A3D] dark:text-[#06C755] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
          <span>Edit transaction</span>
          <span className="text-[#C7C7CC] text-[15px]">›</span>
        </button>
        <button
          onClick={() => onDelete(tx.id)}
          className={`${row} text-[15px] font-medium text-[#C62828] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition`}
        >
          <span>Delete transaction</span>
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>

      {/* Category picker */}
      {sheet === 'category' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3 className="text-[18px] font-bold text-black dark:text-white">Category</h3>
          <p className={`text-[13px] ${meta} mb-3`}>
            {tx.title} · <span className="money">{baht(abs)}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {EDITABLE_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => {
                  if (c === 'Transfer') toggleTransfer();
                  else onSetCategory(tx.id, c, always);
                  setSheet(null);
                }}
                className={`flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl border text-[11px] font-semibold text-center leading-tight transition active:scale-95 ${
                  tx.category === c ? 'border-[#06C755] ring-2 ring-[#06C755]/25' : 'border-black/[0.06] dark:border-white/10'
                } text-black dark:text-white`}
              >
                <CategoryIcon category={c} className="w-8 h-8 rounded-[10px]" size={17} />
                {c}
              </button>
            ))}
          </div>
          <label className={`flex items-center gap-2 mt-3 text-[13px] ${meta}`}>
            <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} className="w-[18px] h-[18px] accent-[#008A3D]" />
            Always file <b className="text-black dark:text-white">{tx.title}</b> this way
          </label>
        </Sheet>
      )}

      {/* Split bill */}
      {sheet === 'split' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3 className="text-[18px] font-bold text-black dark:text-white">Split bill (หารกัน)</h3>
          <p className={`text-[13px] ${meta}`}>
            {tx.title} · <span className="money">{baht(abs)}</span>
          </p>
          <div className="flex items-center justify-center gap-5 my-4">
            <button onClick={() => setSplitN(n => Math.max(2, n - 1))} className="w-11 h-11 rounded-2xl bg-[#F2F2F7] dark:bg-neutral-800 text-[22px] font-semibold" aria-label="Fewer people">
              −
            </button>
            <span className="text-[30px] font-bold tabular-nums w-12 text-center">{splitN}</span>
            <button onClick={() => setSplitN(n => Math.min(10, n + 1))} className="w-11 h-11 rounded-2xl bg-[#F2F2F7] dark:bg-neutral-800 text-[22px] font-semibold" aria-label="More people">
              +
            </button>
          </div>
          <p className="text-center text-[14px] text-black dark:text-white">
            Each pays <b className="money">{baht(abs / splitN)}</b> · you're owed <b className="money">{baht(abs - abs / splitN)}</b>
          </p>
          <button
            onClick={() => {
              onUpdate(tx.id, { split: { n: splitN } });
              setSheet(null);
            }}
            className="w-full mt-4 py-3.5 rounded-2xl bg-[#008A3D] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Send to friends in LINE
          </button>
          <p className={`text-center text-[12px] ${meta} mt-2`}>Opens LINE's friend picker with a “pay me back” card.</p>
        </Sheet>
      )}

      {/* Slip image */}
      {sheet === 'slip' && (
        <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center p-6 animate-fadeIn cursor-zoom-out" onClick={() => setSheet(null)} role="dialog" aria-label="Slip image">
          {slipCard(true)}
        </div>
      )}
    </div>
  );
};
