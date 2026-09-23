import type { Lang } from '../context/LanguageContext';
import { arPieceMsg, dateAr } from './notificationText';
import { formatDate, RIYADH_TIME_ZONE } from './calendarConfig';

/**
 * Arabic SMS body for a piece status change, using the SAME wording as the bell (notificationText.ts).
 * Returns null for English or for a status that sends no SMS, so the caller keeps its existing English
 * friendlyMsg untouched. DISPLAY/SMS ONLY: nothing here is stored.
 */
const SMS_STATUSES = new Set(['Ready for Pickup', 'Broken', 'Created', 'First Burn and Colored', 'Collected']);

export function pieceSmsText(
  piece: { id: string; name: string; pieceCode?: string; expectedReadyDate?: string },
  status: string,
  lang: Lang
): string | null {
  if (lang !== 'ar' || !SMS_STATUSES.has(status)) return null;
  let date: string | undefined;
  if (status === 'Created' && piece.expectedReadyDate) {
    // Same English date formatting the in-app message uses, then converted to Arabic month names.
    const en = formatDate(piece.expectedReadyDate, { year: 'numeric', month: 'long', day: 'numeric', timeZone: RIYADH_TIME_ZONE });
    date = (en && dateAr(en)) || undefined;
  }
  return arPieceMsg(status, piece.name, piece.pieceCode || piece.id, date);
}
