/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live Queue helpers built on the shared records: bookings, workshop sessions,
 * staff and the queue itself. No queue-local copies of workshop or staff data.
 */

import {
  QueueItem, Booking, StaffMember, Workshop, WorkshopSessionRecord, CapacitySettingsConfig
} from '../types';
import { normalizeDateString, timeToMinutes, getEndTimeMinutes, minutesToTimeString } from './timeUtils';

export interface QueueRecordSources {
  staff: StaffMember[];
  workshopSessions: WorkshopSessionRecord[];
  workshops: Workshop[];
  bookings: Booking[];
  /** Required for capacity: walk-ins linked to a session hold seats too. */
  queue?: QueueItem[];
}

export const UNASSIGNED_INSTRUCTOR = 'Unassigned';
export const SELF_GUIDED_LABEL = 'Self-guided';

/** A queue entry is self-guided based on its saved mode, never on a displayed name. */
export function isSelfGuided(item: QueueItem): boolean {
  return item.type === 'Without Instructor';
}

/**
 * Resolves the session a queue entry belongs to, following the real relationships:
 * queue.sessionId → session, else queue.bookingId → booking.sessionId → session,
 * else the booking's workshop + date + time.
 */
export function resolveQueueSession(
  item: QueueItem,
  sources: QueueRecordSources
): WorkshopSessionRecord | undefined {
  const { workshopSessions, bookings } = sources;

  if (item.sessionId) {
    const direct = workshopSessions.find(s => String(s.id) === String(item.sessionId));
    if (direct) return direct;
  }

  const booking = item.bookingId
    ? bookings.find(b => b.id === item.bookingId)
    : undefined;

  if (booking?.sessionId) {
    const viaBooking = workshopSessions.find(s => String(s.id) === String(booking.sessionId));
    if (viaBooking) return viaBooking;
  }

  // Legacy bookings saved before sessionId existed: match on workshop + date + time.
  if (booking?.workshopId && booking.date) {
    const bookingDate = normalizeDateString(booking.date);
    const bookingStart = booking.time ? timeToMinutes(booking.time.split(' - ')[0].trim()) : null;
    return workshopSessions.find(s =>
      String(s.workshopId) === String(booking.workshopId) &&
      normalizeDateString(s.date) === bookingDate &&
      (bookingStart === null || timeToMinutes(s.startTime) === bookingStart)
    );
  }

  return undefined;
}

export interface ResolvedInstructor {
  staffId?: string;
  name: string;
  /** Where the answer came from — useful when debugging a mismatched tutor. */
  source: 'self-guided' | 'queue-staff-id' | 'session' | 'unassigned';
}

/**
 * Resolves the instructor for a queue entry from the current staff record.
 * Never falls back to a default staff member or a cached name.
 */
export function resolveQueueInstructor(
  item: QueueItem,
  sources: QueueRecordSources
): ResolvedInstructor {
  if (isSelfGuided(item)) {
    return { name: SELF_GUIDED_LABEL, source: 'self-guided' };
  }

  const { staff } = sources;

  // 1. The queue entry's own staff link.
  if (item.staffId) {
    const member = staff.find(s => s.id === item.staffId);
    if (member) return { staffId: member.id, name: member.name, source: 'queue-staff-id' };
  }

  // 2. The session this entry was booked into.
  const session = resolveQueueSession(item, sources);
  if (session?.staffId) {
    const member = staff.find(s => s.id === session.staffId);
    if (member) return { staffId: member.id, name: member.name, source: 'session' };
  }

  return { name: UNASSIGNED_INSTRUCTOR, source: 'unassigned' };
}

/** Resolves the tutor for a booking through its session. Used by the booking views. */
export function resolveBookingInstructor(
  booking: Booking,
  sources: Pick<QueueRecordSources, 'staff' | 'workshopSessions'>
): ResolvedInstructor {
  const { staff, workshopSessions } = sources;

  let session = booking.sessionId
    ? workshopSessions.find(s => String(s.id) === String(booking.sessionId))
    : undefined;

  if (!session && booking.workshopId && booking.date) {
    const bookingDate = normalizeDateString(booking.date);
    const bookingStart = booking.time ? timeToMinutes(booking.time.split(' - ')[0].trim()) : null;
    session = workshopSessions.find(s =>
      String(s.workshopId) === String(booking.workshopId) &&
      normalizeDateString(s.date) === bookingDate &&
      (bookingStart === null || timeToMinutes(s.startTime) === bookingStart)
    );
  }

  if (session?.staffId) {
    const member = staff.find(s => s.id === session!.staffId);
    if (member) return { staffId: member.id, name: member.name, source: 'session' };
  }

  return { name: UNASSIGNED_INSTRUCTOR, source: 'unassigned' };
}


