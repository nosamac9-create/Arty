/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getRiyadhNow, parseBookingDateTimeToRiyadhDate, getRiyadhDateString } from '../utils/dateUtils';
import { resolveStaffName } from '../utils/staffAssignments';
import { getSessionSeatUsage } from '../utils/queueUtils';
import { validateBookingForm } from '../utils/validation';
import { MONTH_NAMES, WEEKDAY_NAMES_SHORT } from '../utils/calendarConfig';
import { 
  Calendar as CalendarIcon, User, Flame, Clock, Award, Map, CheckCircle2, Minus, Plus, Edit, ArrowLeft, Users, ChevronLeft, ChevronRight 
} from 'lucide-react';

export const WorkshopDetailSection: React.FC = () => {
  const { 
    workshops, selectedWorkshopId, setCustomerTab, setPendingBooking, currentUser, todayDateStr, staff, queue,
    workshopFields
  } = useApp();

  const workshop = useMemo(() => {
    return workshops.find(ws => ws.id === selectedWorkshopId) || workshops[0];
  }, [workshops, selectedWorkshopId]);

  // Gallery thumbnail state
  const [activeImg, setActiveImg] = useState(workshop?.image || '');
  useEffect(() => {
    if (workshop?.image) {
      setActiveImg(workshop.image);
    }
  }, [workshop]);

  const thumbnails = [
    workshop?.image || 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=400&q=80',
    'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
  ];

  // Live session query for selected workshop from Dexie
  const dbSessions = useLiveQuery(
    () => db.workshopSessions.where('workshopId').equals(workshop?.id || '').toArray(),
    [workshop?.id]
  ) || [];

  const dbBookings = useLiveQuery(
    () => db.bookings.where('workshopId').equals(workshop?.id || '').toArray(),
    [workshop?.id]
  ) || [];

  // Identify dates with available published sessions
  const datesWithPublishedSessions = useMemo(() => {
    const setOfDates = new Set<string>();
    const riyadhNow = getRiyadhNow();
    const todayStr = getRiyadhDateString();

    for (const sess of dbSessions) {
      if (sess.status !== 'Published') continue;
      if (sess.date < todayStr) continue;

      // Same shared calculation the studio console uses: bookings AND walk-ins.
      const { remainingCapacity: spotsLeft } = getSessionSeatUsage(sess, {
        workshops, bookings: dbBookings, queue
      });
      if (spotsLeft <= 0) continue;

      const sessDateObj = parseBookingDateTimeToRiyadhDate(sess.date, sess.startTime);
      const isPastCutoff = sess.date === todayStr && sessDateObj.getTime() < riyadhNow.getTime() + 30 * 60 * 1000;
      if (!isPastCutoff) {
        setOfDates.add(sess.date);
      }
    }
    return setOfDates;
  }, [dbSessions, dbBookings, queue, workshops]);

  // Dynamic Date Strip Generation (Starting from TODAY i = 0 for same-day booking)
  const dateStrip = useMemo(() => {
    const dates = [];
    const days = WEEKDAY_NAMES_SHORT;
    const todayRiyadhStr = getRiyadhDateString();
    const [y, m, d] = (todayRiyadhStr || '2026-07-23').split('-').map(Number);
    const baseDate = new Date(y, m - 1, d);
    
    for (let i = 0; i < 7; i++) {
      const cur = new Date(baseDate);
      cur.setDate(baseDate.getDate() + i);
      const isoStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      dates.push({
        dayName: days[cur.getDay()],
        dayNum: cur.getDate(),
        fullDate: isoStr,
        isToday: i === 0,
        hasSlots: datesWithPublishedSessions.has(isoStr)
      });
    }
    return dates;
  }, [datesWithPublishedSessions]);

  const [selectedDate, setSelectedDate] = useState<string>(() => getRiyadhDateString());

  // Month navigation calendar state
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const todayRiyadhStr = getRiyadhDateString();
    const [y, m] = (todayRiyadhStr || '2026-07-23').split('-').map(Number);
    return new Date(y, m - 1, 1);
  });

  // Month Calendar Grid logic
  const calendarGrid = useMemo(() => {
    const todayRiyadhStr = getRiyadhDateString();
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth(); // 0-indexed
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const items = [];
    for (let p = 0; p < firstDayOfWeek; p++) {
      items.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isPast = dateStr < todayRiyadhStr;
      const isToday = dateStr === todayRiyadhStr;
      const hasAvailableSessions = datesWithPublishedSessions.has(dateStr);
      items.push({
        dayNum: d,
        dateStr,
        isPast,
        isToday,
        hasAvailableSessions
      });
    }
    return items;
  }, [calendarMonth, datesWithPublishedSessions]);

  const currentMonthStart = useMemo(() => {
    const todayRiyadhStr = getRiyadhDateString();
    const [y, m] = (todayRiyadhStr || '2026-07-23').split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, []);

  const isPrevMonthDisabled = calendarMonth.getTime() <= currentMonthStart.getTime();

  const handlePrevMonth = () => {
    if (isPrevMonthDisabled) return;
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // English Gregorian month names from the shared calendar configuration.
  const monthNames = MONTH_NAMES;

  // Time Slots for selected date calculated from Dexie
  const slots = useMemo(() => {
    if (!selectedDate || !workshop) return [];
    
    const matchingSessions = dbSessions.filter(
      s => s.date === selectedDate && s.status === 'Published'
    );

    const riyadhNow = getRiyadhNow();
    const todayStr = getRiyadhDateString();

    return matchingSessions.map(sess => {
      const { remainingCapacity: spotsLeft } = getSessionSeatUsage(sess, {
        workshops, bookings: dbBookings, queue
      });

      const sessDateObj = parseBookingDateTimeToRiyadhDate(selectedDate, sess.startTime);
      const isPastCutoff = selectedDate < todayStr || (selectedDate === todayStr && sessDateObj.getTime() < riyadhNow.getTime() + 30 * 60 * 1000);

      return {
        id: sess.id,
        time: sess.startTime,
        spots: spotsLeft,
        capacity: sess.capacity,
        isFull: spotsLeft <= 0,
        isPastCutoff,
        // Resolve the tutor from the assignment's staff ID so renames show through.
        instructor: resolveStaffName(staff, sess.staffId || workshop.staffId, sess.instructor || workshop.instructor)
      };
    });
  }, [dbSessions, dbBookings, selectedDate, workshop, staff, queue, workshops]);

  const workshopTutorName = resolveStaffName(staff, workshop?.staffId, workshop?.instructor);

  /**
   * Admin-created fields the Staff Console marked visible to customers. Core
   * fields already have their own places on this page, and internal fields stay
   * hidden unless explicitly configured.
   */
  const customerVisibleFields = useMemo(
    () => workshopFields.filter(f => f.enabled && f.customerVisible && !f.system),
    [workshopFields]
  );

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  // Id of the chosen workshop session — travels with the booking so the tutor
  // can always be resolved from the real session record.
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<number>(1);
  // Capacity/session message from the shared validation layer.
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Participant edit info sync
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [custName, setCustName] = useState(currentUser?.name || '');
  const [custPhone, setCustPhone] = useState(currentUser?.phone || '');
  const [custEmail, setCustEmail] = useState(currentUser?.email || '');

  // Keep local state in sync if currentUser changes
  useEffect(() => {
    if (currentUser) {
      setCustName(currentUser.name);
      setCustPhone(currentUser.phone);
      setCustEmail(currentUser.email);
    } else {
      setCustName('');
      setCustPhone('');
      setCustEmail('');
    }
  }, [currentUser]);

  const totalPrice = useMemo(() => {
    if (!workshop) return 0;
    if (workshop.pricingType === 'Per pair') {
      return workshop.price * Math.ceil(participants / 2);
    }
    if (workshop.pricingType === 'Fixed price') {
      return workshop.price;
    }
    return workshop.price * participants;
  }, [workshop, participants]);

  const priceSubtitle = useMemo(() => {
    if (!workshop) return '';
    if (workshop.pricingType === 'Per pair') return `${workshop.price} SAR / Pair`;
    if (workshop.pricingType === 'Fixed price') return `${workshop.price} SAR (Fixed Price)`;
    return `${workshop.price} SAR / Person`;
  }, [workshop]);

  const handleBook = async () => {
    if (!selectedSlot) return;

    // Re-read capacity from the database rather than trusting the number the
    // page loaded with, and confirm the session is still bookable.
    const bookingErrors = await validateBookingForm({
      sessionId: selectedSessionId,
      participants
    });
    if (Object.keys(bookingErrors).length > 0) {
      setBookingError(bookingErrors.sessionId || bookingErrors.participants || null);
      return;
    }
    setBookingError(null);

    setPendingBooking({
      workshopId: workshop.id,
      sessionId: selectedSessionId || undefined,
      workshopTitle: workshop.title,
      date: selectedDate,
      time: selectedSlot,
      participants: participants,
      totalPrice: totalPrice,
      customerName: currentUser ? currentUser.name : '',
      customerEmail: currentUser ? currentUser.email : '',
      customerPhone: currentUser ? currentUser.phone : '',
    });

    if (!currentUser) {
      setCustomerTab('checkout-info');
    } else {
      setCustomerTab('checkout-info');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300 text-left">
      
      {/* Back button */}
      <button 
        onClick={() => setCustomerTab('workshops')}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3 py-1.5 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Workshops</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16">
        
        {/* LEFT COLUMN: Gallery & Info */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Photos */}
          <div className="space-y-4">
            <div className="aspect-[16/9] w-full rounded-[32px] overflow-hidden bg-brand-sand">
              <img 
                src={activeImg} 
                alt={workshop.title} 
                className="w-full h-full object-cover transition-all duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Thumbnail Strip */}
            <div className="flex gap-3">
              {thumbnails.map((img, i) => {
                const isActive = activeImg === img;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveImg(img)}
                    className={`relative w-20 h-20 rounded-2xl overflow-hidden border bg-brand-sand cursor-pointer transition-all ${
                      isActive 
                        ? 'border-2 border-brand-terracotta' 
                        : 'border-brand-clay opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Metadata */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-lg bg-brand-terracotta/10 px-2.5 py-1 text-xs font-bold text-brand-terracotta">
                {workshop.category}
              </span>
              <span className="inline-flex items-center rounded-lg bg-brand-sage/10 px-2.5 py-1 text-xs font-bold text-brand-sage">
                {workshop.ageRange}
              </span>
            </div>
            
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
              {workshop.title}
            </h1>
            
            <p className="text-lg font-medium text-brand-terracotta">
              "{workshop.hook}"
            </p>
          </div>

          {/* Icon facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5 rounded-2xl border border-brand-clay/80 bg-brand-sand/30">
            
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                <Clock className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Duration</p>
                <p className="text-sm font-semibold text-brand-charcoal">{workshop.duration}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Age Group</p>
                <p className="text-sm font-semibold text-brand-charcoal">{workshop.ageRange}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                <Award className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Tutor</p>
                <p className="text-sm font-semibold text-brand-charcoal">{workshopTutorName}</p>
              </div>
            </div>

            {/* Admin-created fields marked "Visible to Customers" in
                Settings → Workshop Detail Lists. */}
            {customerVisibleFields.map(field => {
              const value = workshop?.customFields?.[field.fieldKey];
              const text = Array.isArray(value) ? value.join(', ') : value;
              if (text === undefined || text === null || String(text).trim() === '') return null;

              return (
                <div key={field.fieldId} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">{field.label}</p>
                    <p className="text-sm font-semibold text-brand-charcoal">
                      {typeof text === 'boolean' ? (text ? 'Yes' : 'No') : String(text)}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                <Map className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Location</p>
                <p className="text-xs font-semibold text-brand-charcoal line-clamp-1">{workshop.room.split('(')[0]}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 col-span-2 sm:col-span-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-cream text-brand-terracotta border border-brand-clay">
                <Flame className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Included</p>
                <p className="text-xs font-semibold text-brand-charcoal">All clay firing, glazing, tools & beverage</p>
              </div>
            </div>

          </div>

          {/* Description details */}
          <div className="space-y-4">
            <h3 className="font-display text-xl font-bold text-brand-charcoal">Workshop Description</h3>
            <p className="text-brand-charcoal/80 leading-relaxed text-sm">
              {workshop.description}
            </p>
            <p className="text-brand-charcoal/80 leading-relaxed text-sm">
              {workshop.fullDetails}
            </p>
          </div>

          {/* Materials Bullet Points List */}
          <div className="space-y-3 pt-4 border-t border-brand-clay/60">
            <h3 className="text-sm font-bold text-brand-charcoal uppercase tracking-wider">What we provide:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workshop.materials.map((mat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-brand-charcoal/80 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-brand-sage shrink-0" />
                  <span>{mat}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Sticky Booking Panel */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 bg-white rounded-[32px] p-8 shadow-xl shadow-brand-charcoal/5 border border-brand-terracotta/5 flex flex-col gap-6">
            
            <div>
              <span className="text-[10px] font-bold text-brand-sage uppercase tracking-widest block">SECURE BOOKING</span>
              <h2 className="font-display text-2xl font-bold text-brand-charcoal">Reserve your workspace</h2>
            </div>

            {/* 1. Date Selection (Month Calendar) */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-charcoal/40 block">
                1. Select a Date
              </label>

              {/* Full Month Calendar with Forward Navigation */}
              <div className="bg-brand-sand/20 rounded-2xl p-4 border border-brand-clay/60 space-y-3 animate-in fade-in duration-200">
                
                {/* Calendar Month Header */}
                <div className="flex items-center justify-between pb-2 border-b border-brand-clay/40">
                  <button
                    type="button"
                    disabled={isPrevMonthDisabled}
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-xl hover:bg-brand-sand border border-brand-clay/40 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer text-brand-charcoal"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-display font-bold text-sm text-brand-charcoal">
                    {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-xl hover:bg-brand-sand border border-brand-clay/40 cursor-pointer text-brand-charcoal"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Day of week headers */}
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-brand-charcoal/50 uppercase">
                  <span>Su</span>
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                </div>

                {/* Grid of Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarGrid.map((item, idx) => {
                    if (!item) {
                      return <div key={`empty-${idx}`} className="h-8"></div>;
                    }

                    const isSelected = selectedDate === item.dateStr;

                    if (item.isPast) {
                      return (
                        <div
                          key={item.dateStr}
                          className="h-8 flex items-center justify-center text-xs text-brand-charcoal/20 rounded-xl cursor-not-allowed select-none"
                        >
                          {item.dayNum}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(item.dateStr);
                          setSelectedSlot(null);
                        }}
                        className={`h-9 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-brand-terracotta text-brand-cream shadow-xs font-black'
                            : item.isToday
                            ? 'border-2 border-brand-terracotta text-brand-terracotta hover:bg-brand-terracotta/10'
                            : item.hasAvailableSessions
                            ? 'text-brand-charcoal bg-brand-sand/40 border border-brand-clay/60 hover:bg-brand-sand'
                            : 'text-brand-charcoal/40 hover:bg-brand-sand border border-transparent'
                        }`}
                      >
                        <span>{item.dayNum}</span>
                        {item.hasAvailableSessions && !isSelected && (
                          <span className="w-1 h-1 rounded-full bg-brand-terracotta shrink-0"></span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] text-center text-brand-charcoal/60 pt-1">
                  Selected: <strong className="text-brand-terracotta">{selectedDate}</strong>
                </p>
              </div>
            </div>

            {/* 2. Grid of Time-Slot Buttons */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-charcoal/40 block">2. Pick a Time</label>
              {slots.length === 0 ? (
                <div className="p-4 rounded-2xl bg-brand-sand/30 border border-brand-clay/40 text-center text-xs font-medium text-brand-charcoal/60">
                  No active published sessions scheduled for this date. Please select another date.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {slots.map((s) => {
                    const isSelected = selectedSlot === s.time;

                    if (s.isPastCutoff) {
                      return (
                        <button
                          key={s.id || s.time}
                          disabled
                          className="px-4 py-3 rounded-2xl border border-brand-clay/20 text-brand-charcoal/30 font-semibold text-sm flex justify-between items-center cursor-not-allowed bg-brand-sand/10"
                        >
                          <span>{s.time}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700/60 bg-amber-50 px-2 py-0.5 rounded">PASSED / CLOSED</span>
                        </button>
                      );
                    }

                    if (s.isFull) {
                      return (
                        <button
                          key={s.id || s.time}
                          disabled
                          className="px-4 py-3 rounded-2xl border border-brand-clay/20 text-brand-charcoal/40 font-semibold text-sm flex justify-between items-center cursor-not-allowed bg-red-50/30"
                        >
                          <span>{s.time}</span>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 bg-red-100 px-2 py-0.5 rounded">FULLY BOOKED</span>
                        </button>
                      );
                    }
                    
                    return (
                      <button
                        key={s.id || s.time}
                        onClick={() => {
                          setSelectedSlot(s.time);
                          setSelectedSessionId(s.id ? String(s.id) : null);
                        }}
                        className={`px-4 py-3 rounded-2xl border transition-all cursor-pointer text-sm font-semibold flex justify-between items-center ${
                          isSelected 
                            ? 'border-2 border-brand-terracotta bg-brand-terracotta/5 text-brand-terracotta shadow-xs' 
                            : 'border border-brand-clay/40 text-brand-charcoal hover:border-brand-terracotta/50'
                        }`}
                      >
                        <div className="text-left">
                          <span className="block font-bold">{s.time}</span>
                          {s.instructor && <span className="text-[10px] text-brand-charcoal/50 block font-normal">Tutor: {s.instructor}</span>}
                        </div>
                        <span className="text-[10px] font-bold bg-brand-sage/10 text-brand-sage px-2 py-1 rounded-lg">{s.spots} open seats</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer Details info block (Rendered ONLY when logged in) */}
            {currentUser ? (
              <div className="p-4 bg-brand-sand/30 rounded-2xl border border-brand-clay/40 text-xs text-brand-charcoal/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-brand-sage">Booking Participant</span>
                  <button 
                    onClick={() => setIsEditingInfo(!isEditingInfo)}
                    className="text-[10px] text-brand-terracotta font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Edit className="h-3 w-3" />
                    <span>{isEditingInfo ? 'Save' : 'Edit'}</span>
                  </button>
                </div>

                {isEditingInfo ? (
                  <div className="space-y-1.5 pt-1">
                    <input 
                      type="text" 
                      value={custName} 
                      onChange={e => setCustName(e.target.value)} 
                      placeholder="Name" 
                      className="w-full bg-white border border-brand-clay/50 p-2 rounded-xl font-semibold text-xs text-brand-charcoal"
                    />
                    <input 
                      type="text" 
                      value={custPhone} 
                      onChange={e => setCustPhone(e.target.value)} 
                      placeholder="Phone" 
                      className="w-full bg-white border border-brand-clay/50 p-2 rounded-xl font-semibold text-xs text-brand-charcoal"
                    />
                  </div>
                ) : (
                  <p className="font-semibold text-brand-charcoal">
                    {currentUser.name} ({currentUser.phone})
                  </p>
                )}
              </div>
            ) : null}

            {/* 3. Participant stepper */}
            <div className="flex items-center justify-between py-1">
              <label className="text-xs font-bold uppercase tracking-widest text-brand-charcoal/40">3. Participants</label>
              <div className="flex items-center gap-4 bg-brand-sand/40 rounded-full px-4 py-2 border border-brand-clay/20">
                <button
                  disabled={participants <= 1}
                  onClick={() => setParticipants(prev => Math.max(1, prev - 1))}
                  className="w-6 h-6 flex items-center justify-center text-brand-charcoal/40 hover:text-brand-charcoal disabled:opacity-30 cursor-pointer text-lg font-bold"
                >
                  −
                </button>
                <span className="font-bold text-base w-4 text-center text-brand-charcoal">{participants}</span>
                <button
                  disabled={participants >= 6}
                  onClick={() => setParticipants(prev => Math.min(6, prev + 1))}
                  className="w-6 h-6 flex items-center justify-center text-brand-terracotta hover:text-brand-terracotta-hover disabled:opacity-30 cursor-pointer text-lg font-bold"
                >
                  +
                </button>
              </div>
            </div>

            {/* 4. Live price summary */}
            <div className="pt-6 border-t border-brand-clay/35 space-y-3 text-sm text-brand-charcoal/95">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-brand-charcoal/40">Total Amount</p>
                  <p className="text-2xl font-serif font-bold text-brand-terracotta">
                    {totalPrice} <span className="text-sm font-sans font-normal">SAR</span>
                  </p>
                </div>
                <p className="text-[10px] text-brand-charcoal/40 italic font-medium">{priceSubtitle}</p>
              </div>
            </div>

            {bookingError && (
              <p className="text-xs text-red-500 font-bold text-center">{bookingError}</p>
            )}

            {/* 5. Book button */}
            <button
              disabled={!selectedSlot}
              onClick={handleBook}
              className={`w-full py-4 text-white rounded-2xl font-bold text-lg shadow-lg transition-all duration-150 cursor-pointer ${
                selectedSlot 
                  ? 'bg-brand-terracotta shadow-brand-terracotta/20 hover:scale-[1.02] active:scale-[0.98]' 
                  : 'bg-brand-sand text-brand-charcoal/40 border border-brand-clay/40 cursor-not-allowed shadow-none'
              }`}
            >
              {selectedSlot ? 'Confirm Booking' : 'Select a Time Slot'}
            </button>

            <p className="text-[10px] text-center text-brand-charcoal/40 italic">
              Free cancellation up to 24h before session starts.
            </p>

          </div>
        </div>
      </div>

      {/* Persistent Mobile Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-cream border-t border-brand-clay p-4 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-24">
        <div>
          <span className="text-[10px] font-bold text-brand-sage uppercase block">Selected Date: {selectedDate.split('-')[2]}/{selectedDate.split('-')[1]}</span>
          <span className="text-lg font-bold text-brand-charcoal">
            {totalPrice} SAR
          </span>
          <span className="text-xs text-brand-charcoal/60 ml-1">({participants} {participants === 1 ? 'ticket' : 'tickets'})</span>
        </div>
        
        <button
          disabled={!selectedSlot}
          onClick={handleBook}
          className={`px-6 py-3 rounded-xl text-xs font-bold tracking-wide shadow-md ${
            selectedSlot 
              ? 'bg-brand-terracotta text-brand-cream hover:bg-brand-terracotta-hover cursor-pointer' 
              : 'bg-brand-sand text-brand-charcoal/40 border border-brand-clay/60 cursor-not-allowed'
          }`}
        >
          {selectedSlot ? 'Book Now' : 'Choose a Slot'}
        </button>
      </div>

    </div>
  );
};
