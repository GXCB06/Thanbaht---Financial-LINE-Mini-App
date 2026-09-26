// The app's single notion of "today".
// The demo data describes September 2026 as seen on Wed 23 Sep, so in demo mode every screen
// reads that date from here. In live mode (real records from the bot) it is the real date.

/** True inside the LINE app: LINE draws its own header, and the app talks to the real backend. */
export const IN_LINE = typeof navigator !== 'undefined' && /\bLine\//i.test(navigator.userAgent);

/**
 * Live mode = real data. It is on inside LINE, and when a browser was sent through LINE Login
 * (or opened with ?live). Anywhere else (a desktop browser, the AI Studio preview) the app
 * shows the demo data. The choice is remembered for the tab, because LINE Login redirects.
 */
function detectLive(): boolean {
  if (IN_LINE) return true;
  if (typeof location === 'undefined') return false;
  const flagged = /[?&](live|liff\.state|liffClientId)\b/.test(location.search);
  try {
    if (flagged) sessionStorage.setItem('thanbaht_live', '1');
    return flagged || sessionStorage.getItem('thanbaht_live') === '1';
  } catch {
    return flagged;
  }
}
export const LIVE = detectLive();

const DEMO_TODAY: Date | null = LIVE ? null : new Date(2026, 8, 23);

export const TODAY = DEMO_TODAY ?? new Date();
export const YEAR = TODAY.getFullYear();
export const MONTH = TODAY.getMonth(); // 0-based
export const TODAY_DAY = TODAY.getDate();
export const DAYS_IN_MONTH = new Date(YEAR, MONTH + 1, 0).getDate();
/** Days after today until the month ends (today excluded). */
export const DAYS_LEFT = DAYS_IN_MONTH - TODAY_DAY;

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTH_PREFIX = `${YEAR}-${pad(MONTH + 1)}`;
export const MONTH_LABEL = TODAY.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const isoOf = (day: number, month = MONTH, year = YEAR) => `${year}-${pad(month + 1)}-${pad(day)}`;
export const TODAY_ISO = isoOf(TODAY_DAY);

export const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Day of the current month for an ISO date, or null if it is another month. */
export const dayInMonth = (iso: string) => (iso.startsWith(MONTH_PREFIX) ? Number(iso.slice(8, 10)) : null);

/** Current wall-clock time as 24h "HH:mm". */
export const nowTime = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Whole days from today to an ISO date (0 = today). */
export const daysFromToday = (iso: string) =>
  Math.round((parseISO(iso).getTime() - parseISO(TODAY_ISO).getTime()) / 86_400_000);
