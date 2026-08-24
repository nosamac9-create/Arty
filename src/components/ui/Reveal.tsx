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
  index = 0
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      custom={index}
      className={className}
    >
      {children}
    </motion.div>
  );
}
