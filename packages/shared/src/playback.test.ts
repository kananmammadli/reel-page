import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import {
  getContinueListening,
  getPlaybackPosition,
  getPlaybackPositionsForTitle,
  upsertPlaybackPosition,
} from "./playback";
import { mockSupabaseClient } from "./test/mock-supabase";

type Client = SupabaseClient<Database>;

describe("upsertPlaybackPosition", () => {
  it("floors fractional seconds and throws on error", async () => {
    const client = mockSupabaseClient({ playback_positions: { data: null, error: null } });
    await upsertPlaybackPosition(client as unknown as Client, "u1", "e1", 12.8);
    expect(client.from).toHaveBeenCalledWith("playback_positions");

    const failing = mockSupabaseClient({ playback_positions: { data: null, error: new Error("db down") } });
    await expect(upsertPlaybackPosition(failing as unknown as Client, "u1", "e1", 1)).rejects.toThrow("db down");
  });
});

describe("getPlaybackPosition", () => {
  it("returns null when there's no saved position", async () => {
    const client = mockSupabaseClient({ playback_positions: { data: null, error: null } });
    const result = await getPlaybackPosition(client as unknown as Client, "e1");
    expect(result).toBeNull();
  });

  it("returns the saved position", async () => {
    const client = mockSupabaseClient({ playback_positions: { data: { position_s: 123 }, error: null } });
    const result = await getPlaybackPosition(client as unknown as Client, "e1");
    expect(result).toBe(123);
  });
});

describe("getPlaybackPositionsForTitle", () => {
  it("returns an empty object without querying for an empty id list", async () => {
    const client = mockSupabaseClient({});
    const result = await getPlaybackPositionsForTitle(client as unknown as Client, []);
    expect(result).toEqual({});
    expect(client.from).not.toHaveBeenCalled();
  });

  it("maps rows into an episode_id -> position_s record", async () => {
    const client = mockSupabaseClient({
      playback_positions: {
        data: [
          { episode_id: "e1", position_s: 10 },
          { episode_id: "e2", position_s: 20 },
        ],
        error: null,
      },
    });
    const result = await getPlaybackPositionsForTitle(client as unknown as Client, ["e1", "e2"]);
    expect(result).toEqual({ e1: 10, e2: 20 });
  });
});

describe("getContinueListening", () => {
  it("maps joined rows into ContinueListeningItem and drops orphaned rows", async () => {
    const title = { id: "t1", title: "Nosferatu" };
    const episode = { id: "e1", name: "Ep 1", transcript: [{ text: "hi", start_s: 0, end_s: 1 }], titles: title };
    const client = mockSupabaseClient({
      playback_positions: {
        data: [
          { position_s: 42, updated_at: "2026-01-01", episodes: episode },
          { position_s: 1, updated_at: "2026-01-02", episodes: null },
        ],
        error: null,
      },
    });

    const result = await getContinueListening(client as unknown as Client);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ positionS: 42, updatedAt: "2026-01-01" });
    expect(result[0]?.title).toEqual(title);
    expect(result[0]?.episode.transcript).toEqual(episode.transcript);
  });

  it("throws when the query errors", async () => {
    const client = mockSupabaseClient({ playback_positions: { data: null, error: new Error("boom") } });
    await expect(getContinueListening(client as unknown as Client)).rejects.toThrow("boom");
  });
});
