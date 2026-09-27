// Sanity checks for the data layer. Run: npx tsx scripts/verify.ts
import { detectCategoryFromTitle } from '../src/utils/categoryMatcher';
import { computeStats } from '../src/lib/ledger';
import { INITIAL_SUBSCRIPTIONS, INITIAL_TRANSACTIONS, DEFAULT_MONTHLY_BUDGET } from '../src/data/mockData';
import { TODAY_DAY, addInterval } from '../src/lib/clock';
import { parseRoute } from '../src/lib/route';
import { bytesToBase64, encodeWav } from '../src/lib/media';
import { diffAgainstServer, isEmpty, patchOf, toTransaction, withUuids, writableOf, type ServerTx } from '../src/lib/liveData';
import { transactionsToCsv } from '../src/lib/csv';
import type { Transaction } from '../src/types/finance';

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
check('หนังสือ (book) is shopping, not หนัง (movie)', cat('หนังสือ 500'), 'Shopping');
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

// Live data: what the server sends becomes the app's records, and only real changes go back
const srv: ServerTx = { id: '11111111-1111-4111-8111-111111111111', title: 'Roots Coffee', category: 'Food & Dining', amount: '-140.00', date: '2026-09-26', time: '09:30', account: 'kbank', source: 'slip', status: 'ok', review_kind: null, review_dup_of: null, said: null, note: null, verified: false, slip: { bankName: 'KBank', slipType: 'KBank · e-Slip', status: 'โอนเงินสำเร็จ', amount: 140, senderName: 'A', recipientName: 'Roots Coffee', recipientPromptPay: '', refNo: 'KB1', dateTimeStr: '26/09/69 09:30' }, image_path: 'U-x/msg1.jpg', excluded: false, split_n: null, prev_category: null };
const live = toTransaction(srv);
check('server amount (a string from numeric) becomes a number', live.amount, -140);
check('bank name and slip carry over, with a bank code', [live.paymentMethod, live.slip?.bankCode, live.verifiedFromSlip], ['K PLUS ··8941', 'KBANK', false]);
check('a plain record has no review, split or note', [live.review, live.split, live.note], [undefined, undefined, undefined]);
check('a stored photo path becomes hasImage, without leaking the path itself', [live.hasImage, 'imagePath' in live], [true, false]);
check('no image_path means no hasImage', !!toTransaction({ ...srv, image_path: null }).hasImage, false);
const rv = toTransaction({ ...srv, id: 'x', status: 'review', review_kind: 'dup', review_dup_of: '22222222-2222-4222-8222-222222222222', split_n: 2 });
check('review reason, duplicate link and split come through', [rv.review, rv.split], [{ kind: 'dup', dupOf: '22222222-2222-4222-8222-222222222222' }, { n: 2 }]);
const snap = () => ({ tx: new Map([[live.id, writableOf(live)]]), rules: {} as Record<string, never>, budget: 22000 });
const noChange = diffAgainstServer({ transactions: [live], rules: {}, budget: 22000 }, snap());
check('nothing changed → nothing to send', isEmpty(noChange), true);
const edited = diffAgainstServer({ transactions: [{ ...live, category: 'Shopping' }], rules: {}, budget: 22000 }, snap());
check('a category change sends only that field', [edited.updates[0]?.id, edited.updates[0]?.patch], [live.id, { category: 'Shopping' }]);
const deleted = diffAgainstServer({ transactions: [{ ...live, status: 'deleted' }], rules: {}, budget: 22000 }, snap());
check('deleting is a status change (undo can bring it back)', deleted.updates[0]?.patch, { status: 'deleted' });
const created = diffAgainstServer({ transactions: [live, { ...live, id: '33333333-3333-4333-8333-333333333333', source: 'text' }], rules: {}, budget: 22000 }, snap());
check('a record the server has never seen is an add, with its source', [created.adds.length, created.adds[0]?.source], [1, 'text']);
const unsavedThenDeleted = diffAgainstServer({ transactions: [live, { ...live, id: '33333333-3333-4333-8333-333333333333', status: 'deleted' }], rules: {}, budget: 22000 }, snap());
check('created and deleted before saving → nothing sent', isEmpty(unsavedThenDeleted), true);
const ruled = diffAgainstServer({ transactions: [live], rules: { roots: 'Food & Dining' }, budget: 30000 }, snap());
check('new rules and a new budget are sent', [ruled.rules, ruled.budget], [[{ key: 'roots', category: 'Food & Dining' }], 30000]);
const vanished = diffAgainstServer({ transactions: [], rules: {}, budget: 22000 }, snap());
check('a record that disappeared from the app is deleted on the server', [vanished.updates[0]?.patch, vanished.updates[0]?.after.status], [{ status: 'deleted', review_kind: null, review_dup_of: null }, 'deleted']);
const snapDeleted = { ...snap(), tx: new Map([[live.id, { ...writableOf(live), status: 'deleted' as const }]]) };
check('...but only once', isEmpty(diffAgainstServer({ transactions: [], rules: {}, budget: 22000 }, snapDeleted)), true);
check('an undone delete comes back as an update to ok', diffAgainstServer({ transactions: [live], rules: {}, budget: 22000 }, snapDeleted).updates[0]?.patch, { status: 'ok' });
check('patchOf with identical records is null', patchOf(writableOf(live), writableOf(live)), null);
let uuidN = 0;
const ids = withUuids([{ ...live, id: 'tx-a' }, { ...live, id: 'tx-b', status: 'review', review: { kind: 'dup', dupOf: 'tx-a' } }], () => `u${++uuidN}`);
check('new records get UUIDs and duplicate links follow them', [ids[0].id, ids[1].id, ids[1].review?.dupOf], ['u1', 'u2', 'u1']);

