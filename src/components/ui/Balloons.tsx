/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { balloons, textBalloons } from 'balloons-js';

/**
 * Wrapper around balloons-js.
 *
 * The published component composes classes with `cn` from `@/lib/utils`, which
 * this project does not have — this is the same component with plain template
 * strings, matching how the rest of `components/ui` is written.
 *
 * `balloons()` appends its own fixed, full-viewport, pointer-events-none layer
 * to `documentElement` and removes it when the animation ends; the div rendered
 * here is only the ref anchor.
 */
export interface BalloonsProps {
  type?: 'default' | 'text';
  text?: string;
  fontSize?: number;
  color?: string;
  className?: string;
  onLaunch?: () => void;
}

export interface BalloonsHandle {
  launchAnimation: () => void;
}

const Balloons = React.forwardRef<BalloonsHandle, BalloonsProps>(
  ({ type = 'default', text, fontSize = 120, color = '#000000', className = '', onLaunch }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    const launchAnimation = React.useCallback(() => {
      if (type === 'default') {
        balloons();
      } else if (type === 'text' && text) {
        textBalloons([{ text, fontSize, color }]);
      }

      onLaunch?.();
    }, [type, text, fontSize, color, onLaunch]);

    React.useImperativeHandle(ref, () => ({ launchAnimation }), [launchAnimation]);

    return <div ref={containerRef} className={`balloons-container ${className}`} />;
  }
);
Balloons.displayName = 'Balloons';

export { Balloons };
