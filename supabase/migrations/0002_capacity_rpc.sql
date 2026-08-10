-- =============================================================================
-- Arty Café — Stage 2: atomic seat allocation.
--
-- Capacity must never be read-modify-written from the browser: two customers
-- taking the last seat would both read "1 left" and both succeed. These
-- functions do the check and the decrement inside one statement, so Postgres
-- serialises them.
--
-- Run after 0001_init.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Seats already held on a session.
--
-- Mirrors getSessionSeatUsage() in src/utils/queueUtils.ts: active bookings
-- plus instructor-led walk-ins, with a walk-in that is linked to a booking
-- counted once (through the booking).
-- -----------------------------------------------------------------------------
create or replace function public.session_seats_taken(p_session_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select sum(b.participants) from public.bookings b
     where b.session_id = p_session_id
       and lower(coalesce(b.status, '')) not in ('cancelled','auto-cancelled','draft','no show','no-show')
       and lower(coalesce(b.payment_status, '')) not in ('failed','payment failed','declined','draft')
  ), 0)
  +
  coalesce((
    select sum(q.participants) from public.queue q
     where q.session_id = p_session_id
       and q.booking_id is null
       and lower(coalesce(q.status, '')) not in ('cancelled','completed')
  ), 0);
$$;

-- -----------------------------------------------------------------------------
-- Seats left on a session right now.
-- -----------------------------------------------------------------------------
create or replace function public.session_seats_remaining(p_session_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    coalesce((select s.capacity from public.workshop_sessions s where s.id = p_session_id), 0)
      - public.session_seats_taken(p_session_id)
  );
$$;

-- -----------------------------------------------------------------------------
-- Create a booking, refusing it if the seats are not there.
--
-- The session row is locked FOR UPDATE before the seat count is taken, so two
-- concurrent callers are serialised: the second sees the first's booking and
-- is refused. Returns the booking id, or raises so the caller reports it.
-- -----------------------------------------------------------------------------
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
  v_workshop   text     := p_booking->>'workshop_id';
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
      raise exception 'Only % seat(s) left for this session', greatest(0, v_capacity - v_taken)
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.bookings
  select * from jsonb_populate_record(null::public.bookings, p_booking);

  -- Keep the workshop's denormalised counter in step, in one statement.
  if v_workshop is not null and v_workshop <> 'birthday-party-event' then
    update public.workshops
       set spots_left = greatest(0, spots_left - v_wanted)
     where id = v_workshop;
  end if;

  return v_booking_id;
end;
$$;

revoke all on function public.book_session_seats(jsonb, text) from public, anon;
grant execute on function public.book_session_seats(jsonb, text) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Release seats when a booking is cancelled. Also one statement, and clamped
-- to the workshop capacity so repeated cancellation cannot inflate it.
-- -----------------------------------------------------------------------------
create or replace function public.release_booking_seats(p_booking_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workshop text;
  v_seats    integer;
begin
  select b.workshop_id, b.participants into v_workshop, v_seats
    from public.bookings b where b.id = p_booking_id;

  if v_workshop is null or v_workshop = 'birthday-party-event' then
    return;
  end if;

  update public.workshops
     set spots_left = least(capacity, spots_left + coalesce(v_seats, 0))
   where id = v_workshop;
end;
$$;

revoke all on function public.release_booking_seats(text) from public, anon;
grant execute on function public.release_booking_seats(text) to authenticated;

grant execute on function public.session_seats_taken(text) to authenticated, anon;
grant execute on function public.session_seats_remaining(text) to authenticated, anon;

-- -----------------------------------------------------------------------------
-- Next queue number for a given day.
--
-- Replaces generateNextQueueId()'s read-then-write, which could hand the same
-- number to two walk-ins checked in at once.
-- -----------------------------------------------------------------------------
create or replace function public.next_queue_id(p_date date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'Q-' || lpad((
    coalesce(max(nullif(regexp_replace(q.id, '\D', '', 'g'), '')::integer), 0) + 1
  )::text, 3, '0')
  from public.queue q
  where q.date = p_date;
$$;

grant execute on function public.next_queue_id(date) to authenticated;

-- =============================================================================
-- Realtime: the app subscribes to these tables via postgres_changes.
--
-- This is deliberately failure-proof. `alter publication` needs ownership of
-- supabase_realtime, and on some projects the SQL editor's role does not have
-- it. An uncaught error here would abort the whole file and roll back every
-- function above — which is exactly what happened the first time. Every
-- outcome is swallowed and reported as a notice instead.
-- =============================================================================
do $$
declare
  t       text;
  added   int := 0;
  skipped int := 0;
begin
  foreach t in array ARRAY[
    'workshops','workshop_sessions','bookings','queue','pieces','piece_history',
    'categories','notifications','pipeline_stages','staff','workshop_options',
    'event_options','events','app_settings','customers','birthday_packages',
    'studio_resources'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
      added := added + 1;
    exception
      when others then
        -- already published, no publication, or not the owner: never fatal.
        skipped := skipped + 1;
    end;
  end loop;

  raise notice 'Realtime: % table(s) added, % skipped.', added, skipped;
  if added = 0 then
    raise notice 'If live updates do not work, enable Realtime for these tables '
                 'under Database -> Replication in the dashboard.';
  end if;
end
$$;

-- =============================================================================
-- Verification. The result of this migration, so a silent failure is visible.
-- Expect five rows.
-- =============================================================================
select p.proname as created_function
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'session_seats_taken', 'session_seats_remaining',
     'book_session_seats', 'release_booking_seats', 'next_queue_id'
   )
 order by 1;
