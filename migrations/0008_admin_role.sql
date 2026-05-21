-- RESOUL — admin foundation (PR A1).
--
-- Introduces an admin role on the existing `users` table, a coarse
-- "last seen" pointer for support tooling, and an append-only audit log
-- that every admin-side mutation will write to.
--
-- Notes:
--  * `is_admin` defaults to false; existing rows stay non-admin. Promote
--    a seed account manually with `update users set is_admin=true where ...`.
--  * `audit_log.payload` is jsonb so individual actions can stash arbitrary
--    context (decisions, diffs, requester ip, etc.) without further DDL.
--  * `actor_user_id` is intentionally nullable so we can still log
--    system-triggered events (cron-driven sweeps, future webhook
--    administrative actions) once those exist.

alter table users
  add column if not exists is_admin boolean not null default false;

alter table users
  add column if not exists last_seen_at timestamptz;

create index if not exists users_is_admin_idx on users (is_admin) where is_admin = true;

create table if not exists audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references users(id) on delete set null,
  action          text not null,
  target_type     text,
  target_id       text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);
create index if not exists audit_log_actor_idx on audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_action_idx on audit_log (action, created_at desc);
