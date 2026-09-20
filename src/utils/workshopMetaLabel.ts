import type { Lang } from '../context/LanguageContext';

/**
 * Arabic display text for a workshop's Duration and Age Range.
 *
 * Both are picked from staff-managed lists (Settings → Workshop Detail Lists) and stored as the
 * English list string. DISPLAY ONLY: the stored string is what timeUtils.getEndTimeMinutes and
 * BookingConfirmationSection parse for end times and calendar entries, so these functions must
 * never feed a parse, a comparison, a key or a stored value. Anything not recognised — a custom
 * option staff added or reworded — comes back exactly as stored.
 */
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const AGE_RANGE_AR: Record<string, string> = {
  'all ages': 'كل الأعمار',
  '4+ years': '4 سنوات فأكثر',
  '6+ years': '6 سنوات فأكثر',
  '12+ years': '12 سنة فأكثر',
  '16+ years': '16 سنة فأكثر',
  'adults only': 'للكبار فقط'
};

/** Keyed by the numeric value, so "2 Hours", "2.0 Hours" and "2 hours" all read the same. */
const DURATION_HOURS_AR: Record<string, string> = {
  '1': 'ساعة واحدة',
  '1.5': 'ساعة ونصف',
  '2': 'ساعتان',
  '2.5': 'ساعتان ونصف',
  '3': 'ثلاث ساعات'
};
const DURATION_RE = /^(\d+(?:\.\d+)?) ?(?:hours?|hrs?|h)$/i;

export function ageRangeLabel(value: string | null | undefined, lang: Lang): string {
  const raw = value ?? '';
  if (lang !== 'ar' || !raw) return raw;
  return AGE_RANGE_AR[normalize(raw)] ?? raw;
}

export function durationLabel(value: string | null | undefined, lang: Lang): string {
  const raw = value ?? '';
  if (lang !== 'ar' || !raw) return raw;
  const m = DURATION_RE.exec(normalize(raw));
  if (!m) return raw;
  return DURATION_HOURS_AR[String(parseFloat(m[1]))] ?? raw;
}
