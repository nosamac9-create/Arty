/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The only date picker used in the app — a self-contained English Gregorian
 * calendar.
 *
 * A native `<input type="date">` renders its picker from the browser/OS locale.
 * Safari in particular ignores the element's `lang` and follows the macOS system
 * calendar, so on a device set to Umm al-Qura the picker opens in Hijri while the
 * stored value stays ISO Gregorian. This component draws its own month grid, so
 * the calendar is Gregorian on every browser and OS.
 *
 * The public contract is unchanged: the value is an ISO `YYYY-MM-DD` string and
 * `onChange` receives `{ target: { value } }`, so every call site and every
 * date-based business rule keeps working exactly as before.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MONTH_NAMES, MONTH_NAMES_SHORT, WEEKDAY_NAMES_SHORT, CALENDAR_INPUT_PROPS } from '../utils/calendarConfig';

export interface DateInputProps {
  /** ISO date, `YYYY-MM-DD`. */
  value?: string;
  onChange?: (event: { target: { value: string } }) => void;
  /** Earliest selectable ISO date. */
  min?: string;
  /** Latest selectable ISO date. */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  title?: string;
}

/** Parses `YYYY-MM-DD` into its parts. Returns null for empty or malformed input. */
function parseISO(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "04 Aug 2026" — always English Gregorian, never a locale-formatted string. */
function formatDisplay(value?: string): string {
  const parsed = parseISO(value);
  if (!parsed) return '';
  return `${String(parsed.day).padStart(2, '0')} ${MONTH_NAMES_SHORT[parsed.month - 1]} ${parsed.year}`;
}

export const DateInput: React.FC<DateInputProps> = ({
  value = '',
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  className = '',
  id,
  name,
  placeholder = 'Select date',
  title
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);

  // Month currently shown in the grid.
  const [viewYear, setViewYear] = useState(() => selected?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected?.month ?? new Date().getMonth() + 1));

  // Follow the selected value when it changes from outside.
  useEffect(() => {
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click or Escape.
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const grid = useMemo(() => {
    // Gregorian month maths, independent of any locale calendar.
    const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day, iso: toISO(viewYear, viewMonth, day) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const todayISO = useMemo(() => {
    const now = new Date();
    return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }, []);

  const isOutOfRange = (iso: string) => {
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const commit = (iso: string) => {
    onChange?.({ target: { value: iso } });
    setIsOpen(false);
  };

  const stepMonth = (delta: number) => {
    let month = viewMonth + delta;
    let year = viewYear;
    while (month < 1) { month += 12; year -= 1; }
    while (month > 12) { month -= 12; year += 1; }
    setViewMonth(month);
    setViewYear(year);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Read-only display field. Keeps `required` form validation working while
          never opening the OS calendar widget. */}
      <input
        {...CALENDAR_INPUT_PROPS}
        type="text"
        id={id}
        name={name}
        readOnly
        required={required}
        disabled={disabled}
        title={title}
        placeholder={placeholder}
        value={formatDisplay(value)}
        onClick={() => !disabled && setIsOpen(open => !open)}
        onKeyDown={event => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen(open => !open);
          }
        }}
        className={`${className} cursor-pointer`}
        autoComplete="off"
      />

      {isOpen && !disabled && (
        <div className="absolute left-0 top-full mt-1 z-[60] w-[264px] bg-white border border-brand-clay rounded-2xl shadow-xl p-3 text-left animate-in fade-in duration-100">

          {/* Month / year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => stepMonth(-1)}
              className="p-1.5 rounded-lg hover:bg-brand-sand text-brand-charcoal/70 cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                className="bg-brand-cream/50 border border-brand-clay rounded-lg px-1.5 py-1 text-[11px] font-bold text-brand-charcoal cursor-pointer"
              >
                {MONTH_NAMES.map((label, idx) => (
                  <option key={label} value={idx + 1}>{label}</option>
                ))}
              </select>
              <input
                type="number"
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value) || viewYear)}
                className="w-[62px] bg-brand-cream/50 border border-brand-clay rounded-lg px-1.5 py-1 text-[11px] font-bold text-brand-charcoal font-mono"
              />
            </div>

            <button
              type="button"
              onClick={() => stepMonth(1)}
              className="p-1.5 rounded-lg hover:bg-brand-sand text-brand-charcoal/70 cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* English weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAY_NAMES_SHORT.map(day => (
              <div key={day} className="text-center text-[9px] font-bold uppercase text-brand-charcoal/45 py-1">
                {day.charAt(0)}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((cell, idx) => {
              if (!cell) return <div key={`pad-${idx}`} />;

              const isSelected = cell.iso === value;
              const isToday = cell.iso === todayISO;
              const disabledDay = isOutOfRange(cell.iso);

              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => commit(cell.iso)}
                  className={`h-7 rounded-lg text-[11px] font-bold transition-colors ${
                    disabledDay
                      ? 'text-brand-charcoal/25 cursor-not-allowed'
                      : isSelected
                        ? 'bg-brand-terracotta text-brand-cream cursor-pointer'
                        : isToday
                          ? 'bg-brand-sand text-brand-terracotta cursor-pointer hover:bg-brand-clay/50'
                          : 'text-brand-charcoal hover:bg-brand-sand/60 cursor-pointer'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-brand-clay/50">
            <button
              type="button"
              onClick={() => !isOutOfRange(todayISO) && commit(todayISO)}
              disabled={isOutOfRange(todayISO)}
              className="text-[10px] font-bold text-brand-terracotta hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
            >
              Today
            </button>

            <div className="flex items-center gap-2">
              {!required && value && (
                <button
                  type="button"
                  onClick={() => commit('')}
                  className="text-[10px] font-bold text-brand-charcoal/50 hover:text-red-600 flex items-center gap-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Clear</span>
                </button>
              )}
              <span className="text-[9px] font-bold text-brand-charcoal/35 flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                <span>Gregorian</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Time picker. Native `<input type="time">` has no calendar, so it stays native
 * but is still pinned to the English locale for its AM/PM rendering.
 */
export const TimeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = '', ...props }) => (
  <input {...CALENDAR_INPUT_PROPS} {...props} type="time" className={className} />
);

/** Month picker built on the same Gregorian calendar; value is `YYYY-MM`. */
export const MonthInput: React.FC<DateInputProps> = ({ value = '', onChange, ...rest }) => (
  <DateInput
    {...rest}
    value={value ? `${value}-01` : ''}
    onChange={event => onChange?.({ target: { value: event.target.value.slice(0, 7) } })}
  />
);
