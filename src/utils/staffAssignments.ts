/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Builds the shared staff assignment records used by the staff profile, the staff
 * calendar, the availability selector and the conflict checker.
 *
 * There is exactly one record per real assignment and it is derived from the
 * source row itself (workshop session / event / queue item) — nothing is copied
 * into a staff-only store. Assignments are matched by staff ID; the staff name is
 * only used as a fallback for legacy rows saved before IDs were stored.
 */

import {
  StaffMember, WorkshopSessionRecord, Workshop, AppEvent, QueueItem, Booking, BirthdayPackage
} from '../types';
import { normalizeDateString, timeToMinutes, getEndTimeMinutes, minutesToTimeString } from './timeUtils';

export type StaffAssignmentType = 'Workshop Session' | 'Event' | 'Birthday' | 'Queue Duty';

export interface StaffAssignment {
  /** Stable per-source id, e.g. "workshop-session:sess-ws-1-2026-08-04-0400PM". */
  id: string;
  sourceType: 'workshop-session' | 'event' | 'booking' | 'queue';
  /** Id of the underlying record: workshop-session id, event id or queue id. */
  sourceId: string;
  workshopId?: string;
  staffId: string;
  type: StaffAssignmentType;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  location: string;
  status?: string;
}

export interface AssignmentSources {
  staff: StaffMember[];
  workshopSessions?: WorkshopSessionRecord[];
  workshops?: Workshop[];
  events?: AppEvent[];
  /** Birthday/event bookings hosted by a staff member. */
  bookings?: Booking[];
  /** Packages, so a birthday's duration is known. */
  birthdayPackages?: BirthdayPackage[];
  queue?: QueueItem[];
}

export interface AssignmentExclusion {
  /** Session ids to ignore — the sessions currently being edited. */
  sessionIds?: string[];
  /** Ignore every session belonging to this workshop (the workshop being edited). */
  workshopId?: string;
  eventIds?: string[];
  /** Booking ids to ignore — the booking currently being assigned. */
  bookingIds?: string[];
}

const INACTIVE_SESSION_STATUSES = ['Cancelled', 'Unavailable', 'Archived'];
const INACTIVE_EVENT_STATUSES = ['Cancelled', 'Archived', 'Completed'];
/** A cancelled booking releases its host. */
const INACTIVE_BOOKING_STATUSES = ['cancelled', 'auto-cancelled', 'no show', 'no-show'];

/** The same heuristic the Events page uses to classify a booking. */
export function isBirthdayBooking(booking: Booking): boolean {
  if (booking.workshopId === 'birthday-party-event') return true;
  const title = String(booking.workshopTitle || '').toLowerCase();
  return title.includes('birthday') || title.includes('party') || title.includes('package');
}

const INACTIVE_QUEUE_STATUSES = ['Cancelled', 'Completed'];

/** Resolves a record's staff ID, falling back to a name match for legacy rows. */
export function resolveStaffId(
  staff: StaffMember[],
  staffId?: string | null,
  staffName?: string | null
): string | undefined {
  if (staffId) {
    const byId = staff.find(s => s.id === String(staffId));
    if (byId) return byId.id;
  }
  const name = (staffName || '').trim().toLowerCase();
  if (!name) return undefined;
  const byName = staff.find(s => (s.name || '').trim().toLowerCase() === name);
  return byName?.id;
}

/** Current display name for a staff ID; never trusts a stored name string. */
export function resolveStaffName(
  staff: StaffMember[],
  staffId?: string | null,
  fallbackName?: string | null
): string {
  if (staffId) {
    const member = staff.find(s => s.id === String(staffId));
    if (member) return member.name;
  }
  return fallbackName || '';
}

function isExcluded(assignment: StaffAssignment, exclude?: AssignmentExclusion): boolean {
  if (!exclude) return false;
  if (assignment.sourceType === 'workshop-session') {
    if (exclude.sessionIds?.some(id => String(id) === assignment.sourceId)) return true;
    if (exclude.workshopId && assignment.workshopId && String(exclude.workshopId) === assignment.workshopId) return true;
  }
  if (assignment.sourceType === 'event' && exclude.eventIds?.some(id => String(id) === assignment.sourceId)) return true;
  if (assignment.sourceType === 'booking' && exclude.bookingIds?.some(id => String(id) === assignment.sourceId)) return true;
  return false;
}

/**
 * Builds every staff assignment, keyed by staff ID.
 */
