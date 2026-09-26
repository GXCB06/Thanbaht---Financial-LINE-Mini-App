export interface QuickParse {
  title: string;
  amount: number; // always positive
}

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;

/**
 * Reads messages like "กาแฟ 65", "ข้าวมันไก่ 60 บาท", "ได้ค่าจ้าง 1,500" or "7-Eleven 79".
 * The amount is the number at the END of the message (or the one followed by บาท), never a
 * number inside a name, so "7-Eleven 79" is ฿79 and not ฿7. Returns null without an amount.
 */
export function parseQuick(input: string): QuickParse | null {
  const s = input.trim();
  if (!s) return null;

  const pick = (m: RegExpMatchArray | null) => (m ? { raw: m[0], value: m[1] } : null);
  const hit =
    pick(s.match(new RegExp(String.raw`(?:^|\s)฿?\s*${NUM}\s*(?:บาท|baht|฿)?\s*$`, 'i'))) ??
    pick(s.match(new RegExp(String.raw`${NUM}\s*(?:บาท|baht)`, 'i'))) ??
    pick([...s.matchAll(new RegExp(String.raw`(?:^|\s)${NUM}(?=\s|$)`, 'g'))].pop() ?? null);
  if (!hit) return null;

  const amount = Number(hit.value.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount >= 10_000_000) return null;

  const title = s.replace(hit.raw, ' ').replace(/\s+/g, ' ').trim();
  return { title: title || 'Quick add', amount };
}

/* ---------------- several expenses in one message ---------------- */

// A number that stands on its own (not the 7 in "7-Eleven"), optionally with ฿ / บาท / baht
const AMOUNT_TOKEN = /(?:^|\s)฿?\d[\d,]*(?:\.\d+)?\s*(?:บาท|baht|฿)?(?=\s|$)/gi;
// "ข้าว 2 จาน 60": the 2 is a quantity, so don't cut after it
const UNIT_NEXT = /^\s*(?:จาน|แก้ว|ชิ้น|อัน|ถุง|กล่อง|คน|ที่|ขวด|ห่อ|x\d*|pcs|pc)(?=\s|$|\d)/i;
export const MAX_EXPENSES = 12;

const hasAmount = (s: string) => parseQuick(s) !== null;

/** One line, possibly "กาแฟ 65 ข้าว 60 แท็กซี่ 180": cut after every amount that is followed by more text. */
function cutAfterAmounts(line: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  for (const m of line.matchAll(AMOUNT_TOKEN)) {
    const end = (m.index ?? 0) + m[0].length;
    const rest = line.slice(end);
    if (!rest.trim() || UNIT_NEXT.test(rest)) continue;
    pieces.push(line.slice(start, end).trim());
    start = end;
  }
  pieces.push(line.slice(start).trim());
  // A piece that is only a number has lost its name ("65 กาแฟ 60 ข้าว"): don't guess, keep the line whole
  const named = pieces.filter(hasAmount);
  return named.length > 1 && named.every(p => (parseQuick(p)?.title ?? 'Quick add') !== 'Quick add') ? named : [line.trim()];
}

/**
 * Splits a message into separate expenses. Lines and ";" always separate items; on one line,
 * commas and "และ" / "and" separate them too, and so does an amount followed by more text.
 * Pieces that have no amount are ignored (a heading like "วันนี้ใช้เงิน:"), except that a
 * name before a comma ("coffee, 65") is joined to the piece after it.
 */
export function splitExpenses(input: string): string[] {
  const out: string[] = [];
  for (const line of input.split(/[\r\n;]+/)) {
    const parts = line.split(/,\s+|,(?=\D)|\s+และ\s+|\s+แล้วก็\s+|\s+and\s+/i).map(p => p.trim()).filter(Boolean);
    let carry = '';
    const joined: string[] = [];
    for (const p of parts) {
      const piece = carry ? `${carry} ${p}` : p;
      if (hasAmount(piece)) {
        joined.push(piece);
        carry = '';
      } else carry = piece;
    }
    for (const j of joined) out.push(...cutAfterAmounts(j));
  }
  return out.slice(0, MAX_EXPENSES);
}
