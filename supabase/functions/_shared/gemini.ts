import type { AccountId, SlipReading } from './types.ts';
import { normalizeDateTime } from './clock.ts';

export type SlipReader = (bytes: Uint8Array, mime: string) => Promise<SlipReading>;
export type Transcriber = (bytes: Uint8Array, mime: string) => Promise<string>;

export class GeminiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/* ---------------- prompt + schema ---------------- */

const SLIP_PROMPT = `You read Thai bank transfer slips (e-slips) from apps such as K PLUS (KBank), SCB EASY, Krungthai NEXT, Bualuang mBanking (BBL), KMA (Krungsri), ttb touch, MyMo (GSB) and TrueMoney Wallet.
Return JSON only.
If the image is not a bank slip or payment confirmation, set isSlip to false and leave every other field null.
Rules:
- amount: a number in baht, no currency symbol and no commas.
- direction: "out" when the user paid or transferred money, "in" when the slip shows money received.
- senderName and receiverName: exactly as printed, keep Thai titles such as นาย, นาง, นางสาว.
- receiverAccount: the PromptPay number, biller ID or masked account printed for the receiver.
- ref: the transaction reference printed on the slip (รหัสอ้างอิง, เลขที่รายการ, Ref, Transaction ID).
- datetime: the transfer date and time in Asia/Bangkok, formatted YYYY-MM-DDTHH:mm in the Christian era. Thai slips print Buddhist Era years: subtract 543 (2569 becomes 2026, a two-digit "69" becomes 2026).
- bank: the app that produced the slip: kbank, scb, ktb, bbl, bay, ttb, gsb, tmn or other.
- memo: any note the sender typed, otherwise null.
- confidence: 0 to 1, how sure you are about the amount and the receiver.
Never guess. Use null for anything you cannot read.`;

const str = { type: 'STRING', nullable: true };
const SLIP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isSlip: { type: 'BOOLEAN' },
    bank: str,
    direction: { type: 'STRING' },
    amount: { type: 'NUMBER', nullable: true },
    senderName: str,
    senderAccount: str,
    receiverName: str,
    receiverAccount: str,
    ref: str,
    datetime: str,
    memo: str,
    confidence: { type: 'NUMBER' },
  },
  required: ['isSlip', 'direction', 'confidence'],
};

const TRANSCRIBE_PROMPT =
  'Transcribe this short voice note about money spent or received. It is usually Thai. Return only the transcript as plain text and keep numbers as digits, for example: ค่าแท็กซี่ 180';

/* ---------------- request building ---------------- */

export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000; // avoid call-stack limits on large images
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

const audioMime = (mime: string) => (/m4a|mp4|aac/i.test(mime) ? 'audio/mp4' : mime);

export function buildRequest(kind: 'slip' | 'audio', bytes: Uint8Array, mime: string) {
  const data = toBase64(bytes);
  return kind === 'slip'
    ? {
        contents: [{ role: 'user', parts: [{ text: SLIP_PROMPT }, { inline_data: { mime_type: mime, data } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SLIP_SCHEMA, temperature: 0 },
      }
    : {
        contents: [{ role: 'user', parts: [{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: audioMime(mime), data } }] }],
        generationConfig: { temperature: 0 },
      };
}

/* ---------------- parsing (the model's output is untrusted input) ---------------- */

const BANKS: [RegExp, AccountId][] = [
  [/k\s*plus|kbank|kasikorn|กสิกร/i, 'kbank'],
  [/scb|siam\s*commercial|ไทยพาณิชย์/i, 'scb'],
  [/krungthai|ktb|กรุงไทย/i, 'ktb'],
  [/bualuang|bbl|bangkok\s*bank|กรุงเทพ/i, 'bbl'],
  [/krungsri|kma|bay|กรุงศรี/i, 'bay'],
  [/ttb|tmb|thanachart|ทีทีบี/i, 'ttb'],
  [/gsb|mymo|ออมสิน/i, 'gsb'],
  [/true\s*money|tmn|ทรูมันนี่/i, 'tmn'],
];

function bankOf(v: unknown): AccountId | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  for (const [re, id] of BANKS) if (re.test(v)) return id;
  return 'other';
}

const text = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s && !/^(null|n\/a|none|unknown)$/i.test(s) ? s.slice(0, max) : null;
};

function amountOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[฿,\s]|บาท|thb/gi, '')) : NaN;
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n * 100) / 100 : null;
}

