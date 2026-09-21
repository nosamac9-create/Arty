import type { Lang } from '../context/LanguageContext';
import type { NotificationItem } from '../types';
import { enumLabel } from './enumLabels';

/**
 * Arabic display text for a STAFF notification (the top-bar "Staff Activity Log").
 *
 * DISPLAY ONLY. Nothing here changes what is stored. Two writers create these rows in English:
 * AppContext.tsx notifyPieceStatusChange, and LiveQueueSection.tsx's session-timer calls to
 * addStaffNotification. Same ROUND-TRIP GUARD as notificationText.ts: the English title and message
 * are rebuilt from the extracted parts with the writers' own templates, and Arabic is returned only if
 * BOTH equal the stored text exactly. Any difference returns the stored English for both.
 */
type Input = Pick<NotificationItem, 'title' | 'message' | 'pieceId' | 'newStatus' | 'performedBy'>;
type Result = { title: string; message: string };

// ------------------------------------------------- piece status changes
const enPieceTitle = (s: string) =>
  s === 'Ready for Pickup' ? 'Piece Ready for Pickup Alert'
  : s === 'Broken' ? 'Piece Marked Broken'
  : 'Piece Status Shifted';
const arPieceTitle = (s: string) =>
  s === 'Ready for Pickup' ? 'تنبيه: القطعة جاهزة للاستلام'
  : s === 'Broken' ? 'تم تسجيل القطعة كمكسورة'
  : 'تغيّرت حالة القطعة';
const enPieceMsg = (id: string, customer: string, s: string, by: string, reason?: string) =>
  `Piece ${id} (${customer}) moved to "${s}" by ${by}.${reason ? ` Reason: ${reason}` : ''}`;

/** Same wording and rules as AdminPiecesTrackingSection's displayReason; anything staff typed is left as typed. */
const RESOLVED_REASON = /^Resolved: (Replaced|Refunded|Other)(?: — (.+))?$/;
const reasonAr = (r: string) => {
  if (r === 'Piece reported broken') return 'تم الإبلاغ عن كسر القطعة';
  if (r === 'Stage corrected backward') return 'تم تصحيح المرحلة بالرجوع';
  const m = RESOLVED_REASON.exec(r);
  return m ? `تمت التسوية: ${enumLabel('resolutionType', m[1], 'ar')}${m[2] ? ` — ${m[2]}` : ''}` : r;
};
const performerAr = (by: string) =>
  by === 'Staff' ? enumLabel('staffRole', 'Staff', 'ar') : by === 'System' ? 'النظام' : by;   // names pass through
const arPieceMsg = (id: string, customer: string, s: string, by: string, reason?: string) =>
  `القطعة ${id} (${customer}) انتقلت إلى "${enumLabel('pieceStatus', s, 'ar')}" بواسطة ${performerAr(by)}.` +
  (reason ? ` السبب: ${reasonAr(reason)}` : '');

function localizePiece(n: Input): Result | null {
  const id = n.pieceId, s = n.newStatus, by = n.performedBy;
  if (!id || !s || !by) return null;
  const prefix = `Piece ${id} (`;
  const suffix = `) moved to "${s}" by ${by}.`;
  if (!n.message.startsWith(prefix)) return null;
  const end = n.message.indexOf(suffix, prefix.length);
  if (end < 0) return null;
  const customer = n.message.slice(prefix.length, end);
  const rest = n.message.slice(end + suffix.length);
  const reason = rest === '' ? undefined : rest.startsWith(' Reason: ') ? rest.slice(' Reason: '.length) : null;
  if (reason === null) return null;
  if (enPieceMsg(id, customer, s, by, reason) !== n.message || enPieceTitle(s) !== n.title) return null;
  return { title: arPieceTitle(s), message: arPieceMsg(id, customer, s, by, reason) };
}

// ------------------------------------------------ Live Queue session timer
const Q_SELF_TITLE = '⏱ Self-guided session ended';
const Q_UP_TITLE = '⏱ Workshop session time is up';
const enSelf = (name: string, num: string, hours: string) =>
  `${name} (No. ${num}) finished their ${hours} hour session and was moved to Completed Today automatically.`;
const enUp = (name: string, num: string) =>
  `${name} (No. ${num}) has reached the end of their session. Complete the visit when the class is finished.`;
const RE_SELF = /^(.+) \(No\. (\S+)\) finished their ([\d.]*) hour session and was moved to Completed Today automatically\.$/;
const RE_UP = /^(.+) \(No\. (\S+)\) has reached the end of their session\. Complete the visit when the class is finished\.$/;

function localizeQueue(n: Input): Result | null {
  if (n.title === Q_SELF_TITLE) {
    const m = RE_SELF.exec(n.message);
    if (!m) return null;
    const [, name, num, hours] = m;
    if (enSelf(name, num, hours) !== n.message) return null;
    return {
      title: '⏱ انتهت الجلسة الذاتية',
      message: `انتهت جلسة ${name} (رقم ${num})${hours ? ` التي مدتها ${hours} ساعة` : ''}، ونُقلت تلقائيًا إلى «المكتملة اليوم».`
    };
  }
  if (n.title === Q_UP_TITLE) {
    const m = RE_UP.exec(n.message);
    if (!m) return null;
    const [, name, num] = m;
    if (enUp(name, num) !== n.message) return null;
    return {
      title: '⏱ انتهى وقت جلسة الورشة',
      message: `انتهى وقت جلسة ${name} (رقم ${num}). يرجى إكمال الزيارة عند انتهاء الورشة.`
    };
  }
  return null;
}

export function localizeStaffNotification(n: Input, lang: Lang): Result {
  const original = { title: n.title, message: n.message };
  if (lang !== 'ar') return original;
  const input = { ...n, title: n.title.normalize('NFC'), message: n.message.normalize('NFC') };
  return localizePiece(input) ?? localizeQueue(input) ?? original;
}
