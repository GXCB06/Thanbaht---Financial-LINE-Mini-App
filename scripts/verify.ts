// Sanity checks for the data layer. Run: npx tsx scripts/verify.ts
import { detectCategoryFromTitle } from '../src/utils/categoryMatcher';
import { computeStats } from '../src/lib/ledger';
import { INITIAL_SUBSCRIPTIONS, INITIAL_TRANSACTIONS, DEFAULT_MONTHLY_BUDGET } from '../src/data/mockData';
import { TODAY_DAY } from '../src/lib/clock';

let failed = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

// Category matcher: each of these was wrong before the rewrite
const cat = (s: string) => detectCategoryFromTitle(s)?.category ?? null;
check('ค่าน้ำ is a bill, not food', cat('ค่าน้ำ 157'), 'Bills & Utilities');
check('เติมน้ำมัน is transport, not food', cat('เติมน้ำมัน 800'), 'Transport');
check('Uniqlo Central is shopping, not bills', cat('Uniqlo CentralWorld'), 'Shopping');
check('"business" does not match "bus"', cat('business lunch'), 'Food & Dining');
check('"vanilla" does not match "van"', cat('vanilla'), null);
check('"barber" does not match "bar"', cat('barber shop'), 'Shopping');
check('taxi is transport, not "tax"', cat('taxi home'), 'Transport');
check('7-Eleven is groceries', cat('7-Eleven Samyan'), 'Groceries');
check('grabfood beats grab', cat('GrabFood order'), 'Food & Dining');
check('ได้ค่าจ้าง is income', cat('ได้ค่าจ้าง 1500'), 'Income');
check('unknown returns null (goes to Review)', cat('something random'), null);

// Ledger: the numbers every screen shows
const s = computeStats(INITIAL_TRANSACTIONS, { budget: DEFAULT_MONTHLY_BUDGET });
check('today is 23 Sep', TODAY_DAY, 23);
check('spent this month', s.spent, 16508);
check('income this month', s.income, 32400);
check('net', s.net, 15892);
check('today spent / records', [s.today.spent, s.today.count], [1341, 5]);
check('safe to spend per day', Math.round(s.perDay), 785);
check('under pace by', Math.round(s.paceGap), 359);
check('unlogged days', s.unloggedDays, [13, 19]);
check('review queue', s.review.map(t => t.review?.kind), ['who', 'dup', 'amount', 'recurring']);
check('duplicate points at the logged Grab', !!s.review.find(t => t.review?.kind === 'dup')?.review?.dupOf, true);
check('own-account transfer not counted', INITIAL_TRANSACTIONS.some(t => t.category === 'Transfer') && s.spent === 16508, true);
check('food spent', s.categories.find(c => c.category === 'Food & Dining')?.spent, 6209);
check('category totals add up', s.categories.reduce((a, c) => a + c.spent, 0), s.spent);
check('no spending after today', s.byDay.slice(TODAY_DAY + 1).every(v => v === 0), true);
check('weekday peak ignores bills', s.weekdayPeak?.label, 'Fri');
check('all times are 24h HH:mm', INITIAL_TRANSACTIONS.every(t => /^\d\d:\d\d$/.test(t.time)), true);

// Subscriptions agree with transactions
const billed = INITIAL_SUBSCRIPTIONS.filter(sub => sub.billingDay <= TODAY_DAY);
check(
  'every subscription billed so far has a matching transaction',
  billed.filter(sub => !INITIAL_TRANSACTIONS.some(t => t.isRecurring && Math.abs(t.amount) === sub.amount && t.billingDay === sub.billingDay)).map(s => s.name),
  [],
);
check('upcoming renewals are after today', INITIAL_SUBSCRIPTIONS.every(sub => sub.nextRenewalDate > '2026-09-23'), true);

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
