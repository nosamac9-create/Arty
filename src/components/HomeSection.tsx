/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { PhotoGallery } from './ui/PhotoGallery';
import { VerticalCutReveal } from './ui/VerticalCutReveal';
import { CountingNumber } from './ui/CountingNumber';
import { ScrollReveal } from './ui/ScrollReveal';
import Reveal from './ui/Reveal';
import { AnimatedMap } from './ui/AnimatedMap';
import { BirthdayBalloons } from './ui/BirthdayBalloons';
import { AppImage } from './ui/AppImage';
import {
  ContainerStagger,
  ContainerAnimated,
  GalleryGrid,
  GalleryGridCell
} from './ui/CtaSectionWithGallery';
import { formatDate } from '../utils/calendarConfig';
import { isWorkshopFullyBooked } from '../utils/queueUtils';
import { Calendar, Sparkles, ChevronRight, Paintbrush, MousePointerClick, CalendarRange, Gift, Coffee, ChevronDown, Phone, Mail, UserCheck, Star, ArrowLeft } from 'lucide-react';

/**
 * The arc gallery's photographs, in the order the studio supplied them.
 * They live in /public so they are served as plain files, not bundled.
 */
const HERO_IMAGES = [
  'hero/studio-01.jpg',
  'hero/studio-02.jpg',
  'hero/studio-03.jpg',
  'hero/studio-04.jpg',
  'hero/studio-05.jpg',
  'hero/studio-06.jpg',
  'hero/studio-07.jpg',
  'hero/studio-08.jpg',
  'hero/studio-09.jpg',
  'hero/studio-10.jpg',
  'hero/studio-11.jpg',
  'hero/studio-12.jpg'
].map(path => `${import.meta.env.BASE_URL}images/${path}`);

const HERO_ALTS = [
  'Underglaze bottles beside a wall of fired colour test tiles',
  'Hands trimming a terracotta pot on the wheel',
  'Throwing a bowl on the potter’s wheel',
  'Paint-covered studio tables under handmade ceramic lamps',
  'A studio wall hung with students’ paintings',
  'Shelves of glazed cups and bowls made by students',
  'A hand reaching for brushes in a handmade cup',
  'An artist holding a loaded paint palette',
  'Shaping a cylinder with a rib tool at the wheel',
  'A visitor looking at the portrait wall',
  'A pot spinning on the wheel, seen from above',
  'The pottery room mid-session, trays of thrown cups drying'
];

