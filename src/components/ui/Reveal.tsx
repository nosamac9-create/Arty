/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion, type Variants } from 'motion/react';
import { type ReactNode } from 'react';

const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' }
  })
};

/**
 * A fade and short rise, played once when the element scrolls into view.
 *
 * No blur: it read as heavy on type, and dropping it lets the whole reveal run
 * shorter — 0.4s over 20px — without the movement becoming hard to notice.
 *
 * `index` staggers siblings against each other — a heading at 0 and its
 * subtext at 1 land 0.1s apart — which is why this is a separate component
 * from `ContainerAnimated`: that one takes its timing from a
 * `ContainerStagger` parent and cannot be delayed on its own.
 *
 * `cn` from `@/lib/utils` does not exist in this project, so the class is
 * passed straight through. Under `prefers-reduced-motion` the children are
 * rendered in a plain div — no variants, so nothing can leave text stuck at
 * `opacity: 0` or mid-rise for someone who asked for less movement.
 */
export default function Reveal({
  children,
  className,
  index = 0,
  onMount = false
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  /**
   * Play on mount instead of on scroll.
   *
   * The default is viewport-triggered, which is why a heading at the top of a
   * page appears to animate "on load" — it is simply already in view when the
   * page mounts. Anything below the fold waits for the scroll instead, which is
   * the right behaviour for a long page and the wrong one for a grid the
   * customer is looking straight at.
   *
   * Opt-in, so every existing caller keeps the behaviour it has. The variants,
   * timing and stagger are shared either way, which is the point: change the
   * animation once and both triggers follow.
   */
  onMount?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={VARIANTS}
      initial="hidden"
      {...(onMount
        ? { animate: 'show' }
        : { whileInView: 'show', viewport: { once: true, amount: 0.2 } })}
      custom={index}
      className={className}
    >
      {children}
    </motion.div>
  );
}
