# RESOUL

Цифрова інфраструктура методології **RESOUL METHOD v1.0**: лендінги (Level 0 / Level 1), закритий освітній кабінет (LMS), Telegram-бот прогріву та інтеграції з Zoom і платіжними системами.

Перший етап (цей PR): scaffold + статичний лендінг **Level 0 — Immersion Week** з підтримкою двох мов (UA / RU).

## Стек

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + кастомна дизайн-система на CSS variables
- **next-intl** для UA/RU локалізації (маршрути `/uk`, `/ru`)
- **shadcn-style** атомарні UI-примітиви (`Button`, `Container`, …)
- **lucide-react** для іконок
- Шрифти: **Inter** (текст) + **Instrument Serif** (display) через `next/font/google`

- **Neon** (Postgres, serverless driver `@neondatabase/serverless`) — БД для заявок
- **Zod** — runtime-валідація payload'ів API

Майбутні етапи (планується):
- Cloudflare R2 + signed URLs для відео
- Resend для транзакційного email
- WayForPay + MonoPay як платіжні провайдери (Stripe не використовуємо)
- Telegraf для Telegram-бота, хостимо як Next.js API route
- Zoom API для авто-реєстрації + reminders

Детальний план — у `RESOUL_PLAN.md`.

## База даних

Використовуємо **Neon** (Postgres) через `@neondatabase/serverless`. Підключення — одна змінна `DATABASE_URL` (з Neon-консолі, формат `postgresql://user:pass@host/db?sslmode=require`).

Міграції — звичайний SQL у `migrations/`. Запустити вручну:

```bash
psql "$DATABASE_URL" -f migrations/0001_init.sql
```

Якщо `DATABASE_URL` не задано, `/api/lead` працює у **stub-режимі**: парсить + валідує payload, логує його в stdout і повертає `{ stored: false, mode: "stub" }`. Це дозволяє розробляти UI без піднятого Neon-проєкту.

## API

| Route | Method | Що робить |
|---|---|---|
| `/api/lead` | POST | Приймає `{ name, email, telegram, productSlug?, locale?, referer?, utm? }`, валідує через Zod, апсертить `users` (по email) і вставляє `leads`. У stub-режимі — тільки логує. |

Інші роути (платежі, вебхуки, бот) — будуть додані наступними PR'ами.

## Старт локально

```bash
pnpm install
pnpm dev
```

Відкрити: <http://localhost:3000> (автоматично редіректить на `/uk`).

## Скрипти

- `pnpm dev` — dev-сервер
- `pnpm build` — production-білд
- `pnpm start` — запуск production-білда
- `pnpm lint` — ESLint (`next lint`)

## Структура

```
src/
├── app/
│   ├── layout.tsx              # root layout
│   ├── globals.css             # глобальні стилі + design tokens
│   └── [locale]/
│       ├── layout.tsx          # locale layout + i18n provider + html/body + fonts
│       ├── page.tsx            # лендінг Level 0
│       └── event/thank-you/    # post-submit сторінка подяки
├── app/api/
│   └── lead/route.ts           # POST /api/lead (Zod + Neon, graceful stub)
├── components/
│   ├── language-switcher.tsx
│   ├── sections/               # секції лендінгу
│   │   ├── nav.tsx
│   │   ├── hero.tsx
│   │   ├── problem-promise.tsx
│   │   ├── method.tsx
│   │   ├── program.tsx
│   │   ├── author.tsx
│   │   ├── faq.tsx
│   │   ├── lead-form.tsx
│   │   └── footer.tsx
│   └── ui/                     # атомарні примітиви
│       ├── button.tsx
│       └── container.tsx
├── i18n/
│   ├── routing.ts              # locales + defaultLocale
│   ├── request.ts              # getRequestConfig
│   └── navigation.ts           # locale-aware Link/router
├── lib/
│   ├── utils.ts                # cn()
│   ├── api-response.ts         # jsonOk / jsonErr helpers
│   ├── db/index.ts             # Neon client (graceful when DATABASE_URL unset)
│   ├── telegram/
│   │   ├── client.ts           # Bot API wrapper (sendMessage / setWebhook / …)
│   │   ├── notify.ts           # best-effort DM lead + admin notification
│   │   └── types.ts            # minimal Bot API types
│   └── validation/schemas.ts   # Zod schemas (leadInputSchema)
└── middleware.ts               # next-intl middleware
messages/
├── uk.json
└── ru.json
migrations/
├── 0001_init.sql               # users + leads tables
└── 0002_tg_users.sql           # Telegram chat ↔ user mapping
scripts/
└── telegram-set-webhook.mjs    # one-off webhook setup CLI
```

