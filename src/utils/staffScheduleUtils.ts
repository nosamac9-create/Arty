/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Readers for a staff member's saved weekly schedule.
 * The schedule stored on the StaffMember record is the single source of truth:
 * nothing here invents default working hours for a staff member without one.
 */

import { StaffMember, StaffWeeklyShift, StaffDaySchedule, StaffScheduleDayEntry } from '../types';
import { WEEKDAY_NAMES } from './calendarConfig';

// Weekday names come from the shared calendar configuration.
export const WEEKDAYS = WEEKDAY_NAMES;

/** Day-of-week name for a YYYY-MM-DD string, parsed in local time. */
export function getDayName(dateStr: string): string {
  const parts = String(dateStr || '').split('-').map(Number);
  const dateObj = (parts.length === 3 && !isNaN(parts[0]))
    ? new Date(parts[0], parts[1] - 1, parts[2])
    : new Date(dateStr);
  return WEEKDAYS[dateObj.getDay()];
}

/** Normalizes a stored day entry (multi-shift or legacy single-shift) into the multi-shift shape. */
export function toDaySchedule(entry?: StaffScheduleDayEntry | null): StaffDaySchedule {
  if (!entry) return { isWorking: false, shifts: [] };

  if (Array.isArray((entry as StaffDaySchedule).shifts)) {
    const day = entry as StaffDaySchedule;
    return { isWorking: !!day.isWorking, shifts: day.shifts || [] };
  }

  // Legacy single-shift entry saved before multi-shift support.
  const legacy = entry as StaffWeeklyShift;
  return {
    isWorking: !!legacy.isWorking,
    shifts: legacy.isWorking ? [{ ...legacy, id: legacy.id || 'shift-legacy' }] : []
  };
}

/** Every working shift saved for a given weekday name. Empty when nothing is saved. */
export function getDayShifts(staff: StaffMember | null | undefined, dayName: string): StaffWeeklyShift[] {
  if (!staff?.weeklySchedule) return [];
  const day = toDaySchedule(staff.weeklySchedule[dayName]);
  if (!day.isWorking) return [];
  return day.shifts.filter(s => s && s.isWorking !== false && s.startTime && s.endTime);
}

/** Working shifts saved for a specific date. */
export function getShiftsForDate(staff: StaffMember | null | undefined, dateStr: string): StaffWeeklyShift[] {
  return getDayShifts(staff, getDayName(dateStr));
}

/** True when the staff member has at least one working shift saved on any day. */
export function hasSavedSchedule(staff: StaffMember | null | undefined): boolean {
  if (!staff?.weeklySchedule) return false;
  return WEEKDAYS.some(day => getDayShifts(staff, day).length > 0);
}

/** Number of days with at least one working shift. */
export function countScheduledDays(weeklySchedule?: Record<string, StaffScheduleDayEntry>): number {
  if (!weeklySchedule) return 0;
  return WEEKDAYS.filter(day => {
    const d = toDaySchedule(weeklySchedule[day]);
    return d.isWorking && d.shifts.length > 0;
  }).length;
}

export function createShift(partial?: Partial<StaffWeeklyShift>): StaffWeeklyShift {
  return {
    id: partial?.id || `shift-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    isWorking: true,
    startTime: partial?.startTime || '',
    endTime: partial?.endTime || '',
    breakStart: partial?.breakStart,
    breakEnd: partial?.breakEnd
  };
}
