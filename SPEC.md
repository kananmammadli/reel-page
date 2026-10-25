# Reel & Page — Product Specification

*English version. Russian translation: [SPEC.ru.md](SPEC.ru.md). Update both when either changes — see "Working rules" in [CLAUDE.md](CLAUDE.md).*

Version 0.1 · October 2026 · Owner: Liliya

## 1. Product summary

Reel & Page sells spoken commentaries on films and short stories, recorded by one host. Each commentary is split into episodes. Listeners can browse without an account, hear a 5-minute preview of paid commentaries, buy single commentaries or collections to keep, or join a monthly club built around one film per month with a member chat and a Q&A with the host. A quote journal lets listeners save lines while they listen.

Platforms: iPhone, Android, and a website with the same catalog, player, and purchases.

Content language: Russian (commentaries, transcripts, and app/website copy).

Prices: to be decided. All prices live in the database and store dashboards.

## 2. Users and roles

| Role | What they can do |
|---|---|
| Guest (no account) | Browse home, catalog, search, title pages; play free commentaries and previews |
| Listener (signed in) | Everything above, plus buy, keep a library, save quotes, resume across devices |
| Club member | Everything above, plus the current month's club film, chat, Q&A |
| Host / admin (Liliya) | Upload and schedule content, answer questions, pin messages, moderate chat, see sales |
| Moderator (optional, later) | Review reports, remove messages, suspend members |

## 3. Features

### 3.1 Home
- Club banner for the current month (title, short pitch, join or open button).
- "Continue listening" for titles in progress.
- Rails: Free to start, Collections, Recently added.