## Дизайн-система

CSS-variables у `globals.css` визначають:

- `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--accent`, `--border`

Default — темна тема (`#0a0a0a` / `#f5f5f4`). Cabinet (LMS) у майбутньому отримає окрему світлу варіацію.

## i18n

- Маршрути локалізовані: `/uk/*` та `/ru/*`
- Default locale: `uk`
- `next-intl` middleware редіректить з `/` на `/uk`

## Telegram bot (PR #3)

Webhook-driven, без SDK — Bot API викликається через `fetch`, щоб працювати
на Vercel Edge runtime. Основні файли:

- `src/lib/telegram/client.ts` — обгортка навколо Bot API (sendMessage, getMe, setWebhook, deleteWebhook, getWebhookInfo).
- `src/lib/telegram/notify.ts` — best-effort DM ліду + опціональна admin-нотифікація. При помилці TG лід усе одно зберігається.
- `src/app/api/telegram/webhook/route.ts` — вхідний вебхук. Валідує `X-Telegram-Bot-Api-Secret-Token`, реєструє `chat_id` у `tg_users` і лінкує до `users` за deep-link payload (`/start lead_<userId>`) або за `@username`.
- `migrations/0002_tg_users.sql` — схема для Neon.
- `scripts/telegram-set-webhook.mjs` — одноразовий CLI для setWebhook / getWebhookInfo / deleteWebhook.

### Сетап після деплою

```bash
# 1. У env-провайдера (Vercel / .env) виставити:
#    TELEGRAM_BOT_TOKEN=...                      # від @BotFather
#    TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
#    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot  # без @
#    TELEGRAM_ADMIN_CHAT_ID=...                  # опціонально

# 2. Прив'язати вебхук (виконується один раз на деплой):
node scripts/telegram-set-webhook.mjs https://example.com/api/telegram/webhook

# Перевірити статус:
node scripts/telegram-set-webhook.mjs --info

# 3. Застосувати міграцію (SQL editor у Neon або psql):
psql "$DATABASE_URL" -f migrations/0002_tg_users.sql
```

### Потік

1. Клієнт заповнює форму на лендінгу → `/api/lead` зберігає `users` + `leads` у Neon.
2. Форма у success-стані показує CTA «Відкрити Telegram-бот» з deep-лінком `https://t.me/<bot>?start=lead_<userId>`.
3. Користувач відкриває бота і натискає Start → Telegram б'є наш webhook з `/start lead_<userId>`.
4. Webhook реєструє рядок у `tg_users`, лінкує до `users.id` і вітає ліда відповідною мовою (uk / ru за `language_code`).
5. При наступних submit-ах `notifyNewLead` уже знає `chat_id` і надсилає DM без додаткових дій користувача.

Якщо `TELEGRAM_BOT_TOKEN` не виставлено, інтеграція — no-op, форма й DB-частина працюють як раніше.

## Meta Pixel + Conversions API (PR #5)

Дві ноги одного й того самого івента `Lead` — на клієнті через `fbq` і на сервері через Conversions API. Meta дедуплікує події по спільному `event_id`, тому статистика залишається чистою навіть якщо AdBlock прибив браузерний піксель.

Файли:

- `src/lib/analytics/pixel.ts` — ENV-хелпери (`isPixelConfigured`, `pixelId`, `capiAccessToken`, `pixelTestCode`).
- `src/lib/analytics/capi.ts` — `sendCapiEvent` + `hashUserData` (SHA-256 через Web Crypto, працює в Edge runtime).
- `src/components/analytics/pixel-script.tsx` — Server Component із канонічним `fbq` init-скриптом і `<noscript>` fallback. Якщо `NEXT_PUBLIC_META_PIXEL_ID` не виставлено — рендерить `null`.
- `src/app/api/capi/lead/route.ts` — серверний CAPI-роут (POST). Перевіряє схему через Zod, читає `_fbp`/`_fbc` з cookies, додає IP + UA.

