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

Apply the SQL migrations in order:

```bash
psql "$DATABASE_URL" -f migrations/0001_initial.sql
psql "$DATABASE_URL" -f migrations/0002_onboarding.sql
psql "$DATABASE_URL" -f migrations/0003_stepwise_onboarding.sql
```

On first launch, the app shows a resumable onboarding wizard:

1. Create the local operator account.
2. Optionally add an OpenAI API key from `https://platform.openai.com/api-keys`.
3. Optionally add X credentials from `https://developer.x.com/` and LinkedIn credentials from `https://www.linkedin.com/developers/`.

Each step saves independently. If setup is interrupted, log in again and the dashboard shows the next unfinished step. Secrets are encrypted before being stored in Postgres.
