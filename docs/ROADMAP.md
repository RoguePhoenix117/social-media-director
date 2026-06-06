# Social Media Director Roadmap

This roadmap turns the current MVP into a daily-use, open-source social media
management tool. The product direction is inspired by Postiz, but scoped around
what is realistic for a self-hosted app that non-technical operators can run and
trust.

## Product North Star

Social Media Director should help an operator expand social reach from one
workspace:

- connect social channels without copying tokens or visiting developer portals
- import public content and turn it into reviewed platform-specific drafts
- schedule and publish reliably through official provider APIs
- monitor outcomes and recover from failed publishes without database access
- remain simple enough for self-hosted open-source adoption

## Current Baseline

The project already has a meaningful foundation:

- TanStack Start app with thin route shells and feature folders
- Postgres-backed operators, sessions, projects, OAuth channels, drafts, publish
  attempts, and scheduled posts
- first-run setup, operator onboarding, project switcher, settings, and OAuth
  connection flows
- active X and LinkedIn providers, with additional platforms shown as coming soon
- AI-assisted public URL import and provider-specific draft generation
- Draft, Post calendar, Monitor, Stats, Dashboard, and Settings routes
- automated tests covering core server and provider behavior

Known baseline risks:

- typecheck currently fails in `app/lib/server/instance-config.ts` on nullable
  OAuth secret inputs
- scheduled publishing is tied to app/bootstrap runtime behavior and needs a
  dedicated worker/process model before production use
- daily workflows need polish: reconnect/disconnect, retries, draft management,
  stronger calendar UX, and clearer recovery paths

## Phase 0 — Stabilize The App

Goal: make the current MVP consistently runnable and safe to change.

Scope:

- fix `pnpm typecheck` and keep `pnpm test` green
- run `pnpm lint`, `pnpm typecheck`, and `pnpm test` as the local quality gate
- complete a fresh-database manual smoke test from setup through OAuth, draft,
  publish, and schedule
- make local setup predictable: DB up, env setup, dev server, reset workflow
- keep `docs/manual-test-checklist.md` aligned with the actual release flow
- document known operational limits clearly in README and user docs

Exit criteria:

- a new contributor can boot the app locally from docs
- the app passes lint, typecheck, and tests
- the X-first daily path is manually verified
- known gaps are documented rather than surprising

## Phase 1 — Make It A Daily Tool

Goal: make the existing X/LinkedIn workflow useful every day for one operator.

Scope:

- improve Dashboard into an action center:
  - next recommended action
  - channel health
  - ready drafts
  - upcoming scheduled posts
  - recent failures
- improve Drafts:
  - autosave or stronger save-state feedback
  - regenerate per channel
  - duplicate, archive, and delete drafts
  - clearer validation and character counts
  - easier navigation between draft list and editor
- improve Post calendar:
  - reschedule and cancel flows
  - weekly/list views in addition to month grid
  - clearer timezone handling
  - better empty states for ready drafts and scheduled posts
- improve Monitor:
  - show publish attempts, schedule attempts, and provider links together
  - add recovery actions where possible
- add clear toast/error behavior for AI generation, OAuth, publish, schedule, and
  token failures
- tighten responsive UI and reduce setup/configuration language in daily screens

Exit criteria:

- an operator can manage real weekly posting without touching the database
- failures are visible and understandable
- Draft and Post are comfortable enough to be the primary work surfaces

## Phase 1A — AI Platform Upgrade

Goal: turn AI generation from a narrow OpenAI/Codex setup into a reliable,
multi-provider generation layer with first-class local model support.

Implementation status:

- TanStack AI packages were upgraded to mature versions allowed by the repo's
  package-age guard:
  - `@tanstack/ai`: `0.27.0`
  - `@tanstack/ai-client`: `0.16.2`
  - `@tanstack/ai-openai`: `0.14.0`
  - `@tanstack/ai-ollama`: `0.8.0`
- newer npm releases existed at check time, but were too recent for the current
  `minimumReleaseAge` policy
- Template mode, Ollama, and OpenAI-compatible backends now have settings,
  connection tests, model discovery, dashboard selection, and generation paths
