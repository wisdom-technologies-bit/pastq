create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  bank_session_id uuid unique not null,
  mode text not null check (mode in ('practice','cbt')),
  exam_slug text not null,
  exam_name text not null,
  exam_year int,
  subject_slugs text[] not null,
  subject_names text[] not null,
  total_questions int not null,
  answered_count int not null default 0,
  feedback_mode text not null check (feedback_mode in ('instant','end')),
  duration_seconds int,
  status text not null check (status in ('created','in_progress','submitted','expired','abandoned')),
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  result_summary jsonb,
  created_at timestamptz not null default now()
);
create index if not exists study_sessions_user_status_created_idx on public.study_sessions(user_id, status, created_at desc);
alter table public.study_sessions enable row level security;
revoke all on table public.study_sessions from anon, authenticated;
