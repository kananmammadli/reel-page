-- RLS test for the club (milestone 6 tasks.md §7, CLAUDE.md working
-- rules): club_months/club_releases are public metadata; chat/Q&A are
-- readable by anyone holding that month's club_month entitlement (which
-- survives cancellation) but writable only into the *current* month;
-- blocks/push_tokens are owner-only; reports are reporter+host; and hosts
-- moderate everything. Also covers the self-promotion fix this milestone
-- found: no authenticated user, host included, should be able to write
-- profiles.role or profiles.suspended_at through their own session.
begin;
create extension if not exists pgtap;

select plan(29);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'host@example.com'),
  ('a0000000-0000-0000-0000-000000000002', 'member-a@example.com'),
  ('a0000000-0000-0000-0000-000000000003', 'member-b@example.com'),
  ('a0000000-0000-0000-0000-000000000004', 'outsider@example.com'),
  ('a0000000-0000-0000-0000-000000000005', 'suspended-member@example.com');

update profiles set role = 'host' where id = 'a0000000-0000-0000-0000-000000000001';
update profiles set suspended_at = now() where id = 'a0000000-0000-0000-0000-000000000005';

insert into titles (id, type, title, creator, is_free, published_at) values
  ('a0000000-0000-0000-0000-000000000010', 'film', 'Club Title', 'Someone', false, now());

insert into club_months (id, month, title_id) values
  ('a0000000-0000-0000-0000-000000000020', date_trunc('month', now())::date, 'a0000000-0000-0000-0000-000000000010'),
  ('a0000000-0000-0000-0000-000000000021', (date_trunc('month', now()) - interval '1 month')::date, 'a0000000-0000-0000-0000-000000000010');

-- Member A holds both months' entitlements (current + a past one still
-- accessible after "cancellation"); member B holds only the current
-- month; the outsider holds none.
insert into entitlements (user_id, kind, ref_id, source, external_id) values
  ('a0000000-0000-0000-0000-000000000002', 'club_month', 'a0000000-0000-0000-0000-000000000020', 'stripe', 'ext_a_current'),
  ('a0000000-0000-0000-0000-000000000002', 'club_month', 'a0000000-0000-0000-0000-000000000021', 'stripe', 'ext_a_past'),
  ('a0000000-0000-0000-0000-000000000003', 'club_month', 'a0000000-0000-0000-0000-000000000020', 'stripe', 'ext_b_current'),
  ('a0000000-0000-0000-0000-000000000005', 'club_month', 'a0000000-0000-0000-0000-000000000020', 'stripe', 'ext_suspended_current');

insert into chat_messages (id, club_month_id, user_id, body) values
  ('a0000000-0000-0000-0000-000000000030', 'a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000002', 'hi from A');

insert into questions (id, club_month_id, user_id, body, published) values
  ('a0000000-0000-0000-0000-000000000040', 'a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000002', 'published Q from A', true),
  ('a0000000-0000-0000-0000-000000000041', 'a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'unpublished Q from B', false);

-- 1. Self-promotion fix: a plain authenticated user cannot write role or
-- suspended_at through their own session, even on their own row.
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select throws_like(
  $$ update profiles set role = 'host' where id = 'a0000000-0000-0000-0000-000000000004' $$,
  '%permission denied%',
  'a non-host cannot self-promote by writing profiles.role'
);

select throws_like(
  $$ update profiles set suspended_at = now() where id = 'a0000000-0000-0000-0000-000000000004' $$,
  '%permission denied%',
  'a user cannot un-suspend themselves by writing profiles.suspended_at'
);

select results_eq(
  $$ select count(*)::int from profiles where id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values (1) $$,
  'any authenticated user can read another user''s display name/role (needed to render chat)'
);

-- 2. club_months / club_releases: public metadata.
select results_eq(
  $$ select count(*)::int from club_months where id = 'a0000000-0000-0000-0000-000000000020' $$,
  $$ values (1) $$,
  'any authenticated user can read club_months (public scheduling metadata)'
);

select throws_ok(
  $$ insert into club_months (month, title_id) values ('2099-01-01', 'a0000000-0000-0000-0000-000000000010') $$,
  'new row violates row-level security policy for table "club_months"',
  'a non-host cannot create a club month'
);

-- 3. chat_messages: readable via the entitlement (even a past, no-longer-
-- current month); not readable without one; writable only into the
-- current month, and only by someone holding its entitlement.
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from chat_messages where id = 'a0000000-0000-0000-0000-000000000030' $$,
  $$ values (1) $$,
  'a club member can read the current month''s chat'
);

