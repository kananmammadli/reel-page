-- 20261108140000_production_cron_url.sql was applied to this hosted
-- project with a real generated secret baked into the net.http_post
-- call, caught before it reached git. This migration brings the live
-- cron job in line with that file's committed (placeholder) content,
-- so the deployed state and the repo agree, and no real secret is
-- recoverable from migration history either.
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
