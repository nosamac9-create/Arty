-- =============================================================================
-- Give cancel_own_booking (migration 0017) the same in-app notification
-- staff cancellations already get, written server-side.
--
-- WHY THIS ISN'T A CLIENT-SIDE INSERT
-- notifications has three policies (0001_init.sql): notifications_staff_all
-- (staff, full CRUD), notifications_customer_select and
-- notifications_customer_update (a customer reads and marks read their own
-- customer-type rows). There is no notifications_customer_insert, and this
-- does not add one. The reasoning is the same one 0017's own header gives for
-- why cancel_own_booking exists instead of an UPDATE policy on bookings: a
-- policy would let a customer write any column of their own row, including
-- ones like title/message that should only ever say what the server decided
-- happened. This function already has the booking, the caller's identity
-- (proven via current_customer_id(), not a client-supplied value) and the
-- refund decision in hand under SECURITY DEFINER — the same trust boundary
-- that already lets it update bookings/queue and release seats. Writing the
-- notification here keeps that boundary in one place instead of opening a
-- second one.
--
-- The client (AppContext.tsx, cancelOwnBooking()) stops attempting this
-- insert itself. It always failed silently on notifications_staff_all being
-- the only matching policy for a customer session — this is not a behaviour
-- change from the customer's perspective, only from "attempted and quietly
-- dropped" to "actually happens".
--
-- SMS is deliberately NOT added here: plpgsql has no HTTP capability in this
-- project (neither pg_cron nor pg_net is enabled — see auto-cancel-bookings's
-- own header for why). SMS is handled by a new Edge Function,
-- notify-own-booking, called from the client after this RPC returns.
--
-- Run after 0030_queue_surrogate_key.sql.
-- =============================================================================

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

  -- In-app notification, written here rather than by the client — see the
  -- header comment for why. Wording mirrors notifyBookingCancellation()
  -- (AppContext.tsx) exactly, so a customer sees the same message regardless
  -- of who triggered the cancellation.
  insert into public.notifications (
    id, type, customer_id, customer_phone, title, message, "timestamp", is_read, highlighted
  ) values (
    'NOTIF-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text
             || '-' || floor(random() * 1000)::int::text,
    'customer',
    b.customer_id,
    b.customer_phone,
    case when is_refund then 'Booking Cancelled — Refunded' else 'Booking Cancelled' end,
    case when is_refund
      then 'Your booking for "' || b.workshop_title || '" on '
             || to_char(b.date, 'FMMonth FMDD, YYYY') || ' has been cancelled, and '
             || (b.total_price)::int::text || ' SAR has been refunded. We hope to see you again soon!'
      else 'Your booking for "' || b.workshop_title || '" on '
             || to_char(b.date, 'FMMonth FMDD, YYYY')
             || ' has been cancelled. Per our cancellation policy, this booking was not eligible '
             || 'for a refund. Please contact Arty Café with any questions.'
    end,
    now(),
    false,
    false
  );

  return query select true, 'cancelled', null::text, is_refund;
end;
$$;

revoke all on function public.cancel_own_booking(text) from public, anon;
grant execute on function public.cancel_own_booking(text) to authenticated;
