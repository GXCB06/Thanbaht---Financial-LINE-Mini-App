// The app's single notion of "today".
// The demo data describes September 2026 as seen on Wed 23 Sep, so every screen
// reads the date from here. When real data arrives, set DEMO_TODAY to null.
const DEMO_TODAY: Date | null = new Date(2026, 8, 23);

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
