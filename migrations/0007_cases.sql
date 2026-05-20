-- RESOUL — Level 2 case studies (PR #12).
--
-- A case study is the final artefact a Level 2 student submits before they
-- can issue the Level 2 certificate. One row per user keyed on `user_id`
-- (a student can only have one in-flight case at a time; resubmissions
-- overwrite the same row).
--
-- `approved` is flipped by an admin manually for now (no admin UI in scope
-- of PR #12). Once approved=true, `src/lib/courses/certificate.ts:canIssueCertificate`
-- starts returning true for that user.

create table if not exists cases (
  user_id         uuid references users(id) on delete cascade primary key,
  body_uk         text not null,
  video_url       text,
  approved        boolean not null default false,
  submitted_at    timestamptz not null default now(),
  approved_at     timestamptz
);

create index if not exists cases_approved_idx on cases (approved);
