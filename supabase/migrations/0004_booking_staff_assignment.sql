-- =============================================================================
-- Arty Café — assign a staff member to a birthday/event booking.
--
-- A booking can now be hosted by a named staff member, the same way a workshop
-- session is. The id is the stable link; the name is denormalised alongside it
-- for display, matching workshop_sessions.
--
-- Run after 0003_customer_write_access.sql.
-- =============================================================================

alter table public.bookings
  add column if not exists staff_id   text references public.staff(id) on delete set null,
  add column if not exists staff_name text;

-- Assignments are looked up per staff member and day when checking availability.
create index if not exists bookings_staff_date_idx on public.bookings (staff_id, date);

-- Verification: expect two rows.
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'bookings'
   and column_name in ('staff_id', 'staff_name')
 order by 1;
