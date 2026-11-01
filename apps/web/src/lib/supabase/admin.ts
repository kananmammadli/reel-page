import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@reel-and-page/shared";

// Service-role client: bypasses RLS entirely. Only for the handful of
// writes that must bypass it on purpose -- profiles.role/suspended_at
// (no authenticated role can write these at all, see
// supabase/migrations/..._club.sql) and reading another user's push
// token to send a notification. Every caller must do its own host check
// first; this client has no authorization logic of its own.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
}