Потік для конверсії `Lead`:

```
User submit form
  -> client: lead-form.tsx
       eventId = crypto.randomUUID()
       fbq('track','Lead', { content_name }, { eventID: eventId })   // browser pixel
       POST /api/lead { ..., eventId }
  -> server: /api/lead
       Zod -> Neon upsert/insert -> notifyNewLead(...)
       -> sendCapiEvent({ eventName:'Lead', eventId, email, fbp, fbc, ip, ua })
       -> return jsonOk({ stored, userId, mode, capiSent })
```

### Сетап після деплою

1. У Meta Events Manager створити Pixel і скопіювати ID (`NEXT_PUBLIC_META_PIXEL_ID`).
2. Settings → Generate access token → отримати CAPI-токен (`META_CAPI_TOKEN`).
3. (Опц.) Test events → скопіювати `TEST12345`-код у `META_PIXEL_TEST_CODE` для перевірки.
4. Виставити змінні у Vercel і ре-деплоїти.
5. Відкрити сайт у браузері з установленим [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc) — переконатися, що `PageView` фіксується. Відправити форму — побачити `Lead` (одну подію, дедуплікована).

### Telegram bot (prod)

Цей PR не змінює код бота, але є операційні кроки для production-вмикання (PR #3 уже вмерджено):

```bash
# 1. @BotFather → /newbot → RESOULMethodBot (або інше імʼя).
# 2. У Vercel виставити:
#    TELEGRAM_BOT_TOKEN=<токен від BotFather>
#    TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24)
#    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=resoulmethodbot
#    TELEGRAM_ADMIN_CHAT_ID=<твій chat_id>
# 3. Прив'язати webhook:
node scripts/telegram-set-webhook.mjs https://resoul.app/api/telegram/webhook
# 4. Перевірити статус:
node scripts/telegram-set-webhook.mjs --info
```

## Live Zoom event flow (PR #6)

`/[locale]/event/live` — лендінг живої події (День 5 Immersion Week): таймер
зворотного відліку, кнопка «Я буду» і кнопка «Приєднатись до Zoom», яка
зʼявляється рівно у вікно події.

### Файли

- `migrations/0003_events.sql` — таблиці `events`, `event_attendees`
  (з колонками `reminder_60_sent_at` / `reminder_15_sent_at` / `joined_at`).
- `src/lib/zoom/oauth.ts` + `client.ts` — Server-to-Server OAuth з кешем
  токена (5-хв буфер) + `createMeeting`/`getMeeting`.
- `src/lib/zoom/webhook.ts` — HMAC-SHA256 через Web Crypto: validation
  challenge + `x-zm-signature` перевірка.
- `src/lib/events/repo.ts` — DB-хелпери: `getEventBySlug`, `registerAttendee`
  (`on conflict do nothing`), `getPendingReminders`, `markReminderSent`,
  `markAttendeeJoined`.
- `src/app/api/event/register/route.ts` — POST з Zod-валідацією slug + uuid.
- `src/app/api/zoom/webhook/route.ts` — приймає `endpoint.url_validation` і
  `meeting.participant_joined`. Без `ZOOM_WEBHOOK_SECRET_TOKEN` 503 на
  validation і дев-режим перевірки підпису.
- `src/app/api/cron/zoom-reminders/route.ts` — викликається Vercel cron-ом,
  шле 60-хв і 15-хв нагадування через Telegram-бота.
- `vercel.json` — `*/5 * * * *` для `/api/cron/zoom-reminders`.

### Потік

```
Admin створює подію (одноразово, через SQL або createMeeting):
  events row (slug, start_at, zoom_meeting_id, zoom_join_url)

User /uk/event/live?slug=immersion-w5&u=<userId>
  -> бачить countdown (client)
  -> натискає "Я буду"
  -> POST /api/event/register { eventSlug, userId }
       -> event_attendees row (registered_at = now())
  -> у момент start_at JoinCta показує кнопку → Zoom

Vercel cron */5min -> /api/cron/zoom-reminders
  -> SELECT attendees зі start_at у вікнах [now+57..63] / [now+12..18]
  -> notifyEventReminder(...) (TG DM з joinUrl)
  -> UPDATE reminder_60_sent_at / reminder_15_sent_at

Zoom Marketplace -> /api/zoom/webhook
  -> meeting.participant_joined { email }
  -> UPDATE event_attendees.joined_at WHERE u.email = participant.email
```

### Сетап після деплою

1. **Migration**: `psql "$DATABASE_URL" -f migrations/0003_events.sql`.
2. **Подія**: створити рядок у `events` (наприклад через psql) з валідним
   `start_at` (UTC) і, після створення Zoom-мітингу, заповнити
   `zoom_meeting_id` + `zoom_join_url`.
3. **Zoom Server-to-Server OAuth**: створити app у Zoom Marketplace,
   виставити `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`.
4. **Zoom webhook**: у тому ж app → Feature → Event Subscriptions додати
   `meeting.participant_joined`, endpoint `https://<host>/api/zoom/webhook`,
   виставити `ZOOM_WEBHOOK_SECRET_TOKEN` у Vercel і у app.
5. **Vercel cron**: задеплоїти `vercel.json` (cron підхопиться автоматично
   у Project Settings → Cron Jobs). Виставити `CRON_SECRET` (random string)
   у Project Settings → Environment Variables.

Усе працює graceful: без `DATABASE_URL` сторінка показує `notFound`-секцію,
без `TELEGRAM_BOT_TOKEN` нагадування пропускаються (але `sent_at` все одно
ставиться, щоб не повторювати спроби), без Zoom-кредів кнопка `Join` просто
не зʼявляється.

## Payments (PR #7)

Підтримуємо два провайдери — **WayForPay** (основний, UA) і **MonoPay**
(резервний, UA). Обидва ідемпотентні через unique-index
`payments(provider, provider_ref)`. Усі суми зберігаються в копійках.

### Файли

- `migrations/0004_payments.sql` — `payments` (з `raw jsonb`) + `access`.
- `src/lib/payments/catalog.ts` — продукти (`level-0`, `level-1`, `level-2`),
  ціни в копійках, локалізовані заголовки.
- `src/lib/payments/access.ts` — `recordPayment` (`on conflict do nothing`),
  `grantAccess`, `hasAccess`, `getUserContact`.
- `src/lib/payments/wayforpay/{sign,client}.ts` — HMAC-MD5 підпис інвойсу /
  колбеку / acknowledgement (`node:crypto`); побудова payload для
  `https://secure.wayforpay.com/pay`.
- `src/lib/payments/mono/{sign,client}.ts` — ECDSA-SHA256 verify через Web
  Crypto (P-256, DER → P1363 конвертація), `createMonoInvoice` через
  `api.monobank.ua/api/merchant/invoice/create`.
- `src/app/api/pay/wfp/create/route.ts` — Node-runtime, рендерить
  auto-submit HTML-форму на WFP (бо WFP не приймає GET-параметри).
- `src/app/api/pay/wfp/webhook/route.ts` — Node-runtime, parse +
  signature verify + `recordPayment` + `grantAccess` + Telegram DM + CAPI
  `Purchase`. Завжди повертає підписаний JSON-acknowledgement.
- `src/app/api/pay/mono/create/route.ts` — Edge, 303 redirect на `pageUrl`.
- `src/app/api/pay/mono/webhook/route.ts` — Edge, X-Sign verify, далі
  така сама ланцюжкова логіка.
- `src/components/sections/pricing.tsx` — секція з трьома планами на
  `/[locale]/platform`.
- `src/app/[locale]/event/paid/page.tsx` — post-payment лендінг.

### Data flow (Level 0, UA, WayForPay)

```
User submit form
  -> POST /api/lead -> { userId }
  -> (якщо NEXT_PUBLIC_PAY_AFTER_LEAD=1) redirect to /api/pay/wfp/create?u=<userId>&p=level-0
       -> рендерить auto-submit HTML-форму -> POST https://secure.wayforpay.com/pay
User pays
  WFP -> POST /api/pay/wfp/webhook
       -> verify HMAC-MD5 signature
       -> recordPayment (on conflict do nothing)
       -> grantAccess(userId, "level-0")
       -> notifyPurchase() (TG DM)
       -> sendCapiEvent("Purchase", { eventId: `wfp_${orderRef}`, value, currency, email })
       -> respond signed { status: "accept" }
WFP -> redirect user -> /uk/event/paid?ref=<orderRef>
```

MonoPay flow ідентичний, тільки замість HTML-форми API повертає
`pageUrl`, на який ми робимо 303 redirect.

### Сетап після деплою

1. **Migration**: `psql "$DATABASE_URL" -f migrations/0004_payments.sql`.
2. **WayForPay** (основний):
   - У кабінеті WayForPay → Merchant → Settings взяти Merchant Login
     і Secret Key. Заповнити `WFP_MERCHANT_LOGIN`, `WFP_MERCHANT_SECRET`.
   - Поставити `WFP_DOMAIN` рівним домену сайту (наприклад
     `resoul.app`). Це той самий домен, що відправляється у
     `merchantDomainName` поле інвойсу.
   - У WFP кабінеті виставити Service URL = `https://<host>/api/pay/wfp/webhook`
     і Return URL = `https://<host>/{locale}/event/paid` (вибирається динамічно).
3. **MonoPay** (резервний):
   - У MonoPay створити merchant → отримати X-Token, заповнити `MONO_TOKEN`.
4. **Flow toggle**: щоб лід-форма одразу вела в касу — виставити
   `NEXT_PUBLIC_PAY_AFTER_LEAD=1` у Vercel і ре-деплоїти. Без цього прапорця
   форма зберігає попередню поведінку (thank-you екран).

Без жодного з ENV пейменти просто не активуються: `/api/pay/wfp/create` і
`/api/pay/mono/create` повертають 503, лід-форма продовжує показувати свій
thank-you екран.

## Auth + Cabinet (PR #8)

Безпарольний вхід через magic-link (Resend) і базовий каркас особистого
кабінету з трьома тайлами (Рівні, Платежі, Карта станів-заглушка).

### Файли

- `migrations/0005_auth.sql` — `email_verifications` (зберігаємо тільки
  `sha256(token)`, raw-токен ніколи не лежить у БД).
- `src/lib/auth/session.ts` — cookie-сесія `resoul_session`:
  base64url(payload).base64url(HMAC-SHA256(payload, AUTH_COOKIE_SECRET)).
  Payload `{ uid, exp }`, TTL 30 днів, `httpOnly + secure + sameSite=lax`.
- `src/lib/auth/magic-link.ts` — `generateRawToken()` (32B random
  base64url), `issueMagicLink({email,locale})` (upsert у `users` по email +
  insert у `email_verifications`), `consumeMagicLink(token)`
  (`update ... where token_hash and consumed_at is null and created_at >
  now() - make_interval(mins => 30)`).
- `src/lib/auth/access-read.ts` — `listAccess(userId)`,
  `listRecentPayments(userId, limit)` для тайлів кабінету.
- `src/lib/email/resend.ts` — мінімальний fetch-клієнт Resend
  (`POST https://api.resend.com/emails` з Bearer токеном).
- `src/lib/email/templates/magic-link.ts` — інлайн-HTML шаблон листа
  (UK/RU). Без зайвих залежностей — звичайний HTML рядок, безпечний для
  email-клієнтів.
- `src/app/api/auth/request-link/route.ts` — edge POST. Zod-валідація
  `{ email, locale }`, ніколи не розкриває, чи existує email.
- `src/app/api/auth/verify/route.ts` — edge GET. Consume token, `setSession`,
  302 на `/{locale}/dashboard`. Помилки → `/{locale}/login?status=<reason>`.
- `src/app/api/auth/logout/route.ts` — edge GET/POST. Очищує cookie і
  302 на `/{locale}`.
- `src/app/[locale]/login/page.tsx` + `src/components/auth/login-form.tsx`
  — форма з email, тостами `statusExpired/statusMissing/statusDisabled`
  з query.
- `src/app/[locale]/dashboard/layout.tsx` — gated: `getSession()` → null
  → `redirect("/login")`. Спільна nav (Огляд / Карта станів / Вийти).
- `src/app/[locale]/dashboard/page.tsx` — рендер трьох тайлів.
- `src/app/[locale]/dashboard/states/page.tsx` — заглушка під PR #9.
- `src/components/dashboard/{tile-level,tile-history,tile-states}.tsx`
  — серверні тайли.
- `src/components/sections/nav.tsx` — тепер async server wrapper, що
  читає сесію і передає `hasSession` у клієнтський `nav-inner.tsx`.

### Потік

```
/login → form → POST /api/auth/request-link
  -> issueMagicLink: upsert users by email, insert email_verifications (token_hash only)
  -> Resend → magic-link https://host/api/auth/verify?token=<raw>&locale=<uk|ru>
User кліком
  -> GET /api/auth/verify
       -> consumeMagicLink: UPDATE email_verifications SET consumed_at=now() WHERE token_hash and not consumed and fresh
       -> setSession(userId)  (HMAC-підписаний cookie на 30 днів)
       -> 302 → /uk/dashboard
/dashboard layout
  -> getSession() → null → redirect /login
  -> SELECT access + payments WHERE user_id → рендер тайлів
```

### Сетап після деплою

1. **Migration**: `psql "$DATABASE_URL" -f migrations/0005_auth.sql`.
2. **Resend**:
   - Зареєструватися на [resend.com](https://resend.com), додати домен,
     підтвердити DKIM/SPF/DMARC.
   - Створити API key → виставити `RESEND_API_KEY` у Vercel.
   - Виставити `EMAIL_FROM`, наприклад `RESOUL <login@resoul.app>`. Адреса
     повинна бути у підтвердженому домені.
3. **Cookie secret**: `openssl rand -hex 32` → виставити
   `AUTH_COOKIE_SECRET` у Vercel.
4. **`NEXT_PUBLIC_SITE_URL`** має вказувати на production-домен (без
   trailing slash) — magic-link генерується з нього.

Без жодного з цих ENV вхід просто не активується: `/api/auth/request-link`
повертає 503 (без `AUTH_COOKIE_SECRET`) або `{ sent: false }` (без Resend
кредів), і ми ніколи не показуємо raw-токен у відповіді HTTP. У dev raw
посилання можна підняти з Vercel runtime logs (`[auth:request_link:stub]`).

## Drip courses + R2 storage (PR #9)

Реальний курс-плеєр для Immersion Week (Level 0): сторінка зі списком 5
уроків, drip-розблокування (по 1 уроку на день з моменту першого відкриття
курсу), окрема сторінка уроку з плеєром, формою домашнього і бібліотекою
активів. Сховище — Cloudflare R2 через S3-сумісні presigned URLs (без AWS
SDK — все на Web Crypto).

### Файли

- `migrations/0006_courses.sql` — `courses`, `lessons` (з `day_offset`,
  `video_key`, `audio_key`, `asset_keys[]`), `enrollments`,
  `homework_submissions`. У кінці — idempotent сід Immersion Week
  (`level-0`) з 5 уроками.
- `src/lib/storage/r2.ts` — `presign({ method, key, ttlSec, contentType })`,
  тонкі обгортки `r2SignedGet` / `r2SignedPut` і `r2PublicUrl(key)` для
  R2_PUBLIC_DOMAIN. Pure AWS SigV4 query-string auth.
- `src/lib/courses/drip.ts` — `isUnlocked(now, startedAt, dayOffset)` і
  `unlockInfo(...)` з `daysUntilUnlock`.
- `src/lib/courses/access.ts` — `getCourse`, `listLessons`, `getLesson`,
  `getLessonById`, `getEnrollment`, `ensureEnrollment` (upsert),
  `canEnterCourse` (через `hasAccess` з PR #7), `recordHomework`,
  `listHomework`.
- `src/app/api/lessons/[id]/sign/route.ts` — edge GET. Перевіряє сесію,
  доступ і drip-стан, потім повертає `{ videoUrl, audioUrl, ttlSec }`
  з presigned R2 URLs (1 година).
- `src/app/api/upload/sign/route.ts` — edge POST. Видає presigned PUT
  для `homework/{userId}/{ts}_{file}`. Allow-list типів (`image/*`,
  `audio/*`, `video/*`, `application/pdf`), ліміт 25 MB.
- `src/app/api/homework/submit/route.ts` — edge POST. Записує
  `homework_submissions` (текст + url + file_keys), вимагає хоча б одне.
- `src/app/[locale]/dashboard/level-0/page.tsx` — список уроків з drip
  бейджами (`Доступно` / `Відкриється за N дн.`).
- `src/app/[locale]/dashboard/level-0/[lessonSlug]/page.tsx` — сторінка
  уроку з плеєром, тілом (мінімалістичний markdown без deps), бібліотекою
  і формою ДЗ. Locked → 302 на список курсу.
- `src/components/courses/lesson-player.tsx` — client, `<video>` з
  fetched signed URL і опціональним аудіо-fallback.
- `src/components/courses/homework-form.tsx` — client, текст + url + N
  файлів (presign → PUT → submit з `file_keys`).
- `src/components/courses/library.tsx` — server, посилання на
  `r2PublicUrl(key)` для public активів.

### Потік

```
/uk/dashboard/level-0
  -> require session
  -> canEnterCourse(uid, "level-0") → hasAccess(uid, "level-0") з payments.PR#7
  -> ensureEnrollment(uid, "level-0") → upsert (user_id, course_slug, started_at)
  -> listLessons("level-0") → 5 уроків
  -> для кожного: isUnlocked(now, startedAt, day_offset) → бейдж/лінк

/uk/dashboard/level-0/d1-structure
  -> ті ж перевірки + lesson існує + isUnlocked → 302 якщо ні
  -> <LessonPlayer> → GET /api/lessons/<id>/sign → {videoUrl, audioUrl}
       -> presigned R2 GET, 1 година
  -> <HomeworkForm> → POST /api/upload/sign per file → PUT до R2 → POST /api/homework/submit
```

### Сетап після деплою

1. **Migration**: `psql "$DATABASE_URL" -f migrations/0006_courses.sql`.
   Сід уроків ідемпотентний — повторні запуски нічого не дублюють.
2. **Cloudflare R2**:
   - Створити R2 bucket (наприклад `resoul-content`).
   - R2 → Manage API Tokens → Create token (Object Read & Write обмежений
     цим бакетом) → виставити `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
     `R2_ACCOUNT_ID`, `R2_BUCKET` у Vercel.
   - (Опц.) Підключити кастомний домен у R2 → виставити
     `R2_PUBLIC_DOMAIN` для бібліотеки публічних активів.
3. **Завантажити контент**:
   - Через консоль R2 (drag-and-drop) або `aws s3 cp --endpoint-url
     https://<account>.r2.cloudflarestorage.com s3://<bucket>/lessons/d1.mp4`.
   - Прописати ключ у БД:
     `update lessons set video_key='lessons/d1.mp4' where slug='d1-structure';`
4. Якщо R2 не налаштований — уроки рендеряться з текстом і пустим
   плеєром (`Відео ще не залите`). Завантажений markdown-body все одно
   видно.

Безпека:
- `/api/lessons/:id/sign` ніколи не повертає URL без верифікації доступу і
  drip-стану. Signed URL живе максимум 1 годину.
- `/api/upload/sign` обмежений content-type allow-list, ключі скоупові на
  `homework/{userId}/...`, ліміт 25 MB.
- Homework пам'ять append-only — нічого не редагуємо/не видаляємо.

## Roadmap

Послідовність PR-ів:

1. PR #1 — scaffold + Landing Level 0 *(merged)*
2. PR #2 — lead-форма + `/api/lead` + Neon (users + leads) *(merged)*
3. PR #3 — **Telegram-бот (вебхук + DM лідам)** ← *цей PR*
4. PR #4 — Landing Level 1 + динамічний банк кейсів
5. PR #5 — Cabinet (LMS) MVP: auth, drip, відео-плеєр
6. PR #6 — Zoom API + reminders
7. PR #7 — кейс-форма + gate до Level 2 + auto-PDF сертифікати
8. PR #8 — Meta Pixel + CAPI + GA4 + UTM persistence

## Ліцензія

Приватний проєкт RESOUL. All rights reserved.
