import React, { useEffect, useRef, useState } from 'react';
import { CategoryType, Transaction } from '../types/finance';
import { ACCOUNTS, EDITABLE_CATEGORIES } from '../lib/categories';
import { IN_LINE } from '../lib/clock';
import { baht, dayLabel, signedBaht, slipDateTime, time12, toneOf, TONE_CLASS } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge } from './Badges';
import { Sheet, Switch } from './Sheet';
import { useLang } from '../lib/i18n';

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
  /** Fetches a short-lived URL for the original slip photo. Only set in live mode. */
  onFetchSlipImage?: (id: string) => Promise<string | null>;
}

const muted = 'text-[#8E8E93]';
const group = 'bg-white dark:bg-neutral-900 rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.03)] border border-black/[0.03] dark:border-white/[0.05] overflow-hidden divide-y divide-[#E5E5EA] dark:divide-neutral-800';
const row = 'w-full px-4 py-3.5 min-h-[50px] flex items-center justify-between gap-3 text-left';
const heading = `text-[12px] font-semibold uppercase tracking-wider px-1 ${muted}`;

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({ transaction: tx, onBack, onEdit, onDelete, onUpdate, onSetCategory, onShowInChat, hasRule, onFetchSlipImage }) => {
  const { t, categoryLabel } = useLang();
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<null | 'category' | 'split' | 'slip'>(null);
  const [always, setAlways] = useState(hasRule);
  const [splitN, setSplitN] = useState(tx.split?.n ?? 2);
  const [photo, setPhoto] = useState<{ state: 'idle' | 'loading' | 'ready' | 'error'; url?: string }>({ state: 'idle' });
  /** Guards against re-firing the effect below when setPhoto's own update re-runs it. */
  const photoStarted = useRef(false);

  // Fetch the original photo only once the user asks to see it enlarged, and only once per opening
  // (photo.state is deliberately not a dependency: setting it here must not re-trigger this effect).
  useEffect(() => {
    if (sheet !== 'slip') {
      photoStarted.current = false;
      setPhoto({ state: 'idle' });
      return;
    }
    if (!tx.hasImage || !onFetchSlipImage || photoStarted.current) return;
    photoStarted.current = true;
    let cancelled = false;
    setPhoto({ state: 'loading' });
    onFetchSlipImage(tx.id)
      .then(url => !cancelled && setPhoto(url ? { state: 'ready', url } : { state: 'error' }))
      .catch(() => !cancelled && setPhoto({ state: 'error' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, tx.id, tx.hasImage, onFetchSlipImage]);

  const tone = toneOf(tx);
  const abs = Math.abs(tx.amount);
  const account = ACCOUNTS[tx.account];
  const kindLabel = tx.status === 'review' ? t('detail.needsReview').toUpperCase() : tone === 'income' ? t('detail.income').toUpperCase() : tone === 'transfer' ? t('detail.transfer').toUpperCase() : t('detail.expense').toUpperCase();

  const pill =
    tx.source === 'slip'
      ? tx.verifiedFromSlip
        ? { icon: 'check', text: t('detail.verifiedFromSlip'), cls: 'bg-[#E8F9EE] text-[#006e2b] border-[#06C755]/25 dark:bg-emerald-950/40 dark:text-emerald-300' }
        : { icon: 'receipt_long', text: t('detail.readFromSlip'), cls: 'bg-[#F2F2F7] text-neutral-700 border-black/5 dark:bg-neutral-800 dark:text-neutral-300' }
      : tx.source === 'voice'
        ? { icon: 'mic', text: t('detail.fromVoiceNote'), cls: 'bg-[#EEF1FF] text-[#3A4FC0] border-[#4A63E0]/20 dark:bg-[#1E2442] dark:text-[#C9D2FF]' }
        : tx.source === 'text'
          ? { icon: 'chat', text: t('detail.typedInChat'), cls: 'bg-[#EEF1FF] text-[#3A4FC0] border-[#4A63E0]/20 dark:bg-[#1E2442] dark:text-[#C9D2FF]' }
          : { icon: 'edit', text: t('detail.addedByHand'), cls: 'bg-[#F2F2F7] text-neutral-700 border-black/5 dark:bg-neutral-800 dark:text-neutral-300' };

  const toggleTransfer = () =>
    tx.category === 'Transfer'
      ? onUpdate(tx.id, { category: tx.prevCategory ?? 'Food & Dining', prevCategory: undefined })
      : onUpdate(tx.id, { prevCategory: tx.category, category: 'Transfer' });

  /** The slip as it was read: a receipt-style card. */
  const slipCard = (large = false) => (
    <div className={`rounded-2xl border border-[#06C755]/25 bg-[#F6FCF8] dark:bg-emerald-950/20 p-4 text-left ${large ? 'w-full max-w-[320px]' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: account.bg, color: account.fg }}>
            {account.short}
          </span>
          <span className="text-[14px] font-bold text-black dark:text-white truncate">{tx.slip?.slipType ?? `${account.name} · e-Slip`}</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E8F9EE] dark:bg-emerald-950/50 border border-[#06C755]/25 text-[11px] font-semibold text-[#006e2b] dark:text-emerald-300 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#06C755]" />
          {tx.slip?.status ?? 'โอนเงินสำเร็จ'}
        </span>
      </div>
      <div className="mt-3.5 pt-3.5 border-t border-[#06C755]/15 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-neutral-500">จำนวนเงิน</span>
          <span className="money text-[22px] font-bold text-neutral-900 dark:text-white tabular-nums">฿{(tx.slip?.amount ?? abs).toFixed(2)}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] text-neutral-500">จาก</span>
          <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200 text-right">
            {tx.slip?.senderName}
            {tx.slip?.senderAccount && <span className="block text-[11px] font-normal text-neutral-500">{tx.slip.senderAccount}</span>}
          </span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <span className="text-[13px] text-neutral-500">ไปยัง</span>
          <span className="text-[13px] font-semibold text-neutral-900 dark:text-white text-right">
            {tx.slip?.recipientName || tx.title}
            {tx.slip?.recipientPromptPay && <span className="block text-[11px] font-normal text-neutral-500">PromptPay {tx.slip.recipientPromptPay}</span>}
          </span>
        </div>
        <div className="pt-3 mt-1 border-t border-dashed border-[#06C755]/25 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <span>{tx.slip?.refNo}</span>
          <span>{tx.slip?.dateTimeStr ?? slipDateTime(tx.date, tx.time)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-8 animate-slideIn">
      {/* Back / menu */}
      <div className="flex items-center justify-between py-1 -mx-1">
        <button onClick={onBack} className="inline-flex items-center gap-0.5 h-11 text-[17px] font-medium text-[#007AFF] active:opacity-50 transition" aria-label="Back">
          <span className="material-symbols-outlined text-[24px]">chevron_left</span>
          <span>{t('detail.transactions')}</span>
        </button>
        <button onClick={() => onEdit(tx)} className="w-9 h-9 rounded-full bg-white dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 shadow-xs active:scale-95 transition" aria-label="Edit">
          <span className="material-symbols-outlined text-[20px]">more_horiz</span>
        </button>
      </div>

      {/* Amount */}
      <div className="text-center space-y-1">
        <span className={`text-[12px] font-semibold tracking-wider block ${tx.status === 'review' ? 'text-[#9A5B00] dark:text-amber-300' : muted}`}>{kindLabel}</span>
        <h1 className={`money text-[52px] font-bold tracking-tight leading-none tabular-nums ${TONE_CLASS[tone]}`}>{signedBaht(tx)}</h1>
        <h2 className="text-[19px] font-semibold text-black dark:text-white pt-1.5">{tx.title}</h2>
        <p className={`text-[13px] ${muted}`}>
          {categoryLabel(tx.category)} · {dayLabel(tx.date).split(' ').slice(1).join(' ')} · {time12(tx.time)}
        </p>
        <div className="pt-2.5 flex justify-center">
          <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold border ${pill.cls}`}>
            <span className="material-symbols-outlined text-[16px]">{pill.icon}</span>
            {pill.text}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        <span className={heading}>{t('detail.transactionDetails').toUpperCase()}</span>
        <div className={group}>
          <button onClick={() => setSheet('category')} className={`${row} hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
            <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.category')}</span>
            <span className="flex items-center gap-1 text-[15px] font-semibold text-black dark:text-white">
              {categoryLabel(tx.category)}
              <span className="text-[#C7C7CC] text-[16px]">›</span>
            </span>
          </button>
          <div className={row}>
            <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.payment')}</span>
            <span className="text-[15px] font-semibold text-black dark:text-white">{account.name}</span>
          </div>
          <div className={row}>
            <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.dateTime')}</span>
            <span className="text-[15px] font-semibold text-black dark:text-white tabular-nums">
              {Number(tx.date.slice(8))} {dayLabel(tx.date).split(' ')[2]} {tx.date.slice(0, 4)} · {tx.time}
            </span>
          </div>
          {more && (
            <>
              <div className={row}>
                <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.account')}</span>
                <span className="flex items-center gap-1.5 text-[14px] font-medium text-black dark:text-white">
                  <BankBadge account={tx.account} />
                  {account.full}
                </span>
              </div>
              <label className={row}>
                <span className="text-[15px] text-neutral-700 dark:text-neutral-300 shrink-0">{t('detail.note')}</span>
                <input
                  defaultValue={tx.note ?? ''}
                  placeholder={t('detail.addANote')}
                  onBlur={e => e.target.value !== (tx.note ?? '') && onUpdate(tx.id, { note: e.target.value })}
                  className="flex-1 min-w-0 bg-transparent text-right text-[15px] text-black dark:text-white placeholder-[#8E8E93] outline-none"
                />
              </label>
              {tx.split && (
                <div className={row}>
                  <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.split')}</span>
                  <span className="text-[14px] font-medium text-black dark:text-white">
                    {tx.split.n} ways · {t('detail.owed')} <span className="money">{baht(abs - abs / tx.split.n)}</span>
                  </span>
                </div>
              )}
              {tx.isRecurring && (
                <div className={row}>
                  <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.repeats')}</span>
                  <span className="text-[14px] font-medium text-black dark:text-white capitalize">
                    {tx.recurringFrequency ?? 'monthly'} · day {tx.billingDay}
                  </span>
                </div>
              )}
              {tx.slip?.refNo && (
                <div className={row}>
                  <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.bankRef')}</span>
                  <span className="text-[13px] font-mono text-neutral-700 dark:text-neutral-300 select-all">{tx.slip.refNo}</span>
                </div>
              )}
              {tone !== 'income' && (
                <>
                  <button onClick={() => setSheet('split')} className={`${row} hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
                    <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.splitBill')}</span>
                    <span className="text-[#C7C7CC] text-[16px]">›</span>
                  </button>
                  <button onClick={toggleTransfer} className={row} role="switch" aria-checked={tx.category === 'Transfer'}>
                    <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.transferBetweenAccounts')}</span>
                    <Switch on={tx.category === 'Transfer'} />
                  </button>
                  <button onClick={() => onUpdate(tx.id, { excluded: !tx.excluded })} className={row} role="switch" aria-checked={!!tx.excluded}>
                    <span className="text-[15px] text-neutral-700 dark:text-neutral-300">{t('detail.excludeFromStats')}</span>
                    <Switch on={!!tx.excluded} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <button onClick={() => setMore(s => !s)} className={`px-1 text-[12px] font-medium ${muted} hover:text-black dark:hover:text-white`}>
          {more ? t('detail.lessDetails') : t('detail.moreDetails')}
        </button>
      </div>

      {/* Where it came from */}
      {tx.source === 'slip' ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className={heading.replace('px-1', '')}>{t('detail.sourceReceipt').toUpperCase()}</span>
            {tx.slip?.refNo && <span className={`text-[11px] font-mono ${muted}`}>Ref {tx.slip.refNo.slice(-6)}</span>}
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/5 dark:border-white/10 space-y-3">
            <button onClick={() => setSheet('slip')} className="w-full cursor-zoom-in" aria-label="Enlarge slip">
              {slipCard()}
            </button>
            {tx.hasImage || IN_LINE ? (
              <button onClick={() => setSheet('slip')} className="w-full py-3.5 px-4 rounded-xl bg-[#06C755] hover:bg-[#05B34C] text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                {tx.hasImage ? t('detail.viewPhoto') : t('detail.viewSlip')}
              </button>
            ) : (
              <button onClick={() => onShowInChat(tx)} className="w-full py-3.5 px-4 rounded-xl bg-[#06C755] hover:bg-[#05B34C] text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <span className="material-symbols-outlined text-[18px]">chat_bubble</span>
                {t('detail.viewOriginalInLine')}
              </button>
            )}
          </div>
        </div>
      ) : (
        tx.said && (
          <div className="space-y-1.5">
            <span className={heading}>{t('detail.source').toUpperCase()}</span>
            <div className="bg-white dark:bg-neutral-900 rounded-[22px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-black/5 dark:border-white/10 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-[#EEF1FF] dark:bg-[#1E2442] text-[#3A4FC0] dark:text-[#C9D2FF] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">{tx.source === 'voice' ? 'mic' : 'chat'}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-black dark:text-white">“{tx.said}”</p>
                <p className={`text-[12px] ${muted}`}>{tx.source === 'voice' ? t('detail.voiceNote') : t('detail.typedInChat')}</p>
              </div>
            </div>
          </div>
        )
      )}

      {/* Edit / delete */}
      <div className={group}>
        <button onClick={() => onEdit(tx)} className={`${row} text-[16px] font-medium text-[#007AFF] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition`}>
          <span>{t('detail.editTransaction')}</span>
          <span className="text-[#C7C7CC] text-[16px]">›</span>
        </button>
        <button onClick={() => onDelete(tx.id)} className={`${row} text-[16px] font-medium text-[#FF3B30] hover:bg-red-50 dark:hover:bg-red-950/20 transition`}>
          <span>{t('detail.deleteTransaction')}</span>
        </button>
      </div>

      {/* Category picker */}
      {sheet === 'category' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3 className="text-[18px] font-bold text-black dark:text-white">{t('detail.category')}</h3>
          <p className={`text-[13px] ${muted} mb-3`}>
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
                {categoryLabel(c)}
              </button>
            ))}
          </div>
          <label className={`flex items-center gap-2 mt-3 text-[13px] ${muted}`}>
            <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} className="w-[18px] h-[18px] accent-[#008A3D]" />
            {t('detail.alwaysFile')} <b className="text-black dark:text-white">{tx.title}</b> {t('detail.thisWay')}
          </label>
        </Sheet>
      )}

      {/* Split bill */}
      {sheet === 'split' && (
        <Sheet onClose={() => setSheet(null)}>
          <h3 className="text-[18px] font-bold text-black dark:text-white">{t('detail.splitBill')}</h3>
          <p className={`text-[13px] ${muted}`}>
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
            {t('detail.eachPays')} <b className="money">{baht(abs / splitN)}</b> · {t('detail.youreOwed')} <b className="money">{baht(abs - abs / splitN)}</b>
          </p>
          <button
            onClick={() => {
              onUpdate(tx.id, { split: { n: splitN } });
              setSheet(null);
            }}
            className="w-full mt-4 py-3.5 rounded-2xl bg-[#008A3D] text-white text-[15px] font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition"
          >
            <span className="material-symbols-outlined text-[18px]">check</span>
            {t('detail.saveSplit')}
          </button>
        </Sheet>
      )}

      {/* Slip, enlarged: the original photo when the bot kept one, else the read-off recreation */}
      {sheet === 'slip' && (
        <div className="absolute inset-0 z-50 bg-black/85 flex flex-col items-center justify-center gap-3 p-6 animate-fadeIn cursor-zoom-out" onClick={() => setSheet(null)} role="dialog" aria-label="Slip">
          {tx.hasImage && photo.state === 'loading' && (
            <div className="w-full max-w-[320px] aspect-[3/4] rounded-2xl bg-white/10 flex items-center justify-center">
              <span className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" aria-label="Loading photo" />
            </div>
          )}
          {tx.hasImage && photo.state === 'ready' && photo.url && (
            <img src={photo.url} alt="Original slip" className="w-full max-w-[320px] max-h-[75vh] object-contain rounded-2xl shadow-2xl" />
          )}
          {(!tx.hasImage || photo.state === 'error') && (
            <>
              {tx.hasImage && <p className="text-[13px] font-medium text-white/70">{t('detail.couldntLoadPhoto')}</p>}
              {slipCard(true)}
            </>
          )}
        </div>
      )}
    </div>
  );
};
