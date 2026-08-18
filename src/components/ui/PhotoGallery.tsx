/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue } from 'motion/react';

/**
 * A stack of photographs that deals itself out into a row.
 *
 * Adapted from the shadcn PhotoGallery component. Three things had to change
 * for this codebase: `next/image` is replaced by a plain `<img>` (this is Vite,
 * not Next), `framer-motion` is imported as `motion/react` (v12 is the same
 * library under its current name, already a dependency), and the demo's
 * slate/rose palette and shadcn `Button` are dropped in favour of the brand's
 * own type and buttons, which the caller passes as children.
 *
 * The cards start piled on top of each other and spring apart. Each is
 * draggable — it snaps back — and lifts on hover.
 */

type Direction = 'left' | 'right';

function getRandomNumberInRange(min: number, max: number): number {
  if (min >= max) throw new Error('Min value should be less than max value');
  return Math.random() * (max - min) + min;
}

export const Photo: React.FC<{
  src: string;
  alt: string;
  className?: string;
  direction?: Direction;
  width: number;
  height: number;
  eager?: boolean;
}> = ({ src, alt, className = '', direction, width, height, eager }) => {
  const [rotation, setRotation] = useState<number>(0);
  const x = useMotionValue(200);
  const y = useMotionValue(200);

  // A small random tilt per card, so the row looks laid out by hand.
  useEffect(() => {
    setRotation(getRandomNumberInRange(1, 4) * (direction === 'left' ? -1 : 1));
  }, [direction]);

  const handleMouse = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left);
    y.set(event.clientY - rect.top);
  };

  const resetMouse = () => {
    x.set(200);
    y.set(200);
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      whileTap={{ scale: 1.15, zIndex: 9999 }}
      whileHover={{
        scale: 1.08,
        rotateZ: 2 * (direction === 'left' ? -1 : 1),
        zIndex: 9999
      }}
      whileDrag={{ scale: 1.1, zIndex: 9999 }}
      initial={{ rotate: 0 }}
      animate={{ rotate: rotation }}
      style={{
        width,
        height,
        perspective: 400,
        zIndex: 1,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none'
      }}
      className={`${className} relative mx-auto shrink-0 cursor-grab active:cursor-grabbing`}
      onMouseMove={handleMouse}
      onMouseLeave={resetMouse}
      draggable={false}
      tabIndex={0}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-brand-cream ring-1 ring-brand-clay shadow-card">
        <img
          src={src}
          alt={alt}
          className="h-full w-full rounded-[22px] object-cover"
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      </div>
    </motion.div>
  );
};

export const PhotoGallery: React.FC<{
  images: string[];
  alts?: string[];
  animationDelay?: number;
  className?: string;
  children?: React.ReactNode;
}> = ({ images, alts = [], animationDelay = 0.4, className = '', children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // The demo hard-codes ±320px offsets, which run off a phone screen. The
  // spread and the card size step with the viewport instead.
  const [layout, setLayout] = useState({ spread: 168, size: 220 });

  useEffect(() => {
    const visibilityTimer = setTimeout(() => setIsVisible(true), animationDelay * 1000);
    const animationTimer = setTimeout(() => setIsLoaded(true), (animationDelay + 0.4) * 1000);
    return () => {
      clearTimeout(visibilityTimer);
      clearTimeout(animationTimer);
    };
  }, [animationDelay]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) setLayout({ spread: 62, size: 132 });
      else if (width < 1024) setLayout({ spread: 116, size: 176 });
      else setLayout({ spread: 168, size: 220 });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const containerVariants = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 }
    }
  };

  const photoVariants = {
    hidden: () => ({ x: 0, y: 0, rotate: 0, scale: 1 }),
    visible: (custom: { x: string; y: string; order: number }) => ({
      x: custom.x,
      y: custom.y,
      rotate: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 70,
        damping: 12,
        mass: 1,
        delay: custom.order * 0.15
      }
    })
  };

  // Five cards fanned around the centre, each dropped a little differently so
  // the row is not a ruler-straight line.
  const yOffsets = [15, 32, 8, 22, 44];
  const photos = images.slice(0, 5).map((src, i) => ({
    id: i,
    order: i,
    x: `${(i - 2) * layout.spread}px`,
    y: `${yOffsets[i] ?? 16}px`,
    zIndex: 50 - i * 10,
    direction: (i % 2 === 0 ? 'left' : 'right') as Direction,
    src,
    alt: alts[i] || 'Inside the Arty Café studio'
  }));

  return (
    <div className={`relative ${className}`}>
      {/* The faint grid the demo puts behind the row, in clay rather than slate. */}
      <div
        className="absolute inset-0 max-md:hidden top-[210px] -z-10 h-[300px] w-full bg-[linear-gradient(to_right,#C9BCA8_1px,transparent_1px),linear-gradient(to_bottom,#C9BCA8_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40 [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"
        aria-hidden="true"
      />

      <div className="relative mb-8 flex w-full items-center justify-center" style={{ height: layout.size + 130 }}>
        <motion.div
          className="relative mx-auto flex w-full max-w-7xl justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: isVisible ? 1 : 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <motion.div
            className="relative flex w-full justify-center"
            variants={containerVariants}
            initial="hidden"
            animate={isLoaded ? 'visible' : 'hidden'}
          >
            <div className="relative" style={{ height: layout.size, width: layout.size }}>
              {/* Reversed so the higher z-index cards render later in the DOM. */}
              {[...photos].reverse().map(photo => (
                <motion.div
                  key={photo.id}
                  className="absolute left-0 top-0"
                  style={{ zIndex: photo.zIndex }}
                  variants={photoVariants}
                  custom={{ x: photo.x, y: photo.y, order: photo.order }}
                >
                  <Photo
                    width={layout.size}
                    height={layout.size}
                    src={photo.src}
                    alt={photo.alt}
                    direction={photo.direction}
                    eager={photo.order < 3}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="relative z-10 px-6 text-center">{children}</div>
    </div>
  );
};
