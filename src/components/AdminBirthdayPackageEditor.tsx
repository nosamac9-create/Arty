/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Save, Plus, Trash2, Upload, Image as ImageIcon,
  Package, DollarSign, CalendarRange, Sparkles, Cake, Compass, ShieldAlert
} from 'lucide-react';
import { BirthdayPackage } from '../types';
import { LineListTextarea } from './ui/LineListTextarea';
import { BackButton } from './ui/BackButton';
import { ContentLanguageTabs, ContentLang } from './ui/ContentLanguageTabs';
import { DEFAULT_DEPOSIT_AMOUNT } from '../utils/queueUtils';
import { useLanguage } from '../context/LanguageContext';
import { enumLabel } from '../utils/enumLabels';

interface Props {
  /** The record being edited, straight from the shared data layer. */
  pkg: BirthdayPackage;
  onBack: () => void;
  onSave: (updates: Partial<BirthdayPackage>) => Promise<void> | void;
  onNotify: (message: string) => void;
}

const inputClass = 'w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold';
const labelClass = 'font-bold text-brand-charcoal/80 block';

/** One titled group of fields. */
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}> = ({ title, icon, description, children }) => (
  <section className="bg-white border border-brand-clay/70 rounded-2xl p-5 space-y-4 shadow-2xs">
    <div className="border-b border-brand-clay/50 pb-3">
      <h2 className="flex items-center gap-2 font-display text-sm font-bold text-brand-charcoal">
        {icon}
        <span>{title}</span>
      </h2>
      {description && <p className="mt-0.5 text-[11px] text-brand-charcoal/55">{description}</p>}
    </div>
    {children}
  </section>
);

/**
 * The editor for one birthday package.
 *
 * Previously this form expanded inside the management list, which put a very
 * long single column between the package rows. It is its own view now: the list
 * stays an overview, and the draft lives here rather than in a map keyed by
 * package id — so reordering or adding packages in the list cannot interact
 * with an in-progress edit.
 *
 * Every field the old form had is still here; they are grouped rather than
 * stacked. Nothing is written until Save.
 */
