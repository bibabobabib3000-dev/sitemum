-- RESOUL — admin user management (PR A3).
--
-- This migration prepares the schema for the new user-admin surface:
--
--  * `users.banned_at` — soft-ban marker. When non-null the dashboard
--    layout refuses to render and the login flow rejects the session.
--    Bans are reversible (admin clears the column) and the ban event
--    is captured in `audit_log` for traceability.
--
--  * `access.granted_by_user_id` — when an admin grants L0/L1/L2 from
--    the UI (instead of a payment webhook), we stamp who did it so the
--    audit trail in `audit_log` can be cross-referenced.
--
-- The migration is idempotent and safe to run on top of 0008/0009.

alter table users
  add column if not exists banned_at timestamptz;

create index if not exists users_banned_at_idx on users (banned_at)
  where banned_at is not null;

alter table access
  add column if not exists granted_by_user_id uuid references users(id) on delete set null;

create index if not exists access_granted_by_idx on access (granted_by_user_id)
  where granted_by_user_id is not null;
