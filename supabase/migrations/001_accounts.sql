create extension if not exists citext;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(), email citext unique not null, name text, avatar_url text,
  google_sub text unique, email_verified_at timestamptz, status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(), last_login_at timestamptz
);
create table if not exists public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade, display_name text,
  target_exams text[] not null default '{}', exam_year int, onboarded_at timestamptz, updated_at timestamptz not null default now()
);
create table if not exists public.auth_codes (
  id uuid primary key default gen_random_uuid(), email citext not null, code_hash text not null,
  expires_at timestamptz not null, attempts int not null default 0, consumed_at timestamptz,
  created_at timestamptz not null default now(), ip inet
);
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  token_hash text unique not null, created_at timestamptz not null default now(), expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(), user_agent text, ip inet, revoked_at timestamptz
);
create table if not exists public.rate_limits (
  key text primary key, count int not null default 0, window_start timestamptz not null default now()
);

create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare allowed boolean;
begin
  insert into public.rate_limits(key,count,window_start) values(p_key,1,now())
  on conflict (key) do update set count = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds) then 1 else rate_limits.count + 1 end,
    window_start = case when now() - rate_limits.window_start >= make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end;
  select count <= p_max into allowed from public.rate_limits where key = p_key;
  return allowed;
end; $$;

do $$ declare t text; begin foreach t in array array['users','profiles','auth_codes','sessions','rate_limits'] loop execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon, authenticated',t); end loop; revoke all on function public.check_rate_limit(text,int,int) from public, anon, authenticated; grant execute on function public.check_rate_limit(text,int,int) to service_role; end $$;
