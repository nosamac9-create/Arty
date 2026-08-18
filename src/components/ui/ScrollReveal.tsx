/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  motion,
  useInView,
  useReducedMotion,
  type Transition,
  type UseInViewOptions,
  type Variant
} from 'motion/react';
import { type ReactNode, useRef, useState } from 'react';

export type ScrollRevealProps = {
  children: ReactNode;
  variants?: { hidden: Variant; visible: Variant };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: React.ElementType;
  once?: boolean;
  className?: string;
};

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

/**
 * Reveals its children as they scroll into view.
 *
 * Straight from the ScrollReveal block, with two additions this codebase needs:
 * a `className` pass-through (the wrapper sits inside grids, so it has to be
 * able to carry layout classes), and `prefers-reduced-motion`, under which the
 * children are simply rendered — no wrapper, no transition, nothing that could
 * leave content stuck at `opacity: 0` for someone who never triggers the
 * observer.
 */
export function ScrollReveal({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = 'div',
  once,
  className
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const MotionComponent = motion[as as keyof typeof motion] as typeof motion.div;

  if (prefersReducedMotion) {
    const Component = as as React.ElementType;
    return <Component className={className}>{children}</Component>;
  }

  return (
    <MotionComponent
      animate={isInView || isViewed ? 'visible' : 'hidden'}
      initial="hidden"
      onAnimationComplete={() => {
        // `isInView` is the load-bearing half of this condition. At mount
        // `initial` and `animate` are both "hidden", so there is nothing to
        // animate and motion fires onAnimationComplete immediately — without
        // the guard that latched `isViewed` true on the very first render, and
        // the element jumped to "visible" while still far below the fold. The
        // reveal then never played, for any caller of this component.
        if (once && isInView) setIsViewed(true);
      }}
      ref={ref}
      transition={transition}
      variants={variants}
      className={className}
    >
      {children}
    </MotionComponent>
  );
}

export default ScrollReveal;
