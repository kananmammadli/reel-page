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

## Milestone 2 — Catalog + player

**Goal:** anyone can browse the catalog and play free titles and previews, on both web and mobile, with a real audio player.

### 2.1 Data layer
1. `supabase/migrations/<ts>_catalog.sql`:
   - `titles`, `episodes`, `collections`, `collection_titles` tables exactly as drafted in `SPEC.md` §4. Use a Postgres `enum` for `titles.type` (`film`, `story`).
   - Indexes: `episodes(title_id, position)`, `collection_titles(collection_id)`, `collection_titles(title_id)`.
   - RLS: enable on all four tables. Policy: `anon` and `authenticated` can `SELECT` rows where `published_at is not null`. No insert/update/delete policies yet (only the service role writes, via the dashboard/SQL for now — the admin panel comes in milestone 5).
2. Storage: in the same migration (or a follow-up one), create two buckets via `storage.buckets`:
   - `posters` — public read.
   - `audio` — **not** public. Milestone 2 has no entitlement check yet, so for now: preview files live at a fixed path pattern (`<episode_id>/preview.m4a`) and your app code always requests those via `storage.from('audio').createSignedUrl(...)` with no auth gate; full-episode files (`<episode_id>/full.m4a`) are also fetchable the same way for titles where `is_free = true` only. This is intentionally a placeholder — milestone 4 replaces "is_free check in app code" with a real entitlement check.
3. `supabase/seed.sql`: insert 4–6 titles with 2–4 episodes each, mirroring what's in `prototype/reel-and-page.html` so local dev visually matches the reference. Point `poster_url` at the `posters` bucket; drop a couple of short placeholder `.m4a` files into the `audio` bucket via the seed script or a `supabase/seed/` folder of sample audio.

### 2.2 Shared package
4. `packages/shared/src/catalog.ts`: query helpers — `getHomeRails()`, `searchTitles(query, filters)`, `getTitle(id)`, `getEpisodes(titleId)` — thin wrappers over `supabase-js`, typed against the generated `Database` type. No UI code here.
5. `packages/shared/src/audio-urls.ts`: `getPreviewUrl(episodeId)`, `getFullAudioUrl(episodeId, isFree)` wrapping `createSignedUrl`.

### 2.3 Web (`apps/web`)
6. Routes: `/` (home rails), `/catalog` (search + filters: All/Films/Stories/Free), `/titles/[id]` (title page: poster, metadata, episode list, play/preview button).
7. A `<Player>` client component wrapping the HTML5 `<audio>` element: play/pause, ±15s/30s seek, scrub bar, speed selector (0.75×–2×). Lift playback state into a small client store (React context is fine, no need for a state library) so a mini player can persist across route navigations inside the App Router layout.
8. Mini player: rendered in `app/layout.tsx`, shown whenever something is loaded, docked at the bottom.
9. Transcript view: render `episodes.transcript` (jsonb array of `{ text, start_s, end_s }` — define and document this shape in `SPEC.md` §4 if not already precise) and highlight the entry matching current playback time.
10. Preview gating in the UI: if `title.is_free` is false, the full-episode play button is disabled with a "Buy to unlock" label (non-functional CTA — wired up in milestone 4); the preview button is always active.

### 2.4 Mobile (`apps/mobile`)
11. Install and configure `expo-audio` (switched from `react-native-track-player`, which has no New Architecture support — see `CLAUDE.md`): background playback is on by default, call `setActiveForLockScreen` for lock-screen/Control Center controls with track metadata.
12. Screens via Expo Router: `app/(tabs)/index.tsx` (home rails), `app/(tabs)/explore.tsx` (catalog + search/filters), `app/titles/[id].tsx` (title detail).
13. Player controls hooked to TrackPlayer: play/pause, ±15s/30s, scrub, speed, sleep timer (15 min / 30 min / end-of-episode — implement as a `setTimeout` that calls `TrackPlayer.pause()`, cleared on manual pause/seek).
14. Mini player docked above the tab bar — a component rendered in the tabs layout, reading playback state from a shared hook (mirror the web store's shape conceptually, but native-specific since it talks to TrackPlayer instead of `<audio>`).
15. Same transcript view and preview-gating UI as web, built with RN components.

### 2.5 Tests
16. `packages/shared`: unit tests for the catalog query helpers against a mocked Supabase client (use `vitest` + a hand-rolled mock, no need for a heavier framework yet — this is the first package to need a test runner, so add it: `vitest` as a devDependency, `pnpm test` script becomes `vitest run`).
17. RLS: a SQL test (plain `.sql` file run via `supabase test db`, or a short script using `psql` with the `anon` role) asserting anon can `SELECT` published titles and cannot `SELECT` unpublished ones.

**Definition of done:** `pnpm dev` runs web + mobile against local Supabase. Catalog browsing and search work on both. Tapping a free title plays it in full; tapping a paid title only plays the preview. The mini player survives navigation. Transcript highlights move with playback. `pnpm lint && pnpm type-check && pnpm test` all green.

---

## Milestone 3 — Accounts + sync

**Goal:** users can sign in and their listening position and library follow them across devices.

1. Enable Supabase Auth providers: email (magic link or password — pick one, document the choice in `SPEC.md` open decisions if not already settled), Sign in with Apple, Google. Configure redirect URLs for web and the Expo deep link scheme for mobile.
2. `supabase/migrations/<ts>_profiles.sql`: `profiles` table (per §4) with a trigger `on_auth_user_created` that inserts a row keyed by `auth.users.id`. RLS: a user can `SELECT`/`UPDATE` only their own row.
3. `supabase/migrations/<ts>_playback_positions.sql`: `playback_positions` table. RLS: owner-only read/write (`user_id = auth.uid()`).
4. Web: `/auth/sign-in` page using `@supabase/ssr` (cookie-based session for App Router). Add a root layout check for session and a `/account` page stub.
5. Mobile: sign-in screen using `supabase-js` with Apple/Google native sign-in SDKs (`expo-apple-authentication`, a Google sign-in library compatible with Expo) exchanging tokens via `supabase.auth.signInWithIdToken`.
6. Playback sync: on pause/every N seconds during playback, upsert `playback_positions`. On opening an episode, fetch the saved position and seek there. Debounce writes (e.g., every 10s, not every tick) to avoid hammering the DB.
7. "Continue listening" rail on the home screen (both apps) reads the most recently updated `playback_positions` joined to `episodes`/`titles`.
8. "Library" concept: for milestone 3, this is just "things you've started" (from `playback_positions`) since real ownership (`entitlements`) doesn't exist until milestone 4 — note this limitation inline in the UI copy or just show progress, not a purchased-items list yet.
9. Tests: RLS tests for `profiles` and `playback_positions` (owner can read/write own row, cannot read/write another user's). A test for the debounced-upsert logic in `packages/shared` (fake timers).

**Definition of done:** sign in/out works on web and mobile with all three providers. Starting an episode on one device and reopening it on another resumes at the right position. RLS tests pass; no table is readable/writable cross-user.

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
