# Campaign Studio

Fully configured SvelteKit (runes mode) project that uses Drizzle ORM on the server and Supabase as the Postgres provider + auth layer.

## Getting started

1. Install dependencies (this repo uses `pnpm`):

```sh
pnpm install
```

2. Start the Supabase-local stack (requires Docker Desktop running so the Supabase CLI can spin up Postgres, Studio, etc.). From the repository root:

```sh
supabase start
```

3. Launch the dev server:

```sh
pnpm run dev -- --open
```

4. When your session is done, stop the Supabase services:

```sh
supabase stop
```

## Architecture notes

- All server-side database access (including campaign reads and writes) uses Drizzle via `src/lib/server/db`, keeping schema definitions and migrations in sync with Postgres. Treat Drizzle as the primary server data layer.
- Supabase SDK lives in the root-level Supabase project (`/supabase`) and is used for auth/session-aware helpers under `src/hooks.server.ts` + the layout. Reserve the SDK for auth, storage, realtime, or any client-side interactions that must respect row-level security.
- For this MVP you can think of Supabase as "Postgres + auth provider," while Drizzle is the typed query layer that runs inside SvelteKit server actions.
- Landing page asset configuration is stored in Postgres (`landing_page_asset_sets`) and validated against the server schema before use. AI-selectable media options are curated in `media_assets` and injected into the generation input as an approved catalog. If no active row exists or validation fails, the app falls back to `src/lib/server/agents/config/landing-page-assets.ts`.

## Quality / build commands

Run these regularly (or before committing) to keep the project healthy:

```sh
pnpm run format
pnpm run check
pnpm run build
```

The Supabase schema is rooted in `/supabase`, so use the Supabase CLI from the repo root when you need migrations, Studio, or other platform tools.
