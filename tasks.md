# Reel & Page — Engineering Tasks

Breaks the milestones in `SPEC.md` §6 into concrete engineering steps. Written for a mid-level engineer: you know React/TypeScript/SQL and can look up library APIs yourself, so this spells out *what* to build and *where it lives*, not how every function body works. Each milestone ends with a **Definition of done** — don't start the next milestone until that bar is met (per `CLAUDE.md` working rules).

Conventions used below:
- File paths are relative to the repo root.
- Every schema change ships as a new file in `supabase/migrations/`, named `<timestamp>_<description>.sql`. Never hand-edit the local DB.
- After any migration that changes the `public` schema, regenerate types: `supabase gen types typescript --local > packages/shared/src/database.types.ts`.
- Table/column names below are the ones already drafted in `SPEC.md` §4 — treat that section as the contract; if you need to deviate, update `SPEC.md` (and `SPEC.ru.md`) in the same PR.

---

## Milestone 1 — Skeleton ✅ done

pnpm workspace + Turborepo, `apps/mobile` (Expo/Expo Router), `apps/web` (Next.js), `packages/shared`, local Supabase, CI. See commits `fa096fc`, `f1683dd`. Nothing left to do here.

---

## Milestone 2 — Catalog + player ✅ done

Catalog schema + RLS + seed data + signed-URL Edge Function (`b5ceecf`), web catalog/player (`1cd80e0`), mobile catalog/player (`f543818`), sleep timer + auto-advance (`248db45`).

Switched the audio library from `react-native-track-player` to `expo-audio` mid-milestone — v4 has no New Architecture support, which Expo SDK 55+ requires with no opt-out, and v5 is alpha-only. See `CLAUDE.md`.

Verified: pgTAP + vitest suites pass; `expo export`/`next build` both succeed; real-browser (CDP, trusted clicks) and `expo-doctor` checks confirmed playback, preview gating, auto-advance, and sleep-timer cycling actually work, not just type-check.

Known, deliberately-deferred gaps (not bugs — scoped to later milestones):
- Playback position isn't remembered or synced yet — that's milestone 3 (`playback_positions`, tied to accounts).
- A finished preview just stops; it doesn't pop a purchase sheet, since there's no purchase flow to open yet — milestone 4 wires that up onto the already-present (disabled) "Buy to unlock" CTA.
- Mobile runtime behavior (background playback, lock-screen controls) is unverified on a real device/simulator — none was available in this environment. Spot-check before shipping.

---

## Milestone 3 — Accounts + sync ✅ done (email only)

`profiles`/`playback_positions` migrations + RLS (`52e2d02`), web sign-in/account/sync (`52e2d02`), mobile Profile tab/sync (`33bab96`).

Chose email one-time-code over magic links so web and mobile share one flow with no deep-link setup; customized the local `magic_link` email template to include the code. Apple/Google sign-in are disabled UI stubs — both need real developer credentials (Apple Developer Program, Google Cloud OAuth client) that only Liliya/Kanan can provision; wire them up with `signInWithIdToken` once those exist.

Verified on web end-to-end in a real browser (CDP): signed in with a real OTP code fetched from Mailpit, played an episode, paused (confirmed the upsert lands in Postgres), reloaded and saw "Resume" render, clicked it and confirmed playback actually resumed from the saved position. pgTAP RLS tests pass (owner-only on both tables, trigger auto-creates profiles). Mobile mirrors the same logic but is unverified at runtime (no simulator/device available in this environment) — spot-check sign-in and resume on a real device before shipping.

---

## Milestone 4 — Purchases

**Goal:** real money unlocks real content, through the single `entitlements` source of truth.

1. `supabase/migrations/<ts>_entitlements.sql`: `entitlements`, `subscriptions` tables per §4. RLS: owner-only `SELECT`; **no** insert/update/delete policies for any client role — only the `service_role` key (used exclusively inside Edge Functions) can write these. This is the core security invariant from `CLAUDE.md` — double check it with a test, not just a reading of the policy.
2. Stripe (web):
   - Products/prices created in the Stripe dashboard (test mode); store the `price_ref` on `titles`/`collections` matching Stripe price IDs.
   - `apps/web` checkout flow: server action or route handler creates a Checkout Session.
   - Edge Function `supabase/functions/stripe-webhook/index.ts`: verifies the Stripe signature, handles `checkout.session.completed` (one-time) and `customer.subscription.*` events (club), writes `entitlements`/`subscriptions` rows using the service role client.
