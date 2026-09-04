/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Removes duplicate workshop sessions, and corrects the capacity of the ones
 * that are kept.
 *
 * WHY THEY EXIST
 * The console's "generate sessions for this month" button dedupes against the
 * sessions it is given, and the form was giving it an empty list. Every re-run
 * inserted a full second copy of the month. Each copy also snapshotted whatever
 * number happened to be in the capacity field at that moment, so the copies
 * disagree — some of them read as full when the workshop has seats.
 *
 * WHAT IT DOES
 *   1. Groups every live (status <> 'Cancelled') session by
 *      workshop + date + normalised start time. Groups of one are ignored.
 *   2. Counts the bookings and queue rows attached to each copy.
 *   3. REFUSES TO RUN if any group has attached rows on more than one copy.
 *      That is not true of the data today, but if it ever becomes true, keeping
 *      one copy would strand the customers on the others. That case needs a
 *      person, not a script.
 *   4. Picks one survivor per group:
 *        a. the copy holding bookings, if any copy does;
 *        b. otherwise the copy holding queue rows;
 *        c. otherwise the copy whose capacity matches the parent workshop's;
 *        d. otherwise the oldest by created_at (ties broken by id, so the
 *           choice is stable across runs).
 *   5. Corrects the survivor's capacity to the parent workshop's capacity where
 *      the two differ, and reports every correction.
 *   6. Deletes the non-survivors.
 *
 * Why capacity comes from the workshop and not from the copies: the copies are
 * snapshots of a form field taken mid-edit, so the highest, lowest or most
 * common value among them is no more trustworthy than any other. The workshop
 * row is the thing staff actually maintain.
 *
 * SAFETY
 *   - Dry run by default. It writes nothing without --apply.
 *   - The full plan is printed either way, before any write happens.
 *   - Ordering is non-destructive: capacity is corrected on the survivor BEFORE
 *     the non-survivors are deleted, so a crash between the two leaves the
 *     duplicates in place rather than a corrected-but-unverified lone row.
 *   - Deletes only ids it has confirmed carry no bookings and no queue rows.
 *   - Re-runnable: a second run finds no groups and does nothing.
 *
 * THIS DELETES ROWS. Read the dry-run plan before passing --apply.
 *
 * Run it, then apply migration 0022 (the unique index cannot be created while
 * duplicates exist):
 *
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   node scripts/dedupe-workshop-sessions.mjs            # dry run, writes nothing
 *   node scripts/dedupe-workshop-sessions.mjs --apply    # performs the cleanup
 *
 * The service_role key bypasses Row Level Security. Use it only here, only from
 * your own machine, and never put it in .env or any frontend file.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// Same optional local env file the other admin scripts read.
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
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing credentials.\n\n' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell (or in\n' +
    '.env.admin.local, which is gitignored) and run again.'
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/** The same comparison the session generator uses to decide "same slot". */
const slotKey = (s) => `${s.workshop_id}|${s.date}|${String(s.start_time || '').trim().toUpperCase()}`;

