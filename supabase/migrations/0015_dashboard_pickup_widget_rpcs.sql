-- =============================================================================
-- 0015 — SCOPED PICKUP-REMINDER RPCs FOR THE DASHBOARD WIDGET (audit finding C-4)
--
-- Run in the Supabase SQL editor, after 0013. NOT applied by this chunk.
--
-- WHY THIS EXISTS
-- 0014 (pieces_staff_all / piece_history_staff_all gated on
-- staff_can('pieces-admin')) would break AdminDashboardSection.tsx's
-- "Pottery Awaiting Pickup for 7+ Days" widget for any staff member with
-- console access but without the 'pieces-admin' permission — confirmed live
-- for Yuki (Dashboard, Live Queue, Bookings only). That widget reads
-- `pieces` directly and writes to it via updatePieceStatus()/updatePiece()
-- for its two actions (Mark Collected, Send Reminder).
--
-- These three functions give the Dashboard widget everything it needs
-- without granting it (or anyone without 'pieces-admin') broad pieces
-- access — mirroring resolve_customer_record's existing pattern of a
-- narrow, fixed-purpose SECURITY DEFINER function rather than a table grant.
-- Gated on is_staff() alone, deliberately not staff_can('pieces-admin'):
-- this widget is meant to work for any console-access staff member,
-- independent of that specific page permission.
--
-- WHY THESE ARE SAFE (not a general pieces read/write escape hatch)
-- - get_overdue_pickup_pieces() takes no parameters and returns a fixed
--   11-column set, hardcoded to status = 'Ready for Pickup'. There is no
--   argument through which a caller could request a different status, a
--   different field (damage_note, notes, assigned_staff, ...), or a
--   specific arbitrary piece by id.
-- - mark_piece_collected() / send_piece_pickup_reminder() each hardcode
--   exactly one status transition and exactly the field(s) it touches.
--   Neither accepts a target status, so neither can be used to set a piece
--   to 'Broken', skip pipeline stages, or touch damage_note. Both require
--   the row's CURRENT status to already be 'Ready for Pickup' -- calling
--   either against a piece in any other state is a no-op that returns
--   false.
--
-- NOTIFICATIONS ARE UNCHANGED
-- Neither 0013 nor 0014 touch the notifications table -- it stays on
-- blanket is_staff() (see the C-4 design report). So the customer/staff
-- notification writes that updatePieceStatus() already performs for the
-- 'Collected' transition are untouched by this whole effort; only the
-- pieces UPDATE and the piece_history INSERT needed a replacement, which
-- mark_piece_collected() below provides. The client-side wrapper keeps
-- doing the notification writes itself, unchanged, after this RPC succeeds.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- get_overdue_pickup_pieces() — the widget's read. Returns every piece
-- currently 'Ready for Pickup'; the 7+-day cutoff and sort stay client-side
-- exactly as today (Riyadh-local date math the app already has), rather
-- than duplicating that logic in SQL with a risk of it drifting out of sync.
-- -----------------------------------------------------------------------------
create or replace function public.get_overdue_pickup_pieces()
returns table (
  id                   text,
  piece_code           text,
  name                 text,
  workshop_name        text,
  customer_name        text,
  customer_phone       text,
  image                text,
  expected_ready_date  date,
  date_created         date,
  days_elapsed         integer,
  last_notification_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.piece_code, p.name, p.workshop_name, p.customer_name, p.customer_phone,
         p.image, p.expected_ready_date, p.date_created, p.days_elapsed, p.last_notification_date
    from public.pieces p
   where public.is_staff()
     and p.status = 'Ready for Pickup';
$$;

revoke all on function public.get_overdue_pickup_pieces() from public, anon;
grant execute on function public.get_overdue_pickup_pieces() to authenticated;

-- -----------------------------------------------------------------------------
-- mark_piece_collected(p_id, p_collection_date, p_riyadh_time) — the
-- widget's "Mark Collected".
--
-- p_riyadh_time and p_collection_date are both supplied by the caller
-- (computed via the app's existing getRiyadhDateString()/getRiyadhNow()
-- utilities) rather than recomputed in SQL. This matters for more than
-- formatting: Postgres's own current_date reflects the DATABASE SERVER's
-- timezone (Supabase defaults to UTC), not Riyadh time, so using current_date
-- directly here could silently record the wrong calendar day for a few hours
-- around Riyadh midnight -- a real behavior change from today's
-- updatePiece(pieceId, { collectionDate: todayDateStr }), not just a
-- cosmetic one. Neither value is security-sensitive: both are display/record
-- fields on an append-only log entry and a plain date column, not used in
-- any access-control decision -- the same trust level the existing
-- performer/reason strings already have.
--
-- The performer and reason strings are hardcoded to match today's exact
-- call in AdminDashboardSection.tsx (updatePieceStatus(id, 'Collected',
-- 'Front Desk Admin', 'Customer collected piece in-store.')) -- this
-- function is dedicated to that one call site, not a general status-setter.
--
-- Neither this function nor send_piece_pickup_reminder() below sets
-- updated_at -- the direct updatePieceStatus()/updatePiece() calls they
-- replace never touched that column for this transition either, so this
-- preserves that exactly rather than adding a new side effect.
-- -----------------------------------------------------------------------------
create or replace function public.mark_piece_collected(
  p_id text,
  p_collection_date date,
  p_riyadh_time text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not public.is_staff() then
    return false;
  end if;

  update public.pieces
     set status          = 'Collected',
         collection_date = p_collection_date
   where id = p_id
     and status = 'Ready for Pickup';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return false;
  end if;

  insert into public.piece_history (piece_id, status, "timestamp", riyadh_time, "user", reason)
  values (p_id, 'Collected', now(), p_riyadh_time, 'Front Desk Admin', 'Customer collected piece in-store.');

  return true;
end;
$$;

revoke all on function public.mark_piece_collected(text, date, text) from public, anon;
grant execute on function public.mark_piece_collected(text, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- send_piece_pickup_reminder(p_id, p_reminder_date) — the widget's "Send
-- Reminder". Matches today's handleSendReminder() exactly: only
-- last_notification_date changes, no piece_history entry, no notification
-- row (there never was one for this action). p_reminder_date is
-- caller-supplied for the same Riyadh-vs-server-timezone reason as
-- mark_piece_collected()'s p_collection_date above.
-- -----------------------------------------------------------------------------
create or replace function public.send_piece_pickup_reminder(
  p_id text,
  p_reminder_date date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not public.is_staff() then
    return false;
  end if;

  update public.pieces
     set last_notification_date = p_reminder_date
   where id = p_id
     and status = 'Ready for Pickup';

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.send_piece_pickup_reminder(text, date) from public, anon;
grant execute on function public.send_piece_pickup_reminder(text, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.get_overdue_pickup_pieces()')              is not null as get_overdue_fn_exists,
  to_regprocedure('public.mark_piece_collected(text,date,text)')     is not null as mark_collected_fn_exists,
  to_regprocedure('public.send_piece_pickup_reminder(text,date)')    is not null as send_reminder_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
