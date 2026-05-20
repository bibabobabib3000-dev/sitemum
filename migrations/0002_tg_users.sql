-- RESOUL — Telegram bot schema (PR #3).
--
-- tg_users: one row per Telegram chat that talked to the bot. We learn the
-- chat_id (a numeric int64) only after the user sends /start to the bot, so
-- this table is what lets us DM a lead later from /api/lead.
--
-- Linkage to public.users is optional and happens via either:
--   1) /start payload "lead_<users.id>" (deep link from the thank-you page), or
--   2) case-insensitive match on tg_username against users.tg_username.
--
-- When the link is resolved we also denormalize the chat_id into users.tg_id
-- so existing queries (and admin tooling) can find it without a join.

create table if not exists tg_users (
  tg_chat_id      bigint primary key,
  tg_username     text,
  tg_first_name   text,
  tg_last_name    text,
  is_bot          boolean not null default false,
  language_code   text,
  user_id         uuid references users(id) on delete set null,
  start_payload   text,
  started_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tg_users_username_idx
  on tg_users (lower(tg_username))
  where tg_username is not null;

create index if not exists tg_users_user_id_idx
  on tg_users (user_id)
  where user_id is not null;

drop trigger if exists tg_users_set_updated_at on tg_users;
create trigger tg_users_set_updated_at
  before update on tg_users
  for each row execute function set_updated_at();
