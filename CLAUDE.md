# Reel & Page

Audio-first app where one critic (Liliya, the owner) publishes spoken commentaries on films and short stories. Listeners browse for free, hear a 5-minute preview, and pay to unlock. A monthly club adds a member chat and Q&A with the host. Full feature list: `SPEC.md`. Clickable reference for screens and flows: `prototype/reel-and-page.html` (open it in a browser).

## Who you are working with

Liliya is the author, project owner, and business decision maker. She is the critic behind the content and makes product and business calls.

Kanan is an experienced data engineer with 25 years of IT expertise (Python, SQL, Airflow, Snowflake) but new to mobile and frontend work. Explain mobile- and payment-specific concepts briefly the first time they come up. Ask before choices that are expensive to undo (schema changes after launch, new paid services, anything touching payments or auth).

## Stack

- **Monorepo:** pnpm workspaces + Turborepo, TypeScript everywhere (strict mode).
- **Mobile (`apps/mobile`):** Expo (React Native) with Expo Router. EAS Build for iOS/Android builds.
- **Audio:** `react-native-track-player` for background playback, lock-screen and Control Center controls, speed, and resume.
- **Web (`apps/web`):** Next.js (App Router). Public catalog pages, web player, Stripe checkout, and the host admin panel under `/admin`.
- **Backend:** Supabase: Postgres, Auth (email + Sign in with Apple + Google), Storage for audio, Realtime for club chat, Edge Functions for webhooks and server logic. Row Level Security on every table.
- **In-app payments:** RevenueCat over Apple App Store and Google Play (one-time purchases + club subscription).
- **Web payments:** Stripe Checkout + webhooks.
- **Entitlements:** a single source of truth in Postgres (`entitlements` table), written only by server-side webhook handlers (RevenueCat and Stripe). Clients never grant themselves access.
- **Shared code (`packages/shared`):** types generated from the Supabase schema, API helpers, constants.

## Repository layout

```
apps/mobile        Expo app (iOS + Android)
apps/web           Next.js site + /admin
packages/shared    Types, Supabase client, shared logic
supabase/          Migrations, seed data, Edge Functions
prototype/         HTML prototype (reference only, not shipped)
```

## Working rules

- Build in the milestone order in `SPEC.md`. Finish and verify one milestone before starting the next.
- Every schema change is a migration in `supabase/migrations`. Never edit the database by hand.
- Never commit secrets. Use `.env.local` (git-ignored) and keep `.env.example` up to date with variable names only.
- Paid audio must never be reachable by unpaid users: serve full episodes only through short-lived signed URLs issued after an entitlement check. Previews are separate 5-minute files.
- Write tests for entitlement logic, webhook handlers, and RLS policies. These protect revenue and privacy.
- Prices are not decided yet. Store them in the database and in the store/Stripe dashboards; never hard-code prices in the apps.
- Keep the visual design original (not copied from any other app). The prototype shows the intended identity: deep red and brass accents, a classic serif display face, ticket-stub and film-poster motifs, light and dark themes.
- Commit in small, described steps. Run lint, type-check, and tests before each commit.

## Useful commands (fill in as the project grows)

- `pnpm install` — install everything
- `pnpm dev` — run web + mobile dev servers
- `supabase start` — local database
- `pnpm test` — all tests
