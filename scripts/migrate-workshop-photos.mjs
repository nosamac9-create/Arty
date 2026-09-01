/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Moves workshop photographs out of the database and into Storage.
 *
 * Every photo in this app was stored as a base64 data URL in a text column. One
 * workshop row measured 5.2MB. That inflates the file by about a third, sits in
 * the database instead of object storage, is pulled by every `select('*')` on
 * every page load, pushes rows past Realtime's 1MB record cap, and is now large
 * enough that `workshops?select=*` intermittently returns 500 — which empties
 * the table client-side and takes the console's workshop form with it.
 *
 * This uploads each data URL to the public-media bucket (migration 0021) and
 * replaces the column value with the object's URL. Nothing else changes: the
 * column stays text, and every reader already accepts either form.
 *
 * SAFETY
 *   - Dry run by default. It writes nothing without --apply.
 *   - Non-destructive: a row is only updated after its uploads have succeeded.
 *     A crash mid-run leaves valid base64 behind for the next run to find.
 *   - Re-runnable: anything already an http(s) URL is skipped, so a second run
 *     has nothing to do.
 *   - One row at a time, so a failure is isolated to that workshop.
 *
 * It also reports objects in the bucket that no row references — orphans left
 * by uploads whose workshop was never saved. It never deletes them without
 * --prune-orphans, and never counts them as work to do.
 *
 * Reads everything from the shell environment; nothing is committed:
 *
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   node scripts/migrate-workshop-photos.mjs            # dry run, writes nothing
 *   node scripts/migrate-workshop-photos.mjs --apply    # performs the migration
 *   node scripts/migrate-workshop-photos.mjs --prune-orphans --apply
 *
 * The service_role key bypasses Row Level Security. Use it only here, only from
 * your own machine, and never put it in .env or any frontend file.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Same optional local env file the super-admin script reads.
