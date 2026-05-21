# OAuth Channel Connection & Projects — Implementation Plan

This document is the authoritative implementation spec for replacing manual X/LinkedIn token paste with Postiz-style click-to-connect OAuth, introducing a **Projects** model, and separating **developer setup** from **end-user channel connection**.

**Status:** Approved via design interview (grill-me session, 2026-05-21).

## Code organization (required for all PRs)

Follow `.cursor/rules/` and `docs/CODE_INDEX.md`. Summary:

| Rule | Requirement |
|------|-------------|
| Routes | ≤150 lines; composition only — extract to `app/components/` or `app/features/` |
| Components | Self-contained; reuse existing UI; feature folders e.g. `app/components/connect-channels/` |
| Server | `createServerFn` in `app/server/`; logic in `app/lib/server/` |
| RAG | Search codebase + `docs/CODE_INDEX.md` before creating; update index when adding canonical modules |
| Legacy | Do **not** grow `app/routes/index.tsx` — extract onboarding/dashboard into feature modules (PR4) |

**Reference UI (inspiration only — do not copy pixel-for-pixel):**

| Screenshot | Purpose |
|------------|---------|
| `researchScreenshots/postizChannelConnectionUI.png` | Connect Channels grid modal |
| `researchScreenshots/XUIthroughGitRoomAPI.png` | Standard X OAuth consent screen |
| `researchScreenshots/UIAfterRedirect.png` | "Adding Channel" loading interstitial |
| `researchScreenshots/oneConnectedChannelConnectMoreOrContinue.png` | Connected channel list + Continue |
| `researchScreenshots/PostizAgentDashboard.png` | Dashboard channel selector pattern |
| `researchScreenshots/GlobalSettings.png` | Settings → Developers section pattern |

---

## Locked product decisions

| Topic | Decision |
|-------|----------|
| OAuth app ownership | **Deployer-owned.** One X app + one LinkedIn app per instance. End users never create developer projects. |
| Developer vs end-user | Developer registers **app credentials** (client ID/secret) only. End users **connect channels** via OAuth. Developer must NOT connect personal channels during setup. |
| Instance config | **Hybrid:** env vars override DB. If not in env, **Setup Mode UI** on first boot. **Settings → Developers** for ongoing edits. |
| Setup security | `INSTANCE_SETUP_KEY` required on public hosts (skip on localhost). First signed-up operator is **instance owner** — only they edit Developers settings. Env-configured creds show read-only badge in UI. |
| Tenancy | **Projects** (not "organizations"). Users can belong to multiple projects. |
| Channels per project | **1 X + 1 LinkedIn** per project for MVP. Multiple accounts = create multiple projects. |
| Sign-up flow | Email/password → **Create first project** (prefilled `default-project`) → Connect Channels modal → AI setup → Dashboard |
| Onboarding order | Connect Channels **before** AI setup. "Continue without channels" allowed; publish gated until ≥1 channel connected. |
| Connect Channels UI | Centered modal (NOT full viewport). Dismiss via: click outside, X (top-right), Continue/Skip (bottom-right). |
| Dashboard | Persistent **channel progress button** (e.g. `1/2 Channels`) reopens Connect Channels modal. |
| New project | Name only. Auto-open Connect Channels modal when project has zero channels. |
| Provider grid | **X + LinkedIn live.** All other platforms shown as disabled **"Coming soon"** tiles. |
| Data scoping | **Project-scoped:** channels, posts, drafts, imports, publish history, per-project onboarding flags. **Operator-scoped:** AI backend config (`operator_settings`). |
| Migration | **Hard cutover.** Remove manual token paste. No migration of existing `app_settings` tokens. |
| X OAuth protocol | **OAuth 2.0 PKCE** (authorization code). NOT OAuth 1.0a. |
| Build order | PR1 Schema → PR2 Setup UI → PR3 X OAuth → PR4 Connect modal + onboarding → PR5 LinkedIn → PR6 Switcher + docs |

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  INSTANCE LEVEL (developer / deployer)                          │
│  instance_config: X_CLIENT_ID, X_CLIENT_SECRET,                 │
│                   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET  │
│  (env vars override DB values)                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  OPERATOR LEVEL (user identity)                                 │
│  operators, operator_sessions, operator_settings (AI config)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROJECT LEVEL (workspace / brand)                              │
│  projects, operator_projects, provider_accounts, master_posts   │
└─────────────────────────────────────────────────────────────────┘
```

### Two flows

**Developer flow (once per instance):**
1. Deploy instance
2. Register X + LinkedIn apps in provider developer portals
3. Either set env vars OR complete Setup Mode UI (paste client ID/secret)
4. Set `INSTANCE_SETUP_KEY` before exposing to internet
5. Do NOT connect personal social accounts during this step

**End-user flow:**
1. Sign up (email + password)
2. Create first project (`default-project` prefilled)
3. Connect Channels modal → click X or LinkedIn → OAuth consent → "Adding Channel" → connected
4. AI setup (once per operator, skippable)
5. Dashboard — publish using active project's connected channels

### OAuth redirect URLs (document for deployers)

| Provider | Callback URI |
|----------|--------------|
| X | `{APP_ORIGIN}/integrations/social/x/callback` |
| LinkedIn | `{APP_ORIGIN}/integrations/social/linkedin/callback` |

Local dev example: `http://localhost:5173/integrations/social/x/callback`

