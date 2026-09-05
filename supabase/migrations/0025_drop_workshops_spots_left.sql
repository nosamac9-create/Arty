-- =============================================================================
-- Remove workshops.spots_left.
--
-- WHY IT CANNOT BE MADE CORRECT
-- It is one integer per WORKSHOP recording a quantity that belongs to a
-- SESSION. A workshop running twelve sessions has twelve independent seat
-- counts and one column to hold them, so there is no value it could carry that
-- would be right. (workshop_sessions has never had a spots_left column, and the
-- client's per-session `spotsLeft` was form state the mapper dropped on write.)
--
-- On top of that it was maintained by two paths that disagreed:
--   * book_session_seats and release_booking_seats decremented and restored it;
--   * saving a workshop in the console overwrote it with the workshop's
--     capacity, discarding every booking that had been taken.
-- Walk-ins never decremented it at all.
--
-- It had exactly one reader — the workshop grid's "Popularity" sort, which is
-- therefore the only thing this ever affected, and which now ranks by
-- workshop_recent_bookings (0024). Seats displayed to customers come from
-- session_seats_summary (0023), counted from the bookings themselves, so there
-- is nothing left to denormalise into.
--
-- events.spots_left is a DIFFERENT column on a different table and is left
-- alone: an event is a single dated occasion, so one counter per event is
-- coherent in a way that one counter per workshop is not.
--
-- Run after 0024_workshop_recent_bookings.sql.
-- =============================================================================

-- ---------- Stop the two functions writing to it ----------
-- Both are otherwise unchanged: the capacity check, the row lock and the insert
-- all still happen exactly as before. Only the denormalised counter update is
-- removed. The authoritative count was never this column — it is
-- session_seats_taken, computed from the bookings, which is what the check
-- below already uses.

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

create or replace function public.release_booking_seats(p_booking_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Seats are released by the booking's own status changing, which
  -- session_seats_taken reads directly. With the denormalised counter gone
  -- there is nothing left for this to do, but it is kept as a no-op so the
  -- client can keep calling it: removing the function would break every caller
  -- at once, and a future change may need this hook again.
  perform 1 from public.bookings where id = p_booking_id;
end;
$$;

revoke all on function public.release_booking_seats(text) from public, anon;
grant execute on function public.release_booking_seats(text) to authenticated;

-- ---------- Drop the column ----------
alter table public.workshops drop column if exists spots_left;
