// The app has no router. It only needs to understand the few deep links the bot's cards use:
//   https://miniapp.line.me/<LIFF_ID>/review      → the Review tab
//   https://miniapp.line.me/<LIFF_ID>/tx/<id>     → one record
// LIFF hands the path over either as the real path or as ?liff.state=/review.

import type { ActiveTab } from '../types/finance';

export interface Route {
  tab?: ActiveTab;
  txId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `pathOrState` is a path such as "/review" or "/tx/<uuid>?x=1"; anything unknown gives an empty route. */
export function parseRoute(pathOrState: string | null | undefined): Route {
  const path = (pathOrState ?? '').split(/[?#]/)[0].replace(/\/+$/, '');
  const tx = path.match(/^\/tx\/([^/]+)$/);
  if (tx) return UUID.test(tx[1]) ? { txId: tx[1] } : {};
  if (path === '/review') return { tab: 'review' };
  if (path === '/tx') return { tab: 'transactions' };
  if (path === '/insights') return { tab: 'insights' };
  return {};
}

export function currentRoute(loc: Pick<Location, 'pathname' | 'search'> = location): Route {
  const state = new URLSearchParams(loc.search).get('liff.state');
  return parseRoute(state ?? loc.pathname);
}
