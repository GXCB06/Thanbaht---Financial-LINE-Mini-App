// Turns the server's records into the app's Transaction, and works out what changed since the
// last time the server saw them. Pure functions: no network, no React.

import type { AccountId, BankSlipInfo, CategoryType, ReviewKind, SubscriptionItem, Transaction, TransactionSource } from '../types/finance';
import { ACCOUNTS } from './categories';

/** A row as returned by the app-api function (the transactions table). */
export interface ServerTx {
  id: string;
  title: string;
  category: CategoryType;
  amount: number | string;
  date: string;
  time: string;
  account: AccountId;
  source: TransactionSource;
  status: 'ok' | 'review' | 'deleted';
  review_kind: ReviewKind | null;
  review_dup_of: string | null;
  said: string | null;
  note: string | null;
  verified: boolean;
  slip: Omit<BankSlipInfo, 'bankCode'> | null;
  image_path: string | null;
  excluded: boolean;
  split_n: number | null;
  prev_category: CategoryType | null;
}

export interface ServerProfile {
  display_name: string | null;
  monthly_budget: number;
  owner_names: string[];
}

const BANK_CODE: Record<AccountId, BankSlipInfo['bankCode']> = {
  kbank: 'KBANK', scb: 'SCB', ktb: 'KTB', bbl: 'BBL', bay: 'BAY', ttb: 'TTB', gsb: 'GSB', tmn: 'TMN', cash: 'OTHER', other: 'OTHER',
};

export function toTransaction(r: ServerTx): Transaction {
  const account = r.account in ACCOUNTS ? r.account : 'other';
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    amount: Number(r.amount),
    date: r.date,
    time: r.time,
    verifiedFromSlip: r.verified,
    paymentMethod: ACCOUNTS[account].full,
    account,
    source: r.source,
    status: r.status,
    review: r.review_kind ? { kind: r.review_kind, ...(r.review_dup_of ? { dupOf: r.review_dup_of } : {}) } : undefined,
    said: r.said ?? undefined,
    note: r.note ?? undefined,
    slip: r.slip ? { ...r.slip, bankCode: BANK_CODE[account] } : undefined,
    hasImage: !!r.image_path,
    excluded: r.excluded || undefined,
    split: r.split_n ? { n: r.split_n } : undefined,
    prevCategory: r.prev_category ?? undefined,
  };
}

/** The fields the app may change, in the shape the server stores them. */
export interface Writable {
  title: string;
  category: CategoryType;
  amount: number;
  date: string;
  time: string;
  account: AccountId;
  status: 'ok' | 'review' | 'deleted';
  review_kind: ReviewKind | null;
  review_dup_of: string | null;
  said: string | null;
  note: string | null;
  excluded: boolean;
  split_n: number | null;
  prev_category: CategoryType | null;
}

export const writableOf = (t: Transaction): Writable => ({
  title: t.title,
  category: t.category,
  amount: t.amount,
  date: t.date,
  time: t.time,
  account: t.account,
  status: t.status,
  review_kind: t.review?.kind ?? null,
  review_dup_of: t.review?.dupOf ?? null,
  said: t.said ?? null,
  note: t.note ?? null,
  excluded: !!t.excluded,
  split_n: t.split?.n ?? null,
  prev_category: t.prevCategory ?? null,
});

const KEYS = Object.keys(writableOf({ id: '', title: '', category: 'Uncategorized', amount: 0, date: '', time: '', verifiedFromSlip: false, paymentMethod: '', account: 'cash', source: 'manual', status: 'ok' })) as (keyof Writable)[];

/** Only the fields that differ, or null when nothing changed. */
export function patchOf(before: Writable, after: Writable): Partial<Writable> | null {
  const patch: Record<string, unknown> = {};
  for (const k of KEYS) if (before[k] !== after[k]) patch[k] = after[k];
  return Object.keys(patch).length ? (patch as Partial<Writable>) : null;
}

export interface Changes {
  /** `after` is what the server will hold once the patch is applied (kept locally, never sent). */
  updates: { id: string; patch: Partial<Writable>; after: Writable }[];
  adds: (Writable & { id: string; source: TransactionSource })[];
  rules: { key: string; category: CategoryType }[];
  budget?: number;
  /** The whole subscription list, sent whenever any of it differs from what the server holds. */
  subscriptions?: SubscriptionItem[];
}

export interface ServerSnapshot {
  tx: Map<string, Writable>;
  rules: Record<string, CategoryType>;
  budget: number;
  /** The list as the server holds it, as JSON, so "did it change" is one string comparison. */
  subscriptions?: string;
}

export const subscriptionsKey = (subs: SubscriptionItem[]) => JSON.stringify(subs);

/** What must be sent to the server so that it matches the app's current state. */
export function diffAgainstServer(
  current: { transactions: Transaction[]; rules: Record<string, CategoryType>; budget: number; subscriptions?: SubscriptionItem[] },
  server: ServerSnapshot,
): Changes {
  const changes: Changes = { updates: [], adds: [], rules: [] };
  for (const t of current.transactions) {
    const now = writableOf(t);
    const known = server.tx.get(t.id);
    if (!known) {
      // a record created in the app and deleted before it was ever saved has nothing to send
      if (t.status !== 'deleted') changes.adds.push({ id: t.id, source: t.source, ...now });
      continue;
    }
    const patch = patchOf(known, now);
    if (patch) changes.updates.push({ id: t.id, patch, after: now });
  }
  // A record that vanished from the app (an undone add, say) is deleted on the server too, or it would come back
  const present = new Set(current.transactions.map(t => t.id));
  for (const [id, known] of server.tx) {
    if (present.has(id) || known.status === 'deleted') continue;
    const after: Writable = { ...known, status: 'deleted', review_kind: null, review_dup_of: null };
    changes.updates.push({ id, patch: { status: 'deleted', review_kind: null, review_dup_of: null }, after });
  }
  for (const [key, category] of Object.entries(current.rules)) if (server.rules[key] !== category) changes.rules.push({ key, category });
  if (current.budget !== server.budget) changes.budget = current.budget;
  if (current.subscriptions && subscriptionsKey(current.subscriptions) !== (server.subscriptions ?? '[]')) changes.subscriptions = current.subscriptions;
  return changes;
}

export const isEmpty = (c: Changes) => !c.updates.length && !c.adds.length && !c.rules.length && c.budget === undefined && c.subscriptions === undefined;

/** New records made in the app get real UUIDs (the database's id type); links between them follow. */
export function withUuids(txs: Transaction[], uuid: () => string = () => crypto.randomUUID()): Transaction[] {
  const map = new Map(txs.map(t => [t.id, uuid()]));
  return txs.map(t => ({
    ...t,
    id: map.get(t.id)!,
    review: t.review?.dupOf ? { ...t.review, dupOf: map.get(t.review.dupOf) ?? t.review.dupOf } : t.review,
  }));
}
