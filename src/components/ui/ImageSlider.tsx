/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

interface ImageSliderProps {
  images: string[];
  alt?: string;
  autoPlay?: boolean;
  interval?: number;
  /** Thumbnail strip under the slider. Hidden automatically for one image. */
  showThumbnails?: boolean;
  /** How long auto-cycling holds after a manual pick, in ms. */
  pauseDuration?: number;
  className?: string;
}

/**
 * An auto-rotating image slider with clickable dots.
 *
 * Adapted from the ImageSlider block. The import is the project's existing
 * `motion/react` rather than `framer-motion` — same library, current name —
 * so the app does not end up carrying two animation packages.
 *
 * Three things the original does not handle that a real workshop needs:
 *
 *  - Duplicate and empty sources are dropped, so a workshop whose only photo is
 *    repeated does not rotate between two identical frames.
 *  - A single image renders as a plain image with no timer and no dots.
 *  - A source that fails to load is removed from the rotation rather than
 *    leaving a broken frame in the cycle.
 *
 * The timer is paused under `prefers-reduced-motion`: the first image is shown
 * and the dots still work, so nothing is unreachable — it simply does not move
 * on its own.
 */
export function ImageSlider({
  images,
  alt = '',
  autoPlay = true,
  interval = 4000,
  showThumbnails = true,
  pauseDuration = 15000,
  className = ''
}: ImageSliderProps) {
  const prefersReducedMotion = useReducedMotion();

  const sources = useMemo(
    () => Array.from(new Set(images.filter(src => typeof src === 'string' && src.trim() !== ''))),
    [images]
  );

  const [broken, setBroken] = useState<string[]>([]);
  // A transient load failure (a network blip, a request racing the browser's
  // cache) must not permanently drop a real photo out of the rotation for
  // the rest of the visit — that is exactly what made this "fixed by
  // refreshing the page" for customers. Each source gets a few retries
  // (tracked by a cache-busting suffix) before it is treated as broken.
  const [retryTokens, setRetryTokens] = useState<Record<string, number>>({});
  const usable = sources.filter(src => !broken.includes(src));
  const slides = usable.length > 0 ? usable : sources.slice(0, 1);
  const MAX_SLIDE_RETRIES = 3;

  const resolveSrc = (src: string) => {
    const token = retryTokens[src];
    if (!token || src.startsWith('data:')) return src;
    return `${src}${src.includes('?') ? '&' : '?'}retry=${token}`;
  };

  const [currentIndex, setCurrentIndex] = useState(0);

  // A shrinking list must never leave the index past its end.
  useEffect(() => {
    setCurrentIndex(i => (i < slides.length ? i : 0));
  }, [slides.length]);

  /**
   * Picking an image by hand pauses the rotation and holds on it, so someone
   * reading a photo is not moved off it mid-look. The hold restarts on each
   * pick rather than stacking, and cycling resumes from whatever they chose.
   */
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimer = useRef<number | null>(null);

  const selectSlide = (index: number) => {
    setCurrentIndex(index);
    setIsPaused(true);

    // One timer only: a second pick replaces the first rather than leaving it
    // to fire and resume early.
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimer.current = null;
    }, pauseDuration);
  };

  // Unmounting mid-pause must not leave a timer holding a dead setState.
  useEffect(
    () => () => {
      if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!autoPlay || prefersReducedMotion || isPaused || slides.length < 2) return;
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, slides.length, prefersReducedMotion, isPaused]);

  if (slides.length === 0) {
    return <div className={`bg-brand-sand ${className}`} />;
  }

  const single = slides.length === 1;
  const centreSrc = slides[Math.min(currentIndex, slides.length - 1)];

  const markBroken = (src: string) =>
    setBroken(prev => (prev.includes(src) ? prev : [...prev, src]));

  /** Retries a failed source a few times before giving up on it for good. */
  const handleError = (src: string) => {
    if (src.startsWith('data:')) return markBroken(src);
    const attempt = retryTokens[src] || 0;
    if (attempt >= MAX_SLIDE_RETRIES) {
      markBroken(src);
      return;
    }
    window.setTimeout(() => {
      setRetryTokens(prev => ({ ...prev, [src]: attempt + 1 }));
    }, 700 * (attempt + 1));
  };

  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden bg-brand-sand ${className}`}>

        {single || prefersReducedMotion ? (
          /* One image, or someone who asked for less movement: the centre
             frame plainly, no stack and no 3D. */
          <img
            src={resolveSrc(centreSrc)}
            alt={alt}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => handleError(centreSrc)}
          />
        ) : (
          /* The fanned stack. Cards are sized against the container rather
             than in fixed pixels, so the coverflow fits the image area the
             page already gives it at every width. */
          <div className="absolute inset-0 flex items-center justify-center [perspective:1000px]">
            {slides.map((slide, index) => {
              const offset = index - currentIndex;
              const total = slides.length;
              let pos = (offset + total) % total;
              if (pos > Math.floor(total / 2)) pos = pos - total;

              const isCenter = pos === 0;
              const isAdjacent = Math.abs(pos) === 1;

              // The peek fades out toward the OUTER edge, so the strip ends in
              // nothing rather than in a hard vertical cut against the beige.
              // Per side, because the direction differs: the left peek fades
              // leftward, the right one rightward. Inline rather than a Tailwind
              // class — the direction is decided at runtime, and Tailwind only
              // emits classes it can find in the source text.
              const peekFade = isCenter
                ? undefined
                : pos < 0
                  ? 'linear-gradient(to right, transparent 0%, black 65%)'
                  : 'linear-gradient(to left, transparent 0%, black 65%)';

              return (
                <div
                  key={slide}
                  className="absolute h-full w-[88%] transition-all duration-500 ease-in-out"
                  style={{
                    transform: `
                      translateX(${pos * 45}%)
                      scale(${isCenter ? 1 : isAdjacent ? 0.85 : 0.7})
                      rotateY(${pos * -10}deg)
                    `,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? 0.4 : 0,
                    filter: isCenter ? 'blur(0px)' : 'blur(4px)',
                    visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible',
                    maskImage: peekFade,
                    WebkitMaskImage: peekFade
                  }}
                  aria-hidden={!isCenter}
                >
                  {/* Rounded, but no border. The beige outline that used to sit
                      here was `border border-brand-clay`; the radius was never
                      the problem, and square corners on an inset card read as
                      unfinished. rounded-2xl is the original radius — smaller
                      than the container's own, which suits a card sitting inside
                      it rather than filling it. */}
                  <img
                    src={resolveSrc(slide)}
                    alt={isCenter ? alt : ''}
                    className="h-full w-full rounded-2xl object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => handleError(slide)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* No arrows. The thumbnail strip below is the control — it shows every
            photo at once, says which one is current, and is a larger target.
            Overlay arrows duplicated it while hiding part of the image. */}
      </div>

      {/* Thumbnails — the primary control. One image needs none. */}
      {showThumbnails && !single && (
        /* Wraps rather than scrolling. `overflow-x-auto no-scrollbar` hid the
           scrollbar too, so past roughly seven photos the rest were simply
           unreachable-looking — nothing on screen suggested they existed.
           Workshops carry at least three photos and no enforced maximum. */
        <div className="flex flex-wrap gap-3">
          {slides.map((slide, i) => {
            const isActive = i === currentIndex;
            return (
              <button
                key={slide}
                type="button"
                onClick={() => selectSlide(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={isActive}
                className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-brand-sand transition-all cursor-pointer ${
                  isActive
                    ? 'border-2 border-brand-terracotta'
                    : 'border border-brand-clay opacity-60 hover:opacity-100'
                }`}
              >
                <img
                  src={resolveSrc(slide)}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onError={() => handleError(slide)}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ImageSlider;
