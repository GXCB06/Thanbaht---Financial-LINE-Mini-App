// End-to-end checks for the LINE webhook, with fake LINE / Gemini / database.
// Run: npm run verify:server
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { flushStaleBatches, handleWebhook, type Deps } from '../supabase/functions/_shared/handler.ts';
import { HttpLineClient, LineApiError, verifySignature, type LineClient } from '../supabase/functions/_shared/line.ts';
import { buildRequest, DEFAULT_MODELS, Gemini, GeminiError, parseReading } from '../supabase/functions/_shared/gemini.ts';
import { MemoryStore } from '../supabase/functions/_shared/memory_store.ts';
import { lazyStore } from '../supabase/functions/_shared/lazy_store.ts';
import { DuplicateRefError } from '../supabase/functions/_shared/store.ts';
import { createFlex } from '../supabase/functions/_shared/flex.ts';
import { bangkokNow, normalizeDateTime } from '../supabase/functions/_shared/clock.ts';
import { parseQuick, splitExpenses } from '../supabase/functions/_shared/parse.ts';
import { payeeKey, sameOwner } from '../supabase/functions/_shared/names.ts';
import { digestData, monthStats } from '../supabase/functions/_shared/logic.ts';
import { runDailyDigest } from '../supabase/functions/_shared/scheduled.ts';
import type { LineMessage, NewTx, SlipReading, SlipRecord, TxRow } from '../supabase/functions/_shared/types.ts';
// The mock used by chat/index.html: the server's Flex output must match it
import * as mockFlex from '../chat/flex.js';

let failed = 0;
let total = 0;
function check(name: string, ok: unknown, detail?: unknown) {
  total++;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}
const same = (name: string, actual: unknown, expected: unknown) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const section = (s: string) => console.log(`\n# ${s}`);

/* ------------------------------------------------------------------ */
/* Fakes                                                               */
/* ------------------------------------------------------------------ */

const SECRET = 'test-channel-secret';
const APP = mockFlex.LIFF as string;
const NOW = new Date('2026-09-23T05:50:00Z'); // Wed 23 Sep 2026, 12:50 in Bangkok
const enc = new TextEncoder();

class FakeLine implements LineClient {
  replies: { token: string; messages: LineMessage[] }[] = [];
  pushes: { to: string; messages: LineMessage[]; retryKey?: string }[] = [];
  loadings: string[] = [];
  content = new Map<string, { bytes: Uint8Array; mime: string }>();
  rejectTokens = new Set<string>();
  failContent = new Set<string>();
  failPushTo = new Set<string>();
  async reply(token: string, messages: LineMessage[]) {
    if (this.rejectTokens.has(token)) throw new LineApiError(400, 'Invalid reply token', 'reply');
    this.replies.push({ token, messages });
  }
  async push(to: string, messages: LineMessage[], retryKey?: string) {
    if (this.failPushTo.has(to)) throw new LineApiError(403, 'blocked', 'push');
    this.pushes.push({ to, messages, retryKey });
  }
  async getContent(id: string) {
    if (this.failContent.has(id)) throw new LineApiError(404, 'gone', 'content');
    const c = this.content.get(id);
    if (!c) throw new LineApiError(404, 'no content', 'content');
    return c;
  }
  async showLoading(userId: string) {
    this.loadings.push(userId);
  }
  get sent() {
    return [...this.replies.map(r => r.messages), ...this.pushes.map(p => p.messages)];
  }
  get allMessages() {
    return this.sent.flat();
  }
}

class CountingStore extends MemoryStore {
  raceHits = 0;
  /** While > 0, slipsInSet holds callers until all of them have recorded their slip. */
  setBarrierLeft = 0;
  private setArrived: (() => void)[] = [];
  async slipsInSet(userId: string, setId: string) {
    if (this.setBarrierLeft > 0) {
      this.setBarrierLeft--;
      await new Promise<void>(release => {
        this.setArrived.push(release);
        if (this.setBarrierLeft === 0) this.setArrived.forEach(r => r());
      });
    }
    return super.slipsInSet(userId, setId); // read only after everyone has recorded
  }
  /** While > 0, findByRef makes callers wait for each other after reading. Forces a real race. */
  barrierLeft = 0;
  private arrived: (() => void)[] = [];
  async findByRef(userId: string, ref: string) {
    const found = await super.findByRef(userId, ref); // both racers read "nothing there" first
    if (this.barrierLeft > 0) {
      this.barrierLeft--;
      await new Promise<void>(release => {
        this.arrived.push(release);
        if (this.barrierLeft === 0) this.arrived.forEach(r => r());
      });
    }
    return found;
  }
  async insertTx(tx: NewTx) {
    try {
      return await super.insertTx(tx);
    } catch (e) {
      if (e instanceof DuplicateRefError) this.raceHits++;
      throw e;
    }
  }

  /** Simulates one image's event dying before it ever records itself (a crash, a lost webhook). */
  failRecordSlipFor = new Set<string>();
  async recordSlip(slip: SlipRecord) {
    if (this.failRecordSlipFor.has(slip.message_id)) throw new Error('simulated: this event never recorded its slip');
    return super.recordSlip(slip);
  }
}

function world() {
  const line = new FakeLine();
  const store = new CountingStore();
  const logs: unknown[] = [];
  const deps: Deps = {
    channelSecret: SECRET,
    appUrl: APP,
    line,
    store,
    // The "image" is the slip's JSON, so the real parser is exercised too
    readSlip: async bytes => parseReading(new TextDecoder().decode(bytes)),
    transcribe: async bytes => new TextDecoder().decode(bytes),
    now: () => NOW,
    log: (m, d) => logs.push([m, d]),
  };
  return { line, store, deps, logs };
}

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('base64');

type Ev = Record<string, unknown>;
let evSeq = 0;
const base = (user: string, token?: string): Ev => ({
  webhookEventId: `evt-${++evSeq}`,
  source: { type: 'user', userId: user },
  replyToken: token ?? `tok-${evSeq}`,
  timestamp: NOW.getTime(),
  mode: 'active',
});

const imageEv = (user: string, id: string, o: { set?: { id: string; index: number; total: number }; token?: string } = {}): Ev => ({
  ...base(user, o.token),
  type: 'message',
  message: { type: 'image', id, contentProvider: { type: 'line' }, ...(o.set ? { imageSet: o.set } : {}) },
});
const textEv = (user: string, text: string): Ev => ({ ...base(user), type: 'message', message: { type: 'text', id: `m${++evSeq}`, text } });
const audioEv = (user: string, id: string): Ev => ({ ...base(user), type: 'message', message: { type: 'audio', id, duration: 2000, contentProvider: { type: 'line' } } });
const postbackEv = (user: string, data: string): Ev => ({ ...base(user), type: 'postback', postback: { data } });
const followEv = (user: string): Ev => ({ ...base(user), type: 'follow' });

async function post(w: ReturnType<typeof world>, events: Ev[], opts: { secret?: string; badSig?: boolean; noSig?: boolean; method?: string } = {}) {
  const body = JSON.stringify({ destination: 'Ubot', events });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (!opts.noSig) headers['x-line-signature'] = opts.badSig ? sign(body + 'x') : sign(body, opts.secret);
  return handleWebhook(new Request('https://example.test/line-webhook', { method: opts.method ?? 'POST', headers, body: opts.method === 'GET' ? undefined : body }), w.deps);
}

function slipJson(o: Partial<SlipReading> & { receiver?: string; sender?: string; account?: string } = {}) {
  return JSON.stringify({
    isSlip: true, bank: 'kbank', direction: 'out', amount: 140,
    senderName: o.sender ?? 'นาย ธัญญ์พิสิษฐ์ โ.', senderAccount: 'xxx-x-x8941-x',
    receiverName: o.receiver ?? 'Roots Coffee', receiverAccount: o.account ?? 'xxx-xxx-4122',
    ref: 'KB20260923083012345', datetime: '2026-09-23T08:30', memo: null, confidence: 0.95, ...o,
  });
}
const give = (w: ReturnType<typeof world>, id: string, content: string, mime = 'image/jpeg') => w.line.content.set(id, { bytes: enc.encode(content), mime });

const U = 'U-alice';
const V = 'U-bob';
const rows = (w: ReturnType<typeof world>, user = U) => w.store.txs.filter(t => t.user_id === user);
const textsIn = (msgs: LineMessage[]) => JSON.stringify(msgs);
const flexOf = (m: LineMessage) => m as unknown as { type: 'flex'; altText: string; contents: { type: string }; quickReply?: { items: unknown[] } };

