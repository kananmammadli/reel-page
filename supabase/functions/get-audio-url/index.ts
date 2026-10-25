import { createClient } from "jsr:@supabase/supabase-js@2";

// Mints a short-lived signed URL for an episode's audio.
//
// The 'audio' storage bucket is private with no client-facing RLS policy —
// this function is the only path to it, using the service role key. That
// keeps the access check server-side, per CLAUDE.md's rule that paid audio
// must never be reachable without a check happening first.
//
// Milestone 2 placeholder: "full" access is gated on titles.is_free only.
// Milestone 4 replaces that check with a real entitlements lookup without
// changing this function's request/response shape.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Inside the local Edge Runtime container, SUPABASE_URL resolves to the
// internal Docker hostname "kong", which clients outside the Docker network
// (a browser, a device) can't reach. Rewrite signed URLs built from it back
// to the host-facing local API port. In production SUPABASE_URL is already
// the public project URL, so this is a no-op there.
function toPublicUrl(url: string): string {
  return url.replace(/^https?:\/\/kong(:\d+)?/, "http://127.0.0.1:54321");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const { episodeId, variant } = await req.json().catch(() => ({}));
  if (typeof episodeId !== "string" || (variant !== "preview" && variant !== "full")) {
    return jsonResponse({ error: "episodeId and variant ('preview'|'full') are required" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: episode, error } = await supabase
    .from("episodes")
    .select("audio_path, preview_path, titles(is_free, published_at)")
    .eq("id", episodeId)
    .single();

  if (error || !episode) {
    return jsonResponse({ error: "Episode not found" }, 404);
  }

  const title = episode.titles as unknown as { is_free: boolean; published_at: string | null };
  if (!title.published_at || new Date(title.published_at) > new Date()) {
    return jsonResponse({ error: "Not available" }, 404);
  }

  let path: string | null;
  if (variant === "preview") {
    path = episode.preview_path;
  } else {
    if (!title.is_free) {
      return jsonResponse({ error: "Purchase required" }, 403);
    }
    path = episode.audio_path;
  }

  if (!path) {
    return jsonResponse({ error: "No audio available for this variant" }, 404);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("audio")
    .createSignedUrl(path, 300);

  if (signError || !signed) {
    return jsonResponse({ error: "Could not sign URL" }, 500);
  }

  return jsonResponse({ url: toPublicUrl(signed.signedUrl) });
});
