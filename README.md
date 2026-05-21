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

To clear all operators, sessions, settings, and posts but keep the existing schema
(Postgres container and migrations unchanged):

```bash
pnpm db:wipe
```

Use `pnpm db:logs` to watch Postgres startup and migration output, and `pnpm db:down`
to stop the container while keeping the local database volume.

This project uses the Postgres 18 Docker image, so the database volume is mounted
at `/var/lib/postgresql` per the image's current storage layout.

On first launch, the app shows a resumable onboarding wizard:

1. Create the local operator account.
2. Optionally add an OpenAI API key from `https://platform.openai.com/api-keys`.
3. Optionally add X publishing credentials (separate save).
4. Optionally add LinkedIn publishing credentials (separate save; completes onboarding).

Credentials are stored encrypted in Postgres—not in `.env`. Apply `migrations/0004_x_linkedin_onboarding_steps.sql` if upgrading an existing database (Docker init runs new migrations on a fresh volume only).

Each step saves independently. If setup is interrupted, log in again and the dashboard shows the next unfinished step. Secrets are encrypted before being stored in Postgres.

### X (Twitter) publishing credentials

Sign in at [developer.x.com](https://developer.x.com/en/portal/dashboard) (the same portal as console.x.com), create a **Project** and **App**, then open **User authentication settings**. Select **Read and write**, choose **Web App, Automated App or Bot**, and fill the required **Callback URI** and **Website URL** (for local dev, `http://127.0.0.1:5173/` works) before **Save Changes** enables.

The three values on the main **Keys and tokens** tab are **not** what you paste into this app:

| X Developer Portal label | Paste into Social Media Director? |
| --- | --- |
| API Key (Consumer Key) | No — OAuth Client ID only |
| API Key Secret (Consumer Secret) | No — OAuth Client Secret only |
| Bearer Token (top of page) | No — app-only token, cannot post as you |
| **Access Token** under **Authentication Tokens → Access Token and Secret → Generate** | **Yes** — paste as **X user access token** in Settings |
| **Refresh Token** (when **Include refresh token** / `offline.access` is enabled) | **Yes** — paste as **X refresh token** in Settings (optional but recommended) |

Publishing calls `POST https://api.x.com/2/tweets` with the user access token as a Bearer token. The refresh token is stored for future automatic renewal (not used by publish yet). See **Settings → X publishing** for the in-app tutorial and mapping table.
