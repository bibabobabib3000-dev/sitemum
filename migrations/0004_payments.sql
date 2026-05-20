-- RESOUL — payments + access (PR #7).
--
-- payments: provider-agnostic ledger. Each successful webhook upserts one
-- row keyed on (provider, provider_ref) so retried webhooks are idempotent.
-- `raw` keeps the original payload for audit / refunds.
--
-- access: row per (user, product). Inserted by grantAccess() after a webhook
-- confirms payment. `expires_at` is null for one-shot products (Level 0).

create table if not exists payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references users(id) on delete set null,
  provider        text not null check (provider in ('wfp', 'mono')),
  provider_ref    text not null,
  product_slug    text not null,
  amount_cents    int  not null,
  currency        text not null,
  status          text not null,
  raw             jsonb not null,
  created_at      timestamptz not null default now()
);

create unique index if not exists payments_provider_ref_uq
  on payments (provider, provider_ref);

create index if not exists payments_user_idx on payments (user_id);

create table if not exists access (
  user_id         uuid not null references users(id) on delete cascade,
  product_slug    text not null,
  granted_at      timestamptz not null default now(),
  expires_at      timestamptz,
  primary key (user_id, product_slug)
);

create index if not exists access_product_idx on access (product_slug);
