import Stripe from "stripe";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Handles Stripe webhook events for one-time title/collection purchases
// (checkout.session.completed) and club subscriptions
// (customer.subscription.*). Writes only via the service role client,
// which bypasses RLS -- entitlements/subscriptions have no client-writable
// policy at all (see supabase/migrations/..._entitlements.sql).
//
// Checkout session creation (not this function) must set:
//   - mode "payment": metadata { kind: "title"|"collection", ref_id }
//     and client_reference_id = the Supabase user id.
//   - mode "subscription": subscription_data.metadata.user_id = the
//     Supabase user id (so every subscription.* event carries it, without
//     needing an extra API call back to Stripe).

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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

function mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): "active" | "canceled" | "past_due" | "expired" {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
      return "canceled";
    default:
      return "expired";
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return jsonResponse({ error: "Missing signature or webhook secret" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment") {
      return jsonResponse({ received: true });
    }

    const userId = session.client_reference_id;
    const kind = session.metadata?.kind;
    const refId = session.metadata?.ref_id;
    if (!userId || (kind !== "title" && kind !== "collection") || !refId) {
      return jsonResponse({ error: "Missing user_id/kind/ref_id in session" }, 400);
    }

    // Idempotent: a retried delivery hits the (source, external_id) unique
    // constraint and is ignored rather than double-granting.
    const { error } = await supabase
      .from("entitlements")
      .upsert(
        { user_id: userId, kind, ref_id: refId, source: "stripe", external_id: session.id },
        { onConflict: "source,external_id", ignoreDuplicates: true },
      );
    if (error) return jsonResponse({ error: error.message }, 500);

    if (session.amount_total != null && session.currency) {
      await supabase.from("payments").upsert(
        {
          user_id: userId,
          kind,
          ref_id: refId,
          source: "stripe",
          external_id: session.id,
          amount_cents: session.amount_total,
          currency: session.currency,
        },
        { onConflict: "source,external_id", ignoreDuplicates: true },
      );
    }

    // Best-effort first-party analytics (SPEC.md §5) -- never fails the webhook.
    await supabase
      .from("analytics_events")
      .insert({ event_type: "purchase", user_id: userId, title_id: kind === "title" ? refId : null, metadata: { kind, refId } });

    return jsonResponse({ received: true });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.user_id;
    if (!userId) {
      return jsonResponse({ error: "Missing user_id in subscription metadata" }, 400);
    }

    const status = event.type === "customer.subscription.deleted" ? "canceled" : mapSubscriptionStatus(subscription.status);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

    const { error } = await supabase.from("subscriptions").upsert({
      user_id: userId,
      status,
      source: "stripe",
      external_id: subscription.id,
      current_period_end: currentPeriodEnd,
    });
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ received: true });
  }

  // Each successful renewal charge, for the sales dashboard. The invoice
  // itself doesn't carry the subscription's metadata, so look the
  // subscription back up for the user id it was created with.
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    if (subscriptionId && invoice.amount_paid != null && invoice.currency) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = subscription.metadata?.user_id;
      if (userId) {
        // This specific month's entitlement is what keeps that month's
        // chat/episodes accessible even after the subscription itself is
        // later canceled (SPEC.md §3.4) -- every renewal grants one.
        const clubMonthId = await getCurrentClubMonthId(supabase);
        if (clubMonthId) {
          await supabase.from("entitlements").upsert(
            { user_id: userId, kind: "club_month", ref_id: clubMonthId, source: "stripe", external_id: invoice.id },
            { onConflict: "source,external_id", ignoreDuplicates: true },
          );
          await supabase.from("analytics_events").insert({ event_type: "club_join", user_id: userId, metadata: { clubMonthId } });
        }

        await supabase.from("payments").upsert(
          {
            user_id: userId,
            kind: "club_month",
            ref_id: clubMonthId,
            source: "stripe",
            external_id: invoice.id,
            amount_cents: invoice.amount_paid,
            currency: invoice.currency,
          },
          { onConflict: "source,external_id", ignoreDuplicates: true },
        );
      }
    }
    return jsonResponse({ received: true });
  }

  return jsonResponse({ received: true });
});
