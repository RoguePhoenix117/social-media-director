# Agent Guidance

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
