-- Аватары мастеров: колонка в staff_members + bucket staff-avatars.
-- Выполните в Supabase SQL Editor после основной схемы.

alter table public.staff_members
  add column if not exists avatar_url text;

-- Публичное чтение файлов (URL в img src, в т.ч. для страницы бронирования).
insert into storage.buckets (id, name, public)
values ('staff-avatars', 'staff-avatars', true)
on conflict (id) do update set public = excluded.public;

-- Удалить старые политики с теми же именами при повторном запуске (опционально).
drop policy if exists "staff_avatars_select_public" on storage.objects;
drop policy if exists "staff_avatars_insert_owner" on storage.objects;
drop policy if exists "staff_avatars_update_owner" on storage.objects;
drop policy if exists "staff_avatars_delete_owner" on storage.objects;

create policy "staff_avatars_select_public"
  on storage.objects for select to public
  using (bucket_id = 'staff-avatars');

create policy "staff_avatars_insert_owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'staff-avatars'
    and name like (auth.uid()::text || '/%')
  );

create policy "staff_avatars_update_owner"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'staff-avatars'
    and name like (auth.uid()::text || '/%')
  )
  with check (
    bucket_id = 'staff-avatars'
    and name like (auth.uid()::text || '/%')
  );

create policy "staff_avatars_delete_owner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'staff-avatars'
    and name like (auth.uid()::text || '/%')
  );
