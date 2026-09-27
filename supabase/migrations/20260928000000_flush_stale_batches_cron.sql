-- Batch rescue: pg_cron asks the flush-stale-batches Edge Function, once a minute, to send the
-- summary for any set of slips that got stuck short of its expected count (one image's webhook
-- event was lost — a crash, a timeout, a redelivery LINE gave up on). Without this, that whole
-- batch's reply would never arrive: nobody is ever "the last one" to complete the set.
--
-- The Edge Function's URL and its shared secret differ per project and must never be committed
-- to git, so they are not hardcoded here. After deploying the function, set them once with:
--
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/flush-stale-batches', 'flush_batches_url');
--   select vault.create_secret('THE_SAME_VALUE_AS_THE_FLUSH_BATCHES_CRON_SECRET', 'flush_batches_cron_secret');
--
-- (Run those two statements once in the SQL editor, or via `supabase secrets set` +
-- a one-off `psql` command — whichever is easier. This migration is safe to apply before those
-- secrets exist: the job will just have nothing to call until they are set.)

-- The sweep scans recent slips/batch_replies by created_at to find stuck sets.
create index if not exists slips_created_at on public.slips (created_at) where set_id is not null;
create index if not exists batch_replies_created_at on public.batch_replies (created_at);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'flush-stale-batches',
  '* * * * *', -- every minute
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'flush_batches_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'flush_batches_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
