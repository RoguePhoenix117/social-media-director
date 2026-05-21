# Agent Guidance

## Code organization (required)

Before creating files, read `docs/CODE_INDEX.md` and search for existing modules. Rules in `.cursor/rules/` enforce:

- **Thin routes** (≤150 lines) — compose components; no inline server fns or wizards
- **Self-contained components** — reuse `app/components/*`; split files >200 lines
- **Thin server entrypoints** — logic in `app/lib/server/`; one domain per `app/server/*.ts`
- **Discover before create** — extend canonical modules; update `docs/CODE_INDEX.md` when adding new ones

Domain language: `CONTEXT.md`. Architecture decisions: `docs/adr/`. OAuth/projects work: `plan.md`.

Use TanStack Intent before changing TanStack Start or Router code. Intent discovers the versioned skills shipped by installed packages.

<!-- intent-skills:start -->
# Skill mappings — when working in these areas, load the linked skill file into context.
skills:
  - task: "building TanStack Start routes, root documents, Vite config, or app structure"
    load: "node_modules/@tanstack/react-start/skills/react-start/SKILL.md"
  - task: "implementing TanStack Start server functions"
    load: "node_modules/.pnpm/@tanstack+start-client-core@1.168.2/node_modules/@tanstack/start-client-core/skills/start-core/server-functions/SKILL.md"
  - task: "implementing authentication, sessions, cookies, OAuth, or CSRF in TanStack Start"
    load: "node_modules/.pnpm/@tanstack+start-client-core@1.168.2/node_modules/@tanstack/start-client-core/skills/start-core/auth-server-primitives/SKILL.md"
  - task: "working on TanStack Router route trees, route files, navigation, search params, or route guards"
    load: "node_modules/.pnpm/@tanstack+router-core@1.169.2/node_modules/@tanstack/router-core/skills/router-core/SKILL.md"
<!-- intent-skills:end -->

Useful commands:

```bash
pnpm intent:list
pnpm intent:load:start
pnpm intent:load:server-functions
pnpm intent:load:auth
```
