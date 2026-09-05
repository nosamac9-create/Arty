-- =============================================================================
-- Atomic birthday slot allocation.
--
-- WHY
-- 0026 gave the client honest counts, so the picker and the submit-time guard
-- now bind for a customer using the form. That is a pre-check, not a guarantee:
-- two customers submitting the last slot at the same instant both read "one
-- left" and both insert, and anyone calling PostgREST directly skips the check
-- entirely.
--
-- This is the birthday equivalent of book_session_seats (0002): the count and
-- the insert happen in one statement, so Postgres serialises them. The workshop
-- path is the proof that this is the part that matters — every seat display
-- above it was broken for months and no class was ever oversold, because the
-- row lock held.
--
-- WHAT IS LOCKED
-- A birthday booking has no session row to lock, and locking the bookings table
-- would serialise every booking in the studio. Instead an advisory transaction
-- lock is taken on the DATE. Two submissions for the same date queue behind each
-- other; submissions for different dates never interact. The lock is released
-- when the transaction ends, whether it commits or fails.
--
-- Advisory locks share one 64-bit space per database, so the key is namespaced
-- by hashing a prefixed string rather than hashing the date alone.
--
-- STAFF OVERRIDE
-- p_allow_override lets a staff member exceed the maxima deliberately — a
-- private buyout, a sixth party the studio has agreed to take. It is honoured
-- ONLY for a caller that passes is_staff(); a customer setting the flag gets
-- the limits regardless. The check is here rather than in the client because
-- this function is reachable directly.
--
-- Note the override skips the LIMIT, not the lock: two staff members booking
-- the same slot at once still serialise.
--
-- Run after 0026_birthday_booking_counts.sql.
-- =============================================================================

create or replace function public.book_birthday_slot(
  p_booking        jsonb,
  p_allow_override boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Kept in step with BIRTHDAY_DAILY_MAX / BIRTHDAY_SAME_SLOT_MAX in
  -- src/utils/queueUtils.ts. The client shows the friendly message; this
  -- decides the outcome.
  c_daily_max     constant integer := 5;
  c_slot_max      constant integer := 2;

  v_booking_id    text    := p_booking->>'id';
  v_date          date    := (p_booking->>'date')::date;
  v_time          text    := coalesce(p_booking->>'time', '');
  v_override      boolean := coalesce(p_allow_override, false) and public.is_staff();
  v_on_date       integer;
  v_at_slot       integer;
begin
  if v_date is null then
    raise exception 'A birthday booking needs a date';
  end if;

  -- Serialise every booking for this date for the rest of the transaction.
  perform pg_advisory_xact_lock(hashtext('birthday_slot:' || v_date::text));

  if not v_override then
    select
      count(*),
      count(*) filter (where coalesce(b.time, '') = v_time)
      into v_on_date, v_at_slot
    from public.bookings b
    where b.date = v_date
      and (
        b.workshop_id = 'birthday-party-event'
        or coalesce(b.workshop_title, '') ilike '%birthday%'
      )
      and lower(coalesce(b.status, '')) not in ('cancelled','auto-cancelled','draft','no show','no-show')
      and lower(coalesce(b.payment_status, '')) not in ('failed','payment failed','declined','draft')
      and (v_booking_id is null or b.id <> v_booking_id);

    if v_on_date >= c_daily_max then
      raise exception 'That date is fully booked for birthday celebrations'
        using errcode = 'check_violation';
    end if;

    if v_at_slot >= c_slot_max then
      raise exception 'That time slot is fully booked for birthday celebrations'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.bookings
  select * from jsonb_populate_record(null::public.bookings, p_booking);

  return v_booking_id;
end;
$$;

-- anon included for the same reason book_session_seats includes it: a visitor
-- can book without having claimed an account.
revoke all on function public.book_birthday_slot(jsonb, boolean) from public;
grant execute on function public.book_birthday_slot(jsonb, boolean) to authenticated, anon;