/** Reads a whole table in pages; PostgREST caps a single response at 1000 rows. */
async function readAll(table, columns) {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function main() {
  console.log(APPLY
    ? '=== APPLYING — this run deletes rows ===\n'
    : '=== DRY RUN — nothing will be written. Re-run with --apply to perform it. ===\n');

  const [sessions, workshops, bookings, queue] = await Promise.all([
    readAll('workshop_sessions', 'id,workshop_id,date,start_time,capacity,status,created_at'),
    readAll('workshops', 'id,title,capacity'),
    readAll('bookings', 'id,session_id'),
    readAll('queue', 'id,session_id')
  ]);

  const workshopById = new Map(workshops.map(w => [w.id, w]));

  // Attached-row counts, per session id.
  const bookingCount = new Map();
  for (const b of bookings) {
    if (b.session_id) bookingCount.set(b.session_id, (bookingCount.get(b.session_id) || 0) + 1);
  }
  const queueCount = new Map();
  for (const q of queue) {
    if (q.session_id) queueCount.set(q.session_id, (queueCount.get(q.session_id) || 0) + 1);
  }

  // Group the live sessions by slot.
  const groups = new Map();
  for (const s of sessions) {
    if (s.status === 'Cancelled') continue;
    const key = slotKey(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const duplicateGroups = [...groups.values()].filter(g => g.length > 1);

  console.log(`Sessions read:      ${sessions.length} (${sessions.filter(s => s.status === 'Cancelled').length} cancelled, not considered)`);
  console.log(`Duplicate groups:   ${duplicateGroups.length}`);
  console.log(`Rows in them:       ${duplicateGroups.reduce((n, g) => n + g.length, 0)}\n`);

  if (duplicateGroups.length === 0) {
    console.log('Nothing to do. Migration 0022 can be applied.');
    return;
  }

  // ── The refusal check, before any plan is built ────────────────────────────
  // A group with customers on more than one copy cannot be resolved by keeping
  // one of them: whichever is kept, the others' bookings would be orphaned
  // (bookings.session_id is ON DELETE SET NULL, so they would not even fail
  // loudly — they would silently detach). Stop, and report enough to act on.
  const split = duplicateGroups.filter(g =>
    g.filter(s => (bookingCount.get(s.id) || 0) > 0 || (queueCount.get(s.id) || 0) > 0).length > 1
  );
  if (split.length > 0) {
    console.error('\n!!! REFUSING TO RUN !!!\n');
    console.error(`${split.length} duplicate group(s) have customers attached to more than one copy.`);
    console.error('Deleting any of them would silently detach those bookings from their session.');
    console.error('These need to be merged by hand — decide which session the customers belong to,');
    console.error('move them across, then run this script again.\n');
    for (const g of split) {
      const w = workshopById.get(g[0].workshop_id);
      console.error(`  ${w ? w.title : '(unknown workshop)'} — ${g[0].date} ${g[0].start_time}`);
      for (const s of g) {
        const b = bookingCount.get(s.id) || 0;
        const q = queueCount.get(s.id) || 0;
        if (b || q) console.error(`    ${s.id}   ${b} booking(s), ${q} queue row(s)`);
      }
    }
    process.exit(1);
  }

  // ── Build the plan ─────────────────────────────────────────────────────────
  const plan = [];
  const noParent = [];

  for (const group of duplicateGroups) {
    const workshop = workshopById.get(group[0].workshop_id);
    const sorted = [...group].sort((a, b) =>
      String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id.localeCompare(b.id)
    );

    let survivor;
    let reason;
    const booked = sorted.find(s => (bookingCount.get(s.id) || 0) > 0);
    const queued = sorted.find(s => (queueCount.get(s.id) || 0) > 0);
    const matching = workshop ? sorted.find(s => s.capacity === workshop.capacity) : undefined;

    if (booked) { survivor = booked; reason = `holds ${bookingCount.get(booked.id)} booking(s)`; }
    else if (queued) { survivor = queued; reason = `holds ${queueCount.get(queued.id)} queue row(s)`; }
    else if (matching) { survivor = matching; reason = `capacity ${matching.capacity} matches the workshop`; }
    else { survivor = sorted[0]; reason = 'oldest copy'; }

    // Capacity is only corrected against a workshop we can actually read. If
    // the parent is missing there is no authority to correct against, so the
    // capacity is left exactly as it is and the group is reported separately.
    const targetCapacity = workshop ? workshop.capacity : null;
    const needsCapacityFix = targetCapacity !== null && survivor.capacity !== targetCapacity;
    if (!workshop) noParent.push(group[0].workshop_id);

    plan.push({
      workshopId: group[0].workshop_id,
      workshopTitle: workshop ? workshop.title : '(workshop row not found)',
      date: group[0].date,
      startTime: group[0].start_time,
      survivor,
      reason,
      needsCapacityFix,
      fromCapacity: survivor.capacity,
      toCapacity: targetCapacity,
      doomed: sorted.filter(s => s.id !== survivor.id)
    });
  }

  plan.sort((a, b) =>
    a.workshopTitle.localeCompare(b.workshopTitle) ||
    a.date.localeCompare(b.date) ||
    String(a.startTime).localeCompare(String(b.startTime))
  );

  // ── Print it ───────────────────────────────────────────────────────────────
  console.log('─'.repeat(78));
  console.log('PLAN');
  console.log('─'.repeat(78));

  let lastWorkshop = null;
  for (const p of plan) {
    if (p.workshopId !== lastWorkshop) {
      const w = workshopById.get(p.workshopId);
      console.log(`\n${p.workshopTitle}  [${p.workshopId}]${w ? `  workshop capacity: ${w.capacity}` : ''}`);
      lastWorkshop = p.workshopId;
    }
    console.log(`\n  ${p.date} ${p.startTime}   (${p.doomed.length + 1} copies)`);
    console.log(`    KEEP    ${p.survivor.id}  capacity ${p.survivor.capacity}  — ${p.reason}`);
    if (p.needsCapacityFix) {
      console.log(`            └─ CORRECT capacity ${p.fromCapacity} → ${p.toCapacity}`);
    }
    for (const d of p.doomed) {
      console.log(`    DELETE  ${d.id}  capacity ${d.capacity}  (0 bookings, 0 queue rows)`);
    }
  }

  const capacityFixes = plan.filter(p => p.needsCapacityFix);
  const deletions = plan.flatMap(p => p.doomed);

  console.log(`\n${'─'.repeat(78)}`);
  console.log('SUMMARY');
  console.log('─'.repeat(78));
  console.log(`  Groups resolved:      ${plan.length}`);
  console.log(`  Sessions kept:        ${plan.length}`);
  console.log(`  Capacity corrections: ${capacityFixes.length}`);
  for (const p of capacityFixes) {
    console.log(`      ${p.survivor.id}  ${p.fromCapacity} → ${p.toCapacity}   (${p.workshopTitle}, ${p.date} ${p.startTime})`);
  }
  console.log(`  Sessions deleted:     ${deletions.length}`);
  if (noParent.length > 0) {
    console.log(`\n  !! ${new Set(noParent).size} group(s) have no readable parent workshop.`);
    console.log('     Their duplicates are still removed, but capacity is left untouched —');
    console.log('     there is no authority to correct it against. Check these by hand.');
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing was written.');
    console.log('If this plan is right, re-run with --apply, then apply migration 0022.');
    return;
  }

  // ── Apply ──────────────────────────────────────────────────────────────────
  console.log('\nApplying...\n');
  let corrected = 0;
  let deleted = 0;

  // Capacity first: if this run dies partway, the duplicates are still present
  // and the next run rebuilds the same plan. Deleting first would leave a lone
  // survivor carrying a capacity nobody has checked.
  for (const p of capacityFixes) {
    const { error } = await db
      .from('workshop_sessions')
      .update({ capacity: p.toCapacity })
      .eq('id', p.survivor.id);
    if (error) {
      console.error(`  FAILED to correct ${p.survivor.id}: ${error.message}`);
      console.error('  Stopping. Nothing has been deleted. Fix the cause and run again.');
      process.exit(1);
    }
    corrected++;
    console.log(`  capacity  ${p.survivor.id}  ${p.fromCapacity} → ${p.toCapacity}`);
  }

  // One at a time, so a failure is isolated and reported against its own row.
  for (const d of deletions) {
    const { error } = await db.from('workshop_sessions').delete().eq('id', d.id);
    if (error) {
      console.error(`  FAILED to delete ${d.id}: ${error.message}`);
      console.error(`  Stopping after ${deleted} deletion(s). Re-run to continue.`);
      process.exit(1);
    }
    deleted++;
    console.log(`  deleted   ${d.id}`);
  }

  console.log(`\nDone. ${corrected} capacity correction(s), ${deleted} session(s) deleted.`);
  console.log('Now apply migration 0022 to stop this recurring.');
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
