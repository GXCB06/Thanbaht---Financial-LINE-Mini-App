// Thanbaht Flex Message builders (LINE Messaging API), server version.
// Same output as chat/flex.js (checked by `npm run verify:server`), but the Mini App URL
// is a parameter so it can come from the environment.

import type { Category, LineMessage } from './types.ts';

// deno-lint-ignore no-explicit-any
type Json = any;

const C = {
  ink: '#171917', muted: '#6F746F', border: '#E3E7E2', surf2: '#F0F2EF',
  brand: '#06C755', brandStrong: '#00863C', income: '#15803D', expense: '#B94444',
  warn: '#9A5B00', warnSoft: '#FFF3DC', ai: '#4A63E0', aiSoft: '#EEF1FF', white: '#FFFFFF',
};

export type CatKey = 'food' | 'grocery' | 'transport' | 'shopping' | 'bills' | 'fun' | 'income' | 'unknown';

export const CATS: Record<CatKey, { en: string; emoji: string; color: string; soft: string }> = {
  food: { en: 'Food & Dining', emoji: '🍜', color: '#EB6834', soft: '#FCEAE3' },
  grocery: { en: 'Groceries', emoji: '🛒', color: '#EDA100', soft: '#FCF2DB' },
  transport: { en: 'Transport', emoji: '🚕', color: '#2A78D6', soft: '#E1ECF9' },
  shopping: { en: 'Shopping', emoji: '🛍️', color: '#E87BA4', soft: '#FCECF2' },
  bills: { en: 'Bills & Utilities', emoji: '💡', color: '#4A3AA7', soft: '#E6E3F3' },
  fun: { en: 'Entertainment', emoji: '🎬', color: '#1BAF7A', soft: '#DFF4EC' },
  income: { en: 'Income', emoji: '💰', color: '#15803D', soft: '#E6F9EE' },
  unknown: { en: 'Needs a category', emoji: '❓', color: '#9A5B00', soft: '#FFF3DC' },
};

const KEY_OF: Partial<Record<Category, CatKey>> = {
  'Food & Dining': 'food',
  Groceries: 'grocery',
  Transport: 'transport',
  Shopping: 'shopping',
  'Bills & Utilities': 'bills',
  Entertainment: 'fun',
  Income: 'income',
  Uncategorized: 'unknown',
};
export const catKey = (c: Category): CatKey => KEY_OF[c] ?? 'unknown';
export const CATEGORY_OF: Record<CatKey, Category> = {
  food: 'Food & Dining', grocery: 'Groceries', transport: 'Transport', shopping: 'Shopping',
  bills: 'Bills & Utilities', fun: 'Entertainment', income: 'Income', unknown: 'Uncategorized',
};

export const baht = (n: number) => '฿' + Math.round(Math.abs(n)).toLocaleString('en-US');

/* ---------- inputs ---------- */

export interface FlexTx {
  id: string;
  name: string;
  cat: CatKey;
  amt: number; // absolute
  bank: string;
  date: string; // "23 Sep"
  time: string; // "12:42"
  verified?: boolean;
  via?: 'slip' | 'voice' | 'text';
  kind?: 'expense' | 'income' | 'transfer';
}
export interface ReceiptCtx { todayTotal: number; todayN: number; catSpent: number; catBudget: number }
export interface IncomeCtx { monthIn: number; monthSpent: number }
export interface BatchData {
  slips: number;
  banks: number;
  /** Wording for the top line when the items did not come from slips, e.g. "4 EXPENSES · FROM YOUR MESSAGE". */
  eyebrow?: string;
  noun?: string;
  todayTotal: number;
  logged: FlexTx[];
  need: { name: string; amt: number; why: string }[];
}
export interface DuplicateOrig { date: string; time: string; ref: string }
export interface DigestData {
  dateLabel: string;
  monthLabel?: string;
  todayTotal: number;
  todayN: number;
  byBank: [string, number][];
  monthSpent: number;
  budget: number;
  perDay: number;
  daysLeft: number;
  hot?: string;
  waiting?: number;
}

