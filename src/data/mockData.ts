import { AccountId, BankSlipInfo, CategoryType, SubscriptionItem, Transaction, TransactionSource, ReviewKind } from '../types/finance';
import { ACCOUNTS, SPEND_CATEGORIES } from '../lib/categories';
import { isoOf, DAYS_IN_MONTH, MONTH, TODAY_DAY, YEAR } from '../lib/clock';
import { slipDateTime } from '../lib/format';

/* ------------------------------------------------------------------ */
/* Demo month: September 2026, seen on Wed 23 Sep.                     */
/* Every total on every screen is computed from these rows.            */
/* ------------------------------------------------------------------ */

const OWNER = 'นาย ธัญญ์พิสิษฐ์ โ.';

const SLIP_TYPE: Record<AccountId, { code: BankSlipInfo['bankCode']; type: string; prefix: string }> = {
  kbank: { code: 'KBANK', type: 'K PLUS · e-Slip', prefix: 'KB' },
  scb: { code: 'SCB', type: 'SCB EASY · e-Slip', prefix: 'SCB' },
  ktb: { code: 'KTB', type: 'Krungthai NEXT · e-Slip', prefix: 'KTB' },
  tmn: { code: 'TMN', type: 'TrueMoney · e-Slip', prefix: 'TM' },
  cash: { code: 'KBANK', type: '', prefix: '' },
};

interface Extra {
  note?: string;
  said?: string;
  ref?: string;
  verified?: boolean;
  promptPay?: string;
  recipient?: string;
  recurring?: string; // recurring label
  review?: ReviewKind;
  dupOf?: string;
}

type Row = [day: number, time: string, title: string, category: CategoryType, amount: number, account: AccountId, source: TransactionSource, extra?: Extra];