const ADMIN_ENV_FILE = new URL('../.env.admin.local', import.meta.url).pathname;
if (existsSync(ADMIN_ENV_FILE)) {
  for (const line of readFileSync(ADMIN_ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
  console.log('Read settings from .env.admin.local\n');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const PRUNE_ORPHANS = process.argv.includes('--prune-orphans');
const BUCKET = 'public-media';
const FOLDER = 'workshops';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const isDataUrl = v => typeof v === 'string' && v.startsWith('data:');
const isHttpUrl = v => typeof v === 'string' && /^https?:\/\//i.test(v);

const bytes = n =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB`
  : n >= 1024 ? `${(n / 1024).toFixed(1)} KB`
  : `${n} B`;

/** Decodes a data URL into a Buffer plus its content type and extension. */
function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;

  const contentType = match[1] || 'image/jpeg';
  const isBase64 = !!match[2];
  const payload = match[3];

  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  const subtype = contentType.split('/')[1] || 'jpg';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype.replace(/[^a-z0-9]/gi, '') || 'jpg';

  return { buffer, contentType, extension };
}

/** Uploads one decoded image and returns its public URL. */
async function uploadOne(decoded) {
  const path = `${FOLDER}/${randomUUID()}.${decoded.extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, decoded.buffer, {
    contentType: decoded.contentType,
    upsert: false
  });
  if (error) throw new Error(`upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('upload succeeded but no public URL was returned');
  return { url: data.publicUrl, path };
}

/** Every object currently in the bucket's workshops folder. */
async function listBucketObjects() {
  const objects = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(FOLDER, { limit: pageSize, offset });
    if (error) {
      console.error(`Could not list ${BUCKET}/${FOLDER}: ${error.message}`);
      return objects;
    }
    if (!data || data.length === 0) break;
    objects.push(...data.map(o => ({
      name: `${FOLDER}/${o.name}`,
      size: o.metadata?.size ?? 0,
      createdAt: o.created_at
    })));
    if (data.length < pageSize) break;
  }
  return objects;
}

async function main() {
  console.log(APPLY ? '=== MIGRATING (writing) ===\n' : '=== DRY RUN — nothing will be written ===\n');

  const { data: workshops, error } = await supabase
    .from('workshops')
    .select('id, title, status, image, additional_images')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Could not read workshops:', error.message);
    process.exit(1);
  }

  // ---- Plan ----------------------------------------------------------------
  const plan = [];
  let totalObjects = 0;
  let totalBytes = 0;
  let alreadyMigrated = 0;
  let emptyFields = 0;

  for (const ws of workshops || []) {
    const items = [];

    if (isDataUrl(ws.image)) {
      items.push({ field: 'image', index: null, value: ws.image });
    } else if (isHttpUrl(ws.image)) {
      alreadyMigrated++;
    } else if (!ws.image) {
      emptyFields++;
    }

    (ws.additional_images || []).forEach((img, i) => {
      if (isDataUrl(img)) items.push({ field: 'additional_images', index: i, value: img });
      else if (isHttpUrl(img)) alreadyMigrated++;
      else if (!img) emptyFields++;
    });

    if (items.length === 0) continue;

    const rowBytes = items.reduce((sum, it) => {
      const decoded = decodeDataUrl(it.value);
      return sum + (decoded ? decoded.buffer.byteLength : 0);
    }, 0);

    totalObjects += items.length;
    totalBytes += rowBytes;
    plan.push({ ws, items, rowBytes });
  }

  console.log(`Workshops examined:        ${(workshops || []).length}`);
  console.log(`Rows needing migration:    ${plan.length}`);
  console.log(`Photos to upload:          ${totalObjects}`);
  console.log(`Bytes to move out of the DB: ${bytes(totalBytes)}`);
  console.log(`Fields already migrated:   ${alreadyMigrated} (skipped)`);
  console.log(`Empty fields:              ${emptyFields} (left as-is)\n`);

  if (plan.length > 0) {
    console.log('Per row:');
    for (const { ws, items, rowBytes } of plan) {
      const cover = items.some(i => i.field === 'image') ? 'cover' : '';
      const extra = items.filter(i => i.field === 'additional_images').length;
      const parts = [cover, extra ? `${extra} additional` : ''].filter(Boolean).join(' + ');
      console.log(`  ${(ws.title || ws.id).padEnd(34)} ${String(ws.status || '').padEnd(10)} ${String(items.length).padStart(2)} photo(s)  ${bytes(rowBytes).padStart(9)}  (${parts})`);
    }
    console.log('');
  }

  // ---- Orphans -------------------------------------------------------------
  // Anything in the bucket that no row points at. Uploads whose workshop was
  // never saved leave these behind; they are reported separately and are never
  // part of the migration count.
  const objects = await listBucketObjects();
  const referenced = new Set();
  for (const ws of workshops || []) {
    for (const value of [ws.image, ...(ws.additional_images || [])]) {
      if (!isHttpUrl(value)) continue;
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      const at = value.indexOf(marker);
      if (at !== -1) referenced.add(decodeURIComponent(value.slice(at + marker.length).split('?')[0]));
    }
  }

  const orphans = objects.filter(o => !referenced.has(o.name));
  const orphanBytes = orphans.reduce((sum, o) => sum + (o.size || 0), 0);

  console.log(`Objects in ${BUCKET}/${FOLDER}: ${objects.length}`);
  console.log(`Referenced by a workshop:   ${objects.length - orphans.length}`);
  console.log(`Orphaned (nothing links):   ${orphans.length}  ${bytes(orphanBytes)}`);
  if (orphans.length > 0) {
    for (const o of orphans.slice(0, 20)) {
      console.log(`  ${o.name}  ${bytes(o.size || 0).padStart(9)}  ${o.createdAt || ''}`);
    }
    if (orphans.length > 20) console.log(`  … and ${orphans.length - 20} more`);
    console.log(
      PRUNE_ORPHANS
        ? '\n  --prune-orphans given: these will be deleted.'
        : '\n  Re-run with --prune-orphans (and --apply) to delete them.'
    );
  }
  console.log('');

  if (!APPLY) {
    console.log('Dry run complete. Nothing was written.');
    console.log('Re-run with --apply to perform the migration.');
    return;
  }

  // ---- Migrate -------------------------------------------------------------
  let rowsUpdated = 0;
  let uploaded = 0;
  const failures = [];

  for (const { ws, items } of plan) {
    try {
      // Upload everything for this row first. The row is only written once all
      // of its photos are safely in Storage, so a partial failure leaves the
      // original base64 untouched.
      const uploads = [];
      for (const item of items) {
        const decoded = decodeDataUrl(item.value);
        if (!decoded) throw new Error(`${item.field}[${item.index ?? 0}] is not a readable data URL`);
        const result = await uploadOne(decoded);
        uploads.push({ ...item, ...result });
        uploaded++;
      }

      const updates = {};
      const coverUpload = uploads.find(u => u.field === 'image');
      if (coverUpload) updates.image = coverUpload.url;

      const extraUploads = uploads.filter(u => u.field === 'additional_images');
      if (extraUploads.length > 0) {
        const next = [...(ws.additional_images || [])];
        for (const u of extraUploads) next[u.index] = u.url;
        updates.additional_images = next;
      }

      const { error: updateError } = await supabase
        .from('workshops')
        .update(updates)
        .eq('id', ws.id);

      if (updateError) {
        // The uploads succeeded but the row did not change: those objects are
        // now orphans. Named here so they can be pruned rather than lingering.
        throw new Error(
          `row update failed (${updateError.message}). Orphaned objects: ${uploads.map(u => u.path).join(', ')}`
        );
      }

      rowsUpdated++;
      console.log(`  migrated  ${ws.title || ws.id}  (${uploads.length} photo(s))`);
    } catch (err) {
      failures.push({ id: ws.id, title: ws.title, error: err.message });
      console.error(`  FAILED    ${ws.title || ws.id}: ${err.message}`);
    }
  }

  // ---- Prune ---------------------------------------------------------------
  let pruned = 0;
  if (PRUNE_ORPHANS && orphans.length > 0) {
    // Re-listed after migrating: the set computed earlier predates this run's
    // uploads, which are now legitimately referenced.
    const afterObjects = await listBucketObjects();
    const { data: afterRows } = await supabase.from('workshops').select('image, additional_images');
    const stillReferenced = new Set();
    for (const row of afterRows || []) {
      for (const value of [row.image, ...(row.additional_images || [])]) {
        if (!isHttpUrl(value)) continue;
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const at = value.indexOf(marker);
        if (at !== -1) stillReferenced.add(decodeURIComponent(value.slice(at + marker.length).split('?')[0]));
      }
    }
    const toDelete = afterObjects.filter(o => !stillReferenced.has(o.name)).map(o => o.name);
    if (toDelete.length > 0) {
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(toDelete);
      if (removeError) console.error(`  Orphan cleanup failed: ${removeError.message}`);
      else pruned = toDelete.length;
    }
  }

  console.log('\n=== RESULT ===');
  console.log(`Rows updated:   ${rowsUpdated} / ${plan.length}`);
  console.log(`Photos uploaded: ${uploaded}`);
  if (pruned) console.log(`Orphans deleted: ${pruned}`);
  if (failures.length > 0) {
    console.log(`\nFailed rows (their base64 is untouched — re-run to retry):`);
    for (const f of failures) console.log(`  ${f.title || f.id}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Migration aborted:', err.message);
  process.exit(1);
});
