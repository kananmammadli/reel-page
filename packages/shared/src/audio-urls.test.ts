import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { AudioAccessError, getAudioUrl } from "./audio-urls";

type Client = SupabaseClient<Database>;

function clientWithInvokeResult(result: { data: unknown; error: unknown }) {
  return { functions: { invoke: vi.fn().mockResolvedValue(result) } };
}

describe("getAudioUrl", () => {
  it("returns the signed url on success", async () => {
    const client = clientWithInvokeResult({ data: { url: "https://example.test/audio.m4a" }, error: null });
    const url = await getAudioUrl(client as unknown as Client, "ep1", "preview");
    expect(url).toBe("https://example.test/audio.m4a");
    expect(client.functions.invoke).toHaveBeenCalledWith("get-audio-url", {
      body: { episodeId: "ep1", variant: "preview" },
    });
  });

  it("throws AudioAccessError with the function's status on failure", async () => {
    const client = clientWithInvokeResult({
      data: { error: "Purchase required" },
      error: { message: "edge function returned 403", context: { status: 403 } },
    });

    const promise = getAudioUrl(client as unknown as Client, "ep1", "full");
    await expect(promise).rejects.toThrow(AudioAccessError);
    await expect(promise).rejects.toMatchObject({ status: 403, message: "Purchase required" });
  });

  it("defaults to a 500 status when no context is available", async () => {
    const client = clientWithInvokeResult({ data: null, error: new Error("network down") });
    const promise = getAudioUrl(client as unknown as Client, "ep1", "full");
    await expect(promise).rejects.toMatchObject({ status: 500, message: "network down" });
  });
});
