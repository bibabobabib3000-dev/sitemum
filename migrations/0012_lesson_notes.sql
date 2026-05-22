-- RESOUL — per-lesson notes + bookmarks (PR B2).
--
-- Both tables use a composite (user_id, lesson_id) primary key — a user
-- has at most one note per lesson, and either bookmarks a lesson or not.
-- We do NOT keep a history of edits; the autosave loop just overwrites
-- `body_md` and bumps `updated_at`.
--
-- `lesson_id` is references-only at the app layer to keep migrations
-- composable with future drip / catalog changes (lessons are seeded at
-- runtime — see migrations/0006_courses.sql). Both tables CASCADE on
-- user delete so a soft- or hard-deleted user removes their notes and
-- bookmarks atomically.
--
-- The script is idempotent (`if not exists` everywhere) — safe to run
-- multiple times on the same DB.

create table if not exists lesson_notes (
  user_id    uuid not null references users(id) on delete cascade,
  lesson_id  uuid not null,
  body_md    text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_notes_user_updated_idx
  on lesson_notes (user_id, updated_at desc);

create table if not exists lesson_bookmarks (
  user_id    uuid not null references users(id) on delete cascade,
  lesson_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index if not exists lesson_bookmarks_user_created_idx
  on lesson_bookmarks (user_id, created_at desc);