/* ---------- primitives ---------- */

const T = (text: string | number, o: Json = {}): Json => ({ type: 'text', text: String(text), ...o });
const Box = (layout: string, contents: Json[], o: Json = {}): Json => ({ type: 'box', layout, contents, ...o });
const Sep = (o: Json = {}): Json => ({ type: 'separator', color: C.border, ...o });
const Btn = (label: string, action: Json, o: Json = {}): Json => ({ type: 'button', height: 'sm', action: { ...action, label }, ...o });
const pb = (data: string, displayText?: string): Json => ({ type: 'postback', data, ...(displayText ? { displayText } : {}) });

const tile = (cat: CatKey): Json =>
  Box('vertical', [T(CATS[cat].emoji, { align: 'center', size: 'lg' })],
    { width: '40px', height: '40px', cornerRadius: '12px', backgroundColor: CATS[cat].soft, justifyContent: 'center', flex: 0 });
const kv = (k: string, v: string, vo: Json = {}): Json =>
  Box('horizontal', [
    T(k, { size: 'sm', color: C.muted, flex: 0 }),
    T(v, { size: 'sm', color: C.ink, align: 'end', weight: 'bold', ...vo }),
  ], { spacing: 'md' });
const progress = (pct: number, color: string): Json =>
  Box('vertical', [
    Box('vertical', [], { width: `${Math.max(2, Math.min(100, Math.round(pct)))}%`, height: '6px', backgroundColor: color, cornerRadius: '3px' }),
  ], { height: '6px', backgroundColor: C.surf2, cornerRadius: '3px', margin: 'md' });
const chip = (text: string, fg: string, bg: string): Json =>
  Box('baseline', [T(text, { size: 'xxs', weight: 'bold', color: fg, flex: 0 })],
    { backgroundColor: bg, cornerRadius: '10px', paddingStart: '8px', paddingEnd: '8px', paddingTop: '2px', paddingBottom: '2px', flex: 0 });
const eyebrow = (text: string, color: string = C.muted): Json => T(text, { size: 'xxs', weight: 'bold', color });
const qr = (items: Json[]): Json => ({ items: items.map(action => ({ type: 'action', action })) });
/** How the record got here, shown under the amount. Only a checked QR earns "verified". */
const viaText = (tx: FlexTx) => (tx.verified ? ' · QR verified' : tx.via === 'voice' ? ' · from voice note' : tx.via === 'text' ? ' · typed in chat' : ' · read from slip');

