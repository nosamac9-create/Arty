/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { db } from '../db';
import { StudioTableConfig, CapacitySettingsConfig } from '../types';
import { Save, AlertTriangle, Plus, Trash2, Check, Shield } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';

export const AdminCapacitySettings: React.FC = () => {
  const { updateSetting } = useApp();
  const rawAppSettings = useLiveQuery(() => db.appSettings.toArray()) || [];
  const rawQueue = useLiveQuery(() => db.queue.toArray()) || [];

  const rawConfig = rawAppSettings.find(s => s.id === 'capacitySettings')?.value as CapacitySettingsConfig | undefined;

  const [totalTables, setTotalTables] = useState<number>(rawConfig?.totalTables ?? 8);
  const [totalSeats, setTotalSeats] = useState<number>(rawConfig?.totalSeats ?? 32);
  const [defaultSeatsPerTable, setDefaultSeatsPerTable] = useState<number>(rawConfig?.defaultSeatsPerTable ?? 4);
  const [maxGroupSize, setMaxGroupSize] = useState<number>(rawConfig?.maxGroupSize ?? 10);
  const [oneGroupPerTable, setOneGroupPerTable] = useState<boolean>(rawConfig?.oneGroupPerTable ?? false);
  const [tablesList, setTablesList] = useState<StudioTableConfig[]>(rawConfig?.tables ?? [
    { id: 'table-1', number: 1, name: 'Table 1', seats: 4, status: 'Active' },
    { id: 'table-2', number: 2, name: 'Table 2', seats: 4, status: 'Active' },
    { id: 'table-3', number: 3, name: 'Table 3', seats: 4, status: 'Active' },
    { id: 'table-4', number: 4, name: 'Table 4', seats: 4, status: 'Active' },
    { id: 'table-5', number: 5, name: 'Table 5', seats: 4, status: 'Active' },
    { id: 'table-6', number: 6, name: 'Table 6', seats: 4, status: 'Active' },
    { id: 'table-7', number: 7, name: 'Table 7', seats: 4, status: 'Active' },
    { id: 'table-8', number: 8, name: 'Table 8', seats: 4, status: 'Active' },
  ]);

  const [warningBanner, setWarningBanner] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (rawConfig) {
      if (rawConfig.totalTables !== undefined) setTotalTables(rawConfig.totalTables);
      if (rawConfig.totalSeats !== undefined) setTotalSeats(rawConfig.totalSeats);
      if (rawConfig.defaultSeatsPerTable !== undefined) setDefaultSeatsPerTable(rawConfig.defaultSeatsPerTable);
      if (rawConfig.maxGroupSize !== undefined) setMaxGroupSize(rawConfig.maxGroupSize);
      if (rawConfig.oneGroupPerTable !== undefined) setOneGroupPerTable(rawConfig.oneGroupPerTable);
      if (rawConfig.tables && rawConfig.tables.length > 0) setTablesList(rawConfig.tables);
    }
  }, [rawConfig]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sum active occupancy in Live Queue (In Progress or Waiting)
    const activeOccupancy = rawQueue
      .filter(q => q.status === 'In Progress' || q.status === 'Waiting')
      .reduce((sum, item) => sum + (item.participants || 1), 0);

    const newSeats = Number(totalSeats) || 32;

    const updatedConfig: CapacitySettingsConfig = {
      totalTables: Number(totalTables) || tablesList.length,
      totalSeats: newSeats,
      defaultSeatsPerTable: Number(defaultSeatsPerTable) || 4,
      maxGroupSize: Number(maxGroupSize) || 10,
      oneGroupPerTable,
      tables: tablesList
    };

    await updateSetting('capacitySettings', updatedConfig);

    if (activeOccupancy > newSeats) {
      setWarningBanner(
        `Current occupancy (${activeOccupancy} seats) exceeds newly configured capacity (${newSeats} seats). Active sessions are preserved, but available capacity is set to 0.`
      );
    } else {
      setWarningBanner(null);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleAddTable = () => {
    const nextNum = tablesList.length + 1;
    setTablesList([
      ...tablesList,
      {
        id: `table-${Date.now()}`,
        number: nextNum,
        name: `Table ${nextNum}`,
        seats: defaultSeatsPerTable,
        status: 'Active'
      }
    ]);
    setTotalTables(tablesList.length + 1);
    setTotalSeats(totalSeats + defaultSeatsPerTable);
  };

  const handleRemoveTable = (id: string) => {
    const tableToRemove = tablesList.find(t => t.id === id);
    if (!tableToRemove) return;
    const updated = tablesList.filter(t => t.id !== id);
    setTablesList(updated);
    setTotalTables(updated.length);
    setTotalSeats(Math.max(0, totalSeats - tableToRemove.seats));
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-200">
      <div className="border-b border-brand-clay/40 pb-4">
        <h2 className="font-display text-xl font-extrabold text-brand-charcoal">Studio & Queue Capacity Configuration</h2>
        <p className="text-xs text-brand-charcoal/70 mt-1">
          Manage live queue seat allocation, maximum group thresholds, table inventory, and seat counts across the studio.
        </p>
      </div>

      {/* Warning banner if current occupancy exceeds total seats */}
      {warningBanner && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-sm animate-in slide-in-from-top-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed font-semibold">
            <p className="font-bold uppercase tracking-wider text-[11px] text-amber-800">Capacity Warning</p>
            <p className="mt-0.5">{warningBanner}</p>
          </div>
        </div>
      )}

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>Capacity settings updated and applied across Live Queue & Admin modules!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Global capacity metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80 block">Total Tables</label>
            <input
              type="number"
              min={1}
              value={totalTables}
              onChange={e => setTotalTables(parseInt(e.target.value) || 1)}
              className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
            />
          </div>

          <div className="p-4 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80 block">Total Studio Seats</label>
            <input
              type="number"
              min={1}
              value={totalSeats}
              onChange={e => setTotalSeats(parseInt(e.target.value) || 1)}
              className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
            />
          </div>

          <div className="p-4 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80 block">Default Seats per Table</label>
            <input
              type="number"
              min={1}
              value={defaultSeatsPerTable}
              onChange={e => setDefaultSeatsPerTable(parseInt(e.target.value) || 1)}
              className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
            />
          </div>

          <div className="p-4 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-1">
            <label className="text-xs font-bold text-brand-charcoal/80 block">Max Walk-in Group Size</label>
            <input
              type="number"
              min={1}
              value={maxGroupSize}
              onChange={e => setMaxGroupSize(parseInt(e.target.value) || 1)}
              className="w-full bg-white border border-brand-clay rounded-xl py-2 px-3 text-sm font-bold text-brand-charcoal font-mono"
            />
          </div>
        </div>

        {/* Group per table policy */}
        <div className="p-4 bg-brand-cream/20 border border-brand-clay rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-brand-charcoal block">Strict Table Isolation (One Group per Table)</span>
            <span className="text-[11px] text-brand-charcoal/60">
              When enabled, a table is locked to a single group regardless of leftover unseated chairs.
            </span>
          </div>
          <input
            type="checkbox"
            checked={oneGroupPerTable}
            onChange={e => setOneGroupPerTable(e.target.checked)}
            className="h-5 w-5 rounded border-brand-clay text-brand-terracotta focus:ring-brand-terracotta cursor-pointer"
          />
        </div>

        {/* Tables Inventory Management */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-bold text-sm text-brand-charcoal uppercase tracking-wider">
              Table Inventory & Seating Map ({tablesList.length} Tables)
            </h3>
            <button
              type="button"
              onClick={handleAddTable}
              className="px-3 py-1.5 bg-brand-sand hover:bg-brand-sand/80 text-brand-charcoal rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-brand-terracotta" />
              <span>Add Table</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-brand-clay/60 rounded-2xl bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-cream/50 border-b border-brand-clay/60 text-[10px] uppercase font-bold text-brand-charcoal/70">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Table Name</th>
                  <th className="p-3">Seats</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30">
                {tablesList.map((t, idx) => (
                  <tr key={t.id} className="hover:bg-brand-cream/20">
                    <td className="p-3 font-mono font-bold text-brand-charcoal/60">{t.number}</td>
                    <td className="p-3 font-bold text-brand-charcoal">
                      <input
                        type="text"
                        value={t.name}
                        onChange={e => {
                          const updated = [...tablesList];
                          updated[idx].name = e.target.value;
                          setTablesList(updated);
                        }}
                        className="bg-transparent border border-brand-clay/40 rounded p-1 text-xs font-semibold text-brand-charcoal"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold">
                      <input
                        type="number"
                        min={1}
                        value={t.seats}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          const updated = [...tablesList];
                          const diff = val - updated[idx].seats;
                          updated[idx].seats = val;
                          setTablesList(updated);
                          setTotalSeats(Math.max(1, totalSeats + diff));
                        }}
                        className="w-16 bg-transparent border border-brand-clay/40 rounded p-1 text-xs font-semibold text-brand-charcoal text-center"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        value={t.status}
                        onChange={e => {
                          const updated = [...tablesList];
                          updated[idx].status = e.target.value as any;
                          setTablesList(updated);
                        }}
                        className="bg-white border border-brand-clay/60 text-[11px] font-bold rounded-lg px-2 py-1"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Maintenance">Maintenance</option>
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveTable(t.id)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-brand-clay/30 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>Save Capacity Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
