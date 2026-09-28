// Supabase Edge Function: the API the Mini App talks to.
//
// Deploy with JWT verification OFF: callers are not Supabase users. They are identified by the
// LINE ID token the Mini App sends (see _shared/api.ts).
//
// Secrets: LINE_LOGIN_CHANNEL_ID (the channel id at the start of the Mini App's LIFF ID — a
// comma-separated list if more than one LIFF environment, e.g. Developing and Published, must
// both work, since each is a different channel), GEMINI_API_KEY [GEMINI_MODEL].
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { type ApiDeps, handleApi, lineIdTokenVerifier } from '../_shared/api.ts';
import { SupabaseApiStore } from '../_shared/api_store.ts';
import { SupabaseStore } from '../_shared/supabase_store.ts';
import { Gemini } from '../_shared/gemini.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

const secret = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}. Set it in the Supabase dashboard: Edge Functions, Secrets.`);
  return v;
};

// Only slips and voice notes need Gemini, so a missing key must not break loading the app
let gemini: Gemini | undefined;
const getGemini = () => (gemini ??= new Gemini({ apiKey: secret('GEMINI_API_KEY'), model: Deno.env.get('GEMINI_MODEL') }));

let deps: ApiDeps | undefined;
function build(): ApiDeps {
  const db = createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  return {
    store: new SupabaseApiStore(db),
    // the same reading and storing code as the LINE bot
    capture: {
      store: new SupabaseStore(db),
      readSlip: (bytes, mime) => getGemini().readSlip(bytes, mime),
      transcribe: (bytes, mime) => getGemini().transcribe(bytes, mime),
    },
    verifyIdToken: lineIdTokenVerifier(secret('LINE_LOGIN_CHANNEL_ID')),
    log: (message, detail) => console.error(message, detail ?? ''),
  };
}

Deno.serve(async req => {
  try {
    deps ??= build();
    return await handleApi(req, deps);
  } catch (e) {
    console.error('api error', String(e));
    return new Response(JSON.stringify({ error: 'server_error' }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
