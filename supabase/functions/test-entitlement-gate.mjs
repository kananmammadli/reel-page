#!/usr/bin/env node
// Integration test for get-audio-url's entitlement gate (milestone 4
// tasks.md §4; CLAUDE.md: "paid audio must never be reachable without an
// entitlement check"). Posts real HTTP requests against the local
// Supabase stack and asserts on the responses.
//
// Not part of `pnpm test` -- needs Docker/`supabase start` running. Run
// manually:
//   node supabase/functions/test-entitlement-gate.mjs

const BASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

let failures = 0;
function assert(cond, msg) {
  console.log(`  ${cond ? "ok" : "FAIL"} - ${msg}`);
  if (!cond) failures++;
}

async function adminRequest(path, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...init.headers },
  });
  return res.status === 204 ? null : res.json();
}

async function getAudioUrl(episodeId, variant, userJwt) {
  const res = await fetch(`${BASE_URL}/functions/v1/get-audio-url`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : {}),
    },
    body: JSON.stringify({ episodeId, variant }),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const [freeTitle] = await adminRequest("/rest/v1/titles?select=id&is_free=eq.true&limit=1");
  const [freeEpisode] = await adminRequest(`/rest/v1/episodes?select=id&title_id=eq.${freeTitle.id}&limit=1`);
  const [paidTitle] = await adminRequest("/rest/v1/titles?select=id&is_free=eq.false&limit=1");
  const [paidEpisode] = await adminRequest(`/rest/v1/episodes?select=id&title_id=eq.${paidTitle.id}&limit=1`);

  console.log("=== free title, full, anonymous ===");
  {
    const { status } = await getAudioUrl(freeEpisode.id, "full", null);
    assert(status === 200, `free title is playable without signing in (got ${status})`);
  }

  console.log("=== paid title, full, anonymous ===");
  {
    const { status, body } = await getAudioUrl(paidEpisode.id, "full", null);
    assert(status === 403, `paid title is denied for an anonymous caller (got ${status}: ${JSON.stringify(body)})`);
  }

  const email = `entitlement-test-${Date.now()}@example.com`;
  const user = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, email_confirm: true, password: "test-password-123" }),
  });

  const loginRes = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-password-123" }),
  });
  const { access_token: userJwt } = await loginRes.json();

  try {
    console.log("=== paid title, full, signed-in but no entitlement ===");
    {
      const { status, body } = await getAudioUrl(paidEpisode.id, "full", userJwt);
      assert(status === 403, `paid title is denied for a signed-in user with no entitlement (got ${status}: ${JSON.stringify(body)})`);
    }

    // PostgREST returns 201 with no body by default -- can't use adminRequest's res.json().
    await fetch(`${BASE_URL}/rest/v1/entitlements`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, kind: "title", ref_id: paidTitle.id, source: "stripe", external_id: `cs_gate_test_${Date.now()}` }),
    });

    console.log("=== paid title, full, signed-in WITH entitlement ===");
    {
      const { status, body } = await getAudioUrl(paidEpisode.id, "full", userJwt);
      assert(status === 200 && typeof body.url === "string", `paid title is playable once entitled (got ${status}: ${JSON.stringify(body)})`);
    }
  } finally {
    await adminRequest(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
