# Code index (discover-before-create)

Search this file and the paths below before adding new code. Extend this index when you add a **canonical** reusable module.

## UI components (`app/components/`)

| Module | Use for |
|--------|---------|
| `app-layout.tsx` | Shell, sidebar, nav, logout |
| `ai-workspace.tsx` | AI backend setup (onboarding + settings) |
| `active-ai-backend-control.tsx` | Dashboard backend switcher |
| `appearance-settings.tsx` | Theme/layout preferences |
| `password-input.tsx` | Password fields with show/hide |
| `debounced-field-errors.tsx` | TanStack Form field errors |
| `platform-icons.tsx` | Social platform icons (`PlatformIcon`) |
| `design-context.tsx` | Theme/layout context |
| `template-pages.tsx` | Template route page wrappers |
| `x-api-guide.tsx` | Developer X setup copy (used by docs only — not onboarding) |
| `channel-progress-button.tsx` | Dashboard `N/2 Channels` control (click → open Connect Channels modal) |
| `create-project-screen.tsx` | Project name form (onboarding step 2 + future Settings → Projects) |
| `connect-channels/connect-channels-modal.tsx` | Centered OAuth channel grid modal (dismiss via outside click, X, Continue, Skip) |
| `connect-channels/channel-tile.tsx` | Single platform tile (active link / connected badge / coming-soon) |
| `connect-channels/connected-channel-card.tsx` | Connected account row (avatar + display name + handle) |
| `onboarding/onboarding-wizard.tsx` | Four-step wizard shell (account → project → channels → AI) |
| `onboarding/wizard-stepper.tsx` | Numbered step indicator + navigation guards |
| `onboarding/account-step.tsx` | Step 1 form — email/password/name |
| `onboarding/login-screen.tsx` | Return-user login screen |

## Routes (`app/routes/`)

Thin compositional shells only. Business UI lives in `app/components/` or `app/features/`.

| Route | Target component |
|-------|------------------|
| `/` | `features/dashboard/dashboard-screen.tsx` (extracted from legacy monolith in PR4) |
| `/setup` | `features/setup/setup-wizard.tsx` |
| `/settings` | `features/settings/settings-page.tsx` |
| `/integrations/social/x` | `routes/integrations/social/x/index.tsx` — calls `startXOAuth()` from loader (`x/index.tsx` not `x.tsx` so the sibling `callback` route does not inherit the redirect) |
| `/integrations/social/x/callback` | `routes/integrations/social/x/callback.tsx` — calls `completeXOAuth({ code, state })` from loader |
| `/integrations/social/adding` | `routes/integrations/social/adding.tsx` — post-callback "Adding Channel…" interstitial |

## Server functions (`app/server/`)

| File | Domain |
|------|--------|
| `dashboard.ts` | Bootstrap, auth, import, publish (`publishVariant` reads X token from `provider_accounts`; LinkedIn throws until PR5) |
| `ai-workspace.ts` | AI connection test/save |
| `settings.ts` | Settings page state aggregator (read-only since PR4 removed legacy paste) |
| `setup.ts` | Instance Setup Mode + Developer settings (`getInstanceSetupStatus`, `saveInstanceSetup`, `getDeveloperSettings`, `saveDeveloperSettings`) |
| `projects.ts` | Onboarding-aware project lifecycle: `createProjectStep`, `completeChannelsStep`, `completeOnboarding` (PR4) |
| `channels.ts` | `listProjectChannels`, `startXOAuth`, `completeXOAuth` (PR3); LinkedIn variants land in PR5 |

## Server libraries (`app/lib/server/`)

