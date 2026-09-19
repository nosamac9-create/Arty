import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { PrePaymentPopupConfig, popupParagraphs } from '../types';

/**
 * Arabic wording for the popup text the studio ships with. The popup is
 * staff-editable (Settings → Booking Pop-up) and stored English-only, so a
 * translation is used only while a string still IS one of these defaults.
 * Edit it in Settings and the staff wording is shown as typed, never a stale
 * translation of the old text. Matched string by string — the title, each
 * message paragraph, each bullet, the checkbox and the button are each checked
 * on their own — so editing one leaves the others translated. Display only:
 * never stored, never compared for logic.
 */
const DEFAULT_POPUP_AR: Array<{ en: string; ar: string }> = [
  { en: 'Important Studio Safety & Timeline Instructions',
    ar: 'تعليمات مهمة للسلامة والجدول الزمني في الاستوديو' },
  { en: 'Please note the following studio rules before proceeding to payment.',
    ar: 'يرجى الاطلاع على قواعد الاستوديو التالية قبل المتابعة إلى الدفع.' },
  { en: 'Clay Processing Time: All pottery created in the studio takes 10 to 14 days to completely air dry, undergo bisque-firing, be hand-glazed, and fired a second time.',
    ar: 'مدة تجهيز الفخار: تستغرق جميع القطع الفخارية التي تُصنع في الاستوديو من 10 إلى 14 يومًا لتجف تمامًا، ثم تخضع للحرق الأول، وتُزجَّج يدويًا، وتُحرق مرة ثانية.' },
  { en: 'Live Tracker: Once booked, your piece will appear in your "My Pieces" collection tracker where you can track its lifecycle stages.',
    ar: 'المتابعة المباشرة: بعد الحجز ستظهر قطعتك في متتبع «أعمالي» حيث يمكنك متابعة مراحلها.' },
  { en: 'Safety Attire: We recommend wearing clothes you do not mind getting a little clay on (although aprons are provided!).',
    ar: 'ملابس مناسبة: نوصي بارتداء ملابس لا تمانع أن يصيبها بعض الطين (علمًا بأن المآزر متوفرة!).' },
  { en: 'Storage Window: Your finished pieces will be held at our collection shelves for up to 30 days post-firing.',
    ar: 'مدة الحفظ: ستُحفظ قطعك المكتملة على أرفف الاستلام لدينا لمدة تصل إلى 30 يومًا بعد الحرق.' },
  { en: 'I confirm I have read these safety rules and understand the 10-14 day firing timeline.',
    ar: 'أؤكد أنني قرأت قواعد السلامة هذه وأفهم أن مدة الحرق من 10 إلى 14 يومًا.' },
  { en: 'Continue to Payment', ar: 'المتابعة إلى الدفع' }
];
const normalizeText = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

interface PrePaymentPopupProps {
  config: PrePaymentPopupConfig;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The pre-payment guidelines overlay shown on the Customer Site.
 *
 * Every value comes from Settings -> Booking Pop-up and is rendered as plain
 * text — never as markup — so nothing an admin types can inject HTML or script.
 */
export const PrePaymentPopup: React.FC<PrePaymentPopupProps> = ({ config, onConfirm, onCancel }) => {
  const [accepted, setAccepted] = useState(false);
  const { lang, t } = useLanguage();
  const blocked = config.requiredCheckbox && !accepted;
  const instructions = config.instructions.filter(line => line.trim().length > 0);

  /** Display text for one popup string. See DEFAULT_POPUP_AR. */
  const localizedPopupText = (text: string): string => {
    if (lang !== 'ar') return text;
    const known = DEFAULT_POPUP_AR.find(entry => normalizeText(entry.en) === normalizeText(text));
    return known ? known.ar : text;
  };

  // Rendered into <body>. The checkout page animates itself in, and an animated
  // ancestor keeps a transform on the element, which makes a `fixed` child
  // position against that ancestor instead of the viewport — the overlay was
  // being laid out inside the page rather than over it.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-brand-charcoal/50 backdrop-blur-xs flex items-center justify-center p-4">
      {/* Bounded to the viewport with the body scrolling inside it. overflow-hidden
          stays — it is what clips the accent bar into the rounded corner — but on
          its own it made content taller than the screen unreachable rather than
          scrollable. */}
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-brand-clay text-start animate-in zoom-in-95 duration-150 overflow-hidden flex max-h-[calc(100dvh-2rem)] flex-col">
        <div className="h-1.5 bg-brand-terracotta shrink-0" />

        <div className="p-6 sm:p-7 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-brand-terracotta/10 rounded-xl text-brand-terracotta shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold text-brand-charcoal leading-tight">
                {localizedPopupText(config.title)}
              </h3>
              <p className="text-[10px] text-brand-charcoal/50 font-bold uppercase tracking-wider mt-0.5">
                {t('Pre-Payment studio briefing', 'إحاطة الاستوديو قبل الدفع')}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t('Close', 'إغلاق')}
              // Tap area expanded by a transparent pseudo-element rather than
              // by growing the button, which would crowd the heading beside it.
              className="relative p-1.5 rounded-lg text-brand-charcoal/40 hover:bg-brand-sand cursor-pointer shrink-0 before:absolute before:-inset-2 before:content-['']"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 border-y border-brand-clay/40 py-4 max-h-[45vh] overflow-y-auto pe-1">
            {popupParagraphs(config.message).map((paragraph, i) => (
              <p key={i} className="text-xs text-brand-charcoal/80 leading-relaxed whitespace-pre-line">
                {localizedPopupText(paragraph)}
              </p>
            ))}

            {instructions.length > 0 && (
              <ul className="space-y-2 pt-0.5">
                {instructions.map((line, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-brand-charcoal/80 leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-terracotta shrink-0" />
                    <span>{localizedPopupText(line)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {config.requiredCheckbox && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                className="h-4 w-4 accent-brand-terracotta rounded mt-0.5 cursor-pointer shrink-0"
              />
              <span className="text-[11px] font-semibold text-brand-charcoal/75 leading-normal">
                {localizedPopupText(config.checkboxLabel)}
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl border border-brand-clay bg-white text-brand-charcoal/70 text-xs font-bold cursor-pointer hover:bg-brand-sand/40"
            >
              {t('Cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={onConfirm}
              className="px-5 py-2.5 rounded-xl bg-brand-terracotta text-brand-cream text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {localizedPopupText(config.buttonLabel)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
