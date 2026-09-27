// A small, hand-rolled i18n layer: no external library, just two dictionaries and a hook.
// Only the app's core chrome (nav, Overview, Activity, Review, a transaction's detail, the More
// menu) is translated so far — everything else keeps its plain English JSX text unchanged.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CategoryType } from '../types/finance';

export type Lang = 'en' | 'th';

const PREF_KEY = 'thanbaht_lang';

const readPref = (): Lang | null => {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === 'th' || v === 'en' ? v : null;
  } catch {
    return null;
  }
};
const writePref = (lang: Lang) => {
  try {
    localStorage.setItem(PREF_KEY, lang);
  } catch {
    /* private mode: the choice just won't persist */
  }
};

export const CATEGORY_TH: Record<CategoryType, string> = {
  'Food & Dining': 'อาหารและเครื่องดื่ม',
  Groceries: 'ของใช้ในบ้าน',
  Transport: 'การเดินทาง',
  Shopping: 'ช้อปปิ้ง',
  'Bills & Utilities': 'บิลและค่าสาธารณูปโภค',
  Entertainment: 'บันเทิง',
  Income: 'รายรับ',
  Transfer: 'โอนเงิน',
  Uncategorized: 'ยังไม่ระบุหมวดหมู่',
};

const EN: Record<string, string> = {
  // Nav
  'nav.home': 'Home',
  'nav.activity': 'Activity',
  'nav.review': 'Review',
  'nav.insights': 'Insights',

  // More menu
  'more.hideAmountsInPublic': 'Hide amounts in public',
  'more.on': 'On',
  'more.off': 'Off',
  'more.switchToLight': 'Switch to Light Mode',
  'more.switchToDark': 'Switch to Dark Mode',
  'more.light': 'Light',
  'more.dark': 'Dark',
  'more.language': 'Language',
  'more.shareToLine': 'Share to LINE Chat',
  'more.resetDemo': 'Reset Demo Transactions',
  'more.close': 'Close',

  // Overview
  'overview.title': 'Overview',
  'overview.monthlyBudget': 'Monthly Budget',
  'overview.onTrack': 'On Track',
  'overview.approachingLimit': 'Approaching Limit',
  'overview.overBudget': 'Over Budget',
  'overview.editGoal': 'Edit Goal',
  'overview.adjust': 'Adjust',
  'overview.percentSpent': 'spent',
  'overview.remaining': 'remaining',
  'overview.overBudgetBy': 'over budget',
  'overview.safePace': 'Safe pace',
  'overview.perDay': '/ day',
  'overview.forOneDay': 'for 1 day',
  'overview.forNDays': 'for {n} days',
  'overview.lastDayOfMonth': 'Last day of the month',
  'overview.budgetCeilingReached': 'Budget ceiling reached for {month}.',
  'overview.income': 'Income',
  'overview.expenses': 'Expenses',
  'overview.vsLastMonth': 'vs last mo.',
  'overview.cumulativeTrajectory': 'Cumulative Trajectory',
  'overview.subscriptionCalendar': 'Subscription Calendar',
  'overview.openCalendar': 'Open Calendar',
  'overview.tomorrow': 'Tomorrow',
  'overview.inNDays': 'In {n} days',
  'overview.recentActivity': 'Recent Activity',
  'overview.viewAll': 'View all',
  'overview.nothingYet': 'Nothing yet. Tap + to add your first slip.',

  // Activity (Transactions tab)
  'activity.daily': 'Daily',
  'activity.monthly': 'Monthly',
  'activity.yearly': 'Yearly',
  'activity.searchPlaceholder': 'Search merchant, description, or amount...',
  'activity.quick': 'Quick:',
  'activity.all': 'All',
  'activity.income': 'Income',
  'activity.expenses': 'Expenses',
  'activity.add': 'Add',
  'activity.selectTransactions': 'Select transactions',
  'activity.selected': 'selected',
  'activity.cancel': 'Cancel',
  'activity.none': 'None',
  'activity.chooseADate': 'Choose a date',
  'activity.noTransactionsFound': 'No transactions found',
  'activity.tryAnotherPeriod': 'Try another period, filter or word',
  'activity.netFlow': 'Net Flow',
  'activity.jumpToYear': 'Jump to year',
  'activity.clear': 'Clear',
  'activity.foundOneMatching': 'Found 1 transaction matching',
  'activity.foundNMatching': 'Found {n} transactions matching',
  'activity.showingOnly': 'Showing {category} only',
  'activity.net': 'Net',
  'activity.spentOneTx': 'Spent {amount} · 1 transaction',
  'activity.spentNTx': 'Spent {amount} · {n} transactions',

  // Review
  'review.title': 'Review',
  'review.subtitle': 'Confirm slips, recurring charges, and notes',
  'review.add': 'Add',
  'review.allCaughtUp': 'All caught up!',
  'review.allCaughtUpBody': 'All bank slips and recurring items have been reviewed.',
  'review.backToOverview': 'Back to Overview',
  'review.whatWasThisFor': 'What was this for?',
  'review.oneAlreadyLogged': 'one already logged',
  'review.sameBankRefAs': 'Same bank reference as',
  'review.iHeard': 'I heard',
  'review.looksLikeNewCharge': 'Looks like a new monthly charge',
  'review.needsCategory': 'Needs a category',
  'review.keepBoth': 'Keep both',
  'review.discard': 'Discard',
  'review.edit': 'Edit',
  'review.confirm': 'Confirm',
  'review.once': 'Once',
  'review.track': 'Track',
  'review.split': 'Split',

  // Transaction detail
  'detail.transactions': 'Transactions',
  'detail.expense': 'Expense',
  'detail.income': 'Income',
  'detail.transfer': 'Transfer',
  'detail.needsReview': 'Needs Review',
  'detail.verifiedFromSlip': 'Verified from slip',
  'detail.readFromSlip': 'Read from slip',
  'detail.fromVoiceNote': 'From voice note',
  'detail.typedInChat': 'Typed in chat',
  'detail.addedByHand': 'Added by hand',
  'detail.transactionDetails': 'Transaction Details',
  'detail.category': 'Category',
  'detail.payment': 'Payment',
  'detail.dateTime': 'Date & Time',
  'detail.account': 'Account',
  'detail.note': 'Note',
  'detail.addANote': 'Add a note',
  'detail.split': 'Split',
  'detail.owed': "you're owed",
  'detail.repeats': 'Repeats',
  'detail.bankRef': 'Bank ref',
  'detail.splitBill': 'Split bill (หารกัน)',
  'detail.transferBetweenAccounts': 'Transfer between my accounts',
  'detail.excludeFromStats': 'Exclude from stats',
  'detail.moreDetails': 'More details ▾',
  'detail.lessDetails': 'Less details ▴',
  'detail.sourceReceipt': 'Source Receipt',
  'detail.viewPhoto': 'View photo →',
  'detail.viewSlip': 'View slip →',
  'detail.viewOriginalInLine': 'View original in LINE →',
  'detail.source': 'Source',
  'detail.editTransaction': 'Edit Transaction',
  'detail.deleteTransaction': 'Delete Transaction',
  'detail.couldntLoadPhoto': "Couldn't load the original photo",
  'detail.voiceNote': 'Voice note',
  'detail.alwaysFile': 'Always file',
  'detail.thisWay': 'this way',
  'detail.eachPays': 'Each pays',
  'detail.youreOwed': "you're owed",
  'detail.saveSplit': 'Save split',
  'detail.fewerPeople': 'Fewer people',
  'detail.morePeople': 'More people',
};

