-- =============================================================================
-- 0019 — SCOPED PIECES SAFETY-CHECK RPCs (staff deletion, pipeline stage deletion)
--
-- THE BUG
-- Two existing safety checks read `pieces` directly with db.pieces.toArray()/
-- .filter(), a plain table read subject to RLS:
--
--   deleteStaffMember() (AppContext.tsx) -- refuses to delete a staff member
--   still assigned pieces. Reached from AdminStaffSection.tsx ('staff'
--   permission).
--
--   deletePipelineStage() (AppContext.tsx) -- deactivates rather than
--   hard-deletes a stage still referenced by pieces (current status or
--   history). Reached from AdminSettingsSection.tsx ('settings' permission).
--
-- Neither page requires 'pieces-admin'. Under 0014's pieces_staff_all policy
-- (staff_can('pieces-admin')), a caller with 'staff' or 'settings' but not
-- 'pieces-admin' gets [] back from that read, so both checks always compute
-- zero matches and silently wave the destructive action through.
--
-- THE FIX
-- Two separate RPCs, not one shared "count pieces matching X" abstraction --
-- they do not filter on the same thing. The staff check matches
-- pieces.assigned_staff (a free-text name, no FK) against one value. The
-- stage check matches pieces.status for current pieces AND, separately,
-- piece_history.status for historical pieces -- a different table, needing
-- its own count. Forcing these through one parameterized function would
-- either need a filter-type argument (a general-purpose escape hatch this
-- project has deliberately avoided everywhere else pieces RLS was narrowed,
-- see 0015's own reasoning) or return a shape that fits neither caller
-- cleanly. Same is_staff()-only gating as 0015/0018: both checks must keep
-- working for any console-access staff member, independent of the
-- pieces-admin page permission, since neither the Staff page nor the
-- Settings page is that page.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- count_pieces_assigned_to_staff(p_staff_name) -- deleteStaffMember()'s check.
-- Mirrors `p.assignedStaff === member.name` exactly: a plain equality match
-- on the free-text name, not a staff id (pieces.assigned_staff has no FK).
-- -----------------------------------------------------------------------------
create or replace function public.count_pieces_assigned_to_staff(p_staff_name text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.pieces p
   where public.is_staff()
     and p_staff_name is not null
     and p.assigned_staff = p_staff_name;
$$;

revoke all on function public.count_pieces_assigned_to_staff(text) from public, anon;
grant execute on function public.count_pieces_assigned_to_staff(text) to authenticated;

-- -----------------------------------------------------------------------------
-- count_pieces_in_stage(p_stage_name) -- deletePipelineStage()'s check.
-- current_count mirrors `p.status === stage.name`. history_count mirrors
-- `(p.history || []).some(h => h.status === stage.name)` -- a piece counts
-- once even if it passed through the stage more than once, same as the
-- original .filter() over distinct pieces. piece_history.piece_id is
-- `references pieces(id) on delete cascade` (0001_init.sql), so every row
-- here already belongs to a currently-existing piece; no join needed to
-- reproduce "over allPieces" exactly.
-- -----------------------------------------------------------------------------
create or replace function public.count_pieces_in_stage(p_stage_name text)
returns table (current_count integer, history_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.pieces p
      where public.is_staff() and p_stage_name is not null and p.status = p_stage_name),
    (select count(distinct ph.piece_id)::integer from public.piece_history ph
      where public.is_staff() and p_stage_name is not null and ph.status = p_stage_name);
$$;

revoke all on function public.count_pieces_in_stage(text) from public, anon;
grant execute on function public.count_pieces_in_stage(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.count_pieces_assigned_to_staff(text)') is not null as staff_check_fn_exists,
  to_regprocedure('public.count_pieces_in_stage(text)') is not null as stage_check_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
