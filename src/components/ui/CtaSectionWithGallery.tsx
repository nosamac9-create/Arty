/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { HTMLMotionProps, Variants, motion } from 'motion/react';

/**
 * Layout and entrance animation from the CTA-section-with-gallery block.
 *
 * Only the containers and their motion behaviour are taken: a stagger parent, a
 * blur-in child, and a two-column offset grid whose cells fade in one after the
 * other. What goes in the cells is the caller's business — here that is the
 * site's real workshop cards, not photographs.
 *
 * `cn` from `@/lib/utils` is not available in this project, so classes are
 * composed with plain template strings.
 */

const SPRING_TRANSITION_CONFIG = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 16,
  mass: 0.75,
  restDelta: 0.005
};

const filterVariants: Variants = {
  hidden: { opacity: 0, filter: 'blur(10px)' },
  visible: { opacity: 1, filter: 'blur(0px)' }
};

/** Parent that plays its children in sequence once scrolled into view. */
export const ContainerStagger = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ transition, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      transition={{
        staggerChildren: transition?.staggerChildren ?? 0.2,
        delayChildren: transition?.delayChildren ?? 0.2,
        duration: 0.3,
        ...transition
      }}
      {...props}
    />
  )
);
ContainerStagger.displayName = 'ContainerStagger';

/** A single line of the stagger: fades up out of a blur. */
export const ContainerAnimated = React.forwardRef<HTMLDivElement, HTMLMotionProps<'div'>>(
  ({ transition, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={filterVariants}
      transition={{ ...SPRING_TRANSITION_CONFIG, duration: 0.3, ...transition }}
      {...props}
    />
  )
);
ContainerAnimated.displayName = 'ContainerAnimated';

/**
 * The offset two-column grid.
 *
 * The original pins four cells to hard-coded grid areas over fixed 50px/150px
 * rows. That cannot hold a workshop card — the card is as tall as its own
 * content, a 150px row would crop it, and a fifth workshop would land on an
 * `areaClasses[4]` that does not exist, so the cell would render with no
 * position at all.
 *
 * So the interlock is produced the other way round: two columns of
 * content-height cells, with the second column pushed down half a card. The
 * staggered offset reads the same, every card keeps its real height, and any
 * number of workshops lays out without breaking. One workshop gets a single
 * column, which is the sensible thing for one workshop.
 */
export const GalleryGrid = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 ${className}`}
      {...props}
    />
  )
);
GalleryGrid.displayName = 'GalleryGrid';

interface GalleryGridCellProps extends HTMLMotionProps<'div'> {
  index: number;
}

/**
 * One cell. Fades in on its own beat, and every second cell sits lower than
 * its neighbour — the offset only applies once the grid is actually two
 * columns wide, or a phone would show a random gap above the second card.
 */
export const GalleryGridCell = React.forwardRef<HTMLDivElement, GalleryGridCellProps>(
  ({ className = '', transition, index, ...props }, ref) => {
    const isOffsetColumn = index % 2 === 1;

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{
          duration: 0.3,
          delay: index * 0.2,
          delayChildren: transition?.delayChildren ?? 0.2,
          ...transition
        }}
        className={`relative ${isOffsetColumn ? 'sm:mt-10' : ''} ${className}`}
        {...props}
      />
    );
  }
);
GalleryGridCell.displayName = 'GalleryGridCell';
