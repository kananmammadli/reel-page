-- Milestone 3: accounts + sync (profiles, playback_positions) per SPEC.md §4.

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'listener' check (role in ('listener', 'host', 'moderator')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read their own profile"
  on profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Every new auth user gets a profile row automatically. Runs as the
-- function owner (postgres), bypassing the RLS policies above.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table playback_positions (
  user_id uuid not null references auth.users (id) on delete cascade,
  episode_id uuid not null references episodes (id) on delete cascade,
  position_s integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);

create index playback_positions_user_id_updated_at_idx on playback_positions (user_id, updated_at desc);

alter table playback_positions enable row level security;

create policy "Users can read their own playback positions"
  on playback_positions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can write their own playback positions"
  on playback_positions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own playback positions"
  on playback_positions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
