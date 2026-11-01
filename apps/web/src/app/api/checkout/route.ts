import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentClubMonth } from "@reel-and-page/shared";
import { createClient } from "@/lib/supabase/server";

// Creates a Stripe Checkout Session for a one-time title/collection
// purchase, or a recurring club subscription. Not usable until a real
// Stripe account exists: STRIPE_SECRET_KEY is a placeholder locally, and
// titles.price_ref/collections.price_ref/club_months.price_ref are null
// until real Stripe Price ids are set (CLAUDE.md: never hard-code prices
// in the apps). The code path is real and ready for when both exist;
// until then this returns a clear, honest error instead of a confusing
// Stripe API failure.

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "Sign in to buy" }, { status: 401 });
  }

  const { kind, refId } = await request.json().catch(() => ({}));
  if (kind !== "title" && kind !== "collection" && kind !== "club") {
    return NextResponse.json({ error: "kind must be 'title', 'collection', or 'club'" }, { status: 400 });
  }
  if ((kind === "title" || kind === "collection") && typeof refId !== "string") {
    return NextResponse.json({ error: "refId is required for title/collection" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Checkout isn't configured yet" }, { status: 503 });
  }
  const stripe = new Stripe(secretKey);
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (kind === "club") {
    const clubMonth = await getCurrentClubMonth(supabase);
    if (!clubMonth) {
      return NextResponse.json({ error: "There's no club pick set for this month yet" }, { status: 404 });
    }
    if (!clubMonth.price_ref) {
      return NextResponse.json({ error: "Pricing isn't set up for this yet" }, { status: 400 });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: clubMonth.price_ref, quantity: 1 }],
        client_reference_id: userData.user.id,
        subscription_data: { metadata: { user_id: userData.user.id } },
        success_url: `${origin}/club?joined=1`,
        cancel_url: `${origin}/club`,
      });
      return NextResponse.json({ url: session.url });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 502 });
    }
  }

  const table = kind === "title" ? "titles" : "collections";
  const { data: record, error } = await supabase.from(table).select("price_ref").eq("id", refId).maybeSingle();
  if (error || !record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!record.price_ref) {
    return NextResponse.json({ error: "Pricing isn't set up for this yet" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: record.price_ref, quantity: 1 }],
      client_reference_id: userData.user.id,
      metadata: { kind, ref_id: refId },
      success_url: `${origin}/account?purchased=1`,
      cancel_url: `${origin}/`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Checkout failed" }, { status: 502 });
  }
}
