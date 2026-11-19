-- Rehlet Alketab — initial schema (M1)
-- Idempotent: safe to run more than once.
-- Security model: RLS ON for every table, NO policies, and all privileges revoked
-- from anon/authenticated. Only the Edge Function (service role) can read/write.

create extension if not exists pgcrypto;  -- gen_random_uuid (built-in on PG13+, kept for safety)

-- ---------- students ----------
create table if not exists public.students (
  id              uuid primary key default gen_random_uuid(),
  username        text not null,
  username_norm   text not null unique,          -- normalized (spec §9.6)
  display_name    text not null,
  pass_hash       text,                          -- NULL = password not chosen yet. Format: pbkdf2$iter$salt$hash (D-005)
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now()
);

-- ---------- sessions ----------
create table if not exists public.sessions (
  token_hash  text primary key,                  -- SHA-256 of the token; the token itself is never stored
  student_id  uuid references public.students(id) on delete cascade,
  is_admin    boolean not null default false,
  expires_at  timestamptz,                       -- admin: now()+7d; student: NULL
  created_at  timestamptz not null default now(),
  constraint sessions_owner_chk check (is_admin or student_id is not null)
);
create index if not exists sessions_student_idx on public.sessions(student_id);

-- ---------- quizzes ----------
create table if not exists public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  quiz_date   date not null,
  book        text not null,
  chapter     text not null,
  opens_at    time,                              -- Cairo local time; NULL = open all day
  status      text not null default 'draft' check (status in ('draft','published')),
  author_id   uuid references public.students(id) on delete set null,
  questions   jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  created_at  timestamptz not null default now()
);
create index if not exists quizzes_date_idx on public.quizzes(quiz_date);
-- D-002: at most one PUBLISHED quiz per date; drafts unlimited.
create unique index if not exists quizzes_one_published_per_date
  on public.quizzes(quiz_date) where status = 'published';

-- ---------- quiz_unlocks ----------
create table if not exists public.quiz_unlocks (
  quiz_id     uuid not null references public.quizzes(id)  on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  primary key (quiz_id, student_id)
);
create index if not exists quiz_unlocks_student_idx on public.quiz_unlocks(student_id);

-- ---------- attempts ----------
create table if not exists public.attempts (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.students(id) on delete cascade,
  quiz_id            uuid not null references public.quizzes(id)  on delete cascade,
  answers            jsonb not null check (jsonb_typeof(answers) = 'array'),
  questions_snapshot jsonb not null check (jsonb_typeof(questions_snapshot) = 'array'),  -- D-001
  essay              jsonb not null default '[]'::jsonb,  -- [{ i, status, note, by }] (D-010)
  correct            int  not null check (correct >= 0),
  total              int  not null check (total >= 0),
  stars              int  not null check (stars >= 0),
  created_at         timestamptz not null default now(),
  unique (student_id, quiz_id)                  -- one attempt per student per quiz
);
-- Upgrade path if an older attempts table exists without the snapshot column.
alter table public.attempts add column if not exists questions_snapshot jsonb not null default '[]'::jsonb;
create index if not exists attempts_quiz_idx    on public.attempts(quiz_id);
create index if not exists attempts_student_idx on public.attempts(student_id);

-- ---------- assignments ----------
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.students(id) on delete cascade,
  book          text not null,
  chapter       text not null,
  day           date not null,
  status        text not null default 'open' check (status in ('open','submitted')),
  questions     jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  quiz_id       uuid references public.quizzes(id) on delete set null,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists assignments_student_day_idx on public.assignments(student_id, day);

-- ---------- settings ----------
create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);
insert into public.settings(key, value) values
  ('leaderboard_public', 'false'::jsonb),
  ('ai_model', '"gemini-2.5-flash"'::jsonb)
on conflict (key) do nothing;

-- ---------- app_secrets (write-only from admin UI; never returned) ----------
create table if not exists public.app_secrets (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ---------- rate_limits (D-004) ----------
create table if not exists public.rate_limits (
  key           text not null,                  -- e.g. 'login:ip:<sha256>', 'gen:admin'
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_idx on public.rate_limits(window_start);

-- ---------- lock everything down ----------
do $$
declare t text;
begin
  foreach t in array array['students','sessions','quizzes','quiz_unlocks','attempts',
                           'assignments','settings','app_secrets','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
