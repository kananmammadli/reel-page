-- RLS test for accounts (milestone 3 tasks.md §3): profiles and
-- playback_positions are owner-only -- a user can read/write their own row
-- and never another user's.
begin;
create extension if not exists pgtap;

select plan(6);

-- Two real auth users (the handle_new_user trigger creates their profiles).
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.com');

insert into playback_positions (user_id, episode_id, position_s)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id, 42 from episodes limit 1;

-- Act as Alice.
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from profiles where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (1) $$,
  'a user can see their own profile'
);

select results_eq(
  $$ select count(*)::int from profiles where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  $$ values (0) $$,
  'a user cannot see another user''s profile'
);

select results_eq(
  $$ select count(*)::int from playback_positions where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (1) $$,
  'a user can see their own playback position'
);

update playback_positions set position_s = 99 where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select results_eq(
  $$ select position_s::int from playback_positions where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  $$ values (99) $$,
  'a user can update their own playback position'
);

select throws_ok(
  $$ insert into playback_positions (user_id, episode_id, position_s) select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', id, 1 from episodes limit 1 $$,
  'new row violates row-level security policy for table "playback_positions"',
  'a user cannot write a playback position for another user'
);

select is_empty(
  $$ select 1 from playback_positions where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  'confirmed: no row was written for bob'
);

select * from finish();
rollback;
