# Thin routes, self-contained components, discover-before-create

Route files (`app/routes/`) must stay compositional — roughly ≤150 lines — importing feature components instead of embedding forms, wizards, and server logic. Components in `app/components/` are self-contained units with props in and events out; parents and routes own data loading.

We rejected monolithic route files (e.g. a single 1500-line dashboard route) because they block parallel agent work, hide reuse opportunities, and mix UI with API concerns. We rejected a premature `packages/ui` split; shared UI stays in `app/components/` until a second consumer justifies extraction.

**Discover before create:** agents and developers search `docs/CODE_INDEX.md` and the codebase before adding new modules. Cursor rules in `.cursor/rules/` enforce layer boundaries. Implementation of `plan.md` must follow this structure — especially PR4 onboarding refactor.

**RAG:** domain terms live in `CONTEXT.md`; module catalog in `docs/CODE_INDEX.md`; product/architecture decisions in `docs/adr/`. New canonical modules update the index in the same PR.
