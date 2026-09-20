import type { Lang } from '../context/LanguageContext';

/**
 * Arabic for the position titles the console ships with. Positions are staff-typed, so a translation
 * is used only while the stored text still IS one of these defaults (normalized compare); anything
 * else is shown exactly as typed. Display only: never stored, never compared.
 */
const DEFAULT_POSITION_AR: Array<{ en: string; ar: string }> = [
  { en: 'Instructor',        ar: 'مدرب' },
  { en: 'Master Instructor', ar: 'مدرب رئيسي' },
  { en: 'Lead Instructor',   ar: 'مدرب أول' },
  { en: 'Studio Manager',    ar: 'مدير الاستوديو' },
  { en: 'Assistant',         ar: 'مساعد' }
];
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function displayPosition(position: string | undefined, lang: Lang): string {
  if (!position) return '';
  if (lang !== 'ar') return position;
  return DEFAULT_POSITION_AR.find(p => norm(p.en) === norm(position))?.ar ?? position;
}
