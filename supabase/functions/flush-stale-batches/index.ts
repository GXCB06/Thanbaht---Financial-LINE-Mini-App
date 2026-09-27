// Supabase Edge Function: rescues batches of slips that got stuck short of their expected
// count (one image's webhook event was lost — a crash, a timeout, a redelivery LINE gave up
// on). Called every minute by a pg_cron job (see the matching migration), never directly by a
// user — a shared secret in the Authorization header is the only thing that authorizes a call.
//
// Deploy with JWT verification off (the caller is pg_cron/pg_net, not a Supabase user):
//   supabase functions deploy flush-stale-batches --no-verify-jwt
//
// Secrets: FLUSH_BATCHES_CRON_SECRET (any long random string — put the same value in Vault as
// `flush_batches_cron_secret`, see the migration), LINE_CHANNEL_ACCESS_TOKEN, LIFF_ID.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { flushStaleBatches } from '../_shared/handler.ts';
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
  if (req.headers.get('authorization') !== `Bearer ${secret('FLUSH_BATCHES_CRON_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const db = createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const flushed = await flushStaleBatches({
      store: new SupabaseStore(db),
      line: new HttpLineClient(secret('LINE_CHANNEL_ACCESS_TOKEN')),
      appUrl: `https://miniapp.line.me/${secret('LIFF_ID')}`,
      channelSecret: '', // unused off the webhook path
      readSlip: async () => {
        throw new Error('not used by the sweep');
      },
      transcribe: async () => {
        throw new Error('not used by the sweep');
      },
      log: (message, detail) => console.error(message, detail ?? ''),
    });
    if (flushed.length) console.log(`flushed ${flushed.length} stale batch(es)`, flushed);
    return new Response(JSON.stringify({ ok: true, flushed: flushed.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('flush-stale-batches error', String(e));
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
