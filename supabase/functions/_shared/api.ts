// The Mini App's API: the app sends its LINE ID token, and gets that user's records back.
// Depends only on interfaces (ApiStore, verifyIdToken), so the tests run it with fakes.
//
// Trust rules:
//  - Who the caller is comes ONLY from a LINE ID token that LINE itself has verified.
//  - The app may change only the fields in cleanPatch(). It can never set user_id, trans_ref,
//    verified, slip or image_path: those come from the bot, so "verified" cannot be faked.

import type { AccountId, Category, NewTx, Profile, ReviewKind, Source, TxRow } from './types.ts';
import type { Store } from './store.ts';
import { GeminiError, type SlipReader, type Transcriber } from './gemini.ts';
import { bangkokNow } from './clock.ts';
import { ingestSlip, logQuick } from './ingest.ts';

export interface ApiStore {
  ensureProfile(userId: string, displayName: string | null): Promise<Profile>;
  loadTxs(userId: string): Promise<TxRow[]>;
  getTx(userId: string, id: string): Promise<TxRow | null>;
  /** Returns false when the id is not one of this user's records. */
  updateTx(userId: string, id: string, patch: Partial<NewTx>): Promise<boolean>;
  /** Returns false when a record with this id already exists (a retried save). */
  insertTx(row: NewTx & { id: string }): Promise<boolean>;
  getRules(userId: string): Promise<Record<string, Category>>;
  setRule(userId: string, payeeKey: string, category: Category): Promise<void>;
  setBudget(userId: string, monthlyBudget: number): Promise<void>;
  /** A short-lived URL for a record's stored slip photo, or null when it has none (or isn't this user's). */
  getSignedImageUrl(userId: string, id: string): Promise<string | null>;
}

/** What "add a slip / voice note / words" needs: the same store and readers the LINE bot uses. */
export interface Capture {
  store: Store;
  readSlip: SlipReader;
  transcribe: Transcriber;
  now?: () => Date;
}

export interface ApiDeps {
  store: ApiStore;
  capture?: Capture;
  /** Returns the LINE user id (and name) for a valid ID token, else null. */
  verifyIdToken: (token: string) => Promise<{ sub: string; name?: string } | null>;
  log?: (message: string, detail?: unknown) => void;
}

/* ---------------- LINE ID token verification ---------------- */

/**
 * Asks LINE to verify the token (signature, expiry, and that it was issued to our channel).
 * Results are kept until the token expires, so one app session costs one call to LINE.
 */
export function lineIdTokenVerifier(channelId: string, fetchFn: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, { sub: string; name?: string; expMs: number }>();
  return async (token: string) => {
    const hit = cache.get(token);
    if (hit && hit.expMs > now()) return { sub: hit.sub, name: hit.name };
    cache.delete(token);
    let res: Response;
    try {
      res = await fetchFn('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: token, client_id: channelId }),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    const j = await res.json().catch(() => null) as { sub?: unknown; name?: unknown; exp?: unknown } | null;
    if (!j || typeof j.sub !== 'string' || !j.sub) return null;
    const expMs = typeof j.exp === 'number' ? j.exp * 1000 : 0;
    if (expMs <= now()) return null;
    if (cache.size > 500) cache.clear();
    const name = typeof j.name === 'string' ? j.name : undefined;
    cache.set(token, { sub: j.sub, name, expMs });
    return { sub: j.sub, name };
  };
}

/* ---------------- validation: the app's input is untrusted ---------------- */

const CATEGORIES: Category[] = ['Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Bills & Utilities', 'Entertainment', 'Income', 'Transfer', 'Uncategorized'];
const ACCOUNT_IDS: AccountId[] = ['kbank', 'scb', 'ktb', 'bbl', 'bay', 'ttb', 'gsb', 'tmn', 'cash', 'other'];
const SOURCES: Source[] = ['slip', 'voice', 'text', 'manual'];
const REVIEW_KINDS: ReviewKind[] = ['who', 'dup', 'amount', 'recurring'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isCategory = (v: unknown): v is Category => typeof v === 'string' && (CATEGORIES as string[]).includes(v);
const validDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
};
const validTime = (v: unknown): v is string => typeof v === 'string' && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
const validAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v !== 0 && Math.abs(v) < 10_000_000;
const text = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : undefined);

type Patch = Partial<Pick<NewTx, 'title' | 'category' | 'amount' | 'date' | 'time' | 'account' | 'status' | 'review_kind' | 'review_dup_of' | 'said' | 'note' | 'excluded' | 'split_n' | 'prev_category'>>;

/** The fields the app may change on an existing record. Anything else rejects the whole patch. */
export function cleanPatch(input: unknown): Patch | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    switch (k) {
      case 'title': { const t = text(v, 120)?.trim(); if (!t) return null; out.title = t; break; }
      case 'category': if (!isCategory(v)) return null; out.category = v; break;
      case 'prev_category': if (v !== null && !isCategory(v)) return null; out.prev_category = v; break;
      case 'amount': if (!validAmount(v)) return null; out.amount = Math.round(v * 100) / 100; break;
      case 'date': if (!validDate(v)) return null; out.date = v; break;
      case 'time': if (!validTime(v)) return null; out.time = v; break;
      case 'account': if (typeof v !== 'string' || !(ACCOUNT_IDS as string[]).includes(v)) return null; out.account = v; break;
      case 'status': if (v !== 'ok' && v !== 'review' && v !== 'deleted') return null; out.status = v; break;
      case 'review_kind': if (v !== null && (typeof v !== 'string' || !(REVIEW_KINDS as string[]).includes(v))) return null; out.review_kind = v; break;
      case 'review_dup_of': if (v !== null && (typeof v !== 'string' || !UUID.test(v))) return null; out.review_dup_of = v; break;
      case 'said': case 'note': if (v !== null && text(v, 500) === undefined) return null; out[k] = v; break;
      case 'excluded': if (typeof v !== 'boolean') return null; out.excluded = v; break;
      case 'split_n': if (v !== null && (!Number.isInteger(v) || (v as number) < 2 || (v as number) > 50)) return null; out.split_n = v; break;
      default: return null;
    }
  }
  return Object.keys(out).length ? (out as Patch) : null;
}

