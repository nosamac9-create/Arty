import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

/**
 * Saves the customer site's language on the signed-in customer's own record
 * (customers.preferred_lang), so an outgoing SMS can be sent in the language they use.
 *
 * Direct call on the customer client, not the db layer: the mapper whitelist is deliberately
 * untouched, and customers_self_update lets a customer write their own row. Runs only when the
 * value differs from the stored one, so it writes once per change. Waits until the customer's own
 * row has loaded, so it never writes before it knows the stored value. A failure is logged and
 * never retried in a loop, because the effect re-runs only when one of its inputs changes.
 */
export const PreferredLangSync: React.FC = () => {
  const { currentUser, customers } = useApp();
  const { lang } = useLanguage();

  const own = currentUser?.id ? customers.find(c => c.id === currentUser.id) : undefined;
  const stored = own?.preferredLang;

  useEffect(() => {
    if (!supabase || !own || stored === lang) return;
    supabase
      .from('customers')
      .update({ preferred_lang: lang })
      .eq('id', own.id)
      .then(({ error }) => {
        if (error) console.error('PreferredLangSync: could not save the language preference:', error.message);
      });
  }, [own?.id, stored, lang]);

  return null;
};
