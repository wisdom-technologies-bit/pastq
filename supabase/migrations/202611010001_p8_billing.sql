-- P8 billing: prices, Paystack plan codes, entitlements, payments and webhook events.
-- Every table here is server-only: RLS is on with no policies, so only the
-- service-role client in lib/auth/db.ts can read or write them.

create table if not exists public.pricing (
  id integer primary key default 1,
  currency text not null default 'NGN',
  monthly_amount_kobo integer not null default 250000,
  lifetime_amount_kobo integer not null default 2500000,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.pricing (id) values (1) on conflict (id) do nothing;

create table if not exists public.paystack_plans (
  amount_kobo integer not null,
  currency text not null default 'NGN',
  interval text not null,
  plan_code text not null unique,
  primary key (amount_kobo, currency, interval)
);

create table if not exists public.entitlements (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan text not null check (plan in ('monthly_auto','monthly_manual','lifetime')),
  status text not null default 'active' check (status in ('active','past_due','cancelled','expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_email_token text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reminder_at timestamptz,
  last_reminder_kind text
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reference text not null unique,
  plan text not null check (plan in ('monthly_auto','monthly_manual','lifetime')),
  amount_kobo integer not null,
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending','success','failed','abandoned')),
  channel text,
  paystack_transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_created_idx on public.payments(user_id, created_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  reference text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.pricing enable row level security;
alter table public.paystack_plans enable row level security;
alter table public.entitlements enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;

revoke all on table public.pricing from anon, authenticated;
revoke all on table public.paystack_plans from anon, authenticated;
revoke all on table public.entitlements from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
