-- RLS test for the admin panel (milestone 5 tasks.md §9, CLAUDE.md working
-- rules): a host can manage the catalog and see every user's payments; a
-- non-host authenticated user is rejected the same way anon already is
-- (see catalog_rls.sql), and no client role -- not even a host -- can
-- write payments directly. Only the service role (webhook Edge Functions)
-- may write payments, same as entitlements/subscriptions.
begin;
create extension if not exists pgtap;

select plan(11);

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'host@example.com'),
  ('f0000000-0000-0000-0000-000000000002', 'listener@example.com');

update profiles set role = 'host' where id = 'f0000000-0000-0000-0000-000000000001';

insert into titles (id, type, title, creator, is_free, published_at)
values ('f0000000-0000-0000-0000-000000000010', 'film', 'Draft For Admin Test', 'Someone', false, null);

insert into entitlements (user_id, kind, ref_id, source, external_id)
values ('f0000000-0000-0000-0000-000000000002', 'title', 'f0000000-0000-0000-0000-000000000010', 'stripe', 'ext_1');

set local role authenticated;
set local request.jwt.claims to '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from titles where id = 'f0000000-0000-0000-0000-000000000010' $$,
  $$ values (1) $$,
  'a host can read an unpublished/draft title'
);

select lives_ok(
  $$ insert into titles (id, type, title, creator, is_free) values ('f0000000-0000-0000-0000-000000000011', 'film', 'Host Created Title', 'Someone', false) $$,
  'a host can insert a title'
);

select lives_ok(
  $$ update titles set description = 'updated by host' where id = 'f0000000-0000-0000-0000-000000000011' $$,
  'a host can update a title'
);

select lives_ok(
  $$ insert into episodes (id, title_id, position, name, duration_s, audio_path) values ('f0000000-0000-0000-0000-000000000012', 'f0000000-0000-0000-0000-000000000011', 1, 'Ep 1', 60, 'x') $$,
  'a host can insert an episode'
);

select results_eq(
  $$ select count(*)::int from entitlements where user_id = 'f0000000-0000-0000-0000-000000000002' $$,
  $$ values (1) $$,
  'a host can read another user''s entitlement'
);

select throws_ok(
  $$ insert into payments (user_id, kind, ref_id, source, external_id, amount_cents, currency) values ('f0000000-0000-0000-0000-000000000002', 'title', 'f0000000-0000-0000-0000-000000000011', 'stripe', 'pay_host_attempt', 500, 'usd') $$,
  'new row violates row-level security policy for table "payments"',
  'a host cannot insert a payment directly -- only the service role (webhooks) can'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from titles where id = 'f0000000-0000-0000-0000-000000000010' $$,
  $$ values (0) $$,
  'a non-host cannot read an unpublished/draft title'
);

select throws_ok(
  $$ insert into titles (id, type, title, creator, is_free) values ('f0000000-0000-0000-0000-000000000013', 'film', 'Listener Attempt', 'Someone', false) $$,
  'new row violates row-level security policy for table "titles"',
  'a non-host cannot insert a title'
);

select throws_ok(
  $$ insert into episodes (id, title_id, position, name, duration_s, audio_path) values ('f0000000-0000-0000-0000-000000000014', 'f0000000-0000-0000-0000-000000000011', 2, 'Ep 2', 60, 'x') $$,
  'new row violates row-level security policy for table "episodes"',
  'a non-host cannot insert an episode'
);

select throws_ok(
  $$ insert into payments (user_id, kind, ref_id, source, external_id, amount_cents, currency) values ('f0000000-0000-0000-0000-000000000002', 'title', 'f0000000-0000-0000-0000-000000000011', 'stripe', 'pay_listener_attempt', 500, 'usd') $$,
  'new row violates row-level security policy for table "payments"',
  'a non-host cannot insert a payment'
);

select results_eq(
  $$ select count(*)::int from payments $$,
  $$ values (0) $$,
  'a non-host cannot read any payments'
);

select * from finish();
rollback;
