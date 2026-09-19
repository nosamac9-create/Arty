/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A practical multi-select for café tables: "Table 1 — 2 / 4 occupied — 2
 * free". Full or inactive tables are shown but not selectable, so staff never
 * have to work out seat math by hand — see utils/tableSeatingUtils.ts for the
 * one shared occupancy calculation this renders.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { TableSeatState, isTableSelectable } from '../../utils/tableSeatingUtils';
import { useLanguage } from '../../context/LanguageContext';
import type { Lang } from '../../context/LanguageContext';
import { enumLabel } from '../../utils/enumLabels';

export const TableSelector: React.FC<{
  tables: TableSeatState[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Guests still needing a seat, shown per-table so staff can eyeball fit. */
  participants?: number;
}> = ({ tables, selectedIds, onToggle, participants }) => {
  const { lang, t } = useLanguage();
  if (tables.length === 0) {
    return (
      <p className="text-xs font-semibold text-brand-charcoal/50 bg-brand-sand/30 border border-brand-clay/40 rounded-xl p-3">
        {t('No café tables are configured yet. Add them in Settings → Capacity → Table Inventory.', 'لم يتم إعداد أي طاولات مقهى بعد. أضفها من الإعدادات ← السعة ← جرد الطاولات.')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tables.map(table => {
        const isSelected = selectedIds.includes(table.id);
        const selectable = isTableSelectable(table) || isSelected;
        const isFull = table.freeSeats === 0 && !isSelected;
        const isInactive = table.status !== 'Active';

        return (
          <button
            key={table.id}
            type="button"
            disabled={!selectable}
            onClick={() => onToggle(table.id)}
            className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs font-bold transition-colors ${
              isSelected
                ? 'border-brand-terracotta bg-brand-terracotta/10 text-brand-charcoal cursor-pointer'
                : selectable
                  ? 'border-brand-clay bg-white text-brand-charcoal hover:border-brand-terracotta/60 cursor-pointer'
                  : 'border-brand-clay/50 bg-brand-sand/30 text-brand-charcoal/40 cursor-not-allowed'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border ${
                isSelected ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream' : 'border-brand-clay/60'
              }`}>
                {isSelected && <Check className="h-3 w-3" />}
              </span>
              <span>{table.name}</span>
            </span>

            <span className="font-mono text-[11px] font-bold">
              {isInactive
                ? enumLabel('resourceStatus', table.status, lang)
                : isFull
                  ? t('Full', 'ممتلئة')
                  : t(`${table.occupiedSeats + table.reservedSeats} / ${table.seats} occupied — ${table.freeSeats} free`, `${table.occupiedSeats + table.reservedSeats} / ${table.seats} مشغولة — ${table.freeSeats} شاغرة`)}
            </span>
          </button>
        );
      })}

      {typeof participants === 'number' && (
        <p className="text-[11px] font-semibold text-brand-charcoal/50 pt-1">
          {/* ⚠ ARABIC PLURALIZATION — placeholder only, needs a native speaker. */}{t(`This group needs ${participants} seat${participants === 1 ? '' : 's'}.`, `تحتاج هذه المجموعة إلى ${participants} مقاعد.`)}
        </p>
      )}
    </div>
  );
};

/** One line of capacity wording, shared by the picker's trigger chips and menu rows. */
function capacityLine(
  table: TableSeatState,
  isSelected: boolean,
  t: (en: string, ar: string) => string,
  lang: Lang
): string {
  if (table.status !== 'Active') return enumLabel('resourceStatus', table.status, lang);
  if (table.freeSeats === 0 && !isSelected) return t('Full', 'ممتلئة');
  return t(`${table.seats} seats · ${table.freeSeats} available`, `${table.seats} مقاعد · ${table.freeSeats} متاحة`);
}

/**
 * A compact dropdown/popover version of the same picker, for forms where a
 * full standing list of every table is too tall (the Add Walk-In modal has
 * a whole guest form above it). Closed, it is a single button; open, it is a
 * small scrollable panel. Selected tables show as removable chips underneath
 * rather than staying expanded in the form.
 */
export const TableMultiPicker: React.FC<{
  tables: TableSeatState[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  participants?: number;
  placeholder?: string;
}> = ({ tables, selectedIds, onChange, participants, placeholder }) => {
  const { lang, t } = useLanguage();
  const placeholderText = placeholder ?? t('Choose table(s) — Optional', 'اختر الطاولة/الطاولات — اختياري');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const selectedTables = selectedIds
    .map(id => tables.find(t => t.id === id))
    .filter((t): t is TableSeatState => !!t);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-brand-clay bg-white px-3.5 py-3 text-xs font-bold text-brand-charcoal cursor-pointer"
      >
        <span className={selectedIds.length === 0 ? 'text-brand-charcoal/50' : ''}>
          {selectedIds.length === 0
            ? placeholderText
            : t(`${selectedIds.length} table${selectedIds.length === 1 ? '' : 's'} selected`, selectedIds.length === 1 ? 'طاولة واحدة محددة' : `${selectedIds.length} طاولات محددة`)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-brand-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {selectedTables.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {selectedTables.map(table => (
            <span
              key={table.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-terracotta/10 border border-brand-terracotta/30 px-2.5 py-1 text-[11px] font-bold text-brand-terracotta"
            >
              {table.name}
              <button
                type="button"
                onClick={() => toggle(table.id)}
                aria-label={t(`Remove ${table.name}`, `إزالة ${table.name}`)}
                className="cursor-pointer text-brand-terracotta/70 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-brand-clay bg-white p-1.5 shadow-lg max-h-52 overflow-y-auto always-scrollbar space-y-1">
          {tables.length === 0 ? (
            <p className="p-2 text-[11px] font-semibold text-brand-charcoal/50">
              {t('No café tables are configured yet.', 'لم يتم إعداد أي طاولات مقهى بعد.')}
            </p>
          ) : (
            tables.map(table => {
              const isSelected = selectedIds.includes(table.id);
              const selectable = isTableSelectable(table) || isSelected;
              return (
                <button
                  key={table.id}
                  type="button"
                  disabled={!selectable}
                  onClick={() => toggle(table.id)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-brand-terracotta/10 cursor-pointer'
                      : selectable
                        ? 'hover:bg-brand-sand/50 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="text-xs font-bold text-brand-charcoal">{table.name}</span>
                    <span className="text-[11px] font-semibold text-brand-charcoal/50">
                      {capacityLine(table, isSelected, t, lang)}
                    </span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brand-terracotta" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {typeof participants === 'number' && (
        <p className="text-[11px] font-semibold text-brand-charcoal/50 pt-1.5">
          {/* ⚠ ARABIC PLURALIZATION — placeholder only, needs a native speaker. */}{t(`This group needs ${participants} seat${participants === 1 ? '' : 's'}.`, `تحتاج هذه المجموعة إلى ${participants} مقاعد.`)}
        </p>
      )}
    </div>
  );
};

export default TableSelector;
