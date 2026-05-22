# Social Media Director

Open-source, self-hosted social posting dashboard for turning public blog posts into reviewed social media drafts.

## MVP scope

- Public blog URL import from any blogging platform.
- AI-assisted X and LinkedIn draft generation for review.
- One-click OAuth connection for X and LinkedIn — no manual token pasting.
- Project-scoped workspaces: each project owns its own X + LinkedIn channels, drafts, and publish history.
- First-run onboarding for the operator account, first project, channel connection, and AI setup.
- Publish-now workflow through official provider APIs only.
- No browser automation, no scraping logged-in dashboards, no automated UI clicking.

## Documentation

- [`docs/developer-oauth-setup.md`](docs/developer-oauth-setup.md) — **deployer guide**. How to register the X + LinkedIn apps for an instance, set OAuth callback URLs, choose between env vars and the in-app Setup Mode wizard, and protect `/setup` with `INSTANCE_SETUP_KEY`.
- [`docs/end-user-guide.md`](docs/end-user-guide.md) — **operator guide**. Sign up, create a project, connect channels via OAuth, draft and publish.
- [`docs/CODE_INDEX.md`](docs/CODE_INDEX.md) — module catalog (discover-before-create).
- [`docs/adr/`](docs/adr) — architecture decision records.
- [`plan.md`](plan.md) — authoritative implementation plan for the OAuth + projects migration.

## Quick start (development)

```bash
pnpm install
cp .env.example .env       # fill in SESSION_SECRET, APP_ENCRYPTION_KEY
pnpm db:up                 # boots local Postgres in Docker
pnpm dev                   # http://localhost:5173
```

On first boot you'll be redirected to `/setup` — the in-app wizard that registers your X + LinkedIn OAuth apps. Follow [`docs/developer-oauth-setup.md`](docs/developer-oauth-setup.md) for the portal steps.

Once setup is done, sign up as the first operator (you become the instance owner), create a project, and authorize X + LinkedIn via the Connect Channels modal. See [`docs/end-user-guide.md`](docs/end-user-guide.md) for the end-user walkthrough.

## TanStack Intent

This project includes `@tanstack/intent` so agents can load version-matched TanStack Start and Router skills from installed packages.

```bash
pnpm intent:list
pnpm intent:load:start
pnpm intent:load:server-functions
pnpm intent:load:auth
```

## Database

The local database runs in Docker Desktop with Postgres. Start it with:

```bash
pnpm db:up
```

The default `.env.example` connection string matches the Docker container:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_media_director
```

Migrations in `migrations/` are mounted into Postgres' Docker init directory and run automatically the first time the `postgres-data` volume is created. To rebuild the database from scratch and rerun all migrations:

```bash
pnpm db:reset
```

To clear all operators, sessions, settings, and posts but keep the existing schema (Postgres container and migrations unchanged):

```bash
pnpm db:wipe
```

Use `pnpm db:logs` to watch Postgres startup and migration output, and `pnpm db:down` to stop the container while keeping the local database volume.

This project uses the Postgres 18 Docker image, so the database volume is mounted at `/var/lib/postgresql` per the image's current storage layout.

## Security

All secrets are encrypted at rest in Postgres with `APP_ENCRYPTION_KEY`:

- OAuth app credentials (`X_CLIENT_SECRET`, `LINKEDIN_CLIENT_SECRET`) stored in `instance_config` when set via the Setup Mode UI instead of env vars.
- User OAuth access + refresh tokens stored in `provider_accounts`.
- AI backend keys stored in `operator_settings`.

When deploying to a public host, set `INSTANCE_SETUP_KEY` before exposing port 5173 — see [`docs/developer-oauth-setup.md`](docs/developer-oauth-setup.md#step-4--set-instance_setup_key-before-exposing-to-the-internet).
