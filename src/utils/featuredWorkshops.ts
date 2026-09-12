/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Which workshops the home page features this week.
 *
 * Everything here is derived from records that already exist — workshops,
 * workshop sessions and bookings. No new table, no stored popularity column,
 * no second availability system: eligibility uses the seat counts supplied by
 * the caller, from the same database function every other page reads,
 * the same seat maths the workshop cards and the walk-in queue run on, and
 * "still counts" is applied by workshop_recent_bookings (migration 0024),
 * which mirrors `isActiveBookingRecord`.
 *
 * Kept out of the component so the aggregation runs once per data change
 * rather than per render, and so the rules can be read without the markup.
 */

import { Workshop, WorkshopSessionRecord } from '../types';
import { normalizeDateString, timeToMinutes } from './timeUtils';

/** The carousel never shows more than this, however many qualify. */
export const FEATURED_WORKSHOPS_MAX = 3;

/**
 * How far past this Saturday the second tier reaches when the week alone cannot
 * fill the row. Two weeks: far enough to cover a quiet stretch, near enough that
 * "featured" still means something a customer could act on soon.
 */
const FALLBACK_EXTRA_DAYS = 14;

/**
 * "This week" is the real calendar week, Sunday to Saturday — the convention
 * the console's own This Week filters already use (AdminBookingsSection's
 * booking filter and AdminStaffSection's schedule both take Sunday as day
 * zero). A workshop running Monday is next week's, not this week's, even
 * though it falls inside the next seven days.
 */
const WEEK_STARTS_ON = 0; // Sunday, matching JS getDay()/getUTCDay().

/** Rolling, so the ranking never resets on the 1st of the month. */
const RANKING_WINDOW_DAYS = 30;