---

## Dependency graph (agent assignment order)

```
PR1 (Schema) ──────┬──► PR2 (Setup UI)
                   ├──► PR3 (X OAuth) ──► PR4 (Connect modal + onboarding)
                   └──► PR5 (LinkedIn OAuth) ──► PR4 (partial integration)
PR4 + PR5 ──► PR6 (Switcher, progress button, docs)
```

| PR | Can start after | Parallel with |
|----|-----------------|---------------|
| PR1 | — | — |
| PR2 | PR1 | PR3 (after PR1) |
| PR3 | PR1 | PR2 |
| PR4 | PR3 | — |
| PR5 | PR1 | PR3, PR4 (routes only after PR3 pattern exists) |
| PR6 | PR4 + PR5 | — |

---

## PR1 — Schema, projects, instance config, session

**Agent goal:** Database foundation and server primitives. No UI except types/bootstrap changes.

### Migration file

Create `migrations/0007_projects_oauth.sql`:

```sql
-- Instance configuration (OAuth app credentials, encrypted)
create table instance_config (
  key text primary key,
  value_ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table instance_meta (
  id integer primary key default 1 check (id = 1),
  setup_completed_at timestamptz,
  configured boolean not null default false
);

insert into instance_meta (id) values (1);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  channels_onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table operator_projects (
  operator_id uuid not null references operators(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (operator_id, project_id)
);

create index operator_projects_project_id_idx on operator_projects(project_id);

-- Operators: instance owner flag
alter table operators
  add column is_instance_owner boolean not null default false;

-- Sessions: active project
alter table operator_sessions
  add column active_project_id uuid references projects(id) on delete set null;

-- Provider accounts: project-scoped, one per provider per project
alter table provider_accounts
  add column project_id uuid references projects(id) on delete cascade,
  add column profile_image_url text,
  add column username text,
  add column author_urn text;  -- LinkedIn urn:li:person:... or urn:li:organization:...

-- Drop old global unique constraint; add project-scoped unique
alter table provider_accounts drop constraint if exists provider_accounts_provider_external_account_id_key;
create unique index provider_accounts_project_provider_idx
  on provider_accounts (project_id, provider)
  where project_id is not null;

-- Project-scoped content
alter table master_posts add column project_id uuid references projects(id) on delete cascade;
alter table content_sources add column project_id uuid references projects(id) on delete cascade;

create index master_posts_project_id_idx on master_posts(project_id);
create index content_sources_project_id_idx on content_sources(project_id);
create index provider_accounts_project_id_idx on provider_accounts(project_id);

-- Short-lived OAuth state (CSRF + PKCE verifier)
create table oauth_states (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  provider text not null check (provider in ('x', 'linkedin')),
  state_token text not null unique,
  code_verifier text not null,
  redirect_after text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index oauth_states_expires_at_idx on oauth_states(expires_at);
```

### New server modules

| File | Responsibility |
|------|----------------|
| `app/lib/server/instance-config.ts` | `getInstanceOAuthConfig()`, `saveInstanceOAuthConfig()`, `isInstanceConfigured()`. Env vars (`X_CLIENT_ID`, `X_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`) override DB. Never expose secrets to client. |
| `app/lib/server/projects.ts` | `createProject()`, `listOperatorProjects()`, `getProject()`, `setActiveProject()`, `slugify(name)`, `ensureOperatorProjectAccess()` |
| `app/lib/server/provider-accounts.ts` | `listProjectChannels()`, `upsertProviderAccount()`, `disconnectChannel()`, `getProjectChannel(provider)` |
| `app/lib/server/setup-guard.ts` | `assertSetupKeyValid()`, `isLocalhostOrigin()` — enforce `INSTANCE_SETUP_KEY` when not localhost |

