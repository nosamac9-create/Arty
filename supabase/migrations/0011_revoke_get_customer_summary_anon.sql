-- =============================================================================
-- 0011 — CLOSE ANONYMOUS PII ENUMERATION VIA get_customer_summary (audit C-2)
--
-- Run once, in the Supabase SQL editor, after 0010.
--
-- THE BUG
-- get_customer_summary(text) (0003) is SECURITY DEFINER, granted to anon and
-- authenticated, and returns a customer's name/email/phone/normalized_phone/
-- has_account for any id passed in, with no ownership check. Customer ids are
-- 'CUST-' plus 5 random digits — a ~90,000-value space — so an anonymous
-- caller could enumerate the table directly through the RPC, bypassing the
-- app entirely. See the Chunk 0 audit, finding C-2.
--
-- WHY IT'S SAFE TO JUST REVOKE THE GRANT
-- The audit traced every caller in the codebase to a single call site,
-- resolveCustomer() in AppContext.tsx, used by guest checkout, staff manual
-- piece entry, and staff walk-in queue entry. None of them read anything from
-- the function's result beyond the id — which resolve_customer_record()
-- already returns directly — so that call site has been changed to stop
-- calling get_customer_summary() and build the customer record from the id
-- plus the caller's own already-known input instead. That was the only
-- caller; nothing else in the application, staff console included, depends
-- on this function (staff read `customers` directly under RLS's
-- customers_staff_all policy and never needed it).
--
-- THE FIX
-- Revoke anon and authenticated's execute privilege. The function's body,
-- schema and SECURITY DEFINER status are untouched — it simply becomes
-- unreachable through the public API. Nothing else changes: no RLS, no other
-- function, no replacement RPC.
-- =============================================================================

revoke execute on function public.get_customer_summary(text) from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Verification — the function still exists (untouched), but a client role can
-- no longer execute it. has_privilege_string returns false once the grant is
-- gone; the function itself still resolving confirms nothing was dropped.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.get_customer_summary(text)') is not null as summary_fn_still_exists,
  has_function_privilege('anon', 'public.get_customer_summary(text)', 'EXECUTE')          as anon_can_still_execute,
  has_function_privilege('authenticated', 'public.get_customer_summary(text)', 'EXECUTE') as authenticated_can_still_execute;

-- =============================================================================
-- End of migration.
-- =============================================================================
