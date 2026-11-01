#!/usr/bin/env node
// Integration test for the Stripe/RevenueCat webhook Edge Functions
// (CLAUDE.md: "Write tests for entitlement logic, webhook handlers, and
// RLS policies"). Posts real HTTP requests with real HMAC signatures
// against the local Supabase stack and asserts on the resulting rows.
//
// Not part of `pnpm test` -- it needs Docker/`supabase start` running and
// the webhook secrets in supabase/functions/.env, so it can't run in a
// plain CI job the way vitest unit tests do. Run manually:
//   node supabase/functions/test-webhooks.mjs
//
// Deno (the Edge Functions runtime) has no test runner available in this
// environment (requires a full Xcode install to build locally), so this
// is a Node-based black-box integration test instead of a Deno unit test.

import { createHmac, randomUUID } from "node:crypto";

const BASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
// Must match supabase/functions/.env for this to actually verify anything.
const STRIPE_WEBHOOK_SECRET = "whsec_local_dev_test_secret";
const REVENUECAT_WEBHOOK_SECRET = "rc_local_dev_test_secret";

let failures = 0;
function assert(condition, message) {
  if (condition) {
    console.log(`  ok - ${message}`);
  } else {
    console.error(`  FAIL - ${message}`);
    failures++;
  }
}

function sign(secret, payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

async function callFunction(name, body, headers) {
  const res = await fetch(`${BASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json", ...headers },
    body,
  });
  return { status: res.status, body: await res.json() };
}

async function adminRequest(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  return res.status === 204 ? null : res.json();
}

async function main() {
  // Fixture user + title (service role bypasses RLS/needs no real sign-in).
  const testEmail = `webhook-test-${randomUUID()}@example.com`;
  const user = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email: testEmail, email_confirm: true }),
  });
  const userId = user.id;
  const [title] = await adminRequest("/rest/v1/titles?select=id&limit=1");
  const titleId = title.id;

  try {
    console.log("=== Stripe webhook ===");
    {
      const { status, body } = await callFunction("stripe-webhook", JSON.stringify({ type: "x" }), {
        "stripe-signature": "t=1,v1=deadbeef",
      });
      assert(status === 400, `rejects an invalid signature (got ${status}: ${JSON.stringify(body)})`);
    }

    const sessionId = `cs_test_${randomUUID()}`;
    const payload = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: { object: { id: sessionId, mode: "payment", client_reference_id: userId, metadata: { kind: "title", ref_id: titleId } } },
    });
    {
      const { status } = await callFunction("stripe-webhook", payload, {
        "stripe-signature": sign(STRIPE_WEBHOOK_SECRET, payload),
      });
      assert(status === 200, `accepts a validly-signed checkout.session.completed (got ${status})`);

      const rows = await adminRequest(`/rest/v1/entitlements?select=*&external_id=eq.${sessionId}`);
      assert(rows.length === 1, "writes exactly one entitlement row");
      assert(rows[0]?.user_id === userId && rows[0]?.kind === "title" && rows[0]?.ref_id === titleId, "entitlement row has the right user/kind/ref_id");
    }
    {
      // Retried delivery (same session id) must not double-grant.
      const { status } = await callFunction("stripe-webhook", payload, {
        "stripe-signature": sign(STRIPE_WEBHOOK_SECRET, payload),
      });
      assert(status === 200, "a retried delivery still returns 200");
      const rows = await adminRequest(`/rest/v1/entitlements?select=id&external_id=eq.${sessionId}`);
      assert(rows.length === 1, "a retried delivery does not create a duplicate entitlement (idempotent)");
    }

    console.log("=== RevenueCat webhook ===");
    {
      const { status, body } = await callFunction("revenuecat-webhook", JSON.stringify({ event: { type: "x" } }), {
        "X-RevenueCat-Webhook-Signature": "t=1,v1=deadbeef",
      });
      assert(status === 401, `rejects an invalid signature (got ${status}: ${JSON.stringify(body)})`);
    }

    const txnId = `txn_test_${randomUUID()}`;
    const rcPayload = JSON.stringify({
      api_version: "1.0",
      event: { id: "evt_rc_test", type: "INITIAL_PURCHASE", app_user_id: userId, product_id: `title:${titleId}`, transaction_id: txnId, store: "APP_STORE" },
    });
    {
      const { status } = await callFunction("revenuecat-webhook", rcPayload, {
        "X-RevenueCat-Webhook-Signature": sign(REVENUECAT_WEBHOOK_SECRET, rcPayload),
      });
      assert(status === 200, `accepts a validly-signed INITIAL_PURCHASE (got ${status})`);

      const rows = await adminRequest(`/rest/v1/entitlements?select=*&external_id=eq.${txnId}`);
      assert(rows.length === 1, "writes exactly one entitlement row");
      assert(rows[0]?.source === "apple" && rows[0]?.kind === "title" && rows[0]?.ref_id === titleId, "entitlement row has the right source/kind/ref_id");
    }
  } finally {
    await adminRequest(`/auth/v1/admin/users/${userId}`, { method: "DELETE" }); // cascades entitlements/subscriptions/profile
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
