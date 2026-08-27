-- =============================================================================
-- 0016 — COOLDOWN FOR send_piece_pickup_reminder (SMS integration, Chunk 2)
--
-- Run in the Supabase SQL editor, after 0015. NOT applied by this chunk.
--
-- WHY THIS EXISTS
-- Chunk 2 wires the Dashboard's "Send Reminder" button to a real SMS send
-- (send-sms Edge Function — already deployed, not yet called from
-- anywhere). Today, send_piece_pickup_reminder (0015) has no protection
-- against being called repeatedly for the same piece — it just
-- overwrites last_notification_date every time. Once a real text message
-- goes out on every call, that gap becomes "a staff member repeatedly
-- clicking (or double-clicking) Send Reminder repeatedly texts the same
-- customer" — a real cost (SMS spend) and a real annoyance to the
-- customer, not just a database write.
--
-- THE FIX
-- Refuse to update — and therefore refuse to text — a piece that was
-- already reminded on the same Riyadh-local date p_reminder_date
-- represents. No new parameter: the caller already supplies today's
-- Riyadh-local date for this exact reason (see 0015's own comment on
-- Postgres's current_date reflecting the database server's timezone, not
-- Riyadh's).
--
-- Returns one of three strings instead of a boolean, so the caller can
-- show the right message rather than treating a cooldown as a hard
-- failure:
--   'sent'      — last_notification_date was updated; the caller should
--                 go ahead and send the SMS.
--   'cooldown'  — already reminded today; the caller must NOT send an
--                 SMS.
--   'not_found' — piece doesn't exist, caller isn't staff, or the piece
--                 isn't currently 'Ready for Pickup' — the same
--                 catch-all send_piece_pickup_reminder already returned
--                 false for, just spelled out. Kept as one bucket
--                 deliberately: distinguishing "not staff" from "not
--                 found" would leak information an unauthorized caller
--                 has no business learning.
--
-- A piece with no prior reminder (last_notification_date is null) is
-- never blocked — `is distinct from` treats null and a real date as
-- different, so the very first reminder for a piece works exactly as it
-- does today.
--
-- Return type changes (boolean -> text), so this drops and recreates the
-- function rather than using create or replace, which cannot change an
-- existing function's return type.
-- =============================================================================

drop function if exists public.send_piece_pickup_reminder(text, date);

create function public.send_piece_pickup_reminder(
  p_id text,
  p_reminder_date date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
  v_still_eligible boolean;
begin
  if not public.is_staff() then
    return 'not_found';
  end if;

  update public.pieces
     set last_notification_date = p_reminder_date
   where id = p_id
     and status = 'Ready for Pickup'
     and last_notification_date is distinct from p_reminder_date;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    return 'sent';
  end if;

  -- Nothing updated: was it the cooldown, or does the piece not qualify
  -- at all? Re-checked without the cooldown clause. A race between the
  -- UPDATE above and this SELECT (e.g. the piece is deleted or collected
  -- in between) only affects which of these two strings comes back, not
  -- any data write — the UPDATE already committed to its own outcome.
  select exists (
    select 1 from public.pieces
     where id = p_id and status = 'Ready for Pickup'
  ) into v_still_eligible;

  if v_still_eligible then
    return 'cooldown';
  end if;

  return 'not_found';
end;
$$;

revoke all on function public.send_piece_pickup_reminder(text, date) from public, anon;
grant execute on function public.send_piece_pickup_reminder(text, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.send_piece_pickup_reminder(text,date)') is not null as send_reminder_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
