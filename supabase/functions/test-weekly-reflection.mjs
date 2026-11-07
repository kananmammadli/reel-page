#!/usr/bin/env node
// Integration test for the weekly-reflection Edge Function (milestone 7
// tasks.md §7): confirms the opt-out gate (reflection_settings.enabled)
// actually keeps it from running for a user who hasn't opted in, and
// that the shared-secret auth gate rejects an unsigned/wrong caller.
//
// Not part of `pnpm test` -- needs Docker/`supabase start` running. Run
// manually:
//   node supabase/functions/test-weekly-reflection.mjs

const BASE_URL = "http://127.0.0.1:54321";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
// Must match supabase/functions/.env for this to actually verify anything.
const CRON_SECRET = "local-dev-cron-secret-change-in-production";

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

async function callFunction(secret) {
  const res = await fetch(`${BASE_URL}/functions/v1/weekly-reflection`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json", ...(secret ? { "X-Cron-Secret": secret } : {}) },
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  console.log("=== auth gate ===");
  {
    const { status } = await callFunction("wrong-secret");
    assert(status === 401, `rejects a wrong cron secret (got ${status})`);
  }
  {
    const { status } = await callFunction(null);
    assert(status === 401, `rejects a missing cron secret (got ${status})`);
  }

  const [freeTitle] = await adminRequest("/rest/v1/titles?select=id&is_free=eq.true&limit=1");
  const [episode] = await adminRequest(`/rest/v1/episodes?select=id&title_id=eq.${freeTitle.id}&limit=1`);

  const enabledEmail = `reflection-enabled-${Date.now()}@example.com`;
  const disabledEmail = `reflection-disabled-${Date.now()}@example.com`;
  const enabledUser = await adminRequest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: enabledEmail, email_confirm: true }) });
  const disabledUser = await adminRequest("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: disabledEmail, email_confirm: true }) });

  try {
    for (const [userId, enabled] of [[enabledUser.id, true], [disabledUser.id, false]]) {
      await fetch(`${BASE_URL}/rest/v1/reflection_settings`, {
        method: "POST",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, enabled, consented_at: enabled ? new Date().toISOString() : null }),
      });
      await fetch(`${BASE_URL}/rest/v1/quotes`, {
        method: "POST",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, episode_id: episode.id, text: "a saved line", at_s: 10 }),
      });
    }

    console.log("=== running the weekly job ===");
    const { status, body } = await callFunction(CRON_SECRET);
    assert(status === 200, `the function ran successfully (got ${status}: ${JSON.stringify(body)})`);

    const reflectionsForDisabled = await adminRequest(`/rest/v1/reflections?select=id&user_id=eq.${disabledUser.id}`);
    assert(reflectionsForDisabled.length === 0, "no reflection was created for a user with reflection_settings.enabled = false");
  } finally {
    await adminRequest(`/rest/v1/quotes?user_id=eq.${enabledUser.id}`, { method: "DELETE" });
    await adminRequest(`/rest/v1/quotes?user_id=eq.${disabledUser.id}`, { method: "DELETE" });
    await adminRequest(`/rest/v1/reflections?user_id=eq.${enabledUser.id}`, { method: "DELETE" });
    await adminRequest(`/auth/v1/admin/users/${enabledUser.id}`, { method: "DELETE" });
    await adminRequest(`/auth/v1/admin/users/${disabledUser.id}`, { method: "DELETE" });
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
