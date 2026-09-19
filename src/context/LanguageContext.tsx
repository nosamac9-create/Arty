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
/** The console's own preference, separate from the customer site's, so choosing
 *  Arabic for the console never changes what a customer sees, and vice versa. */
const STAFF_STORAGE_KEY = 'artycafe_staff_lang';

export type LanguageScope = 'customer' | 'staff';

interface LanguageProviderProps {
  children: React.ReactNode;
  /** Defaults to 'customer', so an existing <LanguageProvider> behaves exactly as before. */
  scope?: LanguageScope;
}

/**
 * Language and direction for the customer site.
 *
 * Direction is set on <html> so the whole layout mirrors — Tailwind's logical
 * properties (ms-*, me-*, text-start) then do the work, rather than every
 * component branching on the language.
 *
 * The staff console gets its own provider (scope="staff"): its own stored
 * language, and `lang` on <html> follows that choice — but direction is ALWAYS
 * ltr and isRTL is always false, so the console's layout never mirrors.
 *
 * INVARIANT: only one provider may be mounted at a time, because both write to
 * <html>. App.tsx guarantees it (customer XOR staff branch) and gives each a
 * distinct `key` so React remounts instead of reusing one instance.
 */
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children, scope = 'customer' }) => {
  const isStaff = scope === 'staff';
  const storageKey = isStaff ? STAFF_STORAGE_KEY : STORAGE_KEY;

  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem(storageKey) as Lang) || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isStaff) {
      // Language follows the staff choice; direction never does. 'en-GB' is what
      // index.html declares, so an English console leaves <html> as it starts.
      root.lang = lang === 'ar' ? 'ar' : 'en-GB';
      root.dir = 'ltr';
      return () => {
        root.lang = 'en-GB';
        root.dir = 'ltr';
      };
    }
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    // Leaving the document mirrored behind us would break the staff console.
    return () => {
      root.lang = 'en';
      root.dir = 'ltr';
    };
  }, [lang, isStaff]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* a blocked storage must not stop the switch working for this visit */
    }
  };

  const value: LanguageContextValue = {
    lang,
    setLang,
    isRTL: !isStaff && lang === 'ar',
    t: (en, ar) => (lang === 'ar' ? ar : en)
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Anything rendered outside a provider (e.g. MigrationWarning) gets English.
    return { lang: 'en', setLang: () => {}, isRTL: false, t: (en: string) => en };
  }
  return context;
};
