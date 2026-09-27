// Turning what a user sends (a slip photo, typed words, a voice note) into stored records.
// Shared by the LINE bot (handler.ts) and the Mini App API (api.ts), so both behave the same.

import type { NewTx, Profile, SlipReading, TxRow } from './types.ts';
import { DuplicateRefError, type Store } from './store.ts';
import type { SlipReader } from './gemini.ts';
import type { BangkokNow } from './clock.ts';
import { draftFromQuick, draftFromSlip } from './logic.ts';
import { splitExpenses } from './parse.ts';

/** Store a draft. A slip whose bank reference is already logged becomes a "possible duplicate". */
export async function insertWithDuplicateCheck(store: Store, userId: string, draft: NewTx): Promise<TxRow> {
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

export interface SlipInput {
  store: Store;
  readSlip: SlipReader;
  /** Optional: check the slip's QR / reference with a verification service. */
  verifySlip?: (bytes: Uint8Array, reading: SlipReading) => Promise<boolean>;
  userId: string;
  profile: Profile;
  now: BangkokNow;
  /** Names the stored image: unique per upload. */
  messageId: string;
  bytes: Uint8Array;
  mime: string;
  /** Called as soon as the image is safely stored, before it is read (so a failure can still point to it). */
  onSaved?: (imagePath: string) => void;
}

export interface SlipOutcome {
  tx: TxRow | null;
  /** Why there is no record: the picture is not a slip, or its amount could not be read. */
  failure: 'notSlip' | 'unreadable' | null;
  imagePath: string;
}

/** Save the image, read it, and store the record. A failing reader (GeminiError) is thrown for the caller. */
export async function ingestSlip(a: SlipInput): Promise<SlipOutcome> {
  // Saving the image, reading it with Gemini (the slow one) and loading this user's category
  // rules don't depend on each other, so they run together instead of three round trips
  // stacked in series. saveImage still resolves (and calls onSaved) on its own as soon as it's
  // done, whatever the read turns out to say — the image is kept regardless of the reading.
  const [imagePath, reading, rules] = await Promise.all([
    a.store.saveImage(a.userId, a.messageId, a.bytes, a.mime).then(path => {
      a.onSaved?.(path);
      return path;
    }),
    a.readSlip(a.bytes, a.mime),
    a.store.getRules(a.userId),
  ]);
  if (!reading.isSlip) return { tx: null, failure: 'notSlip', imagePath };
  if (reading.amount === null) return { tx: null, failure: 'unreadable', imagePath };

  let verified = false;
  try {
    verified = (await a.verifySlip?.(a.bytes, reading)) ?? false;
  } catch {
    /* an unavailable verifier just means "read from slip", not "verified" */
  }
  const draft = draftFromSlip(reading, { userId: a.userId, profile: a.profile, rules, now: a.now }, { imagePath, verified });
  return { tx: await insertWithDuplicateCheck(a.store, a.userId, draft), failure: null, imagePath };
}

/** Typed or spoken words → one record per expense found ("กาแฟ 65 ข้าว 60" is two). Empty when there is no amount. */
export async function logQuick(
  store: Store,
  ctx: { userId: string; profile: Profile; now: BangkokNow },
  text: string,
  source: 'text' | 'voice',
): Promise<TxRow[]> {
  const rules = await store.getRules(ctx.userId);
  const drafts = splitExpenses(text)
    .map(piece => draftFromQuick(piece, source, { ...ctx, rules }))
    .filter((d): d is NewTx => !!d);
  const rows: TxRow[] = [];
  for (const d of drafts) rows.push(await store.insertTx(d)); // in order, so it reads like the message
  return rows;
}
