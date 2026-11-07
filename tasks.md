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

## Milestone 4 — Purchases ✅ done (backend + UI wiring; non-functional without real Stripe/RevenueCat accounts)

`entitlements`/`subscriptions` migration + RLS + webhooks + entitlement gate (`8986669`), checkout/purchase UI wiring + owned-content library (`2bea410`).

`entitlements` is the single source of truth (polymorphic `ref_id`, owner-only `SELECT`, no insert/update/delete policy for any client role — verified by a pgTAP test, not just a reading of the policy). `get-audio-url` checks it server-side before issuing a signed URL for paid content. `stripe-webhook` and `revenuecat-webhook` Edge Functions verify real signatures (Stripe's SDK helper; a hand-rolled HMAC check for RevenueCat, since no official Deno/npm verifier exists for its scheme) and write `entitlements`/`subscriptions` idempotently via `unique(source, external_id)` + `ignoreDuplicates`. Web got a `/api/checkout` route (Stripe Checkout Sessions) and mobile got `lib/purchases.ts` (RevenueCat wrapper); both wire a live "Buy to unlock" button and a "Restore purchases" action, and both show a real owned-content library backed by `getOwnedTitles`/`getOwnedCollections`.

Verified end-to-end: the entitlement gate's four access scenarios, webhook signature rejection + idempotent processing (Node integration tests against real fixture users), RLS invariants (pgTAP), and the buy-button/restore-button error states when purchases aren't configured. Not verifiable without real accounts (scoped out per `CLAUDE.md`'s "ask before expensive-to-undo decisions" rule): an actual completed Stripe checkout or a real App Store/Play sandbox purchase and restore. Both code paths are real and ready to exercise once those accounts exist.

---

## Milestone 5 — Admin panel ✅ done (catalog + sales; club/Q&A/chat tools moved into milestone 6)

Host RLS policies + payments ledger (`7232739`), `apps/web/src/app/admin/` panel (`dfa626e`).

Host-only (`profiles.role = 'host'`), gated at the layout (redirect) and independently inside every server action (defense in depth — RLS enforces the same thing at the DB layer regardless of what rendered the form). Titles/episodes/collections CRUD, with direct-to-storage browser uploads for posters and episode audio. Uploading episode audio triggers a real `ffmpeg`/`ffprobe` run (via `ffmpeg-static`/`ffprobe-static`, not a Supabase Edge Function — Deno's hosted sandbox can't spawn a native binary, so this needed a real Node process, i.e. a Next.js Route Handler) that trims the first 5 minutes and fills in `duration_s`. Transcript format decided and documented in `SPEC.md`/`SPEC.ru.md` §4: a JSON array of `{text, start_s, end_s}`, uploaded as a `.json` file — this is the format milestone 2's seed data already used, not a new one. Sales overview reads a new append-only `payments` ledger (one row per confirmed charge, populated by the webhooks from real event amounts, never hard-coded) rather than `entitlements`/`subscriptions`, since those are current-state tables and can't answer "revenue this month".

Club schedule UI, Q&A inbox, and chat moderation tools (original items 5–7) were **not** built here — they need `club_months`/`questions`/`chat_messages`/`blocks`/`reports`, which don't exist until milestone 6's schema lands. Building that schema early just to satisfy this milestone's admin screens would mean designing it without the member-facing half it has to match, so those three admin screens move to milestone 6 and get built alongside the schema and the member-facing UI they pair with.

Verified end-to-end in a real browser (CDP/Puppeteer, not just type-checked): signed in as a host, created a title, uploaded a real short audio file + transcript JSON, confirmed the preview was actually generated (real `ffmpeg` run, not a stub) and `duration_s` filled in, confirmed the published title appeared on its public page, confirmed the sales dashboard renders, and confirmed a non-host signing in gets redirected away from `/admin`. pgTAP covers the RLS side (host CRUD succeeds, non-host is rejected, no client role — host included — can write `payments` directly). Caught and fixed two real bugs this way, not just by reasoning about the code: `ffmpeg-static`/`ffprobe-static`'s binary paths got mangled by Next's build-time file tracing (fixed via `serverExternalPackages`), and Next.js 16's dev-mode `<nextjs-portal>` toolbar overlay was silently swallowing clicks on form buttons near the bottom of a short headless-browser viewport (fixed by using a taller one).

**Definition of done** (as scoped above): Liliya can publish a new title end-to-end (upload → preview generated → transcript attached → appears in the catalog) without any direct DB access, and no non-host account can reach any admin mutation.

---

## Milestone 6 — Club ✅ done (push notifications real but unverifiable without an EAS project)

Schema + entitlement-based gating + a profiles security fix (`876adff`), host-session plumbing (checkout/public-profiles/admin client, `8bb2872`), suspend enforcement (`0fad31d`), the full web+mobile UI (`5da1059`), a PostgREST FK fix found while testing (`163d8da`).

Club access is keyed off a `club_month` entitlement, not subscription status — each successful charge (initial or renewal) grants one for whichever month is current at that moment, so a paid-for month's chat/episodes stay reachable after the subscription itself lapses (SPEC.md §3.4). Episode-release gating is a live `release_at <= now()` check (both in `get-audio-url` and the club room), deliberately not a cron-driven visibility flip — same reasoning as `titles.published_at`, no staleness window, no extra moving part. Release-notification push is the one piece that *does* need a scheduler (nothing is "reading" at the instant a threshold crosses): `pg_cron` + `pg_net` call Expo's push API directly on a 5-minute tick, skipping a round-trip through an Edge Function entirely since Expo's endpoint needs no auth. Q&A-answer push sends synchronously from the admin action instead, since that already has a live request to hang it off.

Found and fixed two real bugs this milestone, not just reasoned about: the milestone-3 "update own profile" policy had no column restriction, so any authenticated user could self-promote to `role = 'host'` — closed via a column-privilege GRANT replacement (a column-level REVOKE alone doesn't override a table-wide grant, confirmed by first watching the pgTAP test fail, then fixing it, then watching it pass); and `chat_messages`/`questions`/`reports` had no FK to `profiles` (only to `auth.users`, which PostgREST can't see), so every query trying to embed a poster's name/role failed with PGRST200 — caught by actually driving the chat/Q&A UI in a browser, not by type-checking the joins.

Verified end-to-end in a real browser, the whole lifecycle in one pass: host schedules a club month and a release (admin UI, real form submission, real `datetime-local` inputs); a member with a seeded entitlement sees the released episode as playable and the unreleased one as "Releases \<date\>", posts chat, asks a question; a second member sees that message, reports it, blocks the poster (message disappears from their view); the host resolves the report, answers the question (it publishes), pins the message, suspends the poster; the suspended member can still read everything (including the pin and the answer) but a new post attempt gets a real 403, not a silent failure; a signed-in non-member sees a join prompt instead of the room; the home page banner renders. pgTAP (55 tests across all RLS: entitlement-scoped read, current-month-only write, suspension enforcement, owner-only blocks/push-tokens, reporter+host-only reports) and the extended `test-entitlement-gate.mjs` (unreleased-but-entitled denied, released-and-entitled allowed, released-but-non-member denied) back it up.

Not verifiable without a real EAS project (same category of gap as Stripe/RevenueCat in milestone 4 — nobody here can provision one): actually receiving a push notification on a device. The registration flow, the `pg_cron`/`pg_net` → Expo call (confirmed live against Expo's real endpoint, which returned a real "invalid token" response for a fake token), and the Q&A-answer send are all real and ready for when one exists.

**Definition of done** (as scoped above): a club member sees this month's episodes unlock on schedule, can chat and ask questions in real time on both platforms, blocking/reporting works, and push notifications fire for new episodes and answered questions once a real EAS project exists to deliver them.

---

## Milestone 7 — Quote journal ✅ done (reflection content real but unverifiable without a real Anthropic API key)

Schema + RLS + the weekly-reflection Edge Function (`3cedc64`), the pen button/quotes feed/reflection consent UI on both platforms (`ad7f3fc`).

`quotes`/`listening_days`/`reflection_settings` are owner-CRUD, mirroring `playback_positions`. Added a `reflections` table (documented in `SPEC.md`/`SPEC.ru.md` §4, same as `payments` in milestone 5) so the weekly output lives in-app, not just an email/push — a user can read and delete their own rows but never write them, which is what makes "turn off and delete data" an actual `DELETE`, not a flag flip. `listening_days.seconds` increments through an RPC (`increment_listening_seconds`) rather than a plain upsert, since accumulating a count atomically isn't expressible through supabase-js's upsert; it reads `auth.uid()` itself so it can never be pointed at another user's row. `weekly-reflection` runs on a `pg_cron` tick (mirroring milestone 6's `notify_club_releases` job), checks a shared-secret header since it has no legitimate end-user caller, and only ever processes users with `reflection_settings.enabled = true` — confirmed by an integration test that a disabled user's quotes are never even queried, not just that no row gets written for them.

Verified end-to-end in a real browser, not just unit tests of the pieces: played a real episode with a real transcript, confirmed the pen button activates exactly when a transcript line is active and captures the right text; confirmed the quotes feed and stats reflect it; confirmed "Jump to this moment" resumes playback at the saved timestamp; confirmed the reflection toggle's disclaimer is visible, that enabling it stamps `consented_at`, and that disabling it actually deletes a seeded reflection row (not just hides it); confirmed a real 12-second playback run produces a real `listening_days` row through the periodic sync, not just that the RPC itself works in isolation. 69 pgTAP tests (RLS + the increment RPC's accumulation behavior) and the weekly-reflection integration test (auth gate + the opt-out skip) back it up.

Not verifiable without a real Anthropic API key (same category of gap as Stripe/RevenueCat/EAS elsewhere in this project — nobody here can provision one): the actual theme/question Claude would generate from a week's quotes. The function gracefully no-ops without one (reports the user as "skipped," writes nothing) rather than erroring, and the rest of the pipeline — cron trigger, auth, the enabled-only filter, the per-user quote/minutes aggregation, the upsert — is real and already proven working.

Mobile UI mirrors the web room but is unverified at runtime (no simulator/device available here) — same caveat as every other milestone's mobile side; spot-check before shipping.

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