export function parseReading(raw: unknown): SlipReading {
  const empty: SlipReading = {
    isSlip: false, bank: null, direction: 'out', amount: null, senderName: null, senderAccount: null,
    receiverName: null, receiverAccount: null, ref: null, datetime: null, memo: null, confidence: 0,
  };
  let o: Record<string, unknown>;
  try {
    const s = typeof raw === 'string' ? raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '') : raw;
    o = (typeof s === 'string' ? JSON.parse(s) : s) as Record<string, unknown>;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return empty;
  } catch {
    return empty;
  }
  const amount = amountOf(o.amount);
  const dt = normalizeDateTime(typeof o.datetime === 'string' ? o.datetime : null);
  const ref = text(o.ref, 60)?.replace(/\s+/g, '') ?? null;
  const conf = typeof o.confidence === 'number' && Number.isFinite(o.confidence) ? Math.min(1, Math.max(0, o.confidence)) : 0.5;
  return {
    isSlip: o.isSlip === false ? false : amount !== null || o.isSlip === true,
    bank: bankOf(o.bank),
    direction: o.direction === 'in' ? 'in' : 'out',
    amount,
    senderName: text(o.senderName),
    senderAccount: text(o.senderAccount, 60),
    receiverName: text(o.receiverName),
    receiverAccount: text(o.receiverAccount, 60),
    // a very short "reference" is noise, and would make unrelated slips look like duplicates
    ref: ref && ref.length >= 6 ? ref : null,
    datetime: dt ? `${dt.date}T${dt.time}` : null,
    memo: text(o.memo),
    confidence: conf,
  };
}

/* ---------------- client ---------------- */

/**
 * Models to try, best first. Google retires model names ("no longer available to new users"),
 * so a 404 moves on to the next one. A GEMINI_MODEL secret, if set, is tried first.
 */
export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.8-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];

interface GeminiOptions {
  apiKey: string;
  /** Preferred model; falls back to DEFAULT_MODELS if Google says it is gone. */
  model?: string;
  fetchFn?: typeof fetch;
  /** Milliseconds to wait before the single retry on 429 / 5xx. */
  retryDelayMs?: number;
}

export class Gemini {
  private models: string[];
  /** Index of the model that last worked, so a retired one is not retried on every message. */
  private active = 0;
  private fetchFn: typeof fetch;
  private retryDelayMs: number;
  constructor(private opts: GeminiOptions) {
    this.models = [...new Set([opts.model, ...DEFAULT_MODELS].filter((m): m is string => !!m))];
    this.fetchFn = opts.fetchFn ?? fetch;
    this.retryDelayMs = opts.retryDelayMs ?? 800;
  }

  private async generate(body: unknown): Promise<string> {
    // A retired model (404) says nothing useful, so if every model fails, report the more telling error
    let telling: GeminiError | undefined;
    for (let i = this.active; i < this.models.length; i++) {
      try {
        const out = await this.generateWith(this.models[i], body);
        this.active = i;
        return out;
      } catch (e) {
        // 404 = model retired; 429/5xx = overloaded even after retries: try the next model
        if (!(e instanceof GeminiError) || !(e.status === 404 || e.status === 429 || (e.status ?? 0) >= 500)) throw e;
        if (e.status !== 404) telling ??= e;
      }
    }
    throw telling ?? new GeminiError('No Gemini model available', 404);
  }

  private async generateWith(model: string, body: unknown): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      // the key goes in a header, not the URL, so it never lands in request logs
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.opts.apiKey },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const out = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        if (!out) throw new GeminiError(`Gemini returned no text (${data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? 'unknown'})`);
        return out;
      }
      lastStatus = res.status;
      // a quota error (429) will not clear in a second, so it moves to the next model; only a busy server (5xx) is retried
      // "high demand" spikes usually pass within seconds: wait a little longer each time
      if (res.status >= 500 && attempt < 2) {
        await new Promise(r => setTimeout(r, this.retryDelayMs * (attempt + 1) * 2));
        continue;
      }
      throw new GeminiError(`Gemini ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`, res.status);
    }
    throw new GeminiError('Gemini failed', lastStatus);
  }

  readSlip: SlipReader = async (bytes, mime) => parseReading(await this.generate(buildRequest('slip', bytes, mime)));

  transcribe: Transcriber = async (bytes, mime) => (await this.generate(buildRequest('audio', bytes, mime))).trim();
}
