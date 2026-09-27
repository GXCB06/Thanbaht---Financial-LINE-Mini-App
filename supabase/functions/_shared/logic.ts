// Pure business logic: no network, no database. Everything here is unit tested.

import type { AccountId, Category, NewTx, Profile, ReviewKind, SlipReading, Source, TxRow } from './types.ts';
import { detectCategoryFromTitle } from './categoryMatcher.ts';
import { payeeKey, sameOwner } from './names.ts';
import { parseQuick } from './parse.ts';
import { categoryBudget, SPEND_CATEGORIES } from './budget.ts';
import { type BangkokNow, dayLabel, monthName, shortDate, slipDateTime } from './clock.ts';
import { baht, catKey, type DigestData, type FlexTx, type ReceiptCtx } from './flex.ts';

export const BANK_NAME: Record<AccountId, string> = {
  kbank: 'KBank', scb: 'SCB', ktb: 'Krungthai', bbl: 'Bangkok Bank', bay: 'Krungsri',
  ttb: 'ttb', gsb: 'GSB', tmn: 'TrueMoney', cash: 'Cash', other: 'Other bank',
};

export type Kind = 'expense' | 'income' | 'transfer';
export const kindOf = (t: Pick<TxRow, 'amount' | 'category'>): Kind =>
  t.category === 'Transfer' ? 'transfer' : t.amount > 0 ? 'income' : 'expense';

/** Counts towards spending and income totals. */
export const counts = (t: TxRow) => t.status === 'ok' && !t.excluded && t.category !== 'Transfer';

interface DraftCtx {
  userId: string;
  profile: Profile;
  rules: Record<string, Category>;
  now: BangkokNow;
}

const blank = (userId: string): Omit<NewTx, 'title' | 'category' | 'amount' | 'date' | 'time' | 'account' | 'source' | 'status' | 'review_kind'> => ({
  user_id: userId,
  review_dup_of: null, said: null, note: null, trans_ref: null, verified: false, slip: null,
  image_path: null, excluded: false, split_n: null, prev_category: null, allow_dup: false,
});

/** What category does a payee get? A saved rule wins, then keywords, else "ask the user". */
function categorize(title: string, extra: string | null, rules: Record<string, Category>, spending: boolean): Category {
  const ruled = rules[payeeKey(title)];
  if (ruled) return ruled;
  const found = detectCategoryFromTitle([title, extra].filter(Boolean).join(' '))?.category;
  // a payment must never be filed as Income just because the payee's name contains "salary"
  if (!found || (spending && (found === 'Income' || found === 'Transfer'))) return 'Uncategorized';
  return found;
}

/** A slip the model could read → the record to store (before duplicate checking). */
export function draftFromSlip(r: SlipReading, ctx: DraftCtx, extra: { imagePath: string | null; verified: boolean }): NewTx {
  const incoming = r.direction === 'in';
  const counterparty = incoming ? r.senderName : r.receiverName;
  const title = counterparty ?? (incoming ? 'Incoming transfer' : 'Unknown payee');
  const own = sameOwner(r.senderName, r.receiverName, ctx.profile.owner_names);

  let category: Category;
  if (own) category = 'Transfer';
  else if (incoming) category = 'Income';
  else category = categorize(title, r.memo, ctx.rules, true);

  const [date, time] = r.datetime ? r.datetime.split('T') : [ctx.now.date, ctx.now.time];
  const account: AccountId = r.bank ?? 'other';
  const review: ReviewKind | null = category === 'Uncategorized' ? 'who' : null;
  const amount = r.amount as number;

  return {
    ...blank(ctx.userId),
    title,
    category,
    amount: incoming && !own ? amount : -amount,
    date,
    time,
    account,
    source: 'slip',
    status: review ? 'review' : 'ok',
    review_kind: review,
    note: r.memo,
    trans_ref: r.ref,
    verified: extra.verified,
    image_path: extra.imagePath,
    slip: {
      bankName: BANK_NAME[account],
      slipType: `${BANK_NAME[account]} · e-Slip`,
      status: incoming ? 'เงินเข้าสำเร็จ' : 'โอนเงินสำเร็จ',
      amount,
      senderName: r.senderName ?? '',
      senderAccount: r.senderAccount ?? undefined,
      recipientName: r.receiverName ?? '',
      recipientPromptPay: r.receiverAccount ?? '',
      refNo: r.ref ?? '',
      dateTimeStr: slipDateTime(date, time),
    },
  };
}

