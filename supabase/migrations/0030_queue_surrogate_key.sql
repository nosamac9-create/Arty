-- =============================================================================
-- Queue ids: surrogate key, separate display number.
--
-- THE BUG THIS CLOSES
-- next_queue_id() numbered queue rows per DAY (`where q.date = p_date`), so ids
-- restarted at Q-001 every morning. queue.id is the primary key, so today's
-- Q-003 was the same key as last week's Q-003.
--
-- db.queue.put() writes with PostgREST upsert (`on conflict (id) do update`),
-- which updates only the columns present in the payload and leaves the rest at
-- their previous values. A walk-in check-in supplies no booking_id, so the
-- column was absent, so the OLD row's booking_id survived onto the new visit.
--
-- The result: a queue row claiming one session while pointing at a booking on
-- another. session_seats_taken excludes such a row as "already counted through
-- its booking", and the booking it defers to counts toward a different session,
-- so the seat is counted nowhere. That is how an instructor-led walk-in came to
-- consume no seat — session_seats_taken was correct throughout.
--
-- Worse than the counting: the earlier visit's name, phone, participants,
-- session and history were overwritten in place. Those check-ins are gone, not
-- mislabelled. Three such rows existed when this was written.
--
-- THE FIX
-- The two requirements were conflated in one column. Staff want a short number
-- that resets daily; the database needs one that never repeats. They are now
-- separate: `id` is a uuid, `queue_number` is the daily sequence, and a unique
-- index on (date, queue_number) makes the display number a guarantee rather than
-- a hope — two simultaneous check-ins now fail and retry instead of both
-- believing they are No. 4.
--
-- Formatting to "Q-003" moves to the UI. Storing the prefix would re-encode
-- display logic as data, which is what made the key look safe to reuse.
--
-- BEFORE APPLYING, run the detector — not because step 1 uses it, but to see
-- whether anything BEYOND the three known rows shares the corruption signature.
-- If it returns rows other than Q-001/Q-002/Q-003, stop and widen the delete
-- deliberately rather than letting this migration guess:
--
--   select id, date, created_at, name, booking_id, session_id
--     from public.queue
--    where date <> ((created_at at time zone 'Asia/Riyadh')::date);
--
--   -- and what points at the three, since the FKs are ON DELETE SET NULL and
--   -- will sever a return/extend chain silently rather than fail:
--   select id, returned_from_queue_id, extended_by_queue_id from public.queue
--    where returned_from_queue_id in ('Q-001','Q-002','Q-003')
--       or extended_by_queue_id  in ('Q-001','Q-002','Q-003');
--
-- REALTIME, DURING AND AFTER
-- Step 5 rewrites every id, which emits one UPDATE per row to realtime
-- subscribers with the id changing underneath them. A staff console left open
-- across the migration will likely end up holding both the old and the new row
-- in its local cache. Harmless and self-correcting, but tell staff to reload the
-- console afterwards rather than letting them wonder at doubled entries.
--
-- Run after 0029_booking_rpc_defaults_and_session_guard.sql.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the rows the collision corrupted.
--
-- Named explicitly rather than matched by signature. The obvious predicate —
-- `date <> created_at::date` — is a good DETECTOR but a bad delete: a row that
-- was legitimately rescheduled or extended would match it too, and this is
-- irreversible. The three affected rows were identified individually against the
-- database; only those are removed.
--
-- Their original values are unrecoverable in any case. The upsert replaced name,
-- phone, participants, session, status and date in place, and took the history
-- jsonb with them, so there is nothing to repair them from.
-- ---------------------------------------------------------------------------
delete from public.queue where id in ('Q-001', 'Q-002', 'Q-003');

-- ---------------------------------------------------------------------------
-- 2. New columns.
-- ---------------------------------------------------------------------------
alter table public.queue add column if not exists queue_number integer;
alter table public.queue add column if not exists new_id text;

update public.queue
   set queue_number = nullif(regexp_replace(id, '\D', '', 'g'), '')::integer,
       new_id       = gen_random_uuid()::text;

