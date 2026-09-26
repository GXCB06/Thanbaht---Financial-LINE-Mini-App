import type { Category } from './types.ts';

// Thai titles and honorifics that appear before names on bank slips.
const TITLES = /^(นางสาว|น\.ส\.|นาย|นาง|ด\.ช\.|ด\.ญ\.|คุณ|mr\.?|mrs\.?|ms\.?|miss)\s*/i;

/** Lowercase, no title, no spaces or punctuation: a stable key for a payee. */
export function payeeKey(name: string): string {
  return name
    .replace(/^PromptPay\s*·\s*/i, '')
    .trim()
    .replace(TITLES, '')
    .toLowerCase()
    .replace(/[\s.·,_\-()]+/g, '');
}

/** True for names that look like a person ("นาย …", "Ms. …") rather than a shop. */
export const looksLikePerson = (name: string) => TITLES.test(name.trim());

/**
 * Do two names on a slip belong to the same person? Slips mask surnames
 * ("นาย ธัญญ์พิสิษฐ์ โ."), so one key being the start of the other counts.
 */
export function sameOwner(a: string | null | undefined, b: string | null | undefined, ownerNames: string[] = []): boolean {
  if (!a || !b) return false;
  const ka = payeeKey(a);
  const kb = payeeKey(b);
  if (ka.length < 3 || kb.length < 3) return false;
  if (ka === kb || ka.startsWith(kb) || kb.startsWith(ka)) return true;
  const owners = ownerNames.map(payeeKey).filter(k => k.length >= 3);
  const isOwner = (k: string) => owners.some(o => o === k || o.startsWith(k) || k.startsWith(o));
  return isOwner(kb);
}

/** Categories a saved payee rule may point to. */
export const RULE_CATEGORIES: Category[] = ['Food & Dining', 'Groceries', 'Transport', 'Shopping', 'Bills & Utilities', 'Entertainment'];
