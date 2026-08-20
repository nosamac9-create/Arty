/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { timeToMinutes } from '../../utils/timeUtils';

/** Quarter-hour steps only, so schedules stay on clean boundaries. */
const MINUTES = ['00', '15', '30', '45'] as const;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const PERIODS = ['AM', 'PM'] as const;

type Period = typeof PERIODS[number];

interface Parts {
  hour: number;
  minute: string;
  period: Period;
}

/** Reads a stored value into the three controls. Null when nothing is set. */
function toParts(value?: string): Parts | null {
  if (!value || !value.trim()) return null;

  const total = timeToMinutes(value);
  const h24 = Math.floor(total / 60) % 24;
  const rawMinute = total % 60;

  return {
    hour: h24 % 12 === 0 ? 12 : h24 % 12,
    // A legacy value on an odd minute snaps to the nearest step it can show,
    // rather than the field appearing blank because 10:07 is not on the list.
    minute: MINUTES.reduce((best, step) =>
      Math.abs(Number(step) - rawMinute) < Math.abs(Number(best) - rawMinute) ? step : best
    , MINUTES[0]),
    period: h24 >= 12 ? 'PM' : 'AM'
  };
}

/** The stored form: the same 12-hour string the schedule already saves. */
const toValue = ({ hour, minute, period }: Parts) =>
  `${String(hour).padStart(2, '0')}:${minute} ${period}`;

interface Props {
  value?: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** Optional fields offer a Clear action and may be left unset. */
  optional?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * A time field that cannot be mistyped: the value is only ever produced by
 * picking an hour, a minute and a period.
 *
 * The trigger is a button, not an input, so there is no text to type into at
 * all. What it stores is unchanged — the same "10:00 AM" string the schedule
 * has always saved — so existing records load and save without migration.
 */
export const TimePicker: React.FC<Props> = ({
  value, onChange, ariaLabel, optional, disabled, invalid
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // What the picker is showing. Seeded from the stored value each time it
  // opens, so reopening highlights the current selection.
  const [draft, setDraft] = useState<Parts>(() => toParts(value) || { hour: 10, minute: '00', period: 'AM' });

  useEffect(() => {
    if (open) setDraft(toParts(value) || { hour: 10, minute: '00', period: 'AM' });
  }, [open, value]);

  /** Clicking anywhere else closes it, leaving the form untouched. */
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /** Every tap commits immediately; Done is only a way to dismiss. */
  const commit = (next: Partial<Parts>) => {
    const merged = { ...draft, ...next };
    setDraft(merged);
    onChange(toValue(merged));
  };

  const selected = toParts(value);

  const optionClass = (isOn: boolean) =>
    `rounded-lg px-2 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
      isOn
        ? 'bg-brand-terracotta text-brand-cream'
        : 'text-brand-charcoal hover:bg-brand-sand'
    }`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className={`flex w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
          invalid ? 'border-red-400' : 'border-brand-clay hover:border-brand-muted'
        } ${value ? 'text-brand-charcoal' : 'text-brand-charcoal/40'}`}
      >
        <span className="truncate">{value || 'Set time'}</span>
        <Clock className="h-3.5 w-3.5 shrink-0 text-brand-charcoal/40" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-brand-clay bg-brand-cream p-2.5 shadow-card"
        >
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            {/* Hour */}
            <div>
              <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-brand-charcoal/45">
                Hour
              </p>
              <div className="max-h-36 space-y-0.5 overflow-y-auto always-scrollbar pe-0.5">
                {HOURS.map(hour => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => commit({ hour })}
                    className={`${optionClass(draft.hour === hour)} block w-full text-center`}
                  >
                    {hour}
                  </button>
                ))}
              </div>
            </div>

            {/* Minute */}
            <div>
              <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-brand-charcoal/45">
                Min
              </p>
              <div className="space-y-0.5">
                {MINUTES.map(minute => (
                  <button
                    key={minute}
                    type="button"
                    onClick={() => commit({ minute })}
                    className={`${optionClass(draft.minute === minute)} block w-full text-center`}
                  >
                    {minute}
                  </button>
                ))}
              </div>
            </div>

            {/* Period */}
            <div>
              <p className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-brand-charcoal/45">
                &nbsp;
              </p>
              <div className="space-y-0.5">
                {PERIODS.map(period => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => commit({ period })}
                    className={`${optionClass(draft.period === period)} block w-full text-center`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-brand-clay/60 pt-2">
            {optional && selected ? (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <X className="h-3 w-3" />
                <span>Clear</span>
              </button>
            ) : <span />}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-brand-terracotta px-3 py-1 text-[10px] font-bold text-brand-cream hover:bg-brand-terracotta-hover cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
