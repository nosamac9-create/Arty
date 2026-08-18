/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';

/**
 * An arc of photographs sweeping over the headline.
 *
 * Adapted from the Arc Gallery Hero component to Arty Café's own palette and
 * type — the demo's indigo, white surfaces and dark mode are deliberately not
 * carried over. The geometry is the original: each card sits on a circle whose
 * pivot is the bottom-centre of the ring, and is rotated a quarter of its own
 * angle so the fan splays outward rather than every card facing the same way.
 */
type ArcGalleryHeroProps = {
  images: string[];
  /** Alt text per image, index-matched. Falls back to a generic description. */
  alts?: string[];
  startAngle?: number;
  endAngle?: number;
  // Radius of the arc, per breakpoint.
  radiusLg?: number;
  radiusMd?: number;
  radiusSm?: number;
  // Edge length of each card, per breakpoint.
  cardSizeLg?: number;
  cardSizeMd?: number;
  cardSizeSm?: number;
  className?: string;
  children?: React.ReactNode;
};

export const ArcGalleryHero: React.FC<ArcGalleryHeroProps> = ({
  images,
  alts = [],
  startAngle = 20,
  endAngle = 160,
  radiusLg = 520,
  radiusMd = 380,
  radiusSm = 260,
  cardSizeLg = 132,
  cardSizeMd = 104,
  cardSizeSm = 74,
  className = '',
  children
}) => {
  const [dimensions, setDimensions] = useState({
    radius: radiusLg,
    cardSize: cardSizeLg
  });

  // The arc is drawn in pixels, so it has to be recomputed on resize rather
  // than handed to a CSS breakpoint.
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setDimensions({ radius: radiusSm, cardSize: cardSizeSm });
      } else if (width < 1024) {
        setDimensions({ radius: radiusMd, cardSize: cardSizeMd });
      } else {
        setDimensions({ radius: radiusLg, cardSize: cardSizeLg });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [radiusLg, radiusMd, radiusSm, cardSizeLg, cardSizeMd, cardSizeSm]);

  // At least two points, or the angle step divides by zero.
  const count = Math.max(images.length, 2);
  const step = (endAngle - startAngle) / (count - 1);

  return (
    <section className={`relative overflow-hidden ${className}`}>
      {/* The ring. Its height governs how much room the arc gets. */}
      <div
        className="relative mx-auto"
        style={{ width: '100%', height: dimensions.radius * 1.15 }}
      >
        {/* Pivot: bottom centre, which is what puts the cards overhead. */}
        <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
          {images.map((src, i) => {
            const angle = startAngle + step * i;
            const angleRad = (angle * Math.PI) / 180;

            const x = Math.cos(angleRad) * dimensions.radius;
            const y = Math.sin(angleRad) * dimensions.radius;

            return (
              <div
                key={src + i}
                className="absolute opacity-0 arc-card-in"
                style={{
                  width: dimensions.cardSize,
                  height: dimensions.cardSize,
                  left: `calc(50% + ${x}px)`,
                  bottom: `${y}px`,
                  transform: 'translate(-50%, 50%)',
                  animationDelay: `${i * 90}ms`,
                  animationFillMode: 'forwards',
                  zIndex: count - i
                }}
              >
                <div
                  className="w-full h-full overflow-hidden rounded-[18px] bg-brand-cream ring-1 ring-brand-clay shadow-card-sm transition-transform duration-300 hover:scale-105"
                  style={{ transform: `rotate(${angle / 4}deg)` }}
                >
                  <img
                    src={src}
                    alt={alts[i] || 'Inside the Arty Café studio'}
                    className="block w-full h-full object-cover"
                    draggable={false}
                    loading={i < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The headline sits under the arc, pulled up into its mouth. */}
      <div className="relative z-10 flex justify-center px-6 -mt-32 sm:-mt-40 lg:-mt-56">
        <div
          className="w-full max-w-3xl text-center opacity-0 arc-content-in"
          style={{ animationDelay: '700ms', animationFillMode: 'forwards' }}
        >
          {children}
        </div>
      </div>
    </section>
  );
};
