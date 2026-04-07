-- Расходы владельца. Таблица может уже существовать в проекте — файл для документации и повторного развёртывания.
-- RLS: строки привязаны к auth.uid() как owner_id.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  amount_kzt numeric(14, 2) not null check (amount_kzt >= 0),
  category text not null
    check (category in ('salary', 'rent', 'supplies', 'other')),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists expenses_owner_occurred_idx
  on public.expenses (owner_id, occurred_at desc);

alter table public.expenses enable row level security;

create policy "expenses_select_own" on public.expenses
  for select using (auth.uid() = owner_id);
create policy "expenses_insert_own" on public.expenses
  for insert with check (auth.uid() = owner_id);
create policy "expenses_update_own" on public.expenses
  for update using (auth.uid() = owner_id);
create policy "expenses_delete_own" on public.expenses
  for delete using (auth.uid() = owner_id);
