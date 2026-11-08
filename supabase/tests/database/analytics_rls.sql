-- RLS test for analytics_events (milestone 8 tasks.md §8, SPEC.md §5):
-- write-only from the client's perspective -- anyone can log their own
-- event (or an anonymous one), but only the host can read any of it back.
begin;
create extension if not exists pgtap;

select plan(6);

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'analytics-host@example.com'),
  ('c0000000-0000-0000-0000-000000000002', 'analytics-listener@example.com');

update profiles set role = 'host' where id = 'c0000000-0000-0000-0000-000000000001';

set local role anon;

select lives_ok(
  $$ insert into analytics_events (user_id, event_type) values (null, 'play') $$,
  'an anonymous caller can log an event with no user_id'
);

select throws_ok(
  $$ insert into analytics_events (user_id, event_type) values ('c0000000-0000-0000-0000-000000000002', 'play') $$,
  'new row violates row-level security policy for table "analytics_events"',
  'an anonymous caller cannot log an event claiming to be a specific user'
);

select results_eq(
  $$ select count(*)::int from analytics_events $$,
  $$ values (0) $$,
  'an anonymous caller cannot read any analytics events back'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select lives_ok(
  $$ insert into analytics_events (user_id, event_type) values ('c0000000-0000-0000-0000-000000000002', 'purchase') $$,
  'a signed-in user can log an event for themselves'
);

select throws_ok(
  $$ insert into analytics_events (user_id, event_type) values ('c0000000-0000-0000-0000-000000000001', 'purchase') $$,
  'new row violates row-level security policy for table "analytics_events"',
  'a signed-in user cannot log an event claiming to be someone else'
);

select results_eq(
  $$ select count(*)::int from analytics_events $$,
  $$ values (0) $$,
  'a non-host still cannot read analytics events back, even their own'
);

select * from finish();
rollback;
