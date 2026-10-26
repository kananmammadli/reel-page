import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

// Email one-time-code sign-in. Chosen over magic links so both platforms
// share the same flow (no deep-link/redirect-URL setup needed) -- see
// tasks.md milestone 3. Apple/Google sign-in come later, once real
// developer credentials exist (CLAUDE.md working rules).
export async function requestOtp(client: Client, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyOtp(client: Client, email: string, code: string): Promise<Session> {
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned after verifying the code");
  return data.session;
}

export async function signOut(client: Client): Promise<void> {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
