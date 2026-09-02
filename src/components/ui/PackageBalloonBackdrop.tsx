/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The faint balloon field behind the birthday package tickets.
 *
 * ── WHERE THE SHAPE CAME FROM, AND WHAT THAT COSTS ───────────────────────────
 * The two paths below are COPIED from `balloons-js`, the library that draws the
 * animated balloons in the home page's birthday section
 * (node_modules/balloons-js/dist/index.esm.js, the module-private
 * `balloonSvgHTML` constant, viewBox 0 0 223 609). They were copied because the
 * library exports no shape: the SVG is a private string it injects into the DOM
 * at runtime, and the layer it builds is removed again when its animation ends.
 * There is no component, no .svg file and no export to import.
 *
 * THIS COPY WILL NOT TRACK UPDATES TO balloons-js. If that package changes its
 * balloon, the home page will change and this will not, and the site will
 * quietly have two different balloons — which is the exact thing reusing the
 * shape was meant to prevent. If you upgrade that dependency, re-check these
 * paths against `balloonSvgHTML`.
 *
 * Only the silhouette is taken — the body and its string. The original also
 * carries six highlight paths behind ten SVG filters (specular lighting,
 * gaussian blurs, `mix-blend-mode: lighten`) for its gloss. At the 8–15%
 * opacity used here none of that is visible, so rendering it would be paint
 * cost for detail nobody can see.
 *
 * ── BEHAVIOUR ────────────────────────────────────────────────────────────────
 * Static by design. This sits behind prices and a deposit figure someone is
 * comparing before committing to a few thousand riyals; ambient movement in the
 * periphery competes with that.
 *
 * Decorative, so `aria-hidden` and `pointer-events-none`: the tickets above stay
 * fully clickable, and none of this is selectable.
 */

import React from 'react';

/** Copied from balloons-js — see the note above before changing. */
const BALLOON_STRING_PATH =
  'M117.5 253C136.167 294.5 134.7 395 125.5 453C116.3 511 133.833 578.167 125.5 606';

/** Copied from balloons-js — see the note above before changing. */
const BALLOON_BODY_PATH =
  'M176.876 204.032C181.934 198.064 209.694 160.262 210.899 127.619C213.023 70.1236 176.876 13 118.337 13C55.7949 13 18.5828 69.332 22.2724 127.619C24.0956 156.423 38.9766 178.5 51.7922 195.372C57.7811 203.257 90.0671 238.749 112.15 245.044C111.698 248.246 112.044 253.284 116.338 254H121.838V245.71C143.277 242.292 172.085 209.686 176.876 204.032Z';

/** The tickets' own green, so the backdrop belongs to the section. */
const BALLOON_COLOUR = '#7C8F80';

/**
 * The ticket stack's geometry, which the placement below is expressed against.
 *
 * The stack is centred and capped at 900px, so the stub — price, deposit, CTA —
 * always sits in the last 148px of that card, wherever the card happens to be.
 * Anchoring balloons to a percentage of the SECTION was the bug in the first
 * attempt: a 62% cap held everything left of the card and left the entire right
 * margin bare, and it stopped meaning anything as the container resized.
 *
 * Positions are offsets in px from the container's centre line instead, so the
 * exclusion zone tracks the card exactly at any width.
 */
const CARD_HALF = 450;   // half of the 900px max-width
const STUB_W = 148;      // the stub column, measured from the card's right edge
/** Left edge of the protected zone, as an offset from centre. */
const STUB_START = CARD_HALF - STUB_W;   // +302
/** Clearance beyond the card before a margin balloon starts. */
const MARGIN_GAP = 8;

