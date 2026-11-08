#!/bin/sh
# Run this once after every local `supabase db reset`/`supabase start`,
# same as `pnpm seed:audio` -- the Supabase CLI's local dev convenience
# re-exposes new public-schema functions to PUBLIC after migrations
# apply, which silently undoes the EXECUTE revoke in
# supabase/migrations/20261108120000_security_review.sql for local dev
# specifically (a real deployment via `supabase db push` has no such
# step, so the migration alone is correct there). See that migration's
# comment for how this was found and confirmed.
set -e
docker exec -i supabase_db_reel-page psql -U postgres -d postgres -c \
  "revoke execute on function public.notify_club_releases() from public;"
