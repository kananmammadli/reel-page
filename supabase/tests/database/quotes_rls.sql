-- RLS test for the quote journal (milestone 7 tasks.md §7): quotes,
-- listening_days, and reflection_settings are owner-only CRUD, same
-- pattern as playback_positions. reflections is owner read+delete only --
-- no client role, owner included, can write its content directly (only
-- the weekly-reflection Edge Function's service role can); "turn off and
-- delete data" (SPEC.md §3.6) relies on the owner-delete policy existing.
begin;
create extension if not exists pgtap;

select plan(14);

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'quotes-alice@example.com'),
  ('b0000000-0000-0000-0000-000000000002', 'quotes-bob@example.com');

insert into titles (id, type, title, creator, is_free, published_at) values
  ('b0000000-0000-0000-0000-000000000010', 'film', 'Quotes Test Title', 'Someone', true, now());

insert into episodes (id, title_id, position, name, duration_s, audio_path) values
  ('b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000010', 1, 'Ep 1', 600, 'x');

insert into quotes (id, user_id, episode_id, text, at_s) values
  ('b0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'alice''s quote', 42);

insert into reflections (id, user_id, week_start, quotes_count, total_minutes, main_theme) values
  ('b0000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000001', '2026-11-02', 3, 45, 'letting go');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from quotes where id = 'b0000000-0000-0000-0000-000000000020' $$,
  $$ values (1) $$,
  'a user can read their own quote'
);

select lives_ok(
  $$ insert into quotes (user_id, episode_id, text, at_s) values ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000011', 'another quote', 100) $$,
  'a user can save a new quote for themselves'
);

select lives_ok(
  $$ delete from quotes where id = 'b0000000-0000-0000-0000-000000000020' and user_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'a user can delete their own quote'
);

select lives_ok(
  $$ select increment_listening_seconds('2026-11-07'::date, 30) $$,
  'a user can call increment_listening_seconds for themselves'
);

select results_eq(
  $$ select seconds::int from listening_days where user_id = 'b0000000-0000-0000-0000-000000000001' and day = '2026-11-07' $$,
  $$ values (30) $$,
  'the increment wrote the right number of seconds'
);

select lives_ok(
  $$ select increment_listening_seconds('2026-11-07'::date, 15) $$,
  'calling it again for the same day does not error'
);

select results_eq(
  $$ select seconds::int from listening_days where user_id = 'b0000000-0000-0000-0000-000000000001' and day = '2026-11-07' $$,
  $$ values (45) $$,
  'a second call accumulates rather than overwriting'
);

select lives_ok(
  $$ insert into reflection_settings (user_id, enabled, consented_at) values ('b0000000-0000-0000-0000-000000000001', true, now()) $$,
  'a user can opt into reflection for themselves'
);

select results_eq(
  $$ select count(*)::int from reflections where id = 'b0000000-0000-0000-0000-000000000030' $$,
  $$ values (1) $$,
  'a user can read their own reflection'
);

select throws_ok(
  $$ insert into reflections (user_id, week_start, quotes_count, total_minutes) values ('b0000000-0000-0000-0000-000000000001', '2026-11-09', 1, 1) $$,
  'new row violates row-level security policy for table "reflections"',
  'a user cannot write a reflection directly -- only the service role can'
);

select lives_ok(
  $$ delete from reflections where id = 'b0000000-0000-0000-0000-000000000030' $$,
  'a user can delete their own reflection ("turn off and delete data")'
);

select is_empty(
  $$ select 1 from reflections where id = 'b0000000-0000-0000-0000-000000000030' $$,
  'confirmed: the delete actually removed the row, not just hid it'
);

set local request.jwt.claims to '{"sub":"b0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from quotes where user_id = 'b0000000-0000-0000-0000-000000000001' $$,
  $$ values (0) $$,
  'a different user cannot read another user''s quotes'
);

select results_eq(
  $$ select count(*)::int from listening_days where user_id = 'b0000000-0000-0000-0000-000000000001' $$,
  $$ values (0) $$,
  'a different user cannot read another user''s listening days'
);

select * from finish();
rollback;
