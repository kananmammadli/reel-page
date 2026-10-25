-- Milestone 2: catalog schema (titles, episodes, collections) per SPEC.md §4.
-- Storage buckets for posters (public) and audio (private — full episodes are
-- only ever served through the get-audio-url Edge Function's signed URLs).

create type title_type as enum ('film', 'story');

create table titles (
  id uuid primary key default gen_random_uuid(),
  type title_type not null,
  title text not null,
  creator text not null,
  year integer,
  genre text,
  description text,
  poster_url text,
  is_free boolean not null default false,
  price_ref text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table episodes (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references titles (id) on delete cascade,
  position integer not null,
  name text not null,
  duration_s integer not null,
  audio_path text not null,
  preview_path text,
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (title_id, position)
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_ref text,
  created_at timestamptz not null default now()
);

create table collection_titles (
  collection_id uuid not null references collections (id) on delete cascade,
  title_id uuid not null references titles (id) on delete cascade,
  primary key (collection_id, title_id)
);

create index episodes_title_id_position_idx on episodes (title_id, position);
create index collection_titles_title_id_idx on collection_titles (title_id);

alter table titles enable row level security;
alter table episodes enable row level security;
alter table collections enable row level security;
alter table collection_titles enable row level security;

create policy "Published titles are publicly readable"
  on titles for select
  to anon, authenticated
  using (published_at is not null and published_at <= now());

create policy "Episodes of published titles are publicly readable"
  on episodes for select
  to anon, authenticated
  using (
    exists (
      select 1 from titles
      where titles.id = episodes.title_id
        and titles.published_at is not null
        and titles.published_at <= now()
    )
  );

create policy "Collections are publicly readable"
  on collections for select
  to anon, authenticated
  using (true);

create policy "Collection memberships are publicly readable"
  on collection_titles for select
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public)
values
  ('posters', 'posters', true),
  ('audio', 'audio', false)
on conflict (id) do nothing;

create policy "Poster images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'posters');

-- No select policy for the 'audio' bucket: every full-episode or preview
-- fetch goes through the get-audio-url Edge Function, which uses the
-- service role key to mint a short-lived signed URL after checking access
-- (currently titles.is_free; replaced by a real entitlements check in
-- milestone 4). Clients never get direct storage.objects access to audio.