/** en → th. A key missing here just falls back to its English text — nothing breaks. */
const TH: Record<string, string> = {
  // Nav
  'nav.home': 'หน้าแรก',
  'nav.activity': 'รายการ',
  'nav.review': 'ตรวจสอบ',
  'nav.insights': 'ภาพรวม',

  // More menu
  'more.hideAmountsInPublic': 'ซ่อนยอดเงินในที่สาธารณะ',
  'more.on': 'เปิด',
  'more.off': 'ปิด',
  'more.switchToLight': 'สลับเป็นโหมดสว่าง',
  'more.switchToDark': 'สลับเป็นโหมดมืด',
  'more.light': 'สว่าง',
  'more.dark': 'มืด',
  'more.language': 'ภาษา',
  'more.shareToLine': 'แชร์ไปยัง LINE แชท',
  'more.resetDemo': 'รีเซ็ตข้อมูลตัวอย่าง',
  'more.close': 'ปิด',

  // Overview
  'overview.title': 'ภาพรวม',
  'overview.monthlyBudget': 'งบประมาณต่อเดือน',
  'overview.onTrack': 'อยู่ในเป้าหมาย',
  'overview.approachingLimit': 'ใกล้ถึงขีดจำกัด',
  'overview.overBudget': 'เกินงบประมาณ',
  'overview.editGoal': 'แก้ไขเป้าหมาย',
  'overview.adjust': 'ปรับ',
  'overview.percentSpent': 'ใช้ไปแล้ว',
  'overview.remaining': 'คงเหลือ',
  'overview.overBudgetBy': 'เกินงบ',
  'overview.safePace': 'ใช้ได้อย่างปลอดภัย',
  'overview.perDay': '/ วัน',
  'overview.forOneDay': 'อีก 1 วัน',
  'overview.forNDays': 'อีก {n} วัน',
  'overview.lastDayOfMonth': 'วันสุดท้ายของเดือน',
  'overview.budgetCeilingReached': 'ใช้งบครบสำหรับ {month} แล้ว',
  'overview.income': 'รายรับ',
  'overview.expenses': 'รายจ่าย',
  'overview.vsLastMonth': 'เทียบเดือนที่แล้ว',
  'overview.cumulativeTrajectory': 'แนวโน้มสะสม',
  'overview.subscriptionCalendar': 'ปฏิทินการสมัครสมาชิก',
  'overview.openCalendar': 'เปิดปฏิทิน',
  'overview.tomorrow': 'พรุ่งนี้',
  'overview.inNDays': 'อีก {n} วัน',
  'overview.recentActivity': 'รายการล่าสุด',
  'overview.viewAll': 'ดูทั้งหมด',
  'overview.nothingYet': 'ยังไม่มีรายการ แตะ + เพื่อเพิ่มสลิปแรกของคุณ',

  // Activity (Transactions tab)
  'activity.daily': 'รายวัน',
  'activity.monthly': 'รายเดือน',
  'activity.yearly': 'รายปี',
  'activity.searchPlaceholder': 'ค้นหาร้านค้า รายละเอียด หรือจำนวนเงิน...',
  'activity.quick': 'ที่ใช้บ่อย:',
  'activity.all': 'ทั้งหมด',
  'activity.income': 'รายรับ',
  'activity.expenses': 'รายจ่าย',
  'activity.add': 'เพิ่ม',
  'activity.selectTransactions': 'เลือกรายการ',
  'activity.selected': 'ที่เลือก',
  'activity.cancel': 'ยกเลิก',
  'activity.none': 'ไม่เลือก',
  'activity.chooseADate': 'เลือกวันที่',
  'activity.noTransactionsFound': 'ไม่พบรายการ',
  'activity.tryAnotherPeriod': 'ลองช่วงเวลา ตัวกรอง หรือคำอื่น',
  'activity.netFlow': 'สุทธิ',
  'activity.jumpToYear': 'ไปยังปี',
  'activity.clear': 'ล้าง',
  'activity.foundOneMatching': 'พบ 1 รายการที่ตรงกับ',
  'activity.foundNMatching': 'พบ {n} รายการที่ตรงกับ',
  'activity.showingOnly': 'แสดงเฉพาะ {category}',
  'activity.net': 'สุทธิ',
  'activity.spentOneTx': 'ใช้จ่าย {amount} · 1 รายการ',
  'activity.spentNTx': 'ใช้จ่าย {amount} · {n} รายการ',

  // Review
  'review.title': 'ตรวจสอบ',
  'review.subtitle': 'ยืนยันสลิป รายการที่เกิดซ้ำ และบันทึกย่อ',
  'review.add': 'เพิ่ม',
  'review.allCaughtUp': 'ตรวจครบแล้ว!',
  'review.allCaughtUpBody': 'สลิปธนาคารและรายการที่เกิดซ้ำได้รับการตรวจสอบทั้งหมดแล้ว',
  'review.backToOverview': 'กลับไปที่ภาพรวม',
  'review.whatWasThisFor': 'รายการนี้คืออะไร?',
  'review.oneAlreadyLogged': 'รายการที่บันทึกไว้แล้ว',
  'review.sameBankRefAs': 'เลขอ้างอิงธนาคารเดียวกับ',
  'review.iHeard': 'ได้ยินว่า',
  'review.looksLikeNewCharge': 'ดูเหมือนจะเป็นค่าใช้จ่ายรายเดือนใหม่',
  'review.needsCategory': 'ต้องระบุหมวดหมู่',
  'review.keepBoth': 'เก็บทั้งคู่',
  'review.discard': 'ลบทิ้ง',
  'review.edit': 'แก้ไข',
  'review.confirm': 'ยืนยัน',
  'review.once': 'ครั้งเดียว',
  'review.track': 'ติดตาม',
  'review.split': 'หารกัน',

  // Transaction detail
  'detail.transactions': 'รายการ',
  'detail.expense': 'รายจ่าย',
  'detail.income': 'รายรับ',
  'detail.transfer': 'โอนเงิน',
  'detail.needsReview': 'ต้องตรวจสอบ',
  'detail.verifiedFromSlip': 'ยืนยันจากสลิปแล้ว',
  'detail.readFromSlip': 'อ่านจากสลิป',
  'detail.fromVoiceNote': 'จากข้อความเสียง',
  'detail.typedInChat': 'พิมพ์ในแชท',
  'detail.addedByHand': 'เพิ่มด้วยตนเอง',
  'detail.transactionDetails': 'รายละเอียดรายการ',
  'detail.category': 'หมวดหมู่',
  'detail.payment': 'ช่องทางชำระเงิน',
  'detail.dateTime': 'วันและเวลา',
  'detail.account': 'บัญชี',
  'detail.note': 'บันทึกย่อ',
  'detail.addANote': 'เพิ่มบันทึกย่อ',
  'detail.split': 'หารกัน',
  'detail.owed': 'ที่ต้องได้รับคืน',
  'detail.repeats': 'เกิดซ้ำ',
  'detail.bankRef': 'เลขอ้างอิงธนาคาร',
  'detail.splitBill': 'หารบิล (หารกัน)',
  'detail.transferBetweenAccounts': 'โอนระหว่างบัญชีของฉัน',
  'detail.excludeFromStats': 'ไม่รวมในสถิติ',
  'detail.moreDetails': 'รายละเอียดเพิ่มเติม ▾',
  'detail.lessDetails': 'ย่อรายละเอียด ▴',
  'detail.sourceReceipt': 'ใบเสร็จต้นฉบับ',
  'detail.viewPhoto': 'ดูรูปภาพ →',
  'detail.viewSlip': 'ดูสลิป →',
  'detail.viewOriginalInLine': 'ดูต้นฉบับใน LINE →',
  'detail.source': 'แหล่งที่มา',
  'detail.editTransaction': 'แก้ไขรายการ',
  'detail.deleteTransaction': 'ลบรายการ',
  'detail.couldntLoadPhoto': 'โหลดรูปภาพต้นฉบับไม่สำเร็จ',
  'detail.voiceNote': 'ข้อความเสียง',
  'detail.alwaysFile': 'บันทึก',
  'detail.thisWay': 'แบบนี้เสมอ',
  'detail.eachPays': 'แต่ละคนจ่าย',
  'detail.youreOwed': 'ที่คุณจะได้รับคืน',
  'detail.saveSplit': 'บันทึกการหาร',
  'detail.fewerPeople': 'ลดจำนวนคน',
  'detail.morePeople': 'เพิ่มจำนวนคน',
};

const t = (lang: Lang, key: string, vars?: Record<string, string | number>): string => {
  let s = (lang === 'th' ? TH[key] : EN[key]) ?? EN[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
};

/** The Thai name for a category, or its English name outside Thai mode. */
export const categoryLabel = (lang: Lang, category: CategoryType): string => (lang === 'th' ? CATEGORY_TH[category] : category);

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  categoryLabel: (category: CategoryType) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => readPref() ?? 'en');
  useEffect(() => writePref(lang), [lang]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState(l => (l === 'en' ? 'th' : 'en')), []);
  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, toggleLang, t: (key, vars) => t(lang, key, vars), categoryLabel: category => categoryLabel(lang, category) }),
    [lang, setLang, toggleLang],
  );
  return React.createElement(LangContext.Provider, { value }, children);
};

/** Falls back to English-only (never throws) for any tree rendered outside a LangProvider. */
export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (ctx) return ctx;
  return { lang: 'en', setLang: () => {}, toggleLang: () => {}, t: key => t('en', key), categoryLabel: category => category };
}
