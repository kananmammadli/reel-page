-- The weekly-reflection cron job scheduled in 20261107150000_quotes.sql
-- calls `http://kong:8000/...`, the Docker-internal hostname for the
-- local dev stack's gateway -- unreachable from a hosted project's
-- Postgres. This repoints it at this project's real Edge Functions URL.
--
-- The header secret below is a placeholder, same category as the local
-- migration's "local-dev-cron-secret-change-in-production" -- it is
-- *not* meant to be a real secret and is intentionally committed. The
-- function currently no-ops without a real ANTHROPIC_API_KEY, so there
-- is nothing of value for this placeholder to protect yet. Before that
-- changes, rotate it for real: set a new value with
-- `supabase secrets set CRON_SECRET=<random>` and re-run this migration's
-- cron.schedule block with the matching header directly against the
-- database (not via a committed file, so the real value never reaches git).
select cron.unschedule('weekly-reflection');

select cron.schedule(
  'weekly-reflection',
  '0 9 * * 1', -- Monday 09:00 UTC
  $$
  select net.http_post(
    url := 'https://qdbunhvysrkqaazmwqnn.supabase.co/functions/v1/weekly-reflection',
    headers := '{"Content-Type":"application/json","X-Cron-Secret":"production-cron-secret-rotate-before-real-use"}'::jsonb
  );
  $$
);
