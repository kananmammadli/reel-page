import { describe, expect, it } from "vitest";
import { trackEvent } from "./analytics";
import { mockSupabaseClient } from "./test/mock-supabase";

describe("trackEvent", () => {
  it("resolves on success", async () => {
    const client = mockSupabaseClient({ analytics_events: { data: null, error: null } });
    await expect(trackEvent(client as never, { eventType: "play", userId: "u1", titleId: "t1" })).resolves.toBeUndefined();
  });

  it("defaults userId/titleId/metadata to null when omitted", async () => {
    const client = mockSupabaseClient({ analytics_events: { data: null, error: null } });
    await trackEvent(client as never, { eventType: "preview_completed" });
    const builder = client.from.mock.results[0]!.value as { insert: (args: unknown) => unknown } & { insert: { mock: { calls: unknown[][] } } };
    expect(builder.insert.mock.calls[0]![0]).toEqual({ event_type: "preview_completed", user_id: null, title_id: null, metadata: null });
  });

  it("throws on a DB error", async () => {
    const client = mockSupabaseClient({ analytics_events: { data: null, error: new Error("nope") } });
    await expect(trackEvent(client as never, { eventType: "club_join", userId: "u1" })).rejects.toThrow("nope");
  });
});
