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
