# Developer OAuth setup

Audience: the **deployer** (you, the person standing up an instance of Social Media Director). End users — the people who actually connect their X / LinkedIn accounts — should read [end-user-guide.md](./end-user-guide.md) instead.

This guide walks you through registering one X app and one LinkedIn app per instance, plus how to feed those credentials into Social Media Director via either environment variables or the in-app Setup Mode wizard.

> **Important:** You are registering **application credentials** here, not your own X or LinkedIn account. Do **not** click "Connect X" or "Connect LinkedIn" during this developer flow — that happens later, in the end-user flow, once the instance is configured.

## Architecture in one paragraph

Social Media Director runs as a single self-hosted instance. The deployer registers **one X app + one LinkedIn app** per instance and stores the client ID / client secret either in env vars or encrypted in the database. End users sign up, create a **project** (workspace), and connect their personal X + LinkedIn channels via OAuth. Each project owns its own connected channels, drafts, and publish history.

| Layer | Owned by | Credentials |
|-------|----------|-------------|
| Instance | Deployer | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Operator | End user | Email + password |
| Project | End user | OAuth-issued channel tokens (one X + one LinkedIn per project) |

---

## Step 1 — Register the X (Twitter) app

1. Sign in at [developer.x.com](https://developer.x.com/en/portal/dashboard) (same portal as `console.x.com`).
2. Create a new **Project**, then create an **App** inside that project.
3. Open the app's **User authentication settings** and configure:
   - **App permissions:** `Read and write`
   - **Type of App:** `Web App, Automated App or Bot`
   - **Callback URI / Redirect URL:**
     ```
     {APP_ORIGIN}/integrations/social/x/callback
     ```
     Local dev example: `http://localhost:5173/integrations/social/x/callback`
   - **Website URL:** `{APP_ORIGIN}` (e.g. `http://localhost:5173`)
4. Save the user-auth settings.
5. Open **Keys and tokens**. Under **OAuth 2.0 Client ID and Client Secret**, copy:
   - **Client ID** → goes into `X_CLIENT_ID` (or Setup Mode → X step)
   - **Client Secret** → goes into `X_CLIENT_SECRET` (or Setup Mode → X step)

> Do **not** paste the **API Key**, **API Key Secret**, **Bearer Token**, **Access Token**, or **Access Token Secret** from the same page. The OAuth 2.0 client ID/secret are different values, and they are the only ones the app uses.

**Scopes requested by the app at end-user OAuth time** (no action required — for reference):

```
tweet.read tweet.write users.read offline.access
```

---

## Step 2 — Register the LinkedIn app

1. Sign in at [linkedin.com/developers](https://www.linkedin.com/developers/apps).
2. Create an app. Associate it with a LinkedIn Page (LinkedIn requires this even if you only publish to personal profiles).
3. Open the app's **Products** tab and request:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**
4. Open the **Auth** tab and add the **Authorized redirect URL**:
   ```
   {APP_ORIGIN}/integrations/social/linkedin/callback
   ```
   Local dev example: `http://localhost:5173/integrations/social/linkedin/callback`
5. From the **Auth** tab, copy:
   - **Client ID** → goes into `LINKEDIN_CLIENT_ID` (or Setup Mode → LinkedIn step)
   - **Primary Client Secret** → goes into `LINKEDIN_CLIENT_SECRET` (or Setup Mode → LinkedIn step)

**Scopes requested by the app at end-user OAuth time** (no action required — for reference):

```
openid profile w_member_social
```

`openid` + `profile` are the OpenID Connect scopes used to identify the connected member; `w_member_social` is the scope needed to publish posts. The OIDC `sub` claim is turned into `urn:li:person:{sub}` and stored as the project's `author_urn`.

---

## Step 3 — Feed credentials into the instance

You have two options. They can be mixed (e.g. X via env, LinkedIn via DB) — **env always overrides the DB value**, and any provider sourced from env is rendered read-only in Settings → Developers with a "Configured via environment" badge.

### Option A — Environment variables

Recommended for production. Set the following in your process environment (or `.env` for local dev):

```bash
X_CLIENT_ID=...
X_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

On the next instance boot, `instance_meta.configured` flips to true and the app skips Setup Mode entirely.

### Option B — In-app Setup Mode wizard

Recommended for local development or when you don't want to manage env vars. On a fresh instance with no env credentials set, visiting any URL redirects to `/setup`. The wizard walks you through:

1. **Welcome** — confirms you understand you're registering app credentials, not personal channels.
2. **X step** — paste `Client ID` + `Client Secret` from Step 1.
3. **LinkedIn step** — paste `Client ID` + `Client Secret` from Step 2.
4. **Confirm & save** — writes to the encrypted `instance_config` table and marks the instance configured.

Secrets are encrypted at rest using `APP_ENCRYPTION_KEY` and are never returned to the client. The Settings → Developers section shows only the public client IDs and `configured: true` flags.

---

## Step 4 — Set `INSTANCE_SETUP_KEY` before exposing to the internet

Setup Mode is wide open on `localhost` so you can boot the app in development without ceremony. On any **non-localhost origin**, the `/setup` route requires a setup key:

```bash
INSTANCE_SETUP_KEY=<long-random-string>
```

Once set, the setup wizard requires `?setup_key=<value>` on the URL — without a valid key the route shows an "Instance not configured" static page with instructions to set the key. After setup completes you can leave the env var in place; it only gates `/setup`, not normal use.

> **Critical for production:** complete the setup wizard (or set env credentials) **before** exposing the instance to the internet. Until `instance_meta.configured = true`, anyone with knowledge of the setup key can register OAuth apps for the instance.

The first operator who signs up after the instance is configured becomes the **instance owner** and is the only operator able to edit OAuth credentials post-setup via Settings → Developers.

---

## OAuth redirect URLs — copy/paste reference

| Provider | Callback URI |
|----------|--------------|
| X        | `{APP_ORIGIN}/integrations/social/x/callback` |
| LinkedIn | `{APP_ORIGIN}/integrations/social/linkedin/callback` |

Local dev examples:

```
http://localhost:5173/integrations/social/x/callback
http://localhost:5173/integrations/social/linkedin/callback
```

If you change `APP_ORIGIN`, you must update the callback URL in the provider developer portal to match — OAuth providers reject any redirect that does not exactly match one of the registered URLs.

---

## Security checklist before going live

- [ ] X app callback URL exactly matches `{APP_ORIGIN}/integrations/social/x/callback`
- [ ] LinkedIn app authorized redirect URL exactly matches `{APP_ORIGIN}/integrations/social/linkedin/callback`
- [ ] `X_CLIENT_ID` / `X_CLIENT_SECRET` set (or registered via Setup Mode)
- [ ] `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` set (or registered via Setup Mode)
- [ ] `INSTANCE_SETUP_KEY` set when `APP_ORIGIN` is not `localhost` / `127.0.0.1`
- [ ] `APP_ENCRYPTION_KEY` is a long random secret (used to encrypt OAuth client secrets + user channel tokens at rest)
- [ ] `SESSION_SECRET` is a long random secret
- [ ] Postgres backups configured (channel tokens are encrypted but persistent)
- [ ] First operator account signed up — they become the instance owner

---

## Troubleshooting

**"Instance not configured" page after deploy** — env credentials aren't readable in the running process, or you haven't completed the Setup Mode wizard. Check `process.env.X_CLIENT_ID` is set, or visit `/setup?setup_key=...` if you're using DB-backed credentials.

**OAuth callback returns `redirect_uri_mismatch`** — the URL the app sent to the provider doesn't exactly match what's registered in the provider portal. Most commonly the protocol (`http` vs `https`), the host (`localhost` vs `127.0.0.1`), or a trailing slash differs.

**"Settings → Developers" is read-only with a "Configured via environment" badge** — that provider's credentials are env-sourced. Unset the env var (and restart) if you want to edit via the UI.

**End user can't see "Connect X" tile** — the instance isn't configured for X yet. Check Settings → Developers as the instance owner; `xConfigured` and `linkedinConfigured` must both be true before the dashboard surfaces the providers.
