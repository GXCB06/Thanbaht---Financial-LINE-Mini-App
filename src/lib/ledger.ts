// One source of truth for every number the app shows.
// Screens never add up transactions themselves: they call computeStats().
import { CategoryType, Transaction } from '../types/finance';
import { SPEND_CATEGORIES } from './categories';
import { DAYS_IN_MONTH, DAYS_LEFT, LIVE, MONTH, MONTH_PREFIX, TODAY_DAY, YEAR, dayInMonth, parseISO } from './clock';
import { CATEGORY_BUDGET_SHARE, LAST_MONTH, SAVINGS_HISTORY } from '../data/mockData';

export type Kind = 'income' | 'expense' | 'transfer';

export const kindOf = (t: Transaction): Kind =>
  t.category === 'Transfer' ? 'transfer' : t.amount > 0 ? 'income' : 'expense';

/** Logged, not excluded, not an own-account transfer. */
export const counts = (t: Transaction) => t.status === 'ok' && !t.excluded && t.category !== 'Transfer';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface CategoryStat {
  category: CategoryType;
  spent: number;
  budget: number;
  share: number; // of total spending, 0..1
  lastMonth: number;
  count: number;
}

export interface Stats {
  spent: number;
  income: number;
  net: number;
  savingsRate: number; // 0..1 of income kept so far
  expenseCount: number;
  depositCount: number;
  loggedCount: number;
  budget: number;
  /** Expected spend by today if spending were spread evenly. */
  expectedByToday: number;
  /** Positive = under pace. */
  paceGap: number;
  /** What you can spend per day for the rest of the month and stay on budget. */
  perDay: number;
  remaining: number;
  currentDailyRate: number;
  byDay: number[]; // index 1..DAYS_IN_MONTH, expense only
  countByDay: number[]; // logged records per day (any kind)
  cumulative: number[]; // expense, index 1..
  incomeCumulative: number[]; // index 1..
  /** False when there is nothing from last month to compare with (a new user): screens then hide every "vs last month" line. */
  hasLastMonth: boolean;
  monthShort: string;
  lastMonthShort: string;
  lastMonthName: string;
  lastMonthCumulative: number[]; // index 1..last month's days
  lastMonthSameDay: number;
  spentVsLastMonth: number | null; // ratio change vs same day last month (0.11 = 11% more)
  incomeVsLastMonth: number | null;
  categories: CategoryStat[];
  weekday: { label: string; avg: number; days: number }[];
  weekdayPeak: { label: string; avg: number; ratio: number; topCategory: CategoryType; topShare: number } | null;
  unloggedDays: number[];
  review: Transaction[];
  today: { spent: number; count: number; items: Transaction[] };
  recurring: Transaction[];
  topMerchants: { title: string; category: CategoryType; total: number; visits: number }[];
  lastSlip: Transaction | null;
  savingsHistory: [string, number][];
}

