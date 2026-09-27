// GENERATED from src/utils/categoryMatcher.ts by scripts/sync-server.mjs. Do not edit here:
// change the app file and run `npm run sync:server`.
import type { Category as CategoryType } from './types.ts';

interface CategoryRule {
  category: CategoryType;
  keywords: string[];
  suggestRecurring?: boolean;
}

// The longest matching keyword wins across all rules, so specific phrases beat
// generic ones: "ค่าน้ำ" (water bill) beats "น้ำ" (drink), "grabfood" beats "grab".
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Food & Dining',
    keywords: [
      'coffee', 'cafe', 'café', 'starbucks', 'cafe amazon', 'food', 'restaurant', 'burger', 'pizza', 'ramen',
      'noodle', 'lunch', 'dinner', 'breakfast', 'tea', 'boba', 'matcha', 'mcdonald', 'kfc', 'bar', 'sushi',
      'bread', 'bakery', 'snack', 'dessert', 'shabu', 'shabushi', 'mookata', 'grabfood', 'lineman', 'foodpanda',
      'beer', 'wine', 'swensen', 'mk', 'mk suki', 'bonchon', 'after you', 'seafood',
      'กาแฟ', 'ชา', 'ข้าว', 'ก๋วยเตี๋ยว', 'อาหาร', 'กิน', 'บุฟเฟต์', 'หมูกระทะ', 'ชาบู', 'สุกี้', 'ขนม', 'เค้ก',
      'น้ำ', 'เบียร์', 'ส้มตำ', 'ไก่ย่าง', 'กะเพรา', 'ราดหน้า', 'บะหมี่', 'ก๋วยจั๊บ', 'ข้าวแกง', 'ร้านอาหาร',
      'ข้าวมันไก่', 'อเมซอน', 'สตาร์บัคส์', 'เคเอฟซี', 'แมคโดนัลด์', 'เอ็มเค',
    ],
  },
  {
    category: 'Groceries',
    keywords: [
      '7-eleven', '7-11', 'seven eleven', 'tops', 'lotus', "lotus's", 'big c', 'bigc', 'cj', 'cj more', 'makro',
      'gourmet market', 'villa market', 'supermarket', 'grocery', 'groceries', 'foodland',
      'เซเว่น', 'บิ๊กซี', 'โลตัส', 'ท็อปส์', 'แม็คโคร', 'ซูเปอร์', 'ตลาดสด', 'ของสด', 'ซื้อกับข้าว',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'bts', 'mrt', 'grab', 'bolt', 'taxi', 'train', 'bus', 'fuel', 'gas', 'petrol', 'shell', 'ptt', 'bcp',
      'bangchak', 'caltex', 'parking', 'toll', 'expressway', 'easy pass', 'airasia', 'nok air', 'vietjet',
      'flight', 'airline', 'airport', 'commute', 'van', 'transit', 'rabbit',
      'รถไฟฟ้า', 'รถเมล์', 'แท็กซี่', 'น้ำมัน', 'เติมน้ำมัน', 'ปั๊ม', 'ทางด่วน', 'ที่จอดรถ', 'ค่าจอดรถ', 'ตั๋วรถ',
      'เครื่องบิน', 'วิน', 'มอเตอร์ไซค์', 'แกร็บ', 'โบลต์', 'บีทีเอส', 'เอ็มอาร์ที', 'ปตท', 'บางจาก', 'เชลล์', 'ค่ารถ',
    ],
  },
  {
    category: 'Bills & Utilities',
    keywords: [
      'mea', 'mwa', 'pea', 'pwa', 'electric', 'electricity', 'water bill', 'utility', 'utilities', 'internet',
      'wifi', 'ais', 'true move', 'truemove', 'dtac', '3bb', 'condo fee', 'common fee', 'rent', 'insurance',
      'tax', 'maintenance', 'phone bill', 'mobile bill', 'fiber', 'fibre', 'broadband', 'icloud',
      'ค่าไฟ', 'ค่าน้ำ', 'ค่าน้ำประปา', 'ค่าเน็ต', 'เน็ตบ้าน', 'ค่าโทรศัพท์', 'ค่ามือถือ', 'ค่าเช่า', 'ค่าส่วนกลาง',
      'ประกัน', 'ภาษี', 'เอไอเอส', 'ดีแทค', 'การไฟฟ้า', 'การประปา', 'บิล', 'ไวไฟ', 'ไฟเบอร์',
    ],
    suggestRecurring: true,
  },
  {
    category: 'Shopping',
    keywords: [
      'shopee', 'lazada', 'central', 'mall', 'muji', 'uniqlo', 'ikea', 'zara', 'h&m', 'apple store', 'gadget',
      'clothes', 'shoes', 'bag', 'cosmetic', 'skincare', 'boots', 'watsons', 'eveandboy', 'shop', 'store',
      'kinokuniya', 'book store', 'bookstore',
      'ช้อป', 'ซื้อของ', 'หนังสือ', 'ร้านหนังสือ', 'นิยาย', 'เสื้อ', 'เสื้อผ้า', 'รองเท้า', 'กระเป๋า', 'เครื่องสำอาง', 'ห้าง', 'ของใช้', 'วัตสัน',
      'บู๊ทส์', 'อีฟแอนด์บอย', 'มูจิ', 'ยูนิโคล่', 'อิเกีย',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'youtube', 'disney', 'hotstar', 'cinema', 'major', 'major cineplex', 'sf cinema',
      'movie', 'game', 'steam', 'playstation', 'nintendo', 'concert', 'ticket', 'apple tv', 'prime video', 'hbo',
      'club', 'party', 'karaoke', 'twitch', 'roblox', 'garena', 'chatgpt',
      'หนัง', 'โรงหนัง', 'เกม', 'คอนเสิร์ต', 'ตั๋วหนัง', 'เน็ตฟลิกซ์', 'สปอติฟาย', 'ยูทูป', 'คาราโอเกะ', 'ปาร์ตี้', 'ดิสนีย์',
    ],
    suggestRecurring: true,
  },
  {
    category: 'Income',
    keywords: [
      'salary', 'income', 'payroll', 'got paid', 'received', 'refund',
      'เงินเดือน', 'ค่าจ้าง', 'ได้ค่าจ้าง', 'ได้เงิน', 'รับเงิน', 'โอนเข้า', 'เงินเข้า', 'โบนัส', 'คืนเงิน',
    ],
  },
];

