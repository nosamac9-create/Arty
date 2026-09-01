-- =============================================================================
-- 0018 — SCOPED PIECE-REASSIGNMENT RPC FOR CUSTOMER CONSOLIDATION
--
-- THE BUG
-- AppContext.tsx's duplicate-customer consolidation effect (runs on mount for
-- any staff session that can see more than one `customers` row) reassigns a
-- duplicate customer's bookings/queue/pieces to the canonical record, then
-- deletes the duplicate. The pieces step read `db.pieces.toArray()` directly
-- — a plain table read subject to RLS. Since 0014 gated pieces_staff_all on
-- staff_can('pieces-admin'), a caller without that permission (e.g. a staff
-- session with only `customers`) gets `[]` back, so no piece is reassigned —
-- but the code deletes the duplicate customer anyway. pieces.customer_id is
-- `references customers(id) on delete set null` (0001_init.sql), so Postgres
-- silently NULLs out customer_id on every piece that belonged to the
-- duplicate. No error, no log, no undo: the piece is permanently severed
-- from its customer.
--
-- THE FIX
-- Same shape as get_overdue_pickup_pieces / mark_piece_collected (0015):
-- a narrow SECURITY DEFINER function, gated on is_staff() alone rather than
-- staff_can('pieces-admin') — this reassignment must succeed no matter which
-- console-access staff member happens to trigger the consolidation, since it
-- runs unattended in the background, not from a page a permission could
-- reasonably gate. It does exactly one thing: move every piece from one
-- customer id to another. No caller-supplied status, field or filter beyond
-- the two ids, so it cannot be used as a general pieces write.
--
-- Done as a single UPDATE ... WHERE customer_id = old, entirely server-side,
-- rather than the previous read-all/filter/map-update-per-row from the
-- client — removes the RLS-blocked read this bug depended on, and is one
-- statement instead of N.
-- =============================================================================

create or replace function public.reassign_customer_pieces(
  p_old_customer_id text,
  p_new_customer_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if not public.is_staff() then
    return 0;
  end if;

  if p_old_customer_id is null or p_new_customer_id is null or p_old_customer_id = p_new_customer_id then
    return 0;
  end if;

  update public.pieces
     set customer_id = p_new_customer_id
   where customer_id = p_old_customer_id;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.reassign_customer_pieces(text, text) from public, anon;
grant execute on function public.reassign_customer_pieces(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.reassign_customer_pieces(text,text)') is not null as reassign_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
