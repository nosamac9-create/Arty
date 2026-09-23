-- Purpose: add preferred_lang column to customers for SMS/UI language
--
-- =============================================================================
-- 0034 — preferred_lang ON customers
--
-- CONTEXT
-- The customer site has an EN/AR language toggle (LanguageContext.tsx) that
-- currently only sets <html dir>/localStorage on the device it was set from.
-- This column gives that preference a home on the customer's own record, so
-- it can travel with them (e.g. so a staff-triggered SMS — AppContext.tsx's
-- send-sms calls — can be composed in the language the customer picked,
-- rather than only ever English). Nothing yet reads or writes this column;
-- this migration only adds it.
--
-- WHY text + check, not a native enum
-- 0001_init.sql already establishes the convention this schema uses for a
-- small closed set of values: plain `text` with a `check (col in (...))`
-- constraint (see pieces_status_valid, workshop_sessions status, studio_
-- resources.type/status, app_settings.type). The one native `enum` in the
-- schema (staff_role) is reused across multiple tables/columns, which is
-- the case where an enum type earns its keep. A language code belongs to
-- one column on one table and may plausibly grow a third value later
-- (transliterated Latin-Arabic? a third market language?) — a check
-- constraint is a single-statement `alter table ... drop constraint /
-- add constraint` to change, where a native enum's added values can't be
-- removed at all and `ALTER TYPE ... ADD VALUE` can't run inside the same
-- transaction as other DDL. Matching the table's own established pattern
-- and staying easy to revise later both point the same way.
--
-- NULLABLE + DEFAULT — no backfill statement needed here. Postgres adds a
-- column with a DEFAULT as a metadata-only change (fast default, PG 11+):
-- every existing row reads as 'en' immediately, with no table rewrite and
-- no separate UPDATE. The column stays nullable rather than NOT NULL only
-- because that was the instruction — the default already guarantees no row
-- is left NULL from this migration itself.
--
-- RLS — NOT TOUCHED, DELIBERATELY. See the report accompanying this file:
-- customers_self_update (0001_init.sql:600-604) is `for update ... using
-- (user_id = auth.uid()) with check (user_id = auth.uid())` — a row-level
-- predicate with no column list and no column-restricting trigger anywhere
-- in this schema (the only such trigger, staff_privilege_guard, is on
-- public.staff, not public.customers). A signed-in customer updating their
-- own row already covers every column on that row, this one included. No
-- new policy is added or needed.
-- =============================================================================

alter table public.customers
  add column if not exists preferred_lang text default 'en';

alter table public.customers
  drop constraint if exists customers_preferred_lang_valid;

alter table public.customers
  add constraint customers_preferred_lang_valid
  check (preferred_lang in ('en', 'ar'));

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'customers'
      and column_name = 'preferred_lang'
  ) as preferred_lang_column_exists,
  exists (
    select 1 from pg_constraint
    where conname = 'customers_preferred_lang_valid'
  ) as check_constraint_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