3. RevenueCat (mobile):
   - Configure RevenueCat project with the same products mirrored to App Store Connect / Play Console (sandbox first).
   - Mobile app initializes the RevenueCat SDK, presents the purchase sheet (triggered from the "Buy to unlock" CTA built in milestone 2), calls `Purchases.purchase(...)`.
   - Edge Function `supabase/functions/revenuecat-webhook/index.ts`: verifies the RevenueCat webhook auth header, handles `INITIAL_PURCHASE`/`RENEWAL`/`CANCELLATION`/etc., writes `entitlements`/`subscriptions`.
4. Replace the milestone-2 placeholder (`is_free` check in app code) with a real entitlement check: `packages/shared/src/entitlements.ts` → `hasAccess(userId, { titleId | collectionId | clubMonthId })` queries `entitlements`. Use this everywhere full audio is requested — in `getFullAudioUrl`, check entitlement server-side (an Edge Function or a Next.js route handler — **not** client-side only, since the signed-URL issuance must happen after the check) before issuing the signed URL.
5. Restore purchases: a button in Profile (both apps) calling `Purchases.restorePurchases()` (mobile) / re-syncing from Stripe customer portal (web).
6. Library screen: now backed by real `entitlements` — list owned titles/collections, club membership status.
7. Tests (these are the ones `CLAUDE.md` explicitly calls out as protecting revenue):
   - Webhook handler tests: feed recorded/fixture Stripe and RevenueCat webhook payloads into the Edge Functions (locally via `supabase functions serve`) and assert the resulting `entitlements`/`subscriptions` rows.
   - Signature-verification tests: malformed/unsigned payloads must be rejected (401/400), not silently processed.
   - RLS test: confirm `anon`/`authenticated` roles get a permission error on direct `insert`/`update` to `entitlements`.
   - `hasAccess()` unit tests covering single-title, collection-membership, and active-club-month cases.

**Definition of done:** a test purchase (Stripe test card / sandbox IAP) unlocks the title end-to-end on both platforms, restore purchases works, and no client role can write `entitlements` directly — verified by a failing test if you try.

---

## Milestone 5 — Admin panel

**Goal:** Liliya can run the catalog and see sales without touching SQL.

