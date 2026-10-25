-- RLS test for the catalog tables (milestone 2 tasks.md §2.5).
-- Confirms anon can read published titles/episodes and cannot read
-- unpublished ones.
begin;
create extension if not exists pgtap;

select plan(4);

insert into titles (id, type, title, creator, is_free, published_at)
values
  ('11111111-1111-1111-1111-111111111111', 'film', 'Published Title', 'Someone', false, now()),
  ('22222222-2222-2222-2222-222222222222', 'film', 'Draft Title', 'Someone', false, null);

insert into episodes (id, title_id, position, name, duration_s, audio_path)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 1, 'Published Episode', 60, 'x'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 1, 'Draft Episode', 60, 'x');

set local role anon;

select results_eq(
  $$ select count(*)::int from titles where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values (1) $$,
  'anon can see a published title'
);

select results_eq(
  $$ select count(*)::int from titles where id = '22222222-2222-2222-2222-222222222222' $$,
  $$ values (0) $$,
  'anon cannot see an unpublished title'
);

select results_eq(
  $$ select count(*)::int from episodes where id = '33333333-3333-3333-3333-333333333333' $$,
  $$ values (1) $$,
  'anon can see an episode of a published title'
);

select results_eq(
  $$ select count(*)::int from episodes where id = '44444444-4444-4444-4444-444444444444' $$,
  $$ values (0) $$,
  'anon cannot see an episode of an unpublished title'
);

select * from finish();
rollback;