export interface DetectedCategoryResult {
  category: CategoryType;
  matchedKeyword: string;
  suggestRecurring: boolean;
}

const LATIN = /^[\x00-\x7F]+$/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Short English keywords must match a whole word ("bar" must not match "barber",
// "tax" must not match "taxi", "nt" must not match "central"). Thai has no spaces
// between words, so Thai keywords match as substrings.
const matchers = CATEGORY_RULES.flatMap(rule =>
  rule.keywords.map(kw => {
    const lower = kw.toLowerCase();
    const re = LATIN.test(lower)
      ? lower.length <= 4
        ? new RegExp(`(^|[^a-z0-9])${escape(lower)}($|[^a-z0-9])`)
        : new RegExp(`(^|[^a-z0-9])${escape(lower)}`)
      : null;
    return { rule, kw, lower, re };
  }),
);

/**
 * Suggests a category for a merchant / note. Returns null when nothing matches,
 * so the caller can ask the user (Review) instead of guessing.
 */
export function detectCategoryFromTitle(title: string): DetectedCategoryResult | null {
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 2) return null;

  let best: (typeof matchers)[number] | null = null;
  for (const m of matchers) {
    const hit = m.re ? m.re.test(normalized) : normalized.includes(m.lower);
    if (hit && (!best || m.lower.length > best.lower.length)) best = m;
  }
  return best
    ? { category: best.rule.category, matchedKeyword: best.kw, suggestRecurring: !!best.rule.suggestRecurring }
    : null;
}
