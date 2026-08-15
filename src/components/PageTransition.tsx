/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

/**
 * Wraps the customer site's page area.
 *
 * Two jobs, both purely presentational:
 *
 *  1. A short fade-and-rise whenever the page changes. Keying the inner
 *     element on the page id restarts the animation on every navigation —
 *     without the key, React reuses the node and nothing plays.
 *
 *  2. Scrolls back to the top on navigation. Without it a visitor who is
 *     halfway down the workshop list opens a workshop and lands halfway down
 *     the detail page. The first render is skipped so a deep link or a
 *     restored scroll position is left alone.
 *
 * `prefers-reduced-motion` is honoured in the stylesheet, and the jump is
 * instant rather than smooth for the same reason — a long smooth scroll on a
 * page change reads as a glitch.
 */
export const PageTransition: React.FC<{ pageKey: string; children: React.ReactNode }> = ({
  pageKey,
  children
}) => {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pageKey]);

  return (
    <div key={pageKey} className="page-transition">
      {children}
    </div>
  );
};
