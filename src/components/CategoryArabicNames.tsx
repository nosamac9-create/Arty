/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import type { Category } from '../types';

type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Staff-typed Arabic names for the categories that already exist.
 *
 * Deliberately narrow: the English name is what workshops are matched on
 * (workshops.category holds it as plain text), so it is shown read-only, and
 * there is no way here to rename, delete, merge or create a category. Only the
 * optional Arabic display name can be written, one row at a time.
 */
export const CategoryArabicNames: React.FC = () => {
  const { categories, updateCategoryNameAr } = useApp();
  const { t } = useLanguage();

  // What has been typed but not saved, by category id.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // The value most recently written from here, so a row stops reading "unsaved"
  // straight after Save without waiting for the realtime echo.
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, RowStatus>>({});

  const rows = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );

  const baselineOf = (cat: Category) => saved[cat.id] ?? cat.nameAr ?? '';
  const valueOf = (cat: Category) => drafts[cat.id] ?? baselineOf(cat);
  const isDirty = (cat: Category) => valueOf(cat).trim() !== baselineOf(cat);

  const saveRow = async (cat: Category) => {
    if (status[cat.id] === 'saving' || !isDirty(cat)) return;
    const next = valueOf(cat).trim();
    setStatus(s => ({ ...s, [cat.id]: 'saving' }));
    try {
      // Blank clears it to NULL, which means "show the English".
      await updateCategoryNameAr(cat.id, next || null);
      setSaved(s => ({ ...s, [cat.id]: next }));
      setDrafts(d => { const { [cat.id]: _gone, ...rest } = d; return rest; });
      setStatus(s => ({ ...s, [cat.id]: 'saved' }));
      setTimeout(
        () => setStatus(s => (s[cat.id] === 'saved' ? { ...s, [cat.id]: 'idle' } : s)),
        2000
      );
    } catch (err) {
      console.error('Could not save the Arabic category name:', err);
      setStatus(s => ({ ...s, [cat.id]: 'error' }));
    }
  };

  return (
    <div className="border-t border-brand-clay/40 pt-6 space-y-4">
      <div>
        <h3 className="font-display text-lg font-extrabold text-brand-charcoal">
          {t('Category Arabic Names', 'الأسماء العربية للفئات')}
        </h3>
        <p className="text-xs text-brand-charcoal/70 mt-1">
          {t(
            'Optional. Shown to customers browsing in Arabic; English is shown wherever a category has no Arabic name. The English name is what workshops are matched on, so it cannot be changed here.',
            'اختياري. يراه العملاء الذين يتصفحون بالعربية؛ ويظهر الاسم الإنجليزي حيثما لا يوجد اسم عربي للفئة. الاسم الإنجليزي هو ما تُطابَق عليه الورش، لذلك لا يمكن تغييره هنا.'
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-brand-charcoal/50 italic py-2">
          {t(
            'No categories yet. A category appears here once a workshop that uses it has been published or saved as a draft.',
            'لا توجد فئات بعد. تظهر الفئة هنا بعد نشر ورشة تستخدمها أو حفظها كمسودة.'
          )}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem] gap-3 px-1 text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/50">
            <span>{t('English name', 'الاسم الإنجليزي')}</span>
            <span>{t('Arabic name', 'الاسم العربي')}</span>
            <span />
          </div>

          {rows.map(cat => {
            const st = status[cat.id] ?? 'idle';
            const dirty = isDirty(cat);
            return (
              <div key={cat.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem] gap-2 sm:gap-3 items-center">
                <span className="text-sm font-bold text-brand-charcoal truncate" title={cat.name}>{cat.name}</span>

                <input
                  type="text"
                  dir="rtl"
                  lang="ar"
                  value={valueOf(cat)}
                  onChange={e => {
                    const v = e.target.value;
                    setDrafts(d => ({ ...d, [cat.id]: v }));
                    setStatus(s => ({ ...s, [cat.id]: 'idle' }));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRow(cat); } }}
                  placeholder={t('Optional Arabic name', 'اسم عربي اختياري')}
                  aria-label={t(`Arabic name for ${cat.name}`, `الاسم العربي لـ ${cat.name}`)}
                  className="w-full bg-white border border-brand-clay rounded-xl p-2.5 text-xs font-semibold text-brand-charcoal text-start"
                />

                <div className="flex items-center gap-2 sm:justify-end">
                  {st === 'saved' && !dirty ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-brand-sage">
                      <Check className="h-3.5 w-3.5" />{t('Saved', 'تم الحفظ')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!dirty || st === 'saving'}
                      onClick={() => saveRow(cat)}
                      className="px-3 py-1.5 rounded-xl bg-brand-terracotta text-brand-cream text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {st === 'saving' ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ')}
                    </button>
                  )}
                </div>

                {st === 'error' && (
                  <p className="sm:col-span-3 text-[11px] font-bold text-red-600">
                    {t('Could not save. Please try again.', 'تعذّر الحفظ. يرجى المحاولة مرة أخرى.')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
