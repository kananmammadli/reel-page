-- Privacy-friendly analytics (SPEC.md §5: "privacy-friendly events for
-- plays, previews completed, purchases, club joins") -- a first-party
-- event log instead of a third-party SDK, so there's no additional data
-- sharing beyond what this app already does, and no new credential to
-- provision (same reasoning as the rest of this project's approach to
-- third-party services it can't set up real accounts for).
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('play', 'preview_completed', 'purchase', 'club_join')),
  title_id uuid references titles (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index analytics_events_event_type_created_at_idx on analytics_events (event_type, created_at);

alter table analytics_events enable row level security;

-- Write-only from the client's perspective: anyone (guests included, for
-- "play"/"preview_completed") can log their own event, but nobody can
-- read it back except the host reviewing aggregate activity -- this
-- table is operational telemetry, not user-facing data.
create policy "Anyone can log their own analytics event" on analytics_events
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy "Hosts can read analytics events" on analytics_events for select to authenticated using (is_host());
