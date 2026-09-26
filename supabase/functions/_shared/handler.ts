// The LINE webhook: verifies the request, then handles each event.
// Depends only on interfaces (LineClient, Store, SlipReader), so tests run it with fakes.

import type { LineEvent, NewTx, LineMessage, MessageEvent, PostbackEvent, Profile, SlipReading, TxRow, WebhookBody } from './types.ts';
import { verifySignature, type LineClient, LineApiError, newRetryKey } from './line.ts';
import { type Store, DuplicateRefError } from './store.ts';
import { GeminiError, type SlipReader, type Transcriber } from './gemini.ts';
import { type BangkokNow, bangkokNow } from './clock.ts';
import { baht, CATEGORY_OF, createFlex, type CatKey, type Flex } from './flex.ts';
import { payeeKey } from './names.ts';
import { splitExpenses } from './parse.ts';
import { digestData, draftFromQuick, draftFromSlip, kindOf, monthStats, receiptCtx, toFlexTx } from './logic.ts';

export interface Deps {
  channelSecret: string;
  /** Mini App base URL, e.g. https://miniapp.line.me/2000000000-abcdEFGH */
  appUrl: string;
  line: LineClient;
  store: Store;
  readSlip: SlipReader;
  transcribe: Transcriber;
  /** Optional: check the slip's QR / reference with a verification service. */
  verifySlip?: (bytes: Uint8Array, reading: SlipReading) => Promise<boolean>;
  now?: () => Date;
  /** Keep work running after the 200 response (EdgeRuntime.waitUntil). Default: await it. */
  defer?: (work: Promise<unknown>) => void;
  log?: (message: string, detail?: unknown) => void;
}

const text = (t: string): LineMessage => ({ type: 'text', text: t });

const MSG = {
  unreadable: text('อ่านสลิปนี้ไม่ได้ ลองส่งรูปที่ชัดขึ้นอีกครั้งนะ 🙏\nI couldn\'t read that slip. Please try a clearer photo.'),
  notSlip: text('รูปนี้ไม่ใช่สลิปโอนเงิน ส่งสลิปจากแอปธนาคารได้เลย\nThat doesn\'t look like a bank slip. Send a slip from your banking app.'),
  error: text('ขออภัย มีบางอย่างผิดพลาด ลองอีกครั้งนะ\nSomething went wrong. Please try again.'),
  // The reading service failed: not the user's photo or voice, so don't blame them
  service: text('ตอนนี้ระบบอ่านสลิปและเสียงมีปัญหาชั่วคราว ลองใหม่อีกครั้งในอีกสักครู่นะ 🙏\nSlip and voice reading is temporarily unavailable. Please try again in a moment.'),
  help: text('ส่งสลิปเป็นรูปภาพ พิมพ์ เช่น “กาแฟ 65” หรือส่งข้อความเสียงได้เลย\nSend a slip photo, type something like “coffee 65”, or send a voice note.'),
  welcome: text('ยินดีต้อนรับสู่ Thanbaht (ธัญบาท) 👋\nส่งสลิปธนาคารมาที่นี่ ฉันจะบันทึกให้เอง และถามเฉพาะตอนที่ไม่แน่ใจ\nSend your bank slips here. I\'ll log them and only ask when I\'m unsure.'),
  noHear: text('ฟังไม่ชัดเจน ลองพูดอีกครั้ง หรือพิมพ์ เช่น “กาแฟ 65”\nI couldn\'t catch that. Try again, or type something like “coffee 65”.'),
};

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function handleWebhook(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Signature first, over the raw body, before anything else is trusted
  const raw = await req.text();
  if (!(await verifySignature(deps.channelSecret, raw, req.headers.get('x-line-signature')))) {
    return new Response('Invalid signature', { status: 401 });
  }
  let body: WebhookBody;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const work = Promise.allSettled((body.events ?? []).map(ev => processEvent(ev, deps)));
  if (deps.defer) deps.defer(work);
  else await work;
  // Answer LINE straight away; slow work (image download, model call) continues in the background
  return new Response('ok', { status: 200 });
}

/* ------------------------------------------------------------------ */
/* One event                                                           */
/* ------------------------------------------------------------------ */

