-- =============================================================================
-- 0012 — UNIQUE STAFF WORK EMAIL (audit finding C-3, Chunk 1)
--
-- Run in the Supabase SQL editor, after 0011. NOT applied by this chunk.
--
-- WHY
-- checkDuplicateStaffEmail() (src/utils/validation.ts) already refuses a
-- second staff row with the same email at the application layer, but nothing
-- enforces it in the database — a direct insert (or a race between two
-- concurrent admin actions) could still create two staff rows sharing one
-- Work Email, which is exactly the ambiguous state provision-staff's Case F
-- refuses to provision. This closes that at the data layer, the same way
-- customers_normalized_phone_key (0001_init.sql) already does for customer
-- phone numbers.
--
-- staff.user_id already has its own uniqueness (`user_id uuid unique
-- references auth.users(id)`, declared directly on the column in
-- 0001_init.sql) — nothing to add there.
--
-- SAFETY
-- Partial index: only rows with a non-blank email participate, so any
-- legacy staff row with no email on file is unaffected and multiple such
-- rows can coexist, mirroring customers_normalized_phone_key's own partial
-- condition exactly.
--
-- PRECONDITION — VERIFY BEFORE RUNNING
-- The live inventory checked ahead of this migration reported zero duplicate
-- staff emails. If that has changed since, this CREATE UNIQUE INDEX will
-- fail outright (Postgres refuses to create a unique index over existing
-- duplicates) rather than silently succeeding over bad data — so it is safe
-- to attempt, but confirm no duplicates exist immediately before running it:
--
--   select lower(btrim(email)) as email, count(*)
--     from public.staff
--    where coalesce(btrim(email), '') <> ''
--    group by 1
--   having count(*) > 1;
--
-- (should return zero rows before this migration is run.)
-- =============================================================================

create unique index if not exists staff_email_key
  on public.staff (lower(email))
  where email is not null and btrim(email) <> '';

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regclass('public.staff_email_key') is not null as staff_email_key_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
