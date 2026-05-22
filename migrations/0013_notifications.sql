-- RESOUL — in-app notifications + email/telegram outbox (PR B3).
--
-- Two tables, one job:
--
--  * `notifications` — what the user sees in the bell-dropdown. One row
--    per (user, event); `payload` is a kind-specific JSON blob the UI
--    can render with i18n keys. `read_at` is null until the user opens
--    the bell or clicks the row.
--
--  * `outbox` — pending email / telegram sends. The dispatcher in
--    `src/lib/notifications/dispatch.ts` writes both a `notifications`
--    row AND one outbox row per off-app channel (email, telegram). A
--    cron at `/api/cron/outbox-drain` reads `outbox where sent_at is
--    null and send_after <= now()`, calls the existing email/telegram
--    clients, and stamps `sent_at` (or `error_text` on failure).
--
-- The split lets us deliver the in-app row synchronously while
-- deferring outbound channels — and gives us a place to retry without
-- coupling the caller to network latency.
--
-- Idempotent: every statement uses `if not exists`.

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- Partial index for the unread-counter query.
create index if not exists notifications_user_unread_idx
  on notifications (user_id)
  where read_at is null;

create table if not exists outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  channel     text not null check (channel in ('email', 'telegram')),
  payload     jsonb not null default '{}'::jsonb,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  error_text  text,
  attempts    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists outbox_pending_idx
  on outbox (send_after)
  where sent_at is null;

create index if not exists outbox_user_idx
  on outbox (user_id, created_at desc);
