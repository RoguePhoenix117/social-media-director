alter table master_posts
  add column if not exists generation_mode text check (
    generation_mode is null or generation_mode in ('ai', 'template')
  ),
  add column if not exists generation_backend text,
  add column if not exists generation_provider_name text,
  add column if not exists generation_model text,
  add column if not exists generation_duration_ms integer,
  add column if not exists generation_usage jsonb;
