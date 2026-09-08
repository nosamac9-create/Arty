/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure decision logic for notify-own-booking.
 *
 * Zero Deno/Supabase imports, so it runs under plain Node/tsx in
 * logic.test.ts — same arrangement as send-sms/logic.ts and
 * auto-cancel-bookings/logic.ts. index.ts does all the I/O; what the
 * message says and who is allowed to trigger it live here.
 *
 * The message wording mirrors notifyBookingCancellation() (AppContext.tsx)
 * exactly, so a customer sees the same words regardless of who — or what —
 * triggered the cancellation.
 */

export interface BookingRow {
  id: string;
  customer_id: string | null;
  customer_phone: string | null;
  workshop_title: string | null;
  date: string | null;
  total_price: number | null;
  payment_status: string | null;
  status: string | null;
}

/** Whether the caller's own customer id matches this booking's owner. */
export function ownsBooking(booking: Pick<BookingRow, 'customer_id'>, callerCustomerId: string | null): boolean {
  return !!callerCustomerId && !!booking.customer_id && booking.customer_id === callerCustomerId;
}

/**
 * Mirrors cancelBooking()/cancel_own_booking's own refunded rule: the
 * booking's payment_status is the source of truth, not a client claim.
 */
export function wasRefunded(booking: Pick<BookingRow, 'payment_status'>): boolean {
  return booking.payment_status === 'Refunded';
}

/** "September 16, 2026", or the raw value if it can't be parsed. */
export function formatBookingDate(date?: string | null): string {
  const trimmed = String(date ?? '').trim();
  const parts = trimmed.split('-');
  if (parts.length !== 3) return trimmed;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return trimmed;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** Same two messages notifyBookingCancellation() (AppContext.tsx) sends. */
export function cancellationMessage(booking: BookingRow, refunded: boolean): string {
  const title = booking.workshop_title || 'your booking';
  const when = formatBookingDate(booking.date);
  return refunded
    ? `Your booking for "${title}" on ${when} has been cancelled, and ${booking.total_price} SAR has been refunded. We hope to see you again soon!`
    : `Your booking for "${title}" on ${when} has been cancelled. Per our cancellation policy, this booking was not eligible for a refund. Please contact Arty Café with any questions.`;
}
