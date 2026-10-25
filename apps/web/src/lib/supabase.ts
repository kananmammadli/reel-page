import { createSupabaseClient } from "@reel-and-page/shared";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Public catalog data only (RLS allows anon reads of published rows) -- one
// client is fine for both server and browser until milestone 3 adds
// cookie-based auth sessions.
export const supabase = createSupabaseClient(url, anonKey);
