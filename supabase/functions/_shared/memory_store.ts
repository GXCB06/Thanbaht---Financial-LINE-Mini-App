// In-memory Store for tests. NOT imported by the deployed function.
// It enforces the same rules as supabase/migrations/*_init.sql (the partial unique index on
// trans_ref and the review constraint), so tests exercise the real duplicate behaviour.

import { DuplicateRefError, type Store } from './store.ts';
import type { Category, NewTx, Profile, SlipRecord, TxRow } from './types.ts';

export class MemoryStore implements Store {
  events = new Set<string>();
  profiles = new Map<string, Profile>();
  txs: TxRow[] = [];
  slips = new Map<string, SlipRecord>();
  batches = new Set<string>();
  rules = new Map<string, Category>();
  images = new Map<string, { bytes: Uint8Array; mime: string }>();
  private seq = 0;

  async markEventSeen(id: string) {
    if (this.events.has(id)) return false;
    this.events.add(id);
    return true;
  }

  async ensureProfile(userId: string) {
    let p = this.profiles.get(userId);
    if (!p) {
      p = { line_user_id: userId, display_name: null, owner_names: [], monthly_budget: 22000 };
      this.profiles.set(userId, p);
    }
    return p;
  }

  async saveImage(userId: string, messageId: string, bytes: Uint8Array, mime: string) {
    const path = `${userId}/${messageId}.${mime.includes('png') ? 'png' : 'jpg'}`;
    this.images.set(path, { bytes, mime });
    return path;
  }

  /** The unique index from the migration. */
  private indexed(t: TxRow) {
    return !!t.trans_ref && t.status !== 'deleted' && !t.allow_dup && t.review_kind !== 'dup';
  }

  private check(t: TxRow, others: TxRow[]) {
    if ((t.status === 'review') !== (t.review_kind !== null)) throw new Error('violates review_has_kind');
    if (this.indexed(t) && others.some(o => o.id !== t.id && o.user_id === t.user_id && o.trans_ref === t.trans_ref && this.indexed(o))) {
      throw new DuplicateRefError();
    }
  }

  async findByRef(userId: string, ref: string) {
    return (
      this.txs
        .filter(t => t.user_id === userId && t.trans_ref === ref && t.status !== 'deleted' && t.review_kind !== 'dup')
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
    );
  }

  async insertTx(tx: NewTx) {
    const row: TxRow = { ...tx, id: crypto.randomUUID(), created_at: new Date(Date.UTC(2026, 8, 23, 0, 0, this.seq++)).toISOString() };
    this.check(row, this.txs);
    this.txs.push(row);
    return { ...row };
  }

  async getTx(userId: string, id: string) {
    const t = this.txs.find(x => x.id === id && x.user_id === userId);
    return t ? { ...t } : null;
  }

  async updateTx(userId: string, id: string, patch: Partial<NewTx>) {
    const i = this.txs.findIndex(x => x.id === id && x.user_id === userId);
    if (i < 0) throw new Error('not found');
    const next = { ...this.txs[i], ...patch };
    this.check(next, this.txs);
    this.txs[i] = next;
    return { ...next };
  }

  async monthTxs(userId: string, month: string) {
    return this.txs.filter(t => t.user_id === userId && t.status !== 'deleted' && t.date.startsWith(month)).map(t => ({ ...t }));
  }

  async reviewCount(userId: string) {
    return this.txs.filter(t => t.user_id === userId && t.status === 'review').length;
  }

  async getRules(userId: string) {
    const out: Record<string, Category> = {};
    for (const [k, v] of this.rules) if (k.startsWith(`${userId}|`)) out[k.slice(userId.length + 1)] = v;
    return out;
  }

  async setRule(userId: string, payeeKey: string, category: Category) {
    this.rules.set(`${userId}|${payeeKey}`, category);
  }

  async recordSlip(slip: SlipRecord) {
    this.slips.set(slip.message_id, { ...slip });
  }

  async slipsInSet(userId: string, setId: string) {
    return [...this.slips.values()]
      .filter(s => s.user_id === userId && s.set_id === setId)
      .sort((a, b) => (a.set_index ?? 0) - (b.set_index ?? 0))
      .map(slip => ({ slip: { ...slip }, tx: slip.transaction_id ? this.txs.find(t => t.id === slip.transaction_id) ?? null : null }));
  }

  async claimBatch(userId: string, setId: string) {
    const key = `${userId}|${setId}`;
    if (this.batches.has(key)) return false;
    this.batches.add(key);
    return true;
  }
}
