import React, { useState } from 'react';
import { CategoryType, SubscriptionItem, Transaction } from '../types/finance';
import { Stats } from '../lib/ledger';
import { CATEGORY_META, SPEND_CATEGORIES } from '../lib/categories';
import { TODAY_ISO, daysFromToday } from '../lib/clock';
import { baht } from '../lib/format';
import { useLang } from '../lib/i18n';

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

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

const muted = 'text-[#8E8E93]';
const confirmBtn = 'px-3 py-1 bg-[#008A3D] hover:bg-[#007032] text-white font-semibold rounded-lg shrink-0 shadow-xs transition active:scale-95';
const quietBtn = 'px-3 py-1 bg-white dark:bg-neutral-700 border border-black/10 dark:border-white/10 text-black dark:text-white font-semibold rounded-lg shrink-0 transition active:scale-95';

export const ReviewTab: React.FC<ReviewTabProps> = ({ stats, transactions, subscriptions, onResolve, onSelectTransaction, onOpenAddMoment, onOpenSubscriptionCalendar, onGoHome }) => {
  const { t, categoryLabel } = useLang();
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const items = stats.review;

  /** Slide the card out, then resolve. A payee you file once is remembered (the chat bot does the same). */
  const resolve = (id: string, action: ResolveAction, category?: CategoryType) => {
    setLeaving(s => new Set(s).add(id));
    setTimeout(() => {
      onResolve(id, action, category, action === 'confirm' && !!category);
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

  return (
    <div className="space-y-4 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-black dark:text-white tracking-tight">{t('review.title')}</h1>
            {items.length > 0 && <span className="px-2 py-0.5 rounded-full bg-[#A05A12] text-white text-[12px] font-bold">{items.length}</span>}
          </div>
          <p className={`text-[13px] ${muted} mt-0.5`}>{t('review.subtitle')}</p>
        </div>
        <button onClick={onOpenAddMoment} className="h-8 px-3 rounded-full bg-[#008A3D] text-white text-[12px] font-semibold flex items-center gap-1 shadow-xs active:scale-95 transition">
          <span className="material-symbols-outlined text-[16px]">add</span>
          <span>{t('review.add')}</span>
        </button>
      </div>

      {/* Subscription renewals */}
      {soon.length > 0 && (
        <div onClick={onOpenSubscriptionCalendar} className="p-3.5 bg-gradient-to-r from-[#E8F9EE] to-emerald-50 dark:from-emerald-950/40 dark:to-neutral-900 rounded-[20px] border border-[#008A3D]/25 flex items-center justify-between cursor-pointer hover:shadow-xs transition">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#008A3D] text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-[20px]">calendar_month</span>
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-black dark:text-white leading-tight truncate">Subscription Renewal Calendar</h4>
              <p className={`text-[11px] ${muted} leading-tight mt-0.5 truncate`}>
                {soon.length} {soon.length === 1 ? 'renewal' : 'renewals'} due this week ({soon.map(s => s.name).join(' · ')})
              </p>
            </div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-[#008A3D] shrink-0">chevron_right</span>
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {items.map(tx => {
          const kind = tx.review?.kind ?? 'who';
          const out = leaving.has(tx.id);
          const meta = CATEGORY_META[tx.category] ?? CATEGORY_META.Uncategorized;
          const original = kind === 'dup' ? transactions.find(t => t.id === tx.review?.dupOf) : undefined;
          const who = tx.title.replace(/^PromptPay · /, '');

          return (
            <div key={tx.id} className={`p-4 bg-white dark:bg-neutral-900 rounded-[22px] border border-black/[0.04] dark:border-white/[0.06] shadow-xs transition-all duration-300 ${out ? 'opacity-0 translate-x-10' : 'opacity-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs" style={{ background: meta.color }}>
                    <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-black dark:text-white leading-tight truncate">{who}</h3>
                    <p className={`text-[12px] ${muted} mt-0.5`}>
                      {tx.category === 'Uncategorized' ? t('review.needsCategory') : categoryLabel(tx.category)} · {dateOf(tx.date)}
                    </p>
                  </div>
                </div>
                <span className="money text-[16px] font-bold text-black dark:text-white tabular-nums shrink-0">{baht(tx.amount)}</span>
              </div>

              {/* What it needs, and the one tap that settles it */}
              <div className="mt-3 p-2.5 rounded-xl bg-[#F5F6F5] dark:bg-neutral-800/80 flex items-center justify-between gap-2 text-[12px]">
                <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 min-w-0">
                  <span className="material-symbols-outlined text-[15px] text-[#008A3D] shrink-0">info</span>
                  <span className="leading-snug">
                    {kind === 'who' && t('review.whatWasThisFor')}
                    {kind === 'dup' && (
                      <>
                        {t('review.sameBankRefAs')} {original ? `${original.title} on ${dateOf(original.date)}` : t('review.oneAlreadyLogged')}
                      </>
                    )}
                    {kind === 'amount' && (
                      <>
                        {t('review.iHeard')} “{tx.said}”
                      </>
                    )}
                    {kind === 'recurring' && t('review.looksLikeNewCharge')}
                  </span>
                </div>

                {kind === 'dup' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => resolve(tx.id, 'confirm')} className={quietBtn}>
                      {t('review.keepBoth')}
                    </button>
                    <button type="button" onClick={() => resolve(tx.id, 'discard')} className={confirmBtn}>
                      {t('review.discard')}
                    </button>
                  </div>
                )}
                {kind === 'amount' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => onSelectTransaction(tx)} className={quietBtn}>
                      {t('review.edit')}
                    </button>
                    <button type="button" onClick={() => resolve(tx.id, 'confirm')} className={confirmBtn}>
                      {t('review.confirm')}
                    </button>
                  </div>
                )}
                {kind === 'recurring' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => resolve(tx.id, 'confirm')} className={quietBtn}>
                      {t('review.once')}
                    </button>
                    <button type="button" onClick={() => resolve(tx.id, 'subscribe')} className={confirmBtn}>
                      {t('review.track')}
                    </button>
                  </div>
                )}
              </div>

              {kind === 'who' && (
                <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pt-2.5 pb-0.5">
                  {SPEND_CATEGORIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => resolve(tx.id, 'confirm', c)}
                      className="h-9 px-3.5 rounded-full bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-[13px] font-semibold text-black dark:text-white shrink-0 hover:border-[#06C755] active:scale-95 transition"
                    >
                      {categoryLabel(c)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => resolve(tx.id, 'split', 'Food & Dining')}
                    className="h-9 px-3.5 rounded-full bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-[13px] font-semibold text-black dark:text-white shrink-0 flex items-center gap-1 active:scale-95 transition"
                  >
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    {t('review.split')}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-[22px] border border-black/5 dark:border-white/5">
            <span className="material-symbols-outlined text-[36px] text-[#008A3D] mb-2">task_alt</span>
            <h3 className="text-[16px] font-bold text-black dark:text-white">{t('review.allCaughtUp')}</h3>
            <p className={`text-[13px] ${muted} mt-1`}>{t('review.allCaughtUpBody')}</p>
            <button onClick={onGoHome} className="mt-4 h-10 px-5 rounded-xl bg-[#008A3D] text-white text-[14px] font-semibold active:scale-[0.98] transition">
              {t('review.backToOverview')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
