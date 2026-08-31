/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plain-assertion tests for the auto-cancel decision rules. No test
 * framework — logic.ts has zero Deno dependencies specifically so this runs
 * under the tsx devDependency already installed here:
 *
 *   npx tsx supabase/functions/auto-cancel-bookings/logic.test.ts
 *
 * The rules under test are the ones the client-side timers enforced before
 * this function replaced them, so these double as a regression net for that
 * move: a Called guest is a no-show, a Waiting one is not.
 */

import {
  decideCancellation,
  bookingStartMs,
  findQueueRow,
  normalizePhone,
  customerMessage,
  notificationTitle,
  timelineAction,
  GRACE_MINUTES,
  type BookingRow,
  type QueueRow
} from './logic.ts';

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`PASS  ${label}`);
  } else {
    failed++;
    console.log(`FAIL  ${label}\n      got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`);
  }
}

// 2026-08-31 21:00 Riyadh == 18:00 UTC.
const START_MS = Date.UTC(2026, 7, 31, 18, 0);
const booking = (over: Partial<BookingRow> = {}): BookingRow => ({
  id: 'ART-99',
  status: 'Pending',
  payment_status: 'Paid',
  date: '2026-08-31',
  time: '09:00 PM',
  created_at: new Date(START_MS - 6 * 3600_000).toISOString(),
  customer_name: 'Enas Alqarni',
  customer_phone: '+966 50 456 39',
  workshop_title: 'Clay Pottery',
  ...over
});
const q = (status: string, over: Partial<QueueRow> = {}): QueueRow => ({
  id: 'Q-1',
  booking_id: 'ART-99',
  phone: '+966 50 456 39',
  date: '2026-08-31',
  status,
  ...over
});

const LATE = START_MS + 16 * 60_000;
const EARLY = START_MS + 5 * 60_000;

console.log('--- start-time parsing (mirrors booking_start_at) ---');
assertEqual(bookingStartMs('2026-08-31', '09:00 PM'), START_MS, '09:00 PM Riyadh -> 18:00 UTC');
assertEqual(bookingStartMs('2026-08-31', '21:00'), START_MS, '21:00 is the same instant');
assertEqual(bookingStartMs('2026-08-31', '21:00 - 23:00'), START_MS, 'range uses its start');
assertEqual(bookingStartMs('2026-08-31', '12:00 AM'), Date.UTC(2026, 7, 30, 21, 0), '12:00 AM is midnight');
assertEqual(bookingStartMs('2026-08-31', '12:00 PM'), Date.UTC(2026, 7, 31, 9, 0), '12:00 PM is noon');
assertEqual(bookingStartMs('2026-08-31', 'noon'), null, 'unreadable time -> null');
assertEqual(bookingStartMs('', '21:00'), null, 'missing date -> null');

console.log('\n--- no-show: only a Called guest ---');
assertEqual(decideCancellation(booking(), [q('Called')], LATE), 'no_show', 'Called + 16 min late -> no_show');
assertEqual(decideCancellation(booking(), [q('Waiting')], LATE), null, 'Waiting is protected');
assertEqual(decideCancellation(booking(), [q('In Progress')], LATE), null, 'seated is protected');
assertEqual(decideCancellation(booking(), [q('Completed')], LATE), null, 'completed is protected');
assertEqual(decideCancellation(booking(), [q('Cancelled')], LATE), null, 'cancelled row is not a no-show');
assertEqual(decideCancellation(booking(), [], LATE), null, 'no queue row -> protected');
assertEqual(decideCancellation(booking(), [q('Called')], EARLY), null, 'Called but only 5 min late -> not yet');
assertEqual(
  decideCancellation(booking(), [q('Called')], START_MS + GRACE_MINUTES * 60_000),
  'no_show',
  'exactly 15 min late -> fires'
);
assertEqual(decideCancellation(booking({ status: 'Checked In' }), [q('Called')], LATE), null, 'Checked In booking is never touched');
assertEqual(decideCancellation(booking({ status: 'Cancelled' }), [q('Called')], LATE), null, 'already Cancelled is never re-cancelled');
assertEqual(decideCancellation(booking({ status: 'Completed' }), [q('Called')], LATE), null, 'Completed booking is never touched');

