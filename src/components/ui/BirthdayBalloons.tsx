/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { Balloons, BalloonsHandle } from './Balloons';

/**
 * Launches the balloons-js animation once when the birthday section arrives.
 *
 * The trigger is unchanged from the CSS version this replaces: fire on entry,
 * never loop, and allow a fresh launch if the visitor scrolls away and back —
 * hence `once: false` on the observer with a latch, rather than a repeating
 * timer.
 *
 * The library owns the rendering, but not where it renders: `balloons()`
 * appends a fixed, full-viewport `<balloons>` layer to `documentElement`, which
 * put balloons over the entire site. There is no option for a mount point, so
 * the layer is adopted immediately after launch — moved into the wrapper below
 * and switched from fixed to absolute, which makes the wrapper's
 * `overflow-hidden` clip it to the birthday section.
 *
 * The layer keeps the library's own `pointer-events: none`, and the library
 * still removes it when the animation finishes, so nothing here can intercept a
 * click on the heading, the button or the package cards.
 */
export const BirthdayBalloons: React.FC = () => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const balloonsRef = useRef<BalloonsHandle>(null);
  // 0.2 rather than 0.35: the launch fires a little earlier in the scroll, so
  // the balloons are already on their way up by the time the section settles.
  // Appearance timing only — the rise itself is the library's and untouched.
  const isInView = useInView(anchorRef, { amount: 0.2 });
  const prefersReducedMotion = useReducedMotion();
  // Without the latch the effect would re-launch on every re-render that
  // happens while the section is still on screen.
  const launched = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) return;

    if (!isInView) {
      launched.current = false;
      return;
    }

    if (launched.current) return;
    launched.current = true;
    balloonsRef.current?.launchAnimation();

    // `balloons()` builds and appends its layer synchronously before resolving,
    // so the newest one is already in the document by the time this runs.
    const layers = document.documentElement.querySelectorAll(':scope > balloons');
    const layer = layers[layers.length - 1] as HTMLElement | undefined;
    if (layer && anchorRef.current) {
      anchorRef.current.appendChild(layer);
      // Fixed would still be measured against the viewport and escape the clip.
      layer.style.position = 'absolute';
      layer.style.inset = '0';
    }
  }, [isInView, prefersReducedMotion]);

  return (
    // `z-0` gives the wrapper its own stacking context, so the layer's
    // inline `z-index: 999` is contained and cannot rise above the copy,
    // the button or the package cards that follow it in the section.
    <div
      ref={anchorRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <Balloons ref={balloonsRef} />
    </div>
  );
};
