import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

export async function registerPushToken(client: Client, userId: string, token: string): Promise<void> {
  const { error } = await client.from("push_tokens").upsert({ user_id: userId, token });
  if (error) throw error;
}

export async function unregisterPushToken(client: Client, userId: string, token: string): Promise<void> {
  const { error } = await client.from("push_tokens").delete().eq("user_id", userId).eq("token", token);
  if (error) throw error;
}
