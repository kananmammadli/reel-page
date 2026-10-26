import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { requestOtp, signOut, verifyOtp } from "./auth";
import { mockAuthClient } from "./test/mock-supabase";

type Client = SupabaseClient<Database>;

describe("requestOtp", () => {
  it("resolves on success", async () => {
    const client = mockAuthClient({ signInWithOtp: { error: null } });
    await expect(requestOtp(client as unknown as Client, "a@b.com")).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    const client = mockAuthClient({ signInWithOtp: { error: new Error("rate limited") } });
    await expect(requestOtp(client as unknown as Client, "a@b.com")).rejects.toThrow("rate limited");
  });
});

describe("verifyOtp", () => {
  it("returns the session on success", async () => {
    const session = { access_token: "x" };
    const client = mockAuthClient({ verifyOtp: { data: { session }, error: null } });
    const result = await verifyOtp(client as unknown as Client, "a@b.com", "123456");
    expect(result).toBe(session);
  });

  it("throws if no session is returned", async () => {
    const client = mockAuthClient({ verifyOtp: { data: { session: null }, error: null } });
    await expect(verifyOtp(client as unknown as Client, "a@b.com", "123456")).rejects.toThrow(
      "No session returned",
    );
  });

  it("throws on a wrong code", async () => {
    const client = mockAuthClient({ verifyOtp: { data: {}, error: new Error("invalid code") } });
    await expect(verifyOtp(client as unknown as Client, "a@b.com", "000000")).rejects.toThrow("invalid code");
  });
});

describe("signOut", () => {
  it("throws on error", async () => {
    const client = mockAuthClient({ signOut: { error: new Error("network") } });
    await expect(signOut(client as unknown as Client)).rejects.toThrow("network");
  });
});
