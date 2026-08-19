/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/**
 * The full-bleed studio slideshow behind the login / sign-up panel.
 *
 * Every image is mounted at once and only its opacity is animated, so a slide
 * change never waits on a network fetch — a fade to a half-loaded photo is the
 * one thing that reads as broken here.
 *
 * The scrim on top is not decoration: the panel sits over whichever photo is
 * showing, and these are bright studio shots. Without it the cream text and the
 * input borders wash out on the lighter frames.
 *
 * With `prefers-reduced-motion` there is no cycle and no zoom — one still
 * frame, and the interval is never started.
 */
/** Cross-fade and settle for the showcase image. */
const imageVariants = {
  initial: { opacity: 0, scale: 1.04 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const SLIDES = [
  { file: 'auth-01.jpg', alt: 'The Arty Café studio, paint-splattered tables under handmade lamps' },
  { file: 'auth-02.jpg', alt: 'A visitor looking at the portrait wall in the studio' },
  { file: 'auth-03.jpg', alt: 'A painter holding a loaded palette at the easel' }
];

/** Slow enough to read as ambient rather than as a carousel. */
const SLIDE_MS = 5500;

export const AuthBackdrop: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = window.setInterval(
      () => setIndex(i => (i + 1) % SLIDES.length),
      SLIDE_MS
    );
    return () => window.clearInterval(id);
  }, [prefersReducedMotion]);

  const active = prefersReducedMotion ? 0 : index;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Every frame is still mounted, so a slide change never waits on a
          network fetch; only the active one is opaque. The scale lives on this
          wrapper rather than the image, because the drift below animates
          `transform` too and the two would overwrite each other. */}
      <AnimatePresence initial={false}>
        {SLIDES.map((slide, i) => (
          i === active && (
            <motion.div
              key={slide.file}
              className="absolute inset-0"
              variants={imageVariants}
              initial={prefersReducedMotion ? false : 'initial'}
              animate="animate"
              exit={prefersReducedMotion ? undefined : 'exit'}
            >
              <img
                src={`${import.meta.env.BASE_URL}images/auth/${slide.file}`}
                alt={slide.alt}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className={`absolute inset-0 h-full w-full object-cover ${
                  prefersReducedMotion ? '' : 'auth-kenburns'
                }`}
              />
            </motion.div>
          )
        ))}
      </AnimatePresence>

      {/* The frames that are not showing stay in the document so the browser
          keeps them decoded and ready for their turn. */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-0">
        {SLIDES.map((slide, i) => (
          i !== active && (
            <img
              key={slide.file}
              src={`${import.meta.env.BASE_URL}images/auth/${slide.file}`}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )
        ))}
      </div>

      {/* Legibility scrim — kept dark at the centre where the panel sits. */}
      <div className="absolute inset-0 bg-brand-charcoal/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-charcoal/70 via-brand-charcoal/35 to-brand-charcoal/75" />
    </div>
  );
};
