alter table operators
  add column first_name text,
  add column onboarding_step_completed integer not null default 0,
  add column onboarding_completed_at timestamptz;

update operators
set onboarding_step_completed = 1
where onboarding_step_completed = 0;