/** Booking states that no longer hold a seat. */
const NON_RESERVING_BOOKING_STATUSES = ['cancelled', 'auto-cancelled', 'draft', 'no show', 'no-show'];
const NON_RESERVING_PAYMENT_STATUSES = ['failed', 'payment failed', 'declined', 'draft'];
/**
 * Queue states that no longer hold a seat. A completed visit has finished, so per
 * the session lifecycle it stops reserving capacity.
 */
const NON_RESERVING_QUEUE_STATUSES = ['cancelled', 'completed'];

export interface SessionSeatUsage {
  capacity: number;
  bookedSeats: number;
  walkInSeats: number;
  seatsTaken: number;
  remainingCapacity: number;
}

/**
 * Remaining capacity for a workshop session, from the shared records:
 *
 *   session capacity
 *   − participants in active website/admin bookings
 *   − participants in active With Instructor walk-ins linked to the session
 *
 * A walk-in that is itself linked to a booking is counted once, through the
 * booking, so the same guest can never reduce capacity twice.
 */
export function getSessionSeatUsage(
  session: WorkshopSessionRecord,
  sources: { workshops?: Workshop[]; bookings?: Booking[]; queue?: QueueItem[] }
): SessionSeatUsage {
  const { workshops = [], bookings = [], queue = [] } = sources;

  const workshop = workshops.find(w => String(w.id) === String(session.workshopId));
  const capacity = Number(session.capacity) || Number(workshop?.capacity) || 0;
  const sessionDate = normalizeDateString(session.date);
  const sessionStart = session.startTime ? timeToMinutes(session.startTime) : null;

  const belongsToSession = (sessionId?: string, workshopId?: string, date?: string, time?: string) => {
    if (sessionId && String(sessionId) === String(session.id)) return true;
    // Rows saved before sessionId existed: match workshop + date + start time.
    if (sessionId) return false;
    if (!workshopId || String(workshopId) !== String(session.workshopId)) return false;
    if (normalizeDateString(date || '') !== sessionDate) return false;
    if (sessionStart === null || !time) return false;
    return timeToMinutes(String(time).split(' - ')[0].trim()) === sessionStart;
  };

  const countedBookingIds = new Set<string>();
  let bookedSeats = 0;

  bookings.forEach(b => {
    const status = String(b.status || '').trim().toLowerCase();
    const payment = String(b.paymentStatus || '').trim().toLowerCase();
    if (NON_RESERVING_BOOKING_STATUSES.includes(status)) return;
    if (NON_RESERVING_PAYMENT_STATUSES.includes(payment)) return;
    if (!belongsToSession(b.sessionId, b.workshopId, b.date, b.time)) return;

    countedBookingIds.add(String(b.id));
    bookedSeats += Number(b.participants) || 0;
  });

  let walkInSeats = 0;

  queue.forEach(q => {
    if (q.type !== 'With Instructor') return;
    if (NON_RESERVING_QUEUE_STATUSES.includes(String(q.status || '').trim().toLowerCase())) return;
    // Already counted through its booking — never charge the seat twice.
    if (q.bookingId && countedBookingIds.has(String(q.bookingId))) return;
    if (!belongsToSession(q.sessionId, q.workshopId, q.date, q.sessionStartTime || q.checkInTime)) return;

    walkInSeats += Number(q.participants) || 0;
  });

  const seatsTaken = bookedSeats + walkInSeats;

  return {
    capacity,
    bookedSeats,
    walkInSeats,
    seatsTaken,
    remainingCapacity: Math.max(0, capacity - seatsTaken)
  };
}

export interface AvailableSessionOption {
  sessionId: string;
  workshopId: string;
  workshopTitle: string;
  startTime: string;
  endTime: string;
  duration?: string;
  instructorStaffId: string;
  instructorName: string;
  capacity: number;
  seatsTaken: number;
  remainingCapacity: number;
  label: string;
}

/**
 * Today's real, bookable workshop sessions for a With Instructor walk-in.
 * Excludes anything unpublished, cancelled, already finished, full, or without a
 * current staff member assigned.
 */
