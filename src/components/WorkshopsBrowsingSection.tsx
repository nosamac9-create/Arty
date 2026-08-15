/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, SlidersHorizontal, RefreshCw, Layers, Calendar, User, Eye, EyeOff } from 'lucide-react';
import { Workshop } from '../types';

export const WorkshopsBrowsingSection: React.FC = () => {
  const { workshops, setCustomerTab, setSelectedWorkshopId, categories: dbCategories } = useApp();
  
  // Interactive Simulators for testing the skeleton and empty states requested in prompt
  const [simulatorMode, setSimulatorMode] = useState<'live' | 'loading' | 'empty'>('live');
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'Popularity' | 'PriceLow' | 'PriceHigh'>('Popularity');

  // Categories come from the shared data layer.
  const categories = useMemo(() => {
    const excluded = ['Kids', 'Couples', 'Group'];
    const list = ['All'];
    (dbCategories || []).forEach(c => {
      if (!list.includes(c.name) && !excluded.includes(c.name)) {
        list.push(c.name);
      }
    });
    // Fallback if db is still loading or empty
    if (list.length === 1) {
      return ['All', 'Pottery', 'Painting'];
    }
    return list.filter(c => !excluded.includes(c));
  }, [dbCategories]);

  // Filter & Sort math
  const filteredWorkshops = useMemo(() => {
    if (simulatorMode === 'empty') return [];
    
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
  }, [workshops, searchQuery, selectedCategory, selectedSkillLevel, sortBy, simulatorMode]);

  const handleCardClick = (ws: Workshop) => {
    setSelectedWorkshopId(ws.id);
    setCustomerTab('detail');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedSkillLevel('All');
    setSortBy('Popularity');
    setSimulatorMode('live');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20 animate-in fade-in duration-300 text-start">
      
      {/* Header Title */}
      <div className="pt-10 pb-8">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Catalogue</span>
        <h1 className="mt-3 font-display text-4xl sm:text-5xl font-semibold text-brand-charcoal max-w-lg">Creative Workshops</h1>
        <p className="text-brand-ink mt-4 max-w-xl text-base leading-[1.7]">
          Discover Jeddah’s premier pottery and painting workshops. Center clay on the wheel, explore watercolor glazes, or paint canvases under guidance of Saudi artists.
        </p>

        {/* State Simulator Switcher - requested in the prompt */}
        <div className="mt-6 flex flex-wrap items-center gap-3 bg-brand-sand/40 p-3 rounded-[22px] border border-brand-clay max-w-2xl">
          <span className="text-xs font-semibold text-brand-sage uppercase tracking-wider block mr-2">
            View Variants:
          </span>
          <div className="inline-flex rounded-xl bg-brand-cream border border-brand-clay p-0.5 shadow-card-sm">
            <button
              onClick={() => setSimulatorMode('live')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                simulatorMode === 'live' 
                  ? 'bg-brand-terracotta text-brand-cream' 
                  : 'text-brand-ink hover:text-brand-terracotta'
              }`}
            >
              🟢 Live Grid ({filteredWorkshops.length})
            </button>
            <button
              onClick={() => setSimulatorMode('loading')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                simulatorMode === 'loading' 
                  ? 'bg-brand-terracotta text-brand-cream' 
                  : 'text-brand-ink hover:text-brand-terracotta'
              }`}
            >
              🟡 Loading Skeleton
            </button>
            <button
              onClick={() => setSimulatorMode('empty')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                simulatorMode === 'empty' 
                  ? 'bg-brand-terracotta text-brand-cream' 
                  : 'text-brand-ink hover:text-brand-terracotta'
              }`}
            >
              🔴 Empty State
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-8 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Search by workshop, theme, or tutor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (simulatorMode !== 'live') setSimulatorMode('live');
              }}
              className="w-full bg-brand-cream border border-brand-clay rounded-full py-3.5 ps-11 pe-4 text-sm font-medium text-brand-charcoal placeholder-brand-muted focus:ring-1 focus:ring-brand-sage"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-brand-muted whitespace-nowrap">Skill Level</span>
              <select
                value={selectedSkillLevel}
                onChange={(e) => {
                  setSelectedSkillLevel(e.target.value);
                  if (simulatorMode !== 'live') setSimulatorMode('live');
                }}
                className="bg-brand-cream border border-brand-clay rounded-full py-3 px-4 text-sm font-medium text-brand-charcoal cursor-pointer focus:ring-1 focus:ring-brand-sage"
              >
                <option value="All">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="All Levels">All Levels (Strict)</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-brand-muted whitespace-nowrap">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-brand-cream border border-brand-clay rounded-full py-3 px-4 text-sm font-medium text-brand-charcoal cursor-pointer focus:ring-1 focus:ring-brand-sage"
              >
                <option value="Popularity">Popularity (Filling Fast)</option>
                <option value="PriceLow">Price: Low to High</option>
                <option value="PriceHigh">Price: High to Low</option>
              </select>
            </div>
          </div>

        </div>

        {/* Scrollable Category Chips on Mobile */}
        <div className="flex items-center justify-between gap-4 border-t border-brand-clay pt-5">
        <div className="min-w-0 overflow-x-auto no-scrollbar py-1 flex gap-2">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  if (simulatorMode !== 'live') setSimulatorMode('live');
                }}
                className={`px-5 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors duration-150 border cursor-pointer active:scale-[0.97] ${
                  isActive
                    ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream font-semibold'
                    : 'bg-brand-cream border-brand-clay text-brand-ink hover:text-brand-charcoal hover:border-brand-muted'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <span className="hidden sm:block shrink-0 text-[13px] text-brand-muted ltr-numerals">
          {filteredWorkshops.length} workshops
        </span>
        </div>
      </div>

      {/* DYNAMIC VIEWS GRID */}
      <div className="mt-10">

        {/* 1. SKELETON STATE */}
        {simulatorMode === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="bg-brand-sand/40 border border-brand-clay rounded-2xl p-4 space-y-4 animate-pulse">
                <div className="aspect-video w-full bg-brand-clay rounded-xl"></div>
                <div className="h-6 bg-brand-clay rounded-md w-3/4"></div>
                <div className="h-4 bg-brand-clay rounded-md w-full"></div>
                <div className="h-4 bg-brand-clay rounded-md w-1/2"></div>
                <div className="pt-4 border-t border-brand-clay flex justify-between">
                  <div className="h-8 bg-brand-clay rounded-md w-20"></div>
                  <div className="h-8 bg-brand-clay rounded-md w-24"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. EMPTY STATE */}
        {(simulatorMode === 'empty' || (simulatorMode === 'live' && filteredWorkshops.length === 0)) && (
          <div className="bg-brand-sand/20 border border-brand-clay rounded-2xl py-16 px-4 text-center max-w-lg mx-auto mt-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mb-4">
              <SlidersHorizontal className="h-7 w-7" />
            </div>
            <h3 className="font-display text-xl font-semibold text-brand-charcoal">No workshops match your filters</h3>
            <p className="text-sm text-brand-ink mt-2 max-w-sm mx-auto leading-relaxed">
              We couldn’t find any clay or painting classes matching your search query or selected category chip. Try clearing the query.
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

        {/* 3. LIVE GRID */}
        {simulatorMode === 'live' && filteredWorkshops.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {filteredWorkshops.map((ws) => {
              const isFull = ws.spotsLeft === 0;
              return (
                <div
                  key={ws.id}
                  onClick={() => handleCardClick(ws)}
                  className={`group relative bg-brand-cream rounded-[32px] p-6 shadow-card shadow-brand-charcoal/5 border border-brand-terracotta/5 transition-all duration-300 flex flex-col h-full text-start ${
                    isFull 
                      ? 'opacity-70 saturate-75 cursor-not-allowed' 
                      : 'cursor-pointer hover:shadow-2xl hover:shadow-brand-terracotta/10 hover:-translate-y-1'
                  }`}
                >
                  {/* Card Image banner */}
                  <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 bg-brand-sand">
                    <img
                      src={ws.image}
                      alt={ws.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Floating category tag */}
                    <div className="absolute bottom-3 right-3 bg-brand-cream/90 backdrop-blur-xs px-2.5 py-1 rounded-lg text-xs font-semibold text-brand-charcoal shadow-2xs">
                      {ws.category}
                    </div>

                    {/* Muted or highlight Spots Pill */}
                    <div className="absolute top-3 left-3">
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
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-brand-charcoal group-hover:text-brand-terracotta transition-colors">
                        {ws.title}
                      </h3>
                      <p className="text-sm text-brand-ink mt-1.5 line-clamp-2">
                        {ws.hook}
                      </p>
                    </div>

                    {/* Meta and Price row */}
                    <div className="mt-6 pt-4 border-t border-brand-clay flex items-center justify-between">
                      <div className="text-xs text-brand-muted space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-brand-sage shrink-0" />
                          <span>{ws.duration}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-brand-sage shrink-0" />
                          <span>Age: {ws.ageRange}</span>
                        </div>
                        {ws.skillLevel && (
                          <div className="flex items-center gap-1">
                            <Layers className="h-3.5 w-3.5 text-brand-sage shrink-0" />
                            <span>Level: {ws.skillLevel}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-brand-sage block uppercase tracking-wider">Total</span>
                        <span className="text-lg font-semibold text-brand-charcoal">{ws.price} SAR</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual full indicator banner overlay */}
                  {isFull && (
                    <div className="absolute inset-0 bg-brand-cream/10 flex items-center justify-center rounded-2xl pointer-events-none">
                      <div className="bg-brand-charcoal text-brand-cream px-4 py-2 rounded-xl text-xs font-semibold tracking-widest uppercase shadow-card-sm rotate-12">
                        Class Full
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
