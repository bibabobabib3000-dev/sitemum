-- RESOUL — initial schema
-- Stage: PR #2 (lead capture). Payment-related tables (products, orders,
-- enrollments, events) will be added in a later migration once the
-- payment integration phase begins.

-- ============================================================================
-- users: identity layer. One row per unique person, keyed on email.
-- A user can have multiple leads (form re-submissions, multi-touch).
-- ============================================================================
create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  full_name       text,
  tg_username     text,
  tg_id           bigint,
  locale          text not null default 'uk',
  tz              text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_email_idx on users (email);
create index if not exists users_tg_id_idx on users (tg_id) where tg_id is not null;

-- ============================================================================
-- leads: form-submission events. Append-only.
-- A single user can have many leads. We keep every submission so we can
-- track which UTM source converted, drop-off, retries, etc.
-- ============================================================================
create table if not exists leads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete set null,
  email           text not null,
  full_name       text,
  tg_username     text,
  product_slug    text not null default 'level-0',
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  referer         text,
  user_agent      text,
  ip              inet,
  created_at      timestamptz not null default now()
);

create index if not exists leads_user_id_idx on leads (user_id);
create index if not exists leads_email_idx on leads (email);
create index if not exists leads_created_at_idx on leads (created_at desc);

-- ============================================================================
-- updated_at trigger for users
-- ============================================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();
