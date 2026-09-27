// Supabase Edge Function: the evening nudge. Called once a day by a pg_cron job (see the
// matching migration), never directly by a user — a shared secret in the Authorization header
// is the only thing that authorizes a call.
//
// Deploy with JWT verification off (the caller is pg_cron/pg_net, not a Supabase user):
//   supabase functions deploy daily-digest --no-verify-jwt
//
// Secrets: DIGEST_CRON_SECRET (any long random string — put the same value in Vault as
// `digest_cron_secret`, see the migration), LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { runDailyDigest } from '../_shared/scheduled.ts';
import { HttpLineClient } from '../_shared/line.ts';
import { SupabaseStore } from '../_shared/supabase_store.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void };

const secret = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret ${name}. Set it with: supabase secrets set ${name}=...`);
  return v;
};

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (req.headers.get('authorization') !== `Bearer ${secret('DIGEST_CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const db = createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const outcomes = await runDailyDigest({
      store: new SupabaseStore(db),
      line: new HttpLineClient(secret('LINE_CHANNEL_ACCESS_TOKEN')),
      appUrl: `https://miniapp.line.me/${secret('LIFF_ID')}`,
      log: (message, detail) => console.error(message, detail ?? ''),
    });
    const sent = outcomes.filter(o => o.sent).length;
    console.log(`daily digest: nudged ${sent} of ${outcomes.length} users`);
    return new Response(JSON.stringify({ ok: true, sent, total: outcomes.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('daily digest error', String(e));
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
