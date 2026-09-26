// Dates in Bangkok time (UTC+7, no daylight saving) without relying on Intl,
// so results are identical in Deno, Node and the browser.

const BANGKOK_MS = 7 * 60 * 60 * 1000;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface BangkokNow {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  month: string; // YYYY-MM
  year: number;
  monthIndex: number; // 0-11
  day: number;
  daysInMonth: number;
  daysLeft: number; // after today
}

export function bangkokNow(now: Date): BangkokNow {
  const t = new Date(now.getTime() + BANGKOK_MS);
  const iso = t.toISOString();
  const year = t.getUTCFullYear();
  const monthIndex = t.getUTCMonth();
  const day = t.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), month: iso.slice(0, 7), year, monthIndex, day, daysInMonth, daysLeft: daysInMonth - day };
}

/** "23 Sep" */
export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]}`;

/** "Wed 23 Sep" */
export const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH_SHORT[m - 1]}`;
};

/** "SEPTEMBER" */
export const monthName = (iso: string) => MONTH_LONG[Number(iso.slice(5, 7)) - 1];

/** Bank slips print the Buddhist Era year: "23/09/69 12:42". */
export const slipDateTime = (iso: string, time: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${String(Number(y) + 543).slice(-2)} ${time}`;
};

/**
 * Accepts what a model might return for a slip date and gives back "YYYY-MM-DD" and "HH:mm"
 * in the Christian era, or null. Handles Buddhist Era years (2569 → 2026, 69 → 2026).
 */
export function normalizeDateTime(raw: string | null | undefined): { date: string; time: string } | null {
  if (!raw) return null;
  const s = raw.trim();
  let y: number, mo: number, d: number, hh = 0, mm = 0;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [hh, mm] = [Number(m[4]), Number(m[5])];
  } else {
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[T\s,]+(\d{1,2}):(\d{2}))?/);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (m[4] !== undefined) [hh, mm] = [Number(m[4]), Number(m[5])];
    if (y < 100) y += 2500; // two-digit Buddhist year
  }
  if (y > 2400) y -= 543;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCMonth() !== mo - 1) return null; // e.g. 31 Feb
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${y}-${p(mo)}-${p(d)}`, time: `${p(hh)}:${p(mm)}` };
}
