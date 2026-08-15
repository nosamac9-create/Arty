/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/calendarConfig';
import { Calendar, Clock, MapPin, Sparkles, ChevronRight, Compass, Paintbrush, MousePointerClick, CalendarRange, Gift, Cake, Coffee, CheckCircle2, ChevronDown, ChevronUp, Phone, Mail, UserCheck, Star } from 'lucide-react';

export const HomeSection: React.FC = () => {
  const { workshops, setCustomerTab, setSelectedWorkshopId, events, setSelectedBirthdayPackage, publishedBirthdayPackages } = useApp();
  const [showOwnerContact, setShowOwnerContact] = useState(false);
  // Which package cards are expanded, keyed by package id
  const [openPackages, setOpenPackages] = useState<Record<string, boolean>>({});
  const togglePackage = (id: string) =>
    setOpenPackages(prev => ({ ...prev, [id]: !prev[id] }));

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
    <div className="space-y-20 pb-20 animate-in fade-in duration-300">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden py-12 md:py-20 lg:py-24">
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
                  onClick={() => setCustomerTab('workshops')}
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
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.1em] text-brand-muted">On Al-Rawdah St.</dd>
                </div>
              </dl>
            </div>

            {/* Right Photo Column */}
            <div className="lg:col-span-7">
              <div className="relative rounded-[28px] overflow-hidden shadow-card aspect-video md:aspect-[4/3] max-h-[480px]">
                <img
                  src="https://images.unsplash.com/photo-1565192647048-f997ded87958?auto=format&fit=crop&w=1200&q=80"
                  alt="Clay modeling on potter wheel at Arty Cafe"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  referrerPolicy="no-referrer"
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
                    onClick={() => setCustomerTab('workshops')}
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

      {/* FEATURED WORKSHOPS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 text-start">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">This week</span>
            <h2 className="mt-2 font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">Featured Workshops</h2>
            <p className="text-brand-ink mt-3 max-w-xl">
              Led by professional artisan tutors. Spaces are kept tight for custom, hands-on feedback.
            </p>
          </div>
          <button 
            onClick={() => setCustomerTab('workshops')}
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
              className="group cursor-pointer rounded-[22px] border border-brand-clay bg-brand-cream p-4 shadow-card-sm hover:shadow-card transition-all duration-300 hover:-translate-y-1 text-start flex flex-col h-full"
            >
              {/* Photo */}
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-brand-sand">
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
              <div className="flex-1 flex flex-col justify-between">
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
      </section>

      {/* HOW BOOKING WORKS */}
      <section className="bg-brand-clay-soft border-y border-brand-clay py-16">
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

      {/* CELEBRATE YOUR BIRTHDAY WITH US */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">

        {/* The dark band. The package strip on the right is a read-only summary
            of the same published records the detailed cards below render. */}
        <div className="rounded-[28px] bg-brand-charcoal px-6 py-10 sm:px-10 sm:py-14 lg:px-14">
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
                  onClick={() => setShowOwnerContact(prev => !prev)}
                  className="cursor-pointer rounded-[14px] bg-brand-cream px-6 py-3.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-white active:scale-[0.98]"
                >
                  Create your own Event
                </button>
                <a
                  href="#birthday-packages"
                  className="cursor-pointer rounded-[14px] border border-brand-cream/25 px-6 py-3.5 text-sm font-semibold text-brand-cream transition-colors hover:bg-brand-cream/10"
                >
                  See packages
                </a>
              </div>
            </div>

            {publishedBirthdayPackages.length > 0 && (
              <div className="space-y-4">
                {publishedBirthdayPackages.map((pkg, index) => (
                  <div
                    key={pkg.id}
                    className="rounded-[20px] border border-brand-cream/10 bg-brand-cream/[0.07] p-6 flex items-start justify-between gap-6 text-start"
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
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Options Grid — rendered from the shared birthday package records.
            Everything shown here is edited in Staff Console → Birthday Event. */}
        <div id="birthday-packages" className="scroll-mt-28" />

        {publishedBirthdayPackages.length === 0 ? (
          <p className="text-sm text-brand-muted italic">
            Birthday packages are being updated. Please check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {publishedBirthdayPackages.map((pkg, index) => {
              const isOpen = !!openPackages[pkg.id];
              const accent = index % 2 === 0 ? 'terracotta' : 'sage';
              const accentText = accent === 'terracotta' ? 'text-brand-terracotta' : 'text-brand-sage';
              const accentBg = accent === 'terracotta' ? 'bg-brand-terracotta' : 'bg-brand-sage';
              const accentHover = accent === 'terracotta'
                ? 'bg-brand-terracotta hover:bg-brand-terracotta-hover'
                : 'bg-brand-sage hover:bg-brand-sage/90';

              return (
                <div
                  key={pkg.id}
                  className="bg-brand-cream border-2 border-brand-clay rounded-3xl p-6 md:p-8 shadow-card-sm flex flex-col text-start relative overflow-hidden transition-all duration-300"
                >
                  <div className={`absolute -top-12 -right-12 w-32 h-32 ${accentBg}/5 rounded-full blur-2xl pointer-events-none`}></div>

                  {/* Package image */}
                  {pkg.image && (
                    <div className="h-40 w-full rounded-2xl overflow-hidden border border-brand-clay mb-4">
                      <img src={pkg.image} alt={pkg.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Header / Clickable Accordion Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-clay">
                    <button
                      type="button"
                      onClick={() => togglePackage(pkg.id)}
                      className="flex-1 flex items-center justify-between text-start cursor-pointer group"
                    >
                      <div>
                        <span className={`text-[11px] font-semibold uppercase tracking-widest ${accentText} block`}>
                          Package {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-display text-2xl font-semibold text-brand-charcoal transition-colors flex items-center gap-2">
                          <span>{pkg.name}</span>
                          {isOpen
                            ? <ChevronUp className={`h-5 w-5 ${accentText} shrink-0`} />
                            : <ChevronDown className="h-5 w-5 text-brand-charcoal/40 shrink-0" />}
                        </h3>
                        {pkg.shortDescription && (
                          <p className="text-xs text-brand-ink mt-1 max-w-md">{pkg.shortDescription}</p>
                        )}
                      </div>
                      <div className="bg-brand-sand/80 border border-brand-clay px-4 py-2 rounded-2xl text-right shrink-0">
                        <span className="text-[10px] uppercase font-semibold text-brand-muted block">Pricing</span>
                        <span className={`text-xl font-black ${accentText}`}>
                          {pkg.price} SAR{' '}
                          <span className="text-xs font-normal text-brand-ink">
                            {pkg.pricingLabel || pkg.pricingType}
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Quick facts */}
                  <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-brand-ink">
                    {pkg.duration && (
                      <span className="bg-brand-cream/70 border border-brand-clay px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Clock className="h-3 w-3 text-brand-muted" />{pkg.duration}
                      </span>
                    )}
                    <span className="bg-brand-cream/70 border border-brand-clay px-2.5 py-1 rounded-lg">
                      {pkg.minGuests}–{pkg.maxGuests} guests
                    </span>
                    {pkg.ageInformation && (
                      <span className="bg-brand-cream/70 border border-brand-clay px-2.5 py-1 rounded-lg">{pkg.ageInformation}</span>
                    )}
                  </div>

                  {/* Action Row with Toggle & Book Now Button */}
                  <div className="pt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => togglePackage(pkg.id)}
                      className="text-xs font-semibold text-brand-muted hover:text-brand-charcoal cursor-pointer flex items-center gap-1"
                    >
                      <span>{isOpen ? 'Hide Package Details' : 'View Package Details'}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBirthdayPackage(pkg.id);
                        setCustomerTab('birthday-booking');
                      }}
                      className={`cursor-pointer ${accentHover} text-brand-cream text-xs font-semibold px-5 py-2.5 rounded-xl shadow-card-sm transition-all duration-200 active:scale-95 flex items-center gap-1.5`}
                    >
                      <span>Book Now</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Collapsible Dropdown Content — every value comes from the
                      shared package record edited in the Staff Console. */}
                  {isOpen && (
                    <div className="space-y-6 pt-6 mt-4 border-t border-brand-clay animate-in fade-in duration-300">
                      {pkg.fullDescription && (
                        <p className="text-sm text-brand-ink leading-relaxed">{pkg.fullDescription}</p>
                      )}

                      {/* Includes */}
                      {pkg.includedItems.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                            <CheckCircle2 className={`h-4 w-4 ${accentText}`} />
                            <span>Includes:</span>
                          </h4>
                          <ul className="space-y-2 text-sm text-brand-ink pl-1">
                            {pkg.includedItems.map(entry => (
                              <li key={entry} className="flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${accentBg}`}></span>
                                <span>{entry}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Your pick from one of the activities */}
                      {pkg.activityChoices.length > 0 && (
                        <div className="space-y-2.5 bg-brand-sand/30 p-4 rounded-2xl border border-brand-clay">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-ink flex items-center gap-1.5">
                            <Paintbrush className={`h-4 w-4 ${accentText}`} />
                            <span>Your choice of one activity:</span>
                          </h4>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-brand-ink pt-1">
                            {pkg.activityChoices.map(activity => (
                              <li key={activity} className="bg-brand-cream/80 p-2.5 rounded-xl border border-brand-clay/30 flex items-center gap-2">
                                <span className={`${accentText} font-semibold`}>•</span> {activity}
                              </li>
                            ))}
                          </ul>

                          {pkg.additionalInfo.length > 0 && (
                            <div className="text-[11px] text-brand-ink space-y-1 pt-1 border-t border-brand-clay/30">
                              {pkg.additionalInfo.map(note => (
                                <p key={note} className="flex items-center gap-1.5 font-semibold text-brand-ink">
                                  <span className={accentText}>•</span> {note}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Customized Birthday Cake */}
                      {(pkg.cakeDescription || pkg.cakeSizes.length > 0) && (
                        <div className="space-y-2 pt-2 border-t border-brand-clay">
                          <div className="flex items-start gap-2">
                            <Cake className={`h-5 w-5 ${accentText} shrink-0 mt-0.5`} />
                            <div>
                              <h4 className="text-sm font-semibold text-brand-charcoal">Customized Birthday Cake</h4>
                              {pkg.cakeDescription && (
                                <p className="text-xs text-brand-muted italic">({pkg.cakeDescription})</p>
                              )}
                            </div>
                          </div>

                          {pkg.cakeSizes.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-center pt-2">
                              {pkg.cakeSizes.map(size => (
                                <div key={size.id} className="bg-brand-sand/40 p-2.5 rounded-xl border border-brand-clay">
                                  <span className="text-[10px] font-semibold text-brand-muted block">{size.label}</span>
                                  <span className="text-sm font-semibold text-brand-charcoal">{size.price} SAR</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Trainer / delivery information */}
                      {(pkg.trainerInfo || pkg.deliveryInfo) && (
                        <div className="pt-2 space-y-1">
                          {pkg.trainerInfo && (
                            <p className={`text-xs font-semibold ${accentText} flex items-center gap-1.5`}>
                              <Sparkles className="h-4 w-4" />
                              <span>{pkg.trainerInfo}</span>
                            </p>
                          )}
                          {pkg.deliveryInfo && (
                            <p className="text-xs font-semibold text-brand-ink flex items-center gap-1.5">
                              <Compass className="h-4 w-4" />
                              <span>{pkg.deliveryInfo}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {(pkg.availableDays?.length > 0 || pkg.availableTimes?.length > 0) && (
                        <div className="space-y-2 pt-2 border-t border-brand-clay text-xs text-brand-ink">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                            <CalendarRange className={`h-4 w-4 ${accentText}`} />
                            <span>Available:</span>
                          </h4>
                          {pkg.availableDays?.length > 0 && <p className="font-semibold">{pkg.availableDays.join(', ')}</p>}
                          {pkg.availableTimes?.length > 0 && <p className="font-semibold">{pkg.availableTimes.join(' · ')}</p>}
                        </div>
                      )}

                      {pkg.customerNotes && (
                        <p className="text-xs text-brand-ink leading-relaxed pt-2 border-t border-brand-clay">
                          {pkg.customerNotes}
                        </p>
                      )}

                      {pkg.terms && (
                        <div className="pt-2 border-t border-brand-clay">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-muted mb-1">Terms:</h4>
                          <p className="text-xs text-brand-ink leading-relaxed">{pkg.terms}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ITEM 3: CREATE YOUR OWN EVENT BUTTON & CONTACT REVEAL */}
        <div className="pt-4 text-center space-y-4">
          <button
            onClick={() => setShowOwnerContact(prev => !prev)}
            className="cursor-pointer inline-flex items-center justify-center gap-2.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-base font-semibold px-8 py-4 rounded-2xl shadow-card-sm transition-all duration-200 active:scale-95 border border-brand-clay"
          >
            <Sparkles className="h-5 w-5 text-brand-terracotta" />
            <span>Create your own Event</span>
            {showOwnerContact ? <ChevronUp className="h-5 w-5 text-brand-clay" /> : <ChevronDown className="h-5 w-5 text-brand-clay" />}
          </button>

          {showOwnerContact && (
            <div className="bg-brand-sand/40 border-2 border-brand-terracotta/40 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto text-start shadow-card-sm animate-in fade-in duration-300 space-y-6">
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
                <div className="bg-brand-cream p-4 rounded-2xl border border-brand-clay flex items-start gap-3">
                  <Phone className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-brand-muted uppercase block">Direct Phone & WhatsApp</span>
                    <a href="tel:+966501234567" className="font-semibold text-brand-charcoal hover:text-brand-terracotta font-mono">
                      +966 50 123 4567
                    </a>
                  </div>
                </div>

                <div className="bg-brand-cream p-4 rounded-2xl border border-brand-clay flex items-start gap-3">
                  <Mail className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-brand-muted uppercase block">Owner Email</span>
                    <a href="mailto:events@artycafe.sa" className="font-semibold text-brand-charcoal hover:text-brand-terracotta">
                      events@artycafe.sa
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-brand-cream p-4 rounded-2xl border border-brand-clay text-xs text-brand-ink space-y-1">
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

      </section>

      {/* LOCATION & CONTACT BLOCK */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-brand-clay bg-brand-cream p-8 md:p-12 shadow-card-sm text-start">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Info */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="font-display text-3xl md:text-[38px] font-semibold text-brand-charcoal">Slow down &amp; visit us</h2>
              <p className="text-brand-ink leading-[1.7]">
                We are situated in the quiet tree-lined Al-Rawdah street. Grab a quiet corner, sculpt some clay, and meet friendly creative people.
              </p>
              
              {/* Labelled rows separated by hairlines — no icons, so the
                  eye runs straight down the labels. */}
              <dl className="pt-2 text-sm">
                <div className="border-t border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Address</dt>
                  <dd className="mt-1.5 text-brand-charcoal">
                    Al-Rawdah Street, Opposite Al-Rawdah Park, Jeddah, Saudi Arabia
                  </dd>
                </div>

                <div className="border-t border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Opening Hours</dt>
                  <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                    Sat – Thu: 09:00 AM – 11:00 PM · Fri: 02:00 PM – 11:00 PM
                  </dd>
                </div>

                <div className="border-t border-b border-brand-clay py-4">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">Call Front Desk</dt>
                  <dd className="mt-1.5 text-brand-charcoal ltr-numerals">
                    +966 12 654 3210 (Walk-ins welcome!)
                  </dd>
                </div>
              </dl>
            </div>

            {/* Map Placeholder */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden border border-brand-clay h-72 md:h-96 shadow-inner bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
                {/* Visual Map Details */}
                <div className="absolute inset-0 opacity-15">
                  {/* Grid overlay resembling streets */}
                  <div className="w-full h-full bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:30px_30px]"></div>
                  <div className="absolute top-1/3 left-1/4 w-32 h-6 bg-brand-terracotta rounded-full -rotate-12"></div>
                  <div className="absolute top-1/2 left-1/2 w-48 h-8 bg-brand-sage rounded-full rotate-45"></div>
                  <div className="absolute bottom-1/4 right-1/3 w-32 h-6 bg-brand-blue rounded-full -rotate-6"></div>
                </div>
                
                {/* Active marker */}
                <div className="relative z-10 space-y-4 max-w-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-terracotta/25 text-brand-terracotta pulse-accent shadow-card-sm">
                    <MapPin className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-brand-charcoal text-lg">Arty Café Jeddah</p>
                    <p className="text-xs text-brand-muted mt-1">21.5744° N, 39.1622° E</p>
                    <p className="text-sm text-brand-ink mt-2">We are right across the street from Al-Rawdah Park main entrance. Ample free parking available.</p>
                  </div>
                  <a 
                    href="https://maps.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-clay px-4 py-2 rounded-xl hover:bg-brand-sand transition-colors cursor-pointer"
                  >
                    <span>Open in Google Maps</span>
                    <ChevronRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
