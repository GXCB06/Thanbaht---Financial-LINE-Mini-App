// The evening nudge: once a day, for every user who hasn't logged anything yet today (or who
// has something waiting in Review), push the same digest card the chat's "today" command shows.
// Depends only on interfaces (Store, LineClient), so it is testable with fakes — see
// scripts/verify-server.ts. Triggered by the daily-digest Edge Function, which pg_cron calls
// on a schedule (see the matching migration).

import { newRetryKey, type LineClient } from './line.ts';
import type { Store } from './store.ts';
import { bangkokNow } from './clock.ts';
import { createFlex } from './flex.ts';
import { digestData } from './logic.ts';

export interface ScheduledDeps {
  store: Store;
  line: LineClient;
  /** Mini App base URL, e.g. https://miniapp.line.me/2000000000-abcdEFGH */
  appUrl: string;
  now?: () => Date;
  log?: (message: string, detail?: unknown) => void;
}

export interface DigestOutcome {
  userId: string;
  sent: boolean;
  reason: 'logged_today' | 'nudged' | 'error';
}

/** One user's evening nudge. Skipped (not an error) when they already logged something today and nothing is waiting. */
async function digestForUser(deps: ScheduledDeps, userId: string): Promise<DigestOutcome> {
  const now = bangkokNow((deps.now ?? (() => new Date()))());
  const [profile, rows, waiting] = await Promise.all([
    deps.store.ensureProfile(userId),
    deps.store.monthTxs(userId, now.month),
    deps.store.reviewCount(userId),
  ]);
  const data = digestData(rows, profile, now, waiting);
  if (data.todayN > 0 && waiting === 0) return { userId, sent: false, reason: 'logged_today' };
  const flex = createFlex(deps.appUrl);
  await deps.line.push(userId, [flex.digest(data)], newRetryKey());
  return { userId, sent: true, reason: 'nudged' };
}

/** Runs the nudge for every user the bot knows about. One user's failure never stops the rest. */
export async function runDailyDigest(deps: ScheduledDeps): Promise<DigestOutcome[]> {
  const userIds = await deps.store.listUserIds();
  const outcomes: DigestOutcome[] = [];
  for (const userId of userIds) {
    try {
      outcomes.push(await digestForUser(deps, userId));
    } catch (e) {
      deps.log?.('daily digest failed for a user', String(e));
      outcomes.push({ userId, sent: false, reason: 'error' });
    }
  }
  return outcomes;
}