/** A record the app created itself (typed in the Add money moment sheet). */
export function cleanNewTx(input: unknown, userId: string): (NewTx & { id: string }) | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  if (typeof o.id !== 'string' || !UUID.test(o.id)) return null;
  const patch = cleanPatch(Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'id' && k !== 'source')));
  if (!patch || patch.title === undefined || !patch.category || patch.amount === undefined || !patch.date || !patch.time || !patch.account) return null;
  if (typeof o.source !== 'string' || !(SOURCES as string[]).includes(o.source)) return null;
  const status = patch.status ?? 'ok';
  if (status === 'deleted') return null;
  const review_kind = status === 'review' ? patch.review_kind ?? null : null;
  if (status === 'review' && !review_kind) return null;
  return {
    id: o.id,
    user_id: userId,
    title: patch.title,
    category: patch.category,
    amount: patch.amount,
    date: patch.date,
    time: patch.time,
    account: patch.account,
    source: o.source as Source,
    status,
    review_kind,
    review_dup_of: review_kind === 'dup' ? patch.review_dup_of ?? null : null,
    said: patch.said ?? null,
    note: patch.note ?? null,
    trans_ref: null,
    verified: false, // only the bot may mark a record verified
    slip: null,
    image_path: null,
    excluded: patch.excluded ?? false,
    split_n: patch.split_n ?? null,
    prev_category: patch.prev_category ?? null,
    allow_dup: false,
  };
}

/* ---------------- the endpoint ---------------- */

