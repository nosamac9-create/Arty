/**
 * Utility functions for staff scheduling, availability checking, and conflict detection.
 */

import { StaffMember, WorkshopSessionRecord, AppEvent, Booking, QueueItem } from '../types';

/**
 * Normalizes date strings to YYYY-MM-DD format (e.g. 2026-7-1 -> 2026-07-01).
 */
export function normalizeDateString(d?: string | null): string {
  if (!d) return '';
  const trimmed = String(d).trim();
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const y = parts[0].padStart(4, '0');
    const m = parts[1].padStart(2, '0');
    const day = parts[2].padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return trimmed;
}

/**
 * Converts a time string like "11:00 AM", "04:30 PM", or "14:30" into minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  const isPM = cleaned.includes('PM');
  const isAM = cleaned.includes('AM');

  let hours = 0;
  let minutes = 0;

  if (isPM || isAM) {
    const raw = cleaned.replace(/[AP]M/, '').trim();
    const parts = raw.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  } else {
    const parts = cleaned.split(':');
    hours = parseInt(parts[0], 10) || 0;
    minutes = parseInt(parts[1], 10) || 0;
  }

  return hours * 60 + minutes;
}

/**
 * Calculates end time in minutes based on start time and duration string (e.g. "2.5 Hours", "2 hours").
 */
export function getEndTimeMinutes(startTimeStr: string, durationStr?: string, defaultMinutes: number = 120): number {
  const startMins = timeToMinutes(startTimeStr);
  let durMins = defaultMinutes;

  if (durationStr) {
    const match = durationStr.match(/([\d.]+)/);
    if (match) {
      const hours = parseFloat(match[1]);
      if (!isNaN(hours)) {
        durMins = Math.round(hours * 60);
      }
    }
  }

  return startMins + durMins;
}

/**
 * Formats minutes from midnight into 12-hour AM/PM string.
 */