async function processEvent(ev: LineEvent, deps: Deps): Promise<void> {
  const log = deps.log ?? (() => {});
  const userId = ev.source?.type === 'user' ? ev.source.userId : undefined;
  if (!userId) return; // groups and rooms: not supported, and slips are private
  try {
    // LINE redelivers events it thinks failed. Handle each id once.
    if (ev.webhookEventId && !(await deps.store.markEventSeen(ev.webhookEventId))) return;
    const profile = await deps.store.ensureProfile(userId);
    const ctx = { deps, ev, userId, profile, now: bangkokNow((deps.now ?? (() => new Date()))()), flex: createFlex(deps.appUrl) };

    if (ev.type === 'follow') return void (await send(ctx, [MSG.welcome, ctx.flex.sendSlipsPrompt()]));
    if (ev.type === 'postback') return await onPostback(ctx, ev as PostbackEvent);
    if (ev.type === 'message') {
      const m = (ev as MessageEvent).message;
      if (m.type === 'image') return await onImage(ctx, m as Extract<MessageEvent['message'], { type: 'image' }>);
      if (m.type === 'audio') return await onAudio(ctx, m.id);
      if (m.type === 'text') return await onText(ctx, (m as { text: string }).text);
    }
  } catch (e) {
    log('event failed', { type: ev.type, error: String(e) });
    await send({ deps, ev, userId } as Ctx, [e instanceof GeminiError ? MSG.service : MSG.error]).catch(() => {});
  }
}

interface Ctx {
  deps: Deps;
  ev: LineEvent;
  userId: string;
  profile: Profile;
  now: BangkokNow;
  flex: Flex;
}

/** Reply with the event's token; if LINE rejects it (expired, already used), push instead. */
async function send(ctx: Pick<Ctx, 'deps' | 'ev' | 'userId'>, messages: LineMessage[]): Promise<void> {
  const { line } = ctx.deps;
  if (ctx.ev.replyToken) {
    try {
      return await line.reply(ctx.ev.replyToken, messages);
    } catch (e) {
      if (!(e instanceof LineApiError)) throw e;
      ctx.deps.log?.('reply failed, falling back to push', { status: e.status });
    }
  }
  await line.push(ctx.userId, messages, newRetryKey());
}

/* ------------------------------------------------------------------ */
/* Images (bank slips)                                                 */
/* ------------------------------------------------------------------ */

type ImageMsg = Extract<MessageEvent['message'], { type: 'image' }>;

async function onImage(ctx: Ctx, msg: ImageMsg): Promise<void> {
  const { deps, userId, profile, now } = ctx;
  const { store, line } = deps;
  const set = msg.imageSet && msg.imageSet.total > 1 ? msg.imageSet : null;
  await line.showLoading(userId);

  let tx: TxRow | null = null;
  let failure: 'unreadable' | 'notSlip' | 'service' | null = null;
  let error: string | null = null;
  let imagePath: string | null = null;

  try {
    const { bytes, mime } = await line.getContent(msg.id);
    // LINE only keeps message content for a limited time, so save it before anything else
    imagePath = await store.saveImage(userId, msg.id, bytes, mime);
    const reading = await deps.readSlip(bytes, mime);

    if (!reading.isSlip) failure = 'notSlip';
    else if (reading.amount === null) failure = 'unreadable';
    else {
      let verified = false;
      try {
        verified = (await deps.verifySlip?.(bytes, reading)) ?? false;
      } catch {
        /* an unavailable verifier just means "read from slip", not "verified" */
      }
      const rules = await store.getRules(userId);
      const draft = draftFromSlip(reading, { userId, profile, rules, now }, { imagePath, verified });
      tx = await insertWithDuplicateCheck(store, userId, draft);
    }
  } catch (e) {
    failure = e instanceof GeminiError ? 'service' : 'unreadable';
    error = String(e);
    deps.log?.('slip failed', { messageId: msg.id, error });
  }
  if (failure && !error) error = failure;

  await store.recordSlip({
    message_id: msg.id,
    user_id: userId,
    set_id: set?.id ?? null,
    set_index: set?.index ?? null,
    set_total: set?.total ?? null,
    image_path: imagePath,
    status: tx ? (tx.status === 'ok' ? 'ok' : 'review') : 'failed',
    transaction_id: tx?.id ?? null,
    error,
  });

  if (set) return await replyBatch(ctx, set.id, set.total);
  if (!tx) return void (await send(ctx, [failure === 'notSlip' ? MSG.notSlip : failure === 'service' ? MSG.service : MSG.unreadable]));
  await send(ctx, await messagesForTx(ctx, tx));
}

/** Store a draft. A slip whose bank reference is already logged becomes a "possible duplicate". */
async function insertWithDuplicateCheck(store: Store, userId: string, draft: Parameters<Store['insertTx']>[0]): Promise<TxRow> {
  const asDuplicate = (orig: TxRow) => store.insertTx({ ...draft, status: 'review', review_kind: 'dup', review_dup_of: orig.id });
  if (draft.trans_ref) {
    const existing = await store.findByRef(userId, draft.trans_ref);
    if (existing) return asDuplicate(existing);
  }
  try {
    return await store.insertTx(draft);
  } catch (e) {
    // Two copies of the same slip processed at the same moment: the database let one through
    if (e instanceof DuplicateRefError && draft.trans_ref) {
      const existing = await store.findByRef(userId, draft.trans_ref);
      if (existing) return asDuplicate(existing);
    }
    throw e;
  }
}

