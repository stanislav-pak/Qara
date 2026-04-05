-- Owner dashboard: appointments, staff, revenue. Run in Supabase SQL Editor.
-- RLS: each row scoped to auth.uid() as owner_id.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Приём',
  client_name text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now()
);

create index if not exists appointments_owner_scheduled_idx
  on public.appointments (owner_id, scheduled_at);

alter table public.appointments enable row level security;

create policy "appointments_select_own" on public.appointments
  for select using (auth.uid() = owner_id);
create policy "appointments_insert_own" on public.appointments
  for insert with check (auth.uid() = owner_id);
create policy "appointments_update_own" on public.appointments
  for update using (auth.uid() = owner_id);
create policy "appointments_delete_own" on public.appointments
  for delete using (auth.uid() = owner_id);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.staff_members
  add column if not exists specialty text not null default '';

create index if not exists staff_members_owner_active_idx
  on public.staff_members (owner_id, is_active);

alter table public.staff_members enable row level security;

create policy "staff_select_own" on public.staff_members
  for select using (auth.uid() = owner_id);
create policy "staff_insert_own" on public.staff_members
  for insert with check (auth.uid() = owner_id);
create policy "staff_update_own" on public.staff_members
  for update using (auth.uid() = owner_id);
create policy "staff_delete_own" on public.staff_members
  for delete using (auth.uid() = owner_id);

create table if not exists public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  amount_kzt numeric(14, 2) not null check (amount_kzt >= 0),
  occurred_at timestamptz not null default now(),
  note text
);

create index if not exists sales_owner_occurred_idx
  on public.sales_transactions (owner_id, occurred_at);

alter table public.sales_transactions enable row level security;

create policy "sales_select_own" on public.sales_transactions
  for select using (auth.uid() = owner_id);
create policy "sales_insert_own" on public.sales_transactions
  for insert with check (auth.uid() = owner_id);
create policy "sales_update_own" on public.sales_transactions
  for update using (auth.uid() = owner_id);
create policy "sales_delete_own" on public.sales_transactions
  for delete using (auth.uid() = owner_id);
