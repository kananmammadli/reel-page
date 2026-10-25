import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AudioVariant = "preview" | "full";

export class AudioAccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getAudioUrl(
  client: SupabaseClient<Database>,
  episodeId: string,
  variant: AudioVariant,
): Promise<string> {
  const { data, error } = await client.functions.invoke<{ url?: string; error?: string }>(
    "get-audio-url",
    { body: { episodeId, variant } },
  );

  if (error || !data?.url) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status ?? 500;
    throw new AudioAccessError(status, data?.error ?? error?.message ?? "Could not load audio");
  }

  return data.url;
}
