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
  const [draft, setDraft] = useState<BirthdayPackage>(pkg);
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed if the record changes underneath — a colleague publishing it, say.
  useEffect(() => { setDraft(pkg); }, [pkg.id]);

  const setField = <K extends keyof BirthdayPackage>(key: K, value: BirthdayPackage[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  /** Reads a chosen photo into the draft as a data URL, as workshops do. */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onNotify('That file is not an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onNotify('That photo is over 5MB. Please choose a smaller one.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setField('image', reader.result as string);
    reader.onerror = () => onNotify('That photo could not be read. Please try again.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      onNotify('Package name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const { id: _ignored, ...updates } = draft;
      await onSave(updates);
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
            Back to Birthday Package Management
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
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-terracotta">Editing package</p>
              <h1 className="truncate font-display text-xl font-bold text-brand-charcoal">
                {draft.name || 'Untitled package'}
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
            {draft.status}
          </span>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-brand-clay bg-white px-4 py-2 font-bold text-brand-charcoal hover:bg-brand-sand cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-xl bg-brand-terracotta px-5 py-2 font-bold text-brand-cream shadow-xs transition-all hover:bg-brand-terracotta-hover disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving…' : 'Save Package'}</span>
          </button>
        </div>
      </div>

      <Section
        title="Basic package information"
        icon={<Package className="h-4 w-4 text-brand-terracotta" />}
        description="The name and copy shown on the customer site."
      >
        <div className="space-y-1">
          <label className={labelClass}>Package Name *</label>
          <input
            type="text"
            required
            value={draft.name}
            onChange={e => setField('name', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Short Description</label>
          <input
            type="text"
            value={draft.shortDescription}
            onChange={e => setField('shortDescription', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Full Description</label>
          <textarea
            rows={3}
            value={draft.fullDescription}
            onChange={e => setField('fullDescription', e.target.value)}
            className={inputClass}
          />
        </div>
      </Section>

      <Section
        title="Photo"
        icon={<ImageIcon className="h-4 w-4 text-brand-terracotta" />}
        description="Shown on the birthday packages page."
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
                <span>{draft.image ? 'Replace photo' : 'Upload photo'}</span>
              </label>
              {draft.image && (
                <button
                  type="button"
                  onClick={() => setField('image', '')}
                  className="rounded-xl border border-brand-clay px-3 py-2 font-semibold text-brand-muted hover:text-brand-charcoal cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="text-[11px] text-brand-muted">JPG or PNG, up to 5MB.</p>

            <input
              type="text"
              value={draft.image.startsWith('data:') ? '' : draft.image}
              placeholder="Or paste an image link"
              onChange={e => setField('image', e.target.value)}
              className="w-full rounded-xl border border-brand-clay bg-brand-cream/60 p-2.5 font-semibold"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Pricing & guest limits"
        icon={<DollarSign className="h-4 w-4 text-brand-terracotta" />}
        description="What the party costs and how many it holds."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className={labelClass}>Price (SAR)</label>
            <input
              type="number"
              min={0}
              value={draft.price}
              onChange={e => setField('price', Number(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Pricing Type</label>
            <select
              value={draft.pricingType}
              onChange={e => setField('pricingType', e.target.value as BirthdayPackage['pricingType'])}
              className={inputClass}
            >
              <option value="Per child">Per child</option>
              <option value="Per person">Per person</option>
              <option value="Fixed price">Fixed price</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Pricing Label (shown to customers)</label>
            <input
              type="text"
              value={draft.pricingLabel || ''}
              onChange={e => setField('pricingLabel', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Duration</label>
            <input
              type="text"
              value={draft.duration}
              onChange={e => setField('duration', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Deposit (SAR)</label>
            <input
              type="number"
              min={0}
              value={draft.depositAmount ?? 500}
              onChange={e => setField('depositAmount', Number(e.target.value) || 0)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Age Information</label>
            <input
              type="text"
              value={draft.ageInformation}
              onChange={e => setField('ageInformation', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Minimum Guests</label>
            <input
              type="number"
              min={1}
              value={draft.minGuests}
              onChange={e => setField('minGuests', Number(e.target.value) || 1)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Maximum Guests</label>
            <input
              type="number"
              min={1}
              value={draft.maxGuests}
              onChange={e => setField('maxGuests', Number(e.target.value) || 1)}
              className={inputClass}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Availability"
        icon={<CalendarRange className="h-4 w-4 text-brand-terracotta" />}
        description="The days and start times a customer can choose."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ['availableDays', 'Available Days'],
            ['availableTimes', 'Available Times']
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className={labelClass}>{label}</label>
              <LineListTextarea
                rows={3}
                placeholder="One entry per line"
                value={draft[key] || []}
                onChange={lines => setField(key, lines)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Includes & activities"
        icon={<Sparkles className="h-4 w-4 text-brand-terracotta" />}
        description="Listed on the package page as what the celebration covers."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {([
            ['includedItems', 'Includes (one per line)'],
            ['activityChoices', 'Activity Choices (one per line)'],
            ['additionalInfo', 'Additional Information (one per line)']
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <label className={labelClass}>{label}</label>
              <LineListTextarea
                rows={3}
                placeholder="One entry per line"
                value={draft[key] || []}
                onChange={lines => setField(key, lines)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Cake options"
        icon={<Cake className="h-4 w-4 text-brand-terracotta" />}
        description="Sizes and prices offered with this package."
      >
        <div className="space-y-1">
          <label className={labelClass}>Cake Description</label>
          <input
            type="text"
            placeholder="Send us your cake design and we will do it."
            value={draft.cakeDescription}
            onChange={e => setField('cakeDescription', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>Cake Sizes &amp; Prices</label>
            <button
              type="button"
              onClick={() => setField('cakeSizes', [
                ...(draft.cakeSizes || []),
                { id: `cake-${Date.now()}`, label: 'New size', price: 0 }
              ])}
              className="flex items-center gap-1 text-[11px] font-bold text-brand-terracotta hover:underline cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              <span>Add Size</span>
            </button>
          </div>

          {(draft.cakeSizes || []).length === 0 ? (
            <p className="text-[11px] italic text-brand-charcoal/50">No cake sizes listed.</p>
          ) : (
            <div className="space-y-1.5">
              {(draft.cakeSizes || []).map((size, sizeIdx) => (
                <div key={size.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Small (15 cm)"
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
                  <span className="text-[11px] font-bold text-brand-charcoal/50">SAR</span>
                  <button
                    type="button"
                    title="Remove size"
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
      </Section>

      <Section
        title="Trainer & delivery"
        icon={<Compass className="h-4 w-4 text-brand-terracotta" />}
        description="Who runs the party and how finished pieces get home."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClass}>Trainer Information</label>
            <input
              type="text"
              value={draft.trainerInfo}
              onChange={e => setField('trainerInfo', e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Delivery / Pickup Information</label>
            <input
              type="text"
              value={draft.deliveryInfo}
              onChange={e => setField('deliveryInfo', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Notes & terms"
        icon={<ShieldAlert className="h-4 w-4 text-brand-terracotta" />}
        description="Shown under the package on the customer site."
      >
        <div className="space-y-1">
          <label className={labelClass}>Customer-Visible Notes</label>
          <textarea
            rows={2}
            value={draft.customerNotes}
            onChange={e => setField('customerNotes', e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClass}>Terms</label>
          <textarea
            rows={2}
            value={draft.terms}
            onChange={e => setField('terms', e.target.value)}
            className={inputClass}
          />
        </div>
      </Section>

      <Section
        title="Publishing"
        icon={<Package className="h-4 w-4 text-brand-terracotta" />}
        description="Draft packages are hidden from the customer site."
      >
        <div className="space-y-1 sm:max-w-xs">
          <label className={labelClass}>Status</label>
          <select
            value={draft.status}
            onChange={e => setField('status', e.target.value as BirthdayPackage['status'])}
            className={inputClass}
          >
            <option value="Published">Published</option>
            <option value="Draft">Draft</option>
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
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-xl bg-brand-terracotta px-5 py-2 font-bold text-brand-cream shadow-xs transition-all hover:bg-brand-terracotta-hover disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving…' : 'Save Package'}</span>
        </button>
      </div>
    </form>
  );
};
