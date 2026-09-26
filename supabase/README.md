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
| Database | Schema applied (migration `20260926071928_thanbaht_init`), 6 tables with row-level security, private `slips` bucket |
| Functions | `line-webhook` (the bot) and `app-api` (the Mini App), both deployed with JWT verification off: LINE signs the first, and the second checks a LINE ID token |

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
4. Deploy. JWT checking must stay off, because LINE authenticates with its own signature, which the function verifies:
   ```bash
   supabase functions deploy line-webhook --no-verify-jwt
   ```
5. In the LINE Developers Console → your Messaging API channel:
   - Webhook URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/line-webhook`
   - Turn **Use webhook** on and press **Verify** (it should say Success).
   - In LINE Official Account Manager, turn **auto-reply** and **greeting messages** off.
6. Send a slip to the OA. Check Edge Functions → Logs in the Supabase dashboard if nothing comes back.

## Secrets

| Name | From |
|---|---|
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console → Messaging API channel |
| `LINE_LOGIN_CHANNEL_ID` | LINE Login / Mini App channel → Basic settings → Channel ID (the number at the start of the LIFF ID). Used by `app-api` to check the Mini App user's ID token |
| `LIFF_ID` | LINE Mini App channel (same value as `VITE_LIFF_ID` in the app) |
| `GEMINI_API_KEY` | Google AI Studio |
| `GEMINI_MODEL` (optional) | Tried first; otherwise `gemini-3.8-flash`, then fallbacks (see `DEFAULT_MODELS` in `gemini.ts`) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge Functions automatically. Never put the service-role key, the channel secret or the access token in the app's `.env`: anything starting with `VITE_` is shipped to every user's browser.

## How it behaves

- **One slip:** saved, read, and answered with a receipt card. Unknown payees are put in Review and the bot asks with category buttons. "Always file this person" is remembered.
- **Several slips at once:** LINE marks them as one image set, and the user gets one summary card for all of them (plus cards for anything that needs them).
- **Duplicates:** the same bank reference twice becomes a "possible duplicate", even if both arrive at the same instant. The database enforces it.
- **"Verified":** shown only when a verifier confirms the slip's QR or reference. No verifier is wired in yet, so cards say "read from slip".
- **Own-account transfers** (sender and receiver are the same person) are recorded as Transfer and never counted as spending.
- Only 1:1 chats are handled. Group and room messages are ignored.

## The Mini App and its data

- Inside LINE (or after LINE Login in a browser, or with `?live`) the app runs in **live mode**: it logs in with LIFF, loads the user's records from `app-api`, and saves edits back a moment after each change (including Undo). Elsewhere it shows the demo data.
- The LIFF app needs the **openid** scope enabled (LINE Developers Console), or LINE gives no ID token.
- The OA channel and the Mini App channel must be in the **same Provider**, or the two see different user ids and the app will look empty.
- `app-api` lets the app change only a fixed list of fields (`cleanPatch` in `_shared/api.ts`). It can never set `verified`, the bank reference, the slip or the image.
- Try it without LINE: `npm run dev:api`, then `VITE_API_URL=http://localhost:8788 npm run dev` and open `/?live&devtoken=dev`.

## Not built yet

- Slip **verification** through a provider, so cards can say "Verified".
- In the Mini App: the slip **image** on the detail screen, subscriptions from real recurring records, and choosing your own account names (`owner_names`) for own-transfer detection. Only the current month is shown.
- **Daily digest / evening nudge** (needs a scheduled function), and the **rich menu** upload (needs the 2500×1686 image).
- Cleaning up old `webhook_events` rows.
