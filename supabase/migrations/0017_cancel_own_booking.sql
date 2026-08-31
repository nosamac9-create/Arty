-- ---------------------------------------------------------------------------
-- Customer self-cancellation.
--
-- THE BUG
-- `bookings` grants customers SELECT and nothing else (bookings_customer_select
-- in 0001_init). A customer pressing "Cancel booking" issued a direct UPDATE,
-- which RLS filtered to zero rows — PostgREST reports that as a success with an
-- empty result, so the UI showed a confirmation while the row never changed.
--
-- THE FIX
-- A SECURITY DEFINER function, not a widened policy. An UPDATE policy for
-- customers would let them write any column of their own bookings — status,
-- price, participants — and the only rule that matters here (the 24-hour
-- refund cutoff) cannot be expressed as a row predicate. This function is the
-- single, narrow write path: it decides what changes, and the caller decides
-- nothing but which booking.
--
-- Same shape as claim_customer_account / link_existing_customer in 0010:
-- plpgsql, security definer, pinned search_path, ownership proven from
-- auth.uid() rather than an argument, execute revoked from public and anon.
--
-- WHAT IT DOES NOT DO
-- Notifications and SMS stay in the application. notifyBookingCancellation()
-- already writes the notification row and invokes send-sms through the staff
-- client, and it composes the refunded/non-refunded wording. Moving that into
-- SQL would fork the message text and need pg_net for the Edge Function call;
-- instead the function returns `refunded` so the app fires its existing path
-- with the right message. One cancellation message, one code path.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The booking's start, as a Riyadh wall-clock timestamp.
--
-- Mirrors parseBookingDateTimeToRiyadhDate() in utils/dateUtils.ts: a bare
-- "16:00", a 12-hour "4:00 PM", or a range "16:00 - 18:00" whose first half is
-- the start. Anything unparseable yields null, and the caller treats that as
-- "cannot verify the window" rather than guessing.
--
-- Kept separate so the 24-hour rule can be read, and tested, on its own.
-- ---------------------------------------------------------------------------
create or replace function public.booking_start_at(p_date date, p_time text)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  raw     text;
  is_pm   boolean;
  is_am   boolean;
  hh      integer;
  mm      integer;
  parts   text[];
begin
  if p_date is null or p_time is null then
    return null;
  end if;

  -- A range is stored as "start - end"; only the start bounds the window.
  raw := upper(btrim(split_part(p_time, ' - ', 1)));
  if raw = '' then
    return null;
  end if;

  is_pm := raw like '%PM%';
  is_am := raw like '%AM%';
  raw   := btrim(replace(replace(raw, 'PM', ''), 'AM', ''));

  parts := string_to_array(raw, ':');
  if array_length(parts, 1) is null then
    return null;
  end if;

  begin
    hh := btrim(parts[1])::integer;
    mm := coalesce(nullif(btrim(parts[2]), ''), '0')::integer;
  exception when others then
    return null;
  end;

  if hh is null or hh < 0 or hh > 23 or mm < 0 or mm > 59 then
    return null;
  end if;

  -- Same 12-hour handling as the TypeScript: 1–11 PM shifts, 12 AM is midnight.
  if is_pm and hh < 12 then
    hh := hh + 12;
  elsif is_am and hh = 12 then
    hh := 0;
  end if;

  -- The stored date and time are Riyadh wall-clock, so they are interpreted in
  -- that zone rather than in the server's.
  return ((p_date::text || ' ' || lpad(hh::text, 2, '0') || ':' || lpad(mm::text, 2, '0') || ':00')
          ::timestamp at time zone 'Asia/Riyadh');
end;
$$;