### Modify existing files

| File | Changes |
|------|---------|
| `app/lib/server/session.ts` | Extend `OperatorSession` with `activeProjectId`, `isInstanceOwner`. Join `operator_sessions.active_project_id` in `readOperatorSession()`. |
| `app/lib/server/settings.ts` | Remove `xAccessToken`, `xRefreshToken`, `linkedinAccessToken`, `linkedinAuthorUrn` from `socialSettingKeys` / `AppSettings`. Keep AI settings unchanged. Update `getPublicSettingsStatus()` to derive `xConfigured` / `linkedinConfigured` from active project's `provider_accounts` (or accept `projectId` param). |
| `app/server/dashboard.ts` | Update `getBootstrapState()` to return: `instanceConfigured`, `activeProjectId`, `projects`, `connectedChannels`, `isInstanceOwner`. Update `saveAccountStep` to set `is_instance_owner = true` on first operator. **Do not remove** `saveXStep`/`saveLinkedInStep` yet (PR4). |
| `app/lib/bootstrap-query.ts` | Extend `BootstrapState` type with new fields. |
| `.env.example` | Add `INSTANCE_SETUP_KEY`, `X_CLIENT_ID`, `X_CLIENT_SECRET`. Remove manual token vars and paste guidance. |

### Onboarding step renumbering (prepare constants)

Define in `app/lib/onboarding-steps.ts`:

| Step | ID | Name |
|------|----|------|
| Account | 1 | `account` |
| Create project | 2 | `create_project` |
| Connect channels | 3 | `connect_channels` |
| AI setup | 4 | `ai_setup` |
| Complete | 5 | `complete` |

Replace magic numbers `1-4` gradually in PR4.

### Tests

| File | Coverage |
|------|----------|
| `tests/projects.test.ts` | Create project, slug uniqueness, operator membership |
| `tests/instance-config.test.ts` | Env override, encrypted DB storage, `isInstanceConfigured()` |
| Update `tests/settings.test.ts` | Remove token-related `app_settings` assertions |

### Acceptance criteria (PR1)

- [ ] Migration applies cleanly via `pnpm db:reset` (or manual apply)
- [ ] `createProject({ name: 'default-project' })` creates project + `operator_projects` row
- [ ] `getInstanceOAuthConfig()` returns env values when set, else DB values
- [ ] Session includes `activeProjectId` after project creation
- [ ] `pnpm test` and `pnpm typecheck` pass
- [ ] No UI changes required yet beyond bootstrap type updates

### Do NOT in PR1

- Do not implement OAuth routes
- Do not remove manual token paste UI
- Do not add new npm dependencies without user approval

---

## PR2 — Instance Setup Mode + Settings → Developers

**Agent goal:** Developer-facing UI to register OAuth app credentials. No channel OAuth yet.

**Depends on:** PR1

### New routes

| Route | File | Purpose |
|-------|------|---------|
| `/setup` | `app/routes/setup.tsx` | Setup Mode wizard when `!instanceConfigured` |

### Bootstrap redirect logic

Update `app/routes/index.tsx` (or `__root.tsx` loader) to redirect unconfigured instances to `/setup` before login/signup.

Setup key gate:
- If `INSTANCE_SETUP_KEY` is set AND origin is not localhost → require `?setup_key=` query param
- If invalid/missing → show "Instance not configured" static page with instructions

### Setup Mode UI (`app/routes/setup.tsx`)

Multi-step guided wizard (good documentation inline):

**Step 1 — Welcome**
- Explain: you are registering app credentials, NOT connecting your personal accounts
- Link to `docs/developer-oauth-setup.md` (create stub in PR6 if not ready)

**Step 2 — X app registration guide**
- Checklist: create project/app at developer.x.com, Read+Write, Web App, callback URL (show copy button)
- Form fields: `xClientId`, `xClientSecret` (password inputs)

**Step 3 — LinkedIn app registration guide**
- Checklist: create app at linkedin.com/developers, required products/scopes
- Form fields: `linkedinClientId`, `linkedinClientSecret`