const ROWS: Row[] = [
  [1, '08:55', 'Salary · Siam Creative Co.', 'Income', 27400, 'ktb', 'text', { said: 'เงินเดือนเข้า 27400', note: 'เงินเดือนสุทธิประจำเดือนกันยายน 2569' }],
  [1, '10:02', 'Lumpini Condo fee', 'Bills & Utilities', 2000, 'kbank', 'slip', { recurring: 'Condo common fee' }],
  [1, '12:15', 'ส้มตำนัว', 'Food & Dining', 145, 'kbank', 'slip'],
  [1, '18:40', 'Tops Market', 'Groceries', 455, 'scb', 'slip'],
  [2, '08:20', 'Roots Coffee', 'Food & Dining', 140, 'kbank', 'slip'],
  [2, '12:30', 'ข้าวมันไก่ประตูน้ำ', 'Food & Dining', 60, 'cash', 'voice', { said: 'ข้าวมันไก่ หกสิบบาท' }],
  [2, '19:10', 'Grab', 'Transport', 138, 'tmn', 'slip'],
  [3, '09:00', 'AIS Fibre', 'Bills & Utilities', 641, 'kbank', 'slip', { recurring: 'Home fibre' }],
  [3, '12:20', 'Bonchon', 'Food & Dining', 390, 'scb', 'slip'],
  [4, '08:15', 'BTS Rabbit top-up', 'Transport', 500, 'ktb', 'slip'],
  [4, '13:00', 'MK Suki', 'Food & Dining', 680, 'scb', 'slip'],
  [5, '11:30', 'True Move H', 'Bills & Utilities', 599, 'kbank', 'slip', { recurring: 'Mobile plan' }],
  [5, '19:30', 'Major Cineplex', 'Entertainment', 440, 'scb', 'slip'],
  [6, '10:30', "Lotus's Rama 4", 'Groceries', 640, 'ktb', 'slip'],
  [6, '13:10', 'After You', 'Food & Dining', 245, 'scb', 'slip'],
  [7, '08:25', 'Roots Coffee', 'Food & Dining', 140, 'kbank', 'slip'],
  [7, '09:00', 'Netflix', 'Entertainment', 419, 'kbank', 'slip', { recurring: 'Streaming' }],
  [8, '12:40', 'ส้มตำนัว', 'Food & Dining', 120, 'kbank', 'slip'],
  [8, '18:50', 'Grab', 'Transport', 112, 'tmn', 'slip'],
  [9, '12:10', 'Starbucks', 'Food & Dining', 155, 'scb', 'slip'],
  [9, '19:00', 'Watsons', 'Shopping', 368, 'kbank', 'slip'],
  [10, '09:10', 'MEA · ค่าไฟ', 'Bills & Utilities', 1284, 'kbank', 'slip', { recurring: 'Electricity' }],
  [10, '09:12', 'MWA · ค่าน้ำ', 'Bills & Utilities', 157, 'kbank', 'slip', { recurring: 'Water' }],
  [10, '12:30', 'ร้านอาหารข้าวต้มปลา XYZ', 'Food & Dining', 420, 'kbank', 'slip', { promptPay: 'xxx-xxx-8819' }],
  [11, '12:20', 'ก๋วยเตี๋ยวเรือ', 'Food & Dining', 60, 'cash', 'voice', { said: 'ก๋วยเตี๋ยว หกสิบ' }],
  [11, '19:45', 'Shabushi', 'Food & Dining', 499, 'scb', 'slip'],
  [11, '22:10', 'Grab', 'Transport', 186, 'tmn', 'slip'],
  [12, '12:00', 'Spotify', 'Entertainment', 149, 'kbank', 'slip', { recurring: 'Music' }],
  // 13 Sep: nothing logged
  [14, '08:30', 'Roots Coffee', 'Food & Dining', 140, 'kbank', 'slip'],
  [14, '12:35', 'ข้าวมันไก่ประตูน้ำ', 'Food & Dining', 60, 'cash', 'voice', { said: 'ข้าวมันไก่ หกสิบ' }],
  [15, '12:15', 'ส้มตำนัว', 'Food & Dining', 135, 'kbank', 'slip'],
  [15, '20:10', 'KBank → SCB savings', 'Transfer', 3000, 'kbank', 'slip', { recipient: OWNER, note: 'Sender and receiver are both you, so this is not spending' }],
  [16, '08:10', 'MRT Blue Line', 'Transport', 42, 'ktb', 'text', { said: 'mrt 42' }],
  [16, '18:30', 'Big C Rama 4', 'Groceries', 420, 'ktb', 'slip'],
  [17, '12:40', 'ร้านอาหารข้าวต้มปลา XYZ', 'Food & Dining', 450, 'kbank', 'slip', { promptPay: 'xxx-xxx-8819' }],
  [18, '12:10', 'Starbucks', 'Food & Dining', 155, 'scb', 'slip'],
  [18, '19:20', 'Somboon Seafood', 'Food & Dining', 1120, 'scb', 'slip', { note: 'เลี้ยงวันเกิดเพื่อนร่วมงาน' }],
  [18, '23:05', 'Bolt', 'Transport', 95, 'tmn', 'slip'],
  // 19 Sep: nothing logged
  [20, '11:00', 'YouTube Premium', 'Entertainment', 179, 'kbank', 'slip', { recurring: 'Streaming' }],
  [21, '08:20', 'Roots Coffee', 'Food & Dining', 140, 'kbank', 'slip'],
  [21, '12:30', 'ส้มตำนัว', 'Food & Dining', 120, 'kbank', 'slip'],
  [22, '07:45', '7-Eleven Samyan', 'Groceries', 79, 'cash', 'text', { said: 'เซเว่น 79', note: 'แซนวิชแฮมชีส + นมถั่วเหลือง' }],
  [22, '15:15', 'Uniqlo CentralWorld', 'Shopping', 890, 'scb', 'slip', { note: 'เสื้อเชิ้ต Airism Oversized' }],
  [22, '18:30', 'Freelance design work', 'Income', 5000, 'scb', 'voice', { said: 'ได้ค่าจ้างงานออกแบบ ห้าพันบาท', note: 'ค่าออกแบบ Brand Identity เฟส 1' }],
  [23, '08:30', 'Roots Coffee', 'Food & Dining', 140, 'kbank', 'slip', { note: 'Iced Americano Single Origin' }],
  [23, '10:15', 'Grab', 'Transport', 120, 'kbank', 'slip', { ref: 'KB-20260923-441029', note: 'เดินทางไปประชุมลูกค้าสุขุมวิท' }],
  [23, '12:42', 'ร้านอาหารข้าวต้มปลา XYZ', 'Food & Dining', 450, 'kbank', 'slip', { ref: 'KB-20260923-882194', verified: true, promptPay: 'xxx-xxx-8819', note: 'มื้อเที่ยงกับทีม ข้าวต้มปลากะพงพิเศษ' }],
  [23, '18:20', "Lotus's Rama 4", 'Groceries', 386, 'ktb', 'slip'],
  [23, '19:40', 'After You', 'Food & Dining', 245, 'scb', 'slip'],

  /* Waiting in Review: not counted until confirmed */
  [23, '19:05', 'PromptPay · นางสาว ส. ใจดี', 'Uncategorized', 300, 'scb', 'slip', { review: 'who', recipient: 'นางสาว ส. ใจดี', promptPay: 'xxx-xxx-2231' }],
  [23, '10:16', 'Grab', 'Transport', 120, 'kbank', 'slip', { review: 'dup', ref: 'KB-20260923-441029' }],
  [21, '20:40', 'ข้าวมันไก่', 'Food & Dining', 50, 'cash', 'voice', { review: 'amount', said: 'ข้าวมันไก่ ห้าสิบ' }],
  [21, '09:00', 'Disney+ Hotstar', 'Entertainment', 289, 'kbank', 'slip', { review: 'recurring', recurring: 'Streaming' }],
];