export interface StatsOptions {
  budget: number;
  /** Days the user confirmed as no-spend (so they aren't flagged as unlogged). */
  noSpendDays?: Set<number>;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface LastMonthData {
  days: number;
  income: number;
  byCategory: Record<string, number>;
  cumulative: number[];
}

const monthPrefixOf = (offset: number) => {
  const d = new Date(YEAR, MONTH + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Last month as the user's own records show it; null when they have no spending from then. */
function realLastMonth(all: Transaction[]): LastMonthData | null {
  const prefix = monthPrefixOf(-1);
  const days = new Date(YEAR, MONTH, 0).getDate();
  const byDay = Array(days + 1).fill(0);
  const byCategory: Record<string, number> = {};
  let income = 0;
  for (const t of all) {
    if (!counts(t) || !t.date.startsWith(prefix)) continue;
    if (kindOf(t) === 'income') income += t.amount;
    else {
      byDay[Number(t.date.slice(8, 10))] += -t.amount;
      byCategory[t.category] = (byCategory[t.category] ?? 0) - t.amount;
    }
  }
  const cumulative = [0];
  for (let d = 1; d <= days; d++) cumulative[d] = cumulative[d - 1] + byDay[d];
  return cumulative[days] > 0 ? { days, income, byCategory, cumulative } : null;
}

/** Share of income kept in each of the last few months that have income; empty for a new user. */
function realSavingsHistory(all: Transaction[]): [string, number][] {
  const out: [string, number][] = [];
  for (let k = 5; k >= 1; k--) {
    const prefix = monthPrefixOf(-k);
    let inc = 0;
    let exp = 0;
    for (const t of all) {
      if (!counts(t) || !t.date.startsWith(prefix)) continue;
      if (kindOf(t) === 'income') inc += t.amount;
      else exp += -t.amount;
    }
    if (inc > 0) out.push([MONTH_NAMES[new Date(YEAR, MONTH - k, 1).getMonth()].slice(0, 3), Math.round(((inc - exp) / inc) * 100)]);
  }
  return out;
}

function lastMonthCurve(): number[] {
  const { days, fixedByDay, byCategory } = LAST_MONTH;
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const fixed = Object.values(fixedByDay).reduce((a, b) => a + b, 0);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const weights: number[] = [];
  for (let d = 1; d <= days; d++) {
    const dow = new Date(YEAR, MONTH - 1, d).getDay();
    weights[d] = (0.5 + rnd()) * (dow === 5 || dow === 6 ? 1.6 : 1);
  }
  const wsum = weights.slice(1).reduce((a, b) => a + b, 0);
  const cum: number[] = [0];
  let run = 0;
  for (let d = 1; d <= days; d++) {
    run += (fixedByDay[d] ?? 0) + ((total - fixed) * weights[d]) / wsum;
    cum[d] = Math.round(run);
  }
  return cum;
}
const LAST_MONTH_CUMULATIVE = lastMonthCurve();

export function categoryBudget(category: CategoryType, monthlyBudget: number) {
  return Math.round((CATEGORY_BUDGET_SHARE[category as keyof typeof CATEGORY_BUDGET_SHARE] ?? 0) * monthlyBudget);
}

export function computeStats(all: Transaction[], { budget, noSpendDays = new Set() }: StatsOptions): Stats {
  const month = all.filter(t => t.date.startsWith(MONTH_PREFIX) && t.status !== 'deleted');
  const ok = month.filter(counts);
  const exp = ok.filter(t => kindOf(t) === 'expense');
  const inc = ok.filter(t => kindOf(t) === 'income');

  const byDay = Array(DAYS_IN_MONTH + 1).fill(0);
  const countByDay = Array(DAYS_IN_MONTH + 1).fill(0);
  const incomeByDay = Array(DAYS_IN_MONTH + 1).fill(0);
  month.filter(t => t.status === 'ok').forEach(t => countByDay[dayInMonth(t.date)!]++);
  exp.forEach(t => (byDay[dayInMonth(t.date)!] += -t.amount));
  inc.forEach(t => (incomeByDay[dayInMonth(t.date)!] += t.amount));

  const cumulative = [0];
  const incomeCumulative = [0];
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    cumulative[d] = cumulative[d - 1] + byDay[d];
    incomeCumulative[d] = incomeCumulative[d - 1] + incomeByDay[d];
  }

  const spent = cumulative[DAYS_IN_MONTH];
  const income = incomeCumulative[DAYS_IN_MONTH];
  const expectedByToday = (budget * TODAY_DAY) / DAYS_IN_MONTH;
  const remaining = budget - spent;
  // The made-up "August" only exists for the demo; real users compare with their own last month.
  const last: LastMonthData | null = LIVE
    ? realLastMonth(all)
    : { days: LAST_MONTH.days, income: LAST_MONTH.income, byCategory: LAST_MONTH.byCategory, cumulative: LAST_MONTH_CUMULATIVE };
  const lastMonthSameDay = last ? last.cumulative[Math.min(TODAY_DAY, last.days)] : 0;
  const lastDate = new Date(YEAR, MONTH - 1, 1);

  const categories: CategoryStat[] = SPEND_CATEGORIES.map(category => {
    const items = exp.filter(t => t.category === category);
    const catSpent = items.reduce((a, t) => a - t.amount, 0);
    return {
      category,
      spent: catSpent,
      budget: categoryBudget(category, budget),
      share: spent ? catSpent / spent : 0,
      lastMonth: last?.byCategory[category] ?? 0,
      count: items.length,
    };
  }).sort((a, b) => b.spent - a.spent);

  // Weekday averages of day-to-day spending. Bills and recurring charges land on
  // arbitrary weekdays and would fake a pattern; unlogged days would drag it down.
  const wdSum = Array(7).fill(0);
  const wdDays = Array(7).fill(0);
  const wdCat: Record<string, number>[] = Array.from({ length: 7 }, () => ({}));
  const wd = (d: number) => (parseISO(`${MONTH_PREFIX}-${String(d).padStart(2, '0')}`).getDay() + 6) % 7;
  for (let d = 1; d <= TODAY_DAY; d++) if (countByDay[d]) wdDays[wd(d)]++;
  exp
    .filter(t => t.category !== 'Bills & Utilities' && !t.isRecurring)
    .forEach(t => {
      const w = wd(dayInMonth(t.date)!);
      wdSum[w] += -t.amount;
      wdCat[w][t.category] = (wdCat[w][t.category] ?? 0) + -t.amount;
    });
  const weekday = WEEKDAYS.map((label, i) => ({ label, avg: wdDays[i] ? Math.round(wdSum[i] / wdDays[i]) : 0, days: wdDays[i] }));
  const peakIdx = weekday.reduce((best, w, i) => (w.avg > weekday[best].avg ? i : best), 0);
  const others = weekday.filter((w, i) => i !== peakIdx && w.days);
  const othersAvg = others.length ? others.reduce((a, w) => a + w.avg, 0) / others.length : 0;
  const [topCat, topVal] = Object.entries(wdCat[peakIdx]).sort((a, b) => b[1] - a[1])[0] ?? ['Food & Dining', 0];
  const weekdayPeak = weekday[peakIdx].avg
    ? {
        label: weekday[peakIdx].label,
        avg: weekday[peakIdx].avg,
        ratio: othersAvg ? weekday[peakIdx].avg / othersAvg : 1,
        topCategory: topCat as CategoryType,
        topShare: wdSum[peakIdx] ? topVal / wdSum[peakIdx] : 0,
      }
    : null;

  // A day counts as "missed" only after the first record of the month: days before someone
  // started logging are not gaps. (With no records at all there is nothing to have missed.)
  const firstLoggedDay = Math.min(...month.filter(t => t.status !== 'deleted').map(t => dayInMonth(t.date) ?? Infinity));
  const unloggedDays: number[] = [];
  for (let d = Number.isFinite(firstLoggedDay) ? firstLoggedDay : TODAY_DAY + 1; d <= TODAY_DAY; d++) {
    if (!countByDay[d] && !noSpendDays.has(d)) unloggedDays.push(d);
  }

  const todayItems = month
    .filter(t => t.status === 'ok' && dayInMonth(t.date) === TODAY_DAY)
    .sort((a, b) => b.time.localeCompare(a.time));

  const merchants = new Map<string, { title: string; category: CategoryType; total: number; visits: number }>();
  exp
    .filter(t => !t.isRecurring)
    .forEach(t => {
      const m = merchants.get(t.title) ?? { title: t.title, category: t.category, total: 0, visits: 0 };
      m.total += -t.amount;
      m.visits++;
      merchants.set(t.title, m);
    });

  const lastSlip =
    month
      .filter(t => t.status === 'ok' && t.source === 'slip')
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0] ?? null;

  return {
    spent,
    income,
    net: income - spent,
    savingsRate: income ? (income - spent) / income : 0,
    expenseCount: exp.length,
    depositCount: inc.length,
    loggedCount: month.filter(t => t.status === 'ok').length,
    budget,
    expectedByToday,
    paceGap: expectedByToday - spent,
    perDay: DAYS_LEFT ? Math.max(0, remaining) / DAYS_LEFT : Math.max(0, remaining),
    remaining,
    currentDailyRate: spent / TODAY_DAY,
    byDay,
    countByDay,
    cumulative,
    incomeCumulative,
    hasLastMonth: last !== null,
    monthShort: MONTH_NAMES[MONTH].slice(0, 3),
    lastMonthShort: MONTH_NAMES[lastDate.getMonth()].slice(0, 3),
    lastMonthName: MONTH_NAMES[lastDate.getMonth()],
    lastMonthCumulative: last?.cumulative ?? [],
    lastMonthSameDay,
    spentVsLastMonth: lastMonthSameDay ? (cumulative[TODAY_DAY] - lastMonthSameDay) / lastMonthSameDay : null,
    incomeVsLastMonth: last && last.income ? (income - last.income) / last.income : null,
    categories,
    weekday,
    weekdayPeak,
    unloggedDays,
    review: all.filter(t => t.status === 'review'),
    today: { spent: byDay[TODAY_DAY], count: todayItems.length, items: todayItems },
    recurring: ok.filter(t => t.isRecurring).sort((a, b) => a.date.localeCompare(b.date)),
    topMerchants: [...merchants.values()].sort((a, b) => b.total - a.total).slice(0, 4),
    lastSlip,
    savingsHistory: LIVE ? realSavingsHistory(all) : SAVINGS_HISTORY,
  };
}

/** Month-end projection if the rest of the month runs at `dailyRate`. */
export function projectMonthEnd(stats: Stats, dailyRate: number) {
  const rest = dailyRate * DAYS_LEFT;
  const total = stats.spent + rest;
  return {
    rate: Math.round(dailyRate),
    rest: Math.round(rest),
    total: Math.round(total),
    vsBudget: Math.round(total - stats.budget),
    netSaved: Math.round(stats.income - total),
  };
}
