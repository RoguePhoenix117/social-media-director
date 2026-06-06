alter table operator_settings
  drop constraint if exists operator_settings_active_ai_backend_type_check;

alter table operator_settings
  add constraint operator_settings_active_ai_backend_type_check check (
    active_ai_backend_type is null
    or active_ai_backend_type in (
      'template',
      'openaiApiKey',
      'ollama',
      'openaiCompatible',
      'codexCli'
    )
  );

alter table operator_settings
  add column if not exists template_verified_at timestamptz,
  add column if not exists ollama_host text,
  add column if not exists ollama_model text,
  add column if not exists ollama_verified_at timestamptz,
  add column if not exists openai_compatible_provider_name text,
  add column if not exists openai_compatible_base_url text,
  add column if not exists openai_compatible_api_key_ciphertext text,
  add column if not exists openai_compatible_model text,
  add column if not exists openai_compatible_verified_at timestamptz;
