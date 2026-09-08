-- =============================================================================
-- Enforce, at the schema level, an invariant that has so far only held by
-- convention: a 'Without Instructor' (self-guided) queue row never carries a
-- session_id or workshop_id.
--
-- WHY THIS MATTERS
-- Two different places count "seats taken" on a workshop session:
--   - getSessionSeatUsage() (src/utils/queueUtils.ts) filters queue rows to
--     type = 'With Instructor' before counting them as walk-in seats.
--   - session_seats_taken() (migration 0002) counts ANY queue row for the
--     session with booking_id is null — no type filter at all.
-- These currently agree only because every write site that ever sets
-- queue.session_id or queue.workshop_id also sets type = 'With Instructor'
-- in the same write (LiveQueueSection.tsx's Add Walk-In modal, and three
-- separate blocks in AppContext.tsx). A 'Without Instructor' row has never
-- carried either field — confirmed against the live database at the time of
-- writing: 11 'With Instructor' rows, all 11 with both fields set; 2
-- 'Without Instructor' rows, neither with either field set. But nothing in
-- the schema enforced this — it was pure application convention, four
-- separate places from breaking silently.
--
-- WHAT THIS DOES NOT CHANGE
-- Neither counting function is touched. This is purely a guarantee that the
-- assumption they already share can no longer be violated by a future write
-- path, a data-repair script, or a manual edit.
--
-- VERIFIED BEFORE WRITING THIS MIGRATION
-- select count(*) from public.queue
--  where type = 'Without Instructor'
--    and (session_id is not null or workshop_id is not null);
-- -> 0 (checked against the live database via `supabase db query --linked`).
--
-- Run after 0031_cancel_own_booking_notification.sql.
-- =============================================================================

alter table public.queue drop constraint if exists queue_without_instructor_no_session_link;

alter table public.queue
  add constraint queue_without_instructor_no_session_link
  check (type <> 'Without Instructor' or (session_id is null and workshop_id is null));