const earlier: NewTx = {
  user_id: U, title: 'ร้านอาหารข้าวต้มปลา XYZ', category: 'Food & Dining', amount: -450, date: '2026-09-23', time: '12:42',
  account: 'kbank', source: 'slip', status: 'ok', review_kind: null, review_dup_of: null, said: null, note: null,
  trans_ref: 'KB-EARLIER-1', verified: false, slip: null, image_path: null, excluded: false, split_n: null, prev_category: null, allow_dup: false,
};

/* ================================================================== */
section('Signature');
{
  const body = '{"events":[]}';
  const good = sign(body);
  check('valid signature accepted', await verifySignature(SECRET, body, good));
  check('wrong secret rejected', !(await verifySignature('other', body, good)));
  check('tampered body rejected', !(await verifySignature(SECRET, body + ' ', good)));
  check('missing signature rejected', !(await verifySignature(SECRET, body, null)));
  check('garbage signature rejected', !(await verifySignature(SECRET, body, '%%%not-base64%%%')));
  check('empty secret rejected', !(await verifySignature('', body, good)));

  const w = world();
  const bad = await post(w, [textEv(U, 'coffee 65')], { badSig: true });
  check('bad signature → 401 and nothing happens', bad.status === 401 && w.store.txs.length === 0 && w.line.sent.length === 0 && w.store.profiles.size === 0);
  check('no signature → 401', (await post(w, [textEv(U, 'coffee 65')], { noSig: true })).status === 401);
  check('GET → 405', (await post(w, [], { method: 'GET' })).status === 405);
  check('empty events (LINE "Verify" button) → 200', (await post(w, [])).status === 200);
}

/* ================================================================== */
section('A single slip becomes a receipt card');
{
  const w = world();
  await w.store.ensureProfile(U);
  await w.store.insertTx(earlier);
  give(w, 'img1', slipJson());
  const res = await post(w, [imageEv(U, 'img1', { token: 'T1' })]);
  check('responds 200', res.status === 200);
  const t = rows(w).find(r => r.title === 'Roots Coffee');
  check('record stored', !!t);
  check('category from keywords', t?.category === 'Food & Dining', t?.category);
  check('expense is negative', t?.amount === -140);
  check('date and time come from the slip, not the clock', t?.date === '2026-09-23' && t?.time === '08:30', [t?.date, t?.time]);
  check('bank mapped', t?.account === 'kbank');
  check('reference kept for duplicate detection', t?.trans_ref === 'KB20260923083012345');
  check('not marked verified without a verifier', t?.verified === false);
  check('slip details kept for the app', t?.slip?.refNo === 'KB20260923083012345' && t?.slip?.dateTimeStr === '23/09/69 08:30', t?.slip);
  check('image saved before reading', w.store.images.has(`${U}/img1.jpg`) && t?.image_path === `${U}/img1.jpg`);
  same('slip recorded', w.store.slips.get('img1')?.status, 'ok');
  same('loading animation shown', w.line.loadings, [U]);
  same('one reply, on the event token', w.line.replies.map(r => r.token), ['T1']);
  const card = flexOf(w.line.replies[0].messages[0]);
  check('reply is a Flex receipt', card.type === 'flex' && card.contents.type === 'bubble');
  const s = textsIn(w.line.replies[0].messages);
  check('receipt shows the amount', s.includes('−฿140'));
  check('receipt: today = 450 + 140 over 2 records', s.includes('฿590 · 2 records'), s.slice(0, 0));
  check('receipt: category month total / budget', s.includes('฿590 / ฿6,500'));
  check('receipt says it was read from the slip, not verified', s.includes('read from slip') && !s.includes('QR verified'));
  check('Details button opens the Mini App at the record', s.includes(`${APP}/tx/${t?.id}`));
}

/* ================================================================== */
section('Verified only when a verifier says so');
{
  const w = world();
  w.deps.verifySlip = async () => true;
  give(w, 'v1', slipJson());
  await post(w, [imageEv(U, 'v1')]);
  check('verifier true → verified', rows(w)[0]?.verified === true && textsIn(w.line.allMessages).includes('QR verified'));
  const w2 = world();
  w2.deps.verifySlip = async () => {
    throw new Error('service down');
  };
  give(w2, 'v2', slipJson());
  await post(w2, [imageEv(U, 'v2')]);
  check('verifier down → still logged, just not verified', rows(w2)[0]?.verified === false && rows(w2).length === 1);
}

/* ================================================================== */
section('Unknown payee → ask, remember, then never ask again');
{
  const w = world();
  give(w, 'p1', slipJson({ amount: 300, receiver: 'นางสาว ส. ใจดี', bank: 'scb', ref: 'SCB-P1-000001', datetime: '2026-09-23T19:05' }));
  await post(w, [imageEv(U, 'p1')]);
  const t = rows(w)[0];
  check('goes to review as "who"', t.status === 'review' && t.review_kind === 'who' && t.category === 'Uncategorized', [t.status, t.review_kind]);
  const card = flexOf(w.line.replies[0].messages[0]);
  check('replies with the "who is this" card', textsIn([w.line.replies[0].messages[0]]).includes('WHO IS THIS?'));
  check('with 6 category quick replies', card.quickReply?.items.length === 6);

  await post(w, [postbackEv(U, `act=cat&tx=${t.id}&c=grocery&rule=1`)]);
  const after = rows(w)[0];
  check('button files it and clears the review flag', after.status === 'ok' && after.category === 'Groceries' && after.review_kind === null, after);
  same('rule saved for this person', await w.store.getRules(U), { [payeeKey('นางสาว ส. ใจดี')]: 'Groceries' });
  check('confirmation is a receipt', textsIn(w.line.replies.at(-1)!.messages).includes('Logged ✓'));

  give(w, 'p2', slipJson({ amount: 120, receiver: 'นางสาว ส. ใจดี', bank: 'scb', ref: 'SCB-P2-000002', datetime: '2026-09-23T20:00' }));
  await post(w, [imageEv(U, 'p2')]);
  const second = rows(w).find(r => r.trans_ref === 'SCB-P2-000002')!;
  check('next slip to the same person is filed automatically', second.status === 'ok' && second.category === 'Groceries', [second.status, second.category]);
}

/* ================================================================== */
section('Duplicate slips');
{
  const w = world();
  give(w, 'a', slipJson({ receiver: 'Grab', amount: 120, ref: 'KB-GRAB-441029' }));
  give(w, 'b', slipJson({ receiver: 'Grab', amount: 120, ref: 'KB-GRAB-441029' }));
  await post(w, [imageEv(U, 'a')]);
  await post(w, [imageEv(U, 'b')]);
  const [orig, dup] = rows(w);
  check('first copy is logged', orig.status === 'ok');
  check('second copy waits in review as a duplicate of the first', dup.status === 'review' && dup.review_kind === 'dup' && dup.review_dup_of === orig.id, dup);
  check('reply is the duplicate card', textsIn(w.line.replies[1].messages).includes('POSSIBLE DUPLICATE'));
  check('spending is not double counted', monthStats(rows(w), bangkokNow(NOW)).spent === 120);

  const repliesBefore = w.line.replies.length;
  await post(w, [postbackEv(U, `act=discard&tx=${dup.id}`)]);
  check('Discard removes the duplicate', rows(w)[1].status === 'deleted');
  await post(w, [postbackEv(U, `act=discard&tx=${dup.id}`)]);
  check('pressing Discard again does nothing', w.line.replies.length === repliesBefore + 1);
  await post(w, [postbackEv(U, `act=discard&tx=${orig.id}`)]);
  check('Discard can never delete a normal record', rows(w)[0].status === 'ok');

  give(w, 'c', slipJson({ receiver: 'Grab', amount: 120, ref: 'KB-GRAB-441029' }));
  await post(w, [imageEv(U, 'c')]);
  const dup2 = rows(w).at(-1)!;
  await post(w, [postbackEv(U, `act=keep&tx=${dup2.id}`)]);
  const kept = rows(w).at(-1)!;
  check('Keep both makes it a normal record', kept.status === 'ok' && kept.allow_dup && kept.review_kind === null, kept);
  check('and both now count', monthStats(rows(w), bangkokNow(NOW)).spent === 240);
}

/* ================================================================== */
section('Two copies of the same slip at the same instant');
{
  const w = world();
  w.store.barrierLeft = 2; // both must have checked "is this ref already logged?" before either saves
  give(w, 'x1', slipJson({ receiver: 'Grab', amount: 120, ref: 'KB-RACE-000001' }));
  give(w, 'x2', slipJson({ receiver: 'Grab', amount: 120, ref: 'KB-RACE-000001' }));
  await Promise.all([post(w, [imageEv(U, 'x1')]), post(w, [imageEv(U, 'x2')])]);
  const r = rows(w);
  check('exactly one is logged and one is a duplicate', r.filter(t => t.status === 'ok').length === 1 && r.filter(t => t.review_kind === 'dup').length === 1, r.map(t => [t.status, t.review_kind]));
  check('the race really happened and the database stopped it', w.store.raceHits >= 1, `raceHits=${w.store.raceHits}`);
  check('both senders got an answer', w.line.replies.length === 2);
  check('total spending counted once', monthStats(r, bangkokNow(NOW)).spent === 120);
}

