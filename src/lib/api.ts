// Talks to the Thanbaht backend (the app-api Supabase function).
// The user is identified by the LINE ID token from LIFF; there is no other login.

import liff from '@line/liff';
import type { Changes, ServerProfile, ServerTx } from './liveData';
import type { CategoryType } from '../types/finance';
import { liffEnvFrom, liffIdFor, type LiffIds } from './liffEnv';

/** Not secret: both values are in the public Mini App link. Override with VITE_ variables if they change. */
const API_URL = import.meta.env.VITE_API_URL ?? 'https://frpofsiqqzzqerulnpfc.supabase.co/functions/v1/app-api';
const LIFF_IDS: LiffIds = {
  developing: import.meta.env.VITE_LIFF_ID ?? '2011637665-09UpCEEf',
  review: import.meta.env.VITE_LIFF_ID_REVIEW,
  published: import.meta.env.VITE_LIFF_ID_PUBLISHED,
};

/** Which of the Mini App's three LIFF apps we were opened through (remembered for the tab: LINE Login redirects). */
function currentLiffId(): string {
  let remembered: string | null = null;
  try { remembered = sessionStorage.getItem('thanbaht_liff_env'); } catch { /* private mode */ }
  const env = liffEnvFrom(location.search, remembered);
  try { sessionStorage.setItem('thanbaht_liff_env', env); } catch { /* private mode */ }
  return liffIdFor(env, LIFF_IDS);
}

export class ApiError extends Error {
  constructor(public code: 'unauthorized' | 'no_id_token' | 'network' | 'server', message: string) {
    super(message);
  }
}

let liffReady: Promise<void> | undefined;

/** The LINE ID token, logging in first when the app runs in a normal browser. */
async function idToken(): Promise<string> {
  // Local testing only (stripped from production builds): ?devtoken=... skips LIFF
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search).get('devtoken') : null;
  if (dev) return dev;

  liffReady ??= liff.init({ liffId: currentLiffId() });
  await liffReady;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href.split('#')[0] });
    return new Promise<string>(() => {}); // the page is navigating to LINE Login
  }
  const token = liff.getIDToken();
  if (!token) throw new ApiError('no_id_token', 'LINE did not provide an ID token. Enable the "openid" scope for this LIFF app in the LINE Developers Console.');
  return token;
}

/** Back to the chat (the Mini App closes; LINE shows the conversation underneath). */
export function closeApp() {
  if (liff.isInClient()) liff.closeWindow();
}

/** Sign in again: an ID token lasts about an hour. */
export function signInAgain() {
  if (liff.isInClient()) return location.reload();
  liff.logout();
  liff.login({ redirectUri: location.href.split('#')[0] });
}

/** `tolerate`: statuses whose JSON body is still an answer the caller wants ("too big", "slow down"). */
async function call<T>(body: unknown, tolerate: number[] = []): Promise<T> {
  const token = await idToken();
  let res: Response;
  try {
    res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-id-token': token }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('network', 'Could not reach the server.');
  }
  if (res.status === 401) throw new ApiError('unauthorized', 'Your LINE session expired.');
  if (!res.ok && !tolerate.includes(res.status)) throw new ApiError('server', `The server answered ${res.status}.`);
  return (await res.json()) as T;
}

export interface LoadResult {
  profile: ServerProfile;
  transactions: ServerTx[];
  /** payee key → category */
  rules: Record<string, CategoryType>;
}

export const loadAll = () => call<LoadResult>({ action: 'load' });

export const saveChanges = (c: Changes) =>
  call<{ ok: boolean; failed: string[] }>({ action: 'save', ...c, updates: c.updates.map(({ id, patch }) => ({ id, patch })) });

/* ---------------- adding slips, voice notes and words ---------------- */

export type CaptureOutcome = 'saved' | 'notSlip' | 'unreadable' | 'busy' | 'noamount' | 'nohear' | 'slow_down' | 'too_big' | 'bad_type' | 'bad_data';

export interface CaptureResult {
  result: CaptureOutcome;
  /** with result "busy": a passing spike, or the daily reading allowance being used up */
  reason?: 'busy' | 'quota';
  /** a slip becomes one record */
  tx?: ServerTx | null;
  /** words or a voice note can be several */
  txs?: ServerTx[];
  transcript?: string;
}

const CAPTURE_STATUSES = [400, 413, 415, 429];

export const captureSlip = (mime: string, data: string) => call<CaptureResult>({ action: 'slip', mime, data }, CAPTURE_STATUSES);
export const captureVoice = (mime: string, data: string) => call<CaptureResult>({ action: 'voice', mime, data }, CAPTURE_STATUSES);
export const captureText = (text: string) => call<CaptureResult>({ action: 'text', text }, CAPTURE_STATUSES);

/** A short-lived URL for a record's original slip photo, or null if it has none. */
export async function getImageUrl(id: string): Promise<string | null> {
  const res = await call<{ url?: string; error?: string }>({ action: 'image', id }, [404]);
  return res.url ?? null;
}
