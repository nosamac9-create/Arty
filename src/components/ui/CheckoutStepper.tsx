/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check } from 'lucide-react';

interface Props {
  steps: string[];
  /** 1-based index of the step being shown. */
  current: number;
}

/**
 * The workshop checkout's progress header.
 *
 * Deliberately a copy of the birthday reservation stepper's markup and classes
 * — same circle sizes, same fills, same connector, same label behaviour — so
 * the two flows read as one system. It is presentational only: the steps are
 * not buttons here, because the workshop flow's navigation is driven by the
 * form's own Continue and Back actions.
 */
export const CheckoutStepper: React.FC<Props> = ({ steps, current }) => (
  <nav aria-label="Checkout steps" className="mb-10 border-b border-brand-clay pb-5">
    <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:gap-4">
      {steps.map((label, index) => {
        const n = index + 1;
        const isCurrent = n === current;
        const isDone = n < current;
        return (
          <li key={label} className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div
              aria-current={isCurrent ? 'step' : undefined}
              className="flex items-center gap-2.5 rounded-full px-1 py-1 text-sm"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  isCurrent
                    ? 'bg-brand-terracotta text-brand-cream'
                    : isDone
                      ? 'bg-brand-sage text-brand-cream'
                      : 'border border-brand-clay bg-white text-brand-muted'
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : n}
              </span>
              <span
                className={`whitespace-nowrap font-semibold ${
                  isCurrent ? 'text-brand-charcoal' : 'text-brand-muted'
                } ${isCurrent ? '' : 'hidden sm:inline'}`}
              >
                {label}
              </span>
            </div>
            {n < steps.length && <span className="h-px w-4 bg-brand-clay sm:w-8" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);
