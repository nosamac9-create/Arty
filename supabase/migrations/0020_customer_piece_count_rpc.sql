-- =============================================================================
-- 0020 — SCOPED PIECE-COUNT RPC FOR A CUSTOMER (Live Queue customer-detail panel)
--
-- THE BUG
-- summarizeCustomerActivity() (utils/customerIdentity.ts) computes a
-- customer's piece count by filtering the global `pieces` context value
-- client-side, matching on customer_id or normalized phone. LiveQueueSection
-- .tsx passes the live `pieces` array into it from two places (the linked-
-- customer summary and the matching-customers list). That array comes from
-- a plain table read (useLiveTable('pieces') in AppContext.tsx), subject to
-- pieces_staff_all's staff_can('pieces-admin') check (0014) — for a caller
-- without that permission (Live Queue needs only 'queue'), it is always [].
--
-- The computed count is not currently rendered anywhere in the UI (dead
-- output, not a visible bug today), but it is wrong regardless of whether
-- anything reads it, and the same global `pieces` value is available to
-- every other component via useApp() — fixing the source here rather than
-- leaving it live-broken.
--
-- THE FIX
-- A narrow SECURITY DEFINER RPC, is_staff()-gated like 0015/0018/0019 — not
-- a reuse of count_pieces_assigned_to_staff or count_pieces_in_stage (0019):
-- neither filters on a customer at all, one matches assigned_staff by exact
-- name, the other matches status. This one replicates
-- summarizeCustomerActivity's own `belongs()` matching exactly: customer_id
-- equality first, normalized phone second, with an empty phone key never
-- matching another empty key (mirrors `!!key &&` in the TypeScript).
-- =============================================================================

create or replace function public.count_pieces_for_customer(
  p_customer_id text,
  p_customer_phone text default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.pieces p
   where public.is_staff()
     and (
       (p_customer_id is not null and p.customer_id = p_customer_id)
       or (
         nullif(public.normalize_customer_phone(p_customer_phone), '') is not null
         and public.normalize_customer_phone(p.customer_phone) = public.normalize_customer_phone(p_customer_phone)
       )
     );
$$;

revoke all on function public.count_pieces_for_customer(text, text) from public, anon;
grant execute on function public.count_pieces_for_customer(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.count_pieces_for_customer(text,text)') is not null as customer_piece_count_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
