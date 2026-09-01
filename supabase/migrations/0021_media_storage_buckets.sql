-- =============================================================================
-- 0021 — STORAGE BUCKETS FOR PHOTOGRAPHS (Phase 0 of the base64 → Storage move)
--
-- WHY
-- Every photograph in this app is stored as a base64 data URL in a text column.
-- A single workshop row was measured at 5.2MB. That inflates bytes by about a
-- third over the original file, sits in the database rather than object
-- storage, is pulled by every `select('*')` on every page load for every
-- visitor, and pushes rows past Realtime's 1MB record cap — which is what made
-- workshop photos and long text vanish from the edit form (fixed defensively in
-- supabaseData.ts, but the size is the root cause).
--
-- This migration only creates the buckets and their policies. No application
-- code depends on it yet, and nothing breaks if it is applied and then left:
-- rows keep their base64 until the upload path and backfill land.
--
-- TWO BUCKETS, NOT ONE
-- The four places that upload photographs do not share a trust profile:
--
--   public-media      workshop, birthday package and piece photographs.
--                     Already shown publicly on the customer site, so public
--                     read costs nothing and avoids signed-URL plumbing on
--                     every read. Written by staff only.
--
--   customer-uploads  birthday cake reference photographs, submitted by
--                     customers. Not public: it is user-submitted content tied
--                     to one booking, and there is no reason for it to be
--                     readable by anyone holding the URL.
--
-- The customer-uploads bucket is created here but has NO write path yet. The
-- birthday form can be reached by a signed-out guest, so granting `anon` INSERT
-- would be an open, unauthenticated upload endpoint — a way to fill a storage
-- quota that is already over its free tier. That decision is deferred with the
-- rest of the cake-photo work; the bucket exists so the policy shape can be
-- reviewed now rather than invented later under time pressure.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Buckets
--
-- The file size limit is enforced by Storage itself, not only by the form, so
-- a client that skips the check cannot upload something larger. It matches the
-- 5MB the upload UI already advertises.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media', 'public-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-uploads', 'customer-uploads', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- public-media policies
--
-- Reads are open, matching the bucket: these photographs are already on the
-- public site. Writes reuse is_staff() — the same helper every table policy in
-- this schema trusts — so storage authorization cannot drift from table
-- authorization.
-- ---------------------------------------------------------------------------
drop policy if exists public_media_read on storage.objects;
create policy public_media_read on storage.objects
  for select to public
  using (bucket_id = 'public-media');

drop policy if exists public_media_staff_insert on storage.objects;
create policy public_media_staff_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and public.is_staff());

drop policy if exists public_media_staff_update on storage.objects;
create policy public_media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and public.is_staff())
  with check (bucket_id = 'public-media' and public.is_staff());

-- Deleting the object when its photograph is removed is what stops the bucket
-- filling with files nothing references.
drop policy if exists public_media_staff_delete on storage.objects;
create policy public_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and public.is_staff());

-- ---------------------------------------------------------------------------
-- customer-uploads policies
--
-- Staff-only for now, in every direction. There is deliberately no INSERT
-- policy for customers or anon yet: adding one is the open-upload decision
-- described above, and it belongs with the cake-photo work, not here. Until
-- then this bucket simply stays empty.
-- ---------------------------------------------------------------------------
drop policy if exists customer_uploads_staff_read on storage.objects;
create policy customer_uploads_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'customer-uploads' and public.is_staff());

drop policy if exists customer_uploads_staff_write on storage.objects;
create policy customer_uploads_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'customer-uploads' and public.is_staff())
  with check (bucket_id = 'customer-uploads' and public.is_staff());