-- ---------------------------------------------------------------------------
-- 3. Drop the two self-references before the key values move. They are not
--    deferrable, so they cannot survive the swap in place.
-- ---------------------------------------------------------------------------
alter table public.queue drop constraint if exists queue_returned_from_queue_id_fkey;
alter table public.queue drop constraint if exists queue_extended_by_queue_id_fkey;

-- ---------------------------------------------------------------------------
-- 4. Repoint them at the new ids, while the old ids still exist to join on.
-- ---------------------------------------------------------------------------
update public.queue q
   set returned_from_queue_id = m.new_id
  from public.queue m
 where q.returned_from_queue_id = m.id;

update public.queue q
   set extended_by_queue_id = m.new_id
  from public.queue m
 where q.extended_by_queue_id = m.id;

-- ---------------------------------------------------------------------------
-- 5. Swap the key.
--
-- REPLICA IDENTITY FIRST. `queue` is in the supabase_realtime publication, and
-- a published table's default replica identity IS its primary key. Dropping the
-- key therefore leaves the table with no replica identity, and Postgres refuses
-- any further UPDATE or DELETE on a table that publishes them:
--
--   ERROR 55000: cannot update table "queue" because it does not have a replica
--   identity and publishes updates
--
-- The earlier UPDATEs in steps 2 and 4 are fine — the key still exists then.
-- Only the id swap below is affected.
--
-- FULL for the duration, rather than dropping the table from the publication and
-- re-adding it. `alter publication` needs ownership of supabase_realtime, which
-- 0002 records the SQL editor's role NOT having on this project — it wraps every
-- add in an exception handler for exactly that reason. If the drop succeeded and
-- the re-add silently failed, `queue` would simply stop publishing and the Live
-- Queue would go stale with no error anywhere. REPLICA IDENTITY is a table-level
-- property needing only table ownership, which this migration plainly has.
--
-- The previous setting is captured and restored, in case it was already FULL.
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config(
    'arty.queue_replident',
    (select relreplident::text from pg_class where oid = 'public.queue'::regclass),
    true  -- transaction-local; gone when this commits or rolls back
  );
end $$;

alter table public.queue replica identity full;

alter table public.queue drop constraint queue_pkey;
update public.queue set id = new_id;
alter table public.queue add constraint queue_pkey primary key (id);
alter table public.queue drop column new_id;

-- ---------------------------------------------------------------------------
-- 6. Restore the self-references.
-- ---------------------------------------------------------------------------
alter table public.queue
  add constraint queue_returned_from_queue_id_fkey
  foreign key (returned_from_queue_id) references public.queue(id) on delete set null;

alter table public.queue
  add constraint queue_extended_by_queue_id_fkey
  foreign key (extended_by_queue_id) references public.queue(id) on delete set null;

-- Restore the replica identity now that a primary key exists again. DEFAULT
-- means "use the primary key", which is the normal Supabase setting and keeps
-- WAL small; FULL would write the whole old row on every future update forever.
do $$
begin
  if current_setting('arty.queue_replident', true) = 'f' then
    alter table public.queue replica identity full;   -- it was already FULL
  else
    alter table public.queue replica identity default;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. The display number becomes a guarantee.
--
-- Partial, because a row that predates this migration and whose id held no
-- digits parses to null. Those keep a null number and simply do not participate.
-- ---------------------------------------------------------------------------
create unique index if not exists queue_date_number_key
  on public.queue (date, queue_number)
  where queue_number is not null;

-- ---------------------------------------------------------------------------
-- 8. The generator now produces a display number, not a key.
--
-- Still scoped to the date — which is now CORRECT, because resetting daily is
-- the point of a display number. It was only ever wrong as a primary key.
--
-- This is advisory: two callers can still read the same number concurrently.
-- The unique index above is what actually decides, and the client retries on
-- violation. Do not add a lock here — the number is cheap to re-derive, and a
-- lock would serialise every check-in in the studio.
-- ---------------------------------------------------------------------------
create or replace function public.next_queue_number(p_date date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(q.queue_number), 0) + 1
    from public.queue q
   where q.date = p_date;
$$;

revoke all on function public.next_queue_number(date) from public, anon;
grant execute on function public.next_queue_number(date) to authenticated;

drop function if exists public.next_queue_id(date);

commit;