export const AdminBirthdayPackageEditor: React.FC<Props> = ({ pkg, onBack, onSave, onNotify }) => {
  const { lang, t } = useLanguage();
  const [draft, setDraft] = useState<BirthdayPackage>(pkg);
  const [isSaving, setIsSaving] = useState(false);
  // Which language the Basic information section is showing. UI-only: never saved.
  const [contentLang, setContentLang] = useState<ContentLang>('en');

  // Re-seed if the record changes underneath — a colleague publishing it, say.
  useEffect(() => { setDraft(pkg); setContentLang('en'); }, [pkg.id]);

  const setField = <K extends keyof BirthdayPackage>(key: K, value: BirthdayPackage[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  /** Reads a chosen photo into the draft as a data URL, as workshops do. */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onNotify(t('That file is not an image.', 'هذا الملف ليس صورة.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotify(t('That photo is over 5MB. Please choose a smaller one.', 'حجم هذه الصورة يتجاوز 5 ميغابايت. يرجى اختيار صورة أصغر.'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setField('image', reader.result as string);
    reader.onerror = () => onNotify(t('That photo could not be read. Please try again.', 'تعذّرت قراءة هذه الصورة. يرجى المحاولة مرة أخرى.'));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setContentLang('en');
      onNotify(t('Package name is required.', 'اسم الباقة مطلوب.'));
      return;
    }

    setIsSaving(true);
    try {
      const { id: _ignored, ...updates } = draft;
      // Arabic is optional: empty saves as null (not '' and not undefined), so a
      // previously saved Arabic value can actually be cleared.
      await onSave({
        ...updates,
        nameAr: draft.nameAr?.trim() || null,
        shortDescriptionAr: draft.shortDescriptionAr?.trim() || null,
        fullDescriptionAr: draft.fullDescriptionAr?.trim() || null,
        pricingLabelAr: draft.pricingLabelAr?.trim() || null,
        durationAr: draft.durationAr?.trim() || null,
        ageInformationAr: draft.ageInformationAr?.trim() || null,
        cakeDescriptionAr: draft.cakeDescriptionAr?.trim() || null,
        trainerInfoAr: draft.trainerInfoAr?.trim() || null,
        deliveryInfoAr: draft.deliveryInfoAr?.trim() || null,
        customerNotesAr: draft.customerNotesAr?.trim() || null,
        termsAr: draft.termsAr?.trim() || null,
        // A blank Arabic size name is dropped from the object, not stored as ''.
        cakeSizes: (draft.cakeSizes || []).map(({ labelAr, ...rest }) =>
          labelAr?.trim() ? { ...rest, labelAr: labelAr.trim() } : rest)
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 text-left text-xs pb-12 animate-in fade-in duration-300">

      {/* Which package this is, and the way back. */}
      <div className="flex flex-col gap-4 border-b border-brand-clay/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <BackButton onClick={onBack} className="mb-3">
            {t('Back to Birthday Package Management', 'العودة إلى إدارة باقات أعياد الميلاد')}
          </BackButton>

          <div className="flex items-center gap-3">
            {draft.image ? (
              <img
                src={draft.image}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border border-brand-clay/50 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-sand/60 text-brand-charcoal/40">
                <ImageIcon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-terracotta">{t('Editing package', 'تعديل الباقة')}</p>
              <h1 className="truncate font-display text-xl font-bold text-brand-charcoal">
                {draft.name || t('Untitled package', 'باقة بلا اسم')}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${
            draft.status === 'Published'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-brand-clay bg-brand-sand text-brand-charcoal/60'
          }`}>
            {enumLabel('workshopStatus', draft.status, lang)}
          </span>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-brand-clay bg-white px-4 py-2 font-bold text-brand-charcoal hover:bg-brand-sand cursor-pointer"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-xl bg-brand-terracotta px-5 py-2 font-bold text-brand-cream shadow-xs transition-all hover:bg-brand-terracotta-hover disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? t('Saving…', 'جارٍ الحفظ…') : t('Save Package', 'حفظ الباقة')}</span>
          </button>
        </div>
      </div>

      <Section
        title={t('Basic package information', 'معلومات الباقة الأساسية')}
        icon={<Package className="h-4 w-4 text-brand-terracotta" />}
        description={t('The name and copy shown on the customer site.', 'الاسم والنص المعروضان على موقع العملاء.')}
      >
        <ContentLanguageTabs
          value={contentLang}
          onChange={setContentLang}
          arabicFilled={!!(draft.nameAr?.trim() || draft.shortDescriptionAr?.trim() || draft.fullDescriptionAr?.trim())}
        />

        {contentLang === 'en' ? (
          <>
        <div className="space-y-1">
          <label className={labelClass}>{t('Package Name *', 'اسم الباقة *')} {t('(English)', '(بالإنجليزية)')}</label>
          <input
            type="text"
            required
            value={draft.name}
            onChange={e => setField('name', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>{t('Short Description', 'وصف مختصر')} {t('(English)', '(بالإنجليزية)')}</label>
          <input
            type="text"
            value={draft.shortDescription}
            onChange={e => setField('shortDescription', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>{t('Full Description', 'الوصف الكامل')} {t('(English)', '(بالإنجليزية)')}</label>
          <textarea
            rows={3}
            value={draft.fullDescription}
            onChange={e => setField('fullDescription', e.target.value)}
            className={inputClass}
          />
        </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className={labelClass}>{t('Package Name', 'اسم الباقة')} {t('(Arabic)', '(بالعربية)')}</label>
              <input
                type="text"
                dir="rtl"
                lang="ar"
                value={draft.nameAr ?? ''}
                onChange={e => setField('nameAr', e.target.value)}
                className={`${inputClass} text-start`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>{t('Short Description', 'وصف مختصر')} {t('(Arabic)', '(بالعربية)')}</label>
              <input
                type="text"
                dir="rtl"
                lang="ar"
                value={draft.shortDescriptionAr ?? ''}
                onChange={e => setField('shortDescriptionAr', e.target.value)}
                className={`${inputClass} text-start`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>{t('Full Description', 'الوصف الكامل')} {t('(Arabic)', '(بالعربية)')}</label>
              <textarea
                rows={3}
                dir="rtl"
                lang="ar"
                value={draft.fullDescriptionAr ?? ''}
                onChange={e => setField('fullDescriptionAr', e.target.value)}
                className={`${inputClass} text-start`}
              />
            </div>
          </>
        )}
      </Section>

      <Section
        title={t('Photo', 'الصورة')}
        icon={<ImageIcon className="h-4 w-4 text-brand-terracotta" />}
        description={t('Shown on the birthday packages page.', 'تظهر في صفحة باقات أعياد الميلاد.')}
      >
        <div className="flex flex-col items-start gap-4 rounded-2xl border-2 border-dashed border-brand-clay bg-brand-cream/40 p-4 sm:flex-row">
          {draft.image ? (
            <img
              src={draft.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl border border-brand-clay object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-brand-sand/60 text-brand-muted">
              <ImageIcon className="h-7 w-7" />
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/*"
                id={`pkg-photo-${draft.id}`}
                className="hidden"
                onChange={handlePhoto}
              />
              <label
                htmlFor={`pkg-photo-${draft.id}`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-clay bg-brand-cream px-4 py-2 font-semibold text-brand-terracotta transition-colors hover:bg-brand-sand/50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{draft.image ? t('Replace photo', 'استبدال الصورة') : t('Upload photo', 'رفع صورة')}</span>
              </label>
              {draft.image && (
                <button
                  type="button"
                  onClick={() => setField('image', '')}
                  className="rounded-xl border border-brand-clay px-3 py-2 font-semibold text-brand-muted hover:text-brand-charcoal cursor-pointer"
                >
                  {t('Remove', 'إزالة')}
                </button>
              )}
            </div>

            <p className="text-[11px] text-brand-muted">{t('JPG or PNG, up to 5MB.', 'JPG أو PNG، حتى 5 ميغابايت.')}</p>

            <input
              type="text"
              value={draft.image.startsWith('data:') ? '' : draft.image}
              placeholder={t('Or paste an image link', 'أو الصق رابط صورة')}
              onChange={e => setField('image', e.target.value)}
              className="w-full rounded-xl border border-brand-clay bg-brand-cream/60 p-2.5 font-semibold"
            />
          </div>
        </div>
      </Section>

      <Section
        title={t('Pricing & guest limits', 'الأسعار وحدود الضيوف')}
        icon={<DollarSign className="h-4 w-4 text-brand-terracotta" />}
        description={t('What the party costs and how many it holds.', 'تكلفة الحفلة وعدد الضيوف المسموح.')}
      >
        <ContentLanguageTabs
          value={contentLang}
          onChange={setContentLang}
          arabicFilled={!!(draft.pricingLabelAr?.trim() || draft.durationAr?.trim() || draft.ageInformationAr?.trim())}
        />

        {contentLang === 'en' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className={labelClass}>{t('Price (SAR)', 'السعر (ريال)')}</label>
                <input
                  type="number"
                  min={0}
                  value={draft.price}
                  onChange={e => setField('price', Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Pricing Type', 'نوع التسعير')}</label>
                <select
                  value={draft.pricingType}
                  onChange={e => setField('pricingType', e.target.value as BirthdayPackage['pricingType'])}
                  className={inputClass}
                >
                  <option value="Per child">{enumLabel('pricingType', 'Per child', lang)}</option>
                  <option value="Per person">{enumLabel('pricingType', 'Per person', lang)}</option>
                  <option value="Fixed price">{enumLabel('pricingType', 'Fixed price', lang)}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Pricing Label (shown to customers)', 'تسمية التسعير (تظهر للعملاء)')} {t('(English)', '(بالإنجليزية)')}</label>
                <input
                  type="text"
                  value={draft.pricingLabel || ''}
                  onChange={e => setField('pricingLabel', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Duration', 'المدة')} {t('(English)', '(بالإنجليزية)')}</label>
                <input
                  type="text"
                  value={draft.duration}
                  onChange={e => setField('duration', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Deposit (SAR)', 'العربون (ريال)')}</label>
                <input
                  type="number"
                  min={0}
                  value={draft.depositAmount ?? DEFAULT_DEPOSIT_AMOUNT}
                  onChange={e => setField('depositAmount', Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Age Information', 'معلومات العمر')} {t('(English)', '(بالإنجليزية)')}</label>
                <input
                  type="text"
                  value={draft.ageInformation}
                  onChange={e => setField('ageInformation', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Minimum Guests', 'الحد الأدنى للضيوف')}</label>
                <input
                  type="number"
                  min={1}
                  value={draft.minGuests}
                  onChange={e => setField('minGuests', Number(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Maximum Guests', 'الحد الأقصى للضيوف')}</label>
                <input
                  type="number"
                  min={1}
                  value={draft.maxGuests}
                  onChange={e => setField('maxGuests', Number(e.target.value) || 1)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className={labelClass}>{t('Pricing Label (shown to customers)', 'تسمية التسعير (تظهر للعملاء)')} {t('(Arabic)', '(بالعربية)')}</label>
                <input type="text" dir="rtl" lang="ar" value={draft.pricingLabelAr ?? ''}
                  onChange={e => setField('pricingLabelAr', e.target.value)} className={`${inputClass} text-start`} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('Duration', 'المدة')} {t('(Arabic)', '(بالعربية)')}</label>
                <input type="text" dir="rtl" lang="ar" value={draft.durationAr ?? ''}
                  onChange={e => setField('durationAr', e.target.value)} className={`${inputClass} text-start`} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('Age Information', 'معلومات العمر')} {t('(Arabic)', '(بالعربية)')}</label>
                <input type="text" dir="rtl" lang="ar" value={draft.ageInformationAr ?? ''}
                  onChange={e => setField('ageInformationAr', e.target.value)} className={`${inputClass} text-start`} />
              </div>
            </div>
          </>
        )}
      </Section>

      <Section
        title={t('Availability', 'التوفر')}
        icon={<CalendarRange className="h-4 w-4 text-brand-terracotta" />}
        description={t('The days and start times a customer can choose.', 'الأيام وأوقات البدء التي يمكن للعميل اختيارها.')}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ['availableDays', t('Available Days', 'الأيام المتاحة')],
            ['availableTimes', t('Available Times', 'الأوقات المتاحة')]
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className={labelClass}>{label}</label>
              <LineListTextarea
                rows={3}
                placeholder={t('One entry per line', 'إدخال واحد في كل سطر')}
                value={draft[key] || []}
                onChange={lines => setField(key, lines)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={t('Includes & activities', 'المشتملات والأنشطة')}
        icon={<Sparkles className="h-4 w-4 text-brand-terracotta" />}
        description={t('Listed on the package page as what the celebration covers.', 'تظهر في صفحة الباقة كما تشمله الاحتفالية.')}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ['includedItems', t('Includes (one per line)', 'تشمل (واحد في كل سطر)')],
            ['activityChoices', t('Activity Choices (one per line)', 'خيارات الأنشطة (واحد في كل سطر)')],
            ['additionalInfo', t('Additional Information (one per line)', 'معلومات إضافية (واحد في كل سطر)')]
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className={labelClass}>{label}</label>
              <LineListTextarea
                rows={3}
                placeholder={t('One entry per line', 'إدخال واحد في كل سطر')}
                value={draft[key] || []}
                onChange={lines => setField(key, lines)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title={t('Cake options', 'خيارات الكعكة')}
        icon={<Cake className="h-4 w-4 text-brand-terracotta" />}
        description={t('Sizes and prices offered with this package.', 'المقاسات والأسعار المتاحة مع هذه الباقة.')}
      >
        <ContentLanguageTabs
          value={contentLang}
          onChange={setContentLang}
          arabicFilled={!!(draft.cakeDescriptionAr?.trim() || (draft.cakeSizes || []).some(s => s.labelAr?.trim()))}
        />

        {contentLang === 'en' ? (
          <>
            <div className="space-y-1">
              <label className={labelClass}>{t('Cake Description', 'وصف الكعكة')} {t('(English)', '(بالإنجليزية)')}</label>
              <input
                type="text"
                placeholder={t('Send us your cake design and we will do it.', 'أرسل لنا تصميم الكعكة وسنقوم بتنفيذه.')}
                value={draft.cakeDescription}
                onChange={e => setField('cakeDescription', e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>{t('Cake Sizes & Prices', 'مقاسات الكعكة وأسعارها')} {t('(English)', '(بالإنجليزية)')}</label>
                <button
                  type="button"
                  onClick={() => setField('cakeSizes', [
                    ...(draft.cakeSizes || []),
                    { id: `cake-${Date.now()}`, label: 'New size', price: 0 }
                  ])}
                  className="flex items-center gap-1 text-[11px] font-bold text-brand-terracotta hover:underline cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>{t('Add Size', 'إضافة مقاس')}</span>
                </button>
              </div>

              {(draft.cakeSizes || []).length === 0 ? (
                <p className="text-[11px] italic text-brand-charcoal/50">{t('No cake sizes listed.', 'لا توجد مقاسات كعك مدرجة.')}</p>
              ) : (
                <div className="space-y-1.5">
                  {(draft.cakeSizes || []).map((size, sizeIdx) => (
                    <div key={size.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={t('e.g. Small (15 cm)', 'مثال: صغير (15 سم)')}
                        value={size.label}
                        onChange={e => setField('cakeSizes',
                          (draft.cakeSizes || []).map((c, i) => i === sizeIdx ? { ...c, label: e.target.value } : c))}
                        className="flex-1 rounded-xl border border-brand-clay bg-brand-cream/40 p-2 font-semibold"
                      />
                      <input
                        type="number"
                        min={0}
                        value={size.price}
                        onChange={e => setField('cakeSizes',
                          (draft.cakeSizes || []).map((c, i) => i === sizeIdx ? { ...c, price: Number(e.target.value) || 0 } : c))}
                        className="w-24 rounded-xl border border-brand-clay bg-brand-cream/40 p-2 font-semibold"
                      />
                      <span className="text-[11px] font-bold text-brand-charcoal/50">{t('SAR', 'ريال')}</span>
                      <button
                        type="button"
                        title={t('Remove size', 'إزالة المقاس')}
                        onClick={() => setField('cakeSizes', (draft.cakeSizes || []).filter((_, i) => i !== sizeIdx))}
                        className="rounded-lg border border-red-200 p-1.5 text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className={labelClass}>{t('Cake Description', 'وصف الكعكة')} {t('(Arabic)', '(بالعربية)')}</label>
              <input type="text" dir="rtl" lang="ar" value={draft.cakeDescriptionAr ?? ''}
                onChange={e => setField('cakeDescriptionAr', e.target.value)} className={`${inputClass} text-start`} />
            </div>

            {(draft.cakeSizes || []).length > 0 && (
              <div className="space-y-2">
                <label className={labelClass}>{t('Cake Size Names', 'أسماء مقاسات الكعكة')} {t('(Arabic)', '(بالعربية)')}</label>
                <div className="space-y-1.5">
                  {(draft.cakeSizes || []).map((size, sizeIdx) => (
                    <div key={size.id} className="flex items-center gap-2">
                      <span className="w-40 shrink-0 truncate text-[11px] font-bold text-brand-charcoal/60" title={size.label}>{size.label}</span>
                      <input
                        type="text"
                        dir="rtl"
                        lang="ar"
                        value={size.labelAr ?? ''}
                        onChange={e => setField('cakeSizes',
                          (draft.cakeSizes || []).map((c, i) => i === sizeIdx ? { ...c, labelAr: e.target.value } : c))}
                        className="flex-1 rounded-xl border border-brand-clay bg-brand-cream/40 p-2 font-semibold text-start"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <Section
        title={t('Trainer & delivery', 'المدرب والتسليم')}
        icon={<Compass className="h-4 w-4 text-brand-terracotta" />}
        description={t('Who runs the party and how finished pieces get home.', 'من يقود الحفلة وكيف تصل القطع المنتهية إلى المنزل.')}
      >
        <ContentLanguageTabs
          value={contentLang}
          onChange={setContentLang}
          arabicFilled={!!(draft.trainerInfoAr?.trim() || draft.deliveryInfoAr?.trim())}
        />

        {contentLang === 'en' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>{t('Trainer Information', 'معلومات المدرب')} {t('(English)', '(بالإنجليزية)')}</label>
                <input
                  type="text"
                  value={draft.trainerInfo}
                  onChange={e => setField('trainerInfo', e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>{t('Delivery / Pickup Information', 'معلومات التسليم / الاستلام')} {t('(English)', '(بالإنجليزية)')}</label>
                <input
                  type="text"
                  value={draft.deliveryInfo}
                  onChange={e => setField('deliveryInfo', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>{t('Trainer Information', 'معلومات المدرب')} {t('(Arabic)', '(بالعربية)')}</label>
                <input type="text" dir="rtl" lang="ar" value={draft.trainerInfoAr ?? ''}
                  onChange={e => setField('trainerInfoAr', e.target.value)} className={`${inputClass} text-start`} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>{t('Delivery / Pickup Information', 'معلومات التسليم / الاستلام')} {t('(Arabic)', '(بالعربية)')}</label>
                <input type="text" dir="rtl" lang="ar" value={draft.deliveryInfoAr ?? ''}
                  onChange={e => setField('deliveryInfoAr', e.target.value)} className={`${inputClass} text-start`} />
              </div>
            </div>
          </>
        )}
      </Section>

      <Section
        title={t('Notes & terms', 'الملاحظات والشروط')}
        icon={<ShieldAlert className="h-4 w-4 text-brand-terracotta" />}
        description={t('Shown under the package on the customer site.', 'تظهر أسفل الباقة على موقع العملاء.')}
      >
        <ContentLanguageTabs
          value={contentLang}
          onChange={setContentLang}
          arabicFilled={!!(draft.customerNotesAr?.trim() || draft.termsAr?.trim())}
        />

        {contentLang === 'en' ? (
          <>
            <div className="space-y-1">
              <label className={labelClass}>{t('Customer-Visible Notes', 'ملاحظات ظاهرة للعميل')} {t('(English)', '(بالإنجليزية)')}</label>
              <textarea
                rows={2}
                value={draft.customerNotes}
                onChange={e => setField('customerNotes', e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>{t('Terms', 'الشروط')} {t('(English)', '(بالإنجليزية)')}</label>
              <textarea
                rows={2}
                value={draft.terms}
                onChange={e => setField('terms', e.target.value)}
                className={inputClass}
              />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className={labelClass}>{t('Customer-Visible Notes', 'ملاحظات ظاهرة للعميل')} {t('(Arabic)', '(بالعربية)')}</label>
              <textarea rows={2} dir="rtl" lang="ar" value={draft.customerNotesAr ?? ''}
                onChange={e => setField('customerNotesAr', e.target.value)} className={`${inputClass} text-start`} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>{t('Terms', 'الشروط')} {t('(Arabic)', '(بالعربية)')}</label>
              <textarea rows={2} dir="rtl" lang="ar" value={draft.termsAr ?? ''}
                onChange={e => setField('termsAr', e.target.value)} className={`${inputClass} text-start`} />
            </div>
          </>
        )}
      </Section>

      <Section
        title={t('Publishing', 'النشر')}
        icon={<Package className="h-4 w-4 text-brand-terracotta" />}
        description={t('Draft packages are hidden from the customer site.', 'الباقات المسودة مخفية عن موقع العملاء.')}
      >
        <div className="space-y-1 sm:max-w-xs">
          <label className={labelClass}>{t('Status', 'الحالة')}</label>
          <select
            value={draft.status}
            onChange={e => setField('status', e.target.value as BirthdayPackage['status'])}
            className={inputClass}
          >
            <option value="Published">{enumLabel('workshopStatus', 'Published', lang)}</option>
            <option value="Draft">{enumLabel('workshopStatus', 'Draft', lang)}</option>
          </select>
        </div>
      </Section>

      {/* Repeated at the foot so a long edit does not need a scroll back up. */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-brand-clay/60 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-brand-clay bg-white px-4 py-2 font-bold text-brand-charcoal hover:bg-brand-sand cursor-pointer"
        >
          {t('Cancel', 'إلغاء')}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-xl bg-brand-terracotta px-5 py-2 font-bold text-brand-cream shadow-xs transition-all hover:bg-brand-terracotta-hover disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? t('Saving…', 'جارٍ الحفظ…') : t('Save Package', 'حفظ الباقة')}</span>
        </button>
      </div>
    </form>
  );
};
