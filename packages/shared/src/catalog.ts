import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";

export type Title = Tables<"titles">;
export type Collection = Tables<"collections">;

export type TranscriptEntry = {
  text: string;
  start_s: number;
  end_s: number;
};

export type Episode = Omit<Tables<"episodes">, "transcript"> & {
  transcript: TranscriptEntry[];
};

export type CollectionWithTitles = Collection & { titles: Title[] };

type Client = SupabaseClient<Database>;

const EPISODE_COLUMNS =
  "id, title_id, position, name, duration_s, audio_path, preview_path, transcript, created_at";

function asEpisode(row: Tables<"episodes">): Episode {
  return { ...row, transcript: (row.transcript as unknown as TranscriptEntry[] | null) ?? [] };
}

export async function getCollections(client: Client): Promise<CollectionWithTitles[]> {
  const { data, error } = await client.from("collections").select("*, titles(*)");
  if (error) throw error;
  return data as unknown as CollectionWithTitles[];
}

export async function getHomeRails(client: Client) {
  const [freeToStart, recentlyAdded, collections] = await Promise.all([
    client.from("titles").select("*").eq("is_free", true).order("created_at", { ascending: false }),
    client.from("titles").select("*").eq("is_free", false).order("created_at", { ascending: false }),
    getCollections(client),
  ]);

  if (freeToStart.error) throw freeToStart.error;
  if (recentlyAdded.error) throw recentlyAdded.error;

  return {
    freeToStart: freeToStart.data,
    recentlyAdded: recentlyAdded.data,
    collections,
  };
}

export type CatalogFilter = "all" | "film" | "story" | "free";

export async function searchTitles(
  client: Client,
  query: string,
  filter: CatalogFilter = "all",
): Promise<Title[]> {
  let q = client.from("titles").select("*").order("title", { ascending: true });

  if (filter === "free") {
    q = q.eq("is_free", true);
  } else if (filter === "film" || filter === "story") {
    q = q.eq("type", filter);
  }

  if (query.trim()) {
    const term = `%${query.trim()}%`;
    q = q.or(`title.ilike.${term},creator.ilike.${term},genre.ilike.${term}`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getTitle(client: Client, titleId: string): Promise<Title | null> {
  const { data, error } = await client.from("titles").select("*").eq("id", titleId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEpisodes(client: Client, titleId: string): Promise<Episode[]> {
  const { data, error } = await client
    .from("episodes")
    .select(EPISODE_COLUMNS)
    .eq("title_id", titleId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data.map(asEpisode);
}

export async function getCollection(
  client: Client,
  collectionId: string,
): Promise<CollectionWithTitles | null> {
  const { data, error } = await client
    .from("collections")
    .select("*, titles(*)")
    .eq("id", collectionId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CollectionWithTitles | null;
}
