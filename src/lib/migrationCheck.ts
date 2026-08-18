/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Startup check that the database migrations have actually been applied.
 *
 * Without this, a missing migration shows up as an unrelated failure much
 * later — a booking that silently does not save, a queue number that collides.
 * Each expected object is probed by name so the message can say which file to
 * run.
 *
 * Read-only: every probe is a call that changes nothing.
 */

import { getDataClient } from './supabase';

export interface MigrationRequirement {
  /** The database object being probed. */
  name: string;
  /** The migration file that creates it. */
  migration: string;
  /** Runs the probe. Resolves true when the object exists. */
  probe: (client: NonNullable<ReturnType<typeof getDataClient>>) => Promise<boolean>;
}

/** PostgREST's code for "no such function". Anything else means it exists. */
const MISSING_FUNCTION = 'PGRST202';
/** ...and for "no such table/column". */
const MISSING_RELATION = 'PGRST205';

/** A function exists if calling it returns anything other than "not found". */
const rpcExists = (fn: string, args: Record<string, unknown>) =>
  async (client: NonNullable<ReturnType<typeof getDataClient>>) => {
    const { error } = await client.rpc(fn, args);
    if (!error) return true;
    return error.code !== MISSING_FUNCTION && !/could not find the function/i.test(error.message || '');
  };

/** A table exists if selecting from it returns anything other than "not found". */
const tableExists = (table: string, column = 'id') =>
  async (client: NonNullable<ReturnType<typeof getDataClient>>) => {
    const { error } = await client.from(table).select(column).limit(1);
    if (!error) return true;
    return error.code !== MISSING_RELATION && !/does not exist/i.test(error.message || '');
  };

export const MIGRATION_REQUIREMENTS: MigrationRequirement[] = [
  // 0001 — schema.
  { name: 'workshop_sessions table', migration: '0001_init.sql', probe: tableExists('workshop_sessions') },
  { name: 'piece_history table', migration: '0001_init.sql', probe: tableExists('piece_history') },
  { name: 'pipeline_stages table', migration: '0001_init.sql', probe: tableExists('pipeline_stages') },
  {
    name: 'claim_customer_account()',
    migration: '0001_init.sql',
    probe: rpcExists('claim_customer_account', { identifier: '', new_auth_id: null })
  },
  {
    name: 'link_existing_customer()',
    migration: '0001_init.sql',
    probe: rpcExists('link_existing_customer', { identifier: '', new_auth_id: null })
  },

  // 0002 — atomic capacity and queue numbering.
  {
    name: 'book_session_seats()',
    migration: '0002_capacity_rpc.sql',
    probe: rpcExists('book_session_seats', { p_booking: {}, p_session_id: null })
  },
  {
    name: 'release_booking_seats()',
    migration: '0002_capacity_rpc.sql',
    probe: rpcExists('release_booking_seats', { p_booking_id: '__probe__' })
  },
  {
    name: 'next_queue_id()',
    migration: '0002_capacity_rpc.sql',
    probe: rpcExists('next_queue_id', { p_date: '2026-01-01' })
  },
  {
    name: 'session_seats_remaining()',
    migration: '0002_capacity_rpc.sql',
    probe: rpcExists('session_seats_remaining', { p_session_id: '__probe__' })
  },

  // 0003 — the customer site's write path.
  {
    name: 'resolve_customer_record()',
    migration: '0003_customer_write_access.sql',
    probe: rpcExists('resolve_customer_record', { p_name: null, p_phone: null, p_email: null, p_auth_id: null, p_source: null })
  },
  {
    name: 'get_customer_summary()',
    migration: '0003_customer_write_access.sql',
    probe: rpcExists('get_customer_summary', { p_id: '__probe__' })
  },

  // 0004 — staff assignment on a booking.
  {
    name: 'bookings.staff_id column',
    migration: '0004_booking_staff_assignment.sql',
    probe: tableExists('bookings', 'staff_id')
  },

  // 0005 — signing in with a phone number or an email address.
  {
    name: 'customer_signin_route()',
    migration: '0005_signin_by_phone_or_email.sql',
    probe: rpcExists('customer_signin_route', { identifier: '' })
  },
  {
    name: 'customer_signin_email()',
    migration: '0005_signin_by_phone_or_email.sql',
    probe: rpcExists('customer_signin_email', { p_identifier: '', p_password: '' })
  },
  {
    name: 'customer_claim_email_matches()',
    migration: '0005_signin_by_phone_or_email.sql',
    probe: rpcExists('customer_claim_email_matches', { p_identifier: '', p_email: '' })
  }
];

export interface MigrationCheckResult {
  ok: boolean;
  /** One line per missing object, naming the file that creates it. */
  problems: string[];
  /** The migration files that need running, in order. */
  missingMigrations: string[];
  /** True when the check could not run at all (no client configured). */
  skipped: boolean;
}

/**
 * Probes every expected object. Never throws: a failure here must not stop the
 * app from loading, only report itself.
 */
export async function checkMigrations(): Promise<MigrationCheckResult> {
  const client = getDataClient();
  if (!client) {
    return { ok: true, problems: [], missingMigrations: [], skipped: true };
  }

  const problems: string[] = [];
  const missing = new Set<string>();

  await Promise.all(MIGRATION_REQUIREMENTS.map(async requirement => {
    try {
      const exists = await requirement.probe(client);
      if (!exists) {
        problems.push(`Migration ${requirement.migration} not applied: ${requirement.name} missing`);
        missing.add(requirement.migration);
      }
    } catch (err: any) {
      // An unreachable database is not a missing migration; do not cry wolf.
      console.warn(`Could not probe ${requirement.name}:`, err?.message);
    }
  }));

  // Report in migration order so the fix is "run these, in this order".
  const missingMigrations = [...missing].sort();
  problems.sort();

  return { ok: problems.length === 0, problems, missingMigrations, skipped: false };
}
