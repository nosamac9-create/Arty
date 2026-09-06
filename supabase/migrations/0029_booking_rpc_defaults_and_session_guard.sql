-- =============================================================================
-- Two fixes to the booking RPCs, both found while writing the Block 4 race
-- tests. Neither was reachable through the UI; both are reachable by a crafted
-- request, and both functions are executable by anon.
--
-- -----------------------------------------------------------------------------
-- FIX 1 — column defaults never applied
-- -----------------------------------------------------------------------------
-- Both functions insert with:
--
--     insert into public.bookings
--     select * from jsonb_populate_record(null::public.bookings, p_booking);
--
-- jsonb_populate_record over a NULL base produces a full row with null in every
-- key the JSON omitted, and `select *` inserts those nulls explicitly. An
-- explicit null overrides a column default, so no default on public.bookings has
-- ever applied through this path.
--
-- Nothing is broken today: the client sends a complete object. The risk is
-- entirely future — a column added later as NOT NULL DEFAULT breaks customer
-- checkout at runtime with a 23502, while the migration adding it looks
-- completely safe. It has already cost time once, in the atomic-capacity system
-- test, which carries a comment working around it.
--
-- The payload is now merged over a defaults object at the top of each function,
-- so everything downstream — the participant check, the idempotency lookup, the
-- capacity check and the insert — sees one normalised object.
--
-- `||` on jsonb is right-biased, so any key the caller supplies wins. Note that
-- an EXPLICIT null in the payload also wins, and will still fail the not-null
-- constraint. That is deliberate: omitting a key is an incomplete payload,
-- sending null for it is a statement, and only the first should be filled in.
--
-- id and date are deliberately NOT defaulted. Neither has a default in the
-- table, and a payload missing either is genuinely incomplete — it must keep
-- failing loudly rather than being papered over.
--
-- -----------------------------------------------------------------------------
-- FIX 2 — session-less and mis-routed bookings escaped the capacity check
-- -----------------------------------------------------------------------------
-- In book_session_seats the row lock and the capacity check both sat inside
-- `if p_session_id is not null then`. A request passing p_session_id => null
-- while carrying session_id INSIDE p_booking inserted a seat-consuming booking
-- with no lock taken and no capacity check run.
--
-- book_birthday_slot had the same hole from the other side. It never looks at
-- session_id, but session_seats_taken counts bookings by session_id with no
-- workshop_id filter — so a birthday-routed payload carrying a real session_id
-- consumed workshop seats through a function that checks only dates and slots.
--
-- Now: book_session_seats resolves the session from p_session_id, falling back
-- to p_booking->>'session_id', and refuses if neither is present. The lock and
-- the capacity check no longer sit in a conditional that can be skipped.
-- book_birthday_slot refuses any payload carrying a session_id at all — a
-- birthday party has no session, so such a payload is a mistake or an attack and
-- there is no case where honouring it is right.
--
-- No legitimate caller is affected. addBooking is the only production caller and
-- always has a session for workshop bookings (the checkout pre-check refuses
-- without one); birthday bookings route to book_birthday_slot and carry no
-- session; the system tests pass the id explicitly.
--
-- -----------------------------------------------------------------------------
-- BEHAVIOUR CHANGE WORTH KNOWING ABOUT
-- -----------------------------------------------------------------------------
-- src/lib/migrationCheck.ts probes this function on every page load with
-- `{ p_booking: {}, p_session_id: null }` purely to see whether it exists. That
-- probe currently comes back as a 23502 not-null violation; after this migration
-- it comes back as the new "not linked to a workshop session" refusal.
--
-- rpcExists treats any error other than function-not-found as proof the function
-- is present, so the migration check still passes and nothing needs changing.
-- Recorded because the console error on a signed-out page load changes text, and
-- nobody would think to look here for the reason.
--
-- PERMISSIONS ARE NOT TOUCHED
-- Neither function carries a grant or revoke here. `create or replace function`
-- retains the existing ACL, and this is a capacity-check migration — it has no
-- business altering who may execute these. The current ACL on both is
-- {postgres, anon, authenticated, service_role}, all explicit, with nothing
-- relying on PUBLIC.
--
-- Run after 0028_idempotent_booking_writes.sql.
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
  v_wanted     integer;
  v_booking_id text;
  v_session_id text;
