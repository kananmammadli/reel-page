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

## Milestone 6 — Club

**Goal:** the monthly club experience — scheduled drops, live chat, Q&A, moderation.

Also covers the admin screens originally scoped to milestone 5 (club schedule UI, Q&A inbox, chat moderation tools) — those need this milestone's schema, so building them early would have meant designing them without the member-facing half they pair with. Build each admin screen together with the member-facing feature it serves, not as a separate pass.

1. `supabase/migrations/<ts>_club.sql`: `club_months`, `club_releases`, `chat_messages`, `questions`, `blocks`, `reports` tables per §4. RLS: chat/questions readable by club members for that month only (join against `entitlements` where `kind = 'club_month'`); writes owner-only plus host-can-moderate policies.
2. Scheduled release logic: a Postgres `cron` job (via `pg_cron`, enabled in `config.toml`) or a scheduled Edge Function that flips episode visibility based on `club_releases.release_at`. Admin side: a schedule screen in `apps/web/src/app/admin/` to pick the month's title and set `club_releases.release_at` per episode.
3. Realtime chat: enable Supabase Realtime on `chat_messages`; both apps subscribe to the current club month's channel. Build the chat UI (message list, reply threading via `reply_to`, host badge, pin indicator).
4. Q&A: submit a question (member), show published Q&A to all members, show the submitter their own question's status. Admin side: an inbox in `apps/web/src/app/admin/` listing unanswered `questions` with a reply form that sets `answer`/`answered_at`/`published`.
5. Report/block: "report message" and "block member" actions from the chat UI; blocked members' messages disappear client-side immediately (filter by the current user's `blocks` list). Admin side: pin/delete message, a `reports` queue, and suspending a member (insert into `blocks` on the host's behalf, or a separate `suspensions` concept if blocking isn't the right primitive — check against §3.5 wording before building).
6. Push notifications: Expo push tokens stored on `profiles` (add a column or a side table), triggered from the Edge Functions that handle episode release and Q&A answers. Require explicit opt-in (a Profile toggle) before registering the token.
7. Tests: RLS tests for the member-only chat/Q&A visibility, and for the admin-only moderation writes (same host-gating pattern as milestone 5's `admin_rls.sql`); a test that a blocked member's new messages don't surface to the blocker; a test for the scheduled-release cron logic (can run as a plain SQL/function test without waiting for real time to pass — set `release_at` in the past and assert visibility).

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
