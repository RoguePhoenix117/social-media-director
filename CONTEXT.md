# Context

Domain language for Social Media Director. Implementation details belong in code and ADRs, not here.

**Module catalog (for agents):** `docs/CODE_INDEX.md`. **Code layout rules:** `docs/adr/0002-code-organization-and-reuse.md`, `.cursor/rules/`.

## AI generation

**AI backend type** — A kind of generation source (e.g. OpenAI API, Local Codex CLI; more types later). Each type has its own setup fields and connection test. Only implemented types appear in UI selectors; future types are added when connection test and generation exist.

**AI connection** — A saved, tested setup for one backend type. Credentials live in dedicated storage per type (e.g. OpenAI API key, Codex CLI auth state, Claude API key, xAI API key). The operator may configure several types without losing the others.

**Active AI selection** — Which backend type draft generation uses, stored in operator settings. Each backend type also stores its own last chosen model ID alongside its credentials; switching active backend restores that type’s saved model without re-picking.

**Operator settings** — Per-operator preferences in a dedicated table (separate from per-type credential storage), including which AI backend type is currently active.

**AI workspace** — The shared setup surface (onboarding Model step and Settings) where the operator adds, tests, and saves each backend type’s credentials and model.

**Active backend control** — A dashboard control near import/generate that switches which saved backend type is active without opening Settings. Setup and testing stay in the AI workspace.

**Model step** — Onboarding step 2 where the AI workspace is configured. Save requires a chosen backend; Skip leaves no backend selected.

**Model configured** — At least one AI connection is saved and passes its connection test, and an active AI connection is set. The Model step can be green when any valid connection exists; amber when skipped or only partial setup.

**Model catalog** — The list of model IDs the operator may choose for the active backend. Always loaded from the backend’s source (OpenAI API or Codex CLI), never from a hardcoded list in the app.

**Connection test** — An explicit operator action that verifies the backend before the model catalog is loaded: OpenAI **Test key** calls the models API; Codex **Test connection** runs auth/status then loads CLI models. Failure shows an inline field error plus the response message; success shows a toast and populates the model dropdown.

**Save (model step)** — Persists the connection being edited only after a successful connection test and a chosen model. Does not remove other saved connections. Skip does not require any connection. Saving does not change the active backend, except the first successful save in an install also sets active so generation works without an extra dashboard step.

**Draft generation** — Creating platform-specific post text from an imported source using the active AI selection (backend type + model from operator settings).

**Test feedback** — Connection test failures use inline field errors with the API/CLI message; successes use a Sonner toast (e.g. models loaded).