/* ================================================================== */
section('Several slips sent together (imageSet)');
{
  // arriving in separate requests, one after another
  const w = world();
  give(w, 's1', slipJson({ receiver: "Lotus's Rama 4", amount: 386, bank: 'ktb', ref: 'KTB-S1-000001', datetime: '2026-09-23T18:20' }));
  give(w, 's2', slipJson({ receiver: 'After You', amount: 245, bank: 'scb', ref: 'SCB-S2-000002', datetime: '2026-09-23T19:40' }));
  give(w, 's3', 'this is a cat photo, not a slip');
  const set = (i: number) => ({ id: 'set-1', index: i, total: 3 });
  await post(w, [imageEv(U, 's1', { set: set(1) })]);
  check('no reply until the last image', w.line.sent.length === 0);
  await post(w, [imageEv(U, 's2', { set: set(2) })]);
  check('still waiting after two of three', w.line.sent.length === 0);
  await post(w, [imageEv(U, 's3', { set: set(3) })]);
  check('one summary reply once the last arrives', w.line.replies.length === 1 && w.line.pushes.length === 0);
  const msgs = w.line.replies[0].messages;
  const s = textsIn(msgs);
  check('summary carousel', flexOf(msgs[0]).contents.type === 'carousel');
  check('says how many were logged', s.includes('Logged 2 of 3'));
  check('lists the unreadable one', s.includes('unreadable slip'));
  check('banks counted', s.includes('3 SLIPS · 2 BANKS'));
  check('failed image is still recorded', w.store.slips.get('s3')?.status === 'failed');
}
{
  // all three at once, in the same request and in parallel requests
  for (const mode of ['same request', 'parallel requests'] as const) {
    const w = world();
    const ids = ['q1', 'q2', 'q3', 'q4'];
    give(w, 'q1', slipJson({ receiver: 'Tops Market', amount: 455, ref: 'REF-Q1-000001' }));
    give(w, 'q2', slipJson({ receiver: 'นางสาว ส. ใจดี', amount: 300, ref: 'REF-Q2-000002' }));
    give(w, 'q3', slipJson({ receiver: 'Tops Market', amount: 455, ref: 'REF-Q1-000001' })); // duplicate of q1
    give(w, 'q4', slipJson({ receiver: 'Bolt', amount: 95, ref: 'REF-Q4-000004' }));
    const evs = ids.map((id, i) => imageEv(U, id, { set: { id: 'set-2', index: i + 1, total: 4 } }));
    if (mode === 'same request') await post(w, evs);
    else await Promise.all(evs.map(e => post(w, [e])));
    check(`[${mode}] exactly one reply for the whole set`, w.line.replies.length + w.line.pushes.length === 1, [w.line.replies.length, w.line.pushes.length]);
    const msgs = w.line.sent[0];
    const s = textsIn(msgs);
    check(`[${mode}] summary + a card for what needs the user`, msgs.length === 3 && s.includes('WHO IS THIS?') && s.includes('POSSIBLE DUPLICATE'), msgs.length);
    check(`[${mode}] counts: 2 logged, 2 need you`, s.includes('Logged 2 of 4') && s.includes('2 need you'), s.slice(0, 0));
    check(`[${mode}] nothing double counted`, monthStats(rows(w), bangkokNow(NOW)).spent === 455 + 95, monthStats(rows(w), bangkokNow(NOW)).spent);
  }
}

/* ================================================================== */
section('Two images of a set finish at the same moment');
{
  const w = world();
  w.store.setBarrierLeft = 2; // each sees the complete set, so both believe they are the last
  give(w, 'k1', slipJson({ receiver: 'Bolt', amount: 95, ref: 'REF-K1-000001' }));
  give(w, 'k2', slipJson({ receiver: 'Grab', amount: 120, ref: 'REF-K2-000002' }));
  await Promise.all([post(w, [imageEv(U, 'k1', { set: { id: 'set-k', index: 1, total: 2 } })]), post(w, [imageEv(U, 'k2', { set: { id: 'set-k', index: 2, total: 2 } })])]);
  check('both saw a complete set, yet only one summary is sent', w.line.sent.length === 1, w.line.sent.length);
  check('and it covers both slips', textsIn(w.line.sent[0]).includes('Logged 2 of 2'));
}

/* ================================================================== */
section('A lost image in a set: the sweep rescues the batch');
{
  const w = world();
  w.store.failRecordSlipFor.add('lost2'); // this one's event dies before it ever records itself
  give(w, 'lost1', slipJson({ receiver: 'Roots Coffee', amount: 140, ref: 'REF-LOST-000001' }));
  give(w, 'lost2', slipJson({ receiver: 'Grab', amount: 120, ref: 'REF-LOST-000002' }));
  give(w, 'lost3', slipJson({ receiver: 'Bolt', amount: 95, ref: 'REF-LOST-000003' }));
  const set = (i: number) => ({ id: 'set-lost', index: i, total: 3 });
  await post(w, [imageEv(U, 'lost1', { set: set(1) })]);
  await post(w, [imageEv(U, 'lost2', { set: set(2) })]);
  await post(w, [imageEv(U, 'lost3', { set: set(3) })]);
  check(
    'lost2 gets an apology, but no batch summary ever forms since the count can never reach 3',
    w.line.replies.length === 1 && !w.line.allMessages.some(m => (m as { contents?: { type?: string } }).contents?.type === 'carousel'),
  );

  w.store.clockOffsetMs = 25_000; // the sweep only rescues sets old enough to be stuck, not ones still in flight
  const flushed = await flushStaleBatches(w.deps, 20_000);
  check('the sweep finds exactly the stuck set', flushed.length === 1 && flushed[0].setId === 'set-lost', flushed);
  check('it pushes, since a cron tick has no reply token to use', w.line.pushes.length === 1 && w.line.replies.length === 1);
  const s = textsIn(w.line.pushes[0].messages);
  check('summary counts the two that made it, against the true total of three', s.includes('Logged 2 of 3'));
  check('the missing one is flagged instead of the batch staying silent', s.includes('still processing'));

  const again = await flushStaleBatches(w.deps, 20_000);
  check('a second sweep tick does not double-send', again.length === 0 && w.line.pushes.length === 1);
}

/* ================================================================== */
section('Reply tokens that LINE rejects');
{
  const w = world();
  w.line.rejectTokens.add('EXPIRED');
  give(w, 'e1', slipJson());
  await post(w, [imageEv(U, 'e1', { token: 'EXPIRED' })]);
  check('falls back to a push message', w.line.replies.length === 0 && w.line.pushes.length === 1 && w.line.pushes[0].to === U);
  check('push carries a retry key so it cannot be delivered twice', !!w.line.pushes[0].retryKey);
  check('the record is stored regardless', rows(w).length === 1);
}

/* ================================================================== */
section('Redelivered events');
{
  const w = world();
  give(w, 'r1', slipJson());
  const ev = imageEv(U, 'r1');
  await post(w, [ev]);
  await post(w, [ev]);
  check('handled once', rows(w).length === 1 && w.line.replies.length === 1);
  const t = textEv(U, 'กาแฟ 65');
  await post(w, [t]);
  await post(w, [t]);
  check('a redelivered text is not logged twice', rows(w).filter(r => r.title === 'กาแฟ').length === 1);
}