### 3.2 Catalog and search
- Search by title, director/author, genre.
- Filters: All, Films, Stories, Free.
- Title page: poster artwork, title, director/author, year, genre, description, episode list with durations, play/preview button, purchase options (single, collection that includes it, club if it's the club title).

### 3.3 Audio player
- Background playback and lock-screen / Control Center controls (mobile).
- Play/pause, back 15 s, forward 30 s, scrubbing, speed (0.75×–2×), sleep timer (15 min, 30 min, end of episode).
- Mini player docked above the tab bar on every screen.
- Remembers position per episode and syncs it to the account so listening resumes on another device.
- Auto-advance to the next unlocked episode.
- Transcript view that highlights the current passage (transcripts uploaded with each episode, with timestamps).
- Preview mode: unpaid users get a separate 5-minute preview file; at the end, show the purchase sheet.

### 3.4 Purchases
- One-time purchase of a single commentary (all its episodes, kept permanently).
- One-time purchase of a collection (several commentaries, kept permanently).
- Club subscription, monthly, auto-renewing. Every month paid for stays accessible after cancellation (episodes and chat history for that month).
- Mobile: App Store / Google Play via RevenueCat. Web: Stripe Checkout.
- Purchases made on any platform unlock content everywhere for the same account.
- Restore purchases button (required by Apple).

### 3.5 The club
- One featured film (or story) per calendar month.
- Episodes released on a schedule set by the host (for example weekly); unreleased episodes show their release date.
- Real-time member chat for each month, with replies, a host-pinned message, and host badge.
- Q&A: members submit questions; host answers; answered questions are visible to all members; members see the status of their own questions.
- Report a message and block a member. Blocked members' messages are hidden immediately; blocks are managed in Profile. Reports go to a moderation queue in the admin panel.
- Push notification when a new episode is released and when the host answers your question (opt-in).

### 3.6 Quote journal
- Pen button available on every screen while something is playing; saves the transcript passage being played, with title, episode, and timestamp.
- Quotes feed, newest first; tap a quote to jump to that moment in the audio.
- Stats: quotes saved, consecutive listening days, minutes listened.
- Optional reflection (off by default, explicit opt-in with consent screen): finds recurring themes in saved quotes and suggests one reflective question; weekly summary of listening time, quotes saved, and main theme. Uses the Claude API from a server-side function. Always labeled as a prompt for reflection, not therapy or professional advice. Users can turn it off and delete its data.

### 3.7 Profile
- Sign in / sign up (email, Sign in with Apple, Google). Account is needed only for purchases, club, quotes, and sync.
- Membership status and management link, owned commentaries, blocked members, notification settings, restore purchases, support email, terms, privacy policy, delete account (required by Apple).

### 3.8 Website
- Public, search-engine-friendly catalog and title pages (helps people find the app).
- Web player with the same preview and entitlement rules.
- Stripe checkout, account, library, club chat and Q&A.
- App store download links.

### 3.9 Admin panel (web, host only)
- Create and edit titles: metadata, poster image, description, collection membership, free/paid.
- Upload episodes: full audio, auto-generated 5-minute preview, transcript with timestamps.
- Club schedule: pick the month's title and the release date of each episode.
- Q&A inbox: answer questions, mark as published.
- Chat tools: pin message, delete message, review reports, suspend member.
- Sales overview: revenue by title, collection, and club; unlocks; active members.

## 4. Data model (first draft)

- `profiles` (id = auth user id, display_name, role, created_at)
- `titles` (id, type film|story, title, creator, year, genre, description, poster_url, is_free, price_ref, published_at)
- `episodes` (id, title_id, position, name, duration_s, audio_path, preview_path, transcript jsonb)
- `collections` (id, name, price_ref) and `collection_titles` (collection_id, title_id)
- `club_months` (id, month, title_id) and `club_releases` (club_month_id, episode_id, release_at)
- `entitlements` (id, user_id, kind title|collection|club_month, ref_id, source apple|google|stripe, external_id, created_at)
- `subscriptions` (user_id, status, source, current_period_end)
- `playback_positions` (user_id, episode_id, position_s, updated_at)
- `quotes` (id, user_id, episode_id, text, at_s, created_at)
- `chat_messages` (id, club_month_id, user_id, body, reply_to, pinned, deleted_at, created_at)
- `questions` (id, club_month_id, user_id, body, answer, answered_at, published)
- `blocks` (user_id, blocked_user_id) and `reports` (id, reporter_id, message_id, reason, status)
- `listening_days` (user_id, day, seconds)
- `reflection_settings` (user_id, enabled, consented_at)

All tables protected by Row Level Security. Entitlements and subscriptions are written only by Edge Functions handling RevenueCat and Stripe webhooks.

## 5. Non-functional requirements

- Paid audio served only through signed URLs that expire within minutes, issued after an entitlement check.
- Accessibility: dynamic text size, screen-reader labels on all controls, sufficient contrast in light and dark themes.
- Privacy: collect only email, display name, and usage needed for the features above. Privacy policy and App Store privacy labels must match.
- App Store and Google Play rules: restore purchases, account deletion, chat moderation (report, block, content filtering), subscription terms shown before purchase.
- Analytics: privacy-friendly events for plays, previews completed, purchases, club joins.

## 6. Milestones

1. **Skeleton:** monorepo, Expo app and Next.js site running, Supabase local setup, CI with lint/type-check/tests.
2. **Catalog + player:** titles, episodes, seed data from the prototype, audio player with background playback, previews.
3. **Accounts + sync:** sign-in, playback position sync, library.
4. **Purchases:** RevenueCat (mobile), Stripe (web), webhooks, entitlements, restore purchases.
5. **Admin panel:** content upload, preview generation, transcripts, club schedule.
6. **Club:** scheduled releases, real-time chat, Q&A, report/block, moderation queue, push notifications.
7. **Quote journal:** pen button, feed, stats, optional reflection with consent.
8. **Launch prep:** store listings, privacy policy and terms, beta testing (TestFlight and Play internal testing), security review of payments and RLS.

A smaller first public release can ship after milestone 5 (catalog, player, purchases, admin), adding the club and quote journal in later updates.

## 7. Open decisions

- Prices for single commentaries, collections, and the club.
- Club schedule: weekly episodes or another cadence.
- Whether free commentaries require an account.
- Recording workflow and audio format (target: AAC/M4A, 64–96 kbps mono for speech).
- Name check and trademark search for "Reel & Page".
- Languages: content (commentaries, transcripts, UI copy) is in Russian. Whether to add other languages later.
