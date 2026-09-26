// Checks for the Mini App API (supabase/functions/_shared/api.ts), with a fake database.
// Run: npm run verify:api
import { handleApi, cleanNewTx, cleanPatch, lineIdTokenVerifier, type ApiDeps, type ApiStore } from '../supabase/functions/_shared/api.ts';
import { payeeKey } from '../supabase/functions/_shared/names.ts';
import type { Category, NewTx, Profile, TxRow } from '../supabase/functions/_shared/types.ts';

let failed = 0;
let total = 0;
const check = (name: string, ok: unknown, detail?: unknown) => {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${JSON.stringify(detail)}`}`);
};
const section = (s: string) => console.log(`\n# ${s}`);

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

const row = (o: Partial<TxRow> = {}): TxRow => ({
  id: ID_A, user_id: 'U-alice', title: 'กาแฟ', category: 'Food & Dining', amount: -65, date: '2026-09-26', time: '09:00', account: 'cash',
  source: 'text', status: 'ok', review_kind: null, review_dup_of: null, said: 'กาแฟ 65', note: null, trans_ref: null, verified: false,
  slip: null, image_path: null, excluded: false, split_n: null, prev_category: null, allow_dup: false, created_at: '2026-09-26T02:00:00Z', ...o,
});

class FakeApiStore implements ApiStore {
  txs: TxRow[] = [];
  profiles = new Map<string, Profile>();
  rules = new Map<string, Record<string, Category>>();
  async ensureProfile(userId: string, name: string | null) {
    let p = this.profiles.get(userId);
    if (!p) this.profiles.set(userId, (p = { line_user_id: userId, display_name: name, owner_names: [], monthly_budget: 22000 }));
    return p;
  }
  async loadTxs(userId: string) { return this.txs.filter(t => t.user_id === userId && t.status !== 'deleted'); }
  async getTx(userId: string, id: string) { return this.txs.find(t => t.id === id && t.user_id === userId) ?? null; }
  async updateTx(userId: string, id: string, patch: Partial<NewTx>) {
    const t = this.txs.find(x => x.id === id && x.user_id === userId);
    if (!t) return false;
    Object.assign(t, patch);
    return true;
  }
  async insertTx(r: NewTx & { id: string }) {
    if (this.txs.some(t => t.id === r.id)) return false;
    this.txs.push({ ...r, created_at: '2026-09-26T03:00:00Z' });
    return true;
  }
  async getRules(userId: string) { return this.rules.get(userId) ?? {}; }
  async setRule(userId: string, key: string, c: Category) { this.rules.set(userId, { ...(this.rules.get(userId) ?? {}), [key]: c }); }
  async setBudget(userId: string, n: number) { const p = await this.ensureProfile(userId, null); p.monthly_budget = n; }
}