/** The card(s) for one stored record. */
async function messagesForTx(ctx: Ctx, tx: TxRow, opts: { heard?: string } = {}): Promise<LineMessage[]> {
  const { deps, userId, profile, now, flex } = ctx;
  const lead = opts.heard ? [text(`ได้ยินว่า: “${opts.heard}”\nI heard: “${opts.heard}”`)] : [];

  if (tx.status === 'review') {
    if (tx.review_kind === 'dup') {
      const orig = tx.review_dup_of ? await deps.store.getTx(userId, tx.review_dup_of) : null;
      return [...lead, flex.duplicate({ date: orig ? toFlexTx(orig).date : toFlexTx(tx).date, time: orig?.time ?? tx.time, ref: orig?.trans_ref ?? tx.trans_ref ?? '' }, toFlexTx(tx))];
    }
    return [...lead, flex.askCategory(toFlexTx(tx))];
  }
  const kind = kindOf(tx);
  if (kind === 'transfer') {
    return [...lead, text(`↔️ โอนระหว่างบัญชีของคุณ ${baht(tx.amount)} ไม่นับเป็นรายจ่าย\nOwn-account transfer of ${baht(tx.amount)}, not counted as spending.`)];
  }
  const stats = monthStats(await deps.store.monthTxs(userId, tx.date.slice(0, 7)), now);
  if (kind === 'income') return [...lead, flex.income(toFlexTx(tx), { monthIn: stats.income, monthSpent: stats.spent })];
  return [...lead, flex.receipt(toFlexTx(tx), receiptCtx(tx, stats, profile))];
}

/**
 * Images sent together arrive as separate events sharing an imageSet id. Once the last one
 * has been processed, exactly one caller (claimBatch) sends a single summary for all of them.
 */
async function replyBatch(ctx: Ctx, setId: string, total: number): Promise<void> {
  const { deps, userId, now, flex } = ctx;
  const { store } = deps;
  const items = await store.slipsInSet(userId, setId);
  if (items.length < total) return; // others still running; the last one to finish replies
  if (!(await store.claimBatch(userId, setId))) return;

  const txs = items.map(i => i.tx).filter((t): t is TxRow => !!t);
  const logged = txs.filter(t => t.status === 'ok').map(toFlexTx);
  const review = txs.filter(t => t.status === 'review');
  const need = [
    ...review.map(t => ({ name: t.title.replace(/^PromptPay · /, ''), amt: Math.abs(t.amount), why: t.review_kind === 'dup' ? 'duplicate?' : 'category?' })),
    ...items.filter(i => !i.tx).map(() => ({ name: 'unreadable slip', amt: 0, why: 'send again' })),
  ];
  const stats = monthStats(await store.monthTxs(userId, now.month), now);

  const followUps: LineMessage[] = [];
  for (const t of review.slice(0, 4)) {
    followUps.push(...(await messagesForTx(ctx, t)));
  }
  await send(ctx, [
    flex.batch({ slips: total, banks: new Set(txs.map(t => t.account)).size, todayTotal: stats.todaySpent, logged, need }),
    ...followUps,
  ]);
}

/* ------------------------------------------------------------------ */
/* Text and voice                                                      */
/* ------------------------------------------------------------------ */

async function onText(ctx: Ctx, raw: string): Promise<void> {
  const { deps, userId, profile, now } = ctx;
  const t = raw.trim();
  if (/^(วันนี้|today)$/i.test(t)) return void (await send(ctx, [await todayCard(ctx)]));

  const rules = await deps.store.getRules(userId);
  const drafts = splitExpenses(t).map(piece => draftFromQuick(piece, 'text', { userId, profile, rules, now })).filter(d => !!d);
  if (!drafts.length) return void (await send(ctx, [MSG.help]));
  if (drafts.length > 1) return await replyMany(ctx, drafts);
  const tx = await deps.store.insertTx(drafts[0]);
  await send(ctx, await messagesForTx(ctx, tx));
}

