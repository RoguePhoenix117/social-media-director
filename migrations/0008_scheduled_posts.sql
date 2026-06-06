create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  master_post_id uuid not null references master_posts(id) on delete cascade,
  scheduled_at timestamptz not null,
  timezone text not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'publishing', 'published', 'cancelled', 'failed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scheduled_posts_project_id_idx on scheduled_posts(project_id);
create index scheduled_posts_scheduled_at_idx on scheduled_posts(scheduled_at);
create index scheduled_posts_status_scheduled_at_idx on scheduled_posts(status, scheduled_at);