begin
  -- DUPLICATED FROM 0001_init.sql. These are the defaults declared on
  -- public.bookings, restated because jsonb_populate_record cannot see them.
  -- If a default changes in the table it must change here too, in both
  -- functions, or the two disagree silently.
  p_booking := jsonb_build_object(
    'participants',   1,
    'total_price',    0,
    'source',         'Website',
    'status',         'Pending',
    'payment_status', 'Unpaid',
    'timeline',       '[]'::jsonb,
    'created_at',     now()
  ) || coalesce(p_booking, '{}'::jsonb);

  v_wanted     := coalesce((p_booking->>'participants')::integer, 1);
  v_booking_id := p_booking->>'id';

  if v_wanted < 1 then
    raise exception 'A booking needs at least one participant';
  end if;

  -- The session may arrive as the parameter or inside the payload. Resolving
  -- both means the capacity check cannot be skipped by omitting the parameter.
  v_session_id := coalesce(p_session_id, p_booking->>'session_id');

  if v_session_id is null then
    raise exception 'This booking is not linked to a workshop session, so its seats cannot be checked'
      using errcode = 'check_violation';
  end if;

  -- Already written by an earlier attempt whose reply never arrived. Nothing to
  -- do, and reporting success is accurate: the booking exists. Checked before
  -- the capacity rule because a booking already on the table is already counted
  -- by session_seats_taken, so testing capacity first would count it against
  -- itself and refuse the retry as an overbooking.
  if v_booking_id is not null
     and exists (select 1 from public.bookings where id = v_booking_id) then
    return v_booking_id;
  end if;

  -- Unconditional from here down. Lock the session for the rest of this
  -- transaction, so two callers taking the last seat serialise.
  select s.capacity into v_capacity
    from public.workshop_sessions s
   where s.id = v_session_id
     for update;

  if v_capacity is null then
    raise exception 'That session is no longer available';
  end if;

  v_taken := public.session_seats_taken(v_session_id);

  if v_taken + v_wanted > v_capacity then
    raise exception 'Only % seat(s) left on this session', greatest(0, v_capacity - v_taken)
      using errcode = 'check_violation';
  end if;

  insert into public.bookings
  select * from jsonb_populate_record(null::public.bookings, p_booking);

  return v_booking_id;
end;
$$;


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

  v_booking_id    text;
  v_date          date;
  v_time          text;
  v_override      boolean;
  v_on_date       integer;
  v_at_slot       integer;
begin
  -- DUPLICATED FROM 0001_init.sql — see the note in book_session_seats above.
  -- Change both functions together.
  p_booking := jsonb_build_object(
    'participants',   1,
    'total_price',    0,
    'source',         'Website',
    'status',         'Pending',
    'payment_status', 'Unpaid',
    'timeline',       '[]'::jsonb,
    'created_at',     now()
  ) || coalesce(p_booking, '{}'::jsonb);

  v_booking_id := p_booking->>'id';
  v_date       := (p_booking->>'date')::date;
  v_time       := coalesce(p_booking->>'time', '');
  v_override   := coalesce(p_allow_override, false) and public.is_staff();

  if v_date is null then
    raise exception 'A birthday booking needs a date';
  end if;

  -- A birthday party has no workshop session. A payload carrying one would
  -- consume seats on that session — session_seats_taken counts by session_id
  -- and does not filter on workshop_id — through a function that checks only
  -- dates and slots. There is no case where honouring it is correct.
  if p_booking->>'session_id' is not null then
    raise exception 'A birthday booking cannot be linked to a workshop session'
      using errcode = 'check_violation';
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
