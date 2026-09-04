-- Stops a workshop from ever holding two live sessions in the same slot.
--
-- WHY
-- The "generate sessions for a month" button in the console dedupes against the
-- sessions it is handed, and the form was handing it an empty list. Every
-- re-run therefore inserted a complete second copy of the month. Production
-- reached four copies of eight slots on one workshop. Customers saw the same
-- class listed several times, and because the copies were snapshotted at
-- different moments they carried different capacities — one of them showing
-- full while an identical row beside it had seats.
--
-- The form is fixed. This is the guarantee that does not depend on the form:
-- any future caller, script or manual insert that tries the same thing gets a
-- unique-violation instead of a duplicate.
--
-- SHAPE OF THE KEY
-- start_time is free text ('10:00 AM'), so a raw three-column index would still
-- admit '10:00 am' as a distinct slot. The key is normalised with
-- upper(btrim(...)) — exactly the comparison the generator itself uses when it
-- decides whether a slot is already taken — so the database and the generator
-- agree on what "the same session" means.
--
-- WHY PARTIAL
-- Cancelled sessions are kept as history, and a slot must be re-openable after
-- a cancellation. Only live rows are constrained.
--
-- ORDER OF OPERATIONS
-- This CANNOT be applied while duplicates exist. Run
--   npm run dedupe-workshop-sessions          (dry run — read the plan)
--   npm run dedupe-workshop-sessions -- --apply
-- first, and only then apply this migration. If it fails with a
-- unique-violation, that means new duplicates appeared: re-run the script.

create unique index if not exists workshop_sessions_live_slot_key
  on public.workshop_sessions (workshop_id, date, upper(btrim(start_time)))
  where status <> 'Cancelled';
