alter table public.profiles add column if not exists settings jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists product_updates boolean not null default false;
