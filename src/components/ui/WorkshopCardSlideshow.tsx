/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The image area of a workshop listing card: the workshop's own photographs,
 * cross-fading in place.
 *
 * Self-contained on purpose. The cycling index lives here, so a card changing
 * its photograph re-renders that card's image frame and nothing else — the
 * workshops page, its filters and the other cards are untouched by the tick.
 *
 * The transition is the login backdrop's (`AuthBackdrop.tsx`): a fade with a
 * small settle out of a 4% scale, 0.55s on [0.16, 1, 0.3, 1], leaving over
 * 0.3s. The values are duplicated rather than imported so nothing about the
 * auth screen has to change to share them; if one is ever retuned, retune both.
 *
 * As there, every frame stays mounted and only opacity animates, so a change
 * never waits on a network fetch — a fade to a half-loaded photo is the one
 * thing that reads as broken.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppImage } from './AppImage';
import { Workshop } from '../../types';

/** Cross-fade and settle, from the login backdrop. */
const imageVariants = {
  initial: { opacity: 0, scale: 1.04 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

/** Long enough to actually look at a photograph before it moves on. */
const DEFAULT_INTERVAL_MS = 3800;

/** Per-card offset, so the cards on screen do not all turn over together. */
const STAGGER_MS = 400;

/** How many cards get their own offset before it wraps. */
const STAGGER_CYCLE = 4;

/**
 * Every image a workshop has: the cover first, then the rest in the order
 * staff arranged them in the console.
 *
 * This is the same list the detail page builds, from the same two fields —
 * there is no separate card gallery, and nothing new is stored. A workshop
 * saved before multiple photos existed has an empty `additionalImages` and
 * simply yields a list of one.
 */
export function workshopGalleryImages(workshop: Pick<Workshop, 'image' | 'additionalImages'>): string[] {
  return [workshop.image, ...(workshop.additionalImages || [])].filter(
    (src): src is string => typeof src === 'string' && src.trim() !== ''
  );
}

export interface WorkshopCardSlideshowProps {
  images: string[];
  alt: string;
  /** Classes for the image itself, so the card keeps its own crop and hover. */
  className?: string;
  /** Position in the grid, used only to offset when this card starts. */
  cardIndex?: number;
  intervalMs?: number;
}

export const WorkshopCardSlideshow: React.FC<WorkshopCardSlideshowProps> = ({
  images,
  alt,
  className = '',
  cardIndex = 0,
  intervalMs = DEFAULT_INTERVAL_MS
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<string, true>>({});

  // A stable key for the list: the parent rebuilds the array every render, so
  // depending on the array itself would restart the cycle on any unrelated
  // state change anywhere above this card.
  const key = images.join('|');

  /**
   * Decode ahead and find the duds in one pass. Warming the cache is what
   * stops the first change from flashing an empty frame, and an image that
   * cannot load is dropped from the rotation rather than being cross-faded to
   * as a blank.
   */
  useEffect(() => {
    setBroken({});
    const probes = images.map(src => {
      const probe = new Image();
      probe.onerror = () => setBroken(previous => ({ ...previous, [src]: true }));
      probe.src = src;
      return probe;
    });
    return () => probes.forEach(probe => { probe.onerror = null; });
  }, [key]);

  // The cover is kept even if it failed, so a card is never an empty box: the
  // retry in AppImage may still recover it after the probe gave up.
  const usable = useMemo(() => {
    const healthy = images.filter(src => !broken[src]);
    return healthy.length > 0 ? healthy : images.slice(0, 1);
  }, [key, broken]);

  const count = usable.length;

  useEffect(() => {
    // One photograph has nothing to cycle to, and reduced motion holds on the
    // cover rather than swapping stills on a timer.
    if (prefersReducedMotion || count < 2) return;

    let interval: number | undefined;
    // Offset only the start. Once running, every card shares one period, so
    // the stagger cannot drift or compound.
    const start = window.setTimeout(() => {
      setIndex(i => (i + 1) % count);
      interval = window.setInterval(() => setIndex(i => (i + 1) % count), intervalMs);
    }, intervalMs + (cardIndex % STAGGER_CYCLE) * STAGGER_MS);

    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [count, intervalMs, cardIndex, prefersReducedMotion]);

  // A shrinking list (an image turned out to be broken) must not leave the
  // index pointing past the end.
  const active = prefersReducedMotion ? 0 : index % Math.max(count, 1);

  if (count === 0) return null;

  return (
    <>
      <AnimatePresence initial={false}>
        {usable.map((src, i) => (
          i === active && (
            <motion.div
              key={src}
              className="absolute inset-0"
              variants={imageVariants}
              // No entrance on the first paint: the card itself is already
              // being revealed by the grid, and fading the cover in again on
              // top of that reads as a flicker.
              initial={prefersReducedMotion ? false : 'initial'}
              animate="animate"
              exit={prefersReducedMotion ? undefined : 'exit'}
            >
              <AppImage
                src={src}
                alt={i === 0 ? alt : ''}
                className={className}
                referrerPolicy="no-referrer"
                draggable={false}
              />
            </motion.div>
          )
        ))}
      </AnimatePresence>

      {/* The frames that are not showing stay in the document so the browser
          keeps them decoded and ready for their turn. */}
      {count > 1 && (
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-0" aria-hidden="true">
          {usable.map((src, i) => (
            i !== active && (
              <AppImage
                key={src}
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )
          ))}
        </div>
      )}
    </>
  );
};
