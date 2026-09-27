-- Thanbaht: schema for the LINE bot + Mini App.
--
-- Identity: every row belongs to a LINE userId (text). The webhook writes with the
-- service role (bypasses RLS). The Mini App reads with a per-user JWT whose `sub`
-- claim is that LINE userId (login function comes next), so the policies below
-- only ever expose a user's own rows.

create table public.profiles (
  line_user_id   text primary key,
  display_name   text,
  -- Names printed on the user's own slips. Used to spot transfers between own accounts.
  owner_names    text[]  not null default '{}',
  monthly_budget integer not null default 22000 check (monthly_budget > 0),
  created_at     timestamptz not null default now()
);

create table public.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references public.profiles (line_user_id) on delete cascade,
  title          text not null,
  category       text not null check (category in (
                   'Food & Dining', 'Groceries', 'Transport', 'Shopping',
                   'Bills & Utilities', 'Entertainment', 'Income', 'Transfer', 'Uncategorized')),
  -- Signed: expenses are negative, income positive.
  amount         numeric(12, 2) not null check (amount <> 0),
  date           date not null,
  time           text not null check (time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  account        text not null default 'cash' check (account in (
                   'kbank', 'scb', 'ktb', 'bbl', 'bay', 'ttb', 'gsb', 'tmn', 'cash', 'other')),
  source         text not null check (source in ('slip', 'voice', 'text', 'manual')),
  status         text not null default 'ok' check (status in ('ok', 'review', 'deleted')),
  review_kind    text check (review_kind in ('who', 'dup', 'amount', 'recurring')),
  review_dup_of  uuid references public.transactions (id) on delete set null,
  said           text,
  note           text,
  -- Bank reference printed on the slip. Basis for duplicate detection.
  trans_ref      text,
  -- True only when the slip's QR / reference was checked with a verification service.
  verified       boolean not null default false,
  slip           jsonb,
  image_path     text,
  excluded       boolean not null default false,
  split_n        integer check (split_n >= 2),
  prev_category  text,
  -- The user looked at a possible duplicate and chose "Keep both".
  allow_dup      boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint review_has_kind check ((status = 'review') = (review_kind is not null))
);

-- One live record per bank reference. The database enforces this, so two copies of the
-- same slip processed at the same instant cannot both become "ok". A possible duplicate
-- is stored as a review row (review_kind = 'dup'), which the index deliberately skips.
create unique index transactions_ref_unique
  on public.transactions (user_id, trans_ref)
  where trans_ref is not null
    and status <> 'deleted'
    and not allow_dup
    and review_kind is distinct from 'dup';

create index transactions_user_date on public.transactions (user_id, date desc, time desc);
create index transactions_user_review on public.transactions (user_id) where status = 'review';

-- Every image the user sends, including ones that could not be read, so a batch of
-- slips knows when the last one has been processed.
create table public.slips (
  message_id     text primary key,
  user_id        text not null references public.profiles (line_user_id) on delete cascade,
  -- LINE groups images sent together into an "image set".
  set_id         text,
  set_index      integer,
  set_total      integer,
  image_path     text,
  status         text not null check (status in ('ok', 'review', 'failed')),
  transaction_id uuid references public.transactions (id) on delete set null,
  error          text,
  created_at     timestamptz not null default now()
);
create index slips_set on public.slips (user_id, set_id) where set_id is not null;

-- Exactly one reply per image set: whoever inserts this row first sends the summary.
create table public.batch_replies (
  user_id    text not null,
  set_id     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, set_id)
);

-- "Always file this payee as ..." rules created from chat buttons or the app.
create table public.payee_rules (
  user_id    text not null references public.profiles (line_user_id) on delete cascade,
  payee_key  text not null,
  category   text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, payee_key)
);

-- LINE redelivers webhooks that were not acknowledged; this makes handling idempotent.
create table public.webhook_events (
  event_id   text primary key,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.transactions   enable row level security;
alter table public.slips          enable row level security;
alter table public.batch_replies  enable row level security;
alter table public.payee_rules    enable row level security;
alter table public.webhook_events enable row level security;

-- The service role used by the webhook bypasses RLS. Signed-in Mini App users get
-- their own rows only. Tables with no policy (slips internals, batch_replies,
-- webhook_events) stay closed to clients.
create policy profiles_own on public.profiles
  for all to authenticated
  using (line_user_id = (select auth.jwt() ->> 'sub'))
  with check (line_user_id = (select auth.jwt() ->> 'sub'));

create policy transactions_own on public.transactions
  for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

create policy payee_rules_own on public.payee_rules
  for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for slip images, one folder per LINE user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('slips', 'slips', false)
on conflict (id) do nothing;

create policy slips_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'slips' and (storage.foldername(name))[1] = (select auth.jwt() ->> 'sub'));
