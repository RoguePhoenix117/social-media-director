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
| `x-api-guide.tsx` | Developer X setup copy (moving to docs; do not reuse in onboarding) |

### Planned (plan.md — create here, not in routes)

| Module | Use for |
|--------|---------|
| `connect-channels/connect-channels-modal.tsx` | OAuth channel grid modal |
| `connect-channels/channel-tile.tsx` | Single platform tile |
| `connect-channels/connected-channel-card.tsx` | Connected account row |
| `channel-progress-button.tsx` | Dashboard `N/2 Channels` control |
| `create-project-screen.tsx` | First/additional project name form |
| `onboarding/` | Account step, wizard shell, step indicator |

## Routes (`app/routes/`)

Thin compositional shells only. Business UI lives in `app/components/` or `app/features/`.

| Route | Target component |
|-------|------------------|
| `/` | `features/dashboard/` (extract from legacy `index.tsx`) |
| `/setup` | `features/setup/setup-wizard.tsx` |
| `/settings` | `features/settings/settings-page.tsx` |
| `/integrations/social/*` | Server redirect/callback handlers; minimal JSX |

## Server functions (`app/server/`)

| File | Domain |
|------|--------|
| `dashboard.ts` | Bootstrap, auth, import, publish |
| `ai-workspace.ts` | AI connection test/save |
| `setup.ts` | Instance Setup Mode (PR2) |
| `projects.ts` | Project CRUD, active project (PR1) |
| `channels.ts` | List/disconnect channels (PR3+) |

## Server libraries (`app/lib/server/`)

| Module | Use for |
|--------|---------|
| `session.ts` | Operator session cookie (incl. `activeProjectId`, `isInstanceOwner`) |
| `settings.ts` | Operator AI settings + public status (channel status is project-scoped — pass `projectId`) |
| `crypto.ts` | Encrypt/decrypt, passwords |
| `codex-cli.ts` | Codex CLI status/models |
| `instance-config.ts` | OAuth app credentials (env overrides DB) + `isInstanceConfigured` / `markInstanceConfigured` |
| `projects.ts` | `createProject`, `listOperatorProjects`, `setActiveProject`, `ensureOperatorProjectAccess`, `slugify` |
| `provider-accounts.ts` | `listProjectChannels`, `getProjectChannel`, `upsertProviderAccount`, `disconnectChannel` |
| `setup-guard.ts` | `assertSetupKeyValid`, `isLocalhostOrigin`, `isSetupKeyConfigured` (used by PR2 setup route) |
| `oauth/x.ts`, `oauth/linkedin.ts` | OAuth flows (PR3/PR5) |

## Schemas & queries (`app/lib/`)

| Module | Use for |
|--------|---------|
| `dashboard-schemas.ts` | Dashboard form/API zod schemas |
| `password-schema.ts` | Shared password validation |
| `bootstrap-query.ts` | App bootstrap React Query options + `BootstrapState` type (includes `instanceConfigured`, `activeProjectId`, `projects`, `connectedChannels`, `isInstanceOwner`) |
| `onboarding-steps.ts` | Canonical step IDs/numbers (`ONBOARDING_STEPS`); use instead of magic 1–4 |
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

## Anti-patterns (do not extend)

- `app/routes/index.tsx` — legacy monolith; extract, do not grow
- Inline `createServerFn` in route files
- New zod schemas colocated in components when shared with server
- Duplicating `PlatformIcon`, form patterns, or bootstrap types
