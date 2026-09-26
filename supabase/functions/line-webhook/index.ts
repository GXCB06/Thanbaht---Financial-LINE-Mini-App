// Supabase Edge Function: the LINE Official Account webhook.
//
// Deploy with JWT verification OFF: LINE does not send a Supabase token. Requests are
// authenticated by their X-Line-Signature instead (see _shared/handler.ts).
//
//   supabase functions deploy line-webhook --no-verify-jwt
//
// Secrets (supabase secrets set ...):
//   LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID, GEMINI_API_KEY, [GEMINI_MODEL]
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { type Deps, handleWebhook } from '../_shared/handler.ts';
import { HttpLineClient } from '../_shared/line.ts';
import { Gemini } from '../_shared/gemini.ts';
import { SupabaseStore } from '../_shared/supabase_store.ts';
import { lazyStore } from '../_shared/lazy_store.ts';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };
declare const EdgeRuntime: { waitUntil(work: Promise<unknown>): void } | undefined;

const secret = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}. Set it with: supabase secrets set ${name}=...`);
  return v;
};

// Loading the Supabase client is what makes a cold start slow (about 2 s), and LINE times out
// on a slow webhook. So it is imported on first use, in the background, after LINE has been answered.
const store = lazyStore(async () => {
  const { createClient } = await import('npm:@supabase/supabase-js@2');
  return new SupabaseStore(createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } }));
});

// Gemini is only needed for slips and voice notes, so a missing key must not break the
// LINE "Verify" button or text messages.
let gemini: Gemini | undefined;
const getGemini = () => (gemini ??= new Gemini({ apiKey: secret('GEMINI_API_KEY'), model: Deno.env.get('GEMINI_MODEL') }));

let deps: Deps | undefined;
function build(): Deps {
  return {
    channelSecret: secret('LINE_CHANNEL_SECRET'),
    appUrl: `https://miniapp.line.me/${secret('LIFF_ID')}`,
    line: new HttpLineClient(secret('LINE_CHANNEL_ACCESS_TOKEN')),
    store,
    readSlip: async (bytes, mime) => getGemini().readSlip(bytes, mime),
    transcribe: async (bytes, mime) => getGemini().transcribe(bytes, mime),
    // Answer LINE immediately; the image download and model call finish in the background
    defer: work => (typeof EdgeRuntime !== 'undefined' ? EdgeRuntime.waitUntil(work) : void work),
    log: (message, detail) => console.error(message, detail ?? ''),
  };
}

Deno.serve(async req => {
  try {
    deps ??= build();
    return await handleWebhook(req, deps);
  } catch (e) {
    console.error('webhook error', String(e));
    return new Response('Server error', { status: 500 });
  }
});
