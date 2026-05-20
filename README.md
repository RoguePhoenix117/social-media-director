# Social Media Director

Open-source, self-hosted social posting dashboard for turning public blog posts into reviewed social media drafts.

## MVP Scope

- Public blog URL import from any blogging platform.
- AI-assisted X and LinkedIn draft generation for review.
- First-run onboarding for operator login and self-hosted API credentials.
- Publish-now workflow through official provider APIs only.
- No browser automation, scraping logged-in dashboards, or automated UI clicking.

## Development

```bash
pnpm install
pnpm db:up
pnpm dev
```

Copy `.env.example` to `.env` and set `DATABASE_URL` before connecting live providers.

## TanStack Intent

This project includes `@tanstack/intent` so agents can load version-matched TanStack Start and Router skills from installed packages.

```bash
pnpm intent:list
pnpm intent:load:start
pnpm intent:load:server-functions
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

Migrations in `migrations/` are mounted into Postgres' Docker init directory and run
automatically the first time the `postgres-data` volume is created. To rebuild the
database from scratch and rerun all migrations:

```bash
pnpm db:reset
```

Use `pnpm db:logs` to watch Postgres startup and migration output, and `pnpm db:down`
to stop the container while keeping the local database volume.

This project uses the Postgres 18 Docker image, so the database volume is mounted
at `/var/lib/postgresql` per the image's current storage layout.

On first launch, the app shows a resumable onboarding wizard:

1. Create the local operator account.
2. Optionally add an OpenAI API key from `https://platform.openai.com/api-keys`.
3. Optionally add X credentials from `https://developer.x.com/` and LinkedIn credentials from `https://www.linkedin.com/developers/`.

Each step saves independently. If setup is interrupted, log in again and the dashboard shows the next unfinished step. Secrets are encrypted before being stored in Postgres.