export function getTodaysAvailableSessions(
  sources: QueueRecordSources,
  todayDateStr: string,
  nowMinutes: number
): AvailableSessionOption[] {
  const { workshopSessions, workshops, bookings, staff } = sources;
  const today = normalizeDateString(todayDateStr);

  const options: AvailableSessionOption[] = [];

  for (const session of workshopSessions) {
    if (normalizeDateString(session.date) !== today) continue;
    if ((session.status || 'Published') !== 'Published') continue;
    if (!session.startTime) continue;

    const workshop = workshops.find(w => String(w.id) === String(session.workshopId));
    if (!workshop) continue;
    if (workshop.status === 'Archived' || workshop.status === 'Draft') continue;

    const startMinutes = timeToMinutes(session.startTime);
    const endMinutes = session.endTime
      ? timeToMinutes(session.endTime)
      : getEndTimeMinutes(session.startTime, session.duration || workshop.duration);

    // Already finished.
    if (endMinutes <= nowMinutes) continue;

    // Must have a current staff member assigned.
    const member = session.staffId ? staff.find(s => s.id === session.staffId) : undefined;
    if (!member) continue;

    // Capacity accounts for bookings AND walk-ins already linked to this session.
    const { capacity, seatsTaken, remainingCapacity } = getSessionSeatUsage(session, sources);
    if (remainingCapacity <= 0) continue;

    options.push({
      sessionId: String(session.id),
      workshopId: String(session.workshopId),
      workshopTitle: workshop.title,
      startTime: session.startTime,
      endTime: session.endTime || minutesToTimeString(endMinutes),
      duration: session.duration || workshop.duration,
      instructorStaffId: member.id,
      instructorName: member.name,
      capacity,
      seatsTaken,
      remainingCapacity,
      label: `${workshop.title} · ${session.startTime} · ${member.name} · ${remainingCapacity} seat${remainingCapacity === 1 ? '' : 's'} left`
    });
  }

  return options.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export interface QueueSessionPlan {
  durationHours: number;
  durationLabel: string;
  startLabel: string;
  estimatedEndTime: string;
  seatsRequired: number;
  tablesRequired: number;
  seatsRemainingAfter: number;
  tablesRemainingAfter: number;
  estimatedWaitMinutes: number;
}

export interface CapacitySnapshot {
  totalSeats: number;
  totalTables: number;
  defaultSeatsPerTable: number;
  oneGroupPerTable?: boolean;
  occupiedSeats: number;
  occupiedTables: number;
}

/**
 * Recomputes everything that depends on hours and guests: duration, estimated end
 * time, seats and tables required, remaining capacity and estimated wait.
 */
export function computeQueueSessionPlan(
  opts: {
    hours: number;
    guests: number;
    startTime: string; // "10:30 AM" — check-in or seated time
    capacity: CapacitySnapshot;
    aheadInQueue?: Array<{ hours?: number; participants?: number }>;
  }
): QueueSessionPlan {
  const hours = Math.max(0, Number(opts.hours) || 0);
  const guests = Math.max(0, Math.floor(Number(opts.guests) || 0));
  const seatsPerTable = Math.max(1, opts.capacity.defaultSeatsPerTable || 4);

  const startMinutes = timeToMinutes(opts.startTime);
  const durationMinutes = Math.round(hours * 60);

  const seatsRequired = guests;
  const tablesRequired = opts.capacity.oneGroupPerTable
    ? Math.max(1, Math.ceil(seatsRequired / seatsPerTable))
    : Math.ceil(seatsRequired / seatsPerTable);

  // Wait estimate: seats are freed by the groups ahead as their sessions end.
  const ahead = opts.aheadInQueue || [];
  const freeSeats = Math.max(0, opts.capacity.totalSeats - opts.capacity.occupiedSeats);
  let estimatedWaitMinutes = 0;
  if (seatsRequired > freeSeats && ahead.length > 0) {
    const avgSessionMinutes = Math.round(
      (ahead.reduce((sum, a) => sum + (Number(a.hours) || 1), 0) / ahead.length) * 60
    );
    estimatedWaitMinutes = avgSessionMinutes * Math.ceil(ahead.length / Math.max(1, tablesRequired));
  }

  return {
    durationHours: hours,
    durationLabel: `${hours} hour${hours === 1 ? '' : 's'}`,
    startLabel: minutesToTimeString(startMinutes),
    estimatedEndTime: minutesToTimeString(startMinutes + durationMinutes),
    seatsRequired,
    tablesRequired,
    seatsRemainingAfter: Math.max(0, opts.capacity.totalSeats - opts.capacity.occupiedSeats - seatsRequired),
    tablesRemainingAfter: Math.max(0, opts.capacity.totalTables - opts.capacity.occupiedTables - tablesRequired),
    estimatedWaitMinutes
  };
}

/** Hours and guests must be positive, finite numbers. */
export function validateHoursAndGuests(hours: unknown, guests: unknown): Record<string, string> {
  const errors: Record<string, string> = {};

  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) {
    errors.hours = 'Hours must be a positive number';
  } else if (h > 12) {
    errors.hours = 'Hours cannot exceed 12';
  }

  const g = Number(guests);
  if (!Number.isFinite(g) || g <= 0 || !Number.isInteger(g)) {
    errors.guests = 'Guests must be a whole number of at least 1';
  } else if (g > 50) {
    errors.guests = 'Guests cannot exceed 50';
  }

  return errors;
}