/**
 * Where one balloon sits.
 *
 * ── HORIZONTAL ──
 * `lane` says which region the balloon belongs to, and `x` is its left edge as
 * an offset in px from the centre line:
 *
 *   'card'         inside the card's width but ending before STUB_START, so it
 *                  never sits behind the price or the button. Visible in the
 *                  gaps between tickets and through the notch holes.
 *   'left-margin'  entirely left of the card.
 *   'right-margin' entirely right of the card — the region that was empty.
 *
 * Margin lanes only exist once the viewport is wide enough to have margins: the
 * section is capped at max-w-7xl (1280px), so at 1280px and up there is roughly
 * 190px either side of the 900px card. Below that the margins collapse, so
 * those balloons are hidden rather than allowed to slide off the edge.
 *
 * ── VERTICAL ──
 * The shape is 609/223 ≈ 2.73 times taller than it is wide, so a 5.5rem balloon
 * is over 15rem tall. Anchoring by `top` alone let the tallest ones run past the
 * bottom of the section and get cut in half by the overflow clip.
 *
 * Each balloon now anchors to whichever edge it is nearest — `top` for the upper
 * half, `bottom` for the lower — so the near edge is exact and the far edge only
 * needs the section to be taller than one balloon, which it always is. The
 * largest scales are kept near the edges they anchor to, so the far edge has the
 * most room.
 */
interface BalloonSpot {
  /** Which edge the balloon is measured from. */
  anchor: 'top' | 'bottom';
  /** Distance from that edge, as a percentage of section height. */
  y: string;
  lane: 'card' | 'left-margin' | 'right-margin';
  /** Left edge as px from the centre line. Ignored for mobile placement. */
  x: number;
  /** Left edge as a percentage, used below 640px where lanes do not apply. */
  mobileX?: string;
  scale: number;
  opacity: number;
  rotate: number;
  mobile: boolean;
}

/** Base width in rem; scale multiplies it. Height is 2.73x this. */
const BASE_WIDTH_REM = 5.5;
const ASPECT = 609 / 223;

/**
 * Ten balloons, scattered across the whole width.
 *
 * On a phone the lanes are meaningless — the ticket is full width and its stub
 * is a full-width band, so there is no horizontal region to protect — and the
 * five kept there are placed by percentage instead, well inside both edges.
 */
const BALLOONS: BalloonSpot[] = [
  // ── Card lane ──────────────────────────────────────────────────────────────
  // Bounded by the NARROWEST width this lane appears at (640px: a 592px
  // container, so ±296 from centre, with the stub starting at only +166).
  //
  // These are the ones that read as depth: a ticket is opaque, so a balloon
  // sitting here is clipped by whichever ticket overlaps it and shows only in
  // the gap above, below or between them. That partial occlusion is the point —
  // everything floating in clear space looked placed rather than scattered.
  { anchor: 'top',    y: '3%',  lane: 'card', x: -250, scale: 0.55, opacity: 0.10, rotate: -12, mobile: true,  mobileX: '8%'  },
  { anchor: 'top',    y: '11%', lane: 'card', x: 40,   scale: 1.25, opacity: 0.12, rotate: 5,   mobile: true,  mobileX: '3%'  },
  { anchor: 'top',    y: '22%', lane: 'card', x: -120, scale: 0.45, opacity: 0.09, rotate: 14,  mobile: true,  mobileX: '55%' },
  { anchor: 'top',    y: '34%', lane: 'card', x: -285, scale: 0.95, opacity: 0.13, rotate: -6,  mobile: false },
  { anchor: 'bottom', y: '40%', lane: 'card', x: 10,   scale: 0.70, opacity: 0.11, rotate: 8,   mobile: true,  mobileX: '22%' },
  { anchor: 'bottom', y: '22%', lane: 'card', x: -200, scale: 1.50, opacity: 0.10, rotate: -3,  mobile: false },
  { anchor: 'bottom', y: '6%',  lane: 'card', x: 100,  scale: 0.50, opacity: 0.14, rotate: 11,  mobile: true,  mobileX: '62%' },

  // ── Left margin ────────────────────────────────────────────────────────────
  // Depth varies: -600 is almost against the outer edge, -505 nearly touches
  // the card. Sitting at one x was what made a stripe of them.
  { anchor: 'top',    y: '6%',  lane: 'left-margin', x: -600, scale: 1.35, opacity: 0.12, rotate: -9, mobile: false },
  { anchor: 'top',    y: '27%', lane: 'left-margin', x: -520, scale: 0.60, opacity: 0.09, rotate: 7,  mobile: false },
  { anchor: 'bottom', y: '5%',  lane: 'left-margin', x: -505, scale: 0.50, opacity: 0.15, rotate: 12, mobile: false },

  // ── Right margin ───────────────────────────────────────────────────────────
  { anchor: 'top',    y: '14%', lane: 'right-margin', x: 462, scale: 1.40, opacity: 0.10, rotate: 6,   mobile: false },
  { anchor: 'top',    y: '40%', lane: 'right-margin', x: 545, scale: 0.50, opacity: 0.13, rotate: -10, mobile: false },
  { anchor: 'bottom', y: '30%', lane: 'right-margin', x: 470, scale: 0.75, opacity: 0.09, rotate: 4,   mobile: false },
  { anchor: 'bottom', y: '10%', lane: 'right-margin', x: 530, scale: 0.65, opacity: 0.12, rotate: -7,  mobile: false }
];

