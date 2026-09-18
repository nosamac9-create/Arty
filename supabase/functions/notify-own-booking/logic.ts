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

export type Lang = 'en' | 'ar';

/**
 * validation.ts has no React context access either, so this mirrors its own
 * translate(en, ar, lang) helper — same shape, declared locally rather than
 * imported, since this file (like validation.ts) is deliberately
 * dependency-free.
 */
function translate(en: string, ar: string, lang: Lang = 'en'): string {
  return lang === 'ar' ? ar : en;
}

export interface BookingRow {
  id: string;
  customer_id: string | null;
  customer_phone: string | null;
  workshop_title: string | null;
  date: string | null;
  total_price: number | null;
  payment_status: string | null;
  status: string | null;
  /** Embedded via the customer_id -> customers.id foreign key (0001_init.sql:183) —
   *  index.ts's service-role read joins this in so cancellationMessage() can
   *  pick a language. */
  customers?: { preferred_lang: string | null } | null;
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
export function cancellationMessage(booking: BookingRow, refunded: boolean, lang: Lang = 'en'): string {
  const title = booking.workshop_title || translate('your booking', 'حجزك', lang);
  const when = formatBookingDate(booking.date);
  return refunded
    ? translate(
        `Your booking for "${title}" on ${when} has been cancelled, and ${booking.total_price} SAR has been refunded. We hope to see you again soon!`,
        `تم إلغاء حجزك لـ "${title}" بتاريخ ${when}، وتم استرداد ${booking.total_price} ريال سعودي. نأمل أن نراك قريبًا!`,
        lang
      )
    : translate(
        `Your booking for "${title}" on ${when} has been cancelled. Per our cancellation policy, this booking was not eligible for a refund. Please contact Arty Café with any questions.`,
        `تم إلغاء حجزك لـ "${title}" بتاريخ ${when}. وبحسب سياسة الإلغاء لدينا، هذا الحجز غير مؤهل لاسترداد المبلغ. يرجى التواصل مع آرتي كافيه لأي استفسار.`,
        lang
      );
}
