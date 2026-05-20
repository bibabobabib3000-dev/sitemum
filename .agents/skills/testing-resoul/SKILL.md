---
name: testing-resoul
description: Test the RESOUL Next.js app end-to-end — lead form, /api/lead stub vs DB modes, Telegram webhook secret guard, and the t.me deep-link CTA. Use when verifying lead-capture or Telegram-related changes.
---

# Testing the RESOUL app

This skill covers smoke-testing the RESOUL Next.js app locally without
requiring a live Neon DB or a real Telegram bot. The app degrades to safe
stub paths when those are missing, which makes it convenient to test the
UI + edge logic in isolation.

## Tech stack quick facts

- Next.js 14 App Router, React 18, `next-intl` locale routing (`/uk`, `/ru`).
- API routes run on edge runtime — no Node-only deps.
- Package manager: pnpm.
- DB: Neon serverless (`@neondatabase/serverless`). Optional in dev — when
  `DATABASE_URL` is unset, `/api/lead` returns `{stored:false, userId:null, mode:"stub"}`.
- Telegram: plain `fetch` against `https://api.telegram.org/bot<token>/...`.
  When `TELEGRAM_BOT_TOKEN` is missing/invalid, calls return `ok:false` and
  are logged but never throw — lead capture is unaffected.

## Quick start (local dev)

From repo root:

```bash
pnpm install
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=resoul_test_bot \
TELEGRAM_BOT_TOKEN=fake-token-for-testing-not-real \
PORT=3000 pnpm dev
```

Then open `http://localhost:3000/uk` or `/ru`.

