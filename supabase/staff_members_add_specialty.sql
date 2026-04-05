-- Одноразово для уже созданной таблицы без колонки (идемпотентно).
alter table public.staff_members
  add column if not exists specialty text not null default '';
