/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp, getRiyadhNow } from '../context/AppContext';
import { Calendar, Users, Clock, GraduationCap, AlertCircle, Trash2, CalendarX, Compass, HelpCircle } from 'lucide-react';
import { Booking } from '../types';
import { resolveBookingInstructor } from '../utils/queueUtils';
import { normalizeCustomerPhone } from '../utils/customerIdentity';
import Reveal from './ui/Reveal';
import { ScrollReveal } from './ui/ScrollReveal';
import { AppImage } from './ui/AppImage';

export const MyBookingsSection: React.FC = () => {
  const { bookings, cancelOwnBooking, setCustomerTab, workshops, currentUser, setAuthScreen, staff, workshopSessions } = useApp();
  /** The booking currently being cancelled, so its button can be disabled. */
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [hoveredTooltipId, setHoveredTooltipId] = useState<string | null>(null);

  // Divide bookings into Upcoming and Past for current authenticated user
  const categorizedBookings = useMemo(() => {
    const today = getRiyadhNow();
    
    const upcomingList: Booking[] = [];
    const pastList: Booking[] = [];

    if (!currentUser) {
      return { Upcoming: [], Past: [] };
    }

    // The customer id is the reliable link — it is what the row-level policy
    // matches on. Email and phone stay as a fallback for older rows saved
    // before the link existed.
    const userBookings = (bookings || []).filter(b =>
      (currentUser.id && b.customerId === currentUser.id) ||
      (currentUser.email && b.customerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.phone &&
        normalizeCustomerPhone(b.customerPhone) === normalizeCustomerPhone(currentUser.phone))
    );

    userBookings.forEach(b => {
      const bDate = new Date(`${b.date}T${b.time === '11:00' ? '11:00:00' : '16:00:00'}`);
      const isCancelled = b.status === 'Cancelled';
      
      // If cancelled, keep it in the tab where it originally belonged (mostly upcoming)
      if (bDate >= today && !isCancelled) {
        upcomingList.push(b);
      } else if (isCancelled) {
        upcomingList.push(b); // show cancelled bookings in upcoming so customers can review them
      } else {
        pastList.push(b);
      }
    });

    return { Upcoming: upcomingList, Past: pastList };
  }, [bookings, currentUser]);

  const activeList = categorizedBookings[activeTab];

  // Helper to determine if cancellation window is closed (< 24 hours before start)
  const isCancellationClosed = (booking: Booking): boolean => {
    const now = getRiyadhNow();
    const start = new Date(`${booking.date}T${booking.time.includes('AM') || booking.time.includes('PM') ? '16:00:00' : '11:00:00'}`);
    
    const diffMs = start.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours < 24 && diffHours > 0;
  };

  const getStatusBadgeColor = (status: Booking['status']) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Checked In':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  /** The booked workshop's duration, e.g. "2.5 Hours". Blank if unknown. */
  const getWorkshopDuration = (workshopId: string) => {
    const ws = workshops.find(w => w.id === workshopId);
    return ws?.duration || '';
  };

  const getWorkshopImage = (workshopId: string) => {
    const ws = workshops.find(w => w.id === workshopId);
    return ws ? ws.image : 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=150&h=150&q=80';
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in duration-300 text-start">

        {/* Title */}
        <div className="pb-8 border-b border-brand-clay mb-8">
          <Reveal index={0}>
            <h1 className="font-display text-3xl font-semibold text-brand-charcoal">My Reservations</h1>
          </Reveal>
          <Reveal index={1}>
            <p className="text-sm text-brand-ink mt-1">
              Review, reschedule, or cancel your upcoming creative sessions at Arty Café.
            </p>
          </Reveal>
        </div>

        <ScrollReveal
          once
          viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
          transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
        >
        <div className="bg-white border border-brand-clay rounded-[28px] p-8 sm:p-12 shadow-card-sm max-w-md mx-auto space-y-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mx-auto">
            <Calendar className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-semibold text-brand-charcoal">Sign In to View Your Reservations</h2>
          <p className="text-xs text-brand-ink leading-relaxed">
            Please log in or register an account to manage your workshop bookings, view reservation details, or request cancellations.
          </p>
          <div className="pt-2">
            <button
              onClick={() => { setAuthScreen('login'); setCustomerTab('auth'); }}
              className="cursor-pointer bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream font-semibold py-3 px-6 rounded-2xl shadow-card-sm text-xs transition-colors"
            >
              Sign In or Create Account
            </button>
          </div>
        </div>
        </ScrollReveal>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in duration-300 text-start">

      {/* Title */}
      <div className="pb-8 border-b border-brand-clay mb-8">
        <Reveal index={0}>
          <h1 className="font-display text-3xl font-semibold text-brand-charcoal">My Reservations</h1>
        </Reveal>
        <Reveal index={1}>
          <p className="text-sm text-brand-ink mt-1">
            Review, reschedule, or cancel your upcoming creative sessions at Arty Café.
          </p>
        </Reveal>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-brand-clay mb-8">
        {(['Upcoming', 'Past'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors relative cursor-pointer ${
              activeTab === tab
                ? 'border-brand-terracotta text-brand-terracotta'
                : 'border-transparent text-brand-muted hover:text-brand-terracotta'
            }`}
          >
            <span>{tab} Tab</span>
            {categorizedBookings[tab].length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-brand-terracotta/10 px-2 py-0.5 text-xs font-semibold text-brand-terracotta">
                {categorizedBookings[tab].length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List content */}
      <div className="space-y-6">
        {activeList.length === 0 ? (
          /* PAST TAB EMPTY STATE or GENERAL EMPTY STATE */
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
            transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
          <div className="bg-white border border-brand-clay rounded-2xl p-8 sm:p-12 text-center max-w-md mx-auto shadow-card-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mb-4">
              <CalendarX className="h-7 w-7" />
            </div>
            <h3 className="font-display text-lg font-semibold text-brand-charcoal">
              {activeTab === 'Past' ? 'No past bookings yet' : 'No upcoming bookings'}
            </h3>
            <p className="text-sm text-brand-ink mt-2 leading-relaxed">
              {activeTab === 'Past'
                ? "You haven't completed any art classes with us yet. Let's make something beautiful!"
                : "You don't have any sessions booked. Check our interactive timetable to join."
              }
            </p>
            <button
              onClick={() => setCustomerTab('workshops')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-5 py-3 text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover shadow-card-sm cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Browse Workshops</span>
            </button>
          </div>
          </ScrollReveal>
        ) : (
          activeList.map((b, rowIndex) => {
            const isClosed = isCancellationClosed(b);
            const isCancelled = b.status === 'Cancelled';
            const imageUrl = getWorkshopImage(b.workshopId);
            const duration = getWorkshopDuration(b.workshopId);

            return (
              <ScrollReveal
                key={b.id}
                once
                viewOptions={{ once: true, amount: 0.3, margin: '0px 0px -80px 0px' }}
                transition={{ delay: rowIndex * 0.12, duration: 0.5, ease: 'easeOut' }}
                variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
              >
              <div
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-[22px] border border-brand-clay bg-brand-cream shadow-2xs gap-4 transition-all hover:shadow-card-sm relative ${
                  isCancelled ? 'opacity-65' : ''
                }`}
              >
                {/* Left block: thumbnail & title info */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-brand-sand border border-brand-clay">
                    <AppImage src={imageUrl} alt={b.workshopTitle} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-1">
                    {/* Pending is not an alert — it is a state, so it is set
                        like the "Paid amount" label rather than as a badge. */}
                    {b.status === 'Pending' ? (
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-sage">
                        {b.status}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${getStatusBadgeColor(b.status)}`}>
                        {b.status}
                      </span>
                    )}
                    <h3 className="font-display text-lg font-semibold text-brand-charcoal leading-tight line-clamp-1">
                      {b.workshopTitle}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-muted font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-brand-sage" />
                        <span>{b.date} at {b.time}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-brand-sage" />
                        <span>{b.participants} {b.participants === 1 ? 'guest' : 'guests'}</span>
                      </span>
                      {/* Tutor resolved from the booked session record */}
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-brand-sage" />
                        <span>{resolveBookingInstructor(b, { staff, workshopSessions }).name}</span>
                      </span>
                      {duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-brand-sage" />
                          <span>{duration}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right block: total price & actions */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-brand-clay gap-2">
                  <div className="text-start sm:text-right">
                    <span className="text-[10px] font-semibold text-brand-sage block uppercase tracking-wider">Paid amount</span>
                    <span className="text-base font-semibold text-brand-charcoal">{b.totalPrice} SAR</span>
                  </div>

                  {/* Cancel Booking Action Trigger with Hover Tooltip simulation */}
                  {activeTab === 'Upcoming' && !isCancelled && (
                    <div className="relative">
                      {isClosed ? (
                        /* Cancellation Closed Variant */
                        <div className="relative">
                          <button
                            onMouseEnter={() => setHoveredTooltipId(b.id)}
                            onMouseLeave={() => setHoveredTooltipId(null)}
                            onClick={() => alert("Cancellation closed. It is less than 24 hours before class start. Please contact the front desk at +966 54 822 2055.")}
                            className="text-xs font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Cancel booking</span>
                            <HelpCircle className="h-3 w-3 text-brand-terracotta shrink-0" />
                          </button>

                          {/* Hover Tooltip - requested in the prompt */}
                          {hoveredTooltipId === b.id && (
                            <div className="absolute right-0 bottom-full mb-2 z-50 w-64 p-3 bg-brand-charcoal text-brand-cream rounded-xl text-[11px] leading-relaxed shadow-card border border-brand-clay animate-in fade-in slide-in-from-bottom-2 duration-200 font-semibold">
                              <div className="flex items-start gap-1.5">
                                <AlertCircle className="h-4 w-4 text-brand-terracotta shrink-0 mt-0.5" />
                                <span>Cancellation closed — less than 24 hours before start</span>
                              </div>
                              <div className="absolute top-full right-4 w-2 h-2 bg-brand-charcoal rotate-45 -mt-1 border-r border-b border-brand-clay"></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Normal Cancel Button */
                        <button
                          disabled={cancellingId === b.id}
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to cancel your booking for ${b.workshopTitle}? Your payment of ${b.totalPrice} SAR will be refunded.`)) return;

                            // The result is acted on rather than discarded: the
                            // old call could be refused server-side and the page
                            // would still look as though it had worked.
                            setCancellingId(b.id);
                            const result = await cancelOwnBooking(b.id);
                            setCancellingId(null);
                            if (!result.success) {
                              window.alert(result.error || 'That booking could not be cancelled.');
                            }
                          }}
                          className="text-xs font-semibold text-brand-terracotta hover:text-brand-terracotta-hover hover:underline py-1.5 px-3 rounded-lg border border-transparent hover:border-brand-clay flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Cancel booking</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancelled placeholder marker */}
                  {isCancelled && (
                    <span className="text-xs font-semibold text-brand-charcoal/40 italic block py-1">
                      Refund complete
                    </span>
                  )}
                </div>

              </div>
              </ScrollReveal>
            );
          })
        )}
      </div>

    </div>
  );
};
