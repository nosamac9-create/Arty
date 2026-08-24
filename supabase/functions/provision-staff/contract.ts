/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The HTTP request/response contract for provision-staff. Kept separate from
 * logic.ts (the decision rules) and index.ts (the Deno/Supabase plumbing) so
 * it is the one place a frontend wrapper needs to read to know the shape of
 * this function. Mirrored (not imported — Vite and Deno are different
 * toolchains) in src/context/AppContext.tsx, next to provisionStaff(), the
 * client-side wrapper that calls this function. Change both together.
 */

export interface ProvisionStaffRequest {
  /** The public.staff row to provision. The caller never supplies an email, role, or auth id directly — the function reads them from this row itself. */
  staffId: string;
}

export interface ProvisionStaffSuccess {
  success: true;
  staffId: string;
  /** 'already-provisioned' means no Auth/staff write happened this call — see logic.ts's idempotent_success. */
  status: 'invited' | 'already-provisioned';
}

export interface ProvisionStaffCollision {
  success: false;
  staffId: string;
  code: 'identity_collision';
  message: string;
  /**
   * Non-sensitive hint only: never returns the colliding Auth user's email,
   * id, or any customer/staff data. Just tells the admin whether the
   * pre-existing (unlinked) identity also looks like a customer, so they can
   * make an informed call about how to resolve it manually.
   */
  hasExistingCustomerRecord: boolean;
}

export interface ProvisionStaffError {
  success: false;
  staffId?: string;
  code:
    | 'unauthenticated'
    | 'forbidden'
    | 'not_found'
    | 'invalid_input'
    | 'inactive_staff'
    | 'duplicate_email'
    | 'linked_identity_mismatch'
    | 'linked_identity_missing'
    | 'identity_belongs_to_other_staff'
    | 'internal_error';
  message: string;
}

export type ProvisionStaffResponse =
  | ProvisionStaffSuccess
  | ProvisionStaffCollision
  | ProvisionStaffError;
