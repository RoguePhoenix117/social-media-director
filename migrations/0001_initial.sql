create table operators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table provider_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('x', 'linkedin')),
  display_name text not null,
  external_account_id text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_account_id)
);

create table content_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('public_url', 'manual_prompt')),
  source_url text,
  canonical_url text,
  title text not null,
  description text,
  image_url text,
  excerpt text,
  body text,
  imported_at timestamptz not null default now()
);

create table master_posts (
  id uuid primary key default gen_random_uuid(),
  content_source_id uuid references content_sources(id) on delete set null,
  intent_prompt text,
  summary text not null,
  default_link_url text,
  default_image_url text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table provider_variants (
  id uuid primary key default gen_random_uuid(),
  master_post_id uuid not null references master_posts(id) on delete cascade,
  provider text not null check (provider in ('x', 'linkedin')),
  text text not null,
  link_url text,
  image_url text,
  validation_status text not null default 'valid' check (validation_status in ('valid', 'warning', 'invalid')),
  validation_messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (master_post_id, provider)
);

create table publish_attempts (
  id uuid primary key default gen_random_uuid(),
  provider_variant_id uuid not null references provider_variants(id) on delete cascade,
  provider_account_id uuid not null references provider_accounts(id) on delete restrict,
  status text not null check (status in ('pending', 'published', 'failed')),
  provider_post_id text,
  provider_post_url text,
  provider_response jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