function buildTransactions(rows: Row[]): Transaction[] {
  const byRef = new Map<string, string>();
  return rows.map(([day, time, title, category, abs, account, source, x = {}], i) => {
    const date = isoOf(day);
    const id = `tx-${String(day).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const s = SLIP_TYPE[account];
    const ref = x.ref ?? (source === 'slip' ? `${s.prefix}-${date.replace(/-/g, '')}-${String(100000 + i * 7919).slice(-6)}` : undefined);
    const income = category === 'Income';
    const tx: Transaction = {
      id,
      title,
      category,
      amount: income ? abs : -abs,
      date,
      time,
      verifiedFromSlip: !!x.verified,
      paymentMethod: ACCOUNTS[account].full,
      account,
      source,
      status: x.review ? 'review' : 'ok',
      said: x.said,
      note: x.note,
    };
    if (source === 'slip' && ref) {
      tx.slip = {
        bankName: ACCOUNTS[account].name,
        bankCode: s.code,
        slipType: s.type,
        status: income ? 'เงินเข้าสำเร็จ' : 'โอนเงินสำเร็จ',
        amount: abs,
        senderName: OWNER,
        senderAccount: ACCOUNTS[account].full,
        recipientName: x.recipient ?? title,
        recipientPromptPay: x.promptPay ?? `xxx-xxx-${String(1000 + ((i * 373) % 9000)).slice(-4)}`,
        refNo: ref,
        dateTimeStr: slipDateTime(date, time),
      };
      // A second slip with a ref we have already logged is the duplicate
      if (x.review === 'dup') tx.review = { kind: 'dup', dupOf: byRef.get(ref) };
      else byRef.set(ref, id);
    }
    if (x.review && x.review !== 'dup') tx.review = { kind: x.review };
    // A charge still waiting in Review isn't treated as recurring until confirmed
    if (x.recurring && !x.review) {
      tx.isRecurring = true;
      tx.recurringFrequency = 'monthly';
      tx.billingDay = day;
      tx.recurringLabel = x.recurring;
    }
    return tx;
  });
}

export const INITIAL_TRANSACTIONS: Transaction[] = buildTransactions(ROWS);

/* ------------------------------------------------------------------ */
/* Budget split and last month's numbers (for "vs August" comparisons) */
/* ------------------------------------------------------------------ */

export const DEFAULT_MONTHLY_BUDGET = 22000;

/** Share of the monthly goal each category gets (sums to 1). */
export const CATEGORY_BUDGET_SHARE: Partial<Record<(typeof SPEND_CATEGORIES)[number], number>> = {
  'Food & Dining': 6500 / 22000,
  Groceries: 2500 / 22000,
  Transport: 2000 / 22000,
  Shopping: 3500 / 22000,
  'Bills & Utilities': 5500 / 22000,
  Entertainment: 2000 / 22000,
};

export const LAST_MONTH = {
  label: 'Aug',
  days: new Date(YEAR, MONTH, 0).getDate(),
  income: 30000,
  byCategory: {
    'Food & Dining': 5120,
    Groceries: 2210,
    Transport: 1480,
    Shopping: 3940,
    'Bills & Utilities': 4702,
    Entertainment: 1210,
  } as Record<string, number>,
  /** Fixed bills by day of month, so the comparison curve steps where bills land. */
  fixedByDay: { 1: 2000, 3: 641, 5: 599, 7: 419, 10: 1441, 12: 149, 20: 179 } as Record<number, number>,
};

/** Savings rate (share of income kept) for previous months. */
export const SAVINGS_HISTORY: [string, number][] = [
  ['Apr', 24],
  ['May', 31],
  ['Jun', 19],
  ['Jul', 29],
  ['Aug', 38],
];

/* ------------------------------------------------------------------ */
/* Subscriptions: billing days and amounts match the transactions.     */
/* ------------------------------------------------------------------ */

const nextRenewal = (billingDay: number) => {
  const d = Math.min(billingDay, DAYS_IN_MONTH);
  return d > TODAY_DAY ? isoOf(d) : isoOf(billingDay, MONTH + 1 > 11 ? 0 : MONTH + 1, MONTH + 1 > 11 ? YEAR + 1 : YEAR);
};

type SubSeed = Omit<SubscriptionItem, 'nextRenewalDate' | 'status' | 'frequency'>;

const SUBS: SubSeed[] = [
  { id: 'sub-condo', name: 'Condo Common Fee', planName: 'Lumpini Park monthly juristic', provider: 'Condo Juristic', category: 'Bills & Utilities', amount: 2000, billingDay: 1, paymentMethod: 'K PLUS ··8941', iconName: 'apartment', color: '#5856D6', remindDaysBefore: 5 },
  { id: 'sub-ais', name: 'AIS Fibre', planName: '1Gbps home fibre', provider: 'AIS', category: 'Bills & Utilities', amount: 641, billingDay: 3, paymentMethod: 'K PLUS ··8941', iconName: 'router', color: '#00A94F', remindDaysBefore: 3 },
  { id: 'sub-true', name: 'True Move H', planName: '5G unlimited', provider: 'True', category: 'Bills & Utilities', amount: 599, billingDay: 5, paymentMethod: 'K PLUS ··8941', iconName: 'smartphone', color: '#E4002B', remindDaysBefore: 3 },
  { id: 'sub-netflix', name: 'Netflix', planName: 'Standard', provider: 'Netflix', category: 'Entertainment', amount: 419, billingDay: 7, paymentMethod: 'K PLUS ··8941', iconName: 'tv', color: '#E50914', remindDaysBefore: 2 },
  { id: 'sub-mea', name: 'MEA Electricity', planName: 'Bangkok residence (varies)', provider: 'MEA', category: 'Bills & Utilities', amount: 1284, billingDay: 10, paymentMethod: 'K PLUS ··8941', iconName: 'bolt', color: '#FF9500', remindDaysBefore: 3 },
  { id: 'sub-mwa', name: 'MWA Water', planName: 'Bangkok residence', provider: 'MWA', category: 'Bills & Utilities', amount: 157, billingDay: 10, paymentMethod: 'K PLUS ··8941', iconName: 'water_drop', color: '#0EA5E9', remindDaysBefore: 3 },
  { id: 'sub-spotify', name: 'Spotify', planName: 'Premium Individual', provider: 'Spotify', category: 'Entertainment', amount: 149, billingDay: 12, paymentMethod: 'K PLUS ··8941', iconName: 'music_note', color: '#1DB954', remindDaysBefore: 2 },
  { id: 'sub-youtube', name: 'YouTube Premium', planName: 'Individual (ad-free & Music)', provider: 'Google', category: 'Entertainment', amount: 179, billingDay: 20, paymentMethod: 'K PLUS ··8941', iconName: 'play_circle', color: '#FF0000', remindDaysBefore: 3 },
  { id: 'sub-icloud', name: 'iCloud+ Storage', planName: '200GB family sharing', provider: 'Apple', category: 'Bills & Utilities', amount: 99, billingDay: 27, paymentMethod: 'Apple Pay / KBank', iconName: 'cloud', color: '#007AFF', remindDaysBefore: 2 },
  { id: 'sub-chatgpt', name: 'ChatGPT Plus', planName: 'Plus plan', provider: 'OpenAI', category: 'Entertainment', amount: 750, billingDay: 28, paymentMethod: 'Debit card', iconName: 'smart_toy', color: '#10A37F', remindDaysBefore: 3 },
];

export const INITIAL_SUBSCRIPTIONS: SubscriptionItem[] = SUBS.map(s => ({
  ...s,
  frequency: 'monthly',
  status: 'active',
  nextRenewalDate: nextRenewal(s.billingDay),
}));

export const makeSubscriptionFromTransaction = (tx: Transaction): SubscriptionItem => {
  const day = Number(tx.date.slice(8, 10));
  return {
    id: `sub-${tx.id}`,
    name: tx.title,
    planName: 'Detected from a repeat payment',
    provider: tx.title,
    category: tx.category,
    amount: Math.abs(tx.amount),
    billingDay: day,
    frequency: 'monthly',
    nextRenewalDate: nextRenewal(day),
    status: 'active',
    paymentMethod: tx.paymentMethod,
    iconName: tx.category === 'Entertainment' ? 'live_tv' : 'receipt_long',
    color: '#5856D6',
    remindDaysBefore: 2,
  };
};
