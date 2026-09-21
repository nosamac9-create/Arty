import type { Lang } from '../context/LanguageContext';

/**
 * The text to show a customer for one piece of staff-written content.
 *
 * Arabic when the visitor is reading Arabic AND staff wrote an Arabic version
 * (non-null, not blank after trim); otherwise the English. See migration 0035.
 *
 * DISPLAY ONLY. Never use the result to compare, match, search, filter, or as a
 * stored snapshot (booking/piece titles) — those must keep the English value.
 */
export function localizedText(en: string, ar: string | null | undefined, lang: Lang): string {
  if (lang === 'ar' && typeof ar === 'string' && ar.trim() !== '') return ar;
  return en;
}

/**
 * The list to show for one staff-written list, standalone Arabic vs English.
 * Arabic only when the visitor reads Arabic AND the Arabic list is non-empty; otherwise the English
 * list, unchanged. Whole list or whole list, never mixed. DISPLAY ONLY (see localizedText).
 */
export function localizedList(en: string[] | undefined, ar: string[] | undefined, lang: Lang): string[] {
  if (lang === 'ar' && ar && ar.length > 0) return ar;
  return en || [];
}
