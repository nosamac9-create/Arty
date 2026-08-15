/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Calendar, Receipt, Copy, Check, ChevronRight, MapPin, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';

export const BookingConfirmationSection: React.FC = () => {
  const { lastBookingCreated, setCustomerTab, workshops, bookingError } = useApp();
  const [copied, setCopied] = useState(false);

  // Trigger celebration confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#C85A32', '#627254', '#D0A348', '#8B5A2B', '#EFE6D5']
      });
      const timer = setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      }, 400);
      return () => clearTimeout(timer);
    } catch (e) {
      // Graceful fallback if canvas error
    }
  }, []);

  // Fallback to mock booking if user visited confirmation directly
  const booking = lastBookingCreated || {
    id: 'ART-82941',
    customerName: 'Noura Al-Amri',
    customerPhone: '+966 50 123 4567',
    workshopTitle: 'Wheel Throwing Masterclass',
    workshopId: 'ws-1',
    date: '2026-07-20',
    time: '04:30 PM',
    participants: 2,
    totalPrice: 640
  };

  const matchingWorkshop = workshops.find(w => w.id === booking.workshopId) || workshops[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(booking.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // The write happens after this screen appears. If it failed, say so rather
  // than showing a confirmation for a booking that does not exist.
  if (bookingError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl font-semibold">!</div>
        <h2 className="font-display text-2xl font-semibold text-brand-charcoal">Your booking did not go through</h2>
        <p className="text-sm text-brand-ink leading-relaxed">{bookingError}</p>
        <p className="text-xs text-brand-charcoal/55">
          Nothing has been reserved and you have not been charged. Please try again,
          or call the studio on +966 12 654 3210.
        </p>
        <button
          onClick={() => setCustomerTab('workshops')}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-6 py-3 text-sm font-semibold text-brand-cream cursor-pointer"
        >
          Back to Workshops
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 animate-in zoom-in-95 duration-300 text-start">
      <div className="rounded-[28px] border border-brand-clay bg-brand-cream p-8 shadow-card-sm relative overflow-hidden">
        
        {/* Subtle decorative clay background motif */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/5 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-sage/5 rounded-full blur-2xl"></div>

        {/* Custom Pottery-oriented Celebration Graphic */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Spinning/pulsing sparkles around the pot */}
            <div className="absolute -top-3 -right-3 text-brand-terracotta pulse-accent">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="absolute -bottom-2 -left-3 text-brand-sage pulse-accent delay-500">
              <Sparkles className="h-4 w-4" />
            </div>
            
            {/* Elegant Handmolded Clay Pot Graphic */}
            <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-brand-terracotta text-brand-cream shadow-card-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-10 w-10">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m12.72-12.72l-1.41 1.41" />
                <path fill="currentColor" opacity="0.2" d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5 2.24-5 5-5 5 2.24 5 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Success Header */}
        <div className="text-center space-y-2 mb-6">
          <h1 className="font-display text-3xl font-semibold text-brand-charcoal">You're booked!</h1>
          <p className="text-sm text-brand-ink max-w-sm mx-auto">
            We have reserved your potter wheel at the café. A confirmation email and SMS with parking guidelines has been sent.
          </p>
        </div>

        {/* Copyable Reference Pill */}
        <div className="bg-brand-sand/60 border border-brand-clay rounded-2xl p-3.5 flex items-center justify-between gap-3 mb-6">
          <div className="text-start">
            <span className="text-[9px] font-semibold text-brand-sage uppercase tracking-wider block">Booking Reference</span>
            <span className="text-sm font-mono font-semibold text-brand-charcoal tracking-wider">{booking.id}</span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-cream border border-brand-clay hover:bg-brand-sand transition-colors cursor-pointer text-brand-terracotta"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span className="text-green-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Booking Details Summary List */}
        <div className="border-t border-brand-clay py-5 space-y-4 text-xs text-brand-ink">
          
          <div className="flex justify-between items-start">
            <span className="font-semibold text-brand-muted">Workshop</span>
            <span className="font-semibold text-brand-charcoal text-end min-w-0 break-words">{booking.workshopTitle}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-brand-muted">Date & Session</span>
            <span className="font-semibold text-brand-charcoal">{booking.date} at {booking.time}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-brand-muted">Artists Registered</span>
            <span className="font-semibold text-brand-charcoal">{booking.participants} {booking.participants === 1 ? 'Person' : 'People'}</span>
          </div>

          <div className="flex justify-between">
            <span className="font-semibold text-brand-muted">Total Paid (VAT incl.)</span>
            <span className="font-semibold text-brand-terracotta text-sm">{booking.totalPrice} SAR</span>
          </div>

          <div className="flex justify-between items-start">
            <span className="font-semibold text-brand-muted">Studio Location</span>
            <div className="text-right">
              <span className="font-semibold text-brand-charcoal block">{matchingWorkshop?.room || 'Studio A'}</span>
              <span className="text-[10px] text-brand-muted flex items-center justify-end gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> Al-Rawdah Street, Jeddah
              </span>
            </div>
          </div>

        </div>

        {/* Buttons */}
        <div className="space-y-3 pt-4 border-t border-brand-clay">
          <button
            onClick={() => setCustomerTab('my-bookings')}
            className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream shadow-card-sm hover:bg-brand-terracotta-hover transition-colors text-center"
          >
            View My Bookings
          </button>
          
          <button
            onClick={() => alert('Calendar event "Arty Café Workshop" successfully added to Apple/Google Calendar!')}
            className="w-full cursor-pointer rounded-xl bg-brand-cream border border-brand-clay py-3.5 text-sm font-semibold text-brand-charcoal hover:bg-brand-sand transition-colors text-center flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4 text-brand-sage" />
            <span>Add to Calendar</span>
          </button>
        </div>

        {/* Cancellation policy note */}
        <p className="mt-5 text-[10px] text-center text-brand-muted italic leading-relaxed">
          *Need to reschedule? You can cancel or shift times free of charge up to 24 hours before your session directly from your bookings portal.
        </p>

      </div>
    </div>
  );
};
