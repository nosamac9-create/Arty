import type { Lang } from '../context/LanguageContext';

/**
 * Arabic display labels for the fixed values the console stores and compares.
 * DISPLAY ONLY: the stored/compared value is never changed. English mode and any
 * value not listed here come back exactly as given.
 */
const LABELS: Record<string, Record<string, string>> = {
  bookingStatus: { 'Pending': 'قيد الانتظار', 'Checked In': 'تم تسجيل الحضور', 'In Progress': 'جارٍ الآن',
                   'Completed': 'مكتمل', 'Cancelled': 'ملغى', 'Waiting': 'في الانتظار', 'Called': 'تم النداء' },
  payment:       { 'Paid': 'مدفوع', 'Unpaid': 'غير مدفوع', 'Refunded': 'مُسترد', 'Deposit Paid': 'عربون مدفوع' },
  source:        { 'Website': 'الموقع', 'Walk-in': 'زيارة مباشرة', 'Admin': 'الإدارة' },
  category:      { 'Workshops': 'الورش', 'Events/Birthdays': 'الفعاليات وأعياد الميلاد', 'Self-Guided': 'ذاتي التوجيه' },
  dateScope:     { 'Today': 'اليوم', 'Yesterday': 'أمس', 'This Week': 'هذا الأسبوع', 'All': 'كل السجل' },
  // The two walk-in modes staff choose between; stored as the queue entry's `type`.
  queueType:     { 'Without Instructor': 'بدون مدرب', 'With Instructor': 'مع مدرب' },
  // Status of a configured studio room or café table (studio_resources.status).
  resourceStatus: { 'Active': 'نشط', 'Inactive': 'غير نشط', 'Maintenance': 'قيد الصيانة' }
};

export function enumLabel(group: keyof typeof LABELS, value: string, lang: Lang): string {
  if (lang !== 'ar') return value;
  return LABELS[group]?.[value] ?? value;
}
