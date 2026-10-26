import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@reel-and-page/shared";

// For Server Components and Route Handlers. Server Components can't write
// cookies, so the setAll call there is wrapped in a no-op catch -- session
// refresh in that case is handled by middleware.ts instead.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component -- safe to ignore, middleware.ts refreshes sessions.
          }
        },
      },
    },
  );
}
