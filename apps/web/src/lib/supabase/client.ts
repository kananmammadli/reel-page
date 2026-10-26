import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@reel-and-page/shared";

// For Client Components. Reads/writes the session via document.cookie so it
// stays in sync with the server client below.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
