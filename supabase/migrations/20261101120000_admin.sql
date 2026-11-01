-- Milestone 5: admin panel. Adds host-only write access to the catalog
-- and a payments ledger for the sales dashboard, per SPEC.md §4/§3.9.

-- `profiles` RLS only lets a user read their own row, so this is safe
-- without security definer: it only ever evaluates the caller's own role.
create function public.is_host()
returns boolean
language sql
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'host');
$$;

-- Hosts can see and edit the full catalog, including unpublished drafts.
create policy "Hosts can read all titles" on titles for select to authenticated using (is_host());
create policy "Hosts can insert titles" on titles for insert to authenticated with check (is_host());
create policy "Hosts can update titles" on titles for update to authenticated using (is_host()) with check (is_host());
create policy "Hosts can delete titles" on titles for delete to authenticated using (is_host());

create policy "Hosts can read all episodes" on episodes for select to authenticated using (is_host());
create policy "Hosts can insert episodes" on episodes for insert to authenticated with check (is_host());
create policy "Hosts can update episodes" on episodes for update to authenticated using (is_host()) with check (is_host());
create policy "Hosts can delete episodes" on episodes for delete to authenticated using (is_host());

create policy "Hosts can insert collections" on collections for insert to authenticated with check (is_host());
create policy "Hosts can update collections" on collections for update to authenticated using (is_host()) with check (is_host());
create policy "Hosts can delete collections" on collections for delete to authenticated using (is_host());

create policy "Hosts can insert collection memberships" on collection_titles for insert to authenticated with check (is_host());
create policy "Hosts can delete collection memberships" on collection_titles for delete to authenticated using (is_host());

-- Poster/audio storage writes. Audio has no client select policy for
-- anyone else (see catalog migration) -- hosts need read back to re-derive
-- a preview, so that's host-only too, not public.
create policy "Hosts can upload poster images" on storage.objects for insert to authenticated with check (bucket_id = 'posters' and is_host());
create policy "Hosts can update poster images" on storage.objects for update to authenticated using (bucket_id = 'posters' and is_host()) with check (bucket_id = 'posters' and is_host());
create policy "Hosts can delete poster images" on storage.objects for delete to authenticated using (bucket_id = 'posters' and is_host());

create policy "Hosts can read audio files" on storage.objects for select to authenticated using (bucket_id = 'audio' and is_host());
create policy "Hosts can upload audio files" on storage.objects for insert to authenticated with check (bucket_id = 'audio' and is_host());
create policy "Hosts can update audio files" on storage.objects for update to authenticated using (bucket_id = 'audio' and is_host()) with check (bucket_id = 'audio' and is_host());
create policy "Hosts can delete audio files" on storage.objects for delete to authenticated using (bucket_id = 'audio' and is_host());

-- Sales dashboard needs every user's rows, not just the caller's own.
create policy "Hosts can read all entitlements" on entitlements for select to authenticated using (is_host());
create policy "Hosts can read all subscriptions" on subscriptions for select to authenticated using (is_host());

-- Append-only record of confirmed charges (one per one-time purchase, one
-- per subscription renewal) -- entitlements/subscriptions are current-state
-- tables and can't answer "revenue this month", so this is the ledger the
-- sales dashboard reads. Written only by the Stripe/RevenueCat webhook
-- Edge Functions via the service role, same as entitlements/subscriptions;
-- no client role gets a write policy.
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind entitlement_kind not null,
  ref_id uuid,
  source entitlement_source not null,
  external_id text not null,
  amount_cents integer not null,
  currency text not null,
  occurred_at timestamptz not null default now(),
  unique (source, external_id)
);

create index payments_occurred_at_idx on payments (occurred_at);
create index payments_kind_ref_id_idx on payments (kind, ref_id);

alter table payments enable row level security;

create policy "Hosts can read all payments" on payments for select to authenticated using (is_host());