/** Builders bound to one Mini App URL, e.g. https://miniapp.line.me/2000000000-abcdEFGH */
export function createFlex(appUrl: string) {
  const uri = (path: string): Json => ({ type: 'uri', uri: appUrl + path });

  /* 1. Single slip → "Logged" receipt */
  function receipt(tx: FlexTx, ctx: ReceiptCtx): LineMessage {
    const cat = CATS[tx.cat];
    const pct = (ctx.catSpent / ctx.catBudget) * 100;
    return {
      type: 'flex',
      altText: `Logged −${baht(tx.amt)} · ${tx.name} (${cat.en})`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('vertical', [
          Box('horizontal', [
            tile(tx.cat),
            Box('vertical', [
              T('Logged ✓', { size: 'sm', weight: 'bold', color: C.income }),
              T(`${cat.en} · ${tx.bank}`, { size: 'xs', color: C.muted }),
            ], { justifyContent: 'center' }),
          ], { spacing: 'md' }),
          T(`−${baht(tx.amt)}`, { size: 'xxl', weight: 'bold', color: C.ink, margin: 'lg' }),
          T(tx.name, { size: 'md', weight: 'bold', color: C.ink, wrap: true }),
          T(`${tx.date} · ${tx.time}${viaText(tx)}`, { size: 'xs', color: C.muted, wrap: true }),
          Sep({ margin: 'lg' }),
          Box('vertical', [
            kv('Today', `${baht(ctx.todayTotal)} · ${ctx.todayN} records`),
            kv(`${cat.emoji} This month`, `${baht(ctx.catSpent)} / ${baht(ctx.catBudget)}`, { color: pct >= 90 ? C.warn : C.ink }),
            progress(pct, cat.color),
          ], { spacing: 'sm', margin: 'lg' }),
        ], { paddingAll: '16px' }),
        footer: Box('horizontal', [
          Btn('Change', pb(`act=recat&tx=${tx.id}`, 'เปลี่ยนหมวด'), { style: 'secondary', color: C.surf2 }),
          Btn('Details', uri(`/tx/${tx.id}`), { style: 'primary', color: C.brandStrong }),
        ], { spacing: 'sm', paddingAll: '12px' }),
      },
    };
  }

  /* 1b. Money received → "Income logged" card */
  function income(tx: FlexTx, ctx: IncomeCtx): LineMessage {
    const kept = ctx.monthIn - ctx.monthSpent;
    return {
      type: 'flex',
      altText: `Income +${baht(tx.amt)} · ${tx.name}`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('vertical', [
          Box('horizontal', [
            tile('income'),
            Box('vertical', [
              T('Income logged ✓', { size: 'sm', weight: 'bold', color: C.income }),
              T(`Income · ${tx.bank}`, { size: 'xs', color: C.muted }),
            ], { justifyContent: 'center' }),
          ], { spacing: 'md' }),
          T(`+${baht(tx.amt)}`, { size: 'xxl', weight: 'bold', color: C.income, margin: 'lg' }),
          T(tx.name, { size: 'md', weight: 'bold', color: C.ink, wrap: true }),
          T(`${tx.date} · ${tx.time}${viaText(tx)}`, { size: 'xs', color: C.muted, wrap: true }),
          Sep({ margin: 'lg' }),
          Box('vertical', [
            kv('In this month', baht(ctx.monthIn)),
            kv('Kept so far', `${kept < 0 ? '−' : '+'}${baht(kept)}`, { color: kept >= 0 ? C.income : C.expense }),
          ], { spacing: 'sm', margin: 'lg' }),
        ], { paddingAll: '16px' }),
        footer: Box('horizontal', [
          Btn('Details', uri(`/tx/${tx.id}`), { style: 'primary', color: C.brandStrong }),
        ], { paddingAll: '12px' }),
      },
    };
  }

  /* 2. Batch of slips → summary carousel */
  function batch(b: BatchData): LineMessage {
    const needN = b.need.length;
    const summary: Json = {
      type: 'bubble', size: 'kilo',
      body: Box('vertical', [
        eyebrow(b.eyebrow ?? `${b.slips} SLIPS · ${b.banks} BANKS`),
        T(`Logged ${b.logged.length} of ${b.slips}`, { size: 'xl', weight: 'bold', color: C.ink, margin: 'sm' }),
        T(`${baht(b.logged.filter(t => (t.kind ?? 'expense') === 'expense').reduce((a, t) => a + t.amt, 0))} added · today now ${baht(b.todayTotal)}`, { size: 'xs', color: C.muted, wrap: true }),
        Sep({ margin: 'lg' }),
        Box('vertical', [
          ...b.logged.map(t => Box('horizontal', [
            T('✓', { size: 'sm', color: C.income, weight: 'bold', flex: 0 }),
            T(t.name, { size: 'sm', color: C.ink, flex: 5 }),
            T(`${t.kind === 'income' ? '+' : t.kind === 'transfer' ? '' : '−'}${baht(t.amt)}`, { size: 'sm', color: C.ink, align: 'end', flex: 3, weight: 'bold' }),
          ], { spacing: 'sm' })),
          ...b.need.map(t => Box('horizontal', [
            T('!', { size: 'sm', color: C.warn, weight: 'bold', flex: 0 }),
            T(`${t.name} · ${t.why}`, { size: 'sm', color: C.warn, flex: 5, wrap: true }),
            T(t.amt ? baht(t.amt) : '–', { size: 'sm', color: C.warn, align: 'end', flex: 3 }),
          ], { spacing: 'sm' })),
        ], { spacing: 'md', margin: 'lg' }),
      ], { paddingAll: '16px' }),
      footer: needN
        ? Box('vertical', [T(`${needN} need${needN > 1 ? '' : 's'} you, see below 👇`, { size: 'xs', color: C.muted, align: 'center' })], { paddingAll: '12px' })
        : undefined,
    };
    const card = (t: FlexTx): Json => ({
      type: 'bubble', size: 'micro',
      body: Box('vertical', [
        tile(t.cat),
        T(`−${baht(t.amt)}`, { size: 'lg', weight: 'bold', color: C.ink, margin: 'md' }),
        T(t.name, { size: 'xs', color: C.ink, wrap: true, maxLines: 2 }),
        T(`${t.bank} · ${t.time}`, { size: 'xxs', color: C.muted }),
      ], { paddingAll: '12px', action: uri(`/tx/${t.id}`) }),
    });
    return {
      type: 'flex',
      altText: `Logged ${b.logged.length} of ${b.slips} ${b.noun ?? 'slips'}${needN ? ` · ${needN} need you` : ''}`,
      // a carousel holds at most 12 bubbles: the summary plus up to 11 cards
      contents: { type: 'carousel', contents: [summary, ...b.logged.filter(t => (t.kind ?? 'expense') === 'expense').slice(0, 11).map(card)] },
    };
  }

  /* 3. Unknown payee → ask with quick replies */
  function askCategory(tx: FlexTx): LineMessage {
    const who = tx.name.replace('PromptPay · ', '');
    const keys: CatKey[] = ['food', 'grocery', 'transport', 'shopping', 'bills', 'fun'];
    return {
      type: 'flex',
      altText: `What was ${baht(tx.amt)} to ${who} for?`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('vertical', [
          Box('horizontal', [chip('WHO IS THIS?', C.warn, C.warnSoft)]),
          T(baht(tx.amt), { size: 'xxl', weight: 'bold', color: C.ink, margin: 'md' }),
          T(`PromptPay to ${who}`, { size: 'sm', color: C.ink, weight: 'bold', wrap: true }),
          T(`${tx.bank} · ${tx.date} ${tx.time}`, { size: 'xs', color: C.muted }),
          T('Pick a category below, and I\'ll remember it for this person next time.', { size: 'xs', color: C.muted, wrap: true, margin: 'lg' }),
        ], { paddingAll: '16px' }),
        footer: Box('horizontal', [
          Btn('🤝 Split / IOU', pb(`act=split&tx=${tx.id}`, 'หารกัน / ยืมเงิน'), { style: 'secondary', color: C.surf2 }),
        ], { paddingAll: '12px' }),
      },
      quickReply: qr(keys.map(k => ({
        type: 'postback', label: `${CATS[k].emoji} ${CATS[k].en}`.slice(0, 20),
        data: `act=cat&tx=${tx.id}&c=${k}&rule=1`, displayText: `${CATS[k].emoji} ${CATS[k].en}`,
      }))),
    };
  }

  /* 4. Duplicate slip (same bank ref) */
  function duplicate(orig: DuplicateOrig, dup: FlexTx): LineMessage {
    return {
      type: 'flex',
      altText: `Possible duplicate: ${dup.name} ${baht(dup.amt)}`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('vertical', [
          Box('horizontal', [chip('POSSIBLE DUPLICATE', C.warn, C.warnSoft)]),
          T(`${dup.name} ${baht(dup.amt)}`, { size: 'lg', weight: 'bold', color: C.ink, margin: 'md', wrap: true }),
          T('This slip has the same bank reference as one I already logged.', { size: 'xs', color: C.muted, wrap: true }),
          Box('vertical', [
            kv('Logged', `${orig.date} ${orig.time}`),
            kv('Bank ref', `…${String(orig.ref).slice(-5)}`),
          ], { backgroundColor: C.surf2, cornerRadius: '12px', paddingAll: '12px', spacing: 'sm', margin: 'lg' }),
        ], { paddingAll: '16px' }),
        footer: Box('horizontal', [
          Btn('Keep both', pb(`act=keep&tx=${dup.id}`, 'เก็บทั้งคู่'), { style: 'secondary', color: C.surf2 }),
          Btn('Discard', pb(`act=discard&tx=${dup.id}`, 'ลบรายการซ้ำ'), { style: 'primary', color: C.brandStrong }),
        ], { spacing: 'sm', paddingAll: '12px' }),
      },
    };
  }

  /* 5. Daily digest (the one scheduled push a day) */
  function digest(d: DigestData): LineMessage {
    const pct = (d.monthSpent / d.budget) * 100;
    return {
      type: 'flex',
      altText: `Today ${baht(d.todayTotal)} · ${d.todayN} records · ${baht(d.perDay)}/day left`,
      contents: {
        type: 'bubble', size: 'mega',
        header: Box('vertical', [
          eyebrow(d.dateLabel.toUpperCase(), C.muted),
          T(`${baht(d.todayTotal)} spent today`, { size: 'xl', weight: 'bold', color: C.ink }),
          T(`${d.todayN} records, all logged automatically`, { size: 'xs', color: C.muted }),
        ], { paddingAll: '16px', paddingBottom: '0px' }),
        body: Box('vertical', [
          ...d.byBank.map(([bank, amt]) => kv(bank, `−${baht(amt)}`, { weight: 'regular' })),
          Sep({ margin: 'lg' }),
          eyebrow(d.monthLabel ?? 'SEPTEMBER', C.muted),
          Box('horizontal', [
            T(baht(d.monthSpent), { size: 'lg', weight: 'bold', color: C.ink, flex: 0 }),
            T(`of ${baht(d.budget)}`, { size: 'sm', color: C.muted, gravity: 'bottom' }),
          ], { spacing: 'sm' }),
          progress(pct, C.ink),
          T(`You can spend ${baht(d.perDay)}/day for the next ${d.daysLeft} days.`, { size: 'sm', color: C.ink, wrap: true, margin: 'md' }),
          ...(d.hot ? [Box('horizontal', [
            T('⚠️', { size: 'sm', flex: 0 }),
            T(d.hot, { size: 'xs', color: C.warn, wrap: true }),
          ], { spacing: 'sm', backgroundColor: C.warnSoft, cornerRadius: '10px', paddingAll: '10px', margin: 'md' })] : []),
        ], { paddingAll: '16px', spacing: 'sm' }),
        footer: Box('vertical', [
          ...(d.waiting ? [Btn(`Review ${d.waiting} waiting`, uri('/review'), { style: 'primary', color: C.brandStrong })] : []),
          Btn('Open Thanbaht', uri('/'), { style: 'link', color: C.brandStrong }),
        ], { spacing: 'sm', paddingAll: '12px' }),
      },
    };
  }

  /* 6. "Ask Thanbaht" answer */
  function answer(a: { cat: CatKey; day: number; spent: number; budget: number; daysLeft: number; n: number; top: [string, number, number][] }): LineMessage {
    const cat = CATS[a.cat];
    return {
      type: 'flex',
      altText: `${cat.en} this month: ${baht(a.spent)}`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('vertical', [
          Box('horizontal', [tile(a.cat), Box('vertical', [
            eyebrow(`${cat.en.toUpperCase()} · SEP 1–${a.day}`),
            T(baht(a.spent), { size: 'xl', weight: 'bold', color: C.ink }),
          ], { justifyContent: 'center' })], { spacing: 'md' }),
          progress((a.spent / a.budget) * 100, cat.color),
          T(`${Math.round((a.spent / a.budget) * 100)}% of ${baht(a.budget)} · ${baht(a.budget - a.spent)} left for ${a.daysLeft} days · ${a.n} records`, { size: 'xs', color: C.muted, wrap: true, margin: 'sm' }),
          Sep({ margin: 'lg' }),
          eyebrow('WHERE IT WENT'),
          ...a.top.map(([name, amt, n]) => kv(`${name}${n > 1 ? ` ×${n}` : ''}`, baht(amt), { weight: 'regular' })),
        ], { paddingAll: '16px', spacing: 'sm' }),
        footer: Box('horizontal', [Btn(`See all ${a.n} records`, uri(`/tx?cat=${a.cat}`), { style: 'link', color: C.brandStrong })], { paddingAll: '8px' }),
      },
    };
  }

  /* 7. Evening nudge when nothing was logged */
  function nudge(n: { dateLabel: string; iso: string }): LineMessage {
    return {
      type: 'flex',
      altText: `Nothing logged today (${n.dateLabel}). Any slips?`,
      contents: {
        type: 'bubble', size: 'kilo',
        body: Box('horizontal', [
          Box('vertical', [T('👀', { size: 'xl', align: 'center' })], { width: '40px', height: '40px', cornerRadius: '12px', backgroundColor: C.aiSoft, justifyContent: 'center', flex: 0 }),
          Box('vertical', [
            T('Nothing logged today', { size: 'md', weight: 'bold', color: C.ink }),
            T(`${n.dateLabel}. Paid for anything? Send the slips, or tell me it was a no-spend day.`, { size: 'xs', color: C.muted, wrap: true }),
          ]),
        ], { spacing: 'md', paddingAll: '16px' }),
      },
      quickReply: qr([
        { type: 'cameraRoll', label: '📸 Send slips' },
        { type: 'postback', label: '🙅 Nothing today', data: `act=nospend&d=${n.iso}`, displayText: 'วันนี้ไม่ได้ใช้เงิน' },
        { type: 'postback', label: '⏰ Remind me 22:00', data: `act=snooze&d=${n.iso}`, displayText: 'เตือนอีกทีตอน 4 ทุ่ม' },
      ]),
    };
  }

  /* Reply to a rich-menu "Send slips" tap */
  function sendSlipsPrompt(): LineMessage {
    return {
      type: 'text',
      text: 'ส่งสลิปมาได้เลย เลือกหลายรูปพร้อมกันได้ 📸\nSend as many slips as you like, from any bank.',
      quickReply: qr([{ type: 'cameraRoll', label: '📸 Photos' }, { type: 'camera', label: '📷 Camera' }]),
    };
  }

  /* Rich menu (2500×1686, 3×2) */
  const richMenu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'thanbaht-main-v2',
    chatBarText: 'เมนู Thanbaht',
    areas: ([
      [0, 0, { type: 'postback', data: 'act=send_slips', displayText: '📸 ส่งสลิป' }],
      [1, 0, { type: 'postback', data: 'act=voice', inputOption: 'openVoice' }],
      [2, 0, { type: 'postback', data: 'act=type', inputOption: 'openKeyboard', fillInText: '' }],
      [0, 1, { type: 'postback', data: 'act=today', displayText: '📅 วันนี้' }],
      [1, 1, { type: 'uri', uri: appUrl + '/review' }],
      [2, 1, { type: 'uri', uri: appUrl + '/' }],
    ] as [number, number, Json][]).map(([cx, cy, action]) => ({
      bounds: { x: cx * 833, y: cy * 843, width: cx === 2 ? 834 : 833, height: 843 },
      action,
    })),
  };

  return { receipt, income, batch, askCategory, duplicate, digest, answer, nudge, sendSlipsPrompt, richMenu };
}

export type Flex = ReturnType<typeof createFlex>;
