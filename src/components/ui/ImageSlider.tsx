/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const usable = sources.filter(src => !broken.includes(src));
  const slides = usable.length > 0 ? usable : sources.slice(0, 1);

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

  /** Steps the stack, and holds it the same way a manual pick does. */
  const step = (direction: 1 | -1) =>
    selectSlide((currentIndex + direction + slides.length) % slides.length);

  if (slides.length === 0) {
    return <div className={`bg-brand-sand ${className}`} />;
  }

  const single = slides.length === 1;
  const centreSrc = slides[Math.min(currentIndex, slides.length - 1)];

  const markBroken = (src: string) =>
    setBroken(prev => (prev.includes(src) ? prev : [...prev, src]));

  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden bg-brand-sand ${className}`}>

        {single || prefersReducedMotion ? (
          /* One image, or someone who asked for less movement: the centre
             frame plainly, no stack and no 3D. */
          <img
            src={centreSrc}
            alt={alt}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => markBroken(centreSrc)}
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

              return (
                <div
                  key={slide}
                  className="absolute h-[86%] w-[70%] transition-all duration-500 ease-in-out"
                  style={{
                    transform: `
                      translateX(${pos * 45}%)
                      scale(${isCenter ? 1 : isAdjacent ? 0.85 : 0.7})
                      rotateY(${pos * -10}deg)
                    `,
                    zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                    opacity: isCenter ? 1 : isAdjacent ? 0.4 : 0,
                    filter: isCenter ? 'blur(0px)' : 'blur(4px)',
                    visibility: Math.abs(pos) > 1 ? 'hidden' : 'visible'
                  }}
                  aria-hidden={!isCenter}
                >
                  <img
                    src={slide}
                    alt={isCenter ? alt : ''}
                    className="h-full w-full rounded-2xl border border-brand-clay object-cover shadow-card"
                    referrerPolicy="no-referrer"
                    onError={() => markBroken(slide)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Arrows — the studio's own button treatment, not the demo's. */}
        {!single && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute start-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-brand-clay bg-brand-cream/90 text-brand-charcoal shadow-card-sm backdrop-blur-sm transition-colors hover:bg-brand-cream cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 flip-rtl" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute end-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-brand-clay bg-brand-cream/90 text-brand-charcoal shadow-card-sm backdrop-blur-sm transition-colors hover:bg-brand-cream cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 flip-rtl" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails — the primary control. One image needs none. */}
      {showThumbnails && !single && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
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
                  src={slide}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  loading="lazy"
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
