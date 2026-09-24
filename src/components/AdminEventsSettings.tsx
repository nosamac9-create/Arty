/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  EventsSettingsConfig, BirthdayFormField, BirthdayTermsConfig,
  DEFAULT_BIRTHDAY_TERMS, renderTermsLine
} from '../types';
import {
  Save, Check, Calendar, Gift, Info, Plus, Trash2, ChevronUp, ChevronDown, ListChecks, ShieldAlert
} from 'lucide-react';
import { LineListTextarea } from './ui/LineListTextarea';
import { ContentLanguageTabs, ContentLang } from './ui/ContentLanguageTabs';
import { useLanguage } from '../context/LanguageContext';

export const AdminEventsSettings: React.FC = () => {
  const {
    updateSetting, birthdayFormFields, updateBirthdayFormFields,
    // Already provided by the shared data layer.
    appSettings: rawAppSettings
  } = useApp();
  const { lang, t } = useLanguage();
  const rawConfig = rawAppSettings.find(s => s.id === 'eventsSettings')?.value as EventsSettingsConfig | undefined;

  const [minBirthdayNoticeDays, setMinBirthdayNoticeDays] = useState<number>(rawConfig?.minBirthdayNoticeDays ?? 4);
  const [maxGuestsPerEvent, setMaxGuestsPerEvent] = useState<number>(rawConfig?.maxGuestsPerEvent ?? 30);
  const [depositPercentage, setDepositPercentage] = useState<number>(rawConfig?.depositPercentage ?? 50);
  const [cancellationNoticeDays, setCancellationNoticeDays] = useState<number>(rawConfig?.cancellationNoticeDays ?? 3);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // ---- Editable birthday terms (customer-facing) ----
  const [terms, setTerms] = useState<BirthdayTermsConfig>(rawConfig?.birthdayTerms || DEFAULT_BIRTHDAY_TERMS);
  const [termsSaved, setTermsSaved] = useState(false);
  const [termsLang, setTermsLang] = useState<ContentLang>('en');

  useEffect(() => {
    if (rawConfig?.birthdayTerms) setTerms(rawConfig.birthdayTerms);
  }, [rawConfig]);

  const handleSaveTerms = async () => {
    // A new version stamp so each acceptance records the wording agreed to.
    const updated: BirthdayTermsConfig = {
      ...terms,
      version: `${new Date().toISOString().split('T')[0]}-${Date.now().toString().slice(-4)}`,
      updatedAt: new Date().toISOString()
    };

    await updateSetting('eventsSettings', {
      ...(rawConfig || {}),
      minBirthdayNoticeDays: Number(minBirthdayNoticeDays),
      maxGuestsPerEvent: Number(maxGuestsPerEvent),
      depositPercentage: Number(depositPercentage),
      cancellationNoticeDays: Number(cancellationNoticeDays),
      birthdayTerms: updated
    });

    setTerms(updated);
    setTermsSaved(true);
    setTimeout(() => setTermsSaved(false), 2500);
  };

  // Preview follows the active tab. Mirrors the customer page: the Arabic set is
  // "present" only when its body (opening lines or supplies) has content.
  const termsArabicFilled = !!(
    terms.titleAr?.trim() || terms.suppliesIntroAr?.trim() ||
    terms.leadingItemsAr?.length || terms.suppliesAr?.length || terms.trailingItemsAr?.length
  );
  const previewIsAr = termsLang === 'ar';
  const previewArEmpty = previewIsAr && !(terms.leadingItemsAr?.length || terms.suppliesAr?.length);
  const pv = previewIsAr
    ? {
        title: terms.titleAr ?? '',
        leadingItems: terms.leadingItemsAr ?? [],
        suppliesIntro: terms.suppliesIntroAr ?? '',
        supplies: terms.suppliesAr ?? [],
        trailingItems: terms.trailingItemsAr ?? []
      }
    : terms;

  // ---- Birthday booking-form field editor (managed here only) ----
  const [fieldsSaved, setFieldsSaved] = useState(false);

  const commitFields = async (next: BirthdayFormField[]) => {
    await updateBirthdayFormFields(next.map((f, idx) => ({ ...f, order: idx })));
    setFieldsSaved(true);
    setTimeout(() => setFieldsSaved(false), 2500);
  };

  const handleFieldChange = (id: string, updates: Partial<BirthdayFormField>) => {
    commitFields(birthdayFormFields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleToggleField = (id: string) => {
    const field = birthdayFormFields.find(f => f.id === id);
    if (!field) return;
    handleFieldChange(id, { enabled: !field.enabled });
  };

  const handleMoveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= birthdayFormFields.length) return;
    const next = [...birthdayFormFields];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    commitFields(next);
  };

  const handleRemoveField = (id: string) => {
    const field = birthdayFormFields.find(f => f.id === id);
    if (!field || field.system) return;
    if (!window.confirm(t(`Remove the "${field.label}" field from the birthday booking form?`, `إزالة الحقل "${field.label}" من نموذج حجز عيد الميلاد؟`))) return;
    commitFields(birthdayFormFields.filter(f => f.id !== id));
  };

  const handleAddField = () => {
    const id = `bf-${Date.now()}`;
    commitFields([
      ...birthdayFormFields,
      {
        id,
        key: `custom_${Date.now()}`,
        label: 'New Field',
        type: 'short_text',
        required: false,
        enabled: true,
        order: birthdayFormFields.length
      }
    ]);
  };

  useEffect(() => {
    if (rawConfig) {
      if (rawConfig.minBirthdayNoticeDays !== undefined) setMinBirthdayNoticeDays(rawConfig.minBirthdayNoticeDays);
      if (rawConfig.maxGuestsPerEvent !== undefined) setMaxGuestsPerEvent(rawConfig.maxGuestsPerEvent);
      if (rawConfig.depositPercentage !== undefined) setDepositPercentage(rawConfig.depositPercentage);
      if (rawConfig.cancellationNoticeDays !== undefined) setCancellationNoticeDays(rawConfig.cancellationNoticeDays);
    }
  }, [rawConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (minBirthdayNoticeDays < 0) {
      alert(t('Notice days must be a non-negative integer.', 'يجب أن تكون أيام الإشعار عددًا صحيحًا غير سالب.'));
      return;
    }

    const updatedConfig: EventsSettingsConfig = {
      ...(rawConfig || {}),
      minBirthdayNoticeDays: Number(minBirthdayNoticeDays),
      maxGuestsPerEvent: Number(maxGuestsPerEvent),
      depositPercentage: Number(depositPercentage),
      cancellationNoticeDays: Number(cancellationNoticeDays),
      birthdayTerms: terms
    };

    await updateSetting('eventsSettings', updatedConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      {/* The page keeps the System Settings header above; this section's own
          title lives on the first card, so it is not repeated here. */}

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>{t('Events settings saved! Birthday booking form validation updated.', 'تم حفظ إعدادات الفعاليات! تم تحديث التحقق في نموذج حجز عيد الميلاد.')}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 bg-white border border-brand-clay/70 rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="border-b border-brand-clay/50 pb-3">
          <h3 className="font-display text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
            <Gift className="h-5 w-5 text-brand-terracotta" />
            <span>{t('Events & Birthday Settings', 'إعدادات الفعاليات وأعياد الميلاد')}</span>
          </h3>
          <p className="text-xs text-brand-charcoal/70 mt-1">
            {t('The booking rules the customer site enforces: notice periods, guest ceilings, deposit and cancellation window.', 'قواعد الحجز التي يطبّقها موقع العملاء: فترات الإشعار وحدود الضيوف والعربون ونافذة الإلغاء.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Min Birthday Booking Notice */}
          <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta">
              <Gift className="h-5 w-5" />
              <h3 className="font-display font-bold text-sm text-brand-charcoal">{t('Minimum Birthday Booking Notice (Days)', 'الحد الأدنى لإشعار حجز عيد الميلاد (بالأيام)')}</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              {t('Customers must pick a date at least this many days in advance when submitting a birthday package request.', 'يجب على العملاء اختيار تاريخ قبل هذا العدد من الأيام على الأقل عند تقديم طلب باقة عيد ميلاد.')}
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Notice Days', 'أيام الإشعار')}</label>
              <input
                type="number"
                min={0}
                required
                value={minBirthdayNoticeDays}
                onChange={e => setMinBirthdayNoticeDays(parseInt(e.target.value) || 0)}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
              />
            </div>
          </div>

          {/* Max Guests Per Event */}
          <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta">
              <Calendar className="h-5 w-5" />
              <h3 className="font-display font-bold text-sm text-brand-charcoal font-display">{t('Maximum Guests Per Private Event', 'الحد الأقصى للضيوف لكل فعالية خاصة')}</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              {t('Upper guest limit allowed per private event package reservation.', 'الحد الأعلى لعدد الضيوف المسموح به في كل حجز باقة فعالية خاصة.')}
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Max Guests', 'الحد الأقصى للضيوف')}</label>
              <input
                type="number"
                min={1}
                required
                value={maxGuestsPerEvent}
                onChange={e => setMaxGuestsPerEvent(parseInt(e.target.value) || 1)}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
              />
            </div>
          </div>

          {/* Deposit Percentage */}
          <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta">
              <Info className="h-5 w-5" />
              <h3 className="font-display font-bold text-sm text-brand-charcoal">{t('Event Reservation Deposit (%)', 'عربون حجز الفعالية (%)')}</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              {t('Required deposit percentage for private event confirmations.', 'نسبة العربون المطلوبة لتأكيد الفعاليات الخاصة.')}
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Deposit (%)', 'العربون (%)')}</label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={depositPercentage}
                onChange={e => setDepositPercentage(parseInt(e.target.value) || 0)}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
              />
            </div>
          </div>

          {/* Cancellation Notice Days */}
          <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta">
              <Calendar className="h-5 w-5" />
              <h3 className="font-display font-bold text-sm text-brand-charcoal font-display">{t('Cancellation Notice Window (Days)', 'نافذة إشعار الإلغاء (بالأيام)')}</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              {t('Minimum notice required for full deposit refund upon cancellation.', 'الحد الأدنى للإشعار المطلوب لاسترداد العربون كاملًا عند الإلغاء.')}
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Cancellation Window (Days)', 'نافذة الإلغاء (بالأيام)')}</label>
              <input
                type="number"
                min={0}
                required
                value={cancellationNoticeDays}
                onChange={e => setCancellationNoticeDays(parseInt(e.target.value) || 0)}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
              />
            </div>
          </div>

        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{t('Save Events Settings', 'حفظ إعدادات الفعاليات')}</span>
          </button>
        </div>
      </form>


      {/* ================================================================= */}
      {/* BIRTHDAY TERMS & GUIDELINES — the customer-facing text, editable   */}
      {/* here rather than hardcoded on the Customer Site.                   */}
      {/* ================================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand-terracotta" />
              <span>{t('Birthday Terms & Guidelines', 'شروط وإرشادات أعياد الميلاد')}</span>
            </h3>
            <p className="text-xs text-brand-charcoal/70 mt-1">
              {lang === 'ar'
                ? <>تُعرض للعميل قبل تقديم حجز عيد الميلاد، ويجب أن يوافق عليها. استخدم <span className="font-mono font-bold">{'{deposit}'}</span> و<span className="font-mono font-bold">{'{cancellationDays}'}</span> ليتبع النص القيم المضبوطة بدل الأرقام الثابتة.</>
                : <>Shown to the customer before they submit a birthday reservation, and they must accept it. Use <span className="font-mono font-bold">{'{deposit}'}</span> and{' '}<span className="font-mono font-bold">{'{cancellationDays}'}</span> so the wording follows the configured values instead of fixed numbers.</>}
            </p>
            {terms.version && (
              <p className="text-[10px] font-mono font-bold text-brand-charcoal/45 mt-1">
                {t('Current version:', 'النسخة الحالية:')} {terms.version}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveTerms}
            className="px-5 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{t('Save Terms', 'حفظ الشروط')}</span>
          </button>
        </div>

        {termsSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{t('Terms saved. New reservations will record this version on acceptance.', 'تم حفظ الشروط. ستسجّل الحجوزات الجديدة هذه النسخة عند الموافقة.')}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <ContentLanguageTabs value={termsLang} onChange={setTermsLang} arabicFilled={termsArabicFilled} />

            {termsLang === 'en' ? (
              <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Section Title', 'عنوان القسم')} {t('(English)', '(بالإنجليزية)')}</label>
              <input
                type="text"
                value={terms.title}
                onChange={e => setTerms({ ...terms, title: e.target.value })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-bold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Opening Lines (one per line)', 'الأسطر الافتتاحية (واحد في كل سطر)')} {t('(English)', '(بالإنجليزية)')}</label>
              <LineListTextarea
                rows={2}
                value={terms.leadingItems}
                onChange={lines => setTerms({ ...terms, leadingItems: lines })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Supplies Intro', 'مقدمة المستلزمات')} {t('(English)', '(بالإنجليزية)')}</label>
              <input
                type="text"
                value={terms.suppliesIntro}
                onChange={e => setTerms({ ...terms, suppliesIntro: e.target.value })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Supplies List (one per line, shown numbered)', 'قائمة المستلزمات (واحد في كل سطر، تُعرض مرقّمة)')} {t('(English)', '(بالإنجليزية)')}</label>
              <LineListTextarea
                rows={4}
                value={terms.supplies}
                onChange={lines => setTerms({ ...terms, supplies: lines })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Closing Lines (one per line)', 'الأسطر الختامية (واحد في كل سطر)')} {t('(English)', '(بالإنجليزية)')}</label>
              <LineListTextarea
                rows={4}
                value={terms.trailingItems}
                onChange={lines => setTerms({ ...terms, trailingItems: lines })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-brand-charcoal/60 leading-relaxed">
                  {t(
                    'Shown to customers browsing in Arabic only once the Arabic opening lines or supplies list has content; otherwise they see the English terms. The whole set switches together — languages are never mixed. Include {deposit} and {cancellationDays} in the Arabic text too.',
                    'تظهر الشروط العربية للعملاء الذين يتصفحون بالعربية فقط عند تعبئة الأسطر الافتتاحية أو قائمة المستلزمات بالعربية؛ وإلا تظهر لهم الشروط الإنجليزية. وتتبدّل المجموعة كاملةً معًا ولا تُخلط اللغتان. أدرج {deposit} و{cancellationDays} في النص العربي أيضًا.'
                  )}
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Section Title', 'عنوان القسم')} {t('(Arabic)', '(بالعربية)')}</label>
                  <input
                    type="text" dir="rtl" lang="ar"
                    value={terms.titleAr ?? ''}
                    onChange={e => setTerms({ ...terms, titleAr: e.target.value })}
                    className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-bold text-brand-charcoal text-start"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Opening Lines (one per line)', 'الأسطر الافتتاحية (واحد في كل سطر)')} {t('(Arabic)', '(بالعربية)')}</label>
                  <div dir="rtl" lang="ar">
                    <LineListTextarea
                      rows={2}
                      value={terms.leadingItemsAr ?? []}
                      onChange={lines => setTerms({ ...terms, leadingItemsAr: lines })}
                      className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal text-start"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Supplies Intro', 'مقدمة المستلزمات')} {t('(Arabic)', '(بالعربية)')}</label>
                  <input
                    type="text" dir="rtl" lang="ar"
                    value={terms.suppliesIntroAr ?? ''}
                    onChange={e => setTerms({ ...terms, suppliesIntroAr: e.target.value })}
                    className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal text-start"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Supplies List (one per line, shown numbered)', 'قائمة المستلزمات (واحد في كل سطر، تُعرض مرقّمة)')} {t('(Arabic)', '(بالعربية)')}</label>
                  <div dir="rtl" lang="ar">
                    <LineListTextarea
                      rows={4}
                      value={terms.suppliesAr ?? []}
                      onChange={lines => setTerms({ ...terms, suppliesAr: lines })}
                      className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal text-start"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">{t('Closing Lines (one per line)', 'الأسطر الختامية (واحد في كل سطر)')} {t('(Arabic)', '(بالعربية)')}</label>
                  <div dir="rtl" lang="ar">
                    <LineListTextarea
                      rows={4}
                      value={terms.trailingItemsAr ?? []}
                      onChange={lines => setTerms({ ...terms, trailingItemsAr: lines })}
                      className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal text-start"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live preview with the placeholders resolved */}
          <div dir={previewIsAr ? 'rtl' : undefined} lang={previewIsAr ? 'ar' : undefined}
               className="p-5 bg-brand-cream/50 border border-brand-clay rounded-2xl space-y-3">
            <p className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">
              {t('Customer Preview', 'معاينة العميل')}
            </p>
            {previewArEmpty && (
              <p className="text-xs italic text-brand-charcoal/55" dir="ltr">
                {t(
                  'No Arabic terms yet — customers browsing in Arabic currently see the English terms.',
                  'لا توجد شروط عربية بعد — يرى العملاء الذين يتصفحون بالعربية الشروط الإنجليزية حاليًا.'
                )}
              </p>
            )}
            {(!previewIsAr || pv.title) && (
              <h4 className="font-display text-base font-bold text-brand-terracotta">{pv.title}</h4>
            )}
            <div className="text-xs space-y-2 text-brand-charcoal/85 leading-relaxed">
              {pv.leadingItems.map((line, idx) => (
                <p key={idx} className="font-semibold">
                  {renderTermsLine(line, { deposit: 500, cancellationDays: Number(cancellationNoticeDays) || 4 })}
                </p>
              ))}
              {pv.supplies.length > 0 && (
                <div>
                  {(!previewIsAr || pv.suppliesIntro) && <p className="font-semibold">{pv.suppliesIntro}</p>}
                  <ol className="list-decimal ps-5 space-y-0.5 font-medium text-brand-charcoal/75">
                    {pv.supplies.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ol>
                </div>
              )}
              {pv.trailingItems.map((line, idx) => (
                <p key={idx} className="font-medium">
                  {renderTermsLine(line, { deposit: 500, cancellationDays: Number(cancellationNoticeDays) || 4 })}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-brand-charcoal/45 pt-2 border-t border-brand-clay/40">
              {t("Deposit shown here uses 500 SAR as an example; the reservation page uses the selected package's deposit.", 'يستخدم العربون المعروض هنا مبلغ 500 ريال كمثال؛ تستخدم صفحة الحجز عربون الباقة المختارة.')}
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* BIRTHDAY BOOKING FORM FIELDS — configured here, not on the        */}
      {/* Birthday Event page (which edits package details only).           */}
      {/* ================================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-brand-terracotta" />
              <span>{t('Birthday Booking Form Fields', 'حقول نموذج حجز عيد الميلاد')}</span>
            </h3>
            <p className="text-xs text-brand-charcoal/70 mt-1">
              {t('Add, edit, remove, enable, disable and reorder the fields customers fill in when booking a birthday package. Package details themselves are edited in the Birthday Event page.', 'أضف الحقول التي يملؤها العملاء عند حجز باقة عيد ميلاد وعدّلها وأزلها وفعّلها وعطّلها ورتّبها. تُعدَّل تفاصيل الباقات نفسها في صفحة إدارة باقات أعياد الميلاد.')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddField}
            className="px-4 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>{t('Add Field', 'إضافة حقل')}</span>
          </button>
        </div>

        {fieldsSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>{t('Booking form updated. The customer birthday form now uses these fields.', 'تم تحديث نموذج الحجز. يستخدم نموذج عيد الميلاد للعملاء هذه الحقول الآن.')}</span>
          </div>
        )}

        <div className="space-y-3">
          {birthdayFormFields.map((field, index) => (
            <div
              key={field.id}
              className={`border rounded-2xl p-4 space-y-3 ${
                field.enabled ? 'border-brand-clay bg-white' : 'border-brand-clay/50 bg-brand-sand/20 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-brand-charcoal/40">#{index + 1}</span>
                  <span className="text-sm font-bold text-brand-charcoal truncate">{field.label}</span>
                  {field.system && (
                    <span className="text-[9px] font-bold uppercase bg-brand-sand text-brand-charcoal/70 px-1.5 py-0.5 rounded">{t('Core', 'أساسي')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleField(field.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      field.enabled
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-gray-100 border-gray-200 text-gray-600'
                    }`}
                  >
                    {field.enabled ? t('Enabled', 'مفعّل') : t('Disabled', 'معطّل')}
                  </button>
                  <button
                    type="button"
                    title={t('Move up', 'نقل للأعلى')}
                    disabled={index === 0}
                    onClick={() => handleMoveField(index, -1)}
                    className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={t('Move down', 'نقل للأسفل')}
                    disabled={index === birthdayFormFields.length - 1}
                    onClick={() => handleMoveField(index, 1)}
                    className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={field.system ? t('Core fields cannot be removed — disable instead', 'لا يمكن إزالة الحقول الأساسية — عطّلها بدلًا من ذلك') : t('Remove field', 'إزالة الحقل')}
                    disabled={field.system}
                    onClick={() => handleRemoveField(field.id)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">{t('Label', 'التسمية')}</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => handleFieldChange(field.id, { label: e.target.value })}
                    className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">{t('Type', 'النوع')}</label>
                  <select
                    value={field.type}
                    disabled={field.system}
                    onChange={e => handleFieldChange(field.id, { type: e.target.value as BirthdayFormField['type'] })}
                    className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold disabled:opacity-60"
                  >
                    <option value="short_text">{t('Short text', 'نص قصير')}</option>
                    <option value="long_text">{t('Long text', 'نص طويل')}</option>
                    <option value="number">{t('Number', 'رقم')}</option>
                    <option value="date">{t('Date', 'تاريخ')}</option>
                    <option value="time">{t('Time', 'وقت')}</option>
                    <option value="phone">{t('Phone', 'هاتف')}</option>
                    <option value="dropdown">{t('Dropdown', 'قائمة منسدلة')}</option>
                    <option value="package">{t('Package selector', 'محدد الباقة')}</option>
                    <option value="image">{t('Image upload', 'رفع صورة')}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">{t('Required', 'إلزامي')}</label>
                  <button
                    type="button"
                    onClick={() => handleFieldChange(field.id, { required: !field.required })}
                    className={`w-full py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                      field.required
                        ? 'bg-brand-terracotta/10 border-brand-terracotta/40 text-brand-terracotta'
                        : 'bg-brand-cream/40 border-brand-clay text-brand-charcoal/60'
                    }`}
                  >
                    {field.required ? t('Required', 'إلزامي') : t('Optional', 'اختياري')}
                  </button>
                </div>

                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">{t('Placeholder', 'النص التوضيحي')}</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={e => handleFieldChange(field.id, { placeholder: e.target.value })}
                      className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">{t('Help Text', 'نص المساعدة')}</label>
                    <input
                      type="text"
                      value={field.helpText || ''}
                      onChange={e => handleFieldChange(field.id, { helpText: e.target.value })}
                      className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                    />
                  </div>
                </div>

                {field.type === 'dropdown' && (
                  <div className="sm:col-span-3 space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">{t('Options (one per line)', 'الخيارات (واحد في كل سطر)')}</label>
                    <LineListTextarea
                      rows={4}
                      value={field.options || []}
                      onChange={options => handleFieldChange(field.id, { options })}
                      className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
