/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import Reveal from './ui/Reveal';
import { ScrollReveal } from './ui/ScrollReveal';
import {
  Search, SlidersHorizontal, RefreshCw, Eye, EyeOff,
  ChevronDown, ChevronUp, ChevronRight, CheckCircle2, Paintbrush, Cake, Compass,
  CalendarRange, Sparkles, Clock
} from 'lucide-react';
import { Workshop } from '../types';

/** Pseudo-category: not a real DB category, it swaps the whole grid to birthday packages. */
const BIRTHDAY_CATEGORY = 'Birthday Packages';

export const WorkshopsBrowsingSection: React.FC = () => {
  const {
    workshops, setCustomerTab, setSelectedWorkshopId, categories: dbCategories,
    publishedBirthdayPackages, selectedBirthdayPackage, setSelectedBirthdayPackage,
    workshopsInitialCategory
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(workshopsInitialCategory || 'All');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'Popularity' | 'PriceLow' | 'PriceHigh'>('Popularity');

  // Which birthday package cards are expanded, keyed by package id. Arriving
  // here from a specific package card on the home page opens that one already.
  const [openPackages, setOpenPackages] = useState<Record<string, boolean>>(() =>
    workshopsInitialCategory === BIRTHDAY_CATEGORY && selectedBirthdayPackage
      ? { [selectedBirthdayPackage]: true }
      : {}
  );
  const togglePackage = (id: string) =>
    setOpenPackages(prev => ({ ...prev, [id]: !prev[id] }));

  const isBirthdayView = selectedCategory === BIRTHDAY_CATEGORY;

  // Categories come from the shared data layer, plus the birthday pseudo-category.
  const categories = useMemo(() => {
    const excluded = ['Kids', 'Couples', 'Group'];
    const list = ['All'];
    (dbCategories || []).forEach(c => {
      if (!list.includes(c.name) && !excluded.includes(c.name)) {
        list.push(c.name);
      }
    });
    // Fallback if db is still loading or empty
    const base = list.length === 1 ? ['All', 'Pottery', 'Painting'] : list.filter(c => !excluded.includes(c));
    return [...base, BIRTHDAY_CATEGORY];
  }, [dbCategories]);

  // Filter & Sort math
  const filteredWorkshops = useMemo(() => {
    if (isBirthdayView) return [];

    let result = [...workshops];

    // Filter out Drafts for customer view!
    result = result.filter(ws => (ws.status || 'Published') !== 'Draft');

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(ws => 
        ws.title.toLowerCase().includes(q) || 
        ws.hook.toLowerCase().includes(q) || 
        ws.instructor.toLowerCase().includes(q)
      );
    }

    // Category chip
    if (selectedCategory !== 'All') {
      result = result.filter(ws => ws.category === selectedCategory);
    }

    // Skill level filter
    if (selectedSkillLevel !== 'All') {
      result = result.filter(ws => ws.skillLevel === selectedSkillLevel);
    }

    // Sort order
    if (sortBy === 'PriceLow') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'PriceHigh') {
      result.sort((a, b) => b.price - a.price);
    } else {
      // Popularity (fewer spots left = more popular)
      result.sort((a, b) => a.spotsLeft - b.spotsLeft);
    }

    return result;
  }, [workshops, searchQuery, selectedCategory, selectedSkillLevel, sortBy, isBirthdayView]);

  // Birthday packages have their own shape (name/shortDescription/guests, not
  // title/hook/skillLevel) so they get their own filter instead of folding
  // into filteredWorkshops.
  const filteredBirthdayPackages = useMemo(() => {
    if (!isBirthdayView) return [];

    let result = [...publishedBirthdayPackages];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(pkg =>
        pkg.name.toLowerCase().includes(q) ||
        (pkg.shortDescription || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [publishedBirthdayPackages, searchQuery, isBirthdayView]);

  const visibleCount = isBirthdayView ? filteredBirthdayPackages.length : filteredWorkshops.length;

  const handleCardClick = (ws: Workshop) => {
    setSelectedWorkshopId(ws.id);
    setCustomerTab('detail');
  };

  const handleBookPackage = (pkgId: string) => {
    setSelectedBirthdayPackage(pkgId);
    setCustomerTab('birthday-booking');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedSkillLevel('All');
    setSortBy('Popularity');
  };

  return (
    <div className="animate-in fade-in duration-300 text-start">

      {/* Catalogue intro + filters — an ivory band sitting directly on the
          page, no page-level card wrapper. */}
      <div className="bg-brand-cream border-b border-brand-clay">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">

      {/* Header Title */}
      <div className="pb-8">
        <Reveal index={0}>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
            {isBirthdayView ? 'Private Parties' : 'Catalogue'}
          </span>
        </Reveal>
        <Reveal index={1}>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-brand-charcoal max-w-lg">
            {isBirthdayView ? 'Birthday Packages' : 'Creative Workshops'}
          </h1>
        </Reveal>
        <Reveal index={2}>
          <p className="text-brand-ink mt-4 max-w-xl text-base leading-[1.7]">
            {isBirthdayView
              ? "Browse our birthday party packages, see everything that's included, and pick the one that fits before you book."
              : 'Discover Jeddah’s premier pottery and painting workshops. Center clay on the wheel, explore watercolor glazes, or paint canvases under guidance of Saudi artists.'}
          </p>
        </Reveal>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder={isBirthdayView ? 'Search packages...' : 'Search by workshop, theme, or tutor...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-brand-clay rounded-full py-3.5 ps-11 pe-4 text-sm font-medium text-brand-charcoal placeholder-brand-muted focus:ring-1 focus:ring-brand-sage"
            />
          </div>

          {/* Sort Dropdown — skill level and popularity/price sorting don't
              apply to birthday packages, so hide them for that category. */}
          {!isBirthdayView && (
            <div className="flex flex-wrap items-center gap-3">
              {/* appearance-none drops the browser's own native arrow (which
                  reserves its own wide gutter regardless of padding) in favor
                  of a chevron placed right against the text. */}
              <div className="relative">
                <select
                  value={selectedSkillLevel}
                  onChange={(e) => setSelectedSkillLevel(e.target.value)}
                  aria-label="Skill Level"
                  className="appearance-none bg-white border border-brand-clay rounded-full py-3 ps-4 pe-9 text-sm font-medium text-brand-charcoal cursor-pointer focus:ring-1 focus:ring-brand-sage"
                >
                  <option value="All">All Levels</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="All Levels">All Levels (Strict)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort by"
                  className="appearance-none bg-white border border-brand-clay rounded-full py-3 ps-4 pe-9 text-sm font-medium text-brand-charcoal cursor-pointer focus:ring-1 focus:ring-brand-sage"
                >
                  <option value="Popularity">Popularity (Filling Fast)</option>
                  <option value="PriceLow">Price: Low to High</option>
                  <option value="PriceHigh">Price: High to Low</option>
                </select>
                <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-muted" />
              </div>
            </div>
          )}

        </div>

        {/* Scrollable Category Chips on Mobile */}
        <div className="flex items-center justify-between gap-4 border-t border-brand-clay pt-5">
        <div className="min-w-0 overflow-x-auto no-scrollbar py-1 flex gap-2">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors duration-150 border cursor-pointer active:scale-[0.97] ${
                  isActive
                    ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream font-semibold'
                    : 'bg-white border-brand-clay text-brand-ink hover:text-brand-charcoal hover:border-brand-muted'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <span className="hidden sm:block shrink-0 text-[13px] text-brand-muted ltr-numerals">
          {visibleCount} {isBirthdayView ? 'packages' : 'workshops'}
        </span>
        </div>
      </div>

      </div>
      </div>

      {/* Grid — full-bleed white band, matching the rest of the site instead
          of a page-level card. */}
      <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14 pb-20">

      {/* DYNAMIC VIEWS GRID */}
      <div>

        {/* EMPTY STATE */}
        {visibleCount === 0 && (
          <div className="bg-brand-sand/20 border border-brand-clay rounded-2xl py-16 px-4 text-center max-w-lg mx-auto mt-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mb-4">
              <SlidersHorizontal className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold text-brand-charcoal">
              {isBirthdayView ? 'No packages match your search' : 'No workshops match your filters'}
            </h3>
            <p className="text-sm text-brand-ink mt-2 max-w-sm mx-auto leading-relaxed">
              {isBirthdayView
                ? 'We couldn’t find a birthday package matching your search query. Try clearing it.'
                : 'We couldn’t find any clay or painting classes matching your search query or selected category chip. Try clearing the query.'}
            </p>
            <button
              onClick={resetFilters}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-5 py-3 text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover shadow-card-sm cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}

        {/* LIVE GRID — BIRTHDAY PACKAGES */}
        {isBirthdayView && filteredBirthdayPackages.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {filteredBirthdayPackages.map((pkg, index) => {
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
                      className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start cursor-pointer group"
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
                      onClick={() => handleBookPackage(pkg.id)}
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

        {/* LIVE GRID — WORKSHOPS */}
        {!isBirthdayView && filteredWorkshops.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:gap-8 md:grid-cols-3">
            {filteredWorkshops.map((ws, cardIndex) => {
              const isFull = ws.spotsLeft === 0;
              return (
                <ScrollReveal
                  key={ws.id}
                  once
                  viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
                  transition={{ delay: cardIndex * 0.12, duration: 0.5, ease: 'easeOut' }}
                  variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
                  className="h-full"
                >
                <div
                  onClick={() => handleCardClick(ws)}
                  /* Phone: a compact horizontal row — thumbnail left, details
                     right. From sm up it is the original vertical card. */
                  className={`group relative bg-white rounded-[22px] sm:rounded-[32px] shadow-card shadow-brand-charcoal/5 border border-brand-terracotta/5 transition-all duration-300 flex flex-row sm:flex-col h-full text-start overflow-hidden ${
                    isFull
                      ? 'opacity-70 saturate-75 cursor-not-allowed'
                      : 'cursor-pointer hover:shadow-2xl hover:shadow-brand-terracotta/10 hover:-translate-y-1'
                  }`}
                >
                  {/* Card Image banner — flush with the card's top and side edges.
                      A fixed height (not aspect-video) so every image locks to
                      the same box regardless of its own source dimensions —
                      aspect-ratio on a flex item with a replaced (object-cover)
                      child is unreliable and was letting square photos render
                      taller than widescreen ones. */}
                  <div className="relative m-3 h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-brand-sand sm:m-0 sm:h-52 sm:w-auto sm:rounded-none">
                    <img
                      src={ws.image}
                      alt={ws.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />

                    {/* Muted or highlight Spots Pill */}
                    <div className="absolute top-3 left-3 hidden sm:block">
                      {isFull ? (
                        <span className="inline-flex items-center rounded-lg bg-brand-charcoal/85 text-brand-cream px-2.5 py-1 text-xs font-semibold tracking-wide shadow-card-sm">
                          FULLY BOOKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-brand-terracotta text-brand-cream px-2.5 py-1 text-xs font-semibold tracking-wide shadow-card-sm">
                          {ws.spotsLeft} SPOTS LEFT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Core details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-3 pe-3 sm:p-6">
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
                        {ws.category}{ws.skillLevel ? ` · ${ws.skillLevel}` : ''}
                      </span>
                      <h3 className="mt-1 font-display text-base sm:text-xl font-semibold text-brand-charcoal group-hover:text-brand-terracotta transition-colors line-clamp-2 sm:line-clamp-none sm:mt-1.5">
                        {ws.title}
                      </h3>
                      {/* The hook is the one thing the compact row drops — it is
                          the longest line and the least scannable. */}
                      <p className="hidden sm:block text-sm text-brand-ink mt-1.5 line-clamp-2">
                        {ws.hook}
                      </p>
                    </div>

                    {/* Phone: spots left and price on one line. */}
                    <div className="mt-2 flex items-end justify-between gap-3 sm:hidden">
                      <span className={`text-[11px] font-semibold ${isFull ? 'text-brand-muted' : 'text-brand-terracotta'}`}>
                        {isFull ? 'Fully booked' : `${ws.spotsLeft} spots left`}
                      </span>
                      <span className="font-display text-base font-semibold text-brand-charcoal ltr-numerals">
                        {ws.price} <span className="text-[10px] font-medium text-brand-muted">SAR</span>
                      </span>
                    </div>

                    {/* Meta and Price row */}
                    <div className="mt-6 pt-4 border-t border-brand-clay hidden sm:flex items-end justify-between gap-3">
                      <div className="text-[13px] text-brand-ink space-y-0.5 min-w-0">
                        <p className="truncate">{ws.duration} · {ws.ageRange}</p>
                        {ws.instructor && <p className="truncate text-brand-muted">Instructor {ws.instructor}</p>}
                      </div>
                      <div className="text-end shrink-0">
                        <span className="font-display text-[22px] font-semibold text-brand-charcoal ltr-numerals">
                          {ws.price} <span className="text-xs font-medium text-brand-muted">SAR</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual full indicator banner overlay */}
                  {isFull && (
                    <div className="absolute inset-0 bg-brand-cream/10 flex items-center justify-center pointer-events-none">
                      <div className="bg-brand-charcoal text-brand-cream px-4 py-2 rounded-xl text-xs font-semibold tracking-widest uppercase shadow-card-sm rotate-12">
                        Class Full
                      </div>
                    </div>
                  )}
                </div>
                </ScrollReveal>
              );
            })}
          </div>
        )}

      </div>
    </div>
    </div>
    </div>
  );
};
