-- =============================================================================
-- Make booking writes idempotent, so a retry cannot double-book.
--
-- WHY
-- The checkout screen now times out a booking write that never resolves, and
-- offers the customer a retry. That creates a case neither function handled: the
-- request may have COMMITTED on the server and been lost on the way back — a
-- dropped connection, a closed laptop, a network that stalls after the insert.
-- The customer is told it failed; the booking exists.
--
-- Without this, pressing retry does one of two harmful things depending on how
-- the client behaves:
--   * a fresh booking id  -> two bookings, two seats consumed, one customer;
--   * the same booking id -> a primary key violation reported as a failure, so
--     the customer is told twice that a booking they actually hold did not work.
--
-- The client now reuses one booking id for every attempt at the same checkout,
-- and these functions treat a write for an id that already exists as the
-- success it is: return the id, insert nothing, consume nothing. Retrying is
-- then always safe, however many times it happens and whatever the customer's
-- connection did.
--
-- The check sits BEFORE the capacity check in both functions, deliberately. A
-- booking already on the table is already counted by session_seats_taken, so
-- testing capacity first would count it against itself and refuse the retry as
-- an overbooking — the one thing it certainly is not.
--
-- Nothing else about either function changes: same locks, same limits, same
-- errors, same grants.
--
-- Run after 0027_book_birthday_slot.sql.
-- =============================================================================

create or replace function public.book_session_seats(
  p_booking  jsonb,
  p_session_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity   integer;
  v_taken      integer;
  v_wanted     integer := coalesce((p_booking->>'participants')::integer, 1);
  v_booking_id text     := p_booking->>'id';
begin
  if v_wanted < 1 then
    raise exception 'A booking needs at least one participant';
  end if;

  -- Already written by an earlier attempt whose reply never arrived. Nothing to
  -- do, and reporting success is accurate: the booking exists.
  if v_booking_id is not null
     and exists (select 1 from public.bookings where id = v_booking_id) then
    return v_booking_id;
  end if;

  if p_session_id is not null then
    -- Lock the session for the rest of this transaction.
    select s.capacity into v_capacity
      from public.workshop_sessions s
     where s.id = p_session_id
       for update;

    if v_capacity is null then
      raise exception 'That session is no longer available';
    end if;

    v_taken := public.session_seats_taken(p_session_id);

    if v_taken + v_wanted > v_capacity then
      raise exception 'Only % seat(s) left on this session', greatest(0, v_capacity - v_taken)
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.bookings
  select * from jsonb_populate_record(null::public.bookings, p_booking);

  return v_booking_id;
end;
$$;

revoke all on function public.book_session_seats(jsonb, text) from public, anon;
grant execute on function public.book_session_seats(jsonb, text) to authenticated, anon;

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
  -- src/utils/queueUtils.ts.
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

  -- Same as above: an id already on the table is a reply that went missing, not
  -- a second party.
  if v_booking_id is not null
     and exists (select 1 from public.bookings where id = v_booking_id) then
    return v_booking_id;
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

revoke all on function public.book_birthday_slot(jsonb, boolean) from public;
grant execute on function public.book_birthday_slot(jsonb, boolean) to authenticated, anon;
