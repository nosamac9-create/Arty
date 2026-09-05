-- =============================================================================
-- How many bookings each workshop took over a window — the popularity signal.
--
-- WHY
-- Two customer-facing features rank workshops by demand, and both counted the
-- bookings visible to the caller. bookings_customer_select (0001_init) returns
-- only rows belonging to the signed-in customer, and a signed-out visitor sees
-- none, so both counted zero for every workshop:
--
--   * the home page's featured carousel, whose ranking therefore collapsed to
--     its tie-breakers (soonest session, then array order) and has never once
--     ordered by popularity on the public site;
--   * the workshop grid's "Popularity" sort — the DEFAULT sort — which read
--     workshops.spots_left instead, a per-workshop counter for a per-session
--     quantity that a workshop save reset to full anyway.
--
-- SECURITY DEFINER, like the seat functions beside it, so it counts every
-- booking regardless of who is asking while returning nothing but a count per
-- workshop. No customer, no date, no booking id ever leaves this function.
--
-- WINDOW AS PARAMETERS
-- The bounds are passed in rather than derived from current_date, because
-- "today" here means today in Asia/Riyadh, which the client already resolves.
-- Computing it server-side from the database's clock would put the window a few
-- hours out of step with every other date on the site.
--
-- WHICH DATE COUNTS
-- created_at when it is set, falling back to the session date — the same rule
-- bookingDateKey() applies in src/utils/featuredWorkshops.ts. Popularity is
-- about when a booking was TAKEN; the fallback only covers older rows written
-- before created_at was populated.
--
-- WHICH BOOKINGS COUNT
-- The same status and payment exclusions as session_seats_taken (0002), which
-- mirror isActiveBookingRecord() in the client. Cancelled, no-show and draft
-- bookings are not demand. Completed, Checked In, In Progress and Pending all
-- are — a finished workshop is the strongest evidence of demand there is.
--
-- Run after 0023_session_seats_summary.sql.
-- =============================================================================

create or replace function public.workshop_recent_bookings(
  p_from date,
  p_to   date
)
returns table (
  workshop_id    text,
  recent_bookings integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.workshop_id,
    count(*)::integer
  from public.bookings b
  where b.workshop_id is not null
    and lower(coalesce(b.status, '')) not in ('cancelled','auto-cancelled','draft','no show','no-show')
    and lower(coalesce(b.payment_status, '')) not in ('failed','payment failed','declined','draft')
    and coalesce((b.created_at at time zone 'Asia/Riyadh')::date, b.date) between p_from and p_to
  group by b.workshop_id;
$$;

-- Public information in aggregate: which classes are in demand is exactly what
-- the home page is for. Same grant as the seat functions.
grant execute on function public.workshop_recent_bookings(date, date) to authenticated, anon;
