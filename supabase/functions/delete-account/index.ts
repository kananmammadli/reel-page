import { createClient } from "jsr:@supabase/supabase-js@2";

// Account deletion, required by both the App Store and Google Play
// review guidelines for any app that offers account creation (SPEC.md
// §5), callable identically from web and mobile.
//
// Every user-owned table's user_id column references auth.users(id) on
// delete cascade (entitlements, payments, quotes, chat_messages, etc. --
// see the migrations), so deleting the auth.users row is sufficient to
// remove everything else too; nothing else needs to run here.
//
// Known tradeoff, worth a legal/accounting look before handling real
// money: this *fully erases* payment/entitlement history rather than
// anonymizing it (keeping the transaction but severing the user link),
// which is what many businesses do instead to satisfy
// accounting/fraud-dispute retention obligations. Cascade-delete is the
// simpler, more privacy-protective default for this stage; revisit if
// that retention need becomes real.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const jwt = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return jsonResponse({ error: "Sign in required" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Never trust a client-supplied user id -- verify the JWT server-side
  // and delete only the account it actually belongs to.
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: "Sign in required" }, 401);
  }

  const { error } = await supabase.auth.admin.deleteUser(userData.user.id);
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({ deleted: true });
});
