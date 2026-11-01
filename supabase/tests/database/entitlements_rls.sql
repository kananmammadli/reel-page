-- RLS test for entitlements/subscriptions (milestone 4 tasks.md §4,
-- CLAUDE.md working rules): a user can read only their own rows, and no
-- client role -- not even the row's own owner -- can write either table.
-- Only the service role (used exclusively inside webhook Edge Functions,
-- which bypasses RLS) may write.
begin;
create extension if not exists pgtap;

select plan(5);

insert into auth.users (id, email) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'carol@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dave@example.com');

with t as (
  insert into titles (id, type, title, creator, is_free, published_at)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'film', 'Entitlement Test Title', 'Someone', false, now())
  returning id
)
insert into entitlements (user_id, kind, ref_id, source, external_id)
select 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'title', t.id, 'stripe', 'cs_test_1' from t;

set local role authenticated;
set local request.jwt.claims to '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}';

select results_eq(
  $$ select count(*)::int from entitlements where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  $$ values (1) $$,
  'a user can read their own entitlement'
);

select results_eq(
  $$ select count(*)::int from entitlements where user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' $$,
  $$ values (0) $$,
  'a user cannot read another user''s entitlements'
);

select throws_ok(
  $$ insert into entitlements (user_id, kind, ref_id, source, external_id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'title', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'stripe', 'cs_fake') $$,
  'new row violates row-level security policy for table "entitlements"',
  'a user cannot grant themselves an entitlement'
);

-- No UPDATE policy exists (only SELECT), so RLS makes the row invisible to
-- UPDATE's row-selection -- the statement succeeds but matches zero rows,
-- rather than raising an error.
update entitlements set external_id = 'hacked' where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select results_eq(
  $$ select external_id from entitlements where user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  $$ values ('cs_test_1'::text) $$,
  'a user cannot modify an existing entitlement (update matches zero rows)'
);

select throws_ok(
  $$ insert into subscriptions (user_id, status, source, current_period_end, external_id) values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'active', 'stripe', now() + interval '30 days', 'sub_fake') $$,
  'new row violates row-level security policy for table "subscriptions"',
  'a user cannot grant themselves a subscription'
);

select * from finish();
rollback;
