import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { hasAccess } from "./entitlements";
import { fakeQuery, mockSupabaseClient, type QueryResult } from "./test/mock-supabase";

type Client = SupabaseClient<Database>;

// hasAccess calls .from("entitlements") twice on the collection-fallback
// path (direct check, then collection-based check) -- mockSupabaseClient
// only supports one fixed result per table, so this returns a different
// result on each successive call to the same table.
function mockClientWithSequentialResults(resultsByTable: Record<string, QueryResult[]>) {
  const callIndex: Record<string, number> = {};
  return {
    from(table: string) {
      const results = resultsByTable[table] ?? [];
      const index = Math.min(callIndex[table] ?? 0, results.length - 1);
      callIndex[table] = (callIndex[table] ?? 0) + 1;
      return fakeQuery(results[index] ?? { data: null, error: null });
    },
  };
}

describe("hasAccess", () => {
  it("returns true for a direct single-title entitlement", async () => {
    const client = mockSupabaseClient({
      entitlements: { data: { id: "ent1" }, error: null },
    });
    const result = await hasAccess(client as unknown as Client, "u1", { titleId: "t1" });
    expect(result).toBe(true);
  });

  it("returns true when the title is unlocked via an owned collection", async () => {
    const client = mockClientWithSequentialResults({
      entitlements: [
        { data: null, error: null }, // direct title check: no entitlement
        { data: { id: "ent2" }, error: null }, // collection-based check: owned
      ],
      collection_titles: [{ data: [{ collection_id: "c1" }], error: null }],
    });
    const result = await hasAccess(client as unknown as Client, "u1", { titleId: "t1" });
    expect(result).toBe(true);
  });

  it("returns false when there's no entitlement and no collection membership", async () => {
    const client = mockClientWithSequentialResults({
      entitlements: [{ data: null, error: null }],
      collection_titles: [{ data: [], error: null }],
    });
    const result = await hasAccess(client as unknown as Client, "u1", { titleId: "t1" });
    expect(result).toBe(false);
  });

  it("returns false when the title has collection memberships but none are owned", async () => {
    const client = mockClientWithSequentialResults({
      entitlements: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      collection_titles: [{ data: [{ collection_id: "c1" }], error: null }],
    });
    const result = await hasAccess(client as unknown as Client, "u1", { titleId: "t1" });
    expect(result).toBe(false);
  });

  it("returns true for a direct collection entitlement", async () => {
    const client = mockSupabaseClient({
      entitlements: { data: { id: "ent1" }, error: null },
    });
    const result = await hasAccess(client as unknown as Client, "u1", { collectionId: "c1" });
    expect(result).toBe(true);
  });

  it("returns false for a collection with no entitlement (no fallback check)", async () => {
    const client = mockSupabaseClient({
      entitlements: { data: null, error: null },
    });
    const result = await hasAccess(client as unknown as Client, "u1", { collectionId: "c1" });
    expect(result).toBe(false);
  });

  it("throws when the entitlements query errors", async () => {
    const client = mockSupabaseClient({
      entitlements: { data: null, error: new Error("db down") },
    });
    await expect(hasAccess(client as unknown as Client, "u1", { titleId: "t1" })).rejects.toThrow("db down");
  });
});
