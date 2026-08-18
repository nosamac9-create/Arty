/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';

/**
 * Text that reveals character by character, each springing up from behind a cut
 * in the line.
 *
 * The upstream implementation file was never included in the request — only the
 * usage demo — so this is written from that demo's public API and the
 * animation's described behaviour. The prop names, defaults and semantics match
 * what the demo calls:
 *
 *   <VerticalCutReveal
 *     splitBy="characters"
 *     staggerDuration={0.04}
 *     staggerFrom="center"
 *     transition={{ damping: 20, stiffness: 300, type: 'spring' }}
 *   >
 *
 * Two details this needs that a generic implementation would not: whitespace is
 * never wrapped in a cut (an inline-block space stops the line breaking there,
 * and the headline would refuse to wrap), and a nested element — the
 * sage-coloured phrase in the hero — has its own text split in place, so the
 * reveal runs straight through it while keeping its colour.
 *
 * Under `prefers-reduced-motion` the text is rendered as-is, unsplit.
 */

type StaggerFrom = 'first' | 'last' | 'center' | number;

interface VerticalCutRevealProps {
  children: React.ReactNode;
  splitBy?: 'characters' | 'words';
  /** Seconds between each unit. */
  staggerDuration?: number;
  /** Which unit moves first; the rest follow outward from it. */
  staggerFrom?: StaggerFrom;
  /** Seconds before the first unit moves. */
  delay?: number;
  transition?: Transition;
  className?: string;
}

const DEFAULT_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 20
};

/**
 * Distance, in units, from whichever unit starts the stagger. That distance
 * times `staggerDuration` is the delay, so the reveal spreads outward from the
 * chosen origin instead of always running left to right.
 */
function staggerOffset(index: number, total: number, from: StaggerFrom): number {
  if (from === 'first') return index;
  if (from === 'last') return total - 1 - index;
  if (from === 'center') return Math.abs(index - (total - 1) / 2);
  return Math.abs(index - from);
}

/**
 * Pulls the top-level pieces out of children. Strings get split; elements are
 * kept so their styling survives.
 */
function collectSegments(children: React.ReactNode): Array<string | React.ReactElement> {
  const segments: Array<string | React.ReactElement> = [];

  React.Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      segments.push(String(child));
    } else if (React.isValidElement(child)) {
      segments.push(child);
    }
  });

  return segments;
}

/** Splits a string into the units that will animate, keeping whitespace apart. */
function splitText(text: string, splitBy: 'characters' | 'words'): string[] {
  return splitBy === 'words' ? text.split(/(\s+)/).filter(Boolean) : Array.from(text);
}

export const VerticalCutReveal: React.FC<VerticalCutRevealProps> = ({
  children,
  splitBy = 'characters',
  staggerDuration = 0.04,
  staggerFrom = 'first',
  delay = 0.15,
  transition = DEFAULT_TRANSITION,
  className = ''
}) => {
  const prefersReducedMotion = useReducedMotion();
  const keyBase = useId();

  if (prefersReducedMotion) {
    return <span className={className}>{children}</span>;
  }

  const segments = collectSegments(children);

  /**
   * Everything is flattened into one list of units before rendering.
   *
   * Grouping words has to happen across segment boundaries, not inside each
   * segment: the headline is three segments — "Melt into the art of ", the
   * sage-coloured <span>clay &amp; canvas</span>, and "." — and the period is
   * therefore a sibling of the span. Two adjacent inline-blocks are a break
   * opportunity, which put the period alone on its own line at some widths
   * (measured at 520px and 740px). A WORD JOINER between them does not help,
   * because the opportunity is structural rather than textual.
   *
   * So a styled segment contributes its className to its own characters instead
   * of staying a wrapper element. The colour is identical — it is a text colour
   * — and the last word of "canvas" and the "." can now sit inside one
   * unbreakable word.
   *
   * Flattening also means the "from center" stagger is measured across the
   * whole headline rather than per fragment.
   */
  type Unit = { text: string | null; className?: string; element?: React.ReactElement };
  const units: Unit[] = [];

  segments.forEach(segment => {
    if (typeof segment === 'string') {
      splitText(segment, splitBy).forEach(text => units.push({ text }));
      return;
    }

    const props = segment.props as { children?: React.ReactNode; className?: string };
    if (typeof props?.children === 'string') {
      splitText(props.children, splitBy).forEach(text =>
        units.push({ text, className: props.className })
      );
      return;
    }

    // Anything that is not simple text reveals as one piece.
    units.push({ text: null, element: segment });
  });

  const isSpace = (unit: Unit) => typeof unit.text === 'string' && /^\s+$/.test(unit.text);
  const animatedTotal = units.filter(unit => !isSpace(unit)).length;

  let unitIndex = 0;

  /** One animated unit: a character (or word) rising out of its own cut. */
  const renderUnit = (unit: Unit, key: string) => {
    const index = unitIndex++;
    const offset = staggerOffset(index, animatedTotal, staggerFrom);

    return (
      <span key={key} className="inline-block overflow-hidden align-bottom py-[0.06em]">
        <motion.span
          className={`inline-block ${unit.className || ''}`}
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          transition={{ ...transition, delay: delay + offset * staggerDuration }}
        >
          {unit.text === null ? unit.element : unit.text}
        </motion.span>
      </span>
    );
  };

  /**
   * Consecutive non-space units become one `whitespace-nowrap` word.
   *
   * This is what stops words fracturing. Every animated character is an
   * inline-block and a line may break between any two of them, so without the
   * wrapper the browser splits "canvas" into "ca / nvas". Inside the wrapper the
   * only break opportunities left are the real spaces between words.
   */
  const rendered: React.ReactNode[] = [];
  let word: React.ReactNode[] = [];
  let wordStart = 0;

  const flushWord = () => {
    if (!word.length) return;
    rendered.push(
      <span key={`${keyBase}-w${wordStart}`} className="inline-block whitespace-nowrap">
        {word}
      </span>
    );
    word = [];
  };

  units.forEach((unit, i) => {
    // Whitespace ends the word and is passed through untouched, so it stays a
    // real space the line can break at.
    if (isSpace(unit)) {
      flushWord();
      rendered.push(<span key={`${keyBase}-s${i}`}>{unit.text}</span>);
      return;
    }
    if (!word.length) wordStart = i;
    word.push(renderUnit(unit, `${keyBase}-u${i}`));
  });
  flushWord();

  return <span className={className}>{rendered}</span>;
};

export default VerticalCutReveal;
