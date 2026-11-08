import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { deleteAccount, requestOtp, signOut, verifyOtp } from "./auth";
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

function deleteAccountClient(invokeResult: { data?: unknown; error?: unknown }) {
  return {
    auth: { signOut: vi.fn(() => Promise.resolve({ error: null })) },
    functions: { invoke: vi.fn(() => Promise.resolve(invokeResult)) },
  };
}

describe("deleteAccount", () => {
  it("signs the client out after a successful deletion", async () => {
    const client = deleteAccountClient({ data: { deleted: true }, error: null });
    await deleteAccount(client as unknown as Client);
    expect(client.functions.invoke).toHaveBeenCalledWith("delete-account", { method: "POST" });
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it("throws on a function-invoke error and does not sign out", async () => {
    const client = deleteAccountClient({ data: null, error: new Error("network") });
    await expect(deleteAccount(client as unknown as Client)).rejects.toThrow("network");
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("throws on an application-level error in the response body", async () => {
    const client = deleteAccountClient({ data: { error: "Sign in required" }, error: null });
    await expect(deleteAccount(client as unknown as Client)).rejects.toThrow("Sign in required");
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
});
