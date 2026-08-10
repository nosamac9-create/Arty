/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One-time creation of the first Super Admin.
 *
 * Creates the Supabase Auth user AND the linked staff row, in that order, so
 * the console has exactly one way in. Run it once per environment.
 *
 * It reads everything from the shell environment — nothing is committed:
 *
 *   SUPABASE_URL="https://xxxx.supabase.co" \
 *   SUPABASE_SERVICE_ROLE_KEY="..." \
 *   SUPER_ADMIN_EMAIL="you@artycafe.sa" \
 *   SUPER_ADMIN_PASSWORD='<a strong one-off password>' \
 *   SUPER_ADMIN_NAME="Studio Manager" \
 *   npm run create-super-admin
 *
 * The service_role key bypasses Row Level Security. Use it only here, only
 * from your own machine, and never put it in .env or any frontend file.
 *
 * The account is created with password_is_temporary = true, so the console
 * forces a password change on first sign-in.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

// Optional: read values from .env.admin.local so nothing has to be typed at a
// shell prompt (quoting there is easy to get wrong). That file is gitignored
// and holds the service_role key, so DELETE IT once the account exists.
const ADMIN_ENV_FILE = new URL('../.env.admin.local', import.meta.url).pathname;
if (existsSync(ADMIN_ENV_FILE)) {
  for (const line of readFileSync(ADMIN_ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    // Strip one matching pair of surrounding quotes, if present.
    const value = trimmed.slice(eq + 1).trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    if (!process.env[key]) process.env[key] = value;
  }
  console.log('Read settings from .env.admin.local');
}

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_NAME = 'Studio Super Admin',
  SUPER_ADMIN_PHONE = ''
} = process.env;

const missing = Object.entries({
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD
}).filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('See the comment at the top of this file for the full command.');
  process.exit(1);
}

if (String(SUPER_ADMIN_PASSWORD).length < 12) {
  console.error('Choose a password of at least 12 characters for the first Super Admin.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const normalizePhone = (p) => {
  let d = String(p || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('966')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
};

const email = String(SUPER_ADMIN_EMAIL).trim().toLowerCase();

// 1. The auth user. Email is pre-confirmed so the first sign-in is not blocked.
const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password: SUPER_ADMIN_PASSWORD,
  email_confirm: true
});

let authUserId = created?.user?.id;

if (createError) {
  if (!/already/i.test(createError.message)) {
    console.error(`Could not create the auth user: ${createError.message}`);
    process.exit(1);
  }
  // Already there from a previous run — find them so this stays idempotent.
  const { data: list } = await admin.auth.admin.listUsers();
  authUserId = list?.users?.find(u => u.email?.toLowerCase() === email)?.id;
  if (!authUserId) {
    console.error('An auth user with this email exists but could not be read.');
    process.exit(1);
  }

  // Re-set the password and confirm the email. Re-running is therefore also
  // the recovery path if the first password was mistyped or mangled by the
  // shell (an unquoted ! or $ is a common one).
  const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
    password: SUPER_ADMIN_PASSWORD,
    email_confirm: true
  });
  if (updateError) {
    console.error(`Could not reset the password: ${updateError.message}`);
    process.exit(1);
  }
  console.log('Auth user already existed — password reset and email confirmed.');
}

// 2. The staff row, linked by user_id.
const staffId = `staff-super-admin`;
const { error: staffError } = await admin.from('staff').upsert({
  id: staffId,
  user_id: authUserId,
  name: SUPER_ADMIN_NAME,
  email,
  phone: SUPER_ADMIN_PHONE || null,
  normalized_phone: normalizePhone(SUPER_ADMIN_PHONE) || null,
  position: 'Studio Manager',
  status: 'Active',
  role: 'Super Admin',
  // Super Admin needs no page list; the role grants everything.
  permissions: [],
  has_console_access: true,
  password_is_temporary: true
}, { onConflict: 'id' });

if (staffError) {
  console.error(`Auth user created, but the staff row failed: ${staffError.message}`);
  console.error('Run the Stage 1a migration (supabase/migrations/0001_init.sql) first.');
  process.exit(1);
}

console.log('');
console.log('Super Admin ready.');
console.log(`  auth user : ${authUserId}`);
console.log(`  staff row : ${staffId}`);
console.log(`  email     : ${email}`);
console.log('');
console.log('Sign in at the Staff Login link in the site footer.');
console.log('The console will require a new password before it opens.');
console.log('Do not reuse or share the one-off password you just set.');
