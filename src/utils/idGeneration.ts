/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Booking reference code generation, kept in one place so the two call sites
 * (checkout's idempotent retry ref and addBooking's fallback) can never drift
 * out of sync on the format.
 */

/**
 * A short, human-readable booking reference: "ART-" plus a 7-digit number
 * (1,000,000-9,999,999, ~9,000,000 values).
 *
 * Was 5 digits (~90,000 values) — small enough that a collision was a real
 * risk at this business's scale, and bookings.id is `text primary key`
 * (0001_init.sql) with no retry on write failure. Worse, book_session_seats
 * and book_birthday_slot (migrations 0028/0029) treat any pre-existing id as
 * proof of a caller's own retry and return success without writing — so a
 * genuine collision would not surface as an error at all, it would silently
 * drop the second customer's booking while reporting it as confirmed.
 *
 * Kept as a short digit string rather than a uuid: unlike customer.id, this
 * code is shown to customers (the .ics calendar file's description, UID and
 * filename all embed it) and to staff throughout the Bookings Ledger, so it
 * needs to stay something a person can read back or type, not a 36-character
 * string. Widening the space ~100x makes collision negligible at this
 * business's real volume without changing that.
 */
export function generateBookingRefCode(): string {
  return `ART-${Math.floor(1000000 + Math.random() * 9000000)}`;
}
