// Store backed by Supabase (Postgres + Storage). Runs only in the Edge Function (Deno).
// It uses the service-role key, so it bypasses RLS: every query filters by user_id itself.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { DuplicateRefError, type Store } from './store.ts';
import type { Category, NewTx, Profile, SlipRecord, TxRow } from './types.ts';

const UNIQUE_VIOLATION = '23505';

interface DbError {
  code?: string;
  message: string;
}

/** numeric columns can come back as strings; the rest of the code expects numbers. */
const tx = (row: Record<string, unknown>): TxRow => ({ ...(row as unknown as TxRow), amount: Number(row.amount) });

function fail(error: DbError, what: string): never {
  throw new Error(`${what}: ${error.message}`);
}

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  async markEventSeen(eventId: string) {
    const { error } = await this.db.from('webhook_events').insert({ event_id: eventId });
    if (!error) return true;
    if (error.code === UNIQUE_VIOLATION) return false;
    return fail(error, 'markEventSeen');
  }

  async ensureProfile(userId: string): Promise<Profile> {
    const cols = 'line_user_id, display_name, owner_names, monthly_budget';
    const read = () => this.db.from('profiles').select(cols).eq('line_user_id', userId).maybeSingle();

    const first = await read();
    if (first.error) fail(first.error, 'ensureProfile');
    if (first.data) return first.data as Profile;

    const ins = await this.db.from('profiles').insert({ line_user_id: userId });
    if (ins.error && ins.error.code !== UNIQUE_VIOLATION) fail(ins.error, 'create profile');
    const again = await read();
    if (again.error || !again.data) fail(again.error ?? { message: 'profile missing after insert' }, 'ensureProfile');
    return again.data as Profile;
  }

  async listUserIds() {
    const { data, error } = await this.db.from('profiles').select('line_user_id');
    if (error) fail(error, 'listUserIds');
    return (data ?? []).map(r => r.line_user_id as string);
  }

  async saveImage(userId: string, messageId: string, bytes: Uint8Array, mime: string) {
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/${messageId}.${ext}`;
    const { error } = await this.db.storage.from('slips').upload(path, bytes, { contentType: mime, upsert: true });
    if (error) fail(error, 'saveImage');
    return path;
  }

  async findByRef(userId: string, ref: string) {
    const { data, error } = await this.db
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('trans_ref', ref)
      .neq('status', 'deleted')
      .or('review_kind.is.null,review_kind.neq.dup')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) fail(error, 'findByRef');
    return data ? tx(data) : null;
  }

  async insertTx(row: NewTx) {
    const { data, error } = await this.db.from('transactions').insert(row).select('*').single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new DuplicateRefError();
      fail(error, 'insertTx');
    }
    return tx(data);
  }

  async getTx(userId: string, id: string) {
    const { data, error } = await this.db.from('transactions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'getTx');
    return data ? tx(data) : null;
  }

  async updateTx(userId: string, id: string, patch: Partial<NewTx>) {
    const { data, error } = await this.db.from('transactions').update(patch).eq('id', id).eq('user_id', userId).select('*').single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new DuplicateRefError();
      fail(error, 'updateTx');
    }
    return tx(data);
  }

  async monthTxs(userId: string, month: string) {
    const [y, m] = month.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    const { data, error } = await this.db
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .gte('date', `${month}-01`)
      .lt('date', `${next}-01`);
    if (error) fail(error, 'monthTxs');
    return (data ?? []).map(tx);
  }

  async reviewCount(userId: string) {
    const { count, error } = await this.db
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'review');
    if (error) fail(error, 'reviewCount');
    return count ?? 0;
  }

  async getRules(userId: string) {
    const { data, error } = await this.db.from('payee_rules').select('payee_key, category').eq('user_id', userId);
    if (error) fail(error, 'getRules');
    return Object.fromEntries((data ?? []).map(r => [r.payee_key as string, r.category as Category]));
  }

  async setRule(userId: string, payeeKey: string, category: Category) {
    const { error } = await this.db.from('payee_rules').upsert({ user_id: userId, payee_key: payeeKey, category }, { onConflict: 'user_id,payee_key' });
    if (error) fail(error, 'setRule');
  }

  async recordSlip(slip: SlipRecord) {
    const { error } = await this.db.from('slips').upsert(slip, { onConflict: 'message_id' });
    if (error) fail(error, 'recordSlip');
  }

  async slipsInSet(userId: string, setId: string) {
    const { data, error } = await this.db.from('slips').select('*').eq('user_id', userId).eq('set_id', setId).order('set_index', { ascending: true });
    if (error) fail(error, 'slipsInSet');
    const slips = (data ?? []) as SlipRecord[];
    const ids = slips.map(s => s.transaction_id).filter((x): x is string => !!x);
    const byId = new Map<string, TxRow>();
    if (ids.length) {
      const res = await this.db.from('transactions').select('*').eq('user_id', userId).in('id', ids);
      if (res.error) fail(res.error, 'slipsInSet transactions');
      for (const r of res.data ?? []) byId.set(r.id as string, tx(r));
    }
    return slips.map(slip => ({ slip, tx: slip.transaction_id ? byId.get(slip.transaction_id) ?? null : null }));
  }

  async claimBatch(userId: string, setId: string) {
    const { error } = await this.db.from('batch_replies').insert({ user_id: userId, set_id: setId });
    if (!error) return true;
    if (error.code === UNIQUE_VIOLATION) return false;
    return fail(error, 'claimBatch');
  }
}
