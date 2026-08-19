/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Cake, CalendarRange, CheckCircle2, ChevronRight, Clock, Compass,
  Paintbrush, Sparkles, Users, ArrowLeft, ScrollText
} from 'lucide-react';
import { BirthdayPackage } from '../types';

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

      {/* OVERVIEW — both packages, revealed in sequence rather than together. */}
      {!focused && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {packages.map((pkg, index) => (
            <motion.button
              key={pkg.id}
              type="button"
              onClick={() => focus(pkg.id)}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : index * 0.14, duration: 0.55, ease }}
              className="group w-full overflow-hidden rounded-[32px] bg-white text-start shadow-card ring-1 ring-brand-clay/70 transition-shadow hover:shadow-2xl hover:shadow-brand-terracotta/10 cursor-pointer"
            >
              <motion.div
                layoutId={`bday-media-${pkg.id}`}
                transition={spring}
                className="relative h-56 w-full overflow-hidden bg-brand-sand sm:h-64"
              >
                {pkg.image && (
                  <img
                    src={pkg.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/75 via-brand-charcoal/10 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-cream/70">
                    Package {String(index + 1).padStart(2, '0')}
                  </span>
                  <motion.h3
                    layoutId={`bday-title-${pkg.id}`}
                    transition={spring}
                    className="mt-1 font-display text-[26px] font-semibold text-brand-cream"
                  >
                    {pkg.name}
                  </motion.h3>
                </div>
              </motion.div>

              <div className="p-6 sm:p-7">
                {pkg.shortDescription && (
                  <p className="text-sm leading-relaxed text-brand-ink">{pkg.shortDescription}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-brand-ink">
                  {pkg.duration && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-brand-sage" />{pkg.duration}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-brand-sage" />{pkg.minGuests}–{pkg.maxGuests} guests
                  </span>
                  {pkg.ageInformation && (
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-brand-sage" />{pkg.ageInformation}
                    </span>
                  )}
                </div>

                <div className="mt-6 flex items-end justify-between gap-4 border-t border-brand-clay pt-5">
                  <div>
                    <span className="font-display text-[30px] font-semibold text-brand-charcoal ltr-numerals">
                      {pkg.price}
                    </span>
                    <span className="ms-1.5 text-xs font-medium text-brand-muted">SAR {priceLine(pkg)}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-terracotta">
                    Explore package
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1 flip-rtl" />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
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
                  <img
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
