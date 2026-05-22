-- RESOUL — user profile fields + ban reason (PR B1).
--
-- This migration introduces the columns that back the `/uk/account` self-
-- service profile page and the public-facing ban gate:
--
--   * users.display_name          — short, public-facing name shown in the
--                                   nav / greeting. Distinct from `full_name`
--                                   which is captured from the lead form and
--                                   serves as the legal/full name on record.
--   * users.bio                   — free-form short bio (visible only to the
--                                   user themselves for now; community / case
--                                   surfaces in later PRs).
--   * users.avatar_key            — R2 object key for the uploaded avatar.
--                                   The upload path itself is not implemented
--                                   in this PR; the column is added so the
--                                   schema is ready for PR B2.
--   * users.notification_prefs    — jsonb shaped like
--                                   `{ "email": bool, "telegram": bool,
--                                      "in_app": bool }`. The UI reads/writes
--                                   only these three channels; storing as
--                                   jsonb keeps the schema stable as new
--                                   channels are added.
--   * users.theme_pref            — `system` | `dark` | `light`. Drives the
--                                   `data-theme` cookie / attribute. Not yet
--                                   wired in this PR (UI lands in PR C1).
--   * users.ban_reason            — optional human-readable note shown to
--                                   the banned user on /[locale]/banned.
--                                   Admin-only field (no self-edit).
--
-- The migration is idempotent and safe to re-run.

alter table users
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_key text,
  add column if not exists notification_prefs jsonb
    not null
    default '{"email": true, "telegram": true, "in_app": true}'::jsonb,
  add column if not exists theme_pref text not null default 'system',
  add column if not exists ban_reason text;

-- Sanity constraint: theme_pref must be one of the three allowed values.
-- Wrapped in a do-block so re-running the migration on a deploy that
-- already has the constraint is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_theme_pref_chk'
  ) then
    alter table users
      add constraint users_theme_pref_chk
      check (theme_pref in ('system', 'dark', 'light'));
  end if;
end$$;
