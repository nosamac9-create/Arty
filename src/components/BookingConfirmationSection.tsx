/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Calendar, Receipt, ChevronRight, MapPin, Gift } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Riyadh is UTC+3 all year — Saudi Arabia has observed no daylight saving since
 * 1990 — so a wall-clock time converts to UTC by subtracting exactly three
 * hours. Emitting UTC (a trailing Z) means the file needs no VTIMEZONE block and
 * is read identically by Apple Calendar, Google Calendar and Outlook.
 *
 * Deliberately NOT using parseBookingDateTimeToRiyadhDate: that builds a Date in
 * the BROWSER's timezone, which is only the same instant when the browser is in
 * Riyadh. Correct for the same-day comparisons it was written for, wrong for a
 * calendar file a customer may open anywhere.
 */
const RIYADH_UTC_OFFSET_HOURS = 3;

/** "04:30 PM", "4:30 PM" and "16:30" all parse. Anything else returns null. */
function parseTimeOfDay(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const cleaned = String(timeStr).trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return null;

  const meridiem = match[3];
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23) return null;

  return { hours, minutes };
}

/** "2 Hours", "1.5 Hours", "90 Minutes", "2h". Null when nothing is readable. */
function parseDurationMinutes(text?: string): number | null {
  if (!text) return null;
  const value = String(text).toLowerCase();
  const hours = value.match(/([\d.]+)\s*(h|hr|hrs|hour|hours)\b/);
  if (hours) {
    const n = parseFloat(hours[1]);
    if (!Number.isNaN(n) && n > 0) return Math.round(n * 60);
  }
  const minutes = value.match(/([\d.]+)\s*(m|min|mins|minute|minutes)\b/);
  if (minutes) {
    const n = parseFloat(minutes[1]);
    if (!Number.isNaN(n) && n > 0) return Math.round(n);
  }
  return null;
}

/** RFC 5545 §3.3.11: backslash, semicolon, comma and newlines are escaped. */
function icsEscape(text: string): string {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: content lines are folded at 75 octets, continuations start with a space. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

const toIcsUtc = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const BookingConfirmationSection: React.FC = () => {
  const { lastBookingCreated, setCustomerTab, workshops, bookingError } = useApp();

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

  /**
   * The calendar file, or null when the booking cannot describe a real event.
   *
   * Null hides the button entirely rather than handing the customer a file their
   * calendar will reject. A date and a start time are the minimum: without both
   * there is no event. Duration is best-effort — if the workshop does not state
   * one, the event is written as two hours, the app's own default session
   * length, because an approximate end time is far more useful than none.
   */
  const calendarEvent = useMemo(() => {
    const dateStr = String(booking.date || '');
    const dateParts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeOfDay = parseTimeOfDay(booking.time);
    if (!dateParts || !timeOfDay) return null;

    const [, y, m, d] = dateParts;
    const start = new Date(Date.UTC(
      Number(y), Number(m) - 1, Number(d),
      timeOfDay.hours - RIYADH_UTC_OFFSET_HOURS, timeOfDay.minutes, 0
    ));
    if (Number.isNaN(start.getTime())) return null;

    const minutes = parseDurationMinutes(matchingWorkshop?.duration) ?? 120;
    const end = new Date(start.getTime() + minutes * 60_000);

    const title = booking.workshopTitle || 'Arty Café Workshop';
    const room = matchingWorkshop?.room || '';
    const location = [room, 'Arty Café', 'Ahmad Al Attas St, Jeddah'].filter(Boolean).join(', ');
    const guests = `${booking.participants} ${booking.participants === 1 ? 'guest' : 'guests'}`;
    const description = `${title} at Arty Café. Booking reference ${booking.id}, ${guests}. `
      + 'You can cancel or reschedule free of charge up to 24 hours before the session.';

    // A UID must be globally unique and stable, so the same booking re-added
    // updates the existing entry rather than creating a duplicate.
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Arty Cafe//Booking//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${icsEscape(String(booking.id))}@artycafe.sa`,
      `DTSTAMP:${toIcsUtc(new Date())}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      `LOCATION:${icsEscape(location)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    // CRLF line endings are required by RFC 5545, and Outlook enforces it.
    return {
      filename: `arty-cafe-${String(booking.id).toLowerCase()}.ics`,
      content: lines.map(foldLine).join('\r\n') + '\r\n'
    };
  }, [booking, matchingWorkshop]);

  const downloadCalendarEvent = () => {
    if (!calendarEvent) return;
    const blob = new Blob([calendarEvent.content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = calendarEvent.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Freed on the next tick so the click has already started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
          or call the studio on +966 54 822 2055.
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
      <div className="rounded-[28px] border border-brand-clay bg-white p-8 shadow-card-sm relative overflow-hidden">
        
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
        <div className="text-center space-y-2 mb-2">
          <h1 className="font-display text-3xl font-semibold text-brand-charcoal">You're booked!</h1>
          <p className="text-sm text-brand-ink max-w-sm mx-auto">
            We have reserved your potter wheel at the café. Your booking is saved under
            My Bookings, where you can check the details or cancel any time.
          </p>
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
            <span className="font-semibold text-brand-muted">Guests</span>
            <span className="font-semibold text-brand-charcoal">{booking.participants} {booking.participants === 1 ? 'Guest' : 'Guests'}</span>
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
                <MapPin className="h-3 w-3" /> Ahmad Al Attas St, Jeddah
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
          
          {calendarEvent && (
            <button
              onClick={downloadCalendarEvent}
              className="w-full cursor-pointer rounded-xl bg-brand-cream border border-brand-clay py-3.5 text-sm font-semibold text-brand-charcoal hover:bg-brand-sand transition-colors text-center flex items-center justify-center gap-2"
            >
              <Calendar className="h-4 w-4 text-brand-sage" />
              <span>Add to Calendar</span>
            </button>
          )}
        </div>

        {/* Cancellation policy note */}
        <p className="mt-5 text-[10px] text-center text-brand-muted italic leading-relaxed">
          *Need to reschedule? You can cancel or shift times free of charge up to 24 hours before your session directly from your bookings portal.
        </p>

      </div>
    </div>
  );
};
