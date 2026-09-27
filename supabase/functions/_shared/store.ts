import type { Category, NewTx, Profile, SlipRecord, TxRow } from './types.ts';

/** Thrown by insertTx when the bank reference is already used by a live record. */
export class DuplicateRefError extends Error {
  constructor() {
    super('duplicate bank reference');
  }
}

/** An image set that never reached `set_total` slips and has had no reply yet. */
export interface StaleBatch {
  userId: string;
  setId: string;
  total: number;
}

/**
 * Everything the webhook needs from the database. The Supabase implementation is in
 * supabase_store.ts; memory_store.ts is an in-memory version used by the tests.
 */
export interface Store {
  /** True the first time an event id is seen, false for a redelivery. */
  markEventSeen(eventId: string): Promise<boolean>;
  /** Returns the user's profile, creating it on first contact. */
  ensureProfile(userId: string): Promise<Profile>;
  /** Every user who has ever messaged the bot, for the scheduled daily digest. */
  listUserIds(): Promise<string[]>;
  /** Stores the image privately and returns its path. */
  saveImage(userId: string, messageId: string, bytes: Uint8Array, mime: string): Promise<string>;

  findByRef(userId: string, ref: string): Promise<TxRow | null>;
  /** @throws DuplicateRefError if a live record already has this trans_ref */
  insertTx(tx: NewTx): Promise<TxRow>;
  getTx(userId: string, id: string): Promise<TxRow | null>;
  updateTx(userId: string, id: string, patch: Partial<NewTx>): Promise<TxRow>;
  /** Non-deleted records whose date is in `month` ("YYYY-MM"). */
  monthTxs(userId: string, month: string): Promise<TxRow[]>;
  /** Records waiting in Review, across all months. */
  reviewCount(userId: string): Promise<number>;

  getRules(userId: string): Promise<Record<string, Category>>;
  setRule(userId: string, payeeKey: string, category: Category): Promise<void>;

  recordSlip(slip: SlipRecord): Promise<void>;
  slipsInSet(userId: string, setId: string): Promise<{ slip: SlipRecord; tx: TxRow | null }[]>;
  /** True for exactly one caller per (user, set): that caller sends the batch reply. */
  claimBatch(userId: string, setId: string): Promise<boolean>;
  /**
   * Image sets whose oldest slip is at least `olderThanMs` old, still short of `set_total`
   * members, and never claimed. Normally every image in a set arrives and records itself, so
   * the last one to land sends the summary — but if one image's event is lost (a crash, a
   * timeout, a webhook LINE never redelivers), no one is ever "the last one" and the group
   * would wait forever. The scheduled sweep in scheduled.ts calls this to rescue those.
   */
  staleBatches(olderThanMs: number): Promise<StaleBatch[]>;
}
