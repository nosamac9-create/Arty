/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Staff availability and conflict detection.
 *
 * Availability is decided from the staff member's saved weekly schedule and from
 * the shared assignment records (workshop sessions, events/birthdays, queue
 * appointments) — never from generated defaults or component state.
 */

import { StaffMember } from '../types';
import {
  normalizeDateString, timeToMinutes, getEndTimeMinutes, minutesToTimeString, rangesOverlap
} from './timeUtils';
import { getShiftsForDate, getDayName, hasSavedSchedule } from './staffScheduleUtils';
import {
  AssignmentSources, AssignmentExclusion, StaffAssignment, getAssignmentsForStaff
} from './staffAssignments';

// Re-exported so existing call sites keep a single import point.
export { normalizeDateString, timeToMinutes, getEndTimeMinutes, minutesToTimeString };

export interface StaffAvailabilityResult {
  isAvailable: boolean;
  status: 'Available' | 'Busy' | 'Outside working hours' | 'On Leave' | 'No schedule set';
  reason?: string;
  conflictDetails?: string;
  /** The assignment that blocked this one, when the status is Busy. */
  conflict?: StaffAssignment;
}

export interface AvailabilityCheckInput {
  staff: StaffMember;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime?: string;
  duration?: string;
  sources: AssignmentSources;
  exclude?: AssignmentExclusion;
}

/**
 * Checks whether a staff member can take an assignment at a date and time range.
 */
export function checkStaffMemberAvailability(input: AvailabilityCheckInput): StaffAvailabilityResult {
  const { staff, sources, exclude } = input;

  if (!staff) {
    return { isAvailable: false, status: 'Outside working hours', reason: 'No staff member selected' };
  }

  const targetDate = normalizeDateString(input.date);

  // 1. Employment status
  if (staff.status === 'Inactive' || staff.status === 'Former Staff') {
    return {
      isAvailable: false,
      status: 'Outside working hours',
      reason: `${staff.name} is currently ${staff.status}`
    };
  }

  // 2. Leave
  if (staff.status === 'On Leave') {
    return { isAvailable: false, status: 'On Leave', reason: `${staff.name} is currently on leave` };
  }

  const activeLeave = staff.timeOff?.find(
    to => to.status === 'Approved'
      && targetDate >= normalizeDateString(to.startDate)
      && targetDate <= normalizeDateString(to.endDate)
  );
  if (activeLeave) {
    return {
      isAvailable: false,
      status: 'On Leave',
      reason: `${staff.name} is on leave: ${activeLeave.reason} (${activeLeave.startDate} to ${activeLeave.endDate})`
    };
  }

  const propStart = timeToMinutes(input.startTime);
  const propEnd = input.endTime
    ? timeToMinutes(input.endTime)
    : getEndTimeMinutes(input.startTime, input.duration);
  const dayName = getDayName(targetDate);

  // 3. Saved weekly schedule. No saved hours means no availability — working hours
  //    are never generated on the staff member's behalf.
  if (!hasSavedSchedule(staff)) {
    return {
      isAvailable: false,
      status: 'No schedule set',
      reason: `${staff.name} has no working hours saved. Add working hours in Staff Management first.`
    };
  }

  const shifts = getShiftsForDate(staff, targetDate);
  if (shifts.length === 0) {
    return {
      isAvailable: false,
      status: 'Outside working hours',
      reason: `${staff.name} has no working hours scheduled on ${dayName}s`
    };
  }

  const coveringShift = shifts.find(shift => {
    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    return propStart >= shiftStart && propEnd <= shiftEnd;
  });

  if (!coveringShift) {
    const ranges = shifts.map(s => `${s.startTime} – ${s.endTime}`).join(', ');
    return {
      isAvailable: false,
      status: 'Outside working hours',
      reason: `Working hours for ${staff.name} on ${dayName} are ${ranges}`
    };
  }

  // 4. Break inside the covering shift
  if (coveringShift.breakStart && coveringShift.breakEnd) {
    const breakStart = timeToMinutes(coveringShift.breakStart);
    const breakEnd = timeToMinutes(coveringShift.breakEnd);
    if (rangesOverlap(propStart, propEnd, breakStart, breakEnd)) {
      return {
        isAvailable: false,
        status: 'Busy',
        reason: `${staff.name} is on break from ${coveringShift.breakStart} to ${coveringShift.breakEnd}`,
        conflictDetails: `Break, ${coveringShift.breakStart}–${coveringShift.breakEnd}`
      };
    }
  }

  // 5. Existing assignments: workshops, events/birthdays and queue appointments.
  const assignments = getAssignmentsForStaff(staff.id, sources, exclude);
  for (const assignment of assignments) {
    if (assignment.date !== targetDate) continue;
    if (!rangesOverlap(propStart, propEnd, assignment.startMinutes, assignment.endMinutes)) continue;

    const startLabel = minutesToTimeString(assignment.startMinutes);
    const endLabel = minutesToTimeString(assignment.endMinutes);
    return {
      isAvailable: false,
      status: 'Busy',
      reason: `${staff.name} is already assigned to ${assignment.title} on ${assignment.date} from ${startLabel} to ${endLabel}`,
      conflictDetails: `${assignment.title}, ${assignment.date}, ${startLabel}–${endLabel}`,
      conflict: assignment
    };
  }

  return { isAvailable: true, status: 'Available' };
}