export const HomeSection: React.FC = () => {
  const {
    workshops, setCustomerTab, setSelectedWorkshopId, events,
    setSelectedBirthdayPackage, publishedBirthdayPackages, setWorkshopsInitialCategory,
    workshopSessions, bookings, queue, todayDateStr
  } = useApp();
  const [showOwnerContact, setShowOwnerContact] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  /**
   * The wipe shared by the map and the Custom Events photograph, reused for the
   * in-place swap between the pitch and the owner's details: in from the
   * trailing edge, out the same way. Reduced motion gets the swap with no
   * movement at all — the panels simply exchange.
   */
  const customEventsSwap = prefersReducedMotion
    ? {
        initial: false as const,
        animate: { opacity: 1 },
        exit: undefined,
        transition: { duration: 0 }
      }
    : {
        initial: { opacity: 0, clipPath: 'inset(0 0 0 100%)' },
        animate: { opacity: 1, clipPath: 'inset(0 0 0 0%)' },
        exit: { opacity: 0, clipPath: 'inset(0 0 0 100%)' },
        transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }
      };

  // Get first 3 workshops as featured
  const featuredWorkshops = workshops.slice(0, 3);

  const publishedEvents = events.filter(evt => evt.status === 'Published');

  const formatEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Choose a Workshop',
      desc: 'Browse our curated collection of wheel throwing, hand-building, or acrylic canvas painting classes.',
      icon: MousePointerClick
    },
    {
      num: '02',
      title: 'Pick Your Time',
      desc: 'Select a convenient slot on our live scheduler. Hand-molding seats are limited for high quality tuition.',
      icon: CalendarRange
    },
    {
      num: '03',
      title: 'Book and Create',
      desc: 'Secure your spot instantly. Show up at our cozy Jeddah venue—all premium materials and drinks are ready.',
      icon: Paintbrush
    }
  ];



  const handleCardClick = (id: string) => {
    setSelectedWorkshopId(id);
    setCustomerTab('detail');
  };

  return (
    <div className="animate-in fade-in duration-300">
      
      {/* HERO — a stack of studio photographs that deals itself into a row.
          Copy, CTAs and the three facts are unchanged; only the arrangement
          around them is new. */}
      <section className="bg-brand-cream pt-10 sm:pt-14 pb-16 md:pb-20 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <Reveal index={0}>
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
              Creative Sanctuary in Jeddah
            </p>
          </Reveal>

          <h1 className="mx-auto mt-4 max-w-3xl text-center font-display text-[34px] sm:text-5xl lg:text-[62px] font-semibold text-brand-charcoal">
            <VerticalCutReveal
              splitBy="characters"
              staggerDuration={0.04}
              staggerFrom="center"
              transition={{ damping: 20, stiffness: 300, type: 'spring' }}
            >
              Melt into the art of <span className="text-brand-sage">clay &amp; canvas</span>.
            </VerticalCutReveal>
          </h1>

          <Reveal index={1}>
            <p className="mx-auto mt-5 max-w-xl text-center text-base sm:text-lg text-brand-ink leading-[1.7]">
              Slow down, pour a fresh cup of espresso, and handcraft ceramic pottery or vibrant
              acrylic art in Jeddah’s favorite creative retreat.
            </p>
          </Reveal>

          <PhotoGallery images={HERO_IMAGES} alts={HERO_ALTS} className="mt-10">
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
              <button
                onClick={() => {
                  setWorkshopsInitialCategory('All');
                  setCustomerTab('workshops');
                }}
                className="cursor-pointer rounded-full bg-brand-terracotta px-7 py-4 text-base font-semibold text-brand-cream shadow-button hover:bg-brand-terracotta-hover transition-colors duration-200 active:scale-[0.98]"
              >
                Browse Workshops
              </button>
              <button
                onClick={() => {
                  setSelectedWorkshopId('ws-1');
                  setCustomerTab('detail');
                }}
                className="cursor-pointer rounded-full border border-brand-clay bg-brand-cream px-7 py-4 text-base font-semibold text-brand-charcoal hover:bg-brand-clay-soft transition-colors duration-200"
              >
                View Top Experience
              </button>
            </div>

            {/* Three plain facts about the studio — the design leads with
                proof rather than adjectives. */}
            <dl className="mx-auto mt-12 grid max-w-xl grid-cols-1 xs:grid-cols-3 gap-6 border-t border-brand-clay pt-8">
              <div>
                <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">
                  <CountingNumber target={workshops.length} />
                </dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">Workshops running</dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">
                  <CountingNumber target={2} />
                </dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">Kilns firing weekly</dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">
                  {/* A year, so no thousands separator — never "2,021". */}
                  <CountingNumber target={2021} from={1990} groupThousands={false} />
                </dt>
                <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">On Ahmad Al Attas St.</dd>
              </div>
            </dl>
          </PhotoGallery>

        </div>
      </section>

      {/* FEATURED WORKSHOPS — a white full-bleed band, so the cards read against
          a clean backdrop instead of blending into the cream page. */}
      <section className="bg-white border-y border-brand-clay/60 py-16 md:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">

        {/* Left: the section's own words, played in as a stagger. */}
        <ContainerStagger className="text-start">
          <ContainerAnimated className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
            This week
          </ContainerAnimated>
          <ContainerAnimated className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">
            <h2>Featured Workshops</h2>
          </ContainerAnimated>
          <ContainerAnimated className="mt-3 max-w-xl text-brand-ink">
            Led by professional artisan tutors. Spaces are kept tight for custom, hands-on feedback.
          </ContainerAnimated>
          <ContainerAnimated className="mt-7">
            <button
              onClick={() => {
                setWorkshopsInitialCategory('All');
                setCustomerTab('workshops');
              }}
              className="group inline-flex shrink-0 items-center gap-2 rounded-full border border-brand-clay bg-brand-cream px-5 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-clay-soft cursor-pointer"
            >
              <span>View All ({workshops.length})</span>
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1 flip-rtl" />
            </button>
          </ContainerAnimated>
        </ContainerStagger>

        {/* Right: the real workshop cards, in the offset grid. Same cards and
            same live fields as before — only the arrangement is new. */}
        <GalleryGrid>
          {featuredWorkshops.map((ws, index) => (
            <GalleryGridCell key={ws.id} index={index}>
            <div
              onClick={() => handleCardClick(ws.id)}
              className="group cursor-pointer rounded-[22px] border border-brand-clay/60 bg-white shadow-card hover:shadow-card hover:-translate-y-1 transition-all duration-300 text-start flex flex-col h-full overflow-hidden"
            >
              {/* Photo — flush with the card's top and side edges. A fixed
                  height (not aspect-video) so every card's image locks to the
                  same box regardless of the source photo's own dimensions. */}
              <div className="relative h-48 sm:h-52 shrink-0 bg-brand-sand">
                <AppImage
                  src={ws.image}
                  alt={ws.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                
                {/* Availability chip — silent unless every upcoming date is
                    full; category chip always shows. */}
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                  {isWorkshopFullyBooked(ws.id, { workshopSessions, workshops, bookings, queue }, todayDateStr) ? (
                    <span className="inline-flex items-center rounded-full bg-brand-charcoal/85 px-3 py-1.5 text-[11px] font-semibold text-brand-cream backdrop-blur-sm">
                      Fully booked
                    </span>
                  ) : <span />}
                  <span className="inline-flex items-center rounded-full bg-brand-cream/90 px-3 py-1.5 text-[11px] font-semibold text-brand-charcoal backdrop-blur-sm">
                    {ws.category}
                  </span>
                </div>
              </div>

              {/* Info details */}
              <div className="flex-1 flex flex-col justify-between p-4">
                <div>
                  <h3 className="font-display text-xl font-semibold text-brand-charcoal group-hover:text-brand-terracotta transition-colors line-clamp-1">
                    {ws.title}
                  </h3>
                  <p className="text-sm text-brand-ink line-clamp-2 mt-1.5 leading-relaxed">
                    {ws.hook}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-brand-clay flex items-end justify-between gap-3">
                  <div className="text-[13px] text-brand-ink space-y-0.5 min-w-0">
                    <p className="truncate">{ws.duration}</p>
                    <p className="truncate">{ws.ageRange}</p>
                  </div>
                  <div className="text-end shrink-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-muted">Price</span>
                    <span className="font-display text-[22px] font-semibold text-brand-charcoal ltr-numerals">
                      {ws.price} <span className="text-xs font-medium text-brand-muted">SAR</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </GalleryGridCell>
          ))}
        </GalleryGrid>

      </div>
      </section>

      {/* HOW BOOKING WORKS */}
      <section className="bg-brand-sand border-y border-brand-clay py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-xl mx-auto mb-12">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Three steps</span>
            <Reveal index={0}>
              <h2 className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">
                How Booking Works
              </h2>
            </Reveal>
            <Reveal index={1}>
              <p className="text-brand-ink mt-2">
                Three simple, effortless steps from clay mud to beautiful glazed pottery.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, stepIndex) => {
              const Icon = step.icon;
              return (
                <ScrollReveal
                  key={step.num}
                  once
                  /* Fires a little before the card is 30% in, so the stagger
                     is already running as the section arrives rather than
                     finishing after it has settled. */
                  viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
                  transition={{ delay: stepIndex * 0.12, duration: 0.5, ease: 'easeOut' }}
                  variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
                >
                <div className="bg-brand-cream rounded-[22px] p-7 border border-brand-clay shadow-card-sm relative text-start h-full">
                  <div className="absolute top-5 end-6 font-display text-3xl font-semibold text-brand-clay">
                    {step.num}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-sage-soft text-brand-sage-hover mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-brand-charcoal mb-2">{step.title}</h3>
                  <p className="text-sm text-brand-ink leading-relaxed">{step.desc}</p>
                </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CELEBRATE YOUR BIRTHDAY WITH US — a dark full-bleed band, like every
          other section on the page, instead of a card floating on the cream
          background. Points only at the packages themselves; custom, one-off
          events live in their own section below so the two never blur. */}
      <section className="relative overflow-hidden bg-brand-charcoal py-16 md:py-20">
      {/* Decorative only. The balloons layer is pointer-events-none, so the
          button and the package cards stay fully clickable through it. */}
      <BirthdayBalloons />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            <div className="text-start">
              {/* Reveal order through this section: badge → heading →
                  paragraph → button → package 01 → package 02. */}
              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.3 }}
                transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-cream/10 px-3.5 py-1.5 text-xs font-medium text-brand-cream/85">
                  <Gift className="h-3.5 w-3.5" />
                  <span>Birthday Celebrations &amp; Private Parties</span>
                </div>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.3 }}
                transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              >
                <ContainerStagger>
                  <ContainerAnimated className="mt-6 font-display text-3xl sm:text-4xl lg:text-[44px] font-semibold text-brand-cream">
                    <h2>Celebrate your birthday with us</h2>
                  </ContainerAnimated>
                </ContainerStagger>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.3 }}
                transition={{ delay: 0.24, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
              >
                <p className="mt-5 max-w-lg text-base leading-[1.7] text-brand-cream/70">
                  Make your child's special day unforgettable with creative art sessions, balloons,
                  customized cakes, and fun hands-on memories in our studio.
                </p>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.3 }}
                transition={{ delay: 0.36, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="mt-8 flex flex-wrap gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    // Overview mode: clearing the selection is what stops a
                    // package chosen earlier from opening itself here.
                    setSelectedBirthdayPackage('');
                    setWorkshopsInitialCategory('Birthday Packages');
                    setCustomerTab('workshops');
                  }}
                  className="cursor-pointer rounded-full bg-brand-terracotta px-6 py-3.5 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.98]"
                >
                  See packages
                </button>
              </ScrollReveal>
            </div>

            {publishedBirthdayPackages.length > 0 && (
              /* Two tickets pinned side by side, each tilted the other way.
                 The tilt is desktop-only — on a phone they stack upright so
                 they stay readable. */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 pt-2">
                {publishedBirthdayPackages.map((pkg, index) => (
                  <ScrollReveal
                    key={pkg.id}
                    once
                    viewOptions={{ once: true, amount: 0.3 }}
                    transition={{ delay: 0.48 + index * 0.12, duration: 0.5, ease: 'easeOut' }}
                    variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                  >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBirthdayPackage(pkg.id);
                      setWorkshopsInitialCategory('Birthday Packages');
                      setCustomerTab('workshops');
                    }}
                    className={`birthday-ticket group relative h-full w-full cursor-pointer rounded-[22px] border border-brand-cream/15 bg-brand-cream/[0.07] py-6 ps-6 pe-14 flex flex-col text-start shadow-card transition-all duration-300 hover:bg-brand-cream/[0.13] hover:border-brand-cream/25 sm:hover:rotate-0 sm:hover:-translate-y-1 ${
                      index % 2 === 0 ? 'sm:-rotate-[2.5deg]' : 'sm:rotate-[2.5deg]'
                    }`}
                  >
                    {/* The tear-off stub: a perforation down the end side, with
                        the strip beyond it tinted a shade lighter so it reads as
                        the part that comes away. Logical inset, so it sits on
                        the correct side in Arabic as well as English. The card's
                        `pe-14` is what keeps the copy clear of it. */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 end-0 w-11 rounded-e-[22px] border-s border-dashed border-brand-cream/20 bg-brand-cream/[0.04]"
                    />

                    <div className="flex items-start justify-between gap-4">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-cream/45">
                        Package {String(index + 1).padStart(2, '0')}
                      </span>
                      {/* The ticket's punched holes. */}
                      <span className="flex gap-1 pt-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-cream/25" />
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-cream/25" />
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-cream/25" />
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-2xl font-semibold text-brand-cream">{pkg.name}</h3>

                    <p className="mt-3 text-[13px] leading-relaxed text-brand-cream/60">
                      {[
                        pkg.maxGuests ? `${pkg.maxGuests} guests` : null,
                        pkg.duration || null,
                        pkg.shortDescription || null
                      ].filter(Boolean).join(' · ')}
                    </p>

                    {/* The tear line, then the price stub. */}
                    <div className="mt-auto pt-6">
                      <div className="border-t border-dashed border-brand-cream/20 pt-4 flex items-end justify-between gap-3">
                        <div>
                          <span className="font-display text-2xl font-semibold text-brand-cream ltr-numerals">
                            {pkg.price}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-brand-cream/50">SAR per party</span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-cream/80 transition-colors group-hover:text-brand-cream">
                          See package
                          <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 flip-rtl" />
                        </span>
                      </div>
                    </div>
                  </button>
                  </ScrollReveal>
                ))}
              </div>
            )}

          </div>
      </div>
      </section>

      {/* CREATE YOUR OWN EVENT — deliberately its own section, separate from the
          birthday packages above, so customers don't mistake a custom request
          for one of the fixed packages. A white full-bleed band, like Featured
          Workshops, so the page's sections keep alternating backgrounds. */}
      <section className="bg-white border-y border-brand-clay/60 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* One cream slab holding the whole section: words on the left, the
            studio on the right, the image given the larger share. */}
        <motion.div
          layout={!prefersReducedMotion}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[32px] bg-brand-sand px-6 py-10 sm:px-10 sm:py-12 lg:px-14"
        >

          {/* Quiet studio marks — a clay curve and two sparks. Decorative only. */}
          <svg
            className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 text-brand-clay/50"
            viewBox="0 0 100 100" fill="none" aria-hidden="true"
          >
            <circle cx="50" cy="50" r="34" stroke="currentColor" strokeWidth="1.25" />
            <path d="M22 62c14-10 28-14 42-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
          <svg
            className="pointer-events-none absolute bottom-6 left-8 h-20 w-20 text-brand-sage/35"
            viewBox="0 0 100 100" fill="none" aria-hidden="true"
          >
            <path d="M50 14c4 22 14 32 36 36-22 4-32 14-36 36-4-22-14-32-36-36 22-4 32-14 36-36Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>

          {/* The card holds two states in the same slab: the pitch, and the
              owner's details. `mode="wait"` lets the outgoing one finish its
              wipe before the incoming one starts, so the two never overlap
              mid-swap; `layout` on the slab absorbs the height difference
              between them instead of snapping. */}
          <AnimatePresence mode="wait" initial={false}>
          {!showOwnerContact ? (
          <motion.div
            key="custom-events-pitch"
            {...customEventsSwap}
            className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14"
          >

            {/* Words — five of twelve columns, so the photograph leads. */}
            <div className="text-start lg:col-span-5">
              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
                  Custom Events
                </span>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.4 }}
                transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
              >
                <ContainerStagger>
                  <ContainerAnimated className="mt-3 font-display text-[34px] leading-[1.1] md:text-[46px] font-semibold text-brand-charcoal">
                    <h2>Plan your own event</h2>
                  </ContainerAnimated>
                </ContainerStagger>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.4 }}
                transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
              >
                <p className="mt-5 max-w-md text-[15px] text-brand-ink leading-[1.75]">
                  Adult pottery parties, corporate team-building, bridal showers, or anything outside our
                  fixed packages — connect directly with our owner to design something custom.
                </p>
              </ScrollReveal>

              <ScrollReveal
                once
                viewOptions={{ once: true, amount: 0.4 }}
                transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
                className="mt-8"
              >
                <button
                  onClick={() => setShowOwnerContact(prev => !prev)}
                  className="group cursor-pointer inline-flex items-center justify-center gap-2.5 rounded-full bg-brand-charcoal px-7 py-4 text-base font-semibold text-brand-cream shadow-button transition-colors duration-200 hover:bg-brand-terracotta active:scale-[0.98]"
                >
                  <Sparkles className="h-5 w-5 text-brand-terracotta transition-colors group-hover:text-brand-cream" />
                  <span>Create your own Event</span>
                  {/* Always the forward chevron now: this button only exists on
                      the pitch face, and the way back is the Back control on
                      the contact face rather than a collapse here. */}
                  <ChevronRight className="h-5 w-5 text-brand-cream/70 transition-transform duration-200 group-hover:translate-x-1 flip-rtl" />
                </button>
              </ScrollReveal>
            </div>

            {/* The studio — seven of twelve, wiped in from the trailing edge. */}
            <ScrollReveal
              once
              viewOptions={{ once: true, amount: 0.25 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              /* The observed element must not be the clipped one — an element
                 clipped to zero area reports zero intersection, so useInView
                 never fires and the reveal holds it invisible. The wipe is on
                 the inner element, which inherits the variant. */
              variants={{ hidden: { opacity: 0, x: 48 }, visible: { opacity: 1, x: 0 } }}
              className="lg:col-span-7"
            >
              <motion.div
                className="relative overflow-hidden rounded-[26px] shadow-card"
                variants={{
                  hidden: { clipPath: 'inset(0 0 0 100%)' },
                  visible: { clipPath: 'inset(0 0 0 0%)' }
                }}
                transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/custom-events.jpg`}
                  alt="The Arty Café studio set up for a private event"
                  className="h-64 w-full object-cover sm:h-80 lg:h-[26rem]"
                  loading="lazy"
                  decoding="async"
                />
              </motion.div>
            </ScrollReveal>

          </motion.div>
          ) : (
            /* The owner's details — same content as the card that used to open
               below this section, now the card's second face. */
            <motion.div
              key="custom-events-contact"
              {...customEventsSwap}
              className="relative"
            >
              <div className="bg-brand-cream border-2 border-brand-terracotta/40 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto text-start shadow-card-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-brand-clay">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-terracotta text-brand-cream shrink-0">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-brand-charcoal">Owner & Event Host Contact</h3>
                    <p className="text-xs text-brand-ink">Connect directly with our owner to craft custom events, corporate gatherings, or private parties.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="bg-brand-sand/40 p-4 rounded-2xl border border-brand-clay flex items-start gap-3">
                    <Phone className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-semibold text-brand-muted uppercase block">Direct Phone & WhatsApp</span>
                      <a href="tel:+966501234567" className="font-semibold text-brand-charcoal hover:text-brand-terracotta font-mono">
                        +966 50 123 4567
                      </a>
                    </div>
                  </div>

                  <div className="bg-brand-sand/40 p-4 rounded-2xl border border-brand-clay flex items-start gap-3">
                    <Mail className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-semibold text-brand-muted uppercase block">Owner Email</span>
                      <a href="mailto:events@artycafe.sa" className="font-semibold text-brand-charcoal hover:text-brand-terracotta">
                        events@artycafe.sa
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-sand/40 p-4 rounded-2xl border border-brand-clay text-xs text-brand-ink space-y-1">
                  <p className="font-semibold text-brand-charcoal flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 text-brand-terracotta fill-brand-terracotta" />
                    Bespoke Custom Event Planning
                  </p>
                  <p className="leading-relaxed">
                    Have a unique theme, adult pottery party, corporate team-building, or bridal shower in mind? Reach out via WhatsApp or email for custom quotes, private venue buyout availability, and tailored artist arrangements!
                  </p>
                </div>

                {/* Reverses the swap — the pitch, button and photograph wipe
                    back in. The button that opened this is part of the face
                    that just left, so the way back lives here. */}
                <button
                  type="button"
                  onClick={() => setShowOwnerContact(false)}
                  className="group cursor-pointer inline-flex items-center gap-2 rounded-full border border-brand-clay bg-brand-sand/40 px-5 py-3 text-sm font-semibold text-brand-ink transition-colors hover:text-brand-charcoal hover:border-brand-muted active:scale-[0.98]"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 flip-rtl" />
                  <span>Back</span>
                </button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>

        </motion.div>
      </div>
      </section>

      {/* LOCATION & CONTACT BLOCK — sits directly on a tan full-bleed band
          (no card wrapper of its own); only the map placeholder on the right
          keeps its own box. The tan tone alternates against its white/cream
          neighbors, matching How Booking Works' treatment above. */}
      <section className="bg-brand-cream border-y border-brand-clay py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-start">
            
            {/* Info */}
            <div className="lg:col-span-5 space-y-6">
              <Reveal index={0}>
                <h2 className="font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">
                  Slow down &amp; visit us
                </h2>
              </Reveal>
              <Reveal index={1}>
                <p className="text-brand-ink leading-[1.7]">
                  We are situated in Al Zahra District. Grab a quiet corner, sculpt some clay, and meet friendly creative people.
                </p>
              </Reveal>
              
              {/* Labelled rows separated by hairlines — no icons, so the
                  eye runs straight down the labels. */}
              <dl className="pt-2 text-sm">
                <Reveal index={2}>
                  <div className="border-t border-brand-clay py-4">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Address</dt>
                    <dd className="mt-1.5 text-brand-charcoal">
                      3331 Ahmad Al Attas, Al Zahra District, Jeddah 23521, Saudi Arabia
                    </dd>
                  </div>
                </Reveal>

                <Reveal index={3}>
                  <div className="border-t border-brand-clay py-4">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Opening Hours</dt>
                    <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                      Every day: 05:00 PM – 12:00 AM
                    </dd>
                  </div>
                </Reveal>

                <Reveal index={4}>
                  <div className="border-t border-b border-brand-clay py-4">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Call Front Desk</dt>
                    <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                      +966 54 822 2055 (Walk-ins welcome!)
                    </dd>
                  </div>
                </Reveal>
              </dl>
            </div>

            {/* Map — drawn rather than embedded, and clickable as a whole:
                it opens the studio's real Google Maps listing.

                Wiped in from the trailing edge, the same way the Custom Events
                studio photo arrives. As there, the observed element is not the
                clipped one: an element clipped to zero area reports zero
                intersection, so useInView would never fire and the reveal would
                hold it invisible. The wipe lives on the inner element, which
                inherits the variant. */}
            <ScrollReveal
              once
              viewOptions={{ once: true, amount: 0.25 }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              variants={{ hidden: { opacity: 0, x: 48 }, visible: { opacity: 1, x: 0 } }}
              className="lg:col-span-7"
            >
              <motion.div
                className="relative overflow-hidden rounded-[26px]"
                variants={{
                  hidden: { clipPath: 'inset(0 0 0 100%)' },
                  visible: { clipPath: 'inset(0 0 0 0%)' }
                }}
                transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <AnimatedMap
                  href="https://maps.app.goo.gl/Br4QagaCrPKeJ8EW8"
                  label="Arty Café Jeddah"
                  coordinates="21.5897° N, 39.1288° E"
                  className="h-72 md:h-96"
                />
              </motion.div>
            </ScrollReveal>

          </div>
      </div>
      </section>

    </div>
  );
};
