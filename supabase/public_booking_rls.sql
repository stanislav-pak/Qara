-- Public online booking (anon key): run in Supabase SQL after replacing YOUR_OWNER_UUID
-- with the same UUID as VITE_BOOKING_OWNER_ID (auth.users.id of the salon owner).

-- Staff & services: read-only for booking UI
create policy "staff_anon_select_for_booking"
  on public.staff_members
  for select
  to anon
  using (owner_id = 'YOUR_OWNER_UUID'::uuid and is_active = true);

create policy "services_anon_select_for_booking"
  on public.services
  for select
  to anon
  using (owner_id = 'YOUR_OWNER_UUID'::uuid and is_active = true);

-- Slot availability: read appointments for that tenant
create policy "appointments_anon_select_for_booking"
  on public.appointments
  for select
  to anon
  using (owner_id = 'YOUR_OWNER_UUID'::uuid);

-- New booking row
create policy "appointments_anon_insert_for_booking"
  on public.appointments
  for insert
  to anon
  with check (owner_id = 'YOUR_OWNER_UUID'::uuid);

-- Clients: find by phone + create
create policy "clients_anon_select_for_booking"
  on public.clients
  for select
  to anon
  using (owner_id = 'YOUR_OWNER_UUID'::uuid);

create policy "clients_anon_insert_for_booking"
  on public.clients
  for insert
  to anon
  with check (owner_id = 'YOUR_OWNER_UUID'::uuid);

-- Line items for the new appointment
create policy "appointment_services_anon_insert_for_booking"
  on public.appointment_services
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.appointments a
      where a.id = appointment_services.appointment_id
        and a.owner_id = 'YOUR_OWNER_UUID'::uuid
    )
  );