const CORS = {
  'Access-Control-Allow-Origin': '*', // safe: the caller is identified by the ID token, not by cookies
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-line-id-token',
  'Access-Control-Max-Age': '86400',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const MAX_ITEMS = 50;

/* ---- slips, voice notes and typed words ---- */

const MAX_IMAGE_BYTES = 4_000_000;
const MAX_AUDIO_BYTES = 3_000_000;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AUDIO_TYPES = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/aac', 'audio/flac'];

/** Reading a slip or voice note costs a Gemini request, so one person may only do so often. */
const READS_PER_WINDOW = 20;
const WINDOW_MS = 10 * 60_000;
const recentReads = new Map<string, number[]>();
function takeRead(userId: string, now = Date.now()): boolean {
  const recent = (recentReads.get(userId) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= READS_PER_WINDOW) {
    recentReads.set(userId, recent);
    return false;
  }
  recent.push(now);
  recentReads.set(userId, recent);
  if (recentReads.size > 1000) recentReads.clear();
  return true;
}

/** base64 → bytes, refusing anything that would decode larger than `max` (checked before decoding). */
function decodeBase64(data: unknown, max: number): Uint8Array | 'too_big' | null {
  if (typeof data !== 'string' || !data) return null;
  if ((data.length * 3) / 4 > max + 4) return 'too_big';
  try {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export async function handleApi(req: Request, deps: ApiDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('x-line-id-token');
  const who = token ? await deps.verifyIdToken(token) : null;
  if (!who) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const userId = who.sub;
  const { store } = deps;

  try {
    if (body.action === 'load') {
      const profile = await store.ensureProfile(userId, who.name ?? null);
      const [transactions, rules] = await Promise.all([store.loadTxs(userId), store.getRules(userId)]);
      return json({ profile: { display_name: profile.display_name, monthly_budget: profile.monthly_budget, owner_names: profile.owner_names }, transactions, rules });
    }

    if (body.action === 'save') {
      const updates = Array.isArray(body.updates) ? body.updates.slice(0, MAX_ITEMS) : [];
      const adds = Array.isArray(body.adds) ? body.adds.slice(0, MAX_ITEMS) : [];
      const rules = Array.isArray(body.rules) ? body.rules.slice(0, MAX_ITEMS) : [];
      const failed: string[] = [];

      await store.ensureProfile(userId, who.name ?? null);

      for (const raw of adds) {
        const row = cleanNewTx(raw, userId);
        if (!row) { failed.push(String((raw as { id?: unknown })?.id ?? '?')); continue; }
        try {
          await store.insertTx(row);
        } catch (e) {
          deps.log?.('add failed', String(e));
          failed.push(row.id);
        }
      }

      for (const u of updates) {
        const id = (u as { id?: unknown })?.id;
        const patch = cleanPatch((u as { patch?: unknown })?.patch);
        if (typeof id !== 'string' || !UUID.test(id) || !patch) { failed.push(String(id ?? '?')); continue; }
        try {
          const current = await store.getTx(userId, id);
          if (!current) { failed.push(id); continue; }
          // Confirming a possible duplicate means "keep both", which the database's uniqueness rule needs to know about
          const settling = current.review_kind === 'dup' && (patch.status === 'ok' || patch.review_kind === null) && patch.status !== 'deleted';
          const ok = await store.updateTx(userId, id, settling ? { ...patch, allow_dup: true } : patch);
          if (!ok) failed.push(id);
        } catch (e) {
          deps.log?.('update failed', String(e));
          failed.push(id);
        }
      }

      for (const r of rules) {
        const key = (r as { key?: unknown })?.key;
        const category = (r as { category?: unknown })?.category;
        if (typeof key !== 'string' || !key || key.length > 120 || !isCategory(category) || category === 'Income' || category === 'Transfer' || category === 'Uncategorized') continue;
        // the app sends the payee key made by payeeKey() (names.ts), the same one the bot uses, so both share rules
        await store.setRule(userId, key, category);
      }

      const budget = body.budget;
      if (typeof budget === 'number' && Number.isInteger(budget) && budget > 0 && budget <= 10_000_000) await store.setBudget(userId, budget);

      return json({ ok: failed.length === 0, failed });
    }

    if (body.action === 'image') {
      const id = body.id;
      if (typeof id !== 'string' || !UUID.test(id)) return json({ error: 'bad_request' }, 400);
      const url = await store.getSignedImageUrl(userId, id);
      return url ? json({ url }) : json({ error: 'not_found' }, 404);
    }

    if (body.action === 'slip' || body.action === 'voice' || body.action === 'text') {
      const cap = deps.capture;
      if (!cap) return json({ error: 'not_available' }, 501);
      const now = bangkokNow((cap.now ?? (() => new Date()))());
      const profile = await cap.store.ensureProfile(userId);

      if (body.action === 'text') {
        const words = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '';
        const txs = words ? await logQuick(cap.store, { userId, profile, now }, words, 'text') : [];
        return json({ result: txs.length ? 'saved' : 'noamount', txs });
      }

      const isSlip = body.action === 'slip';
      const mime = typeof body.mime === 'string' ? body.mime.split(';')[0].toLowerCase() : '';
      if (!(isSlip ? IMAGE_TYPES : AUDIO_TYPES).includes(mime)) return json({ result: 'bad_type' }, 415);
      const bytes = decodeBase64(body.data, isSlip ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES);
      if (bytes === 'too_big') return json({ result: 'too_big' }, 413);
      if (!bytes || !bytes.length) return json({ result: 'bad_data' }, 400);
      if (!takeRead(userId)) return json({ result: 'slow_down' }, 429);

      try {
        if (isSlip) {
          const out = await ingestSlip({
            store: cap.store, readSlip: cap.readSlip, userId, profile, now, messageId: `app-${crypto.randomUUID()}`, bytes, mime,
          });
          return json({ result: out.tx ? 'saved' : out.failure, tx: out.tx });
        }
        const transcript = (await cap.transcribe(bytes, mime)).trim();
        const txs = transcript ? await logQuick(cap.store, { userId, profile, now }, transcript, 'voice') : [];
        return json({ result: txs.length ? 'saved' : 'nohear', transcript, txs });
      } catch (e) {
        if (e instanceof GeminiError) {
          // the reading service, not the user's file: say whether it is a busy moment or the daily allowance
          deps.log?.('reading failed', { action: body.action, status: e.status, message: e.message.slice(0, 200) });
          return json({ result: 'busy', reason: e.status === 429 ? 'quota' : 'busy' });
        }
        throw e;
      }
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    deps.log?.('api error', String(e));
    return json({ error: 'server_error' }, 500);
  }
}
