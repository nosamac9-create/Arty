/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Which workshops the home page features this week.
 *
 * Everything here is derived from records that already exist — workshops,
 * workshop sessions and bookings. No new table, no stored popularity column,
 * no second availability system: eligibility reuses `getSessionSeatUsage`,
 * the same seat maths the workshop cards and the walk-in queue run on, and
 * "still counts" reuses `isActiveBookingRecord`.
 *
 * Kept out of the component so the aggregation runs once per data change
 * rather than per render, and so the rules can be read without the markup.
 */

import { Workshop, WorkshopSessionRecord, Booking, QueueItem } from '../types';
import { getSessionSeatUsage, isActiveBookingRecord } from './queueUtils';
import { normalizeDateString, timeToMinutes } from './timeUtils';

/** The carousel never shows more than this, however many qualify. */
export const FEATURED_WORKSHOPS_MAX = 4;

/**
 * "This week" is the next seven days inclusive of today, not a Sun–Sat block.
 * The project has no week-boundary helper to reuse, and a calendar week would
 * make the section empty every Friday evening for a workshop running Monday.
 */
const WEEK_LENGTH_DAYS = 7;

/** Rolling, so the ranking never resets on the 1st of the month. */
const RANKING_WINDOW_DAYS = 30;

export interface FeaturedWorkshopsSources {
  workshops: Workshop[];
  workshopSessions: WorkshopSessionRecord[];
  bookings: Booking[];
  queue?: QueueItem[];
}

/**
 * Date-string arithmetic done in UTC on purpose: the input is already a
 * Riyadh calendar date, so parsing it as UTC and stepping whole days keeps it
 * a calendar date. Going through a local `Date` would let the viewer's own
 * offset shift the window by a day.
 */
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = normalizeDateString(dateStr).split('-').map(Number);
  const stamp = Date.UTC(year, (month || 1) - 1, day || 1) + days * 86_400_000;
  return new Date(stamp).toISOString().slice(0, 10);
}

interface Ranked {
  workshop: Workshop;
  /** Active bookings in the trailing window — the primary sort key. */
  recentBookings: number;
  /** Sortable stamp of the soonest bookable session — the first tie-break. */
  nextSession: number;
  /** Position in the source array — the last, fully deterministic tie-break. */
  order: number;
}

/**
 * The workshops to feature, best first, capped at `limit`.
 *
 * A workshop qualifies only if it is visible to customers and has at least one
 * published session in the week ahead that still has a seat. Nothing is padded
 * in to reach the cap: three eligible workshops return three.
 */
export function selectFeaturedWorkshops(
  sources: FeaturedWorkshopsSources,
  todayDateStr: string,
  limit: number = FEATURED_WORKSHOPS_MAX
): Workshop[] {
  const { workshops, workshopSessions, bookings, queue = [] } = sources;

  const today = normalizeDateString(todayDateStr);
  const weekEnd = addDays(today, WEEK_LENGTH_DAYS - 1);
  // Inclusive of today, so a 30-day window is today minus 29.
  const windowStart = addDays(today, -(RANKING_WINDOW_DAYS - 1));

  const ranked: Ranked[] = [];

  workshops.forEach((workshop, order) => {
    // The same visibility rule the rest of the customer site applies.
    if (workshop.status === 'Draft' || workshop.status === 'Archived') return;

    // Eligibility: a published session inside the week that is not yet full.
    // `getSessionSeatUsage` counts bookings and linked walk-ins together, so a
    // session filled by walk-ins is correctly treated as full here too.
    let nextSession = Number.POSITIVE_INFINITY;

    for (const session of workshopSessions) {
      if (String(session.workshopId) !== String(workshop.id)) continue;
      if ((session.status || 'Published') !== 'Published') continue;

      const date = normalizeDateString(session.date);
      if (date < today || date > weekEnd) continue;

      if (getSessionSeatUsage(session, { workshops, bookings, queue }).remainingCapacity <= 0) continue;

      // Sort key rather than a real timestamp: same-day sessions still order by
      // start time, and a session with no time sorts after ones that have it.
      const stamp = Number(date.replace(/-/g, '')) * 10_000 +
        (session.startTime ? timeToMinutes(session.startTime) : 9_999);
      if (stamp < nextSession) nextSession = stamp;
    }

    if (nextSession === Number.POSITIVE_INFINITY) return;

    // Popularity: bookings that still stand, over the trailing window. Dated by
    // when the session ran, not when it was booked, so the count reflects what
    // the studio has actually been running lately.
    const recentBookings = bookings.reduce((total, booking) => {
      if (String(booking.workshopId) !== String(workshop.id)) return total;
      if (!isActiveBookingRecord(booking)) return total;
      const date = normalizeDateString(booking.date);
      if (!date || date < windowStart || date > today) return total;
      return total + 1;
    }, 0);

    ranked.push({ workshop, recentBookings, nextSession, order });
  });

  ranked.sort((a, b) =>
    // Most booked first, then whichever runs sooner, then source order — every
    // key is derived from the data, so the sequence cannot shift between
    // renders on identical records.
    b.recentBookings - a.recentBookings ||
    a.nextSession - b.nextSession ||
    a.order - b.order
  );

  return ranked.slice(0, Math.max(0, limit)).map(entry => entry.workshop);
}
