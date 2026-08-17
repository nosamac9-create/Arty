/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/calendarConfig';
import { Calendar, Sparkles, ChevronRight, Paintbrush, MousePointerClick, CalendarRange, Gift, Coffee, ChevronDown, ChevronUp, Phone, Mail, UserCheck, Star } from 'lucide-react';

export const HomeSection: React.FC = () => {
  const {
    workshops, setCustomerTab, setSelectedWorkshopId, events,
    setSelectedBirthdayPackage, publishedBirthdayPackages, setWorkshopsInitialCategory
  } = useApp();
  const [showOwnerContact, setShowOwnerContact] = useState(false);

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
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-brand-cream py-12 md:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-5 space-y-6 text-start">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-sage-line bg-brand-sage-soft px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-sage-hover">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Creative Sanctuary in Jeddah</span>
              </div>
              <h1 className="font-display text-[42px] sm:text-5xl lg:text-[62px] font-semibold text-brand-charcoal">
                Melt into the art of <span className="text-brand-sage">clay &amp; canvas</span>.
              </h1>
              <p className="text-lg text-brand-ink max-w-lg leading-[1.7]">
                Slow down, pour a fresh cup of espresso, and handcraft ceramic pottery or vibrant acrylic art in Jeddah’s favorite creative retreat.
              </p>
              <div className="pt-2 flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    setWorkshopsInitialCategory('All');
                    setCustomerTab('workshops');
                  }}
                  className="cursor-pointer rounded-[14px] bg-brand-terracotta px-7 py-4 text-base font-semibold text-brand-cream shadow-button hover:bg-brand-terracotta-hover transition-colors duration-200 active:scale-[0.98]"
                >
                  Browse Workshops
                </button>
                <button
                  onClick={() => {
                    setSelectedWorkshopId('ws-1');
                    setCustomerTab('detail');
                  }}
                  className="cursor-pointer rounded-[14px] border border-brand-clay bg-brand-cream px-7 py-4 text-base font-semibold text-brand-charcoal hover:bg-brand-clay-soft transition-colors duration-200"
                >
                  View Top Experience
                </button>
              </div>

              {/* Three plain facts about the studio — the design leads with
                  proof rather than adjectives. */}
              <dl className="grid grid-cols-1 xs:grid-cols-3 gap-5 border-t border-brand-clay pt-6 max-w-lg">
                <div>
                  <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">{workshops.length}</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">Workshops running</dd>
                </div>
                <div>
                  <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">2</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">Kilns firing weekly</dd>
                </div>
                <div>
                  <dt className="font-display text-2xl font-semibold text-brand-charcoal ltr-numerals">2021</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">On Ahmad Al Attas St.</dd>
                </div>
              </dl>
            </div>

            {/* Right Photo Column */}
            <div className="lg:col-span-7">
              <div className="relative rounded-[28px] overflow-hidden shadow-card aspect-video md:aspect-[4/3] max-h-[480px]">
                <img
                  src="/images/hero-clay.webp"
                  alt="Clay modeling on potter wheel at Arty Cafe"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/40 to-transparent"></div>
                
                {/* Floating pill over hero image */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between bg-brand-cream/95 backdrop-blur-sm p-4 rounded-2xl border border-brand-clay shadow-card">
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 rounded-full bg-green-500 animate-ping"></span>
                    <span className="flex h-3 w-3 absolute rounded-full bg-green-500"></span>
                    <p className="text-sm font-semibold text-brand-charcoal ml-3">Clay Studio Spinning Right Now</p>
                  </div>
                  <button
                    onClick={() => {
                      setWorkshopsInitialCategory('All');
                      setCustomerTab('workshops');
                    }}
                    className="text-xs font-semibold text-brand-terracotta flex items-center hover:underline"
                  >
                    Join Queue <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FEATURED WORKSHOPS — a white full-bleed band, so the cards read against
          a clean backdrop instead of blending into the cream page. */}
      <section className="bg-white border-y border-brand-clay/60 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 text-start">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">This week</span>
            <h2 className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">Featured Workshops</h2>
            <p className="text-brand-ink mt-3 max-w-xl">
              Led by professional artisan tutors. Spaces are kept tight for custom, hands-on feedback.
            </p>
          </div>
          <button
            onClick={() => {
              setWorkshopsInitialCategory('All');
              setCustomerTab('workshops');
            }}
            className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-brand-clay bg-brand-cream px-5 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-clay-soft cursor-pointer md:self-auto"
          >
            <span>View All ({workshops.length})</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1 flip-rtl" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredWorkshops.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleCardClick(ws.id)}
              className="group cursor-pointer rounded-[22px] border border-brand-clay/60 bg-white shadow-card hover:shadow-card hover:-translate-y-1 transition-all duration-300 text-start flex flex-col h-full overflow-hidden"
            >
              {/* Photo — flush with the card's top and side edges. A fixed
                  height (not aspect-video) so every card's image locks to the
                  same box regardless of the source photo's own dimensions. */}
              <div className="relative h-48 sm:h-52 shrink-0 bg-brand-sand">
                <img
                  src={ws.image}
                  alt={ws.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                
                {/* Spots Pill */}
                {/* Both chips ride the top of the image: availability on the
                    leading edge, category on the trailing one. */}
                <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                  {ws.spotsLeft === 0 ? (
                    <span className="inline-flex items-center rounded-full bg-brand-charcoal/85 px-3 py-1.5 text-[11px] font-semibold text-brand-cream backdrop-blur-sm">
                      Fully booked
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-brand-charcoal/85 px-3 py-1.5 text-[11px] font-semibold text-brand-cream backdrop-blur-sm">
                      {ws.spotsLeft} spots left
                    </span>
                  )}
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
          ))}
        </div>
      </div>
      </section>

      {/* HOW BOOKING WORKS */}
      <section className="bg-brand-sand border-y border-brand-clay py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-xl mx-auto mb-12">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Three steps</span>
            <h2 className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">How Booking Works</h2>
            <p className="text-brand-ink mt-2">
              Three simple, effortless steps from clay mud to beautiful glazed pottery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="bg-brand-cream rounded-[22px] p-7 border border-brand-clay shadow-card-sm relative text-start">
                  <div className="absolute top-5 end-6 font-display text-3xl font-semibold text-brand-clay">
                    {step.num}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-brand-sage-soft text-brand-sage-hover mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-brand-charcoal mb-2">{step.title}</h3>
                  <p className="text-sm text-brand-ink leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CELEBRATE YOUR BIRTHDAY WITH US — a dark full-bleed band, like every
          other section on the page, instead of a card floating on the cream
          background. Points only at the packages themselves; custom, one-off
          events live in their own section below so the two never blur. */}
      <section className="bg-brand-charcoal py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            <div className="text-start">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-cream/10 px-3.5 py-1.5 text-xs font-medium text-brand-cream/85">
                <Gift className="h-3.5 w-3.5" />
                <span>Birthday Celebrations &amp; Private Parties</span>
              </div>

              <h2 className="mt-6 font-display text-3xl sm:text-4xl lg:text-[44px] font-semibold text-brand-cream">
                Celebrate your birthday with us
              </h2>

              <p className="mt-5 max-w-lg text-base leading-[1.7] text-brand-cream/70">
                Make your child's special day unforgettable with creative art sessions, balloons,
                customized cakes, and fun hands-on memories in our studio.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWorkshopsInitialCategory('Birthday Packages');
                    setCustomerTab('workshops');
                  }}
                  className="cursor-pointer rounded-[14px] bg-brand-terracotta px-6 py-3.5 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.98]"
                >
                  See packages
                </button>
              </div>
            </div>

            {publishedBirthdayPackages.length > 0 && (
              <div className="space-y-4">
                {publishedBirthdayPackages.map((pkg, index) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setSelectedBirthdayPackage(pkg.id);
                      setWorkshopsInitialCategory('Birthday Packages');
                      setCustomerTab('workshops');
                    }}
                    className="w-full cursor-pointer rounded-[20px] border border-brand-cream/10 bg-brand-cream/[0.07] p-6 flex items-start justify-between gap-6 text-start transition-colors hover:bg-brand-cream/[0.12] hover:border-brand-cream/20"
                  >
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-cream/45">
                        Package {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="mt-1.5 font-display text-xl font-semibold text-brand-cream">{pkg.name}</h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-brand-cream/60">
                        {[
                          pkg.maxGuests ? `${pkg.maxGuests} guests` : null,
                          pkg.duration || null,
                          pkg.shortDescription || null
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="shrink-0 text-end">
                      <span className="font-display text-2xl font-semibold text-brand-cream ltr-numerals">
                        {pkg.price}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-brand-cream/50">SAR per party</span>
                    </div>
                  </button>
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
      <section className="bg-white border-y border-brand-clay/60 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Custom Events</span>
          <h2 className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">Plan your own event</h2>
          <p className="text-brand-ink mt-3 max-w-xl mx-auto leading-[1.7]">
            Adult pottery parties, corporate team-building, bridal showers, or anything outside our
            fixed packages — connect directly with our owner to design something custom.
          </p>

          <div className="mt-8 space-y-4">
            <button
              onClick={() => setShowOwnerContact(prev => !prev)}
              className="cursor-pointer inline-flex items-center justify-center gap-2.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-base font-semibold px-8 py-4 rounded-2xl shadow-card-sm transition-all duration-200 active:scale-95 border border-brand-clay"
            >
              <Sparkles className="h-5 w-5 text-brand-terracotta" />
              <span>Create your own Event</span>
              {showOwnerContact ? <ChevronUp className="h-5 w-5 text-brand-clay" /> : <ChevronDown className="h-5 w-5 text-brand-clay" />}
            </button>

            {showOwnerContact && (
              <div className="bg-brand-cream border-2 border-brand-terracotta/40 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto text-start shadow-card-sm animate-in fade-in duration-300 space-y-6">
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
              </div>
            )}
          </div>
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
              <h2 className="font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">Slow down &amp; visit us</h2>
              <p className="text-brand-ink leading-[1.7]">
                We are situated in Al Zahra District. Grab a quiet corner, sculpt some clay, and meet friendly creative people.
              </p>
              
              {/* Labelled rows separated by hairlines — no icons, so the
                  eye runs straight down the labels. */}
              <dl className="pt-2 text-sm">
                <div className="border-t border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Address</dt>
                  <dd className="mt-1.5 text-brand-charcoal">
                    3331 Ahmad Al Attas, Al Zahra District, Jeddah 23521, Saudi Arabia
                  </dd>
                </div>

                <div className="border-t border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Opening Hours</dt>
                  <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                    Every day: 05:00 PM – 12:00 AM
                  </dd>
                </div>

                <div className="border-t border-b border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Call Front Desk</dt>
                  <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                    +966 54 822 2055 (Walk-ins welcome!)
                  </dd>
                </div>
              </dl>
            </div>

            {/* Map — the studio's real Google Maps embed */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden border border-brand-clay h-72 md:h-96 shadow-inner bg-brand-sand">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3709.903266193685!2d39.128822799999995!3d21.5896987!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x15c3dbe2b52fdff1%3A0xc4b6d955ad20394e!2zQXJ0eSBjYWZlINii2LHYqtmKINmD2KfZgdmK!5e0!3m2!1sen!2ssa!4v1786860695546!5m2!1sen!2ssa"
                  className="absolute inset-0 h-full w-full"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Arty Café Jeddah location map"
                />
              </div>

              <a
                href="https://maps.app.goo.gl/Br4QagaCrPKeJ8EW8"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-terracotta hover:underline cursor-pointer"
              >
                <span>Open in Google Maps</span>
                <ChevronRight className="h-3 w-3" />
              </a>
            </div>

          </div>
      </div>
      </section>

    </div>
  );
};
