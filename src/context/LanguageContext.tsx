/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'en' | 'ar';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** True while Arabic is selected. */
  isRTL: boolean;
  /**
   * Picks between an English and an Arabic string.
   * `t('Book Now', 'احجز الآن')`
   */
  t: (en: string, ar: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'artycafe_lang';

/**
 * Language and direction for the customer site.
 *
 * Direction is set on <html> so the whole layout mirrors — Tailwind's logical
 * properties (ms-*, me-*, text-start) then do the work, rather than every
 * component branching on the language.
 *
 * Only the customer-facing surfaces are translated; the staff console stays in
 * English, which is what the studio actually works in.
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Lang) || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    // The staff console is English-only and left-to-right; leaving the document
    // mirrored behind us would break it.
    return () => {
      root.lang = 'en';
      root.dir = 'ltr';
    };
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* a blocked storage must not stop the switch working for this visit */
    }
  };

  const value: LanguageContextValue = {
    lang,
    setLang,
    isRTL: lang === 'ar',
    t: (en, ar) => (lang === 'ar' ? ar : en)
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    // The staff console renders outside the provider; English is correct there.
    return { lang: 'en', setLang: () => {}, isRTL: false, t: (en: string) => en };
  }
  return context;
};