1. `apps/web/src/app/admin/` route group, gated by a `role = 'host'` check on `profiles` (middleware or layout-level check; redirect non-hosts).
2. Title/episode CRUD forms: create/edit title metadata, poster upload (to the `posters` bucket), collection assignment, `is_free` toggle.
3. Episode upload flow: upload full audio to the `audio` bucket, then an Edge Function (`supabase/functions/generate-preview/index.ts`) that trims the first 5 minutes (shell out to `ffmpeg` inside the function, or use a queued job if Edge Functions can't run `ffmpeg` directly — check runtime constraints before committing to this approach) and writes the preview file.
4. Transcript upload: accept a timestamped transcript file (decide the input format — SRT or a small JSON schema — and document it in `SPEC.md` §4) and store it as the `episodes.transcript` jsonb.
5. Club schedule UI: pick the month's title, set `club_releases.release_at` per episode.
6. Q&A inbox: list unanswered `questions`, a reply form that sets `answer`/`answered_at`/`published`.
7. Chat tools: pin/delete message, view `reports` queue, suspend member (insert into `blocks` on the host's behalf, or a separate `suspensions` concept if blocking isn't the right primitive — check against §3.5 wording before building).
8. Sales overview: a read-only dashboard querying `entitlements`/`subscriptions` joined to `titles`/`collections`, grouped by period.
9. Tests: RLS/authorization tests confirming a non-host `authenticated` user gets rejected from every admin write path, both at the RLS layer and at the route/middleware layer (defense in depth — don't rely on only one).

**Definition of done:** Liliya can publish a new title end-to-end (upload → preview generated → transcript attached → appears in the catalog) without any direct DB access, and no non-host account can reach any admin mutation.

---

## Milestone 6 — Club

**Goal:** the monthly club experience — scheduled drops, live chat, Q&A, moderation.

1. `supabase/migrations/<ts>_club.sql`: `club_months`, `club_releases`, `chat_messages`, `questions`, `blocks`, `reports` tables per §4. RLS: chat/questions readable by club members for that month only (join against `entitlements` where `kind = 'club_month'`); writes owner-only plus host-can-moderate policies.
2. Scheduled release logic: a Postgres `cron` job (via `pg_cron`, enabled in `config.toml`) or a scheduled Edge Function that flips episode visibility based on `club_releases.release_at`.
3. Realtime chat: enable Supabase Realtime on `chat_messages`; both apps subscribe to the current club month's channel. Build the chat UI (message list, reply threading via `reply_to`, host badge, pin indicator).
4. Q&A UI: submit a question (member), answer it (host, in the milestone-5 admin inbox), show published Q&A to all members, show the submitter their own question's status.
5. Report/block: "report message" and "block member" actions from the chat UI; blocked members' messages disappear client-side immediately (filter by the current user's `blocks` list) and reports land in the admin queue from milestone 5.
6. Push notifications: Expo push tokens stored on `profiles` (add a column or a side table), triggered from the Edge Functions that handle episode release and Q&A answers. Require explicit opt-in (a Profile toggle) before registering the token.
7. Tests: RLS tests for the member-only chat/Q&A visibility; a test that a blocked member's new messages don't surface to the blocker; a test for the scheduled-release cron logic (can run as a plain SQL/function test without waiting for real time to pass — set `release_at` in the past and assert visibility).

**Definition of done:** a club member sees this month's episodes unlock on schedule, can chat and ask questions in real time on both platforms, blocking/reporting works, and push notifications fire for new episodes and answered questions.

---

## Milestone 7 — Quote journal

**Goal:** save and revisit lines from what you're listening to, with an optional AI reflection feature.

1. `supabase/migrations/<ts>_quotes.sql`: `quotes`, `listening_days`, `reflection_settings` tables per §4. RLS: owner-only, as with `playback_positions`.
2. Pen button: a persistent control (both apps) visible whenever something is playing; on tap, captures the transcript entry active at the current timestamp and inserts a `quotes` row.
3. Quotes feed screen: list own quotes newest-first; tapping one seeks the player to `at_s` in that episode (reopening the episode if it's not currently loaded).
4. Stats: compute quotes-saved count, consecutive-listening-days streak, and total minutes from `quotes`/`listening_days` — decide whether this is a DB view/function or computed client-side at this scale (likely fine client-side for now; revisit if it gets slow).
5. `listening_days` needs a writer: extend the playback-position sync from milestone 3 to also upsert today's `seconds` for the current user whenever meaningful playback happens (throttled, same as position sync).
6. Reflection feature (opt-in, off by default):
   - Consent screen in Profile writing to `reflection_settings`.
   - Edge Function `supabase/functions/weekly-reflection/index.ts`, scheduled weekly (`pg_cron` + `net.http_post`, or an external scheduler hitting the function), reads a user's quotes for the week, calls the Claude API server-side, stores/sends a summary (decide storage: a new table, or just an email/push — not yet specified in §4, add it there if you introduce a table).
   - Every surface showing the reflection output must label it explicitly as "a prompt for reflection, not therapy or professional advice" per `SPEC.md` §3.6 — this is a product requirement, not a suggestion.
   - "Turn off and delete data" must actually delete, not just hide — a toggle-off action that issues a `DELETE` against the user's reflection data.
7. Tests: RLS tests for the three new tables; a test that the reflection feature never runs for a user with `reflection_settings.enabled = false`; a test that the delete action removes rows, not just flips a flag.

**Definition of done:** quotes save and play back correctly on both platforms, stats are accurate, and the reflection feature is fully opt-in, clearly labeled, and deletable — verified by tests, not just manual spot-checks.

---

## Milestone 8 — Launch prep

**Goal:** ready for real users and app store review.

1. Store listings: screenshots, descriptions, privacy labels (App Store "App Privacy" questionnaire must match what's actually collected — audit against `SPEC.md` §5 before filling it in).
2. Legal: privacy policy and terms of service pages (web, linked from both apps' Profile screens).
3. Beta distribution: TestFlight build via EAS Build + EAS Submit; Play internal testing track.
4. Security review focused on the two things `CLAUDE.md` calls out as revenue/privacy-critical:
   - Re-walk every RLS policy written across milestones 2–7 against the "owner-only unless explicitly shared" rule.
   - Re-walk the entitlement-check path end to end: confirm there is no code path that serves full audio without a server-side entitlement check immediately before issuing the signed URL.
5. Load-test or at least sanity-check the webhook endpoints (Stripe/RevenueCat) for idempotency — a retried webhook delivery must not double-grant or corrupt an entitlement.
6. Final pass on accessibility (dynamic text size, screen-reader labels, contrast in both themes) across both apps, since this was a running requirement (§5) rather than a milestone-8-only task — use this milestone as the checkpoint to verify it was actually done.
7. Trademark/name check for "Reel & Page" (§7 open decision) — resolve before public listing.

**Definition of done:** both app store submissions are in review (or approved), legal pages are live, the security review's findings are either fixed or explicitly accepted as known risk by Liliya, and webhook idempotency is verified with a test (send the same event twice, assert only one entitlement).
