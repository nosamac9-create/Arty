/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Cake, CalendarRange, CheckCircle2, Clock, Compass,
  Paintbrush, Sparkles, Users, ArrowLeft, ScrollText
} from 'lucide-react';
import { BirthdayPackage } from '../types';
import { AppImage } from './ui/AppImage';

interface Props {
  packages: BirthdayPackage[];
  /** Package id to open on arrival — set when a home page card was clicked. */
  initialPackageId?: string;
  onChoose: (packageId: string) => void;
  /** Kept in sync so the reservation form opens on the same package. */
  onFocusChange?: (packageId: string) => void;
}

/**
 * The birthday packages experience: two packages to compare, one to focus on.
 *
 * The morph is done with `layoutId` rather than a bespoke animation. The grid
 * card and the focused hero are the same layout element as far as Motion is
 * concerned, so the image and title travel between the two states instead of
 * one fading out while the other fades in.
 *
 * Arriving with a package already chosen still starts in the overview and
 * focuses a beat later, so that travel actually plays. Landing straight in the
 * focused state would skip it, which is what made the old page feel like it
 * had simply loaded with an accordion already open.
 */
/**
 * The three ticket colourways: one brand green, three depths of it.
 *
 * Built on the sage token family rather than on hexes of their own —
 * `--color-brand-sage` (#7C8F80) is the green in the hero headline, and
 * `--color-brand-sage-line` (#C8D2C6) is its existing light sibling. The middle
 * tint sits between them. Assigned by position in the list, cycling beyond the
 * third, so three packages stay tellable apart while reading as one family.
 *
 * ONE INK, THREE TIERS. Every text tier uses the same near-black; the hierarchy
 * comes from size, weight and letter-spacing instead. That is not a stylistic
 * preference — a lighter "muted" colour cannot survive all three tints. On
 * #7C8F80 a muted label measures 2.30:1 against a 4.5 minimum, and the
 * secondary tier 3.33:1. Type hierarchy holds at every depth; colour hierarchy
 * would degrade ticket by ticket.
 *
 * Measured against #1B241E: 10.24:1, 7.61:1 and 4.63:1 respectively — AA or
 * better on all three. (The terracotta and clay-rose colourways this replaces
 * were never checked and shipped with muted labels at 2.52:1 and 3.28:1.)
 *
 * `photo` is ~12% darker than `card` so the image panel reads as part of the
 * ticket, and stands alone as a plain panel when a package has no photograph.
 */
const TICKET_INK = '#1B241E';

const TICKET_COLOURWAYS = [
  { name: 'sage light', card: '#C8D2C6', photo: '#B0BCAE' },
  { name: 'sage mid',   card: '#A8B7AB', photo: '#93A395' },
  { name: 'sage',       card: '#7C8F80', photo: '#6D7E71' }
] as const;

/** A light warm wash used for the tags and the perforation, over any tint. */
const TICKET_WASH = 'rgba(255, 250, 240, 0.42)';
const TICKET_PERFORATION = 'rgba(255, 250, 240, 0.55)';

