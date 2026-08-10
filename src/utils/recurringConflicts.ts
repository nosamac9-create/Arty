/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Conflict detection for monthly recurring schedule rules.
 *
 * A rule is not a single date — it generates a session on every matching weekday
 * inside its effective window. A rule is only safe to save if *every* session it
 * will generate is free for both the instructor and the studio space, checked
 * against the shared session calendar (all workshops, all other rules, one-time
 * sessions and exceptions), plus events, birthdays, appointments, breaks and leave.
 */

import { RecurringScheduleRule, Workshop, StaffMember, WorkshopSessionRecord } from '../types';
import { getRiyadhDateString, getRelativeRiyadhDateStr } from './dateUtils';
import { normalizeDateString, timeToMinutes, getEndTimeMinutes, minutesToTimeString } from './timeUtils';
import { WEEKDAY_NAMES, MONTH_NAMES } from './calendarConfig';
import { checkStaffMemberAvailability, StaffAvailabilityResult } from './staffAvailabilityUtils';
import { AssignmentSources, AssignmentExclusion } from './staffAssignments';
import {
  StudioSpace, SpaceSources, SpaceExclusion, checkSpaceAvailability, SpaceAvailabilityResult
} from './spaceAvailability';

/** How far ahead an open-ended rule is checked, matching session generation. */
export const DEFAULT_HORIZON_MONTHS = 3;

export interface GeneratedSlot {
  date: string; // YYYY-MM-DD
  dayName: string;
  startTime: string;
  endTime?: string;
  duration?: string;
}

/** "Tuesday, 18 August" — English Gregorian, for conflict messages. */
export function formatSlotDate(dateStr: string): string {
  const [y, m, d] = normalizeDateString(dateStr).split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dayName = WEEKDAY_NAMES[new Date(y, m - 1, d).getDay()];
  return `${dayName}, ${d} ${MONTH_NAMES[m - 1]}`;
}

/**
 * Every date/time slot a rule will generate, from its effective start (or today,
 * whichever is later) to its effective end (or the horizon).
 */
export function getRuleSlots(
  rule: RecurringScheduleRule,
  workshop: Pick<Workshop, 'duration'> | undefined,
  horizonMonths: number = DEFAULT_HORIZON_MONTHS
): GeneratedSlot[] {
  if (!rule || !rule.startTime) return [];
  if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) return [];

  const today = getRiyadhDateString();
  const start = normalizeDateString(rule.effectiveStartDate) > today
    ? normalizeDateString(rule.effectiveStartDate)
    : today;

  const horizonEnd = getRelativeRiyadhDateStr(horizonMonths * 31);
  const end = rule.effectiveEndDate && normalizeDateString(rule.effectiveEndDate) < horizonEnd
    ? normalizeDateString(rule.effectiveEndDate)
    : horizonEnd;

  if (!start || !end || start > end) return [];

  const slots: GeneratedSlot[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const cursor = new Date(sy, sm - 1, sd);

  // Hard stop so a malformed range can never loop away.
  for (let guard = 0; guard < 400; guard++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (iso > end) break;

    const dayName = WEEKDAY_NAMES[cursor.getDay()];
    if (rule.daysOfWeek.includes(dayName)) {
      slots.push({
        date: iso,
        dayName,
        startTime: rule.startTime,
        endTime: rule.endTime,
        duration: rule.duration || workshop?.duration
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

export interface RuleConflict {
  kind: 'staff' | 'space';
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  /** Ready-to-show sentence naming the date, time and clashing activity. */
  message: string;
  staffResult?: StaffAvailabilityResult;
  spaceResult?: SpaceAvailabilityResult;
}

export interface RuleConflictInput {
  rule: RecurringScheduleRule;
  workshop?: Pick<Workshop, 'duration'>;
  staff?: StaffMember | null;
  space?: StudioSpace | null;
  assignmentSources: AssignmentSources;
  spaceSources: SpaceSources;
  assignmentExclusion?: AssignmentExclusion;
  spaceExclusion?: SpaceExclusion;
  horizonMonths?: number;
  /**
   * Sessions this rule already generated. They are excluded so a saved rule does
   * not report a conflict with itself.
   */
  ownSessions?: WorkshopSessionRecord[];
}

/**
 * Scans every slot a rule generates. Returns the first real conflict, or null.
 */
export function findRuleConflict(input: RuleConflictInput): RuleConflict | null {
  const {
    rule, workshop, staff, space,
    assignmentSources, spaceSources,
    assignmentExclusion, spaceExclusion,
    horizonMonths, ownSessions = []
  } = input;

  const slots = getRuleSlots(rule, workshop, horizonMonths);
  if (slots.length === 0) return null;

  // A rule never conflicts with the sessions it produced itself.
  const ownSessionIds = ownSessions
    .filter(s => s.ruleId && String(s.ruleId) === String(rule.id))
    .map(s => String(s.id));

  const staffExclude: AssignmentExclusion = {
    ...assignmentExclusion,
    sessionIds: [...(assignmentExclusion?.sessionIds || []), ...ownSessionIds]
  };
  const roomExclude: SpaceExclusion = {
    ...spaceExclusion,
    sessionIds: [...(spaceExclusion?.sessionIds || []), ...ownSessionIds]
  };

  for (const slot of slots) {
    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = slot.endTime
      ? timeToMinutes(slot.endTime)
      : getEndTimeMinutes(slot.startTime, slot.duration);
    const startLabel = minutesToTimeString(startMinutes);
    const endLabel = minutesToTimeString(endMinutes);

    if (staff) {
      const result = checkStaffMemberAvailability({
        staff,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        sources: assignmentSources,
        exclude: staffExclude
      });

      if (!result.isAvailable) {
        return {
          kind: 'staff',
          date: slot.date,
          dayName: slot.dayName,
          startTime: startLabel,
          endTime: endLabel,
          message: result.conflict
            ? `${staff.name} is unavailable on ${formatSlotDate(slot.date)}, from ${startLabel} to ${endLabel}, because ${staff.name} is assigned to ${result.conflict.title}.`
            : `${staff.name} is unavailable on ${formatSlotDate(slot.date)}, from ${startLabel} to ${endLabel}: ${result.reason || 'scheduling conflict'}.`,
          staffResult: result
        };
      }
    }

    if (space) {
      const result = checkSpaceAvailability({
        space,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        duration: slot.duration,
        sources: spaceSources,
        exclude: roomExclude
      });

      if (!result.isAvailable) {
        return {
          kind: 'space',
          date: slot.date,
          dayName: slot.dayName,
          startTime: startLabel,
          endTime: endLabel,
          message: result.status === 'Busy'
            ? `${space.name} is unavailable on ${formatSlotDate(slot.date)}, from ${startLabel} to ${endLabel}: ${result.conflictDetails}.`
            : `${space.name} is ${result.status.toLowerCase()} and cannot be booked.`,
          spaceResult: result
        };
      }
    }
  }

  return null;
}

/** Checks every rule on a workshop. Returns the first conflict across all of them. */
export function findConflictAcrossRules(
  rules: RecurringScheduleRule[],
  resolve: (rule: RecurringScheduleRule) => Omit<RuleConflictInput, 'rule'>
): { rule: RecurringScheduleRule; conflict: RuleConflict } | null {
  for (const rule of rules) {
    if (rule.status !== 'Active') continue;
    const conflict = findRuleConflict({ rule, ...resolve(rule) });
    if (conflict) return { rule, conflict };
  }
  return null;
}
