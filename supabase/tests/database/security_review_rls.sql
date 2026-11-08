-- Regression test for a milestone 8 security review finding: Postgres's
-- default privileges made notify_club_releases() -- a SECURITY DEFINER
-- function with real side effects (sends push notifications, marks
-- releases as notified) -- directly executable by anon/authenticated,
-- reachable by anyone via PostgREST's RPC endpoint with no auth at all.
-- function_privs_are() checks the grant directly rather than relying on
-- a thrown error message, since EXECUTE privilege is checked before the
-- function body runs at all.
begin;
create extension if not exists pgtap;

select plan(3);

select function_privs_are('public', 'notify_club_releases', array[]::name[], 'anon', array[]::name[], 'anon has no privileges on notify_club_releases');
select function_privs_are('public', 'notify_club_releases', array[]::name[], 'authenticated', array[]::name[], 'authenticated has no privileges on notify_club_releases');
select function_privs_are('public', 'notify_club_releases', array[]::name[], 'postgres', array['EXECUTE']::name[], 'postgres (the pg_cron job owner) can still execute it');

select * from finish();
rollback;
