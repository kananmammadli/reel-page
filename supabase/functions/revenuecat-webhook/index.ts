import { createClient } from "jsr:@supabase/supabase-js@2";

// Handles RevenueCat webhook events. Writes only via the service role
// client, which bypasses RLS -- entitlements/subscriptions have no
// client-writable policy at all (see
// supabase/migrations/..._entitlements.sql).
//
// Convention (no real RevenueCat product catalog exists yet -- adopt this
// when configuring real products): one-time purchase product identifiers
// are formatted "title:<uuid>" or "collection:<uuid>"; everything else is
// treated as the club subscription product. `app_user_id` must be
// configured (Purchases.configure({ appUserID: ... })) to equal the
// Supabase user id.
//
// Signature: RevenueCat's HMAC scheme (recommended over the plain
// Authorization-header option) -- header
// "X-RevenueCat-Webhook-Signature: t=<unix_ts>,v1=<hex_hmac>", HMAC-SHA256
// of "<t>.<raw_body>" with the dashboard-configured signing secret.

type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id: string;
  product_id: string;
  transaction_id: string;
  store: string;
  expiration_at_ms?: number;
  price_in_purchased_currency?: number;
  currency?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mapStore(store: string): "apple" | "google" | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "apple";
  if (store === "PLAY_STORE") return "google";
  return null;
}

async function verifySignature(header: string | null, rawBody: string, secret: string): Promise<boolean> {
  if (!header) return false;
  const match = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header.trim());
  if (!match) return false;
  const [, timestamp, signature] = match;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== signature!.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature!.charCodeAt(i);
  return diff === 0;
}

// The club's title/month rotates (see club_months), but a charge doesn't
// carry which month it was for -- it was for whichever month is open at
// the moment the charge succeeds.
async function getCurrentClubMonthId(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const { data } = await supabase.from("club_months").select("id").eq("month", monthStart).maybeSingle();
  return data?.id ?? null;
}

function parseProductRef(productId: string): { kind: "title" | "collection"; refId: string } | null {
  const [kind, refId] = productId.split(":");
  if ((kind === "title" || kind === "collection") && refId) return { kind, refId };
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) {
    return jsonResponse({ error: "Webhook secret not configured" }, 400);
  }

  const valid = await verifySignature(req.headers.get("X-RevenueCat-Webhook-Signature"), rawBody, secret);
  if (!valid) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  const { event } = JSON.parse(rawBody) as { event: RevenueCatEvent };
  const userId = event.app_user_id;
  const source = mapStore(event.store);
  if (!source) {
    return jsonResponse({ received: true }); // e.g. a sandbox/promotional store we don't map
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const productRef = parseProductRef(event.product_id);

  // Best-effort revenue record for the sales dashboard. RevenueCat doesn't
  // always include price (e.g. promotional entitlements) -- never let a
  // missing amount block granting the entitlement itself.
  async function recordPayment(kind: "title" | "collection" | "club_month", refId: string | null) {
    if (event.price_in_purchased_currency == null || !event.currency) return;
    await supabase.from("payments").upsert(
      {
        user_id: userId,
        kind,
        ref_id: refId,
        source,
        external_id: event.transaction_id,
        amount_cents: Math.round(event.price_in_purchased_currency * 100),
        currency: event.currency,
      },
      { onConflict: "source,external_id", ignoreDuplicates: true },
    );
  }

  if ((event.type === "INITIAL_PURCHASE" || event.type === "NON_RENEWING_PURCHASE") && productRef) {
    const { error } = await supabase.from("entitlements").upsert(
      { user_id: userId, kind: productRef.kind, ref_id: productRef.refId, source, external_id: event.transaction_id },
      { onConflict: "source,external_id", ignoreDuplicates: true },
    );
    if (error) return jsonResponse({ error: error.message }, 500);
    await recordPayment(productRef.kind, productRef.refId);
    // Best-effort first-party analytics (SPEC.md §5) -- never fails the webhook.
    await supabase.from("analytics_events").insert({
      event_type: "purchase",
      user_id: userId,
      title_id: productRef.kind === "title" ? productRef.refId : null,
      metadata: { kind: productRef.kind, refId: productRef.refId },
    });
    return jsonResponse({ received: true });
  }

  // Club subscription lifecycle (product isn't a title:/collection: one-time purchase).
  if (["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION", "UNCANCELLATION"].includes(event.type)) {
    const status = event.type === "CANCELLATION" || event.type === "EXPIRATION" ? "canceled" : "active";
    if (event.type === "INITIAL_PURCHASE" || event.type === "RENEWAL") {
      // This specific month's entitlement is what keeps that month's
      // chat/episodes accessible even after the subscription itself is
      // later canceled (SPEC.md §3.4) -- every renewal grants one.
      const clubMonthId = await getCurrentClubMonthId(supabase);
      if (clubMonthId) {
        await supabase.from("entitlements").upsert(
          { user_id: userId, kind: "club_month", ref_id: clubMonthId, source, external_id: event.transaction_id },
          { onConflict: "source,external_id", ignoreDuplicates: true },
        );
        await supabase.from("analytics_events").insert({ event_type: "club_join", user_id: userId, metadata: { clubMonthId } });
      }
      await recordPayment("club_month", clubMonthId);
    }
    const currentPeriodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

    const { data: existing, error: lookupError } = await supabase
      .from("subscriptions")
      .select("external_id")
      .eq("user_id", userId)
      .eq("source", source)
      .maybeSingle();
    if (lookupError) return jsonResponse({ error: lookupError.message }, 500);

    const { error } = existing
      ? await supabase
          .from("subscriptions")
          .update({ status, current_period_end: currentPeriodEnd ?? new Date().toISOString(), external_id: event.transaction_id })
          .eq("user_id", userId)
          .eq("source", source)
      : await supabase.from("subscriptions").insert({
          user_id: userId,
          source,
          status,
          current_period_end: currentPeriodEnd ?? new Date().toISOString(),
          external_id: event.transaction_id,
        });
    if (error) return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ received: true });
});
