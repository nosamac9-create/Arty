-- =============================================================================
-- 0008 — explicit café table assignment for the Live Queue
--
-- Walk-in / Without Instructor seating used to be a purely aggregate estimate
-- (total occupied seats divided by an average table size) — nothing recorded
-- which numbered table a group actually sat at, so the app could not stop
-- staff double-booking one table's seats. `table_ids` records the real,
-- staff-chosen Table Station id(s) (from `studio_resources`) a queue entry
-- holds. A Waiting/Called entry's tables are RESERVED; an In Progress entry's
-- are OCCUPIED; Completed/Cancelled entries hold nothing, so their seats free
-- up as soon as the status changes — see utils/tableSeatingUtils.ts.
--
-- Safe to re-run.
-- =============================================================================

alter table public.queue
  add column if not exists table_ids jsonb not null default '[]'::jsonb;
