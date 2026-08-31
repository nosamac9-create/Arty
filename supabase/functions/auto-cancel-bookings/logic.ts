/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure decision logic for the auto-cancel-bookings scheduled function.
 *
 * Zero Deno/Supabase imports, so it runs under plain Node/tsx in
 * logic.test.ts — same arrangement as send-sms/logic.ts and
 * provision-staff/logic.ts. index.ts does all the I/O; every rule about
 * *whether* to cancel and *what to say* lives here.
 *
 * These rules are a deliberate mirror of the two client-side timers this
 * replaces (AppContext.tsx). They are not a redesign: same 15-minute
 * thresholds, same statuses, same Called-only no-show gate. If either rule
 * changes, it changes here — the client timers are gone.
 */

/** Minutes of grace before either timer acts. */
export const GRACE_MINUTES = 15;

export type CancelReason = 'no_show' | 'unpaid';

export interface BookingRow {
  id: string;
  status: string | null;
  payment_status: string | null;
  date: string | null;
  time: string | null;
  created_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  workshop_title: string | null;
}

export interface QueueRow {
  id: string;
  booking_id: string | null;
  phone: string | null;
  date: string | null;
  status: string | null;
}

/**
 * Digits-only national form. Mirrors normalizeCustomerPhone()
 * (src/utils/customerIdentity.ts) and normalize_customer_phone()
 * (0001_init.sql): strip non-digits, then a leading 00, then 966, then 0.
 *
 * Matching queue rows to bookings on the raw string missed '+966 50 …'
 * against '05…' for the same person, which is how a seated customer could
 * stay Pending and be cancelled while sitting at a table.
 */
export function normalizePhone(phone?: string | null): string {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** Zero-pads a y-m-d date so '2026-8-3' and '2026-08-03' compare equal. */
export function normalizeDate(value?: string | null): string {
  const trimmed = String(value ?? '').trim();
  const parts = trimmed.split('-');
  if (parts.length !== 3) return trimmed;
  return `${parts[0].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
}

/**
 * A booking's start as an epoch milliseconds value, or null if unreadable.
 *
 * Mirrors parseBookingDateTimeToRiyadhDate() (src/utils/dateUtils.ts) and
 * booking_start_at() (migration 0017): handles '09:00 PM', '16:00', and the
 * '16:00 - 18:00' range form, whose first half is the start. The stored date
 * and time are Riyadh wall-clock, so the offset is applied explicitly rather
 * than relying on the runtime's zone — an Edge Function runs in UTC.
 */
export const RIYADH_UTC_OFFSET_HOURS = 3;

export function bookingStartMs(date?: string | null, time?: string | null): number | null {
  const day = normalizeDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  let raw = String(time ?? '').split(' - ')[0].trim().toUpperCase();
  if (!raw) return null;

  const isPm = raw.includes('PM');
  const isAm = raw.includes('AM');
  raw = raw.replace('PM', '').replace('AM', '').trim();

  const parts = raw.split(':');
  const hh = Number.parseInt(parts[0], 10);
  const mm = parts.length > 1 ? Number.parseInt(parts[1], 10) : 0;
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  let hour = hh;
  if (isPm && hh < 12) hour = hh + 12;
  else if (isAm && hh === 12) hour = 0;

  const [y, m, d] = day.split('-').map(Number);
  // Build in UTC, then subtract Riyadh's offset to get the real instant.
  return Date.UTC(y, m - 1, d, hour, mm) - RIYADH_UTC_OFFSET_HOURS * 3600_000;
}

/**
 * The queue row belonging to a booking, if any.
 *
 * booking_id first — the real link. Phone is the fallback for rows written
 * before that link existed, compared normalized and scoped to the booking's
 * own day so last week's row for the same person is never picked up.
 */
export function findQueueRow(queue: QueueRow[], booking: BookingRow): QueueRow | undefined {
  const byId = queue.find(q => q.booking_id && String(q.booking_id) === String(booking.id));
  if (byId) return byId;

  const wanted = normalizePhone(booking.customer_phone);
  if (!wanted) return undefined;

  return queue.find(
    q => normalizePhone(q.phone) === wanted && normalizeDate(q.date) === normalizeDate(booking.date)
  );
}

/**
 * Whether a booking should be auto-cancelled now, and why.
 *
 * NO-SHOW — Pending, at least 15 minutes past the session start, and the
 * customer's queue row is in Called. Called is the one state meaning "we
 * asked for this person and they did not come". Waiting means we have not
 * asked yet; seated or checked in means they are here; no row at all means
 * they were never queued. All three are protected — the studio decides,
 * not the clock.
 *
 * UNPAID — Pending and Unpaid and at least 15 minutes past creation. A
 * payment timeout, unrelated to attendance: it deliberately ignores the
 * queue and the session time entirely.
 *
 * No-show is evaluated first. A booking that is both un-arrived and unpaid
 * is better explained to the customer as a no-show than as a payment
 * problem, and only one message is ever sent.
 */
export function decideCancellation(
  booking: BookingRow,
  queue: QueueRow[],
  nowMs: number
): CancelReason | null {
  if (String(booking.status ?? '') !== 'Pending') return null;

  const startMs = bookingStartMs(booking.date, booking.time);
  if (startMs !== null && nowMs - startMs >= GRACE_MINUTES * 60_000) {
    if (findQueueRow(queue, booking)?.status === 'Called') return 'no_show';
  }

  if (String(booking.payment_status ?? '') === 'Unpaid') {
    const createdMs = Date.parse(String(booking.created_at ?? ''));
    if (Number.isFinite(createdMs) && nowMs - createdMs >= GRACE_MINUTES * 60_000) return 'unpaid';
  }

  return null;
}

/** The timeline entry, matching the wording the client timers wrote. */
export function timelineAction(reason: CancelReason): string {
  return reason === 'no_show'
    ? 'Did not show up — auto-cancelled (System Action)'
    : 'Cancelled automatically due to 15-minute payment timeout';
}

/** The note appended to the booking. Only the no-show timer wrote one. */
export function bookingNote(reason: CancelReason): string | null {
  return reason === 'no_show' ? 'Did not show up — auto-cancelled' : null;
}

/**
 * What the customer is told.
 *
 * Deliberately not the refunded/not-refunded pair notifyBookingCancellation()
 * uses. Neither of these is a refund decision: a no-show is non-refundable by
 * the cancellation policy, and an unpaid booking never took a payment, so
 * telling that customer they are "not eligible for a refund" would be
 * misleading about money they never handed over.
 */
export function customerMessage(reason: CancelReason, booking: BookingRow): string {
  const title = booking.workshop_title || 'your workshop';
  const when = formatBookingDate(booking.date);

  if (reason === 'no_show') {
    return `Arty Café: your booking for "${title}"${when} has been cancelled. We called for you and you had not arrived, so the place has been released. Per our cancellation policy this booking is not refundable. Please contact the studio if you think this is a mistake.`;
  }

  return `Arty Café: your booking for "${title}"${when} has been cancelled because payment was not received within ${GRACE_MINUTES} minutes. No payment was taken. You are welcome to book again.`;
}

/** The in-app notification title, matching the message's reason. */
export function notificationTitle(reason: CancelReason): string {
  return reason === 'no_show' ? 'Booking Cancelled — Missed Session' : 'Booking Cancelled — Payment Not Received';
}

/** " on 31 August 2026", or empty when the date is unreadable. */
function formatBookingDate(date?: string | null): string {
  const day = normalizeDate(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const [y, m, d] = day.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return ` on ${d} ${months[m - 1]} ${y}`;
}
