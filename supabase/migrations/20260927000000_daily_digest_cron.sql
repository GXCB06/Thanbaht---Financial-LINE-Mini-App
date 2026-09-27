-- The evening nudge: once a day, pg_cron asks the daily-digest Edge Function to push a digest
-- card to anyone who hasn't logged anything yet today (or has something waiting in Review).
--
-- The Edge Function's URL and its shared secret differ per project and must never be committed
-- to git, so they are not hardcoded here. After deploying the function, set them once with:
--
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-digest', 'digest_url');
--   select vault.create_secret('THE_SAME_VALUE_AS_THE_DIGEST_CRON_SECRET_SECRET', 'digest_cron_secret');
--
-- (Run those two statements once in the SQL editor, or via `supabase secrets set` +
-- a one-off `psql` command — whichever is easier. The job below reads them at run time, so it
-- is safe to apply this migration before those secrets exist: it will just have nothing to
-- call until they are set, the same way the functions answer 500 until their secrets are set.)

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'daily-digest-evening',
  '0 13 * * *', -- 13:00 UTC = 20:00 Bangkok, every day
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'digest_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
