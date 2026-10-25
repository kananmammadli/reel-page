import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getEpisodes, getHomeRails, getTitle, searchTitles } from "./catalog";
import { mockSupabaseClient } from "./test/mock-supabase";

type Client = SupabaseClient<Database>;

describe("getEpisodes", () => {
  it("defaults a null transcript to an empty array", async () => {
    const client = mockSupabaseClient({
      episodes: {
        data: [
          { id: "e1", title_id: "t1", position: 1, name: "Ep 1", duration_s: 60, audio_path: "a", preview_path: "p", transcript: null, created_at: "now" },
        ],
        error: null,
      },
    });

    const episodes = await getEpisodes(client as unknown as Client, "t1");
    expect(episodes[0]?.transcript).toEqual([]);
  });

  it("passes through a populated transcript", async () => {
    const transcript = [{ text: "hello", start_s: 0, end_s: 5 }];
    const client = mockSupabaseClient({
      episodes: {
        data: [
          { id: "e1", title_id: "t1", position: 1, name: "Ep 1", duration_s: 60, audio_path: "a", preview_path: "p", transcript, created_at: "now" },
        ],
        error: null,
      },
    });

    const episodes = await getEpisodes(client as unknown as Client, "t1");
    expect(episodes[0]?.transcript).toEqual(transcript);
  });

  it("throws when the query errors", async () => {
    const client = mockSupabaseClient({
      episodes: { data: null, error: new Error("boom") },
    });

    await expect(getEpisodes(client as unknown as Client, "t1")).rejects.toThrow("boom");
  });
});

describe("getTitle", () => {
  it("returns null when no row matches", async () => {
    const client = mockSupabaseClient({ titles: { data: null, error: null } });
    const title = await getTitle(client as unknown as Client, "missing");
    expect(title).toBeNull();
  });
});

describe("searchTitles", () => {
  it("returns the rows from the query", async () => {
    const rows = [{ id: "t1", title: "Casablanca" }];
    const client = mockSupabaseClient({ titles: { data: rows, error: null } });
    const result = await searchTitles(client as unknown as Client, "casa", "all");
    expect(result).toEqual(rows);
  });

  it("throws when the query errors", async () => {
    const client = mockSupabaseClient({ titles: { data: null, error: new Error("db down") } });
    await expect(searchTitles(client as unknown as Client, "", "all")).rejects.toThrow("db down");
  });
});

describe("getHomeRails", () => {
  it("throws if any of the three parallel queries fails", async () => {
    const client = mockSupabaseClient({
      titles: { data: [], error: null },
      collections: { data: null, error: new Error("collections down") },
    });

    await expect(getHomeRails(client as unknown as Client)).rejects.toThrow("collections down");
  });
});
