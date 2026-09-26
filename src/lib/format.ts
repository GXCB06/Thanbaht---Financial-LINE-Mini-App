import { Transaction } from '../types/finance';
import { parseISO } from './clock';

export const MINUS = '−';

export const baht = (n: number) => '฿' + Math.round(Math.abs(n)).toLocaleString('en-US');

/** Compact axis label: ฿5k, ฿12.5k, ฿800. */
export const kbaht = (v: number) =>
  v >= 1000 ? '฿' + (v / 1000).toFixed(v % 1000 ? 1 : 0).replace(/\.0$/, '') + 'k' : '฿' + Math.round(v);

export type AmountTone = 'income' | 'expense' | 'transfer';

export const toneOf = (tx: Pick<Transaction, 'amount' | 'category'>): AmountTone =>
  tx.category === 'Transfer' ? 'transfer' : tx.amount > 0 ? 'income' : 'expense';

/** "+฿5,000", "−฿450", or "฿3,000" for own-account transfers. */
export const signedBaht = (tx: Pick<Transaction, 'amount' | 'category'>) => {
  const tone = toneOf(tx);
  return (tone === 'income' ? '+' : tone === 'expense' ? MINUS : '') + baht(tx.amount);
};

export const TONE_CLASS: Record<AmountTone, string> = {
  income: 'text-[#15803D] dark:text-[#4ADE80]',
  expense: 'text-[#1C1C1E] dark:text-neutral-100',
  transfer: 'text-[#6E6E73] dark:text-neutral-400',
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wed 23 Sep" (built by hand: en-GB would print "Sept") */
export const dayLabel = (iso: string) => {
  const d = parseISO(iso);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

/** "28 Sep" */
export const shortDate = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

/** "Wed 23 Sep 2026" */
export const longDate = (iso: string) => `${dayLabel(iso)} ${iso.slice(0, 4)}`;

/** Thai bank slips print the Buddhist Era year: "23/09/69 12:42". */
export const slipDateTime = (iso: string, time: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(Number(y) + 543).slice(-2)} ${time}`;
};

export const pct = (n: number) => `${Math.round(n)}%`;

/** Round an axis step up to 1, 2, 2.5 or 5 × 10ⁿ. */
export const niceStep = (v: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1))));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

/** Axis ticks from 0 that cover `max` in about `count` round steps. */
export const niceTicks = (max: number, count = 4) => {
  const step = niceStep(max / count);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
};

/** "18:30" → "6:30 PM" (the app stores 24-hour times). */
export const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
