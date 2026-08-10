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
            <div className="lg:col-span-5 space-y-6 text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-terracotta/10 px-3.5 py-1.5 text-xs font-semibold text-brand-terracotta">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Creative Sanctuary in Jeddah</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold text-brand-charcoal tracking-tight leading-tight">
                Melt into the art of <span className="text-brand-terracotta italic font-medium">clay & canvas</span>.
              </h1>
              <p className="text-lg text-brand-charcoal/80 max-w-lg leading-relaxed">
                Slow down, pour a fresh cup of espresso, and handcraft ceramic pottery or vibrant acrylic art in Jeddah’s favorite creative retreat.
              </p>
              <div className="pt-2 flex flex-wrap gap-4">
                <button
                  onClick={() => setCustomerTab('workshops')}
                  className="cursor-pointer rounded-2xl bg-brand-terracotta px-7 py-4 text-base font-semibold text-brand-cream shadow-md hover:bg-brand-terracotta-hover hover:shadow-lg transition-all duration-200 active:scale-95"
                >
                  Browse Workshops
                </button>
                <button
                  onClick={() => {
                    setSelectedWorkshopId('ws-1');
                    setCustomerTab('detail');
                  }}
                  className="cursor-pointer rounded-2xl bg-brand-sand px-7 py-4 text-base font-semibold text-brand-charcoal hover:bg-brand-clay/50 transition-all duration-200"
                >
                  View Top Experience
                </button>
              </div>
            </div>

            {/* Right Photo Column */}
            <div className="lg:col-span-7">
              <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-video md:aspect-[4/3] max-h-[480px]">
                <img
                  src="https://images.unsplash.com/photo-1565192647048-f997ded87958?auto=format&fit=crop&w=1200&q=80"
                  alt="Clay modeling on potter wheel at Arty Cafe"
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal/40 to-transparent"></div>
                
                {/* Floating pill over hero image */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between bg-brand-cream/95 backdrop-blur-sm p-4 rounded-2xl border border-brand-clay shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 rounded-full bg-green-500 animate-ping"></span>
                    <span className="flex h-3 w-3 absolute rounded-full bg-green-500"></span>
                    <p className="text-sm font-semibold text-brand-charcoal ml-3">Clay Studio Spinning Right Now</p>
                  </div>
                  <button 
                    onClick={() => setCustomerTab('workshops')}
                    className="text-xs font-bold text-brand-terracotta flex items-center hover:underline"
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
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 text-left">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-charcoal">Featured Workshops</h2>
            <p className="text-brand-charcoal/70 mt-2 max-w-xl">
              Led by professional artisan tutors. Spaces are kept tight for custom, hands-on feedback.
            </p>
          </div>
          <button 
            onClick={() => setCustomerTab('workshops')}
            className="group flex items-center gap-1.5 font-bold text-brand-terracotta hover:text-brand-terracotta-hover transition-colors mt-4 md:mt-0 cursor-pointer"
          >
            <span>View All ({workshops.length})</span>
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredWorkshops.map((ws) => (
            <div 
              key={ws.id}
              onClick={() => handleCardClick(ws.id)}
              className="group cursor-pointer rounded-2xl border border-brand-clay/80 bg-brand-cream p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 text-left flex flex-col h-full"
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
                <div className="absolute top-3 left-3">
                  {ws.spotsLeft === 0 ? (
                    <span className="inline-flex items-center rounded-lg bg-gray-500/90 text-brand-cream px-2.5 py-1 text-xs font-bold tracking-wide">
                      FULLY BOOKED
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-lg bg-brand-terracotta text-brand-cream px-2.5 py-1 text-xs font-bold tracking-wide shadow-sm">
                      {ws.spotsLeft} SPOTS LEFT
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 right-3 bg-brand-cream/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-charcoal">
                  {ws.category}
                </div>
              </div>

              {/* Info details */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-charcoal group-hover:text-brand-terracotta transition-colors line-clamp-1">
                    {ws.title}
                  </h3>
                  <p className="text-sm text-brand-charcoal/70 line-clamp-2 mt-1.5">
                    {ws.hook}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-brand-clay/50 flex items-center justify-between">
                  <div className="text-xs text-brand-charcoal/65 space-y-0.5">
                    <p>🕒 {ws.duration}</p>
                    <p>👥 {ws.ageRange}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] block font-semibold text-brand-sage uppercase tracking-wider">Price</span>
                    <span className="text-lg font-bold text-brand-charcoal">{ws.price} SAR</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW BOOKING WORKS */}
      <section className="bg-brand-sand/40 border-y border-brand-clay/60 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-xl mx-auto mb-12">
            <h2 className="font-display text-3xl font-bold text-brand-charcoal">How Booking Works</h2>
            <p className="text-brand-charcoal/70 mt-2">
              Three simple, effortless steps from clay mud to beautiful glazed pottery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="bg-brand-cream rounded-2xl p-6 border border-brand-clay/50 shadow-xs relative text-center">
                  <div className="absolute top-4 right-4 text-3xl font-display font-extrabold text-brand-terracotta/15">
                    {step.num}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-terracotta/10 text-brand-terracotta mx-auto mb-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-brand-charcoal mb-2">{step.title}</h3>
                  <p className="text-sm text-brand-charcoal/70 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CELEBRATE YOUR BIRTHDAY WITH US */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-left space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-terracotta/10 text-brand-terracotta text-xs font-bold uppercase tracking-wider">
            <Gift className="h-4 w-4" />
            <span>Birthday Celebrations & Private Parties</span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-brand-charcoal">
            Celebrate your birthday with us
          </h2>
          <p className="text-brand-charcoal/70 max-w-2xl text-base">
            Make your child's special day unforgettable with creative art sessions, balloons, customized cakes, and fun hands-on memories in our studio.
          </p>
        </div>

        {/* Options Grid — rendered from the shared birthday package records.
            Everything shown here is edited in Staff Console → Birthday Event. */}
        {publishedBirthdayPackages.length === 0 ? (
          <p className="text-sm text-brand-charcoal/60 italic">
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
                  className="bg-brand-cream border-2 border-brand-clay/80 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col text-left relative overflow-hidden transition-all duration-300"
                >
                  <div className={`absolute -top-12 -right-12 w-32 h-32 ${accentBg}/5 rounded-full blur-2xl pointer-events-none`}></div>

                  {/* Package image */}
                  {pkg.image && (
                    <div className="h-40 w-full rounded-2xl overflow-hidden border border-brand-clay/50 mb-4">
                      <img src={pkg.image} alt={pkg.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}

                  {/* Header / Clickable Accordion Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-clay/60">
                    <button
                      type="button"
                      onClick={() => togglePackage(pkg.id)}
                      className="flex-1 flex items-center justify-between text-left cursor-pointer group"
                    >
                      <div>
                        <span className={`text-[11px] font-extrabold uppercase tracking-widest ${accentText} block`}>
                          Package {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-display text-2xl font-bold text-brand-charcoal transition-colors flex items-center gap-2">
                          <span>{pkg.name}</span>
                          {isOpen
                            ? <ChevronUp className={`h-5 w-5 ${accentText} shrink-0`} />
                            : <ChevronDown className="h-5 w-5 text-brand-charcoal/40 shrink-0" />}
                        </h3>
                        {pkg.shortDescription && (
                          <p className="text-xs text-brand-charcoal/70 mt-1 max-w-md">{pkg.shortDescription}</p>
                        )}
                      </div>
                      <div className="bg-brand-sand/80 border border-brand-clay px-4 py-2 rounded-2xl text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-brand-charcoal/50 block">Pricing</span>
                        <span className={`text-xl font-black ${accentText}`}>
                          {pkg.price} SAR{' '}
                          <span className="text-xs font-normal text-brand-charcoal/70">
                            {pkg.pricingLabel || pkg.pricingType}
                          </span>
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Quick facts */}
                  <div className="pt-3 flex flex-wrap gap-2 text-[11px] font-bold text-brand-charcoal/70">
                    {pkg.duration && (
                      <span className="bg-white/70 border border-brand-clay/40 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Clock className="h-3 w-3 text-brand-charcoal/50" />{pkg.duration}
                      </span>
                    )}
                    <span className="bg-white/70 border border-brand-clay/40 px-2.5 py-1 rounded-lg">
                      {pkg.minGuests}–{pkg.maxGuests} guests
                    </span>
                    {pkg.ageInformation && (
                      <span className="bg-white/70 border border-brand-clay/40 px-2.5 py-1 rounded-lg">{pkg.ageInformation}</span>
                    )}
                  </div>

                  {/* Action Row with Toggle & Book Now Button */}
                  <div className="pt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => togglePackage(pkg.id)}
                      className="text-xs font-bold text-brand-charcoal/60 hover:text-brand-charcoal cursor-pointer flex items-center gap-1"
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
                      className={`cursor-pointer ${accentHover} text-brand-cream text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition-all duration-200 active:scale-95 flex items-center gap-1.5`}
                    >
                      <span>Book Now</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Collapsible Dropdown Content — every value comes from the
                      shared package record edited in the Staff Console. */}
                  {isOpen && (
                    <div className="space-y-6 pt-6 mt-4 border-t border-brand-clay/40 animate-in fade-in duration-300">
                      {pkg.fullDescription && (
                        <p className="text-sm text-brand-charcoal/85 leading-relaxed">{pkg.fullDescription}</p>
                      )}

                      {/* Includes */}
                      {pkg.includedItems.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal/50 flex items-center gap-1.5">
                            <CheckCircle2 className={`h-4 w-4 ${accentText}`} />
                            <span>Includes:</span>
                          </h4>
                          <ul className="space-y-2 text-sm text-brand-charcoal/85 pl-1">
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
                        <div className="space-y-2.5 bg-brand-sand/30 p-4 rounded-2xl border border-brand-clay/40">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal/70 flex items-center gap-1.5">
                            <Paintbrush className={`h-4 w-4 ${accentText}`} />
                            <span>Your choice of one activity:</span>
                          </h4>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-brand-charcoal/80 pt-1">
                            {pkg.activityChoices.map(activity => (
                              <li key={activity} className="bg-white/80 p-2.5 rounded-xl border border-brand-clay/30 flex items-center gap-2">
                                <span className={`${accentText} font-bold`}>•</span> {activity}
                              </li>
                            ))}
                          </ul>

                          {pkg.additionalInfo.length > 0 && (
                            <div className="text-[11px] text-brand-charcoal/70 space-y-1 pt-1 border-t border-brand-clay/30">
                              {pkg.additionalInfo.map(note => (
                                <p key={note} className="flex items-center gap-1.5 font-semibold text-brand-charcoal/80">
                                  <span className={accentText}>•</span> {note}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Customized Birthday Cake */}
                      {(pkg.cakeDescription || pkg.cakeSizes.length > 0) && (
                        <div className="space-y-2 pt-2 border-t border-brand-clay/40">
                          <div className="flex items-start gap-2">
                            <Cake className={`h-5 w-5 ${accentText} shrink-0 mt-0.5`} />
                            <div>
                              <h4 className="text-sm font-bold text-brand-charcoal">Customized Birthday Cake</h4>
                              {pkg.cakeDescription && (
                                <p className="text-xs text-brand-charcoal/60 italic">({pkg.cakeDescription})</p>
                              )}
                            </div>
                          </div>

                          {pkg.cakeSizes.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-center pt-2">
                              {pkg.cakeSizes.map(size => (
                                <div key={size.id} className="bg-brand-sand/40 p-2.5 rounded-xl border border-brand-clay/40">
                                  <span className="text-[10px] font-bold text-brand-charcoal/60 block">{size.label}</span>
                                  <span className="text-sm font-extrabold text-brand-charcoal">{size.price} SAR</span>
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
                            <p className="text-xs font-semibold text-brand-charcoal/70 flex items-center gap-1.5">
                              <Compass className="h-4 w-4" />
                              <span>{pkg.deliveryInfo}</span>
                            </p>
                          )}
                        </div>
                      )}

                      {(pkg.availableDays?.length > 0 || pkg.availableTimes?.length > 0) && (
                        <div className="space-y-2 pt-2 border-t border-brand-clay/40 text-xs text-brand-charcoal/80">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal/50 flex items-center gap-1.5">
                            <CalendarRange className={`h-4 w-4 ${accentText}`} />
                            <span>Available:</span>
                          </h4>
                          {pkg.availableDays?.length > 0 && <p className="font-semibold">{pkg.availableDays.join(', ')}</p>}
                          {pkg.availableTimes?.length > 0 && <p className="font-semibold">{pkg.availableTimes.join(' · ')}</p>}
                        </div>
                      )}

                      {pkg.customerNotes && (
                        <p className="text-xs text-brand-charcoal/80 leading-relaxed pt-2 border-t border-brand-clay/40">
                          {pkg.customerNotes}
                        </p>
                      )}

                      {pkg.terms && (
                        <div className="pt-2 border-t border-brand-clay/40">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-charcoal/50 mb-1">Terms:</h4>
                          <p className="text-xs text-brand-charcoal/70 leading-relaxed">{pkg.terms}</p>
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
            className="cursor-pointer inline-flex items-center justify-center gap-2.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-base font-bold px-8 py-4 rounded-2xl shadow-md transition-all duration-200 active:scale-95 border border-brand-clay/40"
          >
            <Sparkles className="h-5 w-5 text-brand-terracotta" />
            <span>Create your own Event</span>
            {showOwnerContact ? <ChevronUp className="h-5 w-5 text-brand-clay" /> : <ChevronDown className="h-5 w-5 text-brand-clay" />}
          </button>

          {showOwnerContact && (
            <div className="bg-brand-sand/40 border-2 border-brand-terracotta/40 rounded-3xl p-6 md:p-8 max-w-2xl mx-auto text-left shadow-md animate-in fade-in duration-300 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-brand-clay/60">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-terracotta text-brand-cream shrink-0">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-charcoal">Owner & Event Host Contact</h3>
                  <p className="text-xs text-brand-charcoal/70">Connect directly with our owner to craft custom events, corporate gatherings, or private parties.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-4 rounded-2xl border border-brand-clay/50 flex items-start gap-3">
                  <Phone className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Direct Phone & WhatsApp</span>
                    <a href="tel:+966501234567" className="font-bold text-brand-charcoal hover:text-brand-terracotta font-mono">
                      +966 50 123 4567
                    </a>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-brand-clay/50 flex items-start gap-3">
                  <Mail className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-brand-charcoal/50 uppercase block">Owner Email</span>
                    <a href="mailto:events@artycafe.sa" className="font-bold text-brand-charcoal hover:text-brand-terracotta">
                      events@artycafe.sa
                    </a>
                  </div>
                </div>
              </div>

              <div className="bg-brand-cream p-4 rounded-2xl border border-brand-clay/40 text-xs text-brand-charcoal/80 space-y-1">
                <p className="font-bold text-brand-charcoal flex items-center gap-1.5">
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
        <div className="rounded-3xl border border-brand-clay bg-brand-sand/50 p-8 md:p-12 shadow-sm text-left">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Info */}
            <div className="lg:col-span-5 space-y-6">
              <h2 className="font-display text-3xl font-bold text-brand-charcoal">Slow down & visit us</h2>
              <p className="text-brand-charcoal/85">
                We are situated in the quiet tree-lined Al-Rawdah street. Grab a quiet corner, sculpt some clay, and meet friendly creative people.
              </p>
              
              <div className="space-y-4 pt-2 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-brand-charcoal">Address</p>
                    <p className="text-brand-charcoal/75">Al-Rawdah Street, Opposite Al-Rawdah Park, Jeddah, Saudi Arabia</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-brand-charcoal">Opening Hours</p>
                    <p className="text-brand-charcoal/75">Sat – Thu: 09:00 AM – 11:00 PM</p>
                    <p className="text-brand-charcoal/75">Fri: 02:00 PM – 11:00 PM</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Compass className="h-5 w-5 text-brand-terracotta shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-brand-charcoal">Call Front Desk</p>
                    <p className="text-brand-charcoal/75">+966 12 654 3210 (Walk-ins welcome!)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl overflow-hidden border border-brand-clay/80 h-72 md:h-96 shadow-inner bg-brand-cream flex flex-col items-center justify-center p-6 text-center">
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
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-terracotta/25 text-brand-terracotta pulse-accent shadow-sm">
                    <MapPin className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="font-bold text-brand-charcoal text-lg">Arty Café Jeddah</p>
                    <p className="text-xs text-brand-charcoal/60 mt-1">21.5744° N, 39.1622° E</p>
                    <p className="text-sm text-brand-charcoal/75 mt-2">We are right across the street from Al-Rawdah Park main entrance. Ample free parking available.</p>
                  </div>
                  <a 
                    href="https://maps.google.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-terracotta bg-brand-cream border border-brand-clay px-4 py-2 rounded-xl hover:bg-brand-sand transition-colors cursor-pointer"
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