/* ================================================================== */
section('Text messages');
{
  const w = world();
  await post(w, [textEv(U, 'กาแฟ 65')]);
  let t = rows(w).at(-1)!;
  check('"กาแฟ 65" → Food, ฿65 out, cash, typed', t.title === 'กาแฟ' && t.category === 'Food & Dining' && t.amount === -65 && t.account === 'cash' && t.source === 'text' && t.said === 'กาแฟ 65', t);
  check('replies with a receipt saying it was typed', textsIn(w.line.replies.at(-1)!.messages).includes('typed in chat'));

  await post(w, [textEv(U, 'ได้ค่าจ้าง 1,500')]);
  t = rows(w).at(-1)!;
  check('"ได้ค่าจ้าง 1,500" → Income +1500', t.category === 'Income' && t.amount === 1500, t);
  const incomeMsgs = w.line.replies.at(-1)!.messages;
  const incomeText = textsIn(incomeMsgs);
  check('income reply is a Flex card, not just text', incomeMsgs.length === 1 && flexOf(incomeMsgs[0]).type === 'flex' && flexOf(incomeMsgs[0]).contents.type === 'bubble');
  check('income card: green +฿1,500 and "Income logged"', incomeText.includes('+฿1,500') && incomeText.includes('Income logged'), incomeText.slice(0, 0));
  check('income card: month total and what is kept (income − spending)', incomeText.includes('In this month') && incomeText.includes('฿1,500') && incomeText.includes('Kept so far') && incomeText.includes('+฿1,435'), incomeText.slice(0, 0));
  check('income card says it was typed', incomeText.includes('typed in chat'));

  await post(w, [textEv(U, '7-Eleven 79')]);
  t = rows(w).at(-1)!;
  check('"7-Eleven 79" is ฿79 (not ฿7) and Groceries', t.amount === -79 && t.category === 'Groceries', [t.amount, t.category]);

  await post(w, [textEv(U, 'ค่าน้ำ 157')]);
  check('water bill is a bill, not a drink', rows(w).at(-1)!.category === 'Bills & Utilities');

  const before = rows(w).length;
  await post(w, [textEv(U, 'coffee')]);
  check('no amount → no record, a hint instead', rows(w).length === before && textsIn(w.line.replies.at(-1)!.messages).includes('coffee 65'));

  await post(w, [textEv(U, 'xyzzy 50')]);
  t = rows(w).at(-1)!;
  check('unknown item → asks instead of guessing', t.status === 'review' && t.review_kind === 'who' && textsIn(w.line.replies.at(-1)!.messages).includes('WHO IS THIS?'), t);

  await post(w, [textEv(U, 'วันนี้')]);
  check('"วันนี้" replies with the daily summary', textsIn(w.line.replies.at(-1)!.messages).includes('spent today') && textsIn(w.line.replies.at(-1)!.messages).includes('SEPTEMBER'));
}

/* ================================================================== */
section('Several expenses in one message');
{
  const w = world();
  await post(w, [textEv(U, 'กาแฟ 65 ข้าวมันไก่ 60 แท็กซี่ 180 ค่าไฟ 1200')]);
  check('four expenses on one line → four records', rows(w).length === 4, rows(w).map(t => [t.title, t.amount]));
  check('each keeps its own name, amount and category', rows(w).map(t => `${t.title}|${t.amount}|${t.category}`).join(',') === 'กาแฟ|-65|Food & Dining,ข้าวมันไก่|-60|Food & Dining,แท็กซี่|-180|Transport,ค่าไฟ|-1200|Bills & Utilities', rows(w).map(t => [t.title, t.amount, t.category]));
  const msgs = w.line.replies.at(-1)!.messages;
  const body = textsIn(msgs);
  check('one reply: a summary carousel listing every item', msgs.length === 1 && flexOf(msgs[0]).contents.type === 'carousel' && body.includes('4 EXPENSES') && body.includes('Logged 4 of 4') && body.includes('฿1,505'), body.slice(0, 0));
  check('the summary is not worded as slips', !body.includes('SLIPS') && !body.includes(' slips'));

  const w2 = world();
  await post(w2, [textEv(U, 'กาแฟ 65\nxyzzy 50\nabcde 30\nได้ค่าจ้าง 1,500\nแท็กซี่ 180')]);
  check('one per line, income included', rows(w2).length === 5 && rows(w2).some(t => t.amount === 1500));
  const m2 = w2.line.replies.at(-1)!.messages;
  const b2 = textsIn(m2);
  check('unknown items each get a question card, all within 5 messages', m2.length === 3 && (b2.match(/WHO IS THIS\?/g) ?? []).length === 2 && b2.includes('2 need you'), m2.length);
  check('unknown items wait in Review; the rest are logged', rows(w2).filter(t => t.status === 'review').length === 2 && rows(w2).filter(t => t.status === 'ok').length === 3);

  const w3 = world();
  await post(w3, [textEv(U, 'วันนี้ใช้เงินดังนี้\nกาแฟ 65\nข้าว 60')]);
  check('a heading line without an amount is ignored', rows(w3).length === 2 && rows(w3).every(t => !t.title.includes('ดังนี้')));

  const w4 = world();
  await post(w4, [textEv(U, 'ข้าว 2 จาน 60')]);
  check('"ข้าว 2 จาน 60" stays one record (2 is a quantity)', rows(w4).length === 1 && rows(w4)[0].amount === -60);
  const w5 = world();
  await post(w5, [textEv(U, 'coffee 65 and taxi 180')]);
  check('"and" separates items', rows(w5).length === 2);

  const w6 = world();
  give(w6, 'aud9', 'กาแฟ 65 บาท ข้าว 60 บาท', 'audio/x-m4a');
  await post(w6, [audioEv(U, 'aud9')]);
  const m6 = w6.line.replies.at(-1)!.messages;
  check('a voice note with two expenses logs both, says what it heard, sends one summary', rows(w6).length === 2 && rows(w6).every(t => t.source === 'voice') && m6.length === 2 && textsIn([m6[0]]).includes('ได้ยินว่า') && flexOf(m6[1]).contents.type === 'carousel');

  const w7 = world();
  await post(w7, [textEv(U, Array.from({ length: 20 }, (_, i) => `item${i} ${10 + i}`).join('\n'))]);
  check('a very long list is capped at 12', rows(w7).length === 12);
}

/* ================================================================== */
section('Voice notes');
{
  const w = world();
  give(w, 'aud1', 'ค่าแท็กซี่ 180', 'audio/x-m4a');
  await post(w, [audioEv(U, 'aud1')]);
  const t = rows(w)[0];
  check('transcript → Transport ฿180, source voice, transcript kept', t.category === 'Transport' && t.amount === -180 && t.source === 'voice' && t.said === 'ค่าแท็กซี่ 180', t);
  const msgs = w.line.replies[0].messages;
  check('reply shows what was heard, then the receipt', msgs.length === 2 && textsIn([msgs[0]]).includes('ค่าแท็กซี่ 180') && textsIn([msgs[1]]).includes('from voice note'));
  give(w, 'aud2', '   ', 'audio/x-m4a');
  await post(w, [audioEv(U, 'aud2')]);
  check('an empty transcript asks to try again', rows(w).length === 1 && textsIn(w.line.replies.at(-1)!.messages).includes('ฟังไม่ชัด'));
}

/* ================================================================== */
section('Transfers between your own accounts, and income');
{
  const w = world();
  give(w, 't1', slipJson({ receiver: 'นาย ธัญญ์พิสิษฐ์ โ.', sender: 'นาย ธัญญ์พิสิษฐ์ โ.', amount: 3000, ref: 'REF-T1-000001' }));
  await post(w, [imageEv(U, 't1')]);
  const t = rows(w)[0];
  check('same name both sides → Transfer', t.category === 'Transfer' && t.status === 'ok', t.category);
  check('not counted as spending', monthStats(rows(w), bangkokNow(NOW)).spent === 0);
  check('reply says so', textsIn(w.line.replies[0].messages).includes('ไม่นับเป็นรายจ่าย'));

  give(w, 't2', slipJson({ direction: 'in', sender: 'บจก. สตูดิโอ ครีเอทีฟ', receiver: 'นาย ธัญญ์พิสิษฐ์ โ.', amount: 5000, ref: 'REF-T2-000002' }));
  await post(w, [imageEv(U, 't2')]);
  const inc = rows(w)[1];
  check('money received → Income, positive', inc.category === 'Income' && inc.amount === 5000, inc);

  give(w, 't3', slipJson({ receiver: 'ร้านค่าจ้างเหมา', amount: 700, ref: 'REF-T3-000003' }));
  await post(w, [imageEv(U, 't3')]);
  check('a payment is never filed as Income because the payee name says "ค่าจ้าง"', rows(w)[2].category !== 'Income' && rows(w)[2].amount === -700, rows(w)[2].category);
}

/* ================================================================== */
section('Things that are not slips, and failures');
{
  const w = world();
  give(w, 'n1', 'a picture of my dog');
  await post(w, [imageEv(U, 'n1')]);
  check('not a slip → polite answer, nothing logged', rows(w).length === 0 && textsIn(w.line.replies[0].messages).includes('ไม่ใช่สลิป') && w.store.slips.get('n1')?.status === 'failed');

  const w2 = world();
  w2.line.failContent.add('n2');
  await post(w2, [imageEv(U, 'n2')]);
  check('image download fails → apology, and the batch bookkeeping still works', rows(w2).length === 0 && textsIn(w2.line.replies[0].messages).includes('อ่านสลิปนี้ไม่ได้') && w2.store.slips.get('n2')?.status === 'failed');

  const w3 = world();
  give(w3, 'n3', JSON.stringify({ isSlip: true, amount: null }));
  await post(w3, [imageEv(U, 'n3')]);
  check('slip without a readable amount is not logged', rows(w3).length === 0 && textsIn(w3.line.replies[0].messages).includes('อ่านสลิปนี้ไม่ได้'));

  const w4 = world();
  w4.store.insertTx = async () => {
    throw new Error('database is down');
  };
  give(w4, 'n4', slipJson());
  await post(w4, [imageEv(U, 'n4')]);
  check('database error → apology instead of silence', textsIn(w4.line.replies[0]?.messages ?? []).includes('อ่านสลิปนี้ไม่ได้') || textsIn(w4.line.replies[0]?.messages ?? []).includes('ผิดพลาด'), w4.line.replies);
}