| Module | Use for |
|--------|---------|
| `session.ts` | Operator session cookie (incl. `activeProjectId`, `isInstanceOwner`) |
| `settings.ts` | Operator AI settings + public status (channel status is project-scoped — pass `projectId`). PR4 removed all legacy social token reads/writes; tokens live in `provider_accounts` only. |
| `crypto.ts` | Encrypt/decrypt, passwords |
| `codex-cli.ts` | Codex CLI status/models |
| `instance-config.ts` | OAuth app credentials (env overrides DB) + `isInstanceConfigured` / `markInstanceConfigured` |
| `projects.ts` | `createProject`, `listOperatorProjects`, `setActiveProject`, `ensureOperatorProjectAccess`, `slugify` |
| `provider-accounts.ts` | `listProjectChannels`, `getProjectChannel`, `upsertProviderAccount`, `disconnectChannel` |
| `setup-guard.ts` | `assertSetupKeyValid`, `isLocalhostOrigin`, `isSetupKeyConfigured` (used by PR2 setup route) |
| `setup-helpers.ts` | Pure helpers shared by Setup Mode + Settings → Developers (`buildSaveInput`, `toProviderStatus`, `buildCallbackUrls`, `computeSetupKeyState`) |
| `oauth/state.ts` | OAuth state row CRUD with PKCE verifier + S256 challenge (`createOAuthState`, `consumeOAuthState`, `purgeExpiredOAuthStates`) |
| `oauth/x.ts` | X (Twitter) OAuth 2.0 PKCE primitives (`buildXAuthorizeUrl`, `exchangeXCode`, `refreshXToken`, `fetchXProfile`, `getXCallbackUrl`, `requireXOAuthConfig`, `X_OAUTH_SCOPES`) |
| `oauth/linkedin.ts` | LinkedIn OAuth (PR5) |

## Schemas & queries (`app/lib/`)

| Module | Use for |
|--------|---------|
| `dashboard-schemas.ts` | Dashboard form/API zod schemas (PR4 removed `xStep*` / `linkedinStep*`) |
| `password-schema.ts` | Shared password validation |
| `bootstrap-query.ts` | App bootstrap React Query options + `BootstrapState` type (includes `instanceConfigured`, `activeProjectId`, `projects`, `connectedChannels`, `isInstanceOwner`) |
| `onboarding-steps.ts` | Canonical step IDs/numbers (`ONBOARDING_STEPS`); use instead of magic 1–5 |
| `channel-catalog.ts` | `CHANNEL_CATALOG` (X active, LinkedIn coming-soon until PR5, 20+ disabled tiles) + `TOTAL_CHANNEL_SLOTS` |
| `query.ts` | Shared query client helpers |
| `domain/providers.ts` | Provider types |
| `domain/validation.ts` | Post validation per provider |
| `providers/x.ts`, `providers/linkedin.ts` | Publish adapters |

## Features folder (optional convention)

For large route extractions:

```
app/features/{feature}/
  components/
  hooks/
  {feature}-page.tsx
```

Prefer `app/components/{feature}/` until a feature needs hooks + multiple pages.

### Active feature modules

| Folder | Purpose |
|--------|---------|
| `app/features/setup/` | Setup Mode wizard (`setup-wizard.tsx`, `setup-key-gate.tsx`, `provider-credential-fields.tsx`, `setup-callback-url.tsx`, `setup-query.ts`) |
| `app/features/settings/` | Settings page composition (`settings-page.tsx`, `developers-section.tsx`, `channels-section.tsx`, `settings-query.ts`) |
| `app/features/dashboard/` | Authenticated dashboard composition (`dashboard-screen.tsx`, `dashboard-status-grid.tsx`, `import-workspace.tsx`, `database-setup-screen.tsx`) — extracted from the legacy `app/routes/index.tsx` monolith |

## Anti-patterns (do not extend)

- `app/routes/index.tsx` — kept thin (~43 lines after PR4 refactor). New dashboard work belongs in `app/features/dashboard/`.
- Inline `createServerFn` in route files
- New zod schemas colocated in components when shared with server
- Duplicating `PlatformIcon`, form patterns, or bootstrap types
- Re-introducing manual social token paste UI or `app_settings` writes for user tokens — channels are OAuth-only since PR4
