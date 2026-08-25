-- =============================================================================
-- 0013 — ENFORCE THE 'customers' PAGE PERMISSION IN RLS (audit finding C-4, Chunk 1)
--
-- Run in the Supabase SQL editor, after 0012. NOT applied by this chunk.
--
-- THE GAP
-- staff.permissions (the per-page grants the Admin Console UI checks via
-- canAccessPage()/canAccessAdminPage()) has never been enforced anywhere
-- below the UI. Every RLS policy on customers has gated on is_staff() alone
-- — any staff session with console access, regardless of which pages they
-- were actually granted, could read/write the full customers table (every
-- customer's PII, notes, total_spent) directly via the Supabase client or
-- REST API, bypassing the "Customers" page permission entirely. See the
-- Chunk 0 audit, finding C-4.
--
-- THE FIX (Chunk 1 of 2 — pieces/piece_history follow in Chunk 2)
-- A new helper, staff_can(page), mirrors is_staff()'s exact shape (same
-- user_id/has_console_access/status conditions) and additionally requires
-- either Super Admin (unconditional pass, matching isSuperAdmin()'s
-- frontend short-circuit) or the specific page id being present in
-- staff.permissions. customers_staff_all is replaced with a version that
-- also requires staff_can('customers') — the caller must both be
-- recognized staff AND have been granted the Customers page.
--
-- staff_can(page) implies is_staff() on its own (is_staff()'s conditions
-- are a strict subset of staff_can()'s), so the "is_staff() and
-- staff_can('customers')" pairing below is logically redundant — kept
-- anyway because it was the explicit, deliberate design for this policy:
-- a reviewer sees the full requirement without having to trace into
-- staff_can()'s body to notice it already implies is_staff().
--
-- SCOPE — Chunk 1 only touches the customers table. bookings, queue,
-- staff, notifications, and the public catalogue tables are deliberately
-- left on blanket is_staff() for now (see the Chunk 0 C-4 design report
-- for why: those tables mostly denormalize customer name/phone/email onto
-- their own rows regardless, so gating them individually needs its own,
-- separate design pass rather than a mechanical copy of this one).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- staff_can(page) — is this caller staff, AND specifically granted this page?
-- -----------------------------------------------------------------------------
create or replace function public.staff_can(page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.has_console_access = true
      and s.status not in ('Inactive','Former Staff')
      and (s.role = 'Super Admin' or page = any(s.permissions))
  );
$$;

revoke all on function public.staff_can(text) from public, anon;
grant execute on function public.staff_can(text) to authenticated;

-- -----------------------------------------------------------------------------
-- customers_staff_all — same operations (SELECT/INSERT/UPDATE/DELETE, via
-- `for all`), same using/with check shape, now also requiring the
-- 'customers' page permission.
-- -----------------------------------------------------------------------------
drop policy if exists customers_staff_all on public.customers;
create policy customers_staff_all on public.customers
  for all to authenticated
  using (public.is_staff() and public.staff_can('customers'))
  with check (public.is_staff() and public.staff_can('customers'));

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.staff_can(text)') is not null as staff_can_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
