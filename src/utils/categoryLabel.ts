import type { Lang } from '../context/LanguageContext';
import type { Category } from '../types';

/**
 * Display text for a workshop category NAME.
 *
 * DISPLAY ONLY. workshops.category holds the English name as plain text and every
 * filter, dedup and comparison matches on it, so this must never feed a
 * comparison, a key, a stored value or a sort. It only decides which text to show.
 *
 * Order in Arabic: a staff-typed name_ar (categories table, migration 0036) wins;
 * otherwise a shipped default; otherwise the English name unchanged. The row is
 * found the way addCategoryIfMissing and the DB's lower(name) index find it:
 * trimmed and lower-cased.
 */
const DEFAULT_CATEGORY_AR: Record<string, string> = {
  pottery: 'الفخار',
  painting: 'الرسم',
  kids: 'الأطفال',
  couples: 'الأزواج',
  group: 'المجموعات'
};

/** The two filter chips that are UI state, never rows in the categories table. */
const CHIP_SENTINEL_AR: Record<string, string> = {
  'All': 'الكل',
  'Birthday Packages': 'باقات أعياد الميلاد'
};

const norm = (s: string) => s.trim().toLowerCase();

export function categoryLabel(
  name: string | null | undefined,
  categories: Category[] | undefined,
  lang: Lang
): string {
  const raw = name ?? '';
  if (lang !== 'ar' || !raw) return raw;

  const key = norm(raw);
  const row = (categories || []).find(c => norm(c.name || '') === key);
  if (row && typeof row.nameAr === 'string' && row.nameAr.trim() !== '') return row.nameAr;

  return DEFAULT_CATEGORY_AR[key] ?? raw;
}

/** For the filter chips only: handles the 'All' and 'Birthday Packages' sentinels, then defers. */
export function categoryChipLabel(
  chip: string,
  categories: Category[] | undefined,
  lang: Lang
): string {
  if (lang === 'ar' && CHIP_SENTINEL_AR[chip]) return CHIP_SENTINEL_AR[chip];
  return categoryLabel(chip, categories, lang);
}
