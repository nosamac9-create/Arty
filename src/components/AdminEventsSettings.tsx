/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../db';
import {
  EventsSettingsConfig, BirthdayFormField, BirthdayTermsConfig,
  DEFAULT_BIRTHDAY_TERMS, renderTermsLine
} from '../types';
import {
  Save, Check, Calendar, Gift, Info, Plus, Trash2, ChevronUp, ChevronDown, ListChecks, ShieldAlert
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export const AdminEventsSettings: React.FC = () => {
  const { updateSetting, birthdayFormFields, updateBirthdayFormFields } = useApp();
  const rawAppSettings = useLiveQuery(() => db.appSettings.toArray()) || [];
  const rawConfig = rawAppSettings.find(s => s.id === 'eventsSettings')?.value as EventsSettingsConfig | undefined;

  const [minBirthdayNoticeDays, setMinBirthdayNoticeDays] = useState<number>(rawConfig?.minBirthdayNoticeDays ?? 4);
  const [maxGuestsPerEvent, setMaxGuestsPerEvent] = useState<number>(rawConfig?.maxGuestsPerEvent ?? 30);
  const [depositPercentage, setDepositPercentage] = useState<number>(rawConfig?.depositPercentage ?? 50);
  const [cancellationNoticeDays, setCancellationNoticeDays] = useState<number>(rawConfig?.cancellationNoticeDays ?? 3);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // ---- Editable birthday terms (customer-facing) ----
  const [terms, setTerms] = useState<BirthdayTermsConfig>(rawConfig?.birthdayTerms || DEFAULT_BIRTHDAY_TERMS);
  const [termsSaved, setTermsSaved] = useState(false);

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
    if (!window.confirm(`Remove the "${field.label}" field from the birthday booking form?`)) return;
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
      alert("Notice days must be a non-negative integer.");
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
      <div className="border-b border-brand-clay/40 pb-4">
        <h2 className="font-display text-xl font-extrabold text-brand-charcoal">Events & Birthday Settings</h2>
        <p className="text-xs text-brand-charcoal/70 mt-1">
          Configure global notice windows, capacity restrictions, and deposit parameters for private events and birthday bookings.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>Events settings saved! Birthday booking form validation updated.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Min Birthday Booking Notice */}
          <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-brand-terracotta">
              <Gift className="h-5 w-5" />
              <h3 className="font-display font-bold text-sm text-brand-charcoal">Minimum Birthday Booking Notice (Days)</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              Customers must pick a date at least this many days in advance when submitting a birthday package request.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Notice Days</label>
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
              <h3 className="font-display font-bold text-sm text-brand-charcoal font-display">Maximum Guests Per Private Event</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              Upper guest limit allowed per private event package reservation.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Max Guests</label>
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
              <h3 className="font-display font-bold text-sm text-brand-charcoal">Event Reservation Deposit (%)</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              Required deposit percentage for private event confirmations.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Deposit (%)</label>
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
              <h3 className="font-display font-bold text-sm text-brand-charcoal font-display">Cancellation Notice Window (Days)</h3>
            </div>
            <p className="text-xs text-brand-charcoal/60 leading-relaxed">
              Minimum notice required for full deposit refund upon cancellation.
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Cancellation Window (Days)</label>
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
            <span>Save Events Settings</span>
          </button>
        </div>
      </form>


      {/* ================================================================= */}
      {/* BIRTHDAY TERMS & GUIDELINES — the customer-facing text, editable   */}
      {/* here rather than hardcoded on the Customer Site.                   */}
      {/* ================================================================= */}
      <div className="pt-6 border-t border-brand-clay/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-brand-terracotta" />
              <span>Birthday Terms &amp; Guidelines</span>
            </h3>
            <p className="text-xs text-brand-charcoal/70 mt-1">
              Shown to the customer before they submit a birthday reservation, and they must accept it.
              Use <span className="font-mono font-bold">{'{deposit}'}</span> and{' '}
              <span className="font-mono font-bold">{'{cancellationDays}'}</span> so the wording follows the
              configured values instead of fixed numbers.
            </p>
            {terms.version && (
              <p className="text-[10px] font-mono font-bold text-brand-charcoal/45 mt-1">
                Current version: {terms.version}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveTerms}
            className="px-5 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>Save Terms</span>
          </button>
        </div>

        {termsSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Terms saved. New reservations will record this version on acceptance.</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Section Title</label>
              <input
                type="text"
                value={terms.title}
                onChange={e => setTerms({ ...terms, title: e.target.value })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-bold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Opening Lines (one per line)</label>
              <textarea
                rows={2}
                value={terms.leadingItems.join('\n')}
                onChange={e => setTerms({ ...terms, leadingItems: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Supplies Intro</label>
              <input
                type="text"
                value={terms.suppliesIntro}
                onChange={e => setTerms({ ...terms, suppliesIntro: e.target.value })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Supplies List (one per line, shown numbered)</label>
              <textarea
                rows={4}
                value={terms.supplies.join('\n')}
                onChange={e => setTerms({ ...terms, supplies: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block">Closing Lines (one per line)</label>
              <textarea
                rows={4}
                value={terms.trailingItems.join('\n')}
                onChange={e => setTerms({ ...terms, trailingItems: e.target.value.split('\n').map(v => v.trim()).filter(Boolean) })}
                className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
              />
            </div>
          </div>

          {/* Live preview with the placeholders resolved */}
          <div className="p-5 bg-brand-cream/50 border border-brand-clay rounded-2xl space-y-3">
            <p className="text-[10px] font-bold text-brand-charcoal/50 uppercase tracking-wider">
              Customer Preview
            </p>
            <h4 className="font-display text-base font-bold text-brand-terracotta">{terms.title}</h4>
            <div className="text-xs space-y-2 text-brand-charcoal/85 leading-relaxed">
              {terms.leadingItems.map(line => (
                <p key={line} className="font-semibold">
                  {renderTermsLine(line, { deposit: 500, cancellationDays: Number(cancellationNoticeDays) || 4 })}
                </p>
              ))}
              {terms.supplies.length > 0 && (
                <div>
                  <p className="font-semibold">{terms.suppliesIntro}</p>
                  <ol className="list-decimal pl-5 space-y-0.5 font-medium text-brand-charcoal/75">
                    {terms.supplies.map(item => <li key={item}>{item}</li>)}
                  </ol>
                </div>
              )}
              {terms.trailingItems.map(line => (
                <p key={line} className="font-medium">
                  {renderTermsLine(line, { deposit: 500, cancellationDays: Number(cancellationNoticeDays) || 4 })}
                </p>
              ))}
            </div>
            <p className="text-[10px] text-brand-charcoal/45 pt-2 border-t border-brand-clay/40">
              Deposit shown here uses 500 SAR as an example; the reservation page uses the selected package's deposit.
            </p>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* BIRTHDAY BOOKING FORM FIELDS — configured here, not on the        */}
      {/* Birthday Event page (which edits package details only).           */}
      {/* ================================================================= */}
      <div className="pt-6 border-t border-brand-clay/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold text-brand-charcoal flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-brand-terracotta" />
              <span>Birthday Booking Form Fields</span>
            </h3>
            <p className="text-xs text-brand-charcoal/70 mt-1">
              Add, edit, remove, enable, disable and reorder the fields customers fill in when booking a birthday package.
              Package details themselves are edited in the Birthday Event page.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddField}
            className="px-4 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Field</span>
          </button>
        </div>

        {fieldsSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>Booking form updated. The customer birthday form now uses these fields.</span>
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
                    <span className="text-[9px] font-bold uppercase bg-brand-sand text-brand-charcoal/70 px-1.5 py-0.5 rounded">Core</span>
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
                    {field.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    type="button"
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => handleMoveField(index, -1)}
                    className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Move down"
                    disabled={index === birthdayFormFields.length - 1}
                    onClick={() => handleMoveField(index, 1)}
                    className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={field.system ? 'Core fields cannot be removed — disable instead' : 'Remove field'}
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
                  <label className="font-bold text-brand-charcoal/70 block">Label</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={e => handleFieldChange(field.id, { label: e.target.value })}
                    className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">Type</label>
                  <select
                    value={field.type}
                    disabled={field.system}
                    onChange={e => handleFieldChange(field.id, { type: e.target.value as BirthdayFormField['type'] })}
                    className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold disabled:opacity-60"
                  >
                    <option value="short_text">Short text</option>
                    <option value="long_text">Long text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="time">Time</option>
                    <option value="phone">Phone</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="package">Package selector</option>
                    <option value="image">Image upload</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">Required</label>
                  <button
                    type="button"
                    onClick={() => handleFieldChange(field.id, { required: !field.required })}
                    className={`w-full py-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                      field.required
                        ? 'bg-brand-terracotta/10 border-brand-terracotta/40 text-brand-terracotta'
                        : 'bg-brand-cream/40 border-brand-clay text-brand-charcoal/60'
                    }`}
                  >
                    {field.required ? 'Required' : 'Optional'}
                  </button>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="font-bold text-brand-charcoal/70 block">Placeholder / Help Text</label>
                  <input
                    type="text"
                    value={field.placeholder || field.helpText || ''}
                    onChange={e => handleFieldChange(field.id, { placeholder: e.target.value })}
                    className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                  />
                </div>

                {field.type === 'dropdown' && (
                  <div className="sm:col-span-3 space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">Options (one per line)</label>
                    <textarea
                      rows={4}
                      value={(field.options || []).join('\n')}
                      onChange={e => handleFieldChange(field.id, {
                        options: e.target.value.split('\n').map(v => v.trim()).filter(Boolean)
                      })}
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
