-- Step 3 is now X-only; step 4 is LinkedIn and completes onboarding.
-- Operators who finished the old combined "social" step (3) are bumped to 4.
update operators
set onboarding_step_completed = 4
where onboarding_step_completed = 3;
