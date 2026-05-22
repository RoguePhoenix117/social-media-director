# Developer OAuth setup

Audience: the **deployer** (you, the person standing up an instance of Social Media Director). End users — the people who actually connect accounts and publish — should read [end-user-guide.md](./end-user-guide.md) instead.

This guide walks you through registering one X app and one LinkedIn app per instance, plus how to feed those credentials into Social Media Director via either environment variables or the in-app Setup Mode wizard.

> **Important:** You are registering **application credentials** (OAuth 2.0 Client ID + Client Secret) for the instance. You are **not** connecting your personal X or LinkedIn account here, and you must **not** paste Bearer Tokens, Access Tokens, or use **Generate** for your own @username in the X console. Operators connect personal accounts later via **Connect Channels** (standard OAuth consent only).

## Deployer vs operator — two different jobs

| | **Deployer (you, this guide)** | **Operator ([end-user guide](./end-user-guide.md))** |
|---|---|---|
| Goal | Register the **app** with X / LinkedIn once per instance | Connect **their** X / LinkedIn to a project |
| Visit [console.x.com](https://console.x.com/)? | **Yes** — create/configure the app | **No** — never needed |
| Visit [docs.x.com](https://docs.x.com/overview)? | Optional — OAuth 2.0 app setup reference | **No** |
| What to copy/paste | OAuth 2.0 **Client ID** + **Client Secret** only | **Nothing** — click a channel tile → sign in → **Authorize** |
| Personal social login | Only to sign into the X console as a **developer** | On X/LinkedIn's consent screen during **Connect Channels** |

The [X Developer Platform](https://docs.x.com/overview) documents API access for **applications**. Social Media Director uses **OAuth 2.0 Authorization Code with PKCE**: the deployer registers the app; each operator later authorizes that app to post on their behalf. See the [OAuth 2.0 overview](https://docs.x.com/fundamentals/authentication/oauth-2-0/overview).

> **Note on docs.x.com wording:** Pages like [Make your first request](https://docs.x.com/x-api/getting-started/make-your-first-request) say "get your API keys" — for this product that means the app's **OAuth 2.0 Client ID and Client Secret** from **Keys & tokens → OAuth 2.0 Keys**, not a personal Access Token and not the App-Only Bearer Token.

## Architecture in one paragraph

Social Media Director runs as a single self-hosted instance. The deployer registers **zero, one, or both** of X + LinkedIn OAuth apps per instance and stores client ID / client secret in the project-root **`.env` file only** (never Postgres). End users sign up, create a **project** (workspace), and connect their personal X + LinkedIn channels via OAuth — but only for providers the deployer enabled. Each project owns its own connected channels, drafts, and publish history.

| Layer | Owned by | Credentials |
|-------|----------|-------------|
| Instance | Deployer | `X_CLIENT_ID`, `X_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` in `.env` |
| Operator | End user | Email + password |
| Project | End user | OAuth-issued channel tokens (one X + one LinkedIn per project) |

---

## Step 1 — Register the X (Twitter) app *(optional)*

Skip this section if you do not need X. Operators cannot connect X until credentials are added (here or in Settings → Developers).

You are creating an **application** in the X console — the same kind of credential described in the [X Developer Platform](https://docs.x.com/overview) docs. The X account you use to sign into [console.x.com](https://console.x.com/) only needs permission to create developer apps; it does **not** have to be the account that will publish posts. Operators connect their own accounts later via OAuth.

1. Sign in at [console.x.com](https://console.x.com/).
2. Create a new **Project**, then create an **App** inside that project (or open an existing app).
3. Open the **Keys & tokens** tab → next to **OAuth 2.0 Keys**, click **Edit settings** (or use the app **Settings** link).
4. Under **Authentication settings**:
   - **App permissions:** `Read and write`
   - **Type of App:** `Web App, Automated App or Bot`
5. Under **App info**, set (X rejects the hostname `localhost` — use `127.0.0.1`):
   - **Callback URI / Redirect URL:**
     ```
     {APP_ORIGIN}/integrations/social/x/callback
     ```
     Local dev example: `http://127.0.0.1:5173/integrations/social/x/callback` (match your port if Vite uses another, e.g. `5174`)
   - **Website URL:** `{APP_ORIGIN}` (e.g. `http://127.0.0.1:5173`)
   - Set the same value in your `.env` as `APP_ORIGIN` and open the app at that URL in your browser.
6. Save, then return to **Keys & tokens** → scroll to **OAuth 2.0 Keys** (not OAuth 1.0, not Bearer Token).
7. Copy into Setup Mode or env:
   - **Client ID** (visible in OAuth 2.0 Keys)
   - **Client Secret** (click **Show**, then copy)

### Copy these (OAuth 2.0 Keys only)

| Console label | Use in Social Media Director? |
|---------------|-------------------------------|
| OAuth 2.0 **Client ID** | Yes → `X_CLIENT_ID` / Setup Mode |
| OAuth 2.0 **Client Secret** | Yes → `X_CLIENT_SECRET` / Setup Mode |

### Never copy these

| Console label | Why |
|---------------|-----|
| **Bearer Token** (App-Only Authentication) | App-only token; cannot post as end users |
| **OAuth 1.0** Consumer Key / Access Token | Wrong OAuth version |
| OAuth 2.0 **Generate** (for your own @account) | Personal user token — end users connect via Connect Channels later |
| Any **Access Token** or **Refresh Token** for your username | Personal credentials, not app credentials |

**Scopes requested by the app at end-user OAuth time** (no action required — for reference):

```
tweet.read tweet.write users.read offline.access
```

---

## Step 2 — Register the LinkedIn app *(optional)*

Skip this section if you do not need LinkedIn. Operators cannot connect LinkedIn until credentials are added.

1. Sign in at [linkedin.com/developers](https://www.linkedin.com/developers/apps).
2. Create an app. Associate it with a LinkedIn Page (LinkedIn requires this even if you only publish to personal profiles).
3. Open the app's **Products** tab and request:
   - **Sign In with LinkedIn using OpenID Connect**
   - **Share on LinkedIn**
4. Open the **Auth** tab and add the **Authorized redirect URL**:
   ```
   {APP_ORIGIN}/integrations/social/linkedin/callback
   ```
     Local dev example: `http://127.0.0.1:5173/integrations/social/linkedin/callback`
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

OAuth app credentials always live in the project-root `.env` file. The Setup Mode wizard and Settings → Developers **merge** updates into that file — they never replace the whole file and never write secrets to Postgres.

You have two ways to set them:

### Option A — Edit `.env` directly (recommended for production)

Set the following in `.env` (or your process environment):

```bash
X_CLIENT_ID=...
X_CLIENT_SECRET=...
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

Restart the dev server / process after editing so `process.env` reloads.

### Option B — CLI merge script

From the project root:

```bash
pnpm oauth:env -- --x-client-id=... --x-client-secret=... --linkedin-client-id=... --linkedin-client-secret=...
```

Only the OAuth keys you pass are updated; every other line in `.env` is preserved. If `.env` does not exist yet, it is created from `.env.example`.

Clear a key (remove its line):

```bash
pnpm oauth:env -- --clear-x-client-id
```

### Option C — In-app Setup Mode wizard

On a fresh instance, visiting any URL redirects to `/setup`. The wizard walks you through:

1. **Welcome** — confirms you understand you're registering app credentials, not personal channels. X and LinkedIn are both optional.
2. **X step** — paste `Client ID` + `Client Secret` from Step 1, or skip.
3. **LinkedIn step** — paste `Client ID` + `Client Secret` from Step 2, or skip.
4. **Confirm & save** — merges any credentials into `.env` and marks setup complete (even with zero providers).

Settings → Developers uses the same `.env` merge behavior after setup. Secrets are never returned to the browser; the UI shows only client IDs and configured flags.

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

Local dev examples (use `127.0.0.1`, not `localhost`, for X):

```
http://127.0.0.1:5173/integrations/social/x/callback
http://127.0.0.1:5173/integrations/social/linkedin/callback
```

If Vite binds to another port (e.g. `5174`), use that port everywhere — X console, `APP_ORIGIN`, and the browser URL must match exactly.

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

**End user can't see "Connect X" tile** — X OAuth was not registered for this instance. The instance owner can add credentials in Settings → Developers; until then the X tile shows "Not enabled".
