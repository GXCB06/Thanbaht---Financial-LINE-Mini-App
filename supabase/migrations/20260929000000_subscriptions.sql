-- The subscriptions a person tracks in the Mini App (Netflix, rent...), kept as one list per profile.
-- The app-api function reads and replaces the whole list; RLS on profiles already keeps it private.
alter table public.profiles
  add column if not exists subscriptions jsonb not null default '[]'::jsonb;
