import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { type Episode, type Title } from "./catalog";

type Client = SupabaseClient<Database>;

export async function upsertPlaybackPosition(
  client: Client,
  userId: string,
  episodeId: string,
  positionS: number,
): Promise<void> {
  const { error } = await client
    .from("playback_positions")
    .upsert({ user_id: userId, episode_id: episodeId, position_s: Math.floor(positionS) });
  if (error) throw error;
}

export async function getPlaybackPosition(client: Client, episodeId: string): Promise<number | null> {
  const { data, error } = await client
    .from("playback_positions")
    .select("position_s")
    .eq("episode_id", episodeId)
    .maybeSingle();
  if (error) throw error;
  return data?.position_s ?? null;
}

export async function getPlaybackPositionsForTitle(
  client: Client,
  episodeIds: string[],
): Promise<Record<string, number>> {
  if (episodeIds.length === 0) return {};
  const { data, error } = await client
    .from("playback_positions")
    .select("episode_id, position_s")
    .in("episode_id", episodeIds);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.episode_id, row.position_s]));
}

export type ContinueListeningItem = {
  positionS: number;
  updatedAt: string;
  episode: Episode;
  title: Title;
};

export async function getContinueListening(client: Client, limit = 10): Promise<ContinueListeningItem[]> {
  const { data, error } = await client
    .from("playback_positions")
    .select("position_s, updated_at, episodes(*, titles(*))")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data as unknown as Array<{
    position_s: number;
    updated_at: string;
    episodes: (Omit<Episode, "transcript"> & { transcript: unknown; titles: Title }) | null;
  }>)
    .filter((row) => row.episodes !== null)
    .map((row) => {
      const { titles, transcript, ...episode } = row.episodes!;
      return {
        positionS: row.position_s,
        updatedAt: row.updated_at,
        episode: { ...episode, transcript: (transcript as Episode["transcript"] | null) ?? [] },
        title: titles,
      };
    });
}
