/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../db';
import { EventsSettingsConfig } from '../types';
import { Save, Check, Calendar, Gift, Info } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export const AdminEventsSettings: React.FC = () => {
  const { updateSetting } = useApp();
  const rawAppSettings = useLiveQuery(() => db.appSettings.toArray()) || [];
  const rawConfig = rawAppSettings.find(s => s.id === 'eventsSettings')?.value as EventsSettingsConfig | undefined;

  const [minBirthdayNoticeDays, setMinBirthdayNoticeDays] = useState<number>(rawConfig?.minBirthdayNoticeDays ?? 4);
  const [maxGuestsPerEvent, setMaxGuestsPerEvent] = useState<number>(rawConfig?.maxGuestsPerEvent ?? 30);
  const [depositPercentage, setDepositPercentage] = useState<number>(rawConfig?.depositPercentage ?? 50);
  const [cancellationNoticeDays, setCancellationNoticeDays] = useState<number>(rawConfig?.cancellationNoticeDays ?? 3);

  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

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
      minBirthdayNoticeDays: Number(minBirthdayNoticeDays),
      maxGuestsPerEvent: Number(maxGuestsPerEvent),
      depositPercentage: Number(depositPercentage),
      cancellationNoticeDays: Number(cancellationNoticeDays)
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
    </div>
  );
};
