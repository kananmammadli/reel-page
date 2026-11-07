-- Milestone 7: quote journal (quotes, listening stats, opt-in weekly
-- reflection) per SPEC.md §3.6/§4.

create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references episodes (id) on delete cascade,
  text text not null,
  at_s integer not null,
  created_at timestamptz not null default now()
);

create table listening_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  seconds integer not null default 0,
  primary key (user_id, day)
);

create table reflection_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  consented_at timestamptz
);

-- Not in SPEC.md's original data-model draft -- added here (and
-- documented in SPEC.md/SPEC.ru.md §4) because the weekly reflection
-- needs somewhere to live that's visible in-app, not just an email/push.
-- One row per user per week; written only by the weekly-reflection Edge
-- Function (service role), but owner-deletable -- "turn off and delete
-- data" (SPEC.md §3.6) has to be something the user can actually trigger
-- from their own session, not something that waits on a host/admin.
create table reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  quotes_count integer not null,
  total_minutes integer not null,
  main_theme text,
  reflective_question text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index quotes_user_id_created_at_idx on quotes (user_id, created_at desc);
create index reflections_user_id_week_start_idx on reflections (user_id, week_start desc);

alter table quotes enable row level security;
alter table listening_days enable row level security;
alter table reflection_settings enable row level security;
alter table reflections enable row level security;

create policy "Users can manage their own quotes" on quotes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage their own listening days" on listening_days for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage their own reflection settings" on reflection_settings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Read + delete only -- a client can never write a reflection's content,
-- just decide it should go away.
create policy "Users can read their own reflections" on reflections for select to authenticated using (user_id = auth.uid());
create policy "Users can delete their own reflections" on reflections for delete to authenticated using (user_id = auth.uid());

-- Atomic increment via RPC (supabase-js's upsert can't express
-- `seconds = seconds + n`, only overwrite). security invoker, keyed off
-- auth.uid() rather than a passed-in user_id, so it can never be used to
-- write another user's row and still honors the policy above.
create function public.increment_listening_seconds(p_day date, p_seconds integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into listening_days (user_id, day, seconds)
  values (auth.uid(), p_day, p_seconds)
  on conflict (user_id, day) do update set seconds = listening_days.seconds + excluded.seconds;
end;
$$;

-- The literal secret below is a local-dev-only placeholder (same
-- category as the well-known local anon/service_role JWTs already in
-- this repo) -- it must match CRON_SECRET in supabase/functions/.env,
-- and a real deployment needs its own migration overriding both with a
-- real generated value. Inlined directly rather than read from a GUC:
-- `alter database ... set` needs superuser, which the migration role
-- doesn't have here.
select cron.schedule(
  'weekly-reflection',
  '0 9 * * 1', -- Monday 09:00 UTC
  $$
  select net.http_post(
    url := 'http://kong:8000/functions/v1/weekly-reflection',
    headers := '{"Content-Type":"application/json","X-Cron-Secret":"local-dev-cron-secret-change-in-production"}'::jsonb
  );
  $$
);
