# Thanbaht backend (Supabase)

Receives what users send to the LINE Official Account (slips, voice notes, text), records it, and replies with Flex cards.

```
LINE chat ──webhook──▶ Edge Function line-webhook ──▶ Postgres (transactions, slips, rules)
   ▲                        │  └─▶ Storage (private "slips" bucket)
   └──── Flex reply ◀───────┘  └─▶ Gemini (reads slips, transcribes voice)

LINE Mini App ──ID token──▶ Edge Function app-api ──▶ the same Postgres (loads and saves the user's records)
```

## Layout

| Path | What |
|---|---|
| `migrations/…_init.sql` | Tables, duplicate-slip index, row-level security, private `slips` bucket |
| `functions/line-webhook/index.ts` | The Edge Function (Deno): wires the real services into the handler |
| `functions/_shared/handler.ts` | The webhook logic: signature, slips, batches, buttons, text, voice |
| `functions/_shared/flex.ts` | Flex card builders (same output as `chat/flex.js`) |
| `functions/_shared/logic.ts`, `gemini.ts`, `line.ts`, `parse.ts`, `names.ts` | Slip → transaction rules, Gemini and LINE API clients, parsers |
| `functions/_shared/supabase_store.ts` | Database access (service role) |
| `functions/_shared/memory_store.ts` | In-memory database for tests only |

Run the tests with `npm run verify:server`. They use a fake LINE, Gemini and database, so no keys are needed.

## Current deployment

| | |
|---|---|
| Supabase project | **Thanabaht** (`frpofsiqqzzqerulnpfc`, ap-southeast-1) |
| Webhook URL | `https://frpofsiqqzzqerulnpfc.supabase.co/functions/v1/line-webhook` |
| Database | Schema applied (migrations `20260926071928_thanbaht_init`, `20260927000000_daily_digest_cron`), 6 tables with row-level security, private `slips` bucket |
| Functions | `line-webhook` (the bot), `app-api` (the Mini App) and `daily-digest` (the evening nudge), all deployed with JWT verification off: LINE signs the first, the second checks a LINE ID token, and the third checks a shared secret from pg_cron |

The function answers `500 Server error` until the secrets below are set; that is expected. To finish: add the secrets (Dashboard → Edge Functions → Secrets, or step 3 below), then do step 5.

## Deploy (from scratch, or for a new project)

You need the Supabase CLI and a Supabase project. Run these yourself: they use your account and secrets.

1. Log in and link the project:
   ```bash
   supabase login
   ```
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
2. Create the tables and the private bucket:
   ```bash
   supabase db push
   ```
3. Store the secrets. Copy `functions/.env.example` to `functions/.env` (git-ignored), fill it in, then:
   ```bash
   supabase secrets set --env-file supabase/functions/.env
   ```
4. Deploy. JWT checking must stay off for all three functions — LINE authenticates the first with its own signature, the app sends its own LINE ID token, and pg_cron sends the shared `DIGEST_CRON_SECRET`:
   ```bash
   supabase functions deploy line-webhook --no-verify-jwt
   supabase functions deploy app-api --no-verify-jwt
   supabase functions deploy daily-digest --no-verify-jwt
   ```
5. In the LINE Developers Console → your Messaging API channel:
   - Webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook`
   - Turn **Use webhook** on and press **Verify** (it should say Success).
   - In LINE Official Account Manager, turn **auto-reply** and **greeting messages** off.
6. Send a slip to the OA. Check Edge Functions → Logs in the Supabase dashboard if nothing comes back.
7. Turn on the evening nudge (once, after `daily-digest` is deployed and its secrets are set). In the SQL editor:
   ```sql
   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-digest', 'digest_url');
   select vault.create_secret('THE_SAME_VALUE_AS_DIGEST_CRON_SECRET', 'digest_cron_secret');
   ```
   The cron job itself (`daily-digest-evening`, 20:00 Bangkok daily) is created by the migration in step 2 — these two secrets are the only thing it's waiting on. To test it right away instead of waiting for the schedule:
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-digest \
     -H "Authorization: Bearer THE_SAME_VALUE_AS_DIGEST_CRON_SECRET"
   ```

## Secrets

| Name | From |
|---|---|
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console → Messaging API channel |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login / Mini App channel → Basic settings → Channel ID (the number at the start of the LIFF ID). Used by `app-api` to check the Mini App user's ID token |
| `LIFF_ID` | LINE Mini App channel (same value as `VITE_LIFF_ID` in the app) |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` (optional) | Tried first; otherwise `gemini-3.8-flash`, then fallbacks (see `DEFAULT_MODELS` in `gemini.ts`) |
| `DIGEST_CRON_SECRET` | Any long random string you generate (e.g. `openssl rand -hex 32`). Also stored in Vault as `digest_cron_secret` — see step 7 above |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically. Never put the service-role key, the channel secret or the access token in the app's `.env`: anything starting with `VITE_` is shipped to every user's browser.

## How it behaves

- **One slip:** saved, read, and answered with a receipt card. Unknown payees are put in Review and the bot asks with category buttons. "Always file this person" is remembered.
- **Several slips at once:** LINE marks them as one image set, and the user gets one summary card for all of them (plus cards for anything that needs them).
- **Duplicates:** the same bank reference twice becomes a "possible duplicate", even if both arrive at the same instant. The database enforces it.
- **"Verified":** shown only when a verifier confirms the slip's QR or reference. No verifier is wired in yet, so cards say "read from slip".
- **Own-account transfers** (sender and receiver are the same person) are recorded as Transfer and never counted as spending.
- Only 1:1 chats are handled. Group and room messages are ignored.
- **The evening nudge:** once a day (20:00 Bangkok, `daily-digest-evening` in pg_cron), everyone who hasn't logged anything yet today, or who has something waiting in Review, gets the same digest card the "today" chat command shows (today's spend, month pace, a "hot category" warning, the Review count). Anyone already caught up for the day is skipped — it's a nudge, not a routine broadcast.

## The Mini App and its data

- Inside LINE (or after LINE Login in a browser, or with `?live`) the app runs in **live mode**: it logs in with LIFF, loads the user's records from `app-api`, and saves edits back a moment after each change (including Undo). Elsewhere it shows the demo data.
- The LIFF app needs the **openid** scope enabled (LINE Developers Console), or LINE gives no ID token.
- The OA channel and the Mini App channel must be in the **same Provider**, or the two see different user ids and the app will look empty.
- `app-api` lets the app change only a fixed list of fields (`cleanPatch` in `_shared/api.ts`). It can never set `verified`, the bank reference, the slip or the image.
- `app-api` also has an `image` action: given a transaction id it owns, it returns a 5-minute signed URL for that record's stored slip photo (`getSignedImageUrl` in `api_store.ts`), which the detail screen fetches on demand rather than shipping the storage path itself.
- Try it without LINE: `npm run dev:api`, then `VITE_API_URL=http://localhost:8788 npm run dev` and open `/?live&devtoken=dev`.

## Not built yet

- Slip **verification** through a provider, so cards can say "Verified".
- In the Mini App: subscriptions from real recurring records, and choosing your own account names (`owner_names`) for own-transfer detection. Only the current month is shown.
- The **rich menu** upload (needs the 2500×1686 image).
- Cleaning up old `webhook_events` rows.
- A CSV/monthly export from the Mini App.
- Sharing one budget between more than one person (`owner_names` only affects transfer detection today, not a shared ledger).
