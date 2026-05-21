-- RESOUL — admin review for Level 2 case studies (PR A2).
--
-- The existing `cases` table from migration 0007 only tracks
-- `approved` + `approved_at`. PR A2 adds the missing audit columns
-- the admin queue UI writes to: a private review note (markdown-ish,
-- UA-language since that's the operator-facing locale) and the
-- reviewer's user id for traceability.
--
-- `reviewer_user_id` is nullable on purpose — historical rows that were
-- approved manually via SQL before this PR have no recorded reviewer.

alter table cases
  add column if not exists review_notes_uk text;

alter table cases
  add column if not exists reviewer_user_id uuid references users(id) on delete set null;

-- Speeds up the admin queue ordering: pending cases first by oldest
-- submission, since the queue page sorts on submitted_at desc/asc.
create index if not exists cases_submitted_at_idx on cases (submitted_at desc);
