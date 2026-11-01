import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

// Mints a short-lived signed URL for an episode's audio.
//
// The 'audio' storage bucket is private with no client-facing RLS policy —
// this function is the only path to it, using the service role key. That
// keeps the access check server-side, per CLAUDE.md's rule that paid audio
// must never be reachable without a check happening first.
//
// "full" access is gated on titles.is_free, or -- for paid titles -- a real
// entitlements row for the title itself or a collection it belongs to.
// (Edge Functions are a separate Deno runtime from packages/shared, so the
// entitlement check is duplicated here rather than imported -- see
// packages/shared/src/entitlements.ts for the Node/web-side equivalent.)

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

// Verifies the caller's JWT server-side (never trusts a client-supplied
// user id) and checks for a direct title entitlement or one via an owned
// collection. Mirrors packages/shared/src/entitlements.ts's hasAccess().
async function hasAccess(supabase: SupabaseClient, req: Request, titleId: string): Promise<boolean> {
  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) return false;
  const userId = userData.user.id;

  const { data: direct } = await supabase
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "title")
    .eq("ref_id", titleId)
    .maybeSingle();
  if (direct) return true;

  const { data: memberships } = await supabase.from("collection_titles").select("collection_id").eq("title_id", titleId);
  if (!memberships || memberships.length === 0) return false;

  const { data: viaCollection } = await supabase
    .from("entitlements")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "collection")
    .in(
      "ref_id",
      memberships.map((m) => m.collection_id),
    )
    .maybeSingle();
  return !!viaCollection;
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
    .select("audio_path, preview_path, titles(id, is_free, published_at)")
    .eq("id", episodeId)
    .single();

  if (error || !episode) {
    return jsonResponse({ error: "Episode not found" }, 404);
  }

  const title = episode.titles as unknown as { id: string; is_free: boolean; published_at: string | null };
  if (!title.published_at || new Date(title.published_at) > new Date()) {
    return jsonResponse({ error: "Not available" }, 404);
  }

  let path: string | null;
  if (variant === "preview") {
    path = episode.preview_path;
  } else {
    if (!title.is_free && !(await hasAccess(supabase, req, title.id))) {
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