**Step 4 — Confirm & save**
- Save to `instance_config` via server function
- Set `instance_meta.configured = true`, `setup_completed_at = now()`
- Redirect to sign-up (`/` or `/signup`)

### Server functions

| Function | File |
|----------|------|
| `saveInstanceSetup` | `app/server/setup.ts` |
| `getInstanceSetupStatus` | `app/server/setup.ts` |
| `getDeveloperSettings` | `app/server/setup.ts` — public client IDs + callback URLs only; never secrets |

### Settings → Developers (shell)

Extend `app/routes/settings.tsx`:
- New section visible only when `session.isInstanceOwner === true`
- Show X/LinkedIn client ID fields + secret (masked) + callback URL copy buttons
- If creds sourced from env → read-only with badge "Configured via environment"
- Save updates DB creds (does not affect env-sourced values)

Non-owners: section hidden entirely.

### Acceptance criteria (PR2)

- [ ] Fresh DB → visiting `/` redirects to `/setup`
- [ ] Setup wizard saves credentials; subsequent visit goes to sign-up/login
- [ ] localhost works without setup key
- [ ] With `INSTANCE_SETUP_KEY` set and non-localhost origin, `/setup` requires valid key
- [ ] Instance owner sees Developers in Settings; non-owner does not
- [ ] Secrets never returned in client API responses (only `configured: true` flags)

---

## PR3 — X OAuth end-to-end

**Agent goal:** Click-to-connect X works: OAuth redirect, callback, token storage, publish via project channel.

**Depends on:** PR1. Can parallel PR2.

### New files

| File | Purpose |
|------|---------|
| `app/lib/server/oauth/state.ts` | Create/validate/consume `oauth_states` rows (10 min TTL) |
| `app/lib/server/oauth/x.ts` | `buildXAuthorizeUrl()`, `exchangeXCode()`, `fetchXProfile()`, `refreshXToken()` |
| `app/routes/integrations/social/x.tsx` | Start OAuth — requires auth + active project |
| `app/routes/integrations/social/x/callback.tsx` | Handle callback |
| `app/routes/integrations/social/adding.tsx` | "Adding Channel…" interstitial (or query param on callback) |

### X OAuth 2.0 PKCE spec

**Authorize URL:** `https://twitter.com/i/oauth2/authorize`

**Params:**
- `response_type=code`
- `client_id`
- `redirect_uri={APP_ORIGIN}/integrations/social/x/callback`
- `scope=tweet.read tweet.write users.read offline.access`
- `state={random}`
- `code_challenge={S256 hash of verifier}`
- `code_challenge_method=S256`

**Token URL:** `https://api.twitter.com/2/oauth2/token`

**After token exchange:**
1. Call `GET https://api.x.com/2/users/me?user.fields=profile_image_url,username,name`
2. Upsert `provider_accounts` for active project:
   - `provider = 'x'`
   - `external_account_id = user.id`
   - `display_name = user.name`
   - `username = user.username`
   - `profile_image_url = user.profile_image_url`
   - `access_token_ciphertext`, `refresh_token_ciphertext`, `token_expires_at`

### Route: start OAuth (`/integrations/social/x`)

1. `requireOperatorSession()`
2. Verify `activeProjectId` exists
3. Verify instance has X OAuth config
4. Check no existing X channel for project (MVP: one per provider)
5. Create `oauth_states` row
6. Redirect to X authorize URL

### Route: callback (`/integrations/social/x/callback`)

1. Validate `state` against `oauth_states` (not expired, matching operator/project)
2. Exchange `code` + `code_verifier` for tokens
3. Fetch profile
4. Upsert `provider_accounts`
5. Delete oauth state row
6. Redirect to `/?channel_connected=x` or `/integrations/social/adding?provider=x&next=/`

### Update publish path

In `app/server/dashboard.ts` → `publishVariant`:
```typescript
// Replace:
const token = settings.xAccessToken
// With:
const account = await getProjectChannel(session.activeProjectId, 'x')
if (!account) throw new Error('X is not connected for this project.')
const token = decryptSecret(account.access_token_ciphertext)
```

Record `publish_attempts.provider_account_id` from the channel row.

### Server function for manual testing

`listProjectChannels` — returns connected channels for active project (public fields only).

### Tests

