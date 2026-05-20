-- RESOUL — auth (PR #8).
--
-- We use stateless cookie-based sessions (signed JWT-like blob, see
-- src/lib/auth/session.ts), so we do NOT need a sessions table. The only
-- persisted state is the magic-link verification token — and we only
-- persist its hash, never the raw value.
--
-- A row is created when /api/auth/request-link is hit and consumed
-- (consumed_at = now()) on the first successful /api/auth/verify call.
-- Subsequent verification attempts with the same token return 410.

create table if not exists email_verifications (
  token_hash      text primary key,
  user_id         uuid not null references users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  consumed_at     timestamptz
);

create index if not exists email_verifications_user_idx
  on email_verifications (user_id);

create index if not exists email_verifications_pending_idx
  on email_verifications (created_at desc)
  where consumed_at is null;
