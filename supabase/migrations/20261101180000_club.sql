-- Milestone 6: the club -- scheduled drops, live chat, Q&A, moderation,
-- per SPEC.md §3.5/§4.

-- Security fix (found while building this milestone, not introduced by
-- it): the milestone-3 "Users can update their own profile" policy has no
-- column restriction, so any authenticated user could currently run
-- `update profiles set role = 'host'` on their own row and self-promote
-- to host -- which milestone 5's whole admin-panel security model (and
-- this migration's club moderation policies) assumes can't happen.
-- Column-level privileges are checked in addition to RLS, so this closes
-- it without touching the existing display_name-editing policy: only the
-- service role (bypasses grants too) can write these two columns from now
-- on, which is why "suspend member" below goes through a service-role
-- route rather than the host's own session.
alter table profiles add column suspended_at timestamptz;
-- A column-level REVOKE alone is not enough: `authenticated` also holds a
-- table-wide UPDATE grant (from Supabase's default privileges), and
-- Postgres authorizes a column update if *either* the table-wide grant or
-- a column-specific grant covers it. Replacing the table-wide grant with
-- an explicit column list is what actually excludes role/suspended_at.
revoke update on profiles from authenticated;
grant update (display_name) on profiles to authenticated;

create table club_months (
  id uuid primary key default gen_random_uuid(),
  month date not null unique, -- first day of the month, e.g. 2026-11-01
  title_id uuid not null references titles (id),
  pitch text,
  price_ref text,
  created_at timestamptz not null default now()
);

create table club_releases (
  club_month_id uuid not null references club_months (id) on delete cascade,
  episode_id uuid not null references episodes (id) on delete cascade,
  release_at timestamptz not null,
  notified_at timestamptz,
  primary key (club_month_id, episode_id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  club_month_id uuid not null references club_months (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  reply_to uuid references chat_messages (id) on delete set null,
  pinned boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  club_month_id uuid not null references club_months (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  answer text,
  answered_at timestamptz,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table blocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  blocked_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id),
  check (user_id != blocked_user_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references chat_messages (id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create table push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index club_releases_episode_id_idx on club_releases (episode_id);
create index chat_messages_club_month_id_created_at_idx on chat_messages (club_month_id, created_at);
create index questions_club_month_id_idx on questions (club_month_id);
create index reports_status_idx on reports (status);

alter table club_months enable row level security;
alter table club_releases enable row level security;
alter table chat_messages enable row level security;
alter table questions enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;
alter table push_tokens enable row level security;

-- club_months/club_releases are just scheduling metadata (which title,
-- which month, when each episode drops) -- publicly readable so the home
-- banner and "unreleased episodes show their release date" (§3.5) work for
-- guests too. The audio itself stays gated by the entitlement checks below.
create policy "Club months are publicly readable" on club_months for select to anon, authenticated using (true);
create policy "Hosts can insert club months" on club_months for insert to authenticated with check (is_host());
create policy "Hosts can update club months" on club_months for update to authenticated using (is_host()) with check (is_host());
create policy "Hosts can delete club months" on club_months for delete to authenticated using (is_host());

create policy "Club release schedules are publicly readable" on club_releases for select to anon, authenticated using (true);
create policy "Hosts can insert club releases" on club_releases for insert to authenticated with check (is_host());
create policy "Hosts can update club releases" on club_releases for update to authenticated using (is_host()) with check (is_host());
create policy "Hosts can delete club releases" on club_releases for delete to authenticated using (is_host());

-- Chat/Q&A read access is keyed off a club_month entitlement, not an
-- active subscription -- that's what makes "every month paid for stays
-- accessible after cancellation" (SPEC.md §3.4) true: the entitlement row
-- from that month's payment never goes away even if the subscription
-- later lapses.
create policy "Club members can read that month's chat" on chat_messages
  for select to authenticated
  using (
    is_host()
    or exists (
      select 1 from entitlements
      where entitlements.user_id = auth.uid()
        and entitlements.kind = 'club_month'
        and entitlements.ref_id = chat_messages.club_month_id
    )
  );

-- Writing new messages is further restricted to the *current* month --
-- owning last month's entitlement lets you read its history, not post into
-- a month that's already closed.
create policy "Club members can post in the current month's chat" on chat_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from club_months
      where club_months.id = chat_messages.club_month_id
        and club_months.month = date_trunc('month', now())::date
    )
    and exists (
      select 1 from entitlements
      where entitlements.user_id = auth.uid()
        and entitlements.kind = 'club_month'
        and entitlements.ref_id = chat_messages.club_month_id
    )
  );

create policy "Hosts can moderate chat messages" on chat_messages for update to authenticated using (is_host()) with check (is_host());

create policy "Club members can read published or their own questions" on questions
  for select to authenticated
  using (
    is_host()
    or (
      exists (
        select 1 from entitlements
        where entitlements.user_id = auth.uid()
          and entitlements.kind = 'club_month'
          and entitlements.ref_id = questions.club_month_id
      )
      and (published = true or user_id = auth.uid())
    )
  );

create policy "Club members can ask questions in the current month" on questions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from club_months
      where club_months.id = questions.club_month_id
        and club_months.month = date_trunc('month', now())::date
    )
    and exists (
      select 1 from entitlements
      where entitlements.user_id = auth.uid()
        and entitlements.kind = 'club_month'
        and entitlements.ref_id = questions.club_month_id
    )
  );

create policy "Hosts can answer questions" on questions for update to authenticated using (is_host()) with check (is_host());

create policy "Users can read their own blocks" on blocks for select to authenticated using (user_id = auth.uid());
create policy "Users can create their own blocks" on blocks for insert to authenticated with check (user_id = auth.uid());
create policy "Users can remove their own blocks" on blocks for delete to authenticated using (user_id = auth.uid());

create policy "Reporters and hosts can read reports" on reports for select to authenticated using (reporter_id = auth.uid() or is_host());
create policy "Users can file a report" on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "Hosts can update report status" on reports for update to authenticated using (is_host()) with check (is_host());

create policy "Users can manage their own push tokens" on push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No select policy for anyone else -- the notify-club-releases Edge
-- Function and the Q&A-answer notification both read tokens via the
-- service role, same as every other privileged write in this app.

alter publication supabase_realtime add table chat_messages;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Episode-release push notifications (SPEC.md §3.5). Access-gating for
-- club episodes is a live `release_at <= now()` check wherever access is
-- checked (see hasClubEpisodeAccess in packages/shared and the duplicate
-- in get-audio-url) -- no cron needed for that, same as how
-- titles.published_at already works. But a *notification* genuinely needs
-- an active trigger (nobody is "reading" at the exact moment a threshold
-- is crossed), so this is the one place that does need a scheduled job.
--
-- Calls Expo's push API directly via pg_net rather than round-tripping
-- through a Supabase Edge Function: Expo's endpoint needs no auth header,
-- so going straight there avoids having to get a service-role JWT past
-- Kong from inside a cron job (which would mean storing that secret
-- somewhere a committed migration can reach -- not worth it for what's
-- otherwise a 10-line HTTP call).
create or replace function public.notify_club_releases()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  due record;
  recipient record;
begin
  for due in
    select cr.episode_id, cr.club_month_id, e.name as episode_name, t.title as title_name
    from club_releases cr
    join episodes e on e.id = cr.episode_id
    join club_months cm on cm.id = cr.club_month_id
    join titles t on t.id = cm.title_id
    where cr.notified_at is null and cr.release_at <= now()
  loop
    for recipient in
      select distinct pt.token
      from push_tokens pt
      join entitlements ent
        on ent.user_id = pt.user_id
        and ent.kind = 'club_month'
        and ent.ref_id = due.club_month_id
    loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', recipient.token,
          'title', due.title_name,
          'body', 'New episode: ' || due.episode_name
        )
      );
    end loop;

    update club_releases set notified_at = now() where episode_id = due.episode_id and club_month_id = due.club_month_id;
  end loop;
end;
$$;

select cron.schedule('notify-club-releases', '*/5 * * * *', 'select public.notify_club_releases()');
