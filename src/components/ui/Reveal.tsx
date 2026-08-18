/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useReducedMotion, type Variants } from 'motion/react';
import { type ReactNode } from 'react';

const VARIANTS: Variants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(10px)' },
  show: (i: number = 0) => ({
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: 'easeOut' }
  })
};

/**
 * A blur-up fade-in, played once when the element scrolls into view.
 *
 * `index` staggers siblings against each other — a heading at 0 and its
 * subtext at 1 land 0.15s apart — which is why this is a separate component
 * from `ContainerAnimated`: that one takes its timing from a
 * `ContainerStagger` parent and cannot be delayed on its own.
 *
 * `cn` from `@/lib/utils` does not exist in this project, so the class is
 * passed straight through. Under `prefers-reduced-motion` the children are
 * rendered in a plain div — no variants, so nothing can leave text stuck at
 * `opacity: 0` or blurred for someone who asked for less movement.
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
