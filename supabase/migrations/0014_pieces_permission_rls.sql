-- =============================================================================
-- 0014 — ENFORCE THE 'pieces-admin' PAGE PERMISSION IN RLS (audit finding C-4, chunk 2 of 2)
--
-- STATUS: CONFIRMED LIVE IN PRODUCTION. Both policies below are active on
-- ycvwznhvitygoojjpwrl right now.
--
-- This file sat untracked and uncommitted on a single machine for some time
-- after being applied directly outside git (the SQL editor, presumably) —
-- its own header still said "NOT applied... DO NOT APPLY WITHOUT READING THE
-- CHUNK 2 REPORT" long after the policies were already live. That report was
-- never checked into this repo and could not be found anywhere — git has no
-- history for this file at all, and no doc in the repo mentions it. Rather
-- than trust a warning that had already been overtaken by events, a full
-- fallout audit was done from scratch (below) and every finding it turned up
-- was fixed and verified live before this file was committed.
--
-- FALLOUT, FOUND AND FIXED
-- The one regression this file originally named — the Dashboard's "Pottery
-- Awaiting Pickup" widget going dead for a staff member with console access
-- but no pieces-admin (e.g. Yuki) — was already closed by 0015's
-- get_overdue_pickup_pieces()/mark_piece_collected()/
-- send_piece_pickup_reminder(), confirmed live and genuinely bypassing RLS
-- (SECURITY DEFINER, owned by postgres, rolbypassrls = true; neither pieces
-- nor piece_history has FORCE ROW LEVEL SECURITY set).
--
-- Auditing every other pieces/piece_history read in the codebase turned up
-- fallout this file never mentioned, since none of it touches the Dashboard:
--
--   - AppContext.tsx's duplicate-customer consolidation effect silently
--     failed to reassign a departing duplicate's pieces for a caller without
--     pieces-admin (e.g. sara: staff+customers), then deleted the duplicate
--     anyway — pieces.customer_id is ON DELETE SET NULL, so real pieces
--     would have been silently orphaned. Fixed by 0018's
--     reassign_customer_pieces().
--
--   - deleteStaffMember()'s and deletePipelineStage()'s piece-in-use safety
--     checks (reached from Staff Management / Settings, neither the Pieces
--     page) always read zero pieces for such a caller and silently let the
--     destructive action through — confirmed live-exploitable, not
--     theoretical: sara has 'staff' permission and Yuki currently has a real
--     piece assigned to her name. Fixed by 0019's
--     count_pieces_assigned_to_staff()/count_pieces_in_stage().
--
--   - LiveQueueSection.tsx's customer-detail panel computed a wrong (usually
--     zero) piece count for the same reason — not rendered anywhere today,
--     but wrong regardless of whether it's displayed. Fixed by 0020's
--     count_pieces_for_customer().
--
-- All four fixes follow this file's own precedent: a narrow SECURITY
-- DEFINER RPC gated on is_staff() alone, not staff_can('pieces-admin') —
-- each is called from a page other than Pieces, so it must keep working
-- independent of that specific permission, the same reasoning 0015 already
-- established for the Dashboard widget.
--
-- THE GAP
-- Same shape as chunk 1: pieces_staff_all and piece_history_staff_all have
-- always gated on is_staff() alone, so any staff session with console
-- access — regardless of whether they were granted the "Pottery Pieces"
-- page — could read/write the full pieces table (including damage_note,
-- deliberately excluded from the customer-facing customer_pieces view) and
-- piece_history directly via the Supabase client or REST API. See the
-- Chunk 0 audit, finding C-4.
--
-- THE FIX
-- staff_can(page) already exists (chunk 1, 0013). This migration only adds
-- the 'pieces-admin' condition to the two pieces-related policies — the
-- verified real page id (confirmed against src/utils/adminAccess.ts's
-- AdminPageId type and ADMIN_PAGES list, not assumed).
--
-- customer_pieces / customer_piece_history (0001_init.sql) are unaffected:
-- neither view sets security_invoker, so both run with the view owner's
-- privileges against the base tables, bypassing the caller's RLS entirely
-- — confirmed by re-reading both view definitions before writing this.
-- =============================================================================

drop policy if exists pieces_staff_all on public.pieces;
create policy pieces_staff_all on public.pieces
  for all to authenticated
  using (public.is_staff() and public.staff_can('pieces-admin'))
  with check (public.is_staff() and public.staff_can('pieces-admin'));

drop policy if exists piece_history_staff_all on public.piece_history;
create policy piece_history_staff_all on public.piece_history
  for all to authenticated
  using (public.is_staff() and public.staff_can('pieces-admin'))
  with check (public.is_staff() and public.staff_can('pieces-admin'));

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regclass('public.pieces') is not null as pieces_table_exists,
  to_regclass('public.piece_history') is not null as piece_history_table_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
