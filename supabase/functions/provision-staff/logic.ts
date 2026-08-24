/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure decision logic for the provision-staff Edge Function (audit finding
 * C-3). Deliberately has ZERO Deno/Supabase-client imports so it can be
 * exercised with plain Node/tsx in logic.test.ts, and so the actual
 * authorization/collision rules are readable and testable independent of the
 * HTTP/Auth-Admin-API plumbing in index.ts.
 *
 * SECURITY INVARIANT THIS FILE ENFORCES:
 * A staff identity (staff.user_id) is established ONLY by this decision
 * logic, running under an authorization check the caller cannot influence
 * (see requireSuperAdmin-shaped checks in index.ts). Nothing here ever
 * treats "an Auth user's email matches staff.email" as sufficient proof to
 * attach that Auth user to the staff row — that is exactly the C-3 bug
 * (loginStaff() used to do this). An existing, unlinked Auth account for the
 * target email is always routed to 'collision' (human review), never
 * auto-claimed, UNLESS it carries this function's own unforgeable
 * provisioning marker for this exact staff row (see SelfHealMarker below) —
 * which only this function, running with the service-role key, can ever set.
 */

export type StaffStatus = 'Active' | 'On Leave' | 'Inactive' | 'Former Staff';

/** The staff row being provisioned, as read with the service-role client (bypasses RLS). */
export interface TargetStaffRow {
  id: string;
  userId: string | null;
  /** Already canonicalized (trim + lowercase) by the caller of decideProvisioning. */
  email: string;
  status: StaffStatus;
}

/** Another staff row that collides with the target on email or on the resolved Auth user id. */
export interface OtherStaffRef {
  id: string;
}

/**
 * A stamp this function itself writes into a newly-invited Auth user's
 * app_metadata (never user_metadata — that's editable by the account holder
 * and would be forgeable). Its presence, pointing at THIS staffId, is the
 * only condition allowed to treat a pre-existing Auth user as "ours" rather
 * than an unrelated/unknown identity requiring review.
 */
export interface SelfHealMarker {
  staffId: string;
}

/** What index.ts learned about the target email's Auth-side state before calling decideProvisioning. */
export interface AuthLookup {
  /** null if no auth.users row exists for the target staff's canonical email. */
  existingAuthUserId: string | null;
  /** Only meaningful when existingAuthUserId is set. */
  existingAuthUserMarker: SelfHealMarker | null;
  /** Whether existingAuthUserId also appears as customers.user_id somewhere — a non-sensitive boolean hint only. */
  existingAuthUserHasCustomerRecord: boolean;
  /** The Auth user's own current email, when targetStaff.userId is already set and was looked up by id (Case A/B). Null otherwise. */
  linkedAuthUserEmail: string | null;
  /** True if targetStaff.userId is set but no matching Auth user could be found at all (deleted out-of-band). */
  linkedAuthUserMissing: boolean;
}

export type ProvisionDecision =
  | { action: 'idempotent_success' }
  | { action: 'create_and_link' }
  | { action: 'complete_self_heal_link'; authUserId: string }
  | { action: 'collision_review'; hasExistingCustomerRecord: boolean }
  | { action: 'reject'; code: RejectCode; message: string };

export type RejectCode =
  | 'not_found'
  | 'invalid_input'
  | 'inactive_staff'
  | 'duplicate_email'
  | 'linked_identity_mismatch'
  | 'linked_identity_missing'
  | 'identity_belongs_to_other_staff';

/**
 * The single decision point. Everything here is a pure function of its
 * inputs — no I/O, no Supabase client, no randomness — so every branch below
 * is covered by a plain assertion in logic.test.ts.
 */
export function decideProvisioning(input: {
  targetStaff: TargetStaffRow | null;
  /** Another ACTIVE staff row sharing the same canonical email, if any (Case F). */
  duplicateEmailStaff: OtherStaffRef | null;
  /** Another staff row whose user_id already equals the resolved existing Auth user id, if any (Case E). */
  conflictingStaffForAuthUser: OtherStaffRef | null;
  auth: AuthLookup;
}): ProvisionDecision {
  const { targetStaff, duplicateEmailStaff, conflictingStaffForAuthUser, auth } = input;

  if (!targetStaff) {
    return { action: 'reject', code: 'not_found', message: 'No staff record with that id.' };
  }

  if (targetStaff.status === 'Inactive' || targetStaff.status === 'Former Staff') {
    return {
      action: 'reject',
      code: 'inactive_staff',
      message: 'This staff record is not active and cannot be provisioned.'
    };
  }

  if (!targetStaff.email) {
    return { action: 'reject', code: 'invalid_input', message: 'This staff record has no Work Email on file.' };
  }

  // Case F — duplicate staff Work Email. Checked unconditionally, before
  // anything else: an ambiguous staff/email mapping must never be provisioned.
  if (duplicateEmailStaff) {
    return {
      action: 'reject',
      code: 'duplicate_email',
      message: 'Another staff record already uses this Work Email.'
    };
  }

  // --- staff.user_id already set: this row was provisioned before. ---
  if (targetStaff.userId) {
    if (auth.linkedAuthUserMissing) {
      return {
        action: 'reject',
        code: 'linked_identity_missing',
        message: 'This staff record is linked to an Auth identity that no longer exists. Needs manual review.'
      };
    }

    // Case A — already linked, and the linked identity's own email still
    // agrees with the staff record's stored email: idempotent success, no writes.
    if (auth.linkedAuthUserEmail === targetStaff.email) {
      return { action: 'idempotent_success' };
    }

    // Case B — already linked, but the linked identity's email has drifted
    // from the staff record's stored email (e.g. staff.email was edited in
    // the console after provisioning without updating Auth). Reject rather
    // than silently repointing anything.
    return {
      action: 'reject',
      code: 'linked_identity_mismatch',
      message: 'This staff record’s linked Auth identity does not match its current Work Email. Needs manual review.'
    };
  }

  // --- staff.user_id is NULL: not yet provisioned. ---

  // Case C — no existing Auth user for this email at all: the normal,
  // uncomplicated provisioning path.
  if (!auth.existingAuthUserId) {
    return { action: 'create_and_link' };
  }

  // An Auth user already exists for this email. It must NEVER be trusted
  // purely because the email matches (that is the C-3 bug). The only
  // exception is this function's own unforgeable marker from a previous,
  // partially-failed attempt at provisioning this exact staff row.
  if (auth.existingAuthUserMarker && auth.existingAuthUserMarker.staffId === targetStaff.id) {
    return { action: 'complete_self_heal_link', authUserId: auth.existingAuthUserId };
  }

  // Case E — that Auth identity is already claimed by a DIFFERENT staff
  // record. Never reassign it.
  if (conflictingStaffForAuthUser) {
    return {
      action: 'reject',
      code: 'identity_belongs_to_other_staff',
      message: 'This Work Email’s Auth identity is already linked to a different staff record.'
    };
  }

  // Case D — an Auth user exists for this email, unlinked to any staff row,
  // and it is not a self-heal continuation of this exact request. It may be
  // an old account, a genuine customer, or someone who pre-registered the
  // address. Do not auto-claim it under any circumstances; surface a
  // non-sensitive hint (does it also look like a customer?) and require a
  // human decision.
  return { action: 'collision_review', hasExistingCustomerRecord: auth.existingAuthUserHasCustomerRecord };
}
