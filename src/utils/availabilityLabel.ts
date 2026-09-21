import type { Lang } from '../context/LanguageContext';
import { enumLabel } from './enumLabels';

/**
 * Display text for a birthday package's Available Days / Available Times.
 *
 * DISPLAY ONLY. Both are free-typed English strings stored as typed. The times are also the live
 * slot options: they are compared with `timeOptions.includes(bookingTime)`, matched against booked
 * slots (`slotIsFull`) and stored on the booking, all against the RAW string. These functions are
 * called only at render sites and never feed a comparison, a key, an option value or stored data.
 * Anything unrecognised is returned exactly as stored.
 */
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "sunday", " Sunday " and "SUNDAY" all read الأحد; a typo or custom entry is shown as typed. */
export function dayLabel(value: string | null | undefined, lang: Lang): string {
  const raw = value ?? '';
  if (lang !== 'ar' || !raw) return raw;
  const key = normalize(raw);
  const match = DAY_NAMES.find(d => d.toLowerCase() === key);
  return match ? enumLabel('weekday', match, lang) : raw;   // reuses the existing weekday Arabic
}

/**
 * Only the AM/PM marker changes: "10:00 AM" becomes "10:00 ص", "04:00 pm" becomes "04:00 م". The digits
 * and colon are kept exactly as stored. Ranges ("10:00 AM - 12:00 PM"), 24-hour values ("16:00"),
 * words and anything else that doesn't match come back untouched.
 */
const TIME_RE = /\b(\d{1,2}(?::\d{2})?)\s*(am|pm)\b/gi;
export function timeLabel(value: string | null | undefined, lang: Lang): string {
  const raw = value ?? '';
  if (lang !== 'ar' || !raw) return raw;
  return raw.replace(TIME_RE, (_m, time: string, period: string) =>
    `${time} ${period.toLowerCase() === 'am' ? 'ص' : 'م'}`);
}
