/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Date/time normalization shared by the staff scheduling, assignment and
 * availability layers. Kept separate so those modules can share it without
 * importing each other.
 */

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
  const mins = Math.max(0, totalMinutes % (24 * 60));
  let hours = Math.floor(mins / 60);
  const m = mins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;

  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hours}:${mStr} ${period}`;
}

/** Two ranges overlap when proposedStart < existingEnd AND proposedEnd > existingStart. */
export function rangesOverlap(
  proposedStart: number,
  proposedEnd: number,
  existingStart: number,
  existingEnd: number
): boolean {
  return proposedStart < existingEnd && proposedEnd > existingStart;
}
