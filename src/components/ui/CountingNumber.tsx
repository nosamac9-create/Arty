/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type ValueAnimationTransition
} from 'motion/react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

export type CountingNumberRef = {
  startAnimation: () => void;
};

export type CountingNumberProps = {
  from?: number;
  target: number;
  transition?: ValueAnimationTransition;
  className?: string;
  onStart?: () => void;
  onComplete?: () => void;
  /** Start as soon as it mounts. Off by default here — see `startOnInView`. */
  autoStart?: boolean;
  /** Counts once the number is scrolled into view. */
  startOnInView?: boolean;
  /**
   * Group thousands with a separator. Off for years: 2021 must not read
   * "2,021".
   */
  groupThousands?: boolean;
};

/**
 * A number that counts up to its target.
 *
 * Adapted from the shadcn CountingNumber block. Three changes for this
 * codebase: `cn` from `@/lib/utils` does not exist so the class is composed
 * inline, the count can start when it scrolls into view rather than only on
 * mount, and thousands grouping is optional — the original always calls
 * `toLocaleString()`, which turns a year into "2,021".
 *
 * Under `prefers-reduced-motion` the target is rendered immediately, with no
 * counting at all.
 */
export const CountingNumber = forwardRef<CountingNumberRef, CountingNumberProps>(
  (
    {
      from = 0,
      target = 100,
      transition = { duration: 1.8, ease: 'easeOut', type: 'tween' },
      className = '',
      onStart,
      onComplete,
      autoStart = false,
      startOnInView = true,
      groupThousands = true,
      ...props
    },
    ref
  ) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const isInView = useInView(spanRef, { once: true, amount: 0.4 });
    const prefersReducedMotion = useReducedMotion();

    const count = useMotionValue(prefersReducedMotion ? target : from);
    const rounded = useTransform(count, latest => {
      const value = Math.round(latest);
      return groupThousands ? value.toLocaleString() : String(value);
    });
    const controlsRef = useRef<AnimationPlaybackControls | null>(null);

    const startAnimation = useCallback(() => {
      controlsRef.current?.stop();
      onStart?.();

      if (prefersReducedMotion) {
        count.set(target);
        onComplete?.();
        return;
      }

      count.set(from);
      controlsRef.current = animate(count, target, {
        ...transition,
        onComplete: () => onComplete?.()
      });
    }, [from, target, transition, onStart, onComplete, count, prefersReducedMotion]);

    useImperativeHandle(ref, () => ({ startAnimation }));

    useEffect(() => {
      if (autoStart || (startOnInView && isInView)) startAnimation();
      return () => controlsRef.current?.stop();
    }, [autoStart, startOnInView, isInView, startAnimation]);

    return (
      <motion.span ref={spanRef} className={`tabular-nums ${className}`} {...props}>
        {rounded}
      </motion.span>
    );
  }
);

CountingNumber.displayName = 'CountingNumber';

export default CountingNumber;
