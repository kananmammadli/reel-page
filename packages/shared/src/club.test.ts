import { describe, expect, it } from "vitest";
import {
  blockUser,
  getClubEpisodeAccess,
  getMyBlockedUserIds,
  hasClubMonthEntitlement,
  reportMessage,
  sendChatMessage,
  submitQuestion,
  type ClubRelease,
} from "./club";
import { mockSupabaseClient } from "./test/mock-supabase";

function release(overrides: Partial<ClubRelease> = {}): ClubRelease {
  return { club_month_id: "month-1", episode_id: "ep-1", release_at: "2026-11-05T00:00:00Z", notified_at: null, ...overrides };
}

describe("getClubEpisodeAccess", () => {
  const now = new Date("2026-11-10T00:00:00Z");

  it("is not-a-member when the episode has no club release at all", () => {
    expect(getClubEpisodeAccess(undefined, true, now)).toBe("not-a-member");
  });

  it("is not-released-yet when release_at is still in the future, even for an entitled member", () => {
    expect(getClubEpisodeAccess(release({ release_at: "2026-12-01T00:00:00Z" }), true, now)).toBe("not-released-yet");
  });

  it("is not-a-member when released but the caller holds no entitlement", () => {
    expect(getClubEpisodeAccess(release({ release_at: "2026-11-01T00:00:00Z" }), false, now)).toBe("not-a-member");
  });

  it("is full when released and the caller holds the club_month entitlement", () => {
    expect(getClubEpisodeAccess(release({ release_at: "2026-11-01T00:00:00Z" }), true, now)).toBe("full");
  });

  it("treats a release_at exactly at now as released", () => {
    expect(getClubEpisodeAccess(release({ release_at: now.toISOString() }), true, now)).toBe("full");
  });
});

describe("hasClubMonthEntitlement", () => {
  it("returns true when an entitlement row exists", async () => {
    const client = mockSupabaseClient({ entitlements: { data: { id: "e1" }, error: null } });
    expect(await hasClubMonthEntitlement(client as never, "u1", "month-1")).toBe(true);
  });

  it("returns false when no entitlement row exists", async () => {
    const client = mockSupabaseClient({ entitlements: { data: null, error: null } });
    expect(await hasClubMonthEntitlement(client as never, "u1", "month-1")).toBe(false);
  });
});

describe("getMyBlockedUserIds", () => {
  it("maps block rows to a plain id list", async () => {
    const client = mockSupabaseClient({
      blocks: { data: [{ blocked_user_id: "a" }, { blocked_user_id: "b" }], error: null },
    });
    expect(await getMyBlockedUserIds(client as never, "u1")).toEqual(["a", "b"]);
  });
});

describe("write helpers propagate errors", () => {
  it("sendChatMessage throws on a DB error", async () => {
    const client = mockSupabaseClient({ chat_messages: { data: null, error: new Error("nope") } });
    await expect(sendChatMessage(client as never, { clubMonthId: "m1", userId: "u1", body: "hi" })).rejects.toThrow("nope");
  });

  it("submitQuestion throws on a DB error", async () => {
    const client = mockSupabaseClient({ questions: { data: null, error: new Error("nope") } });
    await expect(submitQuestion(client as never, { clubMonthId: "m1", userId: "u1", body: "hi" })).rejects.toThrow("nope");
  });

  it("blockUser throws on a DB error", async () => {
    const client = mockSupabaseClient({ blocks: { data: null, error: new Error("nope") } });
    await expect(blockUser(client as never, "u1", "u2")).rejects.toThrow("nope");
  });

  it("reportMessage throws on a DB error", async () => {
    const client = mockSupabaseClient({ reports: { data: null, error: new Error("nope") } });
    await expect(reportMessage(client as never, { reporterId: "u1", messageId: "msg1", reason: "spam" })).rejects.toThrow("nope");
  });
});
