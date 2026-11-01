-- Milestone 4: entitlements + subscriptions per SPEC.md §4.
--
-- Security invariant (CLAUDE.md): clients never grant themselves access.
-- No INSERT/UPDATE/DELETE policy exists for anon/authenticated on either
-- table -- only the service role (used exclusively inside the Stripe/
-- RevenueCat webhook Edge Functions) can write, and it bypasses RLS
-- entirely. Absence of a write policy is itself the enforcement; there is
-- nothing to "turn off".

create type entitlement_kind as enum ('title', 'collection', 'club_month');
create type entitlement_source as enum ('apple', 'google', 'stripe');

create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind entitlement_kind not null,
  -- Polymorphic reference (titles/collections/club_months depending on
  -- `kind`) -- no FK constraint possible across multiple target tables.
  ref_id uuid not null,
  source entitlement_source not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);

create index entitlements_user_id_idx on entitlements (user_id);
create index entitlements_user_id_kind_ref_id_idx on entitlements (user_id, kind, ref_id);

alter table entitlements enable row level security;

create policy "Users can read their own entitlements"
  on entitlements for select
  to authenticated
  using (auth.uid() = user_id);

create table subscriptions (
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('active', 'canceled', 'past_due', 'expired')),
  source entitlement_source not null,
  current_period_end timestamptz not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source, external_id)
);

create index subscriptions_user_id_idx on subscriptions (user_id);

alter table subscriptions enable row level security;

create policy "Users can read their own subscriptions"
  on subscriptions for select
  to authenticated
  using (auth.uid() = user_id);
