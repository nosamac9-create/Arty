/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Request/response shapes for notify-own-booking. Same arrangement as
 * send-sms/contract.ts and auto-cancel-bookings/contract.ts.
 */

export interface NotifyOwnBookingRequest {
  bookingId: string;
}

export interface NotifyOwnBookingResponse {
  success: boolean;
  error?: string;
}