export function minutesToTimeString(totalMinutes: number): string {
  let mins = Math.max(0, totalMinutes % (24 * 60));
  let hours = Math.floor(mins / 60);
  const m = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hours}:${mStr} ${period}`;
}

export interface StaffAvailabilityResult {
  isAvailable: boolean;
  status: 'Available' | 'Busy' | 'Outside working hours' | 'On Leave' | 'Already assigned';
  reason?: string;
  conflictDetails?: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Checks whether a staff member is available at a specified date and time range.
 */
export function checkStaffMemberAvailability(
  staff: StaffMember,
  dateStr: string, // YYYY-MM-DD
  startTimeStr: string,
  endTimeStr?: string,
  durationStr?: string,
  existingSessions: WorkshopSessionRecord[] = [],
  existingEvents: AppEvent[] = [],
  existingBookings: Booking[] = [],
  allWorkshops: any[] = [],
  excludeSessionId?: string,
  excludeWorkshopId?: string
): StaffAvailabilityResult {
  if (!staff) {
    return { isAvailable: false, status: 'Outside working hours', reason: 'No staff member selected' };
  }

  const targetDate = normalizeDateString(dateStr);

  // 1. Check if staff is active
  if (staff.status === 'Inactive' || staff.status === 'Former Staff') {
    return { isAvailable: false, status: 'Outside working hours', reason: `${staff.name} is currently ${staff.status}` };
  }

  // 2. Check Leave Status
  if (staff.status === 'On Leave') {
    return { isAvailable: false, status: 'On Leave', reason: `${staff.name} is currently on leave` };
  }

  // Check approved time-off requests
  if (staff.timeOff && staff.timeOff.length > 0) {
    const activeLeave = staff.timeOff.find(
      to => to.status === 'Approved' && targetDate >= normalizeDateString(to.startDate) && targetDate <= normalizeDateString(to.endDate)
    );
    if (activeLeave) {
      return { 
        isAvailable: false, 
        status: 'On Leave', 
        reason: `${staff.name} is on leave: ${activeLeave.reason} (${activeLeave.startDate} to ${activeLeave.endDate})` 
      };
    }
  }

  // 3. Check Weekly Working Schedule
  const dateParts = targetDate.split('-').map(Number);
  const dateObj = (dateParts.length === 3 && !isNaN(dateParts[0]))
    ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
    : new Date(targetDate);
  const dayName = DAY_NAMES[dateObj.getDay()];
  const propStart = timeToMinutes(startTimeStr);
  const propEnd = endTimeStr ? timeToMinutes(endTimeStr) : getEndTimeMinutes(startTimeStr, durationStr);

  // If weekly schedule is specified and has an entry for dayName, check working flag & hours; otherwise default to working 08:00 AM - 11:59 PM
  const shift = staff.weeklySchedule?.[dayName];
  if (shift) {
    if (!shift.isWorking) {
      return { 
        isAvailable: false, 
        status: 'Outside working hours', 
        reason: `${staff.name} has no working hours scheduled on ${dayName}s` 
      };
    }

    const shiftStart = timeToMinutes(shift.startTime || '08:00 AM');
    const shiftEnd = timeToMinutes(shift.endTime || '11:59 PM');

    if (propStart < shiftStart || propEnd > shiftEnd) {
      return { 
        isAvailable: false, 
        status: 'Outside working hours', 
        reason: `Working hours for ${staff.name} on ${dayName} are ${shift.startTime} – ${shift.endTime}` 
      };
    }

    // Check breaks
    if (shift.breakStart && shift.breakEnd) {
      const bStart = timeToMinutes(shift.breakStart);
      const bEnd = timeToMinutes(shift.breakEnd);
      if (propStart < bEnd && propEnd > bStart) {
        return { isAvailable: false, status: 'Busy', reason: `${staff.name} is on break (${shift.breakStart} – ${shift.breakEnd})` };
      }
    }
  }

  const staffNameLower = (staff.name || '').trim().toLowerCase();
  const staffId = staff.id;

  // 4. Normalize Workshop Sessions before checking
  const sessionList: Array<{
    id: string;
    workshopId?: string;
    date: string;
    startTime: string;
    endTime?: string;
    duration?: string;
    instructor?: string;
    staffId?: string;
    title?: string;
    status?: string;
  }> = [];

  // Extract sessions from allWorkshops (parent workshop provides defaults)
  if (allWorkshops && allWorkshops.length > 0) {
    allWorkshops.forEach(ws => {
      const parentWsId = ws.id != null ? String(ws.id) : undefined;
      if (excludeWorkshopId && parentWsId && parentWsId === String(excludeWorkshopId)) return;

      if (ws.sessions && Array.isArray(ws.sessions)) {
        ws.sessions.forEach((sess: any) => {
          const sessId = sess.id != null ? String(sess.id) : undefined;
          if (excludeSessionId && sessId && sessId === String(excludeSessionId)) return;

          const startTime = sess.startTime || sess.time;
          if (!startTime) return; // Skip session if startTime is missing

          sessionList.push({
            id: sessId || '',
            workshopId: parentWsId,
            date: sess.date,
            startTime,
            endTime: sess.endTime,
            duration: sess.duration || ws.duration,
            instructor: sess.instructor || ws.instructor || '',
            staffId: sess.staffId || ws.staffId,
            title: ws.title || 'Workshop Session',
            status: sess.status ?? ws.status ?? 'Published'
          });
        });
      }
    });
  }

  // Include standalone existingSessions if provided
  if (existingSessions && existingSessions.length > 0) {
    existingSessions.forEach((s: any) => {
      const sWsId = s.workshopId != null ? String(s.workshopId) : undefined;
      if (excludeWorkshopId && sWsId && sWsId === String(excludeWorkshopId)) return;

      const sId = s.id != null ? String(s.id) : undefined;
      if (excludeSessionId && sId && sId === String(excludeSessionId)) return;

      const startTime = s.startTime || s.time;
      if (!startTime) return; // Skip session if startTime is missing

      sessionList.push({
        id: sId || '',
        workshopId: sWsId,
        date: s.date,
        startTime,
        endTime: s.endTime,
        duration: s.duration,
        instructor: s.instructor || '',
        staffId: s.staffId,
        title: s.title || s.workshopTitle || 'Workshop Session',
        status: s.status ?? 'Published'
      });
    });
  }

  for (const sess of sessionList) {
    if (excludeSessionId && sess.id && String(sess.id) === String(excludeSessionId)) continue;
    if (excludeWorkshopId && sess.workshopId && String(sess.workshopId) === String(excludeWorkshopId)) continue;

    const sessDateNorm = normalizeDateString(sess.date);
    const sessStatus = sess.status || 'Published';

    if (
      sessDateNorm === targetDate &&
      sessStatus !== 'Cancelled' &&
      sessStatus !== 'Unavailable' &&
      sessStatus !== 'Archived'
    ) {
      const sessStaffId = sess.staffId != null ? String(sess.staffId) : undefined;
      const sessInst = (sess.instructor || '').trim().toLowerCase();

      // MATCH ASSIGNMENT ROBUSTLY:
      // Treat as assigned if EITHER staffId equals staff.id, OR instructor matches staff.name.
      // Guard against empty strings so blank instructor never matches everyone.
      const isAssigned =
        (sessStaffId && sessStaffId === staffId) ||
        (staffNameLower.length > 0 && sessInst.length > 0 && sessInst === staffNameLower);

      if (isAssigned) {
        if (!sess.startTime) continue;
        const sessStart = timeToMinutes(sess.startTime);
        const sessEnd = sess.endTime
          ? timeToMinutes(sess.endTime)
          : getEndTimeMinutes(sess.startTime, sess.duration);

        // Overlap formula: proposedStart < existingEnd AND proposedEnd > existingStart
        if (propStart < sessEnd && propEnd > sessStart) {
          const startTimeFormatted = minutesToTimeString(sessStart);
          const endTimeFormatted = minutesToTimeString(sessEnd);
          const title = sess.title || 'another workshop session';
          return {
            isAvailable: false,
            status: 'Busy',
            reason: `${staff.name} is already assigned to ${title} from ${startTimeFormatted} to ${endTimeFormatted}`,
            conflictDetails: `${title}, ${startTimeFormatted}–${endTimeFormatted}`
          };
        }
      }
    }
  }

  // 5. Check overlapping Events assigned to staff
  for (const evt of existingEvents) {
    const evtStatus = evt.status || 'Published';
    const evtDateNorm = normalizeDateString(evt.date);

    if (
      evtDateNorm === targetDate &&
      evtStatus !== 'Cancelled' &&
      evtStatus !== 'Archived'
    ) {
      const evtStaffId = evt.staffId != null ? String(evt.staffId) : undefined;
      const hostLower = (evt.host || '').trim().toLowerCase();

      const isAssigned =
        (evtStaffId && evtStaffId === staffId) ||
        (staffNameLower.length > 0 && hostLower.length > 0 && hostLower === staffNameLower);

      if (isAssigned) {
        if (!evt.startTime) continue;
        const evtStart = timeToMinutes(evt.startTime);
        const evtEnd = getEndTimeMinutes(evt.startTime, evt.duration);

        if (propStart < evtEnd && propEnd > evtStart) {
          const startTimeFormatted = minutesToTimeString(evtStart);
          const endTimeFormatted = minutesToTimeString(evtEnd);
          return {
            isAvailable: false,
            status: 'Busy',
            reason: `${staff.name} is already assigned to event "${evt.title}" from ${startTimeFormatted} to ${endTimeFormatted}`,
            conflictDetails: `Event: ${evt.title} (${evtDateNorm} ${startTimeFormatted} – ${endTimeFormatted})`
          };
        }
      }
    }
  }

  return { isAvailable: true, status: 'Available' };
}