/* ================================================================== */
section('Who may do what');
{
  const w = world();
  give(w, 'g1', slipJson());
  const groupEv = { ...imageEv(U, 'g1'), source: { type: 'group', groupId: 'G1', userId: U } };
  await post(w, [groupEv]);
  check('group chats are ignored', w.line.sent.length === 0 && w.store.txs.length === 0);

  give(w, 'g2', slipJson({ receiver: 'Grab', ref: 'REF-OWN-000001' }));
  await post(w, [imageEv(U, 'g2')]);
  const mine = rows(w)[0];
  const repliesBefore = w.line.sent.length;
  await post(w, [postbackEv(V, `act=cat&tx=${mine.id}&c=fun&rule=1`)]);
  await post(w, [postbackEv(V, `act=split&tx=${mine.id}`)]);
  await post(w, [postbackEv(V, `act=recat&tx=${mine.id}`)]);
  check("another user's button cannot touch my record", rows(w)[0].category === mine.category && rows(w)[0].split_n === null && w.line.sent.length === repliesBefore);
  same('and creates no rule for me', await w.store.getRules(U), {});
  await post(w, [postbackEv(U, 'act=cat&tx=not-a-uuid&c=fun')]);
  await post(w, [postbackEv(U, `act=cat&tx=${mine.id}&c=bogus`)]);
  await post(w, [postbackEv(U, `act=cat&tx=${mine.id}&c=income`)]);
  check('bad ids and categories are ignored', rows(w)[0].category === mine.category);
}

/* ================================================================== */
section('Menu buttons and welcome');
{
  const w = world();
  await post(w, [followEv(U)]);
  check('new friend gets a welcome and their profile', w.store.profiles.has(U) && w.line.replies[0].messages.length === 2 && textsIn(w.line.replies[0].messages).includes('Thanbaht'));
  await post(w, [postbackEv(U, 'act=send_slips')]);
  check('"Send slips" answers with photo quick replies', textsIn(w.line.replies.at(-1)!.messages).includes('cameraRoll'));
  await post(w, [postbackEv(U, 'act=voice')]);
  await post(w, [postbackEv(U, 'act=type')]);
  check('voice / type buttons only open the input, no reply', w.line.replies.length === 2);
  await w.store.insertTx({ ...earlier, status: 'review', review_kind: 'who', category: 'Uncategorized', trans_ref: null });
  await post(w, [postbackEv(U, 'act=today')]);
  check('"Today" shows the digest with the waiting count', textsIn(w.line.replies.at(-1)!.messages).includes('Review 1 waiting'));
  await post(w, [postbackEv(U, `act=recat&tx=${w.store.txs[0].id}`)]);
  check('"Change" re-opens the category choice', textsIn(w.line.replies.at(-1)!.messages).includes('WHO IS THIS?'));
}