/**
 * Visibility per lane, as literal class strings.
 *
 * Literal because Tailwind generates classes by scanning source text — a class
 * built at runtime from a template string is never emitted, so it would simply
 * not exist in the stylesheet.
 */
const LANE_VISIBILITY: Record<BalloonSpot['lane'], string> = {
  card: 'hidden sm:block',
  'left-margin': 'hidden xl:block',
  'right-margin': 'hidden xl:block'
};

/** One balloon. Geometry comes in; this only draws. */
const Balloon: React.FC<{
  spot: BalloonSpot;
  className: string;
  position: React.CSSProperties;
}> = ({ spot, className, position }) => {
  const widthRem = BASE_WIDTH_REM * spot.scale;
  return (
    <svg
      viewBox="0 0 223 609"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute ${className}`}
      style={{
        // Height is declared, not left to the aspect ratio, because the anchor
        // maths above depends on knowing it.
        width: `${widthRem.toFixed(2)}rem`,
        height: `${(widthRem * ASPECT).toFixed(2)}rem`,
        opacity: spot.opacity,
        transform: `rotate(${spot.rotate}deg)`,
        color: BALLOON_COLOUR,
        ...position
      }}
    >
      <path d={BALLOON_BODY_PATH} fill="currentColor" />
      <path d={BALLOON_STRING_PATH} stroke="currentColor" strokeWidth={4} fill="none" />
    </svg>
  );
};

/**
 * Two sets rather than one that tries to be both.
 *
 * Below 640px the lanes mean nothing — the ticket is full width and its stub is
 * a full-width band, so there is no horizontal region to keep clear — and the
 * five phone balloons are placed by percentage. From 640px up the lanes apply
 * and placement is measured from the centre line. Keeping them separate avoids
 * one element carrying two contradictory positioning schemes.
 */
export const PackageBalloonBackdrop: React.FC = () => (
  <div
    aria-hidden="true"
    /* No negative z-index: that would risk dropping the layer behind the
       section's own background. This is the first positioned child and the
       heading and ticket list after it are positioned too, so paint order alone
       puts the balloons underneath. overflow-hidden stays as the safety net,
       but the placement is built so nothing actually reaches it. */
    className="pointer-events-none absolute inset-0 select-none overflow-hidden"
  >
    {/* Phone */}
    {BALLOONS.filter(spot => spot.mobile).map((spot, index) => (
      <Balloon
        key={`m-${index}`}
        spot={spot}
        className="block sm:hidden"
        position={{ [spot.anchor]: spot.y, left: spot.mobileX }}
      />
    ))}

    {/* Tablet and up */}
    {BALLOONS.map((spot, index) => (
      <Balloon
        key={`d-${index}`}
        spot={spot}
        className={LANE_VISIBILITY[spot.lane]}
        position={{ [spot.anchor]: spot.y, left: `calc(50% + ${spot.x}px)` }}
      />
    ))}
  </div>
);