/** "กาแฟ 65" typed or spoken → a record, or null when there is no amount. */
export function draftFromQuick(text: string, source: Extract<Source, 'text' | 'voice'>, ctx: DraftCtx): NewTx | null {
  const q = parseQuick(text);
  if (!q) return null;
  const category = categorize(q.title, null, ctx.rules, false);
  const review: ReviewKind | null = category === 'Uncategorized' ? 'who' : null;
  return {
    ...blank(ctx.userId),
    title: q.title,
    category,
    amount: category === 'Income' ? q.amount : -q.amount,
    date: ctx.now.date,
    time: ctx.now.time,
    account: 'cash',
    source,
    status: review ? 'review' : 'ok',
    review_kind: review,
    said: text.trim(),
  };
}

/* ---------------- numbers for the cards ---------------- */

export interface MonthStats {
  spent: number;
  /** Money received this month (transfers between own accounts excluded). */
  income: number;
  todaySpent: number;
  todayCount: number;
  bySpendCategory: Map<Category, number>;
  todayByBank: [string, number][];
}

export function monthStats(rows: TxRow[], now: BangkokNow): MonthStats {
  const ok = rows.filter(counts);
  const expenses = ok.filter(t => t.amount < 0);
  const bySpendCategory = new Map<Category, number>();
  let spent = 0;
  let todaySpent = 0;
  const bank = new Map<string, number>();
  for (const t of expenses) {
    const a = -t.amount;
    spent += a;
    bySpendCategory.set(t.category, (bySpendCategory.get(t.category) ?? 0) + a);
    if (t.date === now.date) {
      todaySpent += a;
      bank.set(BANK_NAME[t.account], (bank.get(BANK_NAME[t.account]) ?? 0) + a);
    }
  }
  return {
    spent,
    income: ok.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
    todaySpent,
    todayCount: rows.filter(t => t.status === 'ok' && t.date === now.date).length,
    bySpendCategory,
    todayByBank: [...bank.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export function receiptCtx(tx: TxRow, stats: MonthStats, profile: Profile): ReceiptCtx {
  return {
    todayTotal: stats.todaySpent,
    todayN: stats.todayCount,
    catSpent: stats.bySpendCategory.get(tx.category) ?? -tx.amount,
    catBudget: categoryBudget(tx.category, profile.monthly_budget) || profile.monthly_budget,
  };
}

export function toFlexTx(t: TxRow): FlexTx {
  return {
    id: t.id,
    name: t.title,
    cat: catKey(t.category),
    amt: Math.abs(t.amount),
    bank: BANK_NAME[t.account],
    date: shortDate(t.date),
    time: t.time,
    verified: t.verified,
    via: t.source === 'slip' ? 'slip' : t.source === 'voice' ? 'voice' : 'text',
    kind: kindOf(t),
  };
}

export function digestData(rows: TxRow[], profile: Profile, now: BangkokNow, waiting: number): DigestData {
  const s = monthStats(rows, now);
  const budget = profile.monthly_budget;
  const remaining = Math.max(0, budget - s.spent);

  // The category furthest ahead of an even pace, if it is close to or past its budget
  const paceShare = now.day / now.daysInMonth;
  let hot: string | undefined;
  let worst = 0;
  for (const c of SPEND_CATEGORIES) {
    const b = categoryBudget(c, budget);
    const spent = s.bySpendCategory.get(c) ?? 0;
    if (b > 0 && spent > b * paceShare && spent / b >= 0.8 && spent / b > worst) {
      worst = spent / b;
      hot = `${c} is at ${Math.round((spent / b) * 100)}% of its ${baht(b)} budget with ${now.daysLeft} days to go.`;
    }
  }

  return {
    dateLabel: dayLabel(now.date),
    monthLabel: monthName(now.date),
    todayTotal: s.todaySpent,
    todayN: s.todayCount,
    byBank: s.todayByBank,
    monthSpent: s.spent,
    budget,
    perDay: now.daysLeft ? remaining / now.daysLeft : remaining,
    daysLeft: now.daysLeft,
    hot,
    waiting: waiting || undefined,
  };
}