/* ================================================================== */
section('Every message we send is valid for LINE');
{
  const w = world();
  give(w, 'z1', slipJson({ receiver: 'นางสาว ส. ใจดี', amount: 300, ref: 'REF-Z1-000001' }));
  give(w, 'z2', slipJson({ receiver: 'ร้านอาหารข้าวต้มปลา XYZ พร้อมชื่อยาวมากมากมากมากมากมากมากมากมากมาก', amount: 450, ref: 'REF-Z2-000002' }));
  give(w, 'z3', slipJson({ receiver: 'Z', amount: 450, ref: 'REF-Z2-000002' }));
  give(w, 'z4', slipJson({ receiver: 'Tops', amount: 12, ref: 'REF-Z4-000004' }));
  await post(w, [imageEv(U, 'z1'), imageEv(U, 'z2'), imageEv(U, 'z3'), imageEv(U, 'z4', { set: undefined })]);
  await post(w, [postbackEv(U, 'act=today'), textEv(U, 'กาแฟ 65'), textEv(U, 'hello')]);
  await post(w, [textEv(U, 'ก๋วยเตี๋ยว 50฿\nน้ำเปล่า 8฿\nขนม 70฿\nเลี้ยงข้าวแฟน 300฿')]);
  give(w, 'zv', 'กาแฟ 65 บาท ข้าว 60 บาท xyzzy 20', 'audio/x-m4a');
  await post(w, [audioEv(U, 'zv')]);
  const problems: string[] = [];
  const HEX = /^#[0-9A-Fa-f]{6}$/;
  const walk = (n: unknown, path: string) => {
    if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    for (const k of ['color', 'backgroundColor', 'borderColor']) if (typeof o[k] === 'string' && !HEX.test(o[k] as string)) problems.push(`${path}.${k}=${o[k]}`);
    if (o.type === 'text' && (typeof o.text !== 'string' || !o.text)) problems.push(`${path} empty text`);
    if (o.type === 'button' && !o.action) problems.push(`${path} button without action`);
    if (o.type && typeof o.label === 'string' && [...o.label].length > 20) problems.push(`${path} label > 20: ${o.label}`);
    if (o.type === 'postback' && (typeof o.data !== 'string' || o.data.length > 300)) problems.push(`${path} postback data`);
    if (o.type === 'uri' && !String(o.uri).startsWith('https://')) problems.push(`${path} uri not https`);
    if (o.type === 'carousel' && (o.contents as unknown[]).length > 12) problems.push(`${path} carousel > 12`);
    // LINE: "not allowed to mix different bubble size in a carousel" (this is what broke the first multi-expense reply)
    if (o.type === 'carousel' && new Set((o.contents as { size?: string }[]).map(b => b.size ?? 'mega')).size > 1) problems.push(`${path} carousel mixes bubble sizes`);
    for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  for (const [i, messages] of w.line.sent.entries()) {
    if (messages.length > 5) problems.push(`send ${i}: more than 5 messages`);
    for (const m of messages) {
      const f = m as { altText?: string; type: string };
      if (f.type === 'flex' && (!f.altText || [...f.altText].length > 400)) problems.push(`send ${i}: altText`);
      if (JSON.stringify(m).length > 50_000) problems.push(`send ${i}: larger than 50 KB`);
      walk(m, `send${i}`);
    }
  }
  check(`${w.line.sent.length} sends, ${w.line.allMessages.length} messages checked`, problems.length === 0, problems);
}

/* ================================================================== */
section('Flex builders match the chat mock');
{
  const f = createFlex(APP);
  const grab = { date: '23 Sep', time: '10:15', ref: '015266101544417' };
  const pairs: [string, unknown, unknown][] = [
    ['receipt', f.receipt({ id: 't47', name: 'ร้านอาหารข้าวต้มปลา XYZ', cat: 'food', amt: 450, bank: 'KBank', date: '23 Sep', time: '12:42', verified: true }, { todayTotal: 710, todayN: 3, catSpent: 5964, catBudget: 6500 }),
      mockFlex.receipt({ id: 't47', name: 'ร้านอาหารข้าวต้มปลา XYZ', cat: 'food', amt: 450, bank: 'KBank', date: '23 Sep', time: '12:42', verified: true }, { todayTotal: 710, todayN: 3, catSpent: 5964, catBudget: 6500 })],
    ['batch', f.batch({ slips: 4, banks: 3, todayTotal: 1341, logged: [{ id: 't48', name: "Lotus's Rama 4", cat: 'grocery', amt: 386, bank: 'Krungthai', date: '', time: '18:20' }, { id: 't49', name: 'After You', cat: 'food', amt: 245, bank: 'SCB', date: '', time: '19:40' }], need: [{ name: 'ส. ใจดี', amt: 300, why: 'category?' }, { name: 'Grab', amt: 120, why: 'duplicate?' }] }),
      mockFlex.batch({ slips: 4, banks: 3, todayTotal: 1341, logged: [{ id: 't48', name: "Lotus's Rama 4", cat: 'grocery', amt: 386, bank: 'Krungthai', time: '18:20' }, { id: 't49', name: 'After You', cat: 'food', amt: 245, bank: 'SCB', time: '19:40' }], need: [{ name: 'ส. ใจดี', amt: 300, why: 'category?' }, { name: 'Grab', amt: 120, why: 'duplicate?' }] })],
    ['askCategory', f.askCategory({ id: 't50', name: 'PromptPay · นางสาว ส. ใจดี', cat: 'unknown', amt: 300, bank: 'SCB', date: '23 Sep', time: '19:05' }), mockFlex.askCategory({ id: 't50', name: 'PromptPay · นางสาว ส. ใจดี', amt: 300, bank: 'SCB', date: '23 Sep', time: '19:05' })],
    ['duplicate', f.duplicate(grab, { id: 't51', name: 'Grab', cat: 'transport', amt: 120, bank: 'KBank', date: '23 Sep', time: '10:15' }), mockFlex.duplicate({ ...grab, name: 'Grab', amt: 120, id: 't46' }, { ...grab, name: 'Grab', amt: 120, id: 't51' })],
    ['digest', f.digest({ dateLabel: 'Wed 23 Sep', todayTotal: 1341, todayN: 5, byBank: [['KBank', 710], ['Krungthai', 386], ['SCB', 245]], monthSpent: 16508, budget: 22000, perDay: 785, daysLeft: 7, hot: 'Food & Dining is at 96% of its ฿6,500 budget with 7 days to go.', waiting: 3 }),
      mockFlex.digest({ dateLabel: 'Wed 23 Sep', todayTotal: 1341, todayN: 5, byBank: [['KBank', 710], ['Krungthai', 386], ['SCB', 245]], monthSpent: 16508, budget: 22000, perDay: 785, daysLeft: 7, hot: 'Food & Dining is at 96% of its ฿6,500 budget with 7 days to go.', waiting: 3 })],
    ['answer', f.answer({ cat: 'food', day: 23, spent: 6209, budget: 6500, daysLeft: 7, n: 23, top: [['ร้านอาหารข้าวต้มปลา XYZ', 1320, 3], ['Somboon Seafood', 1120, 1], ['Roots Coffee', 700, 5]] }),
      mockFlex.answer({ cat: 'food', day: 23, spent: 6209, budget: 6500, daysLeft: 7, n: 23, top: [['ร้านอาหารข้าวต้มปลา XYZ', 1320, 3], ['Somboon Seafood', 1120, 1], ['Roots Coffee', 700, 5]] })],
    ['nudge', f.nudge({ dateLabel: 'Sat 19 Sep', iso: '2026-09-19' }), mockFlex.nudge({ dateLabel: 'Sat 19 Sep', iso: '2026-09-19' })],
    ['sendSlipsPrompt', f.sendSlipsPrompt(), mockFlex.sendSlipsPrompt()],
    ['income', f.income({ id: 't52', name: 'Freelance design work', cat: 'income', amt: 5000, bank: 'SCB', date: '22 Sep', time: '18:30', via: 'text' }, { monthIn: 32400, monthSpent: 16508 }),
      mockFlex.income({ id: 't52', name: 'Freelance design work', cat: 'income', amt: 5000, bank: 'SCB', date: '22 Sep', time: '18:30', via: 'text' }, { monthIn: 32400, monthSpent: 16508 })],
    ['richMenu', f.richMenu, mockFlex.richMenu],
  ];
  for (const [name, server, mock] of pairs) same(`${name} is identical`, JSON.parse(JSON.stringify(server)), JSON.parse(JSON.stringify(mock)));
  const d = f.digest({ dateLabel: 'Sat 10 Oct', monthLabel: 'OCTOBER', todayTotal: 0, todayN: 0, byBank: [], monthSpent: 0, budget: 22000, perDay: 700, daysLeft: 21 });
  check('digest names the real month (the mock hard-coded September)', JSON.stringify(d).includes('OCTOBER'));
}

/* ================================================================== */
section('When the reading service fails');
{
  // Google retired the default model for this key: fall through to the next one
  const tried: string[] = [];
  const answer = JSON.stringify({ isSlip: true, amount: 100, receiverName: 'Grab', ref: 'REF-MODEL-0001' });
  const fetchFn = (async (url: string) => {
    const model = url.split('/models/')[1].split(':')[0];
    tried.push(model);
    if (model === 'gemini-old') return new Response('{"error":{"message":"This model is no longer available to new users"}}', { status: 404 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const g = new Gemini({ apiKey: 'k', model: 'gemini-old', fetchFn });
  const first = await g.readSlip(new Uint8Array([1]), 'image/jpeg');
  check('a retired model (404) falls back to the next one', first.amount === 100 && tried[0] === 'gemini-old' && tried[1] === DEFAULT_MODELS[0], tried);
  await g.readSlip(new Uint8Array([1]), 'image/jpeg');
  check('and the working model is remembered, not retried every time', tried.length === 3 && tried[2] === DEFAULT_MODELS[0], tried);
  const allGone = new Gemini({ apiKey: 'k', fetchFn: (async () => new Response('gone', { status: 404 })) as unknown as typeof fetch });
  check('if every model is gone it is an error, not an endless loop', await allGone.readSlip(new Uint8Array([1]), 'image/jpeg').then(() => false, e => e instanceof GeminiError && e.status === 404));

  // the user must not be told "try a clearer photo" when the service is at fault
  const w = world();
  w.deps.readSlip = async () => {
    throw new GeminiError('Gemini 404: model gone', 404);
  };
  w.deps.transcribe = async () => {
    throw new GeminiError('Gemini 503: overloaded', 503);
  };
  give(w, 'svc1', 'anything');
  await post(w, [imageEv(U, 'svc1')]);
  const slipReply = textsIn(w.line.replies[0].messages);
  check('slip + service error → "temporarily unavailable", not "clearer photo"', slipReply.includes('ชั่วคราว') && !slipReply.includes('ชัดขึ้น'), slipReply);
  check('the slip is recorded as failed with the reason, and its image is kept', w.store.slips.get('svc1')?.status === 'failed' && String(w.store.slips.get('svc1')?.error).includes('Gemini 404') && w.store.images.has(`${U}/svc1.jpg`));
  give(w, 'svc2', 'whatever', 'audio/x-m4a');
  await post(w, [audioEv(U, 'svc2')]);
  const audioReply = textsIn(w.line.replies[1].messages);
  check('voice + service error → the same clear message', audioReply.includes('ชั่วคราว') && rows(w).length === 0, audioReply);
}

/* ================================================================== */
section('Reading slips with Gemini');
{
  const good = { isSlip: true, bank: 'K PLUS', direction: 'out', amount: '฿1,250.50', senderName: 'นาย ก', senderAccount: 'xxx', receiverName: '  ร้าน   A  ', receiverAccount: '0812345678', ref: '0152 6610 1544 417', datetime: '23/09/69 12:42', memo: 'null', confidence: 0.9 };
  const r = parseReading(JSON.stringify(good));
  check('amount with ฿ and commas', r.amount === 1250.5, r.amount);
  check('Buddhist Era date → 2026-09-23T12:42', r.datetime === '2026-09-23T12:42', r.datetime);
  check('bank name from app text', r.bank === 'kbank', r.bank);
  check('spaces in names and refs cleaned', r.receiverName === 'ร้าน A' && r.ref === '015266101544417', [r.receiverName, r.ref]);
  check('the word "null" is not a memo', r.memo === null);
  check('code fences tolerated', parseReading('```json\n' + JSON.stringify(good) + '\n```').amount === 1250.5);
  check('garbage → not a slip', parseReading('sorry, I cannot help').isSlip === false && parseReading('[1,2]').isSlip === false && parseReading(null).isSlip === false);
  check('negative / absurd / zero amounts rejected', [-5, 0, 1e9, 'abc'].every(a => parseReading({ isSlip: true, amount: a }).amount === null));
  check('a short reference is noise, not an id', parseReading({ isSlip: true, amount: 5, ref: '12' }).ref === null);
  check('confidence clamped', parseReading({ isSlip: true, amount: 5, confidence: 7 }).confidence === 1);
  check('isSlip false is respected', parseReading({ isSlip: false, amount: 5 }).isSlip === false);
  check('unknown bank → other', parseReading({ isSlip: true, amount: 5, bank: 'Bank of Mars' }).bank === 'other');

  same('dates: ISO', normalizeDateTime('2026-09-23T12:42:00'), { date: '2026-09-23', time: '12:42' });
  same('dates: BE year in ISO', normalizeDateTime('2569-09-23 08:05'), { date: '2026-09-23', time: '08:05' });
  same('dates: d/m/yy BE', normalizeDateTime('3/9/69 01:02'), { date: '2026-09-03', time: '01:02' });
  same('dates: 31 Feb is invalid', normalizeDateTime('2026-02-31'), null);
  same('dates: nonsense', normalizeDateTime('yesterday'), null);

  const req = buildRequest('slip', new Uint8Array([1, 2, 3]), 'image/jpeg');
  const part = (req.contents[0].parts as Record<string, unknown>[])[1] as { inline_data: { mime_type: string; data: string } };
  check('request carries the image as base64 with its mime type', part.inline_data.mime_type === 'image/jpeg' && part.inline_data.data === 'AQID');
  check('request asks for JSON with a schema and temperature 0', req.generationConfig.responseMimeType === 'application/json' && req.generationConfig.temperature === 0 && !!req.generationConfig.responseSchema);
  const big = buildRequest('slip', new Uint8Array(3_000_000).fill(7), 'image/jpeg');
  check('a 3 MB photo encodes without blowing the stack', (big.contents[0].parts[1] as { inline_data: { data: string } }).inline_data.data.length === 4_000_000);

  const calls: { url: string; headers: Record<string, string> }[] = [];
  let n = 0;
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    n++;
    if (n === 1) return new Response('overloaded', { status: 503 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const g = new Gemini({ apiKey: 'KEY123', model: 'gemini-test', fetchFn, retryDelayMs: 1 });
  const out = await g.readSlip(new Uint8Array([1]), 'image/jpeg');
  check('retries once after a 503, then succeeds', n === 2 && out.amount === 1250.5);
  check('API key goes in a header, never in the URL', calls.every(c => !c.url.includes('KEY123') && c.headers['x-goog-api-key'] === 'KEY123'));
  check('uses the configured model', calls[0].url.includes('models/gemini-test:generateContent'));

  const seen: string[] = [];
  const overloaded = (async (url: string) => {
    const m = url.split('/models/')[1].split(':')[0];
    seen.push(m);
    if (m === 'first') return new Response('busy', { status: 503 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const fb = new Gemini({ apiKey: 'k', model: 'first', fetchFn: overloaded, retryDelayMs: 1 });
  const fbOut = await fb.readSlip(new Uint8Array([1]), 'image/jpeg');
  check('a model that stays overloaded (503 twice) falls back to the next model', fbOut.amount === 1250.5 && seen.filter(m => m === 'first').length === 2 && seen.includes('gemini-3.8-flash'));

  // 429: a per-minute limit is waited out on the same model, a per-day limit moves straight on
  const okBody = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }] }), { status: 200 });
  const quota = (id: string) => new Response(JSON.stringify({ error: { details: [{ violations: [{ quotaId: id }] }, { retryDelay: '0s' }] } }).replace('"retryDelay":"0s"', '"retryDelay": "0s"'), { status: 429 });
  const minuteSeen: string[] = [];
  const perMinute = (async (url: string) => {
    const m = url.split('/models/')[1].split(':')[0];
    minuteSeen.push(m);
    return minuteSeen.filter(x => x === m).length === 1 ? quota('GenerateRequestsPerMinutePerProjectPerModel-FreeTier') : okBody();
  }) as unknown as typeof fetch;
  const minuteOut = await new Gemini({ apiKey: 'k', model: 'only', fetchFn: perMinute }).readSlip(new Uint8Array([1]), 'image/jpeg');
  check('a per-minute 429 is waited out and retried on the same model', minuteOut.amount === 1250.5 && minuteSeen.join() === 'only,only', minuteSeen);
  const daySeen: string[] = [];
  const perDay = (async (url: string) => {
    const m = url.split('/models/')[1].split(':')[0];
    daySeen.push(m);
    return m === 'only' ? quota('GenerateRequestsPerDayPerProjectPerModel-FreeTier') : okBody();
  }) as unknown as typeof fetch;
  const dayOut = await new Gemini({ apiKey: 'k', model: 'only', fetchFn: perDay }).readSlip(new Uint8Array([1]), 'image/jpeg');
  check('a per-day 429 goes straight to the next model without retrying', dayOut.amount === 1250.5 && daySeen[0] === 'only' && daySeen[1] !== 'only', daySeen);

  const bad = new Gemini({ apiKey: 'k', fetchFn: (async () => new Response('nope', { status: 400 })) as unknown as typeof fetch });
  check('a 400 is an error, not retried', await bad.readSlip(new Uint8Array([1]), 'image/jpeg').then(() => false, e => e instanceof GeminiError && e.status === 400));
  const blocked = new Gemini({ apiKey: 'k', fetchFn: (async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 })) as unknown as typeof fetch });
  check('a blocked response is an error', await blocked.readSlip(new Uint8Array([1]), 'image/jpeg').then(() => false, e => e instanceof GeminiError));
  const tr = new Gemini({ apiKey: 'k', fetchFn: (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: ' ค่าแท็กซี่ 180 \n' }] } }] }), { status: 200 })) as unknown as typeof fetch });
  check('transcription is trimmed text', (await tr.transcribe(new Uint8Array([1]), 'audio/x-m4a')) === 'ค่าแท็กซี่ 180');
}