| File | Coverage |
|------|----------|
| `tests/oauth-x.test.ts` | PKCE generation, state validation, token exchange (mock fetch) |
| Update `tests/x-adapter.test.ts` | Unchanged adapter; integration via publish path mock |

### Acceptance criteria (PR3)

- [ ] With instance configured and user logged in with active project, navigating to `/integrations/social/x` redirects to X
- [ ] After authorize, channel appears in `provider_accounts` for project
- [ ] Publish uses project channel token (not `app_settings`)
- [ ] Invalid/expired state rejected
- [ ] Second X connect attempt for same project returns friendly error
- [ ] `pnpm test` and `pnpm typecheck` pass

### Do NOT in PR3

- Do not build Connect Channels modal (PR4)
- Do not implement LinkedIn (PR5)

---

## PR4 — Connect Channels modal, new sign-up flow, remove token paste

**Agent goal:** End-user UI matching approved UX spec. Remove manual token onboarding.

**Depends on:** PR3 (X OAuth working). LinkedIn tiles can show "coming soon" until PR5.

### New components

| Component | File |
|-----------|------|
| `ConnectChannelsModal` | `app/components/connect-channels-modal.tsx` |
| `ChannelTile` | `app/components/channel-tile.tsx` |
| `ConnectedChannelCard` | `app/components/connected-channel-card.tsx` |
| `ChannelProgressButton` | `app/components/channel-progress-button.tsx` |
| `CreateProjectScreen` | `app/components/create-project-screen.tsx` |

### ConnectChannelsModal spec

**Layout:**
- Backdrop overlay (dimmed, click outside closes)
- Centered panel (~800px max-width, NOT full viewport)
- Header: "Connect Your Channels" + subtitle
- X button top-right
- Section: "Connected Channels (N)" — list of `ConnectedChannelCard`
- Section: "Click a channel to add it" — grid of `ChannelTile`
- Footer: "Continue without channels" / "Continue →" bottom-right

**ChannelTile states:**
| State | Behavior |
|-------|----------|
| `active` | X, LinkedIn — clickable, links to `/integrations/social/{provider}` |
| `connected` | Shows checkmark overlay, click = disconnect confirm (optional MVP: no disconnect) |
| `coming_soon` | Disabled, badge "Coming soon" — all other platforms |

**Platform list for grid:** Use `simple-icons` / existing `PlatformIcon` component. MVP active: `x`, `linkedin`. Display ~20 coming-soon tiles for visual parity with reference (hardcode list in `app/lib/channel-catalog.ts`).

### CreateProjectScreen spec

- Shown at onboarding step 2
- Single field: Project name, prefilled `default-project`
- Submit → `createProject` server fn → set active project → advance to step 3 → open ConnectChannelsModal

### Sign-up flow changes (`app/routes/index.tsx`)

Refactor the monolithic `OnboardingWizard` (~600 lines). Extract:

| Component | Step |
|-----------|------|
| `AccountSetupStep` | 1 — email, password, first name |
| `CreateProjectScreen` | 2 |
| `ConnectChannelsModal` | 3 — auto-open |
| `AiWorkspace` (existing) | 4 — skip if operator AI already configured |

**Remove entirely:**
- Step 3 X token paste form
- Step 4 LinkedIn token paste form
- `XApiGuide`, `XCredentialMappingTable` from onboarding (NOT from developer docs)
- `saveXStep`, `saveLinkedInStep` usage in onboarding
- `xStepInputSchema`, `linkedinStepInputSchema` from onboarding forms

Update `app/routes/settings.tsx`:
- Remove manual X/LinkedIn token paste sections
- Add link: "Manage connected channels" → opens ConnectChannelsModal

### Dashboard channel progress button

Add to `app/components/app-layout.tsx` header:
- Shows `N/2 Channels` for active project
- Click opens `ConnectChannelsModal`
- Query connected count from bootstrap or `listProjectChannels`

### Bootstrap/onboarding gate

Update gate in `Dashboard`:
```
if (!instanceConfigured) → redirect /setup
if (!authenticated) → LoginScreen
if (onboardingStep < 5 && !dismissed) → OnboardingWizard
else → Dashboard with optional ConnectChannelsModal
```

New project creation (Settings → Projects, PR6) auto-opens modal when `channels.count === 0`.

### Server function changes

