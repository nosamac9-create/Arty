/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Palette, Coffee, Menu, X, User, Calendar, Flame } from 'lucide-react';

export const CustomerHeader: React.FC = () => {
  const { customerTab, setCustomerTab, currentUser } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Coffee },
    { id: 'workshops', label: 'Workshops', icon: Palette },
    { id: 'my-bookings', label: 'My Bookings', icon: Calendar },
    { id: 'my-pieces', label: 'My Pieces', icon: Flame },
    { id: 'auth', label: currentUser ? 'My Account' : 'Login', icon: User },
  ] as const;

  const handleNavClick = (tabId: typeof navItems[number]['id']) => {
    setCustomerTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-brand-terracotta/10 bg-brand-cream/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo left */}
        <button 
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2 text-left group focus:outline-none"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream shadow-md transition-transform duration-300 group-hover:rotate-12">
            <Palette className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="font-display text-xl font-bold text-brand-charcoal tracking-tight block leading-none">Arty Café</span>
            <span className="text-[9px] font-bold text-brand-sage uppercase tracking-wider block">Jeddah Art & Clay</span>
          </div>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = customerTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center gap-1.5 px-1 py-2 text-sm font-medium transition-all cursor-pointer relative ${
                  isActive 
                    ? 'text-brand-terracotta font-bold' 
                    : 'text-brand-charcoal/80 hover:text-brand-terracotta'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-terracotta rounded-full"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Prominent CTA / Booking Right */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => handleNavClick('workshops')}
            className="cursor-pointer px-6 py-2 bg-brand-terracotta text-brand-cream rounded-full text-sm font-semibold shadow-md shadow-brand-terracotta/25 hover:bg-brand-terracotta-hover transition-all duration-200 active:scale-95"
          >
            Book Now
          </button>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => handleNavClick('workshops')}
            className="rounded-lg bg-brand-terracotta px-3.5 py-1.5 text-xs font-semibold text-brand-cream shadow-sm hover:bg-brand-terracotta-hover"
          >
            Book
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-brand-charcoal hover:bg-brand-sand focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-brand-clay bg-brand-cream px-4 py-4 space-y-1.5 shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = customerTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-base font-semibold rounded-xl cursor-pointer ${
                  isActive 
                    ? 'text-brand-terracotta bg-brand-sand' 
                    : 'text-brand-charcoal/85 hover:bg-brand-sand/50 hover:text-brand-terracotta'
                }`}
              >
                <Icon className="h-5 w-5 text-brand-sage" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export const CustomerFooter: React.FC = () => {
  const { setCustomerTab } = useApp();
  
  return (
    <footer className="border-t border-brand-clay bg-brand-sand/40 py-12 text-brand-charcoal/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-terracotta text-brand-cream">
                <Palette className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold">Arty Café</span>
            </div>
            <p className="text-sm text-brand-charcoal/70">
              Jeddah’s cozy creative sanctuary. Crafting memories, pouring fine coffee, and molding mud into masterworks since 2021.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-display font-semibold text-brand-charcoal mb-4">Explore</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => setCustomerTab('workshops')} className="hover:text-brand-terracotta transition-colors text-left">
                  Pottery Workshops
                </button>
              </li>
              <li>
                <button onClick={() => setCustomerTab('workshops')} className="hover:text-brand-terracotta transition-colors text-left">
                  Acrylic Painting
                </button>
              </li>
              <li>
                <button onClick={() => setCustomerTab('workshops')} className="hover:text-brand-terracotta transition-colors text-left">
                  Kids & Couples Classes
                </button>
              </li>
            </ul>
          </div>

          {/* Opening Hours */}
          <div>
            <h3 className="font-display font-semibold text-brand-charcoal mb-4">Hours</h3>
            <ul className="space-y-2 text-sm text-brand-charcoal/75">
              <li>Saturday – Thursday</li>
              <li className="font-semibold">09:00 AM – 11:00 PM</li>
              <li className="pt-1">Friday</li>
              <li className="font-semibold">02:00 PM – 11:00 PM</li>
            </ul>
          </div>

          {/* Location */}
          <div>
            <h3 className="font-display font-semibold text-brand-charcoal mb-4">Say Hello</h3>
            <p className="text-sm text-brand-charcoal/75">
              Al-Rawdah District, Jeddah, KSA
            </p>
            <p className="text-sm font-semibold text-brand-terracotta mt-2">
              +966 12 654 3210
            </p>
            <p className="text-xs text-brand-charcoal/50 mt-1">
              hello@artycafe.sa
            </p>
          </div>

        </div>

        <div className="mt-12 pt-8 border-t border-brand-clay/60 flex flex-col sm:flex-row items-center justify-between text-xs text-brand-charcoal/60 gap-4">
          <p>© 2026 Arty Café Jeddah. All rights reserved.</p>
          <div className="flex gap-6">
            <span className="hover:text-brand-terracotta cursor-pointer">Instagram</span>
            <span className="hover:text-brand-terracotta cursor-pointer">X (Twitter)</span>
            <span className="hover:text-brand-terracotta cursor-pointer">TikTok</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