/** Several expenses in one message: log each, answer once with a summary and a card for any that need a question. */
async function replyMany(ctx: Ctx, drafts: NewTx[], opts: { heard?: string } = {}): Promise<void> {
  const { deps, userId, now, flex } = ctx;
  const txs: TxRow[] = [];
  for (const d of drafts) txs.push(await deps.store.insertTx(d)); // in order, so the summary reads like the message

  const lead = opts.heard ? [text(`ได้ยินว่า: “${opts.heard}”\nI heard: “${opts.heard}”`)] : [];
  const logged = txs.filter(t => t.status === 'ok').map(toFlexTx);
  const review = txs.filter(t => t.status === 'review');
  const stats = monthStats(await deps.store.monthTxs(userId, now.month), now);

  // LINE allows 5 messages per reply: the summary, plus one question card each for what fits
  const room = 5 - lead.length - 1;
  const followUps: LineMessage[] = [];
  for (const t of review.slice(0, room)) followUps.push(...(await messagesForTx(ctx, t)));
  await send(ctx, [
    ...lead,
    flex.batch({
      slips: txs.length, banks: 1, todayTotal: stats.todaySpent, logged,
      need: review.map(t => ({ name: t.title, amt: Math.abs(t.amount), why: 'category?' })),
      eyebrow: `${txs.length} EXPENSES · FROM YOUR MESSAGE`, noun: 'expenses',
    }),
    ...followUps,
  ]);
}

async function onAudio(ctx: Ctx, messageId: string): Promise<void> {
  const { deps, userId, profile, now } = ctx;
  await deps.line.showLoading(userId);
  const { bytes, mime } = await deps.line.getContent(messageId);
  const transcript = (await deps.transcribe(bytes, mime)).trim();
  const rules = await deps.store.getRules(userId);
  const drafts = splitExpenses(transcript).map(piece => draftFromQuick(piece, 'voice', { userId, profile, rules, now })).filter(d => !!d);
  if (!drafts.length) return void (await send(ctx, [MSG.noHear]));
  if (drafts.length > 1) return await replyMany(ctx, drafts, { heard: transcript });
  const tx = await deps.store.insertTx(drafts[0]);
  await send(ctx, await messagesForTx(ctx, tx, { heard: transcript }));
}

async function todayCard(ctx: Ctx): Promise<LineMessage> {
  const { deps, userId, profile, now, flex } = ctx;
  const rows = await deps.store.monthTxs(userId, now.month);
  return flex.digest(digestData(rows, profile, now, await deps.store.reviewCount(userId)));
}

/* ------------------------------------------------------------------ */
/* Buttons on cards (postbacks)                                        */
/* ------------------------------------------------------------------ */

async function onPostback(ctx: Ctx, ev: PostbackEvent): Promise<void> {
  const { deps, userId, flex } = ctx;
  const { store } = deps;
  const p = new URLSearchParams(ev.postback.data);
  const act = p.get('act');
  const txId = p.get('tx');
  // Only ever touch the sender's own records, whatever id the button carries
  const own = txId ? await store.getTx(userId, txId) : null;

  switch (act) {
    case 'send_slips':
      return void (await send(ctx, [flex.sendSlipsPrompt()]));
    case 'today':
      return void (await send(ctx, [await todayCard(ctx)]));

    case 'recat':
      if (own) await send(ctx, [flex.askCategory(toFlexTx(own))]);
      return;

    case 'cat': {
      const key = p.get('c') as CatKey | null;
      const category = key && key in CATEGORY_OF && key !== 'unknown' && key !== 'income' ? CATEGORY_OF[key] : null;
      if (!own || own.status === 'deleted' || !category) return;
      // Re-filing a possible duplicate does not settle the duplicate question
      const updated = await store.updateTx(userId, own.id, own.review_kind === 'dup' ? { category } : { category, status: 'ok', review_kind: null });
      if (p.get('rule') === '1') await store.setRule(userId, payeeKey(updated.title), category);
      return void (await send(ctx, await messagesForTx(ctx, updated)));
    }

    // Keep / Discard only apply while the record is still a possible duplicate, so a
    // second tap on an old card does nothing
    case 'keep':
      if (!own || own.review_kind !== 'dup') return;
      await store.updateTx(userId, own.id, { status: 'ok', review_kind: null, allow_dup: true });
      return void (await send(ctx, [text('เก็บทั้งสองรายการแล้ว ✅\nKept both.')]));

    case 'discard':
      if (!own || own.review_kind !== 'dup') return;
      await store.updateTx(userId, own.id, { status: 'deleted', review_kind: null });
      return void (await send(ctx, [text('ลบรายการซ้ำแล้ว 🗑️\nDuplicate discarded.')]));

    case 'split':
      if (!own || own.status === 'deleted') return;
      await store.updateTx(userId, own.id, {
        split_n: 2,
        category: own.category === 'Uncategorized' ? 'Food & Dining' : own.category,
        status: 'ok',
        review_kind: null,
      });
      return void (await send(ctx, [text(`หาร 2 คนแล้ว คุณได้คืน ${baht(Math.abs(own.amount) / 2)} 🤝\nSplit 2 ways: you're owed ${baht(Math.abs(own.amount) / 2)}. Send it to friends from the app.`)]));

    default:
      // act=voice / act=type only open the keyboard or microphone; nothing to answer
      return;
  }
}
