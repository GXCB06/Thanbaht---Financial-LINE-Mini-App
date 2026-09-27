// Sample messages for Wed 23 Sep 2026. The numbers match prototype/index.html.
import { receipt, income, batch, askCategory, duplicate, digest, answer, nudge, sendSlipsPrompt } from './flex.js';

const grab = { id: 't46', name: 'Grab', amt: 120, bank: 'KBank', date: '23 Sep', time: '10:15', ref: '015266101544417' };

export const MESSAGES = {
  receipt: receipt(
    { id: 't47', name: 'ร้านอาหารข้าวต้มปลา XYZ', cat: 'food', amt: 450, bank: 'KBank', date: '23 Sep', time: '12:42', verified: true },
    { todayTotal: 710, todayN: 3, catSpent: 5964, catBudget: 6500 },
  ),
  income: income(
    { id: 't52', name: 'Freelance design work', cat: 'income', amt: 5000, bank: 'SCB', date: '22 Sep', time: '18:30', via: 'text' },
    { monthIn: 32400, monthSpent: 16508 },
  ),
  batch: batch({
    slips: 4, banks: 3, todayTotal: 1341,
    logged: [
      { id: 't48', name: "Lotus's Rama 4", cat: 'grocery', amt: 386, bank: 'Krungthai', time: '18:20' },
      { id: 't49', name: 'After You', cat: 'food', amt: 245, bank: 'SCB', time: '19:40' },
    ],
    need: [
      { name: 'ส. ใจดี', amt: 300, why: 'category?' },
      { name: 'Grab', amt: 120, why: 'duplicate?' },
    ],
  }),
  askCategory: askCategory({ id: 't50', name: 'PromptPay · นางสาว ส. ใจดี', amt: 300, bank: 'SCB', date: '23 Sep', time: '19:05' }),
  duplicate: duplicate(grab, { ...grab, id: 't51' }),
  digest: digest({
    dateLabel: 'Wed 23 Sep', todayTotal: 1341, todayN: 5,
    byBank: [['KBank', 710], ['Krungthai', 386], ['SCB', 245]],
    monthSpent: 16508, budget: 22000, perDay: 785, daysLeft: 7,
    hot: 'Food & Dining is at 96% of its ฿6,500 budget with 7 days to go.',
    waiting: 3,
  }),
  answer: answer({
    cat: 'food', day: 23, spent: 6209, budget: 6500, daysLeft: 7, n: 23,
    top: [['ร้านอาหารข้าวต้มปลา XYZ', 1320, 3], ['Somboon Seafood', 1120, 1], ['Roots Coffee', 700, 5]],
  }),
  nudge: nudge({ dateLabel: 'Sat 19 Sep', iso: '2026-09-19' }),
  sendSlipsPrompt: sendSlipsPrompt(),
};

// Conversation shown in chat/index.html
export const THREAD = [
  { day: 'Sat 19 Sep' },
  { from: 'bot', time: '21:00', msg: 'nudge', note: 'Push · only sent when nothing was logged that day' },
  { day: 'Today · Wed 23 Sep' },
  { from: 'user', time: '12:42', slips: [['K PLUS', '#138F2D', '฿450.00']] },
  { from: 'bot', time: '12:42', msg: 'receipt', note: 'Reply (free) · about 3s after the slip arrives' },
  { from: 'user', time: '18:31', text: 'ได้ค่าจ้าง 5000' },
  { from: 'bot', time: '18:31', msg: 'income', note: 'Typed income gets a card too, not just a text line' },
  { from: 'user', time: '20:31', slips: [['Krungthai', '#1BA5E1', '฿386.00'], ['SCB', '#4E2A84', '฿245.00'], ['SCB', '#4E2A84', '฿300.00'], ['K PLUS', '#138F2D', '฿120.00']] },
  { from: 'bot', time: '20:31', msg: 'batch', note: 'One reply for the whole batch, not four' },
  { from: 'bot', time: '20:31', msg: 'askCategory' },
  { from: 'bot', time: '20:31', msg: 'duplicate' },
  { from: 'user', time: '20:45', text: 'เดือนนี้ค่ากินเท่าไหร่' },
  { from: 'bot', time: '20:45', msg: 'answer', note: 'Ask Thanbaht · the question is parsed, and the numbers come from the database' },
  { from: 'bot', time: '21:30', msg: 'digest', note: 'Push · the single scheduled message of the day' },
];
