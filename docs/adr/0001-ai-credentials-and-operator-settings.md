# Split AI credentials from operator settings

Per–backend-type credentials (OpenAI API key, Codex CLI setup, and future keys) live in dedicated encrypted storage fields. A separate operator-settings record stores which backend type is active for draft generation. Each backend type also stores its own last chosen model ID next to its credentials.

We rejected a single `aiProvider` flag in flat `app_settings` because operators need multiple tested backends saved at once and a clear active selection without overwriting other types. We rejected a generic connections table for now and will add typed fields per backend until more than a handful of types forces a generalized shape.
