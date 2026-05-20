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
