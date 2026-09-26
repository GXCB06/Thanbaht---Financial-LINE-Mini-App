import type { LineMessage } from './types.ts';

/* ---------------- webhook signature ---------------- */

const enc = new TextEncoder();

// (return type left to inference: an explicit `Uint8Array` is too wide for crypto.subtle)
function fromBase64(b64: string) {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * LINE signs the raw request body with HMAC-SHA256 using the channel secret and sends the
 * base64 result in X-Line-Signature. `crypto.subtle.verify` compares in constant time.
 * Always pass the raw text of the body, never JSON.stringify(parsedBody).
 */
export async function verifySignature(channelSecret: string, rawBody: string, signature: string | null | undefined): Promise<boolean> {
  if (!channelSecret || !signature) return false;
  const sig = fromBase64(signature);
  if (!sig) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(channelSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(rawBody));
}

/* ---------------- Messaging API client ---------------- */

export class LineApiError extends Error {
  constructor(public status: number, public body: string, public endpoint: string) {
    super(`LINE ${endpoint} failed with ${status}: ${body.slice(0, 300)}`);
  }
}

/** The calls the bot makes. Faked in tests. */
export interface LineClient {
  reply(replyToken: string, messages: LineMessage[]): Promise<void>;
  push(to: string, messages: LineMessage[], retryKey?: string): Promise<void>;
  getContent(messageId: string): Promise<{ bytes: Uint8Array; mime: string }>;
  showLoading(userId: string, seconds?: number): Promise<void>;
}

export class HttpLineClient implements LineClient {
  constructor(private accessToken: string, private fetchFn: typeof fetch = fetch) {}

  private async call(endpoint: string, url: string, init: RequestInit): Promise<Response> {
    const res = await this.fetchFn(url, { ...init, headers: { Authorization: `Bearer ${this.accessToken}`, ...(init.headers ?? {}) } });
    if (!res.ok) throw new LineApiError(res.status, await res.text().catch(() => ''), endpoint);
    return res;
  }

  private json(endpoint: string, url: string, body: unknown, headers: Record<string, string> = {}) {
    return this.call(endpoint, url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  }

  async reply(replyToken: string, messages: LineMessage[]) {
    // A reply may carry at most 5 message objects
    await this.json('reply', 'https://api.line.me/v2/bot/message/reply', { replyToken, messages: messages.slice(0, 5) });
  }

  async push(to: string, messages: LineMessage[], retryKey?: string) {
    // The retry key makes a retried push idempotent: LINE will not deliver it twice
    await this.json('push', 'https://api.line.me/v2/bot/message/push', { to, messages: messages.slice(0, 5) }, retryKey ? { 'X-Line-Retry-Key': retryKey } : {});
  }

  async getContent(messageId: string) {
    const res = await this.call('content', `https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, { method: 'GET' });
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream' };
  }

  /** The "typing" dots in a 1:1 chat. Cosmetic, so failures are swallowed. */
  async showLoading(userId: string, seconds = 20) {
    try {
      await this.json('loading', 'https://api.line.me/v2/bot/chat/loading/start', { chatId: userId, loadingSeconds: seconds });
    } catch {
      /* not worth failing a slip over */
    }
  }
}

/** Random UUID for X-Line-Retry-Key. */
export const newRetryKey = () => crypto.randomUUID();
