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
│   └── validation/schemas.ts   # Zod schemas (leadInputSchema)
└── middleware.ts               # next-intl middleware
messages/
├── uk.json
└── ru.json
migrations/
└── 0001_init.sql               # users + leads tables
```

## Дизайн-система

CSS-variables у `globals.css` визначають:

- `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--accent`, `--border`

Default — темна тема (`#0a0a0a` / `#f5f5f4`). Cabinet (LMS) у майбутньому отримає окрему світлу варіацію.

## i18n

- Маршрути локалізовані: `/uk/*` та `/ru/*`
- Default locale: `uk`
- `next-intl` middleware редіректить з `/` на `/uk`

## Roadmap

Поточний PR — це **PR #1 з ~8**. Послідовність наступних:

1. PR #1 — scaffold + Landing Level 0 *(merged)*
2. PR #2 — **lead-форма + `/api/lead` + Neon (users + leads)** ← *цей PR*
3. PR #3 — Telegram-бот (Telegraf на serverless)
4. PR #4 — Landing Level 1 + динамічний банк кейсів
5. PR #5 — Cabinet (LMS) MVP: auth, drip, відео-плеєр
6. PR #6 — Zoom API + reminders
7. PR #7 — кейс-форма + gate до Level 2 + auto-PDF сертифікати
8. PR #8 — Meta Pixel + CAPI + GA4 + UTM persistence

## Ліцензія

Приватний проєкт RESOUL. All rights reserved.