/* ================================================================== */
section('LINE API client');
{
  const seen: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    if (url.includes('/content')) return new Response(new Uint8Array([9, 8, 7]), { status: 200, headers: { 'content-type': 'image/png; charset=x' } });
    if (url.includes('/loading/')) return new Response('boom', { status: 500 });
    if (url.includes('/reply') && JSON.parse(init.body as string).replyToken === 'BAD') return new Response('{"message":"Invalid reply token"}', { status: 400 });
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  const c = new HttpLineClient('TOKEN', fetchFn);
  const six: LineMessage[] = Array.from({ length: 6 }, () => ({ type: 'text', text: 'x' }));
  await c.reply('R', six);
  const sent = JSON.parse(seen[0].init.body as string);
  check('reply hits the reply endpoint with the bearer token', seen[0].url === 'https://api.line.me/v2/bot/message/reply' && (seen[0].init.headers as Record<string, string>).Authorization === 'Bearer TOKEN');
  check('never sends more than 5 messages in one reply', sent.messages.length === 5 && sent.replyToken === 'R');
  await c.push('U1', six.slice(0, 1), 'KEY-1');
  check('push includes the retry key header', (seen[1].init.headers as Record<string, string>)['X-Line-Retry-Key'] === 'KEY-1' && JSON.parse(seen[1].init.body as string).to === 'U1');
  const got = await c.getContent('12345');
  check('content download uses api-data and strips the charset', seen[2].url === 'https://api-data.line.me/v2/bot/message/12345/content' && got.mime === 'image/png' && got.bytes.length === 3);
  check('a rejected token becomes a LineApiError with the status', await c.reply('BAD', six.slice(0, 1)).then(() => false, e => e instanceof LineApiError && e.status === 400));
  check('a failing loading animation is swallowed', await c.showLoading('U1').then(() => true, () => false));
}

/* ================================================================== */
section('Parsing and names');
{
  same('parseQuick: thai + amount', parseQuick('กาแฟ 65'), { title: 'กาแฟ', amount: 65 });
  same('parseQuick: บาท suffix', parseQuick('ข้าวมันไก่ 60 บาท'), { title: 'ข้าวมันไก่', amount: 60 });
  same('parseQuick: thousands comma and decimals', parseQuick('ได้ค่าจ้าง 1,500.50'), { title: 'ได้ค่าจ้าง', amount: 1500.5 });
  same('parseQuick: digits inside a name are not the amount', parseQuick('7-Eleven 79'), { title: '7-Eleven', amount: 79 });
  same('parseQuick: amount first', parseQuick('65 coffee'), { title: 'coffee', amount: 65 });
  same('parseQuick: ฿ prefix', parseQuick('coffee ฿65'), { title: 'coffee', amount: 65 });
  same('parseQuick: no amount', parseQuick('coffee'), null);
  same('parseQuick: amount stuck to Thai words ("ข้าว20")', parseQuick('ข้าว20'), { title: 'ข้าว', amount: 20 });
  same('parseQuick: stuck amount with บาท and thousands', [parseQuick('ข้าว20บาท'), parseQuick('ค่าไฟ1,200')], [{ title: 'ข้าว', amount: 20 }, { title: 'ค่าไฟ', amount: 1200 }]);
  same('parseQuick: "7-Eleven79" is 79, and "abc-20" is not an amount', [parseQuick('7-Eleven79'), parseQuick('abc-20')], [{ title: '7-Eleven', amount: 79 }, null]);
  same('splitExpenses: attached amounts split too', splitExpenses('ข้าว20 กาแฟ30'), ['ข้าว20', 'กาแฟ30']);
  same('parseQuick: zero', parseQuick('coffee 0'), null);
  same('parseQuick: empty', parseQuick('  '), null);

  check('payeeKey ignores titles, spaces and PromptPay prefix', payeeKey('PromptPay · นางสาว ส. ใจดี') === payeeKey('ส.ใจดี') && payeeKey('Ms. Somchai  Jaidee') === 'somchaijaidee');
  check('same owner despite a masked surname', sameOwner('นาย ธัญญ์พิสิษฐ์ โ.', 'นาย ธัญญ์พิสิษฐ์ โอ'));
  check('different people are not the same owner', !sameOwner('นาย ธัญญ์พิสิษฐ์ โ.', 'ร้านอาหาร XYZ') && !sameOwner('นาย ก', null));
  check('profile owner names count too', sameOwner('someone else', 'นาย สมชาย ใจดี', ['สมชาย ใจดี']));
  check('very short names never match', !sameOwner('นาย ก', 'นาย ก'));
}

