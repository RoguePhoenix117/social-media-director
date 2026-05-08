create table operator_sessions (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table app_settings (
  key text primary key,
  value_ciphertext text not null,
  updated_at timestamptz not null default now()
);

create index operator_sessions_operator_id_idx on operator_sessions(operator_id);
create index operator_sessions_expires_at_idx on operator_sessions(expires_at);