const someId = '11111111-1111-4111-8111-111111111111';
check('deep link /review opens Review', parseRoute('/review'), { tab: 'review' });
check('deep link /tx/<id> opens that record', parseRoute(`/tx/${someId}`), { txId: someId });
check('liff.state style path with a query works too', parseRoute('/tx?cat=food'), { tab: 'transactions' });
check('the root and unknown paths mean the normal start', [parseRoute('/'), parseRoute(null), parseRoute('/liff.state'), parseRoute('/tx/not-an-id')], [{}, {}, {}, {}]);

// A user's first days: days before the first record are not "missed"
const firstDay = computeStats([{ ...INITIAL_TRANSACTIONS[0], date: '2026-09-21', status: 'ok' }], { budget: DEFAULT_MONTHLY_BUDGET });
check('days before the first record are not counted as unlogged', firstDay.unloggedDays, [22, 23]);
check('no records at all → nothing to have missed', computeStats([], { budget: DEFAULT_MONTHLY_BUDGET }).unloggedDays, []);

// Voice notes are sent as WAV: a wrong header would make every recording unreadable
const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 16000);
const dv = new DataView(wav.buffer);
const tag = (at: number) => String.fromCharCode(...wav.slice(at, at + 4));
check('WAV: RIFF/WAVE/fmt/data markers', [tag(0), tag(8), tag(12), tag(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
check('WAV: 16 kHz, mono, 16-bit PCM', [dv.getUint16(20, true), dv.getUint16(22, true), dv.getUint32(24, true), dv.getUint16(34, true)], [1, 1, 16000, 16]);
check('WAV: sizes add up (44-byte header + 2 bytes per sample)', [wav.length, dv.getUint32(40, true), dv.getUint32(4, true)], [44 + 12, 12, 36 + 12]);
check('WAV: samples are scaled and clipped to 16 bits', [dv.getInt16(44, true), dv.getInt16(46, true), dv.getInt16(48, true), dv.getInt16(50, true), dv.getInt16(52, true), dv.getInt16(54, true)], [0, 16383, -16384, 32767, -32768, 32767]);
check('base64 of large byte arrays does not overflow the stack', bytesToBase64(new Uint8Array(500_000).fill(65)).length, 666_668);

// addInterval: the next billing date from "when did you last pay"
check('monthly: plain next month, same day', addInterval('2026-09-05', 'monthly'), '2026-10-05');
check('monthly: December rolls into January next year', addInterval('2026-12-10', 'monthly'), '2027-01-10');
check('monthly: 31 Jan clamps to Feb\'s last day (2026 is not a leap year)', addInterval('2026-01-31', 'monthly'), '2026-02-28');
check('monthly: 31 Mar clamps to Apr 30', addInterval('2026-03-31', 'monthly'), '2026-04-30');
check('yearly: same month and day, next year', addInterval('2026-09-23', 'yearly'), '2027-09-23');
check('yearly: 29 Feb clamps to 28 Feb in a non-leap year', addInterval('2028-02-29', 'yearly'), '2029-02-28');

// CSV export
const csvTx = (o: Partial<Transaction>): Transaction => ({
  id: 'x', title: 'x', category: 'Food & Dining', amount: -1, date: '2026-09-01', time: '09:00',
  verifiedFromSlip: false, paymentMethod: 'Cash', account: 'cash', source: 'manual', status: 'ok', ...o,
});
const csvRows = (csv: string) => csv.trim().split('\r\n');
const basicCsv = transactionsToCsv([
  csvTx({ title: 'Later one', date: '2026-09-02', time: '08:00', amount: -100 }),
  csvTx({ title: 'Earlier one', date: '2026-09-01', time: '20:00', amount: 250, category: 'Income' }),
  csvTx({ title: 'Removed', status: 'deleted' }),
]);
check('header row', csvRows(basicCsv)[0], 'Date,Time,Title,Category,Amount,Account,Status,Source,Note');
check('sorted oldest first, deleted rows dropped', csvRows(basicCsv).slice(1).map(r => r.split(',')[2]), ['Earlier one', 'Later one']);
check('amount keeps its sign, two decimals', csvRows(basicCsv)[1].split(',')[4], '250.00');
check('account and category are human names', csvRows(basicCsv)[2].split(',').slice(4), ['-100.00', 'Cash', 'ok', 'manual', '']);

const escaped = transactionsToCsv([csvTx({ title: 'ร้าน, "อร่อย"', note: 'two\nlines' })]);
check('commas and quotes are escaped, quoted fields keep embedded newlines', csvRows(escaped)[1], '2026-09-01,09:00,"ร้าน, ""อร่อย""",Food & Dining,-1.00,Cash,ok,manual,"two\nlines"');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
