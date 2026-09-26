import React, { useState } from 'react';
import { CategoryType, SubscriptionItem, Transaction } from '../types/finance';
import { Stats } from '../lib/ledger';
import { SPEND_CATEGORIES } from '../lib/categories';
import { TODAY_ISO, daysFromToday } from '../lib/clock';
import { baht, dayLabel } from '../lib/format';
import { CategoryIcon } from './CategoryIcon';
import { BankBadge, SourceIcon } from './Badges';
import { Mascot } from './Mascot';

type ResolveAction = 'confirm' | 'discard' | 'split' | 'subscribe';

interface ReviewTabProps {
  stats: Stats;
  transactions: Transaction[];
  subscriptions: SubscriptionItem[];
  onResolve: (id: string, action: ResolveAction, category?: CategoryType, always?: boolean) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddMoment: () => void;
  onOpenSubscriptionCalendar: () => void;
  onGoHome: () => void;
}

const meta = 'text-[#6E6E73] dark:text-neutral-400';
const card = 'bg-white dark:bg-neutral-900 rounded-[22px] border border-black/[0.04] dark:border-white/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.03)]';
const primary = 'h-10 px-4 rounded-xl bg-[#008A3D] hover:bg-[#007333] text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition';
const ghost = 'h-10 px-4 rounded-xl bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 text-[14px] font-semibold text-black dark:text-white flex items-center justify-center gap-1.5 active:scale-[0.98] transition';

const REASON: Record<string, { icon: string; label: string }> = {
  who: { icon: 'help', label: 'Who is this?' },
  dup: { icon: 'content_copy', label: 'Possible duplicate' },
  amount: { icon: 'mic', label: 'Check what I heard' },
  recurring: { icon: 'event_repeat', label: 'New subscription?' },
};

