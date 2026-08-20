/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  /** Heading content — a string, or a node when the header carries an avatar. */
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** The pinned action row. Omit for a modal with no actions. */
  footer?: React.ReactNode;
  /** Tailwind max-width class. */
  maxWidth?: string;
  /** Renders the card as a <form> so a submit button can live in the footer. */
  onSubmit?: (e: React.FormEvent) => void;
}

/** Space left above and below the card so both edges are always visible. */
const OUTER_GUTTER = '1.5rem';

/**
 * The console's modal shell.
 *
 * ── Why this renders through a portal ────────────────────────────────────────
 * `position: fixed` is only viewport-relative while no ancestor establishes a
 * containing block. Every admin page is wrapped in `.page-transition`, which
 * runs `animation: pageEnter … both` — a filling animation on `transform`. That
 * makes the wrapper the containing block for fixed descendants, so `inset: 0`
 * resolved to the *page content box* instead of the window.
 *
 * That one fact produced every symptom reported: the backdrop stopped where the
 * page content stopped and left the bottom strip of the console in full colour;
 * the card centred inside a box taller than the screen, so its header sat above
 * the viewport and its footer below it; and the offset changed with scroll
 * position, so View, Add and Edit each looked misaligned differently.
 *
 * Portalling to `document.body` puts the overlay outside that wrapper entirely,
 * which is the only fix that does not depend on the page's own styling. No
 * margins, offsets or per-modal rules are involved.
 */
export const ConsoleModal: React.FC<Props> = ({
  title, onClose, children, footer, maxWidth = 'max-w-md', onSubmit
}) => {
  /**
   * Nothing behind the modal scrolls while it is open.
   *
   * The console's scroller is not the document — it is the column beside the
   * sidebar — so both are locked. The scrollbar's width is added back as
   * padding, or removing it would shift the whole page sideways as the modal
   * opens.
   */
  useEffect(() => {
    const body = document.body;
    const consoleScroller = document.querySelector<HTMLElement>('[data-console-scroll]');

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previous = {
      bodyOverflow: body.style.overflow,
      bodyPadding: body.style.paddingRight,
      scrollerOverflow: consoleScroller?.style.overflow ?? ''
    };

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
    if (consoleScroller) consoleScroller.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.paddingRight = previous.bodyPadding;
      if (consoleScroller) consoleScroller.style.overflow = previous.scrollerOverflow;
    };
  }, []);

  // The height cap lives in the stylesheet, where a vh fallback can sit under
  // the dvh value — an inline style object cannot express that pair.
  const cardClass = `console-modal-card flex w-full ${maxWidth} flex-col overflow-hidden rounded-3xl border border-brand-clay bg-brand-cream text-left shadow-2xl animate-in zoom-in-95 duration-200`;

  const content = (
    <>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-clay/60 px-6 py-4">
        <h3 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2 min-w-0">
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-lg border border-transparent p-1.5 text-brand-charcoal hover:border-brand-clay/40 hover:bg-brand-sand focus:outline-none cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* `min-h-0` is what makes this scroll: a flex item defaults to
          `min-height: auto` and will not shrink below its content, so
          `flex-1` + `overflow-y-auto` would otherwise scroll nothing and push
          the footer out of the card. */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto always-scrollbar px-6 py-5">
        {children}
      </div>

      {footer && (
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-brand-clay/60 bg-brand-cream px-6 py-4">
          {footer}
        </footer>
      )}
    </>
  );

  return createPortal(
    <div
      className="console-modal-overlay fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        padding: OUTER_GUTTER,
        backgroundColor: 'rgb(46 33 26 / 0.6)',
        // Safari still needs the prefix.
        WebkitBackdropFilter: 'blur(2px)',
        backdropFilter: 'blur(2px)'
      }}
      onMouseDown={e => {
        // Only a click on the backdrop itself closes, never one that started
        // inside the card and drifted out while selecting text.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {onSubmit
        ? <form onSubmit={onSubmit} className={cardClass}>{content}</form>
        : <div className={cardClass}>{content}</div>}
    </div>,
    document.body
  );
};
