import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import type { Episode, Title, TranscriptEntry } from "./catalog";

type Client = SupabaseClient<Database>;

export type Quote = Tables<"quotes">;
export type ListeningDay = Tables<"listening_days">;
export type ReflectionSettings = Tables<"reflection_settings">;
export type Reflection = Tables<"reflections">;

export type QuoteWithContext = Quote & { episode: Episode; title: Title };

// Pure: which transcript line was playing at the moment the pen button
// was tapped. Returns null if nothing matches (e.g. the episode has no
// transcript, or playback is between lines) -- the caller decides what
// to do with that (currently: disable the button).
export function getActiveTranscriptEntry(transcript: TranscriptEntry[], atS: number): TranscriptEntry | null {
  return transcript.find((entry) => atS >= entry.start_s && atS < entry.end_s) ?? null;
}

export async function saveQuote(client: Client, input: { userId: string; episodeId: string; text: string; atS: number }): Promise<void> {
  const { error } = await client.from("quotes").insert({ user_id: input.userId, episode_id: input.episodeId, text: input.text, at_s: Math.floor(input.atS) });
  if (error) throw error;
}

export async function deleteQuote(client: Client, id: string): Promise<void> {
  const { error } = await client.from("quotes").delete().eq("id", id);
  if (error) throw error;
}

// Feed needs enough to show "<title> · <episode>" and to jump back into
// playback -- episodes already carries title_id, but the feed renders a
// poster/title too, so this joins both in one round trip.
export async function getQuotes(client: Client, userId: string): Promise<QuoteWithContext[]> {
  const { data, error } = await client
    .from("quotes")
    .select("*, episode:episodes(*, title:titles(*))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = Quote & { episode: Tables<"episodes"> & { title: Title } };
  return (data as unknown as Row[]).map(({ episode, ...quote }) => {
    const { title, ...episodeFields } = episode;
    return {
      ...quote,
      episode: { ...episodeFields, transcript: (episodeFields.transcript as unknown as TranscriptEntry[] | null) ?? [] },
      title,
    };
  });
}

export async function addListeningSeconds(client: Client, day: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const { error } = await client.rpc("increment_listening_seconds", { p_day: day, p_seconds: Math.floor(seconds) });
  if (error) throw error;
}

export async function getListeningDays(client: Client, userId: string, sinceDay?: string): Promise<ListeningDay[]> {
  let query = client.from("listening_days").select("*").eq("user_id", userId);
  if (sinceDay) query = query.gte("day", sinceDay);
  const { data, error } = await query.order("day", { ascending: false });
  if (error) throw error;
  return data;
}

export type JournalStats = { quotesSaved: number; totalMinutes: number; streakDays: number };

// Pure: streak counts consecutive days with seconds > 0, walking back
// from today (or from yesterday if today hasn't been logged yet -- still
// on an active streak until a full day is missed, not the instant the
// clock rolls over).
export function computeJournalStats(quotesCount: number, listeningDays: Pick<ListeningDay, "day" | "seconds">[], now: Date = new Date()): JournalStats {
  const secondsByDay = new Map(listeningDays.map((d) => [d.day, d.seconds]));
  const totalMinutes = Math.round(listeningDays.reduce((sum, d) => sum + d.seconds, 0) / 60);

  let streakDays = 0;
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!secondsByDay.get(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const seconds = secondsByDay.get(key);
    if (!seconds || seconds <= 0) break;
    streakDays++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { quotesSaved: quotesCount, totalMinutes, streakDays };
}

export async function getReflectionSettings(client: Client, userId: string): Promise<ReflectionSettings | null> {
  const { data, error } = await client.from("reflection_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setReflectionEnabled(client: Client, userId: string, enabled: boolean): Promise<void> {
  const { error } = await client
    .from("reflection_settings")
    .upsert({ user_id: userId, enabled, consented_at: enabled ? new Date().toISOString() : null });
  if (error) throw error;

  // "Turn off and delete data" (SPEC.md §3.6) means an actual DELETE, not
  // just flipping this flag -- do it in the same call so there's no
  // window where the toggle is off but the data still exists.
  if (!enabled) {
    const { error: deleteError } = await client.from("reflections").delete().eq("user_id", userId);
    if (deleteError) throw deleteError;
  }
}

export async function getReflections(client: Client, userId: string): Promise<Reflection[]> {
  const { data, error } = await client.from("reflections").select("*").eq("user_id", userId).order("week_start", { ascending: false });
  if (error) throw error;
  return data;
}
