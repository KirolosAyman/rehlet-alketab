-- D-002 revised: the daily limit on published quizzes is a SETTING, not a hard DB rule.
-- Default = 1 (current use). Raise it later from the admin side without a migration.
-- Idempotent.

drop index if exists public.quizzes_one_published_per_date;

-- Keep fast lookups by date + status (used by home, streak and the limit check).
create index if not exists quizzes_date_status_idx on public.quizzes(quiz_date, status);

insert into public.settings(key, value) values
  ('max_published_per_day', '1'::jsonb)
on conflict (key) do nothing;
