-- RESOUL — Live event flow schema (PR #6).
--
-- events: a single live session (e.g. "День 5 — Live Zoom" of Immersion
-- Week). One row per session. Slug is the public identifier used by
-- /event/live?slug=...
--
-- event_attendees: bridge between users and events with reminder bookkeeping
-- so the cron job can be idempotent (it only picks rows where the relevant
-- reminder column is still NULL).

create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  zoom_meeting_id text,
  zoom_join_url   text,
  start_at        timestamptz not null,
  duration_min    int not null default 90,
  topic_uk        text not null,
  topic_ru        text,
  created_at      timestamptz not null default now()
);

create index if not exists events_start_at_idx on events (start_at);

create table if not exists event_attendees (
  event_id              uuid not null references events(id) on delete cascade,
  user_id               uuid not null references users(id) on delete cascade,
  registered_at         timestamptz not null default now(),
  reminder_60_sent_at   timestamptz,
  reminder_15_sent_at   timestamptz,
  joined_at             timestamptz,
  primary key (event_id, user_id)
);

create index if not exists event_attendees_event_idx
  on event_attendees (event_id);

-- For the cron job: find attendees still pending each reminder, fastest path.
create index if not exists event_attendees_reminder_60_pending_idx
  on event_attendees (event_id)
  where reminder_60_sent_at is null;

create index if not exists event_attendees_reminder_15_pending_idx
  on event_attendees (event_id)
  where reminder_15_sent_at is null;
