import { describe, expect, it } from "vitest";
import { addListeningSeconds, computeJournalStats, getActiveTranscriptEntry, saveQuote, setReflectionEnabled, type ListeningDay } from "./quotes";
import { mockSupabaseClient } from "./test/mock-supabase";
import type { TranscriptEntry } from "./catalog";

const transcript: TranscriptEntry[] = [
  { text: "line one", start_s: 0, end_s: 10 },
  { text: "line two", start_s: 10, end_s: 25 },
  { text: "line three", start_s: 30, end_s: 40 },
];

describe("getActiveTranscriptEntry", () => {
  it("finds the entry containing the timestamp", () => {
    expect(getActiveTranscriptEntry(transcript, 15)?.text).toBe("line two");
  });

  it("treats start_s as inclusive and end_s as exclusive", () => {
    expect(getActiveTranscriptEntry(transcript, 10)?.text).toBe("line two");
    expect(getActiveTranscriptEntry(transcript, 24.9)?.text).toBe("line two");
  });

  it("returns null in a gap between entries", () => {
    expect(getActiveTranscriptEntry(transcript, 27)).toBeNull();
  });

  it("returns null for an empty transcript", () => {
    expect(getActiveTranscriptEntry([], 5)).toBeNull();
  });
});

function day(offsetDays: number, seconds: number, from: Date): Pick<ListeningDay, "day" | "seconds"> {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return { day: d.toISOString().slice(0, 10), seconds };
}

describe("computeJournalStats", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("reports zero minutes and no streak with no listening history", () => {
    expect(computeJournalStats(3, [], now)).toEqual({ quotesSaved: 3, totalMinutes: 0, streakDays: 0 });
  });

  it("sums total minutes across all days, rounded", () => {
    const days = [day(0, 90, now), day(1, 30, now)];
    expect(computeJournalStats(0, days, now).totalMinutes).toBe(2); // 120s -> 2m
  });

  it("counts a streak that includes today", () => {
    const days = [day(0, 60, now), day(1, 60, now), day(2, 60, now)];
    expect(computeJournalStats(0, days, now).streakDays).toBe(3);
  });

  it("still counts yesterday's streak if today hasn't been logged yet", () => {
    const days = [day(1, 60, now), day(2, 60, now)];
    expect(computeJournalStats(0, days, now).streakDays).toBe(2);
  });

  it("stops the streak at a gap", () => {
    const days = [day(0, 60, now), day(1, 60, now), day(3, 60, now)]; // day(2) missing
    expect(computeJournalStats(0, days, now).streakDays).toBe(2);
  });

  it("a zero-second day breaks the streak same as a missing day", () => {
    const days = [day(0, 60, now), day(1, 0, now), day(2, 60, now)];
    expect(computeJournalStats(0, days, now).streakDays).toBe(1);
  });
});

describe("write helpers propagate errors", () => {
  it("saveQuote throws on a DB error", async () => {
    const client = mockSupabaseClient({ quotes: { data: null, error: new Error("nope") } });
    await expect(saveQuote(client as never, { userId: "u1", episodeId: "e1", text: "hi", atS: 5 })).rejects.toThrow("nope");
  });

  it("addListeningSeconds throws on an RPC error", async () => {
    const client = mockSupabaseClient({}, { increment_listening_seconds: { data: null, error: new Error("nope") } });
    await expect(addListeningSeconds(client as never, "2026-11-10", 30)).rejects.toThrow("nope");
  });

  it("addListeningSeconds skips the call entirely for zero/negative seconds", async () => {
    const client = mockSupabaseClient({});
    await addListeningSeconds(client as never, "2026-11-10", 0);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});

describe("setReflectionEnabled", () => {
  it("enabling upserts the setting with a consented_at timestamp, and does not touch reflections", async () => {
    const client = mockSupabaseClient({ reflection_settings: { data: null, error: null } });
    await setReflectionEnabled(client as never, "u1", true);
    expect(client.from).toHaveBeenCalledWith("reflection_settings");
    expect(client.from).not.toHaveBeenCalledWith("reflections");
  });

  it("disabling flips the setting off AND deletes the user's reflections in the same call", async () => {
    const client = mockSupabaseClient({
      reflection_settings: { data: null, error: null },
      reflections: { data: null, error: null },
    });
    await setReflectionEnabled(client as never, "u1", false);
    expect(client.from).toHaveBeenCalledWith("reflection_settings");
    expect(client.from).toHaveBeenCalledWith("reflections");
  });

  it("propagates an error from the delete step, not just the upsert step", async () => {
    const client = mockSupabaseClient({
      reflection_settings: { data: null, error: null },
      reflections: { data: null, error: new Error("delete failed") },
    });
    await expect(setReflectionEnabled(client as never, "u1", false)).rejects.toThrow("delete failed");
  });
});