// tokens: "tok-alice" → Alice, "tok-bob" → Bob, anything else is invalid
const tokens: Record<string, { sub: string; name?: string }> = { 'tok-alice': { sub: 'U-alice', name: 'Alice' }, 'tok-bob': { sub: 'U-bob', name: 'Bob' } };
function world() {
  const store = new FakeApiStore();
  const deps: ApiDeps = { store, verifyIdToken: async t => tokens[t] ?? null };
  const call = async (body: unknown, token: string | null = 'tok-alice', method = 'POST') => {
    const res = await handleApi(new Request('https://example.test/app-api', { method, headers: { 'content-type': 'application/json', ...(token ? { 'x-line-id-token': token } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined }), deps);
    return { res, json: (await res.json().catch(() => null)) as Record<string, any> | null };
  };
  return { store, deps, call };
}

/* ================================================================== */
section('Who is calling');
{
  const w = world();
  check('no token → 401', (await w.call({ action: 'load' }, null)).res.status === 401);
  check('a token LINE does not accept → 401', (await w.call({ action: 'load' }, 'forged')).res.status === 401);
  check('GET is refused', (await w.call({}, 'tok-alice', 'GET')).res.status === 405);
  const pre = await handleApi(new Request('https://example.test/app-api', { method: 'OPTIONS' }), w.deps);
  check('CORS preflight is answered and allows the token header', pre.status === 204 && (pre.headers.get('access-control-allow-headers') ?? '').includes('x-line-id-token'));
  const { res } = await w.call({ action: 'load' });
  check('every answer carries CORS headers', res.headers.get('access-control-allow-origin') === '*');
  check('unknown action → 400', (await w.call({ action: 'drop tables' })).res.status === 400);
}

section('Loading');
{
  const w = world();
  w.store.txs.push(row({ id: ID_A }), row({ id: ID_B, user_id: 'U-bob', title: 'Bob only' }), row({ id: ID_C, status: 'deleted' }));
  w.store.rules.set('U-alice', { 'roots': 'Food & Dining' });
  const { json } = await w.call({ action: 'load' });
  check('returns only my records, not other users\' and not deleted ones', json?.transactions.length === 1 && json.transactions[0].id === ID_A, json?.transactions);
  check('returns my profile and rules', json?.profile.monthly_budget === 22000 && json.rules.roots === 'Food & Dining');
  check('a first-time user gets a profile with their LINE name', w.store.profiles.get('U-alice')?.display_name === 'Alice');
  const bob = await w.call({ action: 'load' }, 'tok-bob');
  check('Bob sees Bob', bob.json?.transactions.length === 1 && bob.json.transactions[0].title === 'Bob only');
}

section('Saving changes');
{
  const w = world();
  w.store.txs.push(row({ id: ID_A }), row({ id: ID_B, user_id: 'U-bob' }));

  let r = await w.call({ action: 'save', updates: [{ id: ID_A, patch: { category: 'Transport', title: 'แท็กซี่' } }] });
  check('a category change is saved', r.json?.ok === true && w.store.txs[0].category === 'Transport' && w.store.txs[0].title === 'แท็กซี่', r.json);

  r = await w.call({ action: 'save', updates: [{ id: ID_B, patch: { category: 'Shopping' } }] });
  check('cannot change someone else\'s record', r.json?.ok === false && r.json.failed.includes(ID_B) && w.store.txs[1].category === 'Food & Dining', r.json);

  for (const [name, patch] of [
    ['verified', { verified: true }], ['user_id', { user_id: 'U-bob' }], ['trans_ref', { trans_ref: 'x' }], ['slip', { slip: {} }],
    ['image_path', { image_path: 'a/b.jpg' }], ['a bad category', { category: 'Gambling' }], ['a zero amount', { amount: 0 }], ['an absurd amount', { amount: 1e12 }],
    ['a bad date', { date: '2026-02-31' }], ['a bad time', { time: '25:00' }], ['a bad status', { status: 'admin' }], ['an empty title', { title: '  ' }],
  ] as [string, unknown][]) {
    r = await w.call({ action: 'save', updates: [{ id: ID_A, patch }] });
    check(`refuses ${name}`, r.json?.ok === false && w.store.txs[0].verified === false && w.store.txs[0].user_id === 'U-alice' && w.store.txs[0].amount === -65, [patch, r.json]);
  }
  check('refusing a patch leaves the rest untouched', w.store.txs[0].date === '2026-09-26' && w.store.txs[0].time === '09:00');

  r = await w.call({ action: 'save', updates: [{ id: 'not-a-uuid', patch: { category: 'Transport' } }] });
  check('a malformed id is refused', r.json?.ok === false);

  // Confirming a possible duplicate means "keep both": the database rule needs allow_dup
  w.store.txs.push(row({ id: ID_C, status: 'review', review_kind: 'dup', review_dup_of: ID_A, trans_ref: 'KB1' }));
  r = await w.call({ action: 'save', updates: [{ id: ID_C, patch: { status: 'ok', review_kind: null, review_dup_of: null } }] });
  check('keeping a duplicate sets allow_dup so the unique rule allows it', r.json?.ok === true && w.store.txs[2].allow_dup === true && w.store.txs[2].status === 'ok');
  w.store.txs.push(row({ id: '44444444-4444-4444-8444-444444444444', status: 'review', review_kind: 'dup', trans_ref: 'KB2' }));
  r = await w.call({ action: 'save', updates: [{ id: '44444444-4444-4444-8444-444444444444', patch: { status: 'deleted', review_kind: null } }] });
  check('discarding a duplicate does not set allow_dup', r.json?.ok === true && w.store.txs[3].allow_dup === false && w.store.txs[3].status === 'deleted');

  r = await w.call({ action: 'save', budget: 30000, rules: [{ key: payeeKey('ร้าน ABC'), category: 'Shopping' }, { key: 'x', category: 'Income' }, { key: 'y', category: 'Gambling' }] });
  check('budget saved', w.store.profiles.get('U-alice')?.monthly_budget === 30000);
  check('rules are stored under the key given, and only for real spending categories', JSON.stringify(w.store.rules.get('U-alice')) === JSON.stringify({ [payeeKey('ร้าน ABC')]: 'Shopping' }), w.store.rules.get('U-alice'));
  r = await w.call({ action: 'save', budget: -5 });
  check('a bad budget is ignored', w.store.profiles.get('U-alice')?.monthly_budget === 30000);
}

section('Adding records typed in the app');
{
  const w = world();
  const good = { id: ID_A, title: 'ข้าว', category: 'Food & Dining', amount: -60, date: '2026-09-26', time: '12:00', account: 'cash', source: 'text', said: 'ข้าว 60' };
  let r = await w.call({ action: 'save', adds: [good] });
  check('a typed expense is stored for me', r.json?.ok === true && w.store.txs.length === 1 && w.store.txs[0].user_id === 'U-alice' && w.store.txs[0].source === 'text');
  r = await w.call({ action: 'save', adds: [good] });
  check('sending it again (a retry) does not duplicate it', w.store.txs.length === 1);
  r = await w.call({ action: 'save', adds: [{ ...good, id: ID_B, verified: true, user_id: 'U-bob', trans_ref: 'FAKE', slip: { x: 1 } } as never] });
  check('a client can neither mark a new record verified nor give it a bank ref', r.json?.ok === false || (w.store.txs.length === 2 && w.store.txs[1].verified === false && w.store.txs[1].trans_ref === null && w.store.txs[1].user_id === 'U-alice'), w.store.txs[1]);
  check('cleanNewTx forces verified false and my user id', (() => { const c = cleanNewTx({ ...good, id: ID_C }, 'U-alice'); return !!c && c.verified === false && c.user_id === 'U-alice' && c.trans_ref === null && c.slip === null; })());
  check('a record without an id is refused', cleanNewTx({ ...good, id: undefined }, 'U-alice') === null);
  check('a deleted record cannot be added', cleanNewTx({ ...good, id: ID_C, status: 'deleted' }, 'U-alice') === null);
  check('a review record needs a reason', cleanNewTx({ ...good, id: ID_C, status: 'review' }, 'U-alice') === null && cleanNewTx({ ...good, id: ID_C, status: 'review', review_kind: 'who' }, 'U-alice')?.review_kind === 'who');
  check('the review reason is dropped when the record is ok', cleanNewTx({ ...good, id: ID_C, review_kind: 'who' }, 'U-alice')?.review_kind === null);
  check('cleanPatch refuses an empty patch and non-objects', cleanPatch({}) === null && cleanPatch(null) === null && cleanPatch([1]) === null);
}

section('Asking LINE to verify tokens');
{
  let calls = 0;
  let bodySeen = '';
  let clock = 1_000_000_000_000;
  const ok = (async (_u: string, init: RequestInit) => {
    calls++;
    bodySeen = String(init.body);
    return new Response(JSON.stringify({ sub: 'U-real', name: 'Real', exp: clock / 1000 + 3600, aud: '2011637665' }), { status: 200 });
  }) as unknown as typeof fetch;
  const v = lineIdTokenVerifier('2011637665', ok, () => clock);
  const a = await v('tokA');
  check('a valid token gives the LINE user id and name', a?.sub === 'U-real' && a.name === 'Real');
  check('LINE is asked with our channel id', bodySeen.includes('client_id=2011637665') && bodySeen.includes('id_token=tokA'));
  await v('tokA');
  check('the same token is not re-verified within its lifetime', calls === 1);
  clock += 3_601_000;
  await v('tokA');
  check('it is verified again once expired', calls === 2);
  const bad = lineIdTokenVerifier('2011637665', (async () => new Response('{"error":"invalid_request"}', { status: 400 })) as unknown as typeof fetch);
  check('LINE rejecting a token → null', (await bad('x')) === null);
  const down = lineIdTokenVerifier('2011637665', (async () => { throw new Error('network'); }) as unknown as typeof fetch);
  check('LINE unreachable → null, not a crash', (await down('x')) === null);
  const expired = lineIdTokenVerifier('2011637665', (async () => new Response(JSON.stringify({ sub: 'U', exp: 1 }), { status: 200 })) as unknown as typeof fetch, () => 5_000);
  check('an already-expired token → null', (await expired('x')) === null);
  const nosub = lineIdTokenVerifier('2011637665', (async () => new Response(JSON.stringify({ exp: 9e9 }), { status: 200 })) as unknown as typeof fetch);
  check('a response without a user id → null', (await nosub('x')) === null);
}

console.log(failed ? `\n${failed} of ${total} checks failed` : `\nAll ${total} checks passed`);
process.exit(failed ? 1 : 0);