/* ================================================================== */
section('Daily numbers');
{
  const now = bangkokNow(NOW);
  same('Bangkok time', [now.date, now.time, now.daysLeft], ['2026-09-23', '12:50', 7]);
  const late = bangkokNow(new Date('2026-09-23T18:30:00Z'));
  same('after 17:00 UTC it is already tomorrow in Bangkok', [late.date, late.time], ['2026-09-24', '01:30']);
  const mk = (title: string, category: TxRow['category'], amount: number, extra: Partial<TxRow> = {}): TxRow => ({ ...earlier, id: title + amount, title, category, amount, trans_ref: null, ...extra }) as TxRow;
  const list = [mk('a', 'Food & Dining', -6000), mk('b', 'Transport', -300), mk('c', 'Transfer', -3000), mk('d', 'Income', 32400), mk('e', 'Shopping', -500, { status: 'review', review_kind: 'who' }), mk('f', 'Shopping', -100, { excluded: true })];
  const profile = { line_user_id: U, display_name: null, owner_names: [], monthly_budget: 22000 };
  const d = digestData(list, profile, now, 1);
  check('spending ignores transfers, income, review and excluded rows', d.monthSpent === 6300, d.monthSpent);
  check('per-day allowance', Math.round(d.perDay) === Math.round((22000 - 6300) / 7), d.perDay);
  check('warns about the category that is ahead of pace', !!d.hot && d.hot.startsWith('Food & Dining is at 92%'), d.hot);
  check('waiting count passed through', d.waiting === 1);
}

/* ================================================================== */
section('The evening nudge (scheduled digest)');
{
  const w = world();
  await w.store.ensureProfile(U); // logged today, nothing waiting → skip
  await w.store.insertTx({ ...earlier, user_id: U, date: '2026-09-23' });
  await w.store.ensureProfile(V); // nothing logged today, nothing waiting → nudge
  await w.store.insertTx({ ...earlier, user_id: V, date: '2026-09-20' });
  const W = 'U-carol';
  await w.store.ensureProfile(W); // logged today too, BUT something is waiting → nudge anyway
  await w.store.insertTx({ ...earlier, user_id: W, date: '2026-09-23' });
  await w.store.insertTx({ ...earlier, user_id: W, date: '2026-09-23', title: 'xyzzy', category: 'Uncategorized', status: 'review', review_kind: 'who', trans_ref: null });

  const outcomes = await runDailyDigest({ store: w.store, line: w.line, appUrl: APP, now: () => NOW, log: (m, d) => w.logs.push([m, d]) });
  const by = (id: string) => outcomes.find(o => o.userId === id);

  check('a user who already logged today, with nothing waiting, is skipped', by(U)?.sent === false && by(U)?.reason === 'logged_today', by(U));
  check('a user with nothing logged today is nudged', by(V)?.sent === true && by(V)?.reason === 'nudged', by(V));
  check('a user with something waiting is nudged even if they already logged today', by(W)?.sent === true && by(W)?.reason === 'nudged', by(W));
  check('exactly the nudged users receive a push', w.line.pushes.map(p => p.to).sort().join() === [V, W].sort().join(), w.line.pushes.map(p => p.to));
  check('every push carries a retry key and a Flex digest card', w.line.pushes.every(p => !!p.retryKey && flexOf(p.messages[0]).type === 'flex'));

  // One user's push fails (LINE says they blocked the bot): the rest must still go through
  const w2 = world();
  await w2.store.ensureProfile(U);
  await w2.store.ensureProfile(V);
  w2.line.failPushTo.add(U);
  const outcomes2 = await runDailyDigest({ store: w2.store, line: w2.line, appUrl: APP, now: () => NOW });
  check('a failed push is reported, not thrown, and does not stop the batch', outcomes2.find(o => o.userId === U)?.reason === 'error' && outcomes2.find(o => o.userId === V)?.sent === true, outcomes2);
  check('the other user still got their nudge', w2.line.pushes.some(p => p.to === V));

  check('listUserIds returns everyone the bot has ever heard from', (await w.store.listUserIds()).sort().join() === [U, V, W].sort().join());
}

/* ================================================================== */
section('Cold starts: answer LINE before the database has loaded');
{
  // the real store is "still loading" (never finishes), yet LINE's Verify button gets its 200 at once
  const w = world();
  let loadCalls = 0;
  w.deps.store = lazyStore(() => {
    loadCalls++;
    return new Promise<never>(() => {}); // never resolves: a very slow cold start
  });
  const verify = await Promise.race([post(w, []), new Promise<'slow'>(r => setTimeout(() => r('slow'), 500))]);
  check('Verify (no events) is answered without touching the database', verify !== 'slow' && (verify as Response).status === 200 && loadCalls === 0, [verify === 'slow' ? 'slow' : (verify as Response).status, loadCalls]);

  // a real slip: the response must not wait for the database
  const deferred: Promise<unknown>[] = [];
  w.deps.defer = p => void deferred.push(p);
  give(w, 'cold1', slipJson());
  const answered = await Promise.race([post(w, [imageEv(U, 'cold1')]), new Promise<'slow'>(r => setTimeout(() => r('slow'), 500))]);
  check('a slip event is acknowledged with 200 while the database is still loading', answered !== 'slow' && (answered as Response).status === 200, answered === 'slow' ? 'slow' : (answered as Response).status);
  check('and the work continues in the background', deferred.length === 1 && loadCalls === 1, [deferred.length, loadCalls]);
}
{
  const events: string[] = [];
  class Real extends MemoryStore {
    label = 'real';
    async ensureProfile(userId: string) {
      events.push(`ensureProfile(${userId}) on ${this.label}`); // needs `this` intact
      return super.ensureProfile(userId);
    }
  }
  let loads = 0;
  const real = new Real();
  const lazy = lazyStore(async () => {
    loads++;
    await new Promise(r => setTimeout(r, 20));
    return real;
  });
  check('nothing is loaded until first use', loads === 0);
  const [a, b] = await Promise.all([lazy.ensureProfile('U1'), lazy.ensureProfile('U2')]);
  check('concurrent first calls share one load', loads === 1, loads);
  check('calls are forwarded with arguments, results and `this` intact', a.line_user_id === 'U1' && b.line_user_id === 'U2' && events.join() === 'ensureProfile(U1) on real,ensureProfile(U2) on real', events);
  await lazy.ensureProfile('U3');
  check('later calls reuse the loaded store', loads === 1, loads);
  check('awaiting the lazy store does not treat it as a promise', (await Promise.resolve(lazy)) === lazy);

  let attempt = 0;
  const flaky = lazyStore(async () => {
    if (++attempt === 1) throw new Error('Missing secret SUPABASE_SERVICE_ROLE_KEY');
    return new MemoryStore();
  });
  const first = await flaky.reviewCount('U1').then(() => 'ok', e => (e as Error).message);
  const second = await flaky.reviewCount('U1').then(() => 'ok', e => (e as Error).message);
  check('a failed load reports its error, then is retried', first === 'Missing secret SUPABASE_SERVICE_ROLE_KEY' && second === 'ok', [first, second]);
}
{
  // the whole flow still works through the lazy wrapper
  const w = world();
  const inner = w.store;
  w.deps.store = lazyStore(async () => inner);
  give(w, 'lz1', slipJson());
  await post(w, [imageEv(U, 'lz1')]);
  check('a slip is logged and answered through the lazy store', rows(w).length === 1 && textsIn(w.line.replies[0].messages).includes('Logged ✓'));
}

/* ================================================================== */
section('Generated copy is current');
try {
  execFileSync('node', ['scripts/sync-server.mjs', '--check'], { stdio: 'pipe' });
  check('supabase/functions/_shared/categoryMatcher.ts matches src/utils/categoryMatcher.ts', true);
} catch (e) {
  check('supabase/functions/_shared/categoryMatcher.ts matches src/utils/categoryMatcher.ts', false, String((e as { stderr?: Buffer }).stderr ?? e));
}

console.log(failed ? `\n${failed} of ${total} checks failed` : `\nAll ${total} checks passed`);
process.exit(failed ? 1 : 0);
