/**
 * Utility for generating workshop sessions from monthly recurring schedule rules.
 * Respects Asia/Riyadh timezone and avoids duplicate sessions.
 */

import { Workshop, RecurringScheduleRule, WorkshopSessionRecord, SessionException } from '../types';
import { getRiyadhNow, getRiyadhDateString } from './dateUtils';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Generate sessions for a specific workshop and given month/year based on its recurring rules.
 */
export function generateSessionsForMonth(
  workshop: Workshop,
  year: number,
  month: number, // 1-12
  existingSessions: WorkshopSessionRecord[]
): WorkshopSessionRecord[] {
  if (!workshop.recurringSchedules || workshop.recurringSchedules.length === 0) {
    return [];
  }

  const generated: WorkshopSessionRecord[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    // Get day of week name (0 = Sunday, 1 = Monday, etc.)
    const dateObj = new Date(year, month - 1, day);
    const dayName = DAY_NAMES[dateObj.getDay()];

    // Check each active recurring schedule rule
    workshop.recurringSchedules.forEach(rule => {
      if (rule.status !== 'Active') return;
      if (!rule.daysOfWeek.includes(dayName)) return;

      // Check effective start date and end date
      if (rule.effectiveStartDate && dateStr < rule.effectiveStartDate) return;
      if (rule.effectiveEndDate && dateStr > rule.effectiveEndDate) return;

      // Check for exceptions on this date
      const exception = workshop.sessionExceptions?.find(e => e.date === dateStr);
      if (exception && (exception.type === 'cancel' || exception.type === 'unavailable')) {
        return; // Skip cancelled or unavailable exception dates
      }

      const startTime = (exception && exception.type === 'modify' && exception.startTime)
        ? exception.startTime
        : rule.startTime;

      const instructor = (exception && exception.type === 'modify' && exception.instructor)
        ? exception.instructor
        : (rule.instructor || workshop.instructor);

      const capacity = (exception && exception.type === 'modify' && exception.capacity)
        ? exception.capacity
        : (rule.capacity || workshop.capacity);

      // Deterministic key for duplicate prevention: workshopId + date + startTime
      const normalizedTime = startTime.trim().toUpperCase();
      const duplicateInExisting = existingSessions.some(
        s => s.workshopId === workshop.id && s.date === dateStr && s.startTime.trim().toUpperCase() === normalizedTime
      );

      const duplicateInGenerated = generated.some(
        s => s.workshopId === workshop.id && s.date === dateStr && s.startTime.trim().toUpperCase() === normalizedTime
      );

      if (!duplicateInExisting && !duplicateInGenerated) {
        const cleanTimeKey = startTime.replace(/[^a-zA-Z0-9]/g, '');
        generated.push({
          id: `sess-${workshop.id}-${dateStr}-${cleanTimeKey}`,
          workshopId: workshop.id,
          date: dateStr,
          startTime: startTime,
          endTime: rule.endTime,
          duration: rule.duration || workshop.duration,
          instructor: instructor,
          capacity: capacity,
          status: 'Published'
        });
      }
    });
  }

  return generated;
}

/**
 * Ensures sessions are generated for current month and next N months for all workshops.
 */
export function generateUpcomingRecurringSessions(
  workshops: Workshop[],
  existingSessions: WorkshopSessionRecord[],
  monthsCount: number = 3
): WorkshopSessionRecord[] {
  const now = getRiyadhNow();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1; // 1-12

  const allNewSessions: WorkshopSessionRecord[] = [];
  const combinedExisting = [...existingSessions];

  for (let i = 0; i < monthsCount; i++) {
    let targetYear = currentYear;
    let targetMonth = currentMonth + i;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }

    workshops.forEach(ws => {
      const monthSessions = generateSessionsForMonth(ws, targetYear, targetMonth, combinedExisting);
      allNewSessions.push(...monthSessions);
      combinedExisting.push(...monthSessions);
    });
  }

  return allNewSessions;
}
