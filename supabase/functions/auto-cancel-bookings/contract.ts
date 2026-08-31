/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Request/response shapes for auto-cancel-bookings. Same arrangement as
 * send-sms/contract.ts and provision-staff/contract.ts.
 */

import type { CancelReason } from './logic.ts';

/** The scheduler sends no body. `dryRun` exists for a manual smoke test. */
export interface AutoCancelRequest {
  /** Decide and report, but write nothing and send nothing. */
  dryRun?: boolean;
}

export interface AutoCancelledBooking {
  bookingId: string;
  reason: CancelReason;
  smsSent: boolean;
  notificationWritten: boolean;
}

export interface AutoCancelResponse {
  success: boolean;
  /** Bookings examined this run. */
  scanned?: number;
  /** Bookings actually cancelled by this run. */
  cancelled?: AutoCancelledBooking[];
  /** Set when the run itself failed, not when an individual booking did. */
  error?: string;
}