- generated drafts now persist generation mode, backend, provider name, model,
  duration, and token usage when available
- Codex CLI remains a shell backend, not a TanStack AI adapter

Upgrade scope:

- keep TanStack AI packages current deliberately:
  - update `@tanstack/ai`
  - update `@tanstack/ai-openai`
  - add `@tanstack/ai-ollama`
  - add other provider adapter packages only when a provider is implemented
- migrate OpenAI generation to the doc-forward adapter path:
  - prefer `openaiText(...)`
  - keep explicit API-key support for operator-scoped keys
  - verify model metadata and structured-output behavior after upgrade
- replace prompt-only JSON instructions with first-class `outputSchema`
- add AI middleware for:
  - duration
  - token usage when available
  - provider/model metadata
  - error logging
  - future cost estimates
- maintain explicit fallback generation:
  - label it as Template mode
  - do not present fallback copy as AI-generated
  - allow Template mode as an intentional no-key/demo path
- create an internal `AiGenerationAdapter` boundary so UI/server code does not
  care whether the backend is OpenAI, local, Anthropic, Gemini, or template mode

Local model emphasis:

- support Ollama through the dedicated TanStack adapter:
  - detect `OLLAMA_HOST` or default to `http://localhost:11434`
  - list locally installed models
  - test connection without requiring an API key
  - show local/offline status clearly in Settings
- support OpenAI-compatible local servers through the TanStack compatible adapter
  when available after upgrade:
  - LM Studio, commonly `http://localhost:1234/v1`
  - Ollama OpenAI-compatible endpoint, commonly `http://localhost:11434/v1`
  - vLLM, LocalAI, text-generation-webui, and similar servers
  - configurable base URL, API key placeholder, and model list
- local-model UX requirements:
  - clear setup presets for Ollama and LM Studio
  - longer request timeouts than hosted models
  - visible warnings for slow CPU-only inference
  - model capability notes: structured output reliability, context size, and
    recommended use cases
  - easy “test generate one short draft” button

Major public model providers:

- OpenAI:
  - keep as the easiest hosted default
  - use structured outputs and middleware
  - track model, latency, usage, and errors per generation
- Anthropic:
  - add after adapter boundary lands
  - useful for higher-quality long-form LinkedIn variants and brand voice work
- Google Gemini:
  - add after adapter boundary lands
  - useful for cost-sensitive hosted generation and long-context source imports
- OpenRouter:
  - useful for broad model choice behind one credential
  - good bridge for non-technical operators who want hosted model flexibility
- xAI/Grok and Groq:
  - add when provider packages and setup docs are stable enough
  - useful for speed/cost experiments rather than MVP defaults

Data model additions:

- add generation metadata per draft or generation run:
  - backend type
  - provider name
  - model id
  - prompt version
  - generation mode (`ai` or `template`)
  - duration
  - usage/cost fields when available
  - error message/status
- add project-scoped AI guidance:
  - brand voice
  - audience
  - tone
  - banned phrases
  - hashtag rules
  - CTA/link rules

Exit criteria:

- OpenAI generation still works after the TanStack AI upgrade
- Template mode is explicit and tested
- at least one local backend works end to end, preferably Ollama
- the code has a stable provider adapter boundary for additional public models
- generation runs record enough metadata to debug model behavior later

## Phase 2 — Publishing Reliability

Goal: make scheduled and immediate publishing dependable.

Scope:

- move scheduled publishing into a dedicated worker or runtime process
- add retry/backoff for transient provider failures
- add idempotency protections to avoid duplicate posts
- refresh OAuth tokens before publish when possible
- add expired-token and reconnect flows
- add disconnect/reconnect UI for channels
- store richer publish attempt metadata
- surface provider rate-limit and permission errors in operator language
- add tests for scheduled publish transitions and partial provider failures

Exit criteria:

- scheduled posts publish without requiring a dashboard request to start work
- failed publishes have clear statuses and recovery options
- token expiry does not silently break posting

## Phase 3 — Connected Apps Expansion

Goal: add providers in an order that maximizes usefulness without collapsing into
platform-review complexity too early.

