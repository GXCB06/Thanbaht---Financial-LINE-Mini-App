// ApiStore backed by Supabase. Runs only in the Edge Function (Deno).
// It uses the service-role key, so it bypasses RLS: every query filters by user_id itself.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ApiStore } from './api.ts';
import type { Category, NewTx, Profile, TxRow } from './types.ts';

const UNIQUE_VIOLATION = '23505';
const MAX_ROWS = 1000;

const tx = (row: Record<string, unknown>): TxRow => ({ ...(row as unknown as TxRow), amount: Number(row.amount) });

function fail(error: { message: string }, what: string): never {
  throw new Error(`${what}: ${error.message}`);
}

export class SupabaseApiStore implements ApiStore {
  constructor(private db: SupabaseClient) {}

  async ensureProfile(userId: string, displayName: string | null): Promise<Profile> {
    const cols = 'line_user_id, display_name, owner_names, monthly_budget';
    const read = () => this.db.from('profiles').select(cols).eq('line_user_id', userId).maybeSingle();
    const first = await read();
    if (first.error) fail(first.error, 'ensureProfile');
    if (first.data) {
      // remember the LINE display name the first time we see one
      if (!first.data.display_name && displayName) {
        await this.db.from('profiles').update({ display_name: displayName }).eq('line_user_id', userId);
        return { ...(first.data as Profile), display_name: displayName };
      }
      return first.data as Profile;
    }
    const ins = await this.db.from('profiles').insert({ line_user_id: userId, display_name: displayName });
    if (ins.error && (ins.error as { code?: string }).code !== UNIQUE_VIOLATION) fail(ins.error, 'create profile');
    const again = await read();
    if (again.error || !again.data) fail(again.error ?? { message: 'profile missing after insert' }, 'ensureProfile');
    return again.data as Profile;
  }

  async loadTxs(userId: string) {
    const { data, error } = await this.db
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .limit(MAX_ROWS);
    if (error) fail(error, 'loadTxs');
    return (data ?? []).map(tx);
  }

  async getTx(userId: string, id: string) {
    const { data, error } = await this.db.from('transactions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) fail(error, 'getTx');
    return data ? tx(data) : null;
  }

  async updateTx(userId: string, id: string, patch: Partial<NewTx>) {
    const { data, error } = await this.db.from('transactions').update(patch).eq('id', id).eq('user_id', userId).select('id');
    if (error) fail(error, 'updateTx');
    return (data ?? []).length > 0;
  }

  async insertTx(row: NewTx & { id: string }) {
    const { error } = await this.db.from('transactions').insert(row);
    if (!error) return true;
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) return false;
    return fail(error, 'insertTx');
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

  async setBudget(userId: string, monthlyBudget: number) {
    const { error } = await this.db.from('profiles').update({ monthly_budget: monthlyBudget }).eq('line_user_id', userId);
    if (error) fail(error, 'setBudget');
  }
}
