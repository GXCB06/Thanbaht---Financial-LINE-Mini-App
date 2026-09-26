import { CategoryType } from '../types/finance';

interface CategoryRule {
  category: CategoryType;
  keywords: string[];
  suggestRecurring?: boolean;
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Food & Dining',
    keywords: [
      'coffee', 'cafe', 'starbucks', 'amazon', 'sukishi', 'food', 'restaurant',
      'burger', 'pizza', 'ramen', 'noodle', 'lunch', 'dinner', 'breakfast',
      'tea', 'boba', 'matcha', 'mcdonald', 'kfc', 'bar', 'sushi', 'bread',
      'bakery', 'snack', 'dessert', 'shabu', 'mookata', 'grabfood', 'lineman',
      'foodpanda', 'beer', 'wine', 'swensen', 'mk', 'bonchon', 'subway',
      'กาแฟ', 'ชา', 'ข้าว', 'ก๋วยเตี๋ยว', 'อาหาร', 'กิน', 'บุฟเฟต์', 'หมูกระทะ',
      'ชาบู', 'สุกี้', 'ขนม', 'เค้ก', 'น้ำ', 'เบียร์', 'ส้มตำ', 'ไก่ย่าง',
      'กะเพรา', 'ราดหน้า', 'บะหมี่', 'ก๋วยจั๊บ', 'ข้าวแกง', 'ร้านอาหาร', 'อเมซอน',
      'สตาร์บัคส์', 'เคเอฟซี', 'แมคโดนัลด์', 'เอ็มเค'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'bts', 'mrt', 'grab', 'bolt', 'taxi', 'train', 'bus', 'fuel', 'gas',
      'petrol', 'shell', 'ptt', 'bcp', 'bangchak', 'caltex', 'parking', 'toll',
      'expressway', 'easy pass', 'airasia', 'nokair', 'vietjet', 'flight',
      'airline', 'airport', 'subway', 'commute', 'van', 'transit',
      'รถไฟฟ้า', 'รถเมล์', 'แท็กซี่', 'น้ำมัน', 'ปั๊ม', 'ทางด่วน', 'ที่จอดรถ',
      'ตั๋วรถ', 'เครื่องบิน', 'วิน', 'มอเตอร์ไซค์', 'แกร็บ', 'โบล์ท', 'บีทีเอส',
      'เอ็มอาร์ที', 'ปตท', 'บางจาก', 'เชลล์'
    ]
  },
  {
    category: 'Bills & Utilities',
    keywords: [
      'mea', 'mwa', 'pea', 'pwa', 'electric', 'water bill', 'utility', 'utilities',
      'internet', 'wifi', 'ais', 'true', 'dtac', '3bb', 'nt', 'condo fee',
      'rent', 'insurance', 'tax', 'maintenance', 'phone bill', 'mobile bill',
      'fiber', 'telco', 'broadband',
      'ค่าไฟ', 'ค่าน้ำ', 'ค่าเน็ต', 'เน็ตบ้าน', 'มือถือ', 'ค่าเช่า', 'ค่าส่วนกลาง',
      'ประกัน', 'ภาษี', 'ทรู', 'เอไอเอส', 'ดีแทค', 'การไฟฟ้า', 'การประปา', 'บิล',
      'ไวไฟ', 'ไฟเบอร์'
    ],
    suggestRecurring: true
  },
  {
    category: 'Shopping',
    keywords: [
      'shopee', 'lazada', '7-eleven', 'seven', '7-11', 'tops', 'lotus',
      'big c', 'cj', 'central', 'mall', 'supermarket', 'market', 'muji',
      'uniqlo', 'ikea', 'zara', 'h&m', 'apple', 'gadget', 'clothes',
      'shoes', 'bag', 'cosmetic', 'skincare', 'boots', 'watsons', 'eveandboy',
      'grocery', 'groceries', 'store', 'shop',
      'ช้อป', 'ซื้อของ', 'เซเว่น', 'บิ๊กซี', 'โลตัส', 'ท็อปส์', 'เสื้อผ้า',
      'รองเท้า', 'กระเป๋า', 'เครื่องสำอาง', 'ตลาด', 'ห้าง', 'ของใช้',
      'วัตสัน', 'บู๊ทส์', 'อีฟแอนด์บอย', 'มูจิ', 'ยูนิโคล่', 'อิเกีย'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'youtube', 'disney', 'cinema', 'major', 'sf cinema',
      'movie', 'game', 'steam', 'playstation', 'nintendo', 'concert', 'ticket',
      'apple tv', 'prime', 'hbo', 'club', 'party', 'karaoke', 'play',
      'twitch', 'roblox', 'garena',
      'หนัง', 'โรงหนัง', 'เกม', 'คอนเสิร์ต', 'ตั๋ว', 'เน็ตฟลิกซ์', 'สปอติฟาย',
      'ยูทูป', 'คาราโอเกะ', 'ปาร์ตี้', 'ดิสนีย์'
    ],
    suggestRecurring: true
  }
];

export interface DetectedCategoryResult {
  category: CategoryType;
  matchedKeyword: string;
  suggestRecurring: boolean;
}

/**
 * Analyzes a merchant / item title using keyword matching
 * and returns the best matching category.
 */
export function detectCategoryFromTitle(title: string): DetectedCategoryResult | null {
  const normalized = title.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return null;

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      const lowerKw = kw.toLowerCase();
      // Check for exact substring match
      if (normalized.includes(lowerKw)) {
        return {
          category: rule.category,
          matchedKeyword: kw,
          suggestRecurring: rule.suggestRecurring || false
        };
      }
    }
  }

  return null;
}
