---
name: testing-resoul
description: Test the RESOUL Next.js app end-to-end — auth-gated dashboard pages, PWA service worker + manifest, lead form, and Telegram webhook secret guard. Use when verifying any change to /dashboard/*, /api/case-study/*, /api/lead, the manifest/SW config, or i18n copy for the Cabinet.
---

# Testing the RESOUL app

## Stack snapshot
- Next.js 14 (App Router) + TypeScript + Tailwind + next-intl, pnpm workspace.
- Postgres via Neon serverless driver (`@neondatabase/serverless`).
- Stateless cookie auth: `resoul_session = <b64url(payload)>.<b64url(HMAC-SHA256(payload, AUTH_COOKIE_SECRET))>` where `payload = { uid, exp }`. No DB session table — the signature is trusted.
- next-pwa 5.6.0 wraps `next.config.mjs` and generates `public/sw.js` at build time. The PWA is **disabled when NODE_ENV=development**, so PWA testing must run against a prod build.

## What the env usually does NOT have
- `DATABASE_URL` (the app degrades to stub mode: all reads return null/empty).
- `AUTH_COOKIE_SECRET` (without it, `getSession()` always returns null and every `/dashboard/*` route redirects to `/login`).
- Neon credentials, R2, Telegram bot tokens.

Decide up front which scenario the test needs:
- **Public pages / lead form / manifest / SW artefacts**: no setup, just build + start.
- **Auth-gated dashboard pages without real DB**: set a local `AUTH_COOKIE_SECRET` and forge a cookie (see below). DB-backed branches will degrade to no-access fallbacks, which is enough to prove rendering + i18n + access-gate behaviour.
- **Full happy paths (real enrollments, case-study submission, certificate approval, R2 video URLs, TG bot)**: requires real credentials; not doable without the user provisioning them.

## Standard local setup
```bash
cd /home/ubuntu/repos/sitemum
fuser -k 3015/tcp 2>/dev/null            # kill any stale process on the port
AUTH_COOKIE_SECRET="test-cookie-secret-for-local-only-1234" \
  NODE_ENV=production PORT=3015 \
  nohup pnpm start > /tmp/start.log 2>&1 &
sleep 4 && tail -8 /tmp/start.log
```
If the production bundle is stale, run `pnpm build` first. Use port 3015 to avoid clashing with the default 3000 that other dev servers grab.

### Forging a session cookie
```bash
node -e '
const { createHmac } = require("crypto");
const secret = "test-cookie-secret-for-local-only-1234";
const payload = { uid: "00000000-0000-0000-0000-000000000001", exp: Math.floor(Date.now()/1000) + 3600 };
const json = JSON.stringify(payload);
const b64 = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const body = b64(json);
const sig = b64(createHmac("sha256", secret).update(body).digest());
console.log(body + "." + sig);
' > /tmp/cookie.txt
COOKIE=$(cat /tmp/cookie.txt)
curl -sS -b "resoul_session=$COOKIE" http://localhost:3015/uk/dashboard
```
In the browser, set the cookie via DevTools Console with `document.cookie='resoul_session=...; path=/'` — even though the server sets the cookie httpOnly, the cookie spec allows a same-name JS cookie to coexist and be sent to the server.

## Quick smoke (probes everything from the shell)
```bash
for p in /uk /manifest.webmanifest /sw.js /uk/dashboard /uk/dashboard/roadmap /uk/dashboard/level-1/case-study; do
  printf "%-45s " "$p"
  curl -sS -o /dev/null -w "HTTP %{http_code}  redirect: %{redirect_url}\n" "http://localhost:3015$p"
done
```
Expected without session cookie: all three `/uk/dashboard*` paths return **307** to `/uk/login`; the rest return **200**.

## Verifying the SW build artefact
```bash
curl -sS http://localhost:3015/sw.js | \
  grep -oE "resoul-(lesson-media|fonts|pages|images)|google-fonts-(webfonts|stylesheets)" | sort -u
```
Should list all six cache buckets (`resoul-lesson-media`, `resoul-fonts`, `resoul-pages`, `resoul-images`, `google-fonts-webfonts`, `google-fonts-stylesheets`).

### Known gotcha — next-pwa 5.6 + App Router
`next-pwa@5.6.0` with `register: true` injects its registration script via the legacy `pages/_document`. Because this project uses the App Router only, the register script is **never** emitted into the HTML, so `/sw.js` does not auto-register in the browser even though the file exists. Symptoms:
- DevTools → Application → Service Workers is empty after a hard reload.
- `grep -o serviceWorker http://localhost:3015/uk` returns nothing in the HTML.

Workaround when testing locally: open DevTools console and run `navigator.serviceWorker.register('/sw.js')`. Note that workbox may also throw `bad-precaching-response` on `/_next/app-build-manifest.json` (404 from `next start`) — that path needs to be added to `buildExcludes` in `next.config.mjs` for the SW to actually install. Real fix is a small client component that calls `register('/sw.js')` from inside `src/app/[locale]/layout.tsx`.

## Case-study + L2 cert gate (PR #12 area)
- Page: `/uk/dashboard/level-1/case-study` (and the same under `/ru/...`).
- Without L2 access, the page shows an eyebrow `Сертифікація Level 2`, h1 `Твій кейс`, a no-access body and a `До програми` CTA pointing to `/uk/platform`. The form/textarea must NOT render.
- With L2 access, the form renders with a live char counter (200..20000) and posts to `POST /api/case-study/submit` (edge runtime, zod-validated, idempotent upsert into `cases`).
- Admin approval is manual SQL for now: `UPDATE cases SET approved=true, approved_at=now() WHERE user_id='<uid>';`. There is no admin UI yet.
- `/uk/dashboard` shows a `TileCertificate` plaque ONLY for users with L2 access; the plaque CTA links to the case-study page.

## Roadmap (PR #10 area)
- Page: `/uk/dashboard/roadmap`. Renders three milestones L0/L1/L2 in horizontal timeline with states `locked / active / done`.
- Without DB, all three render as `Закритий`. This is the correct "no data" rendering, not a bug.

## i18n contract
- All copy lives in `messages/uk.json` and `messages/ru.json`. If a test sees a raw key like `dashboard.caseStudy.noAccess.body` rendered in the DOM, the i18n entry is missing — that's a real bug, not a fallback.

## Devin secrets needed (for full E2E)
Not used in stub-mode testing, but required for full happy paths:
- `DATABASE_URL` — Neon Postgres connection string.
- `AUTH_COOKIE_SECRET` — HMAC secret (≥16 chars). For local stub testing any string works.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — required for the lead-funnel + bot webhook flow.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — required for `/api/lessons/*/sign` presigned URLs.
