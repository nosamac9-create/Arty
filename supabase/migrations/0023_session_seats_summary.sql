-- =============================================================================
-- Batched seat counts for the customer-facing pages.
--
-- WHY
-- Every customer-facing availability display summed the `bookings` and `queue`
-- arrays held in the browser. Both tables are RLS-scoped to the caller:
-- bookings_customer_select and queue_customer_select (0001_init) return only
-- rows belonging to the signed-in customer, and a signed-out visitor sees
-- nothing at all. So the sum was almost always zero, and every session read as
-- completely open regardless of how full it was.
--
-- session_seats_taken (0002) is the correct source and has been there all
-- along. It is SECURITY DEFINER, so it counts every booking and walk-in
-- irrespective of who is asking, while still exposing nothing but a number —
-- the caller learns how many seats are gone, never who took them.
--
-- It is per-session, though, and a workshop detail page shows a month of
-- sessions at once. Calling it once per session would be twelve round trips for
-- one page, and the browsing grid would issue one per session across every
-- workshop on screen. This is the same function, over an array, in one call.
--
-- It deliberately reuses session_seats_taken rather than restating the query:
-- what counts as a taken seat is decided in exactly one place, so this can
-- never drift from what book_session_seats enforces at write time.
--
-- Unknown or non-existent ids are simply absent from the result rather than
-- returning a row of zeros. A caller must be able to tell "this session has no
-- seats left" from "I know nothing about this session" — reporting the second
-- as the first is how a full session ends up looking bookable.
--
-- Run after 0002_capacity_rpc.sql.
-- =============================================================================

create or replace function public.session_seats_summary(p_session_ids text[])
returns table (
  session_id      text,
  capacity        integer,
  seats_taken     integer,
  seats_remaining integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.capacity,
    public.session_seats_taken(s.id),
    greatest(0, s.capacity - public.session_seats_taken(s.id))
  from public.workshop_sessions s
  where s.id = any(coalesce(p_session_ids, '{}'::text[]));
$$;

-- Same grant as the single-session functions it wraps: availability is public
-- information, and a visitor who is not signed in still has to be told which
-- sessions are full before they are asked to pick one.
grant execute on function public.session_seats_summary(text[]) to authenticated, anon;