select lives_ok(
  $$ insert into chat_messages (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000002', 'another message') $$,
  'a club member can post into the current month''s chat'
);

select throws_ok(
  $$ insert into chat_messages (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000002', 'late reply') $$,
  'new row violates row-level security policy for table "chat_messages"',
  'a club member cannot post into a past, no-longer-current month''s chat'
);

select throws_ok(
  $$ insert into chat_messages (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'impersonating') $$,
  'new row violates row-level security policy for table "chat_messages"',
  'a club member cannot post a chat message as another user'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000004","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from chat_messages where id = 'a0000000-0000-0000-0000-000000000030' $$,
  $$ values (0) $$,
  'a non-member cannot read the club chat'
);

select throws_ok(
  $$ insert into chat_messages (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000004', 'gatecrash') $$,
  'new row violates row-level security policy for table "chat_messages"',
  'a non-member cannot post in the club chat'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000005","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from chat_messages where id = 'a0000000-0000-0000-0000-000000000030' $$,
  $$ values (1) $$,
  'a suspended member can still read the chat they already had access to'
);

select throws_ok(
  $$ insert into chat_messages (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000005', 'should not land') $$,
  'new row violates row-level security policy for table "chat_messages"',
  'a suspended member cannot post a new chat message'
);

select throws_ok(
  $$ insert into questions (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000005', 'should not land') $$,
  'new row violates row-level security policy for table "questions"',
  'a suspended member cannot ask a new question'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ update chat_messages set pinned = true where id = 'a0000000-0000-0000-0000-000000000030' $$,
  'a host can pin a chat message'
);

-- 4. questions: a member sees published questions from anyone, their own
-- regardless of publish state, but not someone else's unpublished one.
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from questions where id = 'a0000000-0000-0000-0000-000000000040' $$,
  $$ values (1) $$,
  'a club member can read another member''s published question'
);

select results_eq(
  $$ select count(*)::int from questions where id = 'a0000000-0000-0000-0000-000000000041' $$,
  $$ values (0) $$,
  'a club member cannot read another member''s unpublished question'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from questions where id = 'a0000000-0000-0000-0000-000000000041' $$,
  $$ values (1) $$,
  'a member can read their own unpublished question'
);

select lives_ok(
  $$ insert into questions (club_month_id, user_id, body) values ('a0000000-0000-0000-0000-000000000020', 'a0000000-0000-0000-0000-000000000003', 'another question') $$,
  'a club member can ask a question in the current month'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from questions where id = 'a0000000-0000-0000-0000-000000000041' $$,
  $$ values (1) $$,
  'a host can read every question, published or not'
);

select lives_ok(
  $$ update questions set answer = 'the answer', answered_at = now(), published = true where id = 'a0000000-0000-0000-0000-000000000041' $$,
  'a host can answer a question'
);

-- 5. blocks: strictly owner-only.
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into blocks (user_id, blocked_user_id) values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003') $$,
  'a user can block another user'
);

select throws_ok(
  $$ insert into blocks (user_id, blocked_user_id) values ('a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002') $$,
  'new row violates row-level security policy for table "blocks"',
  'a user cannot create a block row on another user''s behalf'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from blocks where user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  $$ values (0) $$,
  'a user cannot read another user''s block list'
);

-- 6. reports: reporter and host only.
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into reports (reporter_id, message_id, reason) values ('a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000030', 'spam') $$,
  'a user can file a report'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from reports where reporter_id = 'a0000000-0000-0000-0000-000000000002' $$,
  $$ values (0) $$,
  'a user cannot read a report filed by someone else'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from reports where reporter_id = 'a0000000-0000-0000-0000-000000000002' $$,
  $$ values (1) $$,
  'a host can read any report'
);

-- 7. push_tokens: strictly owner-only.
set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into push_tokens (user_id, token) values ('a0000000-0000-0000-0000-000000000002', 'ExponentPushToken[test]') $$,
  'a user can register their own push token'
);

set local request.jwt.claims to '{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from push_tokens where user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  $$ values (0) $$,
  'a user cannot read another user''s push tokens'
);

select * from finish();
rollback;