| Action | Detail |
|--------|--------|
| Remove | `saveXStep`, `saveLinkedInStep` from `app/server/dashboard.ts` |
| Remove | `xStepInputSchema`, `linkedinStepInputSchema` from `app/lib/dashboard-schemas.ts` |
| Add | `createProjectStep` server fn — creates project, sets active, returns step 3 |
| Add | `completeChannelsStep` — marks project `channels_onboarding_completed`, advances operator onboarding |
| Update | `saveAccountStep` — set `onboarding_step_completed = 1` only (not create project yet) |
| Update | `importAndGenerate`, `publishVariant` — scope queries to `activeProjectId` |

### Scope existing content to projects

Update DB queries in dashboard server fns to filter `master_posts.project_id = activeProjectId`. New imports attach to active project.

### Acceptance criteria (PR4)

- [ ] New user: sign up → create project → Connect Channels modal → can connect X → Continue → AI step → dashboard
- [ ] Modal dismissible all four ways (outside click, X, Continue, Skip)
- [ ] Dashboard progress button shows correct count and reopens modal
- [ ] No token paste UI anywhere in onboarding or settings
- [ ] Publish still works for X via connected channel
- [ ] LinkedIn tile visible but disabled ("Coming soon") until PR5
- [ ] `pnpm test` and `pnpm typecheck` pass

---

## PR5 — LinkedIn OAuth

**Agent goal:** Same pattern as X for LinkedIn.

**Depends on:** PR1, PR3 (copy pattern). Can start after PR1 in parallel with PR3/PR4.

### New files

| File | Purpose |
|------|---------|
| `app/lib/server/oauth/linkedin.ts` | Authorize URL, token exchange, profile + URN fetch |
| `app/routes/integrations/social/linkedin.tsx` | Start OAuth |
| `app/routes/integrations/social/linkedin/callback.tsx` | Callback |

### LinkedIn OAuth spec

**Authorize URL:** `https://www.linkedin.com/oauth/v2/authorization`

**Scopes (MVP — personal profile posting):**
- `openid profile w_member_social`

**Callback:** `{APP_ORIGIN}/integrations/social/linkedin/callback`

**After token exchange:**
1. Fetch member info via OpenID userinfo or `/v2/userinfo`
2. Derive `author_urn` = `urn:li:person:{sub}`
3. Upsert `provider_accounts` with `author_urn` column populated

### Update LinkedIn adapter publish path

In `publishVariant`:
```typescript
const account = await getProjectChannel(session.activeProjectId, 'linkedin')
// Pass account.author_urn to adapter instead of settings.linkedinAuthorUrn
```

### Enable LinkedIn ChannelTile

Change LinkedIn tile from `coming_soon` to `active` in `channel-catalog.ts`.

### Acceptance criteria (PR5)

- [ ] LinkedIn OAuth connect flow works end-to-end
- [ ] Publish to LinkedIn uses project channel token + author URN
- [ ] Progress button shows `2/2` when both connected
- [ ] One LinkedIn channel per project enforced
- [ ] Tests for linkedin oauth state + adapter integration

---

## PR6 — Project switcher, projects settings, documentation

**Agent goal:** Multi-project UX and deployer/end-user documentation.

**Depends on:** PR4, PR5

### Project switcher

Add to `app/components/app-layout.tsx`:
- Dropdown showing current project name
- List all operator projects
- Badge: connected channel count per project
- On switch: call `setActiveProject` server fn → invalidate bootstrap query → refresh dashboard content

### Settings → Projects

New section in `app/routes/settings.tsx`:
- List projects
- "Create project" → name field only → create → switch active → auto-open ConnectChannelsModal

### New project server functions

| Function | Purpose |
|----------|---------|
| `createProject` | Already from PR1; wire to UI |
| `renameProject` | Optional MVP |
| `setActiveProject` | Update session + return fresh bootstrap |

### Documentation files

| File | Audience | Contents |
|------|----------|----------|
| `docs/developer-oauth-setup.md` | Deployer/developer | Portal registration steps, callback URLs, scopes, env vars, Setup Mode, INSTANCE_SETUP_KEY |
| `docs/end-user-guide.md` | End user | Sign up, create project, connect channels, publish |
| Update `README.md` | Both | Link to docs, remove manual token paste instructions |
| Update `.env.example` | Deployer | Final env var list |

### Developer doc must include

