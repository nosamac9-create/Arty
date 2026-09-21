import type { Lang } from '../context/LanguageContext';
import type { Workshop, BirthdayPackage } from '../types';
import { BIRTHDAY_WORKSHOP_ID } from './queueUtils';
import { localizedText } from './localizedText';

/**
 * Display text for the workshop / package title on a booking, a draft, or a pottery piece.
 *
 * DISPLAY ONLY. bookings.workshop_title (and the draft's workshopTitle) is a frozen English
 * snapshot, and code elsewhere classifies on it (e.g. includes('birthday')), so it must never be
 * replaced, compared against, or stored as the result of these functions. They only choose which
 * text to render, and fall back to the snapshot whenever there is no live Arabic to show.
 *
 * Lookups are strict: an exact id match with NO "|| workshops[0]" fallback. Showing another
 * workshop's Arabic name is worse than showing the English one.
 */

/** Arabic for the "Birthday Party" prefix of a birthday booking's stored title. */
const BIRTHDAY_PREFIX_AR = 'حفلة عيد ميلاد';

/** The literal the studio stores for a piece made outside any workshop. */
const FREESTYLE_EN = 'freestyle handbuilding';
const FREESTYLE_AR = 'التشكيل اليدوي الحر';

interface TitleSnapshot {
  workshopId: string;
  workshopTitle: string;
  birthdayDetails?: { packageId?: string };
}

export function bookingTitleLabel(
  booking: TitleSnapshot,
  workshops: Workshop[] | undefined,
  birthdayPackages: BirthdayPackage[] | undefined,
  lang: Lang
): string {
  const snapshot = booking.workshopTitle ?? '';
  if (lang !== 'ar') return snapshot;

  if (booking.workshopId === BIRTHDAY_WORKSHOP_ID) {
    const packageId = booking.birthdayDetails?.packageId;
    if (!packageId) return snapshot;
    // The FULL list: a package that is Draft or Archived is still a real record.
    const pkg = (birthdayPackages || []).find(p => p.id === packageId);
    const nameAr = pkg?.nameAr?.trim();
    // Never a mixed-language title: no Arabic name means the whole English snapshot.
    return nameAr ? `${BIRTHDAY_PREFIX_AR} — ${nameAr}` : snapshot;
  }

  const ws = (workshops || []).find(w => w.id === booking.workshopId);
  return localizedText(snapshot, ws?.titleAr, lang);
}

/** Workshop name on a pottery piece: live titleAr by id, then by name; else the stored name. */
export function pieceWorkshopLabel(
  piece: { workshopId?: string; workshopName: string },
  workshops: Workshop[] | undefined,
  lang: Lang
): string {
  const name = piece.workshopName ?? '';
  if (lang !== 'ar' || !name) return name;

  const list = workshops || [];
  const norm = (s: string) => s.trim().toLowerCase();
  // Same match My Pieces already uses for the cover photo: by id, else by title.
  const ws = (piece.workshopId ? list.find(w => w.id === piece.workshopId) : undefined)
    || list.find(w => norm(w.title) === norm(name));

  const live = localizedText(name, ws?.titleAr, lang);
  if (live !== name) return live;
  return norm(name) === FREESTYLE_EN ? FREESTYLE_AR : name;
}
