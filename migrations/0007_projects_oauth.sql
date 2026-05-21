-- Instance configuration (OAuth app credentials, encrypted)
create table instance_config (
  key text primary key,
  value_ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table instance_meta (
  id integer primary key default 1 check (id = 1),
  setup_completed_at timestamptz,
  configured boolean not null default false
);

insert into instance_meta (id) values (1);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  channels_onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table operator_projects (
  operator_id uuid not null references operators(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (operator_id, project_id)
);

create index operator_projects_project_id_idx on operator_projects(project_id);

-- Operators: instance owner flag
alter table operators
  add column is_instance_owner boolean not null default false;

-- Sessions: active project
alter table operator_sessions
  add column active_project_id uuid references projects(id) on delete set null;

-- Provider accounts: project-scoped, one per provider per project
alter table provider_accounts
  add column project_id uuid references projects(id) on delete cascade,
  add column profile_image_url text,
  add column username text,
  add column author_urn text;  -- LinkedIn urn:li:person:... or urn:li:organization:...

-- Drop old global unique constraint; add project-scoped unique
alter table provider_accounts drop constraint if exists provider_accounts_provider_external_account_id_key;
create unique index provider_accounts_project_provider_idx
  on provider_accounts (project_id, provider)
  where project_id is not null;

-- Project-scoped content
alter table master_posts add column project_id uuid references projects(id) on delete cascade;
alter table content_sources add column project_id uuid references projects(id) on delete cascade;

create index master_posts_project_id_idx on master_posts(project_id);
create index content_sources_project_id_idx on content_sources(project_id);
create index provider_accounts_project_id_idx on provider_accounts(project_id);

-- Short-lived OAuth state (CSRF + PKCE verifier)
create table oauth_states (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references operators(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  provider text not null check (provider in ('x', 'linkedin')),
  state_token text not null unique,
  code_verifier text not null,
  redirect_after text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index oauth_states_expires_at_idx on oauth_states(expires_at);