Lint + build (no CI configured in this repo as of PR #3):

```bash
pnpm lint
pnpm build
```

## How features are reachable from the UI

- Landing pages: `/uk`, `/ru`. The CTA "Зайти в Immersion Week" jumps to the
  in-page form (`#form`).
- Lead form: `src/components/sections/lead-form.tsx`. On success the form is
  replaced **in place** by a success card — there is no redirect.
- Standalone thank-you page: `/uk/event/thank-you` and `/ru/event/thank-you`,
  reachable directly. Accepts an optional `?u=<uuid>` to seed the deep link.
- The Telegram CTA on both success card and thank-you is **only rendered**
  when `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is non-empty. If it is empty the
  button is intentionally hidden.

## Telegram webhook secret guard

`POST /api/telegram/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against
`TELEGRAM_WEBHOOK_SECRET`:

- If env unset → all requests pass (dev convenience).
- If env set → bad/missing header returns `403 forbidden`.
- If env set and header matches → `200 {"ok":true}`.

When you set the secret, restart the dev server (env is read at boot).

`GET /api/telegram/webhook` is a no-auth liveness probe that returns
`{"ok":true,"service":"telegram-webhook"}`.

## Adversarial shell checks (copy-paste)

```bash
# Liveness
curl -sS http://localhost:3000/api/telegram/webhook

# /start payload — links lead to chat_id (stub mode: no DB row, logs in console)
curl -sS -X POST http://localhost:3000/api/telegram/webhook \
  -H 'Content-Type: application/json' \
  -d '{"update_id":1,"message":{"message_id":1,"date":1,"chat":{"id":42,"type":"private"},"from":{"id":42,"is_bot":false,"first_name":"T","language_code":"uk"},"text":"/start lead_11111111-2222-3333-4444-555555555555"}}'

# Lead API stub mode
curl -sS -X POST http://localhost:3000/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"name":"Adv","email":"adv@example.com","telegram":"@adv_test","productSlug":"level-0","locale":"uk"}'
# → {"ok":true,"data":{"stored":false,"userId":null,"mode":"stub"}}

# Lead API validation regression — empty name, bad email, invalid telegram
curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"name":"","email":"not-an-email","telegram":"@x"}'
# → 422
```

To verify the secret guard, restart dev with `TELEGRAM_WEBHOOK_SECRET=secret123` and:

```bash
# Bad header → 403
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  http://localhost:3000/api/telegram/webhook \
  -H 'X-Telegram-Bot-Api-Secret-Token: WRONG' \
  -H 'Content-Type: application/json' \
  -d '{"update_id":1,"message":{"message_id":1,"date":1,"chat":{"id":42,"type":"private"},"from":{"id":42,"is_bot":false,"first_name":"T"},"text":"/start"}}'
# → 403

# Good header → 200
curl -sS -X POST http://localhost:3000/api/telegram/webhook \
  -H 'X-Telegram-Bot-Api-Secret-Token: secret123' \
  -H 'Content-Type: application/json' \
  -d '{"update_id":1,"message":{"message_id":1,"date":1,"chat":{"id":42,"type":"private"},"from":{"id":42,"is_bot":false,"first_name":"T"},"text":"/start"}}'
# → {"ok":true}
```

## Browser flow to verify the deep-link CTA

1. Open `http://localhost:3000/uk`, scroll to form (`#form`).
2. Fill in name, email, `@username`-style telegram, click `Продовжити`.
3. Inline success card should appear with the Telegram-bot button.
4. Inspect the button's `href`:
   - Stub mode (no `DATABASE_URL`) → `https://t.me/<bot>` (userId is null).
   - DB mode → `https://t.me/<bot>?start=lead_<uuid>`.
5. Also open `/uk/event/thank-you?u=<uuid>` — href should always include
   `?start=lead_<uuid>` when `?u=` is present.
6. Switch to `/ru/event/thank-you` (no `?u=`) — heading should be `Спасибо!`,
   CTA `Открыть Telegram-бота`, link has no `?start=` segment.

## Gotchas / things that might be broken in future

- **Bot identity**: a token from `@BotFather` is *not* tied to your project name.
  When testing live, always run `getMe` first and confirm the bot's `username`
  matches what you put in `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. During PR #3
  testing, the supplied token resolved to `@BNBCasino_bot` — clearly not the
  intended RESOUL bot. If a similar mismatch surfaces, the workaround is to
  create a fresh bot via `@BotFather` and update env vars.
- **Webhook secret behavior is asymmetric**: an unset secret means the route
  is open. Don't deploy without setting it; tests should explicitly verify
  both modes.
- **Edge runtime**: any Node-only library imported into `src/app/api/**`
  will break the build. If you need to add a TG SDK, prefer plain `fetch`.
- **next-intl + Edge cache warning**: `pnpm dev` and `pnpm build` may print
  `[webpack.cache.PackFileCacheStrategy] Parsing of .../next-intl/.../format/index.js for build dependencies failed at 'import(t)'`.
  This is a known next-intl cache hint, not a build failure — ignore.
- **No CI yet**: as of PR #3 the repo has no GitHub Actions. Don't wait for
  `git_pr_checks` indefinitely; `wait_mode="none"` returns immediately.

## DB-mode testing (when a Neon URL is available)

If you have a `DATABASE_URL`:

```bash
psql "$DATABASE_URL" -f migrations/0001_init.sql
psql "$DATABASE_URL" -f migrations/0002_tg_users.sql
```

Then restart dev with `DATABASE_URL` exported. `/api/lead` will switch to
`mode:"db"` and return a real `userId`. The Telegram webhook will upsert
`tg_users` and link `users.tg_id`.

Useful inspection queries:

```sql
select id, name, email, tg_username, tg_id from users order by created_at desc limit 5;
select tg_chat_id, tg_username, user_id, start_payload from tg_users order by updated_at desc limit 5;
```

## Devin secrets needed

- `TELEGRAM_BOT_TOKEN` — only needed for live Telegram tests. For local
  smoke-testing use a bogus value to exercise graceful-degradation paths.
- `TELEGRAM_WEBHOOK_SECRET` — needed only when testing the secret-guarded
  path; not required for plain UI testing.
- `DATABASE_URL` (Neon) — needed only when testing the DB-write path of
  `/api/lead` and the webhook upserts. Stub mode does not require it.
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — not a real secret, but the deep-link
  CTA is hidden when empty, so set it (e.g. `resoul_test_bot`) for UI tests.
