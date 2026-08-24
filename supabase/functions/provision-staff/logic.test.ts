/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plain-assertion tests for decideProvisioning() (audit finding C-3).
 * No test framework — this repo has none, and logic.ts has zero Deno
 * dependencies specifically so it can run under the tsx devDependency
 * already installed here:
 *
 *   npx tsx supabase/functions/provision-staff/logic.test.ts
 *
 * These cover the decision function itself (Step 8, scenarios 5-8: duplicate
 * email, idempotent already-linked, unlinked-existing-identity requires
 * review not auto-claim, identity belongs to another staff record). The
 * caller-identity checks (anonymous / customer / non-admin staff rejected,
 * Super Admin allowed) live in index.ts's HTTP layer, not this pure
 * function, and are verified by static code inspection in the chunk report
 * instead — there is nothing to unit-test there without a live Supabase
 * connection, which this chunk explicitly does not use.
 */

import { decideProvisioning, type ProvisionDecision } from './logic.ts';

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ok — ${label}`);
  } else {
    failed++;
    console.error(`  FAIL — ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

const baseAuth = {
  existingAuthUserId: null,
  existingAuthUserMarker: null,
  existingAuthUserHasCustomerRecord: false,
  linkedAuthUserEmail: null,
  linkedAuthUserMissing: false
};

console.log('decideProvisioning()');

// --- input validation --------------------------------------------------
assertEqual(
  decideProvisioning({ targetStaff: null, duplicateEmailStaff: null, conflictingStaffForAuthUser: null, auth: baseAuth }).action,
  'reject',
  'no target staff row -> reject'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'a@example.com', status: 'Inactive' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: baseAuth
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'inactive_staff',
  'Inactive staff status -> reject inactive_staff'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: '', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: baseAuth
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'invalid_input',
  'blank Work Email -> reject invalid_input'
);

// --- Case F: duplicate email, checked before anything else -------------
assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'dup@example.com', status: 'Active' },
    duplicateEmailStaff: { id: 's2' },
    conflictingStaffForAuthUser: null,
    auth: baseAuth
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'duplicate_email',
  'another active staff row shares this Work Email -> reject duplicate_email, even before Auth is consulted'
);

// --- Case A/B: already linked -------------------------------------------
assertEqual(
  decideProvisioning({
    targetStaff: { id: 's1', userId: 'auth-1', email: 'staff@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, linkedAuthUserEmail: 'staff@example.com' }
  }).action,
  'idempotent_success',
  'Case A: staff.user_id set, linked identity email matches -> idempotent success, no writes'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: 'auth-1', email: 'new@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, linkedAuthUserEmail: 'old@example.com' }
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'linked_identity_mismatch',
  'Case B: staff.user_id set, linked identity email has drifted -> reject, never silently repoint'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: 'auth-deleted', email: 'staff@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, linkedAuthUserMissing: true }
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'linked_identity_missing',
  'staff.user_id set but the Auth user no longer exists -> reject, requires manual review'
);

// --- Case C: clean provisioning ------------------------------------------
assertEqual(
  decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'brandnew@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: baseAuth
  }).action,
  'create_and_link',
  'Case C: unprovisioned, no existing Auth user for this email -> create_and_link'
);

// --- Case D: existing unlinked identity — the C-3 boundary --------------
assertEqual(
  decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'squatted@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, existingAuthUserId: 'auth-attacker' }
  }).action,
  'collision_review',
  'Case D: an Auth user already exists for this email, unlinked, no marker -> collision_review, NEVER auto-claimed (this is the C-3 boundary)'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'squatted@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, existingAuthUserId: 'auth-attacker', existingAuthUserHasCustomerRecord: true }
  }) as Extract<ProvisionDecision, { action: 'collision_review' }>).hasExistingCustomerRecord,
  true,
  'collision_review carries the non-sensitive "looks like a customer" hint through, and nothing else'
);

// --- self-heal: only when the marker is THIS staffId's own ---------------
assertEqual(
  decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'retry@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, existingAuthUserId: 'auth-2', existingAuthUserMarker: { staffId: 's1' } }
  }).action,
  'complete_self_heal_link',
  'a prior partially-failed provisioning attempt for THIS staffId (marker matches) -> complete_self_heal_link, no new Auth user'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'wrong-marker@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: null,
    auth: { ...baseAuth, existingAuthUserId: 'auth-3', existingAuthUserMarker: { staffId: 's-someone-else' } }
  }) as Extract<ProvisionDecision, { action: 'collision_review' }>).action,
  'collision_review',
  'a marker pointing at a DIFFERENT staffId is not trusted for this one -> still requires review, not treated as self-heal'
);

// --- Case E: identity already belongs to another staff record ------------
assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'shared@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: { id: 's-other' },
    auth: { ...baseAuth, existingAuthUserId: 'auth-4' }
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'identity_belongs_to_other_staff',
  'Case E: the resolved Auth identity is already claimed by a different staff row -> reject, never reassign'
);

assertEqual(
  (decideProvisioning({
    targetStaff: { id: 's1', userId: null, email: 'shared@example.com', status: 'Active' },
    duplicateEmailStaff: null,
    conflictingStaffForAuthUser: { id: 's-other' },
    auth: { ...baseAuth, existingAuthUserId: 'auth-4', existingAuthUserMarker: { staffId: 's-different-again' } }
  }) as Extract<ProvisionDecision, { action: 'reject' }>).code,
  'identity_belongs_to_other_staff',
  'Case E takes over once a non-matching marker rules out self-heal -> still reject, never reassign'
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  // deno-lint-ignore no-process-exit -- also valid under plain Node/tsx.
  (globalThis as any).process?.exit(1);
}