export function buildStaffAssignmentMap(sources: AssignmentSources): Map<string, StaffAssignment[]> {
  const {
    staff, workshopSessions = [], workshops = [], events = [],
    bookings = [], birthdayPackages = [], queue = []
  } = sources;
  const map = new Map<string, StaffAssignment[]>();
  staff.forEach(s => map.set(s.id, []));

  const push = (a: StaffAssignment) => {
    const list = map.get(a.staffId) || [];
    list.push(a);
    map.set(a.staffId, list);
  };

  const workshopById = new Map(workshops.map(w => [String(w.id), w]));

  // Workshop sessions — the canonical session table is the only session source.
  workshopSessions.forEach(sess => {
    const status = sess.status || 'Published';
    if (INACTIVE_SESSION_STATUSES.includes(status)) return;

    const parent = sess.workshopId ? workshopById.get(String(sess.workshopId)) : undefined;
    const staffId = resolveStaffId(staff, sess.staffId || parent?.staffId, sess.instructor || parent?.instructor);
    if (!staffId) return;

    const startTime = sess.startTime;
    if (!startTime) return;

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = sess.endTime
      ? timeToMinutes(sess.endTime)
      : getEndTimeMinutes(startTime, sess.duration || parent?.duration);

    push({
      id: `workshop-session:${sess.id}`,
      sourceType: 'workshop-session',
      sourceId: String(sess.id),
      workshopId: sess.workshopId ? String(sess.workshopId) : undefined,
      staffId,
      type: 'Workshop Session',
      title: parent?.title || 'Workshop Session',
      date: normalizeDateString(sess.date),
      startTime,
      endTime: sess.endTime || minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
      location: parent?.room || 'Studio',
      status
    });
  });

  // Events (includes birthdays and other hosted bookings).
  events.forEach(evt => {
    const status = evt.status || 'Published';
    if (INACTIVE_EVENT_STATUSES.includes(status)) return;

    const staffId = resolveStaffId(staff, evt.staffId, evt.host);
    if (!staffId) return;
    if (!evt.startTime) return;

    const startMinutes = timeToMinutes(evt.startTime);
    const endMinutes = getEndTimeMinutes(evt.startTime, evt.duration);

    push({
      id: `event:${evt.id}`,
      sourceType: 'event',
      sourceId: String(evt.id),
      staffId,
      type: 'Event',
      title: evt.title,
      date: normalizeDateString(evt.date),
      startTime: evt.startTime,
      endTime: minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
      location: evt.location || 'The Terrace',
      status
    });
  });

  // Birthday and event bookings hosted by a staff member. These are bookings,
  // not AppEvents, so they were previously invisible to availability checks —
  // someone hosting a party read as free for an overlapping workshop.
  const packageById = new Map(birthdayPackages.map(p => [String(p.id), p]));

  bookings.forEach(booking => {
    const status = booking.status || 'Pending';
    if (INACTIVE_BOOKING_STATUSES.includes(String(status).toLowerCase())) return;
    if (!booking.staffId || !booking.time || !booking.date) return;

    const staffId = resolveStaffId(staff, booking.staffId, booking.staffName);
    if (!staffId) return;

    const pkg = booking.birthdayDetails?.packageId
      ? packageById.get(String(booking.birthdayDetails.packageId))
      : undefined;

    const startMinutes = timeToMinutes(booking.time);
    const endMinutes = getEndTimeMinutes(booking.time, pkg?.duration);

    push({
      id: `booking:${booking.id}`,
      sourceType: 'booking',
      sourceId: String(booking.id),
      staffId,
      type: isBirthdayBooking(booking) ? 'Birthday' : 'Event',
      title: pkg?.name || booking.workshopTitle || 'Event Booking',
      date: normalizeDateString(booking.date),
      startTime: booking.time,
      endTime: minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
      location: 'The Studio',
      status: String(status)
    });
  });

  // Queue duties / walk-in appointments staffed by an instructor.
  queue.forEach(item => {
    const status = item.status || 'Waiting';
    if (INACTIVE_QUEUE_STATUSES.includes(status)) return;
    if (item.type !== 'With Instructor') return;

    const staffId = resolveStaffId(staff, item.staffId, item.staffName);
    if (!staffId) return;
    if (!item.checkInTime) return;

    const startMinutes = timeToMinutes(item.checkInTime);
    const endMinutes = startMinutes + Math.round((item.hours || 1) * 60);

    push({
      id: `queue:${item.id}`,
      sourceType: 'queue',
      sourceId: String(item.id),
      staffId,
      type: 'Queue Duty',
      title: item.activity || 'Studio Appointment',
      date: normalizeDateString(item.date),
      startTime: item.checkInTime,
      endTime: minutesToTimeString(endMinutes),
      startMinutes,
      endMinutes,
      location: 'Studio Floor',
      status
    });
  });

  // Chronological order for the profile and calendar views.
  map.forEach(list => {
    list.sort((a, b) => (a.date === b.date ? a.startMinutes - b.startMinutes : a.date.localeCompare(b.date)));
  });

  return map;
}

/** Assignments for one staff member, with the records being edited excluded. */
export function getAssignmentsForStaff(
  staffId: string,
  sources: AssignmentSources,
  exclude?: AssignmentExclusion
): StaffAssignment[] {
  const all = buildStaffAssignmentMap(sources).get(staffId) || [];
  return all.filter(a => !isExcluded(a, exclude));
}

/** A staff member's assignments today or later — what "still holds" means for a status-change warning. */
export function getUpcomingAssignments(
  staffId: string,
  sources: AssignmentSources,
  todayStr: string
): StaffAssignment[] {
  return getAssignmentsForStaff(staffId, sources).filter(a => a.date >= todayStr);
}

/**
 * Warning to raise before saving a staff member as Inactive or Former Staff
 * while they still hold upcoming assignments — those sessions and events
 * would otherwise silently lose their instructor. Returns null when no
 * warning is needed. Shared by the Staff Registry save guard and STF-03 in
 * the System Health suite, so both agree on the same rule.
 */
export function describeInactiveWarning(
  previousStatus: string | undefined,
  nextStatus: string,
  held: StaffAssignment[]
): string | null {
  const takesEffect = (nextStatus === 'Inactive' || nextStatus === 'Former Staff') && previousStatus !== nextStatus;
  if (!takesEffect || held.length === 0) return null;

  const preview = held.slice(0, 3).map(a => `${a.title} on ${a.date}`).join(', ');
  const more = held.length > 3 ? `, and ${held.length - 3} more` : '';
  const noun = held.length === 1 ? 'assignment' : 'assignments';
  const pronoun = held.length === 1 ? 'it' : 'them';
  return `This staff member still holds ${held.length} upcoming ${noun}: ${preview}${more}. `
    + `Saving as ${nextStatus} will leave ${pronoun} without an instructor.`;
}
