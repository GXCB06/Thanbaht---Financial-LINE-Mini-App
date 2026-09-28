// Runs the real Mini App API handler on your machine with sample data, no LINE or Supabase needed.
//   Terminal 1:  npm run dev:api
//   Terminal 2:  VITE_API_URL=http://localhost:8788 npm run dev
//   Then open:   http://localhost:3000/?live&devtoken=dev      (add &empty for a brand-new user)
import { createServer } from 'node:http';
import { handleApi, type ApiStore, type SubscriptionRecord } from '../supabase/functions/_shared/api.ts';
import { MemoryStore } from '../supabase/functions/_shared/memory_store.ts';
import { parseReading } from '../supabase/functions/_shared/gemini.ts';
import type { Category, NewTx, Profile, TxRow } from '../supabase/functions/_shared/types.ts';

const today = new Date();
const iso = (daysAgo: number) => {
  const d = new Date(today.getTime() - daysAgo * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const base = (o: Partial<TxRow>): TxRow => ({
  id: uuid(), user_id: 'U-dev', title: '', category: 'Food & Dining', amount: -1, date: iso(0), time: '09:00', account: 'cash', source: 'text', status: 'ok',
  review_kind: null, review_dup_of: null, said: null, note: null, trans_ref: null, verified: false, slip: null, image_path: null, excluded: false,
  split_n: null, prev_category: null, allow_dup: false, created_at: new Date().toISOString(), ...o,
});
const slip = (name: string, amount: number, ref: string) => ({ bankName: 'KBank', slipType: 'KBank · e-Slip', status: 'โอนเงินสำเร็จ', amount, senderName: 'นาย ธัญญ์พิสิษฐ์ โ.', senderAccount: 'xxx-x-x8941-x', recipientName: name, recipientPromptPay: 'xxx-xxx-4122', refNo: ref, dateTimeStr: '26/09/69 09:30' });

const seed = (): TxRow[] => [
  base({ title: 'กาแฟ', amount: -65, said: 'กาแฟ 65', time: '08:10' }),
  base({ title: 'ข้าวมันไก่', amount: -60, source: 'voice', said: 'ข้าวมันไก่ 60 บาท', time: '12:05' }),
  base({ title: 'Roots Coffee', amount: -140, account: 'kbank', source: 'slip', time: '09:30', trans_ref: 'KB1', slip: slip('Roots Coffee', 140, 'KB1') }),
  base({ title: 'ค่าน้ำ', category: 'Bills & Utilities', amount: -157, date: iso(1), time: '19:00' }),
  base({ title: 'แท็กซี่', category: 'Transport', amount: -180, date: iso(1), time: '22:15', source: 'voice', said: 'แท็กซี่ 180' }),
  base({ title: 'ได้ค่าจ้าง', category: 'Income', amount: 5000, date: iso(2), time: '10:00', account: 'scb' }),
  base({ title: 'xyzzy', category: 'Uncategorized', amount: -50, status: 'review', review_kind: 'who', time: '13:00' }),
  base({ title: 'ซื้อของ', category: 'Shopping', amount: -890, date: iso(3), time: '16:40', account: 'kbank', source: 'slip', trans_ref: 'KB2', slip: slip('Central', 890, 'KB2') }),
];

// One list of records shared by the app's API and the slip/voice reader, as in the real database
const mem = new MemoryStore();
if (!process.argv.includes('--empty')) mem.txs.push(...seed());

class DevStore implements ApiStore {
  txs = mem.txs;
  profile: Profile = { line_user_id: 'U-dev', display_name: 'Dev User', owner_names: [], monthly_budget: 22000 };
  rules: Record<string, Category> = {};
  async ensureProfile() { return this.profile; }
  async loadTxs() { return this.txs.filter(t => t.status !== 'deleted'); }
  async getTx(_u: string, id: string) { return this.txs.find(t => t.id === id) ?? null; }
  async updateTx(_u: string, id: string, patch: Partial<NewTx>) { const t = this.txs.find(x => x.id === id); if (!t) return false; Object.assign(t, patch); return true; }
  async insertTx(r: NewTx & { id: string }) { if (this.txs.some(t => t.id === r.id)) return false; this.txs.unshift({ ...r, user_id: 'U-dev', created_at: new Date().toISOString() }); return true; }
  async getRules() { return this.rules; }
  async setRule(_u: string, k: string, c: Category) { this.rules[k] = c; }
  async setBudget(_u: string, b: number) { this.profile.monthly_budget = b; }
  subscriptions: SubscriptionRecord[] = [];
  async getSubscriptions() { return this.subscriptions; }
  async setSubscriptions(_u: string, subs: SubscriptionRecord[]) { this.subscriptions = subs; }
  async getSignedImageUrl(_u: string, id: string) {
    const t = this.txs.find(x => x.id === id);
    const img = t?.image_path ? mem.images.get(t.image_path) : undefined;
    return img ? `data:${img.mime};base64,${Buffer.from(img.bytes).toString('base64')}` : null;
  }
}

const store = new DevStore();

// A pretend Gemini so the flows can be tried without spending real requests
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const SAMPLE_SLIPS = [
  { bank: 'kbank', amount: 312, receiverName: 'Gourmet Market', ref: 'KB-DEV-000001' },
  { bank: 'tmn', amount: 88, receiverName: 'Bolt', ref: 'TM-DEV-000002' },
  { bank: 'ktb', amount: 386, receiverName: "Lotus's Rama 4", ref: 'KT-DEV-000003' },
];
let slipN = 0;
const capture = {
  store: mem,
  readSlip: async () => {
    await pause(900);
    const pick = SAMPLE_SLIPS[slipN++ % SAMPLE_SLIPS.length];
    return parseReading(JSON.stringify({ isSlip: true, direction: 'out', senderName: 'นาย ธัญญ์พิสิษฐ์ โ.', datetime: null, confidence: 0.9, ...pick }));
  },
  transcribe: async () => {
    await pause(1200);
    return 'ค่าแท็กซี่ 180 บาท ข้าว 60 บาท';
  },
};
const deps = { store, capture, verifyIdToken: async (t: string) => (t === 'dev' ? { sub: 'U-dev', name: 'Dev User' } : null), log: (m: string, d?: unknown) => console.error(m, d ?? '') };

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const r = await handleApi(new Request(`http://localhost:8788${req.url}`, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), deps);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
  if (req.method === 'POST') console.log(new Date().toLocaleTimeString(), 'served', r.status, `(${store.txs.length} records)`);
}).listen(8788, () => console.log(`Dev API on http://localhost:8788 with ${store.txs.length} sample records`));