console.log('\n--- unpaid: independent of attendance ---');
const unpaid = booking({ payment_status: 'Unpaid', created_at: new Date(START_MS - 20 * 60_000).toISOString() });
assertEqual(decideCancellation(unpaid, [], START_MS), 'unpaid', 'Unpaid + 20 min since creation -> unpaid');
assertEqual(decideCancellation(unpaid, [q('Waiting')], START_MS), 'unpaid', 'unpaid ignores queue state');
assertEqual(
  decideCancellation(booking({ payment_status: 'Unpaid', created_at: new Date(START_MS - 5 * 60_000).toISOString() }), [], START_MS),
  null,
  'Unpaid but only 5 min old -> not yet'
);
assertEqual(decideCancellation(booking({ payment_status: 'Paid' }), [], LATE), null, 'Paid never times out');
assertEqual(
  decideCancellation(booking({ payment_status: 'Unpaid', created_at: 'not-a-date' }), [], LATE),
  null,
  'unreadable created_at -> no unpaid cancel'
);
assertEqual(
  decideCancellation(booking({ payment_status: 'Unpaid', date: '2027-01-01', created_at: new Date(START_MS - 60 * 60_000).toISOString() }), [], START_MS),
  'unpaid',
  'unpaid ignores a far-future session date'
);

console.log('\n--- precedence ---');
assertEqual(
  decideCancellation(
    booking({ payment_status: 'Unpaid', created_at: new Date(START_MS - 60 * 60_000).toISOString() }),
    [q('Called')],
    LATE
  ),
  'no_show',
  'both apply -> reported as no_show'
);

console.log('\n--- queue matching ---');
assertEqual(normalizePhone('+966 50 456 39'), '5045639', 'strips +966 and spaces');
assertEqual(normalizePhone('050 456 39'), '5045639', 'strips leading 0');
assertEqual(normalizePhone('00966 50 456 39'), '5045639', 'strips 00966');
assertEqual(!!findQueueRow([q('Called', { phone: 'nonsense' })], booking()), true, 'booking_id wins over phone');
assertEqual(
  !!findQueueRow([q('Called', { booking_id: null, phone: '050 456 39' })], booking()),
  true,
  'falls back to normalized phone'
);
assertEqual(
  !!findQueueRow([q('Called', { booking_id: null, date: '2026-08-30' })], booking()),
  false,
  'a different day does not match'
);
assertEqual(
  !!findQueueRow([q('Called', { booking_id: null, phone: '' })], booking({ customer_phone: '' })),
  false,
  'no phone -> no false match'
);
assertEqual(
  decideCancellation(booking(), [q('Called', { booking_id: null, date: '2026-08-30' })], LATE),
  null,
  "yesterday's Called row does not cancel today's booking"
);

console.log('\n--- customer wording is reason-specific ---');
const noShowMsg = customerMessage('no_show', booking());
const unpaidMsg = customerMessage('unpaid', booking());
assertEqual(noShowMsg.includes('not refundable'), true, 'no-show states it is not refundable');
assertEqual(noShowMsg.includes('called for you'), true, 'no-show explains it was called');
assertEqual(unpaidMsg.includes('No payment was taken'), true, 'unpaid says no payment was taken');
assertEqual(unpaidMsg.includes('refund'), false, 'unpaid never mentions a refund');
assertEqual(noShowMsg === unpaidMsg, false, 'the two messages are distinct');
assertEqual(noShowMsg.includes('31 August 2026'), true, 'message names the date');
assertEqual(notificationTitle('no_show') !== notificationTitle('unpaid'), true, 'titles differ');
assertEqual(timelineAction('no_show'), 'Did not show up — auto-cancelled (System Action)', 'no-show timeline text unchanged');
assertEqual(timelineAction('unpaid'), 'Cancelled automatically due to 15-minute payment timeout', 'unpaid timeline text unchanged');
assertEqual(customerMessage('no_show', booking({ date: 'bad' })).includes('undefined'), false, 'bad date never prints undefined');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
