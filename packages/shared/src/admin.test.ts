import { describe, expect, it } from "vitest";
import { isHost, summarizePayments, type Payment } from "./admin";
import { mockSupabaseClient } from "./test/mock-supabase";

describe("isHost", () => {
  it("returns true for a host profile", async () => {
    const client = mockSupabaseClient({ profiles: { data: { role: "host" }, error: null } });
    expect(await isHost(client as never, "user-1")).toBe(true);
  });

  it("returns false for a non-host profile", async () => {
    const client = mockSupabaseClient({ profiles: { data: { role: "listener" }, error: null } });
    expect(await isHost(client as never, "user-1")).toBe(false);
  });

  it("returns false when the profile doesn't exist", async () => {
    const client = mockSupabaseClient({ profiles: { data: null, error: null } });
    expect(await isHost(client as never, "user-1")).toBe(false);
  });
});

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: "p1",
    user_id: "u1",
    kind: "title",
    ref_id: "title-1",
    source: "stripe",
    external_id: "ext-1",
    amount_cents: 500,
    currency: "usd",
    occurred_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

describe("summarizePayments", () => {
  const titles = [{ id: "title-1", title: "Casablanca" }];
  const collections = [{ id: "coll-1", name: "Silent masters" }];

  it("totals amounts per currency", () => {
    const summary = summarizePayments(
      [payment({ amount_cents: 500, currency: "usd" }), payment({ id: "p2", amount_cents: 300, currency: "usd" }), payment({ id: "p3", amount_cents: 1000, currency: "eur" })],
      titles,
      collections,
    );
    expect(summary.totals).toEqual(
      expect.arrayContaining([
        { currency: "usd", amountCents: 800, count: 2 },
        { currency: "eur", amountCents: 1000, count: 1 },
      ]),
    );
  });

  it("buckets by month", () => {
    const summary = summarizePayments(
      [payment({ occurred_at: "2026-10-15T00:00:00Z" }), payment({ id: "p2", occurred_at: "2026-11-02T00:00:00Z" })],
      titles,
      collections,
    );
    expect(summary.byMonth).toEqual(
      expect.arrayContaining([
        { currency: "usd", month: "2026-10", amountCents: 500, count: 1 },
        { currency: "usd", month: "2026-11", amountCents: 500, count: 1 },
      ]),
    );
  });

  it("attributes title purchases by name", () => {
    const summary = summarizePayments([payment({ kind: "title", ref_id: "title-1", amount_cents: 500 })], titles, collections);
    expect(summary.byTitle).toEqual([{ currency: "usd", id: "title-1", label: "Casablanca", amountCents: 500, count: 1 }]);
    expect(summary.byCollection).toEqual([]);
  });

  it("attributes collection purchases by name", () => {
    const summary = summarizePayments([payment({ kind: "collection", ref_id: "coll-1", amount_cents: 1200 })], titles, collections);
    expect(summary.byCollection).toEqual([{ currency: "usd", id: "coll-1", label: "Silent masters", amountCents: 1200, count: 1 }]);
  });

  it("falls back to a placeholder label for an unknown ref", () => {
    const summary = summarizePayments([payment({ kind: "title", ref_id: "missing-title" })], titles, collections);
    expect(summary.byTitle[0]!.label).toBe("Unknown title");
  });

  it("buckets club subscription payments separately, with no ref_id", () => {
    const summary = summarizePayments([payment({ kind: "club_month", ref_id: null, amount_cents: 999 })], titles, collections);
    expect(summary.club).toEqual([{ currency: "usd", amountCents: 999, count: 1 }]);
    expect(summary.byTitle).toEqual([]);
    expect(summary.byCollection).toEqual([]);
  });

  it("sorts byTitle and byCollection by amount descending", () => {
    const summary = summarizePayments(
      [payment({ id: "p1", kind: "title", ref_id: "title-1", amount_cents: 200 }), payment({ id: "p2", kind: "title", ref_id: "title-2", amount_cents: 900 })],
      [...titles, { id: "title-2", title: "Metropolis" }],
      collections,
    );
    expect(summary.byTitle.map((t) => t.label)).toEqual(["Metropolis", "Casablanca"]);
  });

  it("returns empty buckets for no payments", () => {
    const summary = summarizePayments([], titles, collections);
    expect(summary).toEqual({ totals: [], byMonth: [], byTitle: [], byCollection: [], club: [] });
  });
});