export const ReviewTab: React.FC<ReviewTabProps> = ({
  stats,
  transactions,
  subscriptions,
  onResolve,
  onSelectTransaction,
  onOpenAddMoment,
  onOpenSubscriptionCalendar,
  onGoHome,
}) => {
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [always, setAlways] = useState<Record<string, boolean>>({});
  const items = stats.review;

  /** Slide the card out, then resolve. */
  const resolve = (id: string, action: ResolveAction, category?: CategoryType) => {
    setLeaving(s => new Set(s).add(id));
    setTimeout(() => {
      onResolve(id, action, category, always[id]);
      setLeaving(s => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 260);
  };

  const soon = subscriptions
    .filter(s => s.nextRenewalDate > TODAY_ISO && daysFromToday(s.nextRenewalDate) <= 7)
    .sort((a, b) => a.nextRenewalDate.localeCompare(b.nextRenewalDate));
  const slipCount = transactions.filter(t => t.status === 'ok' && t.source === 'slip').length;

  return (
    <div className="space-y-4 pb-4 animate-fadeIn">
      <div className="flex items-center justify-between px-1 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[26px] font-bold text-black dark:text-white tracking-tight leading-none">Review</h1>
            {items.length > 0 && <span className="px-2 py-0.5 rounded-full bg-[#A05A12] text-white text-[12px] font-bold">{items.length}</span>}
          </div>
          <p className={`text-[13px] ${meta} mt-1`}>{items.length ? 'Only the things I wasn’t sure about. Most take one tap.' : 'Nothing waiting for you'}</p>
        </div>
        <button onClick={onOpenAddMoment} className="h-8 px-3 rounded-full bg-[#008A3D] text-white text-[12px] font-semibold flex items-center gap-1 active:scale-95 transition">
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>Add</span>
        </button>
      </div>

      {soon.length > 0 && (
        <button
          onClick={onOpenSubscriptionCalendar}
          className="w-full text-left p-3.5 bg-gradient-to-r from-[#E8F9EE] to-emerald-50 dark:from-emerald-950/40 dark:to-neutral-900 rounded-[20px] border border-[#008A3D]/25 flex items-center justify-between hover:shadow-xs transition"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#008A3D] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-black dark:text-white leading-tight truncate">Subscription renewals</h4>
              <p className={`text-[11px] ${meta} leading-tight mt-0.5 truncate`}>
                {soon.length} due this week ({soon.map(s => s.name).join(' · ')})
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#008A3D] shrink-0">chevron_right</span>
        </button>
      )}

      {items.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <Mascot size={72} className="mx-auto" />
          <h3 className="text-[18px] font-bold text-black dark:text-white mt-3">All caught up ✨</h3>
          <p className={`text-[13px] ${meta} mt-1`}>
            {stats.loggedCount} records this month, {slipCount} of them read straight from slips.
          </p>
          <button onClick={onGoHome} className={`${primary} mx-auto mt-4`}>
            Back to Overview
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(tx => {
            const kind = tx.review?.kind ?? 'who';
            const r = REASON[kind];
            const out = leaving.has(tx.id);
            const who = tx.title.replace(/^PromptPay · /, '');
            const original = kind === 'dup' ? transactions.find(t => t.id === tx.review?.dupOf) : undefined;
            return (
              <section
                key={tx.id}
                className={`${card} p-4 transition-all duration-300 ${out ? 'opacity-0 translate-x-10' : 'opacity-100'}`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#FFF3DC] dark:bg-amber-950/50 text-[#9A5B00] dark:text-amber-300 text-[12px] font-semibold">
                    <span className="material-symbols-outlined text-[14px]">{r.icon}</span>
                    {r.label}
                  </span>
                  <span className={`text-[12px] ${meta} tabular-nums`}>
                    {dayLabel(tx.date)} · {tx.time}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <CategoryIcon category={tx.category} className="w-11 h-11 rounded-xl" size={21} />
                  <div className="min-w-0">
                    <div className="money text-[26px] font-bold text-black dark:text-white tracking-tight tabular-nums leading-none">{baht(tx.amount)}</div>
                    <div className={`text-[13px] ${meta} flex items-center gap-1.5 mt-1 min-w-0`}>
                      <span className="truncate">{tx.title}</span>
                      <BankBadge account={tx.account} />
                      <SourceIcon source={tx.source} />
                    </div>
                  </div>
                </div>

                {kind === 'who' && (
                  <>
                    <p className={`text-[13px] ${meta} mb-2.5`}>A transfer to a person. What was it for?</p>
                    <div className="grid grid-cols-3 gap-2">
                      {SPEND_CATEGORIES.map(c => (
                        <button
                          key={c}
                          onClick={() => resolve(tx.id, 'confirm', c)}
                          className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl border border-black/[0.06] dark:border-white/10 bg-white dark:bg-neutral-900 text-[11px] font-semibold text-black dark:text-white text-center leading-tight hover:border-[#06C755] active:scale-95 transition"
                        >
                          <CategoryIcon category={c} className="w-8 h-8 rounded-[10px]" size={17} />
                          {c}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => resolve(tx.id, 'split', 'Food & Dining')} className={`${ghost} w-full mt-2.5`}>
                      <span className="material-symbols-outlined text-[18px]">group</span>Split / IOU (หารกัน)
                    </button>
                    <label className={`flex items-center gap-2 mt-3 text-[13px] ${meta}`}>
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] accent-[#008A3D]"
                        checked={!!always[tx.id]}
                        onChange={e => setAlways(a => ({ ...a, [tx.id]: e.target.checked }))}
                      />
                      Always use this for <b className="text-black dark:text-white">{who}</b>
                    </label>
                  </>
                )}

                {kind === 'dup' && (
                  <>
                    <p className={`text-[13px] ${meta}`}>This slip has the same bank reference as one I already logged.</p>
                    <div className="grid grid-cols-2 gap-2 my-3">
                      <div className="rounded-xl bg-[#F2F2F7] dark:bg-neutral-800 p-2.5 text-[12px]">
                        <span className={meta}>Already logged</span>
                        <b className="block text-[14px] text-black dark:text-white">
                          {original?.title ?? tx.title} <span className="money">{baht(original?.amount ?? tx.amount)}</span>
                        </b>
                        <span className={`${meta} tabular-nums`}>{original ? `${dayLabel(original.date)} ${original.time}` : ''}</span>
                      </div>
                      <div className="rounded-xl bg-[#F2F2F7] dark:bg-neutral-800 p-2.5 text-[12px]">
                        <span className={meta}>New slip</span>
                        <b className="block text-[14px] text-black dark:text-white">
                          {tx.title} <span className="money">{baht(tx.amount)}</span>
                        </b>
                        <span className={`${meta} tabular-nums`}>ref …{tx.slip?.refNo.slice(-5)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resolve(tx.id, 'discard')} className={`${primary} flex-1`}>
                        Discard duplicate
                      </button>
                      <button onClick={() => resolve(tx.id, 'confirm')} className={ghost}>
                        Keep both
                      </button>
                    </div>
                  </>
                )}

                {kind === 'amount' && (
                  <>
                    <div className="rounded-xl bg-[#F2F2F7] dark:bg-neutral-800 px-3 py-2.5 text-[14px] text-neutral-700 dark:text-neutral-200">
                      I heard: <b className="text-black dark:text-white">“{tx.said}”</b>
                    </div>
                    <p className="text-[14px] text-black dark:text-white my-3">
                      → <span className="money font-semibold">{baht(tx.amount)}</span> · {tx.category} · Cash
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => resolve(tx.id, 'confirm')} className={`${primary} flex-1`}>
                        <span className="material-symbols-outlined text-[18px]">check</span>Looks right
                      </button>
                      <button onClick={() => onSelectTransaction(tx)} className={ghost}>
                        Edit
                      </button>
                    </div>
                  </>
                )}

                {kind === 'recurring' && (
                  <>
                    <p className={`text-[13px] ${meta} mb-3`}>
                      Looks like a new monthly charge. Track it with your subscriptions so I can remind you before it renews?
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => resolve(tx.id, 'subscribe')} className={`${primary} flex-1`}>
                        <span className="material-symbols-outlined text-[18px]">event_repeat</span>Track as subscription
                      </button>
                      <button onClick={() => resolve(tx.id, 'confirm')} className={ghost}>
                        Just once
                      </button>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