export const BirthdayPackagesShowcase: React.FC<Props> = ({
  packages, initialPackageId, onChoose, onFocusChange
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [focusedId, setFocusedId] = useState<string | null>(
    // With reduced motion there is no travel to wait for, so the requested
    // package is shown immediately.
    prefersReducedMotion && initialPackageId ? initialPackageId : null
  );

  useEffect(() => {
    if (!initialPackageId || prefersReducedMotion) return;
    if (!packages.some(p => p.id === initialPackageId)) return;
    const id = window.setTimeout(() => setFocusedId(initialPackageId), 420);
    return () => window.clearTimeout(id);
    // Deliberately once per arrival: re-running would yank focus back to the
    // home page's package after the visitor switched to the other one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focused = packages.find(p => p.id === focusedId) || null;

  const focus = (id: string) => {
    setFocusedId(id);
    onFocusChange?.(id);
  };

  const ease = [0.22, 1, 0.36, 1] as const;
  const spring = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 260, damping: 30 };

  /** Staggered entrance for the copy inside the focused panel. */
  const revealList = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.07, delayChildren: 0.05 } }
  };
  const revealItem = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease } }
      };

  const priceLine = (pkg: BirthdayPackage) => `${pkg.pricingLabel || pkg.pricingType}`;

  return (
    <div className="text-start">

      {/* SWITCHER — both packages stay reachable while one is focused, so the
          two can still be compared without going back. */}
      <AnimatePresence initial={false}>
        {focused && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease }}
            className="mb-8 flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setFocusedId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-clay bg-white px-4 py-2.5 text-xs font-semibold text-brand-ink transition-colors hover:text-brand-charcoal cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 flip-rtl" />
              <span>All packages</span>
            </button>

            {packages.map(pkg => {
              const isOn = pkg.id === focused.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => focus(pkg.id)}
                  aria-pressed={isOn}
                  className={`relative rounded-full px-5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                    isOn ? 'text-brand-cream' : 'border border-brand-clay bg-white text-brand-ink hover:text-brand-charcoal'
                  }`}
                >
                  {isOn && (
                    <motion.span
                      layoutId="bday-switch-pill"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-brand-terracotta"
                    />
                  )}
                  <span className="relative">{pkg.name}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERVIEW — two packages, so they are shown as a pair of editorial
          panels rather than a grid that happens to hold two items: tall image,
          quiet meta line, price anchored to the foot of both panels so the two
          read across at the same height. Neither is marked as the better
          choice; they are deliberately identical in weight. */}
      {!focused && (
        <div className="relative pb-6 lg:pb-14">

          {/* Studio marks, the same line-art idiom the Custom Events slab uses:
              currentColor at 1.25 stroke in clay, oversized and very faint.
              The layer carries its own overflow-hidden — putting it on the
              container instead would clip the panels' hover shadow. Sits first
              in the DOM and the content below is positioned, so the panels
              always paint over it. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            {/* Pottery: a wheel, its concentric rings and the curve of a rim —
                behind the intro's open end, which is where the copy stops. */}
            <svg
              className="absolute -top-8 end-0 h-72 w-72 text-brand-clay/45 lg:h-96 lg:w-96"
              viewBox="0 0 200 200" fill="none" aria-hidden="true"
            >
              <circle cx="118" cy="82" r="70" stroke="currentColor" strokeWidth="1.25" />
              <circle cx="118" cy="82" r="48" stroke="currentColor" strokeWidth="1.25" />
              <circle cx="118" cy="82" r="26" stroke="currentColor" strokeWidth="1.25" />
              <path d="M30 150c26-34 58-52 96-54" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>

            {/* Canvas: a stretched frame and the arc of a loaded brush. */}
            <svg
              className="absolute bottom-0 start-0 h-64 w-64 text-brand-clay/40 lg:h-80 lg:w-80"
              viewBox="0 0 200 200" fill="none" aria-hidden="true"
            >
              <rect x="34" y="30" width="112" height="88" rx="6" stroke="currentColor" strokeWidth="1.25" />
              <path d="M34 96c22-26 44-38 66-36s38 16 46 42" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              <path d="M96 118v52" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              <path d="M70 170h52" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            </svg>

            {/* Editorial numerals, one under each column, half below the fold of
                the layer so they read as background type rather than a badge.
                Hidden below lg, where the panels stack and there is no column
                for a numeral to belong to. */}
            <span className="absolute bottom-0 start-0 hidden translate-y-1/3 font-display text-[9rem] font-semibold leading-none text-brand-clay/35 ltr-numerals lg:block">
              01
            </span>
            <span className="absolute bottom-0 end-0 hidden translate-y-1/3 font-display text-[9rem] font-semibold leading-none text-brand-clay/35 ltr-numerals lg:block">
              02
            </span>
          </div>

          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="relative mx-auto max-w-[900px]"
          >
            <h2 className="font-display text-[22px] sm:text-2xl font-semibold text-brand-charcoal">
              Choose your celebration
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-brand-ink">
              Two ways to spend the afternoon — both run by our studio team, start to finish.
            </p>
          </motion.div>

          {/* A stacked list of tear-off tickets, not a grid of cards. Packages
              are a private event you configure, not a class you take a seat in,
              and sharing the workshop card pattern made the two read as
              interchangeable. One full-width ticket per row: photo, content,
              stub. */}
          {/* Capped and centred: at full page width a ticket stretched past
              5:1 and the middle column became dead space. ~900px puts each
              ticket near 3:1, which is a ticket's proportion rather than a
              banner's. The heading above shares this container so the two
              align to the same edge. */}
          <ul className="relative mx-auto mt-7 max-w-[900px] list-none space-y-5 lg:mt-9 lg:space-y-6">
            {packages.map((pkg, index) => {
              const colour = TICKET_COLOURWAYS[index % TICKET_COLOURWAYS.length];

              // Straight from the field that feeds the detail page's "What's
              // included" list — nothing invented, nothing hardcoded.
              const tags = (pkg.includedItems || [])
                .map(item => String(item || '').trim())
                .filter(Boolean)
                .slice(0, 4);

              // Built by filtering, so a package missing one of these loses that
              // pair rather than leaving an empty column or a ragged pill.
              const specs = [
                pkg.duration ? { label: 'Duration', value: pkg.duration } : null,
                pkg.minGuests || pkg.maxGuests
                  ? { label: 'Guests', value: `${pkg.minGuests}–${pkg.maxGuests}` }
                  : null,
                pkg.ageInformation ? { label: 'Ages', value: pkg.ageInformation } : null
              ].filter((spec): spec is { label: string; value: string } => spec !== null);

              return (
                <motion.li
                  key={pkg.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: prefersReducedMotion ? 0 : index * 0.1, duration: 0.5, ease }}
                >
                  {/* A div, not a button: the stub carries a real button, and a
                      button inside a button is invalid. The whole ticket stays
                      clickable and reachable by keyboard. */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => focus(pkg.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        focus(pkg.id);
                      }
                    }}
                    aria-label={`${pkg.name} — see what's included`}
                    className="package-ticket group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[4px] text-start transition-transform duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-charcoal motion-safe:hover:-translate-y-0.5 sm:min-h-[240px] sm:flex-row lg:min-h-[300px]"
                    style={{
                      backgroundColor: colour.card,
                      color: TICKET_INK,
                      ['--ticket-perf-color' as string]: TICKET_PERFORATION
                    }}
                  >
                    {/* PHOTO — flush to the edge, the ticket's own darker shade.
                        With no photograph it stays exactly that: a colour panel,
                        never a stock image of somebody else's party. */}
                    <motion.div
                      layoutId={`bday-media-${pkg.id}`}
                      transition={spring}
                      className="relative h-[168px] w-full shrink-0 overflow-hidden sm:h-auto sm:w-[170px] lg:w-[240px]"
                      style={{ backgroundColor: colour.photo }}
                    >
                      {pkg.image && (
                        <AppImage
                          src={pkg.image}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </motion.div>

                    {/* CONTENT */}
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-5 py-5 sm:px-6">
                      <span
                        className="block text-[10px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: TICKET_INK }}
                      >
                        Package {String(index + 1).padStart(2, '0')}
                      </span>

                      <motion.h3
                        layoutId={`bday-title-${pkg.id}`}
                        transition={spring}
                        className="mt-1.5 font-display text-[22px] font-semibold leading-tight lg:text-[26px]"
                      >
                        {pkg.name}
                      </motion.h3>

                      {pkg.shortDescription && (
                        <p
                          className="mt-2 line-clamp-3 text-[13px] leading-[1.6] sm:line-clamp-2 lg:line-clamp-3"
                          style={{ color: TICKET_INK, opacity: 0.82 }}
                        >
                          {pkg.shortDescription}
                        </p>
                      )}

                      {tags.length > 0 && (
                        <ul className="mt-3 flex list-none flex-wrap gap-1.5">
                          {tags.map(tag => (
                            <li
                              key={tag}
                              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                              style={{ backgroundColor: TICKET_WASH, color: TICKET_INK }}
                            >
                              {tag}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* The divider belongs to the specs. With none to show it
                          goes too, rather than hanging under nothing. */}
                      {specs.length > 0 && (
                        <>
                          <div
                            className="mt-4 h-px w-full"
                            style={{ backgroundColor: TICKET_INK, opacity: 0.22 }}
                          />
                          <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-2">
                            {specs.map(spec => (
                              <div key={spec.label}>
                                <dt
                                  className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                                  style={{ color: TICKET_INK }}
                                >
                                  {spec.label}
                                </dt>
                                <dd className="mt-0.5 text-[13px] font-semibold ltr-numerals">
                                  {spec.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </>
                      )}
                    </div>

                    {/* STUB — the tear-off. Centred on wide screens; on a phone
                        the price and the button sit side by side instead, which
                        keeps the band short. */}
                    <div className="flex h-[5.5rem] w-full shrink-0 flex-row items-center justify-between gap-3 px-5 py-3 sm:h-auto sm:w-[130px] sm:flex-col sm:justify-center sm:gap-0 sm:px-4 sm:py-5 sm:text-center lg:w-[148px]">
                      <div className="sm:w-full">
                        <span
                          className="block text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: TICKET_INK }}
                        >
                          {priceLine(pkg)}
                        </span>
                        <p className="mt-0.5 flex items-baseline gap-1 sm:justify-center">
                          <span className="font-display text-[28px] font-semibold leading-none ltr-numerals lg:text-[32px]">
                            {pkg.price}
                          </span>
                          <span className="text-[12px] font-semibold">SAR</span>
                        </p>
                        {/* Only when the package actually carries one. */}
                        {pkg.depositAmount ? (
                          <span
                            className="mt-1 block text-[10px] leading-snug ltr-numerals"
                            style={{ color: TICKET_INK, opacity: 0.82 }}
                          >
                            {pkg.depositAmount} SAR deposit
                          </span>
                        ) : null}
                      </div>

                      <span
                        className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[3px] px-3 text-center text-[11px] font-semibold leading-tight transition-opacity group-hover:opacity-90 sm:mt-3 sm:min-h-0 sm:w-full sm:py-2.5"
                        style={{ backgroundColor: TICKET_INK, color: '#F0F3EE' }}
                      >
                        See what&rsquo;s included
                      </span>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}

      {/* FOCUSED — the chosen celebration, told top to bottom. */}
      <AnimatePresence mode="wait">
        {focused && (
          <motion.div
            key={focused.id}
            initial="hidden"
            animate="visible"
            variants={revealList}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >

            {/* Visual + the decision, kept in view while the details scroll. */}
            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <motion.div
                layoutId={`bday-media-${focused.id}`}
                transition={spring}
                className="relative h-72 w-full overflow-hidden rounded-[32px] bg-brand-sand sm:h-96"
              >
                {focused.image && (
                  <AppImage
                    src={focused.image}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/80 via-brand-charcoal/15 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-7">
                  <motion.h2
                    layoutId={`bday-title-${focused.id}`}
                    transition={spring}
                    className="font-display text-3xl font-semibold text-brand-cream sm:text-4xl"
                  >
                    {focused.name}
                  </motion.h2>
                </div>
              </motion.div>

              <motion.div variants={revealItem} className="mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="font-display text-[34px] font-semibold text-brand-charcoal ltr-numerals">
                      {focused.price}
                    </span>
                    <span className="ms-1.5 text-sm font-medium text-brand-muted">
                      SAR {priceLine(focused)}
                    </span>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-brand-clay pt-5 text-sm">
                  {focused.duration && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Duration</dt>
                      <dd className="mt-1 font-medium text-brand-charcoal">{focused.duration}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Guests</dt>
                    <dd className="mt-1 font-medium text-brand-charcoal ltr-numerals">
                      {focused.minGuests}–{focused.maxGuests}
                    </dd>
                  </div>
                  {focused.ageInformation && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Ages</dt>
                      <dd className="mt-1 font-medium text-brand-charcoal">{focused.ageInformation}</dd>
                    </div>
                  )}
                  {focused.availableDays?.length > 0 && (
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Days</dt>
                      <dd className="mt-1 font-medium text-brand-charcoal">{focused.availableDays.join(', ')}</dd>
                    </div>
                  )}
                </dl>

                <button
                  type="button"
                  onClick={() => onChoose(focused.id)}
                  className="mt-6 w-full cursor-pointer rounded-full bg-brand-terracotta px-6 py-4 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.99]"
                >
                  Choose this package
                </button>
                <p className="mt-2.5 text-center text-[11px] text-brand-muted">
                  {focused.depositAmount ?? 500} SAR deposit confirms your date.
                </p>
              </motion.div>
            </div>

            {/* Everything the celebration includes. */}
            <div className="lg:col-span-7 space-y-8">

              {focused.fullDescription && (
                <motion.p variants={revealItem} className="text-base leading-[1.75] text-brand-ink">
                  {focused.fullDescription}
                </motion.p>
              )}

              {focused.includedItems.length > 0 && (
                <motion.section variants={revealItem}>
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-charcoal">
                    <CheckCircle2 className="h-5 w-5 text-brand-sage" />
                    What's included
                  </h3>
                  <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {focused.includedItems.map(entry => (
                      <li key={entry} className="flex gap-2.5 text-sm text-brand-ink">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-terracotta" />
                        <span>{entry}</span>
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}

              {focused.activityChoices.length > 0 && (
                <motion.section variants={revealItem} className="rounded-[28px] bg-brand-sand/50 p-6">
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-charcoal">
                    <Paintbrush className="h-5 w-5 text-brand-terracotta" />
                    Choose one activity
                  </h3>
                  <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {focused.activityChoices.map(activity => (
                      <li
                        key={activity}
                        className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-brand-charcoal ring-1 ring-brand-clay/70"
                      >
                        {activity}
                      </li>
                    ))}
                  </ul>
                  {focused.additionalInfo.length > 0 && (
                    <div className="mt-4 space-y-1.5 border-t border-brand-clay pt-4">
                      {focused.additionalInfo.map(note => (
                        <p key={note} className="text-xs font-medium text-brand-ink">{note}</p>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}

              {(focused.cakeDescription || focused.cakeSizes.length > 0) && (
                <motion.section variants={revealItem}>
                  <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-charcoal">
                    <Cake className="h-5 w-5 text-brand-terracotta" />
                    Customized birthday cake
                  </h3>
                  {focused.cakeDescription && (
                    <p className="mt-2 text-sm text-brand-ink">{focused.cakeDescription}</p>
                  )}
                  {focused.cakeSizes.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {focused.cakeSizes.map(size => (
                        <div
                          key={size.id}
                          className="rounded-2xl bg-white px-5 py-3 ring-1 ring-brand-clay/70"
                        >
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-muted">
                            {size.label}
                          </span>
                          <span className="font-display text-lg font-semibold text-brand-charcoal ltr-numerals">
                            {size.price} <span className="text-xs font-medium text-brand-muted">SAR</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}

              {(focused.trainerInfo || focused.deliveryInfo || focused.availableTimes?.length > 0) && (
                <motion.section variants={revealItem} className="space-y-2.5 border-t border-brand-clay pt-6">
                  {focused.trainerInfo && (
                    <p className="flex items-start gap-2.5 text-sm text-brand-ink">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
                      <span>{focused.trainerInfo}</span>
                    </p>
                  )}
                  {focused.deliveryInfo && (
                    <p className="flex items-start gap-2.5 text-sm text-brand-ink">
                      <Compass className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
                      <span>{focused.deliveryInfo}</span>
                    </p>
                  )}
                  {focused.availableTimes?.length > 0 && (
                    <p className="flex items-start gap-2.5 text-sm text-brand-ink">
                      <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
                      <span>{focused.availableTimes.join(' · ')}</span>
                    </p>
                  )}
                </motion.section>
              )}

              {(focused.customerNotes || focused.terms) && (
                <motion.section variants={revealItem} className="border-t border-brand-clay pt-6">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">
                    <ScrollText className="h-4 w-4" />
                    Good to know
                  </h3>
                  {focused.customerNotes && (
                    <p className="mt-3 text-sm leading-relaxed text-brand-ink">{focused.customerNotes}</p>
                  )}
                  {focused.terms && (
                    <p className="mt-3 text-sm leading-relaxed text-brand-ink">{focused.terms}</p>
                  )}
                </motion.section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
