// Talks to the Thanbaht backend (the app-api Supabase function).
// The user is identified by the LINE ID token from LIFF; there is no other login.

import liff from '@line/liff';
import type { Changes, ServerProfile, ServerTx } from './liveData';
import type { CategoryType } from '../types/finance';

/** Not secret: both values are in the public Mini App link. Override with VITE_ variables if they change. */
const API_URL = import.meta.env.VITE_API_URL ?? 'https://frpofsiqqzzqerulnpfc.supabase.co/functions/v1/app-api';
const LIFF_ID = import.meta.env.VITE_LIFF_ID ?? '2011637665-09UpCEEf';

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

  liffReady ??= liff.init({ liffId: LIFF_ID });
  await liffReady;
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href.split('#')[0] });
    return new Promise<string>(() => {}); // the page is navigating to LINE Login
  }
  const token = liff.getIDToken();
  if (!token) throw new ApiError('no_id_token', 'LINE did not provide an ID token. Enable the "openid" scope for this LIFF app in the LINE Developers Console.');
  return token;
}

/** Sign in again: an ID token lasts about an hour. */
export function signInAgain() {
  if (liff.isInClient()) return location.reload();
  liff.logout();
  liff.login({ redirectUri: location.href.split('#')[0] });
}

async function call<T>(body: unknown): Promise<T> {
  const token = await idToken();
  let res: Response;
  try {
    res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-line-id-token': token }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('network', 'Could not reach the server.');
  }
  if (res.status === 401) throw new ApiError('unauthorized', 'Your LINE session expired.');
  if (!res.ok) throw new ApiError('server', `The server answered ${res.status}.`);
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
