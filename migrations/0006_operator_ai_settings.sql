create table operator_settings (
  operator_id uuid primary key references operators(id) on delete cascade,
  active_ai_backend_type text check (
    active_ai_backend_type is null
    or active_ai_backend_type in ('openaiApiKey', 'codexCli')
  ),
  openai_api_key_ciphertext text,
  openai_model text,
  codex_cli_model text,
  openai_verified_at timestamptz,
  codex_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into operator_settings (operator_id)
select id from operators
on conflict (operator_id) do nothing;