revoke all on function public.booking_start_at(date, text) from public, anon;
grant execute on function public.booking_start_at(date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancel a booking the caller owns.
--
-- Returns a single row the UI can act on directly:
--   success   — whether the booking was cancelled
--   reason    — a sentence to show the customer when it was not
--   refunded  — whether the 24-hour rule made this refundable, so the app
--               sends the matching message
--   code      — stable machine-readable form of `reason`, for the UI to
--               branch on without matching prose
-- ---------------------------------------------------------------------------
create or replace function public.cancel_own_booking(p_booking_id text)
returns table (success boolean, code text, reason text, refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  b            public.bookings%rowtype;
  caller       text;
  starts_at    timestamptz;
  hours_notice numeric;
  is_refund    boolean;
  note         text;
  q            public.queue%rowtype;
begin
  if p_booking_id is null or btrim(p_booking_id) = '' then
    return query select false, 'not_found', 'That booking could not be found.', false;
    return;
  end if;

  -- auth.uid() comes from the caller's own JWT and cannot be supplied through
  -- the argument list, so ownership cannot be forged by passing someone
  -- else's id — the same reasoning as claim_customer_account in 0010.
  caller := public.current_customer_id();
  if caller is null then
    return query select false, 'not_owner', 'Please sign in to manage your bookings.', false;
    return;
  end if;

  select * into b from public.bookings where id = p_booking_id;

  -- "Not found" and "not yours" deliberately answer identically: a customer
  -- must not be able to probe which booking ids exist.
  if b.id is null or b.customer_id is null or b.customer_id <> caller then
    return query select false, 'not_owner', 'That booking could not be found on your account.', false;
    return;
  end if;

  if b.status = 'Cancelled' then
    return query select false, 'already_cancelled', 'This booking has already been cancelled.', false;
    return;
  end if;

  -- A session already attended, or under way, is not the customer's to undo.
  if b.status in ('Completed', 'Checked In', 'In Progress') then
    return query select
      false,
      'not_cancellable',
      'This booking can no longer be cancelled online. Please contact the studio.',
      false;
    return;
  end if;

  starts_at := public.booking_start_at(b.date, b.time);
  if starts_at is null then
    return query select
      false,
      'unknown_time',
      'We could not confirm this booking''s start time. Please contact the studio to cancel.',
      false;
    return;
  end if;

  hours_notice := extract(epoch from (starts_at - now())) / 3600.0;

  if hours_notice <= 0 then
    return query select
      false,
      'already_started',
      'This session has already started, so it can no longer be cancelled online.',
      false;
    return;
  end if;

  -- The rule the customer is shown: more than 24 hours' notice is refundable.
  -- Strictly greater than, matching cancelBooking()'s `diffHours > 24`.
  is_refund := hours_notice > 24;

  note := case
    when is_refund then 'Booking cancelled by Customer — Refund issued (>24h notice)'
    else 'Booking cancelled by Customer — Non-refundable (within 24h cutoff)'
  end;

  -- One statement, so the status, the refund state and the history entry
  -- cannot land apart. A deposit stays a deposit when there is no refund.
  update public.bookings
     set status         = 'Cancelled',
         payment_status = case when is_refund then 'Refunded' else payment_status end,
         timeline       = coalesce(timeline, '[]'::jsonb) || jsonb_build_object(
                            'time', to_char(now() at time zone 'Asia/Riyadh', 'FMHH12:MI AM'),
                            'action', note
                          ),
         updated_at     = now()
   where id = b.id;

  -- Seats go back through the same RPC staff cancellation uses, so there is
  -- one definition of what releasing a seat means.
  perform public.release_booking_seats(b.id);

  -- Queue parity with cancelBooking(): a linked entry that has not been called
  -- or served is cancelled too, or the studio is left expecting someone who
  -- has cancelled. The same states are left alone.
  select * into q from public.queue
   where booking_id = b.id
     and status not in ('Completed', 'In Progress', 'Called')
   limit 1;

  if q.id is not null then
    update public.queue
       set status     = 'Cancelled',
           history    = coalesce(history, '[]'::jsonb) || jsonb_build_object(
                          'status', 'Cancelled',
                          'timestamp', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                        ),
           updated_at = now()
     where id = q.id;
  end if;

  return query select true, 'cancelled', null::text, is_refund;
end;
$$;

revoke all on function public.cancel_own_booking(text) from public, anon;
grant execute on function public.cancel_own_booking(text) to authenticated;