Provider order:

1. X depth first:
   - token refresh
   - reconnect
   - profile refresh
   - media/link behavior
2. LinkedIn depth first:
   - reconnect
   - profile refresh
   - organization/page readiness
3. LinkedIn Pages:
   - page selection
   - page author URNs
   - page publishing
4. Bluesky and Mastodon:
   - strong open-source fit
   - lower setup friction than Meta platforms
5. Facebook Page, Instagram Business, and Threads:
   - high value but heavier app review and permission requirements
6. Additional community providers:
   - Reddit
   - YouTube Community or Shorts-adjacent workflows where APIs permit
   - Pinterest
   - WordPress, Medium, Dev.to, Hashnode for publish-back or syndication

Platform checklist for each new provider:

- OAuth or credential setup path
- encrypted credential storage
- profile/channel discovery
- validation rules
- publish adapter
- reconnect/disconnect
- tests
- operator docs
- provider-specific setup docs

Exit criteria:

- each added provider is reliable enough for real posts
- coming-soon tiles map to documented implementation needs
- contributors have a repeatable provider adapter checklist

## Phase 4 — Content Pipeline

Goal: help operators build and manage a content queue, not just publish one URL
at a time.

Scope:

- RSS, sitemap, and blog watchlist imports
- saved source library
- campaign tags and content categories
- brand voice and project guidelines
- reusable prompt templates
- hashtag, CTA, and tone presets
- UTM builder
- media library:
  - upload image
  - select source image
  - attach image per provider variant
  - validate provider media constraints
- approval workflow:
  - draft
  - needs review
  - approved/ready
  - scheduled
  - published

Exit criteria:

- operators can maintain a pipeline of future content
- projects have reusable voice and campaign settings
- media and links are first-class publishing inputs

## Phase 5 — Open Source Packaging

Goal: make the project approachable for non-technical self-hosters and useful for
contributors.

Scope:

- production-oriented Docker Compose with app, Postgres, and worker
- clear deployment guides:
  - local development
  - single-machine VPS
  - public domain with HTTPS
  - tunnel-based testing
- backup and restore docs
- environment variable reference
- admin recovery and password reset path
- contributor guide
- architecture overview
- provider adapter guide
- release checklist
- demo mode or seeded sample project

Exit criteria:

- a motivated non-specialist can deploy the app by following docs
- a contributor can add a provider without reverse-engineering the codebase
- releases have repeatable verification steps

## Phase 6 — Postiz-Like Expansion

Goal: grow toward a fuller social operating system while preserving the
self-hosted, official-API-first stance.

Scope:

- social inbox where APIs allow:
  - mentions
  - replies
  - comments
  - direct messages only where permitted and practical
- provider analytics:
  - impressions
  - likes
  - comments
  - reposts/shares
  - clicks where available
- team support:
  - invitations
  - roles
  - approval queues
  - audit trail
- campaign calendar
- evergreen content library
- AI assistant features:
  - suggest best posting windows
  - repurpose older content
  - identify stale drafts
  - summarize performance trends

Exit criteria:

- the app can support a small team or serious solo operator
- analytics and inbox features guide future posting decisions
- advanced features do not make first-run setup harder

## Suggested Next Sprint

The next sprint should focus on stabilizing the current value loop before adding
new networks.

1. Fix current typecheck failure.
2. Verify setup, X OAuth, draft generation, publish-now, and scheduled publishing
   on a fresh database.
3. Move scheduled publishing toward a dedicated worker/process.
4. Add disconnect/reconnect UI for connected channels.
5. Improve Draft and Post calendar usability enough for daily use.
6. Update README, end-user guide, and manual test checklist with the verified
   workflow.

## Roadmap Principles

- Prefer official provider APIs over scraping or browser automation.
- Keep deployer setup separate from operator channel connection.
- Keep routes thin and business logic in server/lib modules.
- Add providers only when publish, reconnect, validation, tests, and docs are
  all accounted for.
- Optimize first for a useful solo-operator workflow, then for teams.
- Treat open-source setup and recovery as product features, not afterthoughts.