**X Developer Portal:**
1. Create Project + App at developer.x.com
2. User authentication settings: Read and Write, Web App, Automated App or Bot
3. Callback URI: `{APP_ORIGIN}/integrations/social/x/callback`
4. Website URL: `{APP_ORIGIN}`
5. Copy Client ID + Client Secret to Setup Mode or env

**LinkedIn Developer Portal:**
1. Create app at linkedin.com/developers
2. Add product: Share on LinkedIn (+ Sign In with LinkedIn using OpenID Connect)
3. Redirect URL: `{APP_ORIGIN}/integrations/social/linkedin/callback`
4. Scopes: `openid profile w_member_social`

**Security:**
- Complete setup before exposing instance to internet
- Set `INSTANCE_SETUP_KEY` on production
- Developer registers apps only — personal channel connection happens in end-user flow

### Acceptance criteria (PR6)

- [ ] User with 2 projects can switch; each shows correct channels and posts
- [ ] Creating 2nd project opens Connect Channels modal
- [ ] Documentation complete and linked from README
- [ ] Full happy path works: setup → signup → project → connect X + LinkedIn → import → publish

---

## Files to delete or gut (PR4 hard cutover)

| Item | Location |
|------|----------|
| `saveXStep`, `saveLinkedInStep` | `app/server/dashboard.ts` |
| `xStepInputSchema`, `xStepFormSchema`, `linkedinStepInputSchema`, `linkedinStepFormSchema` | `app/lib/dashboard-schemas.ts` |
| X/LinkedIn token paste forms | `app/routes/index.tsx`, `app/routes/settings.tsx` |
| `XApiGuide`, `XCredentialMappingTable` in onboarding | `app/components/x-api-guide.tsx` — keep file for developer docs reference or move content to `docs/` |
| Social token keys in `app_settings` | `app/lib/server/settings.ts` — remove read/write for user tokens |
| Manual token README sections | `README.md` |

---

## Environment variables (final)

```bash
# Core
DATABASE_URL=postgres://postgres:postgres@localhost:5432/social_media_director
SESSION_SECRET=replace-with-a-random-secret
APP_ENCRYPTION_KEY=replace-with-another-random-secret
APP_ORIGIN=http://localhost:5173

# Setup security (optional on localhost, required on public hosts)
INSTANCE_SETUP_KEY=

# OAuth app credentials (optional if using Setup Mode UI instead)
X_CLIENT_ID=
X_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# AI (unchanged)
OPENAI_API_KEY=
```

Remove from `.env.example`: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN` (user tokens no longer in env).

---

## TanStack Start conventions

Before modifying routes or server functions, load skills:

```bash
pnpm intent:load:start
pnpm intent:load:server-functions
pnpm intent:load:auth
```

- Server functions live in `app/server/` using `createServerFn`
- Routes use file-based routing in `app/routes/`
- OAuth callbacks should be route handlers that can set cookies and redirect
- Use existing `encryptSecret` / `decryptSecret` from `app/lib/server/crypto.ts` for all tokens and client secrets

---

## Testing strategy

| Layer | Approach |
|-------|----------|
| Unit | Mock `fetch` for OAuth token exchange and profile APIs |
| Integration | Existing `vitest` + mocked DB queries (see `tests/settings.test.ts` pattern) |
| Manual | Document in PR descriptions: setup → connect → publish checklist |

Do not run DB migrations or `pnpm db:reset` in CI agents without user approval (user safety rule). Write migration SQL and tests; user runs DB commands locally.

---

## Agent assignment checklist (quick reference)

| Agent | PR | Primary deliverable |
|-------|-----|---------------------|
| Agent A | PR1 | `migrations/0007_projects_oauth.sql` + server modules + session |
| Agent B | PR2 | `/setup` route + Settings → Developers |
| Agent C | PR3 | X OAuth routes + publish path update |
| Agent D | PR4 | ConnectChannelsModal + onboarding refactor + remove paste UI |
| Agent E | PR5 | LinkedIn OAuth (mirror PR3) |
| Agent F | PR6 | Project switcher + docs |

**Merge order:** PR1 → (PR2 + PR3 parallel) → PR4 → PR5 → PR6

---

## Out of scope (future phases)

- Multiple channels per provider per project (agency use case)
- Per-project AI config override
- Operator invite / RBAC beyond `owner`
- Token refresh background job (store refresh token in PR3/PR5; wire refresh later)
- Disconnect channel UI (optional in MVP)
- Any platform beyond X + LinkedIn
- Manual token paste fallback
