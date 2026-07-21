Volleague App

A [Next.js](https://nextjs.org) app (App Router, Next.js 16) backed by [Supabase](https://supabase.com) for the database, auth, and storage.

## Prerequisites

- Node.js 20.9+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — running, before you start Supabase locally
- The Supabase CLI (no separate install needed — invoked via `npx supabase`)

## Getting started

```bash
npm install
```

### Set up Supabase locally

This project uses one shared Supabase cloud project. You develop against a local Postgres + Auth + Studio stack running in Docker (via the Supabase CLI), and push schema changes to the shared cloud project as SQL migrations tracked in `supabase/migrations/`.

1. Ask the project owner to invite you as a collaborator on the Supabase project (Supabase dashboard → project → Project Settings → Team), and to give you the project ref (the id in the dashboard URL, `supabase.com/dashboard/project/<ref>`).
2. Log in to the CLI (opens a browser, one-time):
   ```bash
   npx supabase login
   ```
3. Link this repo to the cloud project:
   ```bash
   npx supabase link --project-ref <ref>
   ```
4. Start the local stack (first run pulls Docker images, takes a few minutes):
   ```bash
   npx supabase start
   ```
5. Apply migrations to your local database (also seeds reference data like roles/positions):
   ```bash
   npx supabase db reset
   ```

`supabase start` prints an `API_URL` and `PUBLISHABLE_KEY` (formerly called `anon key`) — you'll need those next. You can reprint them anytime with `npx supabase status`.

### Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=<API_URL from supabase status>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<PUBLISHABLE_KEY from supabase status>
```

Use the **local** values here, not the cloud project's — `.env.local` is for `npm run dev` against your local Docker stack. The cloud project's keys (Project Settings → API in the Supabase dashboard) are only needed for deployed environments (e.g. Vercel env vars).

Don't confuse the API keys with the **S3 protocol** access/secret keys shown under Project Settings → Storage — those are unrelated, only for connecting external S3 clients to Supabase Storage.

### Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local Supabase Studio (table editor, SQL editor, auth users) is at [http://127.0.0.1:54323](http://127.0.0.1:54323) while `supabase start` is running.

## Working with the database

- **Schema changes**: add a new file under `supabase/migrations/` (`npx supabase migration new <name>`), write plain SQL, then `npx supabase db reset` to apply it locally from scratch.
- **Seed / local data changes**: add them to `supabase/seed.sql`, then run `npx supabase db reset` to rebuild the local database and re-apply the seed. Don't insert local data by hand in Studio — it won't survive the next reset unless it's in `seed.sql`.
- **Catching up on someone else's new migration**: `npx supabase migration up` applies only pending migrations (tracked in a `supabase_migrations` table) without touching your existing local data — faster than a full `db reset` when you don't need a clean slate.
- **Reversing a migration**: `npx supabase migration down --last <n>` rolls back the last `n` migration versions. Note this isn't a per-migration "down" script like some other tools — it works by resetting the database and replaying all migrations except the last `n`, so any local data not in `seed.sql` is lost.
- **Push to the cloud project**: `npx supabase db push` once you're happy with a migration. Since the project is shared, coordinate before pushing so migrations don't conflict.
- **Pull cloud schema changes made outside a migration** (e.g. someone edited a table in the dashboard): `npx supabase db pull`.

### Schema overview

See `supabase/migrations/` for the full source of truth. Broad strokes:

- `users` — mirrors `auth.users` (`id` is the same UUID), auto-created via a trigger on signup.
- `roles` / `user_roles` — global roles (`admin`, `league_admin`). `admin` can do anything; `league_admin` is scoped to managing match scores/stats and isn't assigned to anyone yet — it's wired up for future use.
- `team_users` — team membership; `is_captain` scopes captain permissions to a single team (a user can be captain of one team and a regular player on another). At most one captain per team is enforced at the DB level.
- `schedules` / `sets` / `set_stats` — matches, per-set scores, and per-player per-set stat lines.
- `player_stats` — a **view** (not a table) aggregating `set_stats`, grouped by `(user_id, team_id)` so a player's numbers don't blend across teams/seasons.
- `jerseys` / `jersey_preferences` / `player_jerseys` — kit catalog, teams' ranked kit preferences, and each player's assigned size per kit.

All tables have Row Level Security enabled: any signed-in user can read everything; writes are gated by role (`is_admin()`, `is_team_captain(team_id)`, `has_role('league_admin')` helper functions, defined in the initial migration).

## Project structure notes

- `lib/supabase/client.ts` — browser Supabase client.
- `lib/supabase/server.ts` — Server Component Supabase client (reads cookies via `next/headers`).
- `proxy.ts` (project root) — refreshes the auth session cookie on every request. This is **not** `middleware.ts` — Next.js 16 renamed the middleware convention to `proxy`. See `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` if you're used to older Next.js versions; several APIs here differ from what you may expect (e.g. `cookies()`/`headers()` are async-only, no sync fallback).

## Deploying

Deploy on [Vercel](https://vercel.com/new) or any Node host that supports Next.js 16. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the deployment environment to your **cloud** Supabase project's values (Project Settings → API), not the local ones. Run `npx supabase db push` to make sure the cloud project's schema is up to date before deploying.