-- =============================================================================
-- Birthday party counts per date and per time slot.
--
-- WHY
-- Birthday reservations have two maxima — BIRTHDAY_DAILY_MAX parties in a day
-- and BIRTHDAY_SAME_SLOT_MAX sharing one date and time. Both were enforced only
-- by counting the `bookings` array held in the browser, which is RLS-scoped:
-- bookings_customer_select (0001_init) returns a customer their own rows and a
-- signed-out visitor none. A customer therefore counted at most their own
-- parties, so the picker never greyed a slot out and the submit-time guard in
-- validateBirthdayBookingForm never refused anything.
--
-- Unlike a workshop booking, there was NOTHING BEHIND IT. A workshop's dead
-- guard was still backstopped by book_session_seats, which re-checks capacity
-- under a row lock. A birthday booking has no session row, and 0002 routes it
-- explicitly around that path (`v_workshop <> 'birthday-party-event'`), so
-- these two maxima have not been enforced at all for customer-made bookings.
--
-- SECURITY DEFINER so it counts every party regardless of who asks, while
-- returning nothing but counts — no customer, no booking id, no party details.
--
-- WHAT COUNTS AS A BIRTHDAY BOOKING
-- The sentinel workshop id, or a title mentioning a birthday — the same test as
-- isBirthdayBookingRecord() in src/utils/queueUtils.ts. Bookings written before
-- the sentinel existed carry only the title, which is why both are checked.
--
-- WHICH BOOKINGS STILL HOLD THE SLOT
-- The same status and payment exclusions as session_seats_taken (0002) and
-- isActiveBookingRecord(): a cancelled or no-show party is not occupying a slot.
--
-- p_exclude_booking_id lets a booking being edited avoid counting itself.
--
-- Run after 0025_drop_workshops_spots_left.sql.
-- =============================================================================

create or replace function public.birthday_booking_counts(
  p_dates               date[],
  p_exclude_booking_id  text default null
)
returns table (
  booking_date  date,
  booking_time  text,
  party_count   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.date,
    coalesce(b.time, ''),
    count(*)::integer
  from public.bookings b
  where b.date = any(coalesce(p_dates, '{}'::date[]))
    and (
      b.workshop_id = 'birthday-party-event'
      or coalesce(b.workshop_title, '') ilike '%birthday%'
    )
    and lower(coalesce(b.status, '')) not in ('cancelled','auto-cancelled','draft','no show','no-show')
    and lower(coalesce(b.payment_status, '')) not in ('failed','payment failed','declined','draft')
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
  group by b.date, coalesce(b.time, '');
$$;

-- Availability is public: a visitor has to be told a date is full before being
-- asked to pick one. Same grant as the seat and popularity functions.
grant execute on function public.birthday_booking_counts(date[], text) to authenticated, anon;