export interface FeaturedWorkshopsSources {
  workshops: Workshop[];
  workshopSessions: WorkshopSessionRecord[];
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

/** Day of the week for a calendar date, read in UTC for the same reason. */
function weekdayOf(dateStr: string): number {
  const [year, month, day] = normalizeDateString(dateStr).split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
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
/**
 * The trailing popularity window, in Riyadh dates.
 *
 * Exported so the caller can ask the database for exactly the window the
 * ranking is about to apply — the bounds and the ranking must not drift.
 */
export function recentBookingsWindow(todayDateStr: string): { from: string; to: string } {
  const today = normalizeDateString(todayDateStr);
  // Inclusive of today, so a 30-day window is today minus 29.
  return { from: addDays(today, -(RANKING_WINDOW_DAYS - 1)), to: today };
}

export function selectFeaturedWorkshops(
  sources: FeaturedWorkshopsSources,
  todayDateStr: string,
  limit: number = FEATURED_WORKSHOPS_MAX,
  /**
   * Seats for one session, or undefined when the count is not known.
   *
   * Eligibility must not be decided by summing the caller's own bookings: on
   * the public site that array is RLS-scoped, so every session looked empty and
   * a fully-booked workshop could be featured. Backed by
   * session_seats_summary. Omitted only by tests that supply no seat source, in
   * which case sessions are treated as available.
   */
  getSeats: (sessionId: string) => { seatsRemaining: number } | undefined = () => undefined,
  /**
   * Bookings this workshop took over the trailing window, or undefined when the
   * counts have not arrived.
   *
   * Counting from a bookings array was the bug: on the public site that array
   * is RLS-scoped, so every workshop scored zero and the ranking fell through
   * to its tie-breakers. Backed by workshop_recent_bookings (migration 0024).
   */
  getRecentBookings: (workshopId: string) => number | undefined = () => undefined
): Workshop[] {
  const { workshops, workshopSessions } = sources;

  const today = normalizeDateString(todayDateStr);
  // Saturday of the week today falls in. The lower bound of the search stays
  // `today` regardless, since a session earlier this week has already run.
  const weekEnd = addDays(today, 6 - ((weekdayOf(today) - WEEK_STARTS_ON + 7) % 7));

  /** The same visibility rule the rest of the customer site applies. */
  const isVisible = (workshop: Workshop) =>
    workshop.status !== 'Draft' && workshop.status !== 'Archived';

  const recentFor = (workshop: Workshop) => getRecentBookings(String(workshop.id)) ?? 0;

  /**
   * The soonest session this workshop has inside [today, windowEnd] that is
   * published and not known to be full, as a sort stamp. Null when it has none.
   *
   * A session whose seat count has not arrived is treated as available: with-
   * holding a workshop on the strength of a number still in flight hides a
   * class that has seats, which is the more costly mistake here.
   */
  const soonestSession = (workshop: Workshop, windowEnd: string): number | null => {
    let soonest = Number.POSITIVE_INFINITY;

    for (const session of workshopSessions) {
      if (String(session.workshopId) !== String(workshop.id)) continue;
      if ((session.status || 'Published') !== 'Published') continue;

      const date = normalizeDateString(session.date);
      if (date < today || date > windowEnd) continue;

      const seats = getSeats(String(session.id));
      if (seats && seats.seatsRemaining <= 0) continue;

      // Sort key rather than a real timestamp: same-day sessions still order by
      // start time, and a session with no time sorts after ones that have it.
      const stamp = Number(date.replace(/-/g, '')) * 10_000 +
        (session.startTime ? timeToMinutes(session.startTime) : 9_999);
      if (stamp < soonest) soonest = stamp;
    }

    return soonest === Number.POSITIVE_INFINITY ? null : soonest;
  };

  // Most booked first, then whichever runs sooner, then source order — every
  // key is derived from the data, so the sequence cannot shift between renders
  // on identical records.
  const byRank = (a: Ranked, b: Ranked) =>
    b.recentBookings - a.recentBookings ||
    a.nextSession - b.nextSession ||
    a.order - b.order;

  const picked: Workshop[] = [];
  const taken = new Set<string>();

  const take = (entries: Ranked[]) => {
    for (const entry of entries) {
      if (picked.length >= limit) return;
      picked.push(entry.workshop);
      taken.add(String(entry.workshop.id));
    }
  };

  /** Workshops with a qualifying session inside the window, minus any already taken. */
  const tier = (windowEnd: string): Ranked[] => {
    const out: Ranked[] = [];
    workshops.forEach((workshop, order) => {
      if (!isVisible(workshop) || taken.has(String(workshop.id))) return;
      const nextSession = soonestSession(workshop, windowEnd);
      if (nextSession === null) return;
      out.push({ workshop, recentBookings: recentFor(workshop), nextSession, order });
    });
    return out.sort(byRank);
  };

  // TIER 1 — this week, the strict criteria. These still decide ORDER: anything
  // qualifying here ranks above everything below, whatever its booking count.
  take(tier(weekEnd));

  // TIER 2 — the same rules over a wider window. The row used to be allowed to
  // come up short, which on a Friday or Saturday meant a one- or two-day window
  // and, for a studio running Sunday to Thursday, an empty carousel every
  // weekend under a heading that had already rendered.
  if (picked.length < limit) take(tier(addDays(weekEnd, FALLBACK_EXTRA_DAYS)));

  // TIER 3 — any visible workshop, ranked by demand alone, ignoring sessions
  // entirely. Something to show beats a heading with nothing under it; these sit
  // last precisely because they meet none of the criteria above.
  if (picked.length < limit) {
    const rest: Ranked[] = [];
    workshops.forEach((workshop, order) => {
      if (!isVisible(workshop) || taken.has(String(workshop.id))) return;
      rest.push({
        workshop,
        recentBookings: recentFor(workshop),
        nextSession: Number.POSITIVE_INFINITY,
        order
      });
    });
    rest.sort((a, b) => b.recentBookings - a.recentBookings || a.order - b.order);
    take(rest);
  }

  // Fewer than `limit` only when the studio genuinely has fewer visible
  // workshops than that. Nothing left to fall back to.
  return picked;
}
