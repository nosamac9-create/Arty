/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp, getRiyadhNow } from '../context/AppContext';
import { Calendar, Users, Hash, AlertCircle, Trash2, CalendarX, Compass, HelpCircle } from 'lucide-react';
import { Booking } from '../types';

export const MyBookingsSection: React.FC = () => {
  const { bookings, cancelBooking, setCustomerTab, workshops, currentUser, setAuthScreen } = useApp();
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

    const userBookings = (bookings || []).filter(b => 
      (currentUser.email && b.customerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.phone && b.customerPhone?.replace(/\s+/g, '') === currentUser.phone.replace(/\s+/g, ''))
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

  const getWorkshopImage = (workshopId: string) => {
    const ws = workshops.find(w => w.id === workshopId);
    return ws ? ws.image : 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=150&h=150&q=80';
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 animate-in fade-in duration-300 text-center">
        <div className="bg-brand-cream border border-brand-clay rounded-3xl p-8 sm:p-12 shadow-sm max-w-md mx-auto space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mx-auto">
            <Calendar className="h-8 w-8" />
          </div>
          <h2 className="font-display text-xl font-bold text-brand-charcoal">Sign In to View Your Reservations</h2>
          <p className="text-xs text-brand-charcoal/70 leading-relaxed">
            Please log in or register an account to manage your workshop bookings, view reservation details, or request cancellations.
          </p>
          <div className="pt-2">
            <button
              onClick={() => { setAuthScreen('signin'); setCustomerTab('account'); }}
              className="cursor-pointer bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream font-bold py-3 px-6 rounded-2xl shadow-sm text-xs transition-colors"
            >
              Sign In or Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-in fade-in duration-300 text-left">
      
      {/* Title */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold text-brand-charcoal">My Reservations</h1>
        <p className="text-sm text-brand-charcoal/70 mt-1">
          Review, reschedule, or cancel your upcoming creative sessions at Arty Café.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-brand-clay mb-8">
        {(['Upcoming', 'Past'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3.5 text-sm font-bold border-b-2 transition-colors relative cursor-pointer ${
              activeTab === tab
                ? 'border-brand-terracotta text-brand-terracotta'
                : 'border-transparent text-brand-charcoal/60 hover:text-brand-terracotta'
            }`}
          >
            <span>{tab} Tab</span>
            {categorizedBookings[tab].length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-brand-terracotta/10 px-2 py-0.5 text-xs font-bold text-brand-terracotta">
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
          <div className="bg-brand-sand/30 border border-brand-clay rounded-2xl p-12 text-center max-w-md mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta/10 text-brand-terracotta mb-4">
              <CalendarX className="h-7 w-7" />
            </div>
            <h3 className="font-display text-lg font-bold text-brand-charcoal">
              {activeTab === 'Past' ? 'No past bookings yet' : 'No upcoming bookings'}
            </h3>
            <p className="text-sm text-brand-charcoal/70 mt-2 leading-relaxed">
              {activeTab === 'Past' 
                ? "You haven't completed any art classes with us yet. Let's make something beautiful!"
                : "You don't have any sessions booked. Check our interactive timetable to join."
              }
            </p>
            <button
              onClick={() => setCustomerTab('workshops')}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-5 py-3 text-xs font-bold text-brand-cream hover:bg-brand-terracotta-hover shadow-sm cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Browse Workshops</span>
            </button>
          </div>
        ) : (
          activeList.map(b => {
            const isClosed = isCancellationClosed(b);
            const isCancelled = b.status === 'Cancelled';
            const imageUrl = getWorkshopImage(b.workshopId);

            return (
              <div
                key={b.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl border border-brand-clay bg-brand-cream shadow-2xs gap-4 transition-all hover:shadow-xs relative ${
                  isCancelled ? 'opacity-65' : ''
                }`}
              >
                {/* Left block: thumbnail & title info */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-brand-sand border border-brand-clay">
                    <img src={imageUrl} alt={b.workshopTitle} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="space-y-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${getStatusBadgeColor(b.status)}`}>
                      {b.status}
                    </span>
                    <h3 className="font-display text-lg font-bold text-brand-charcoal leading-tight line-clamp-1">
                      {b.workshopTitle}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-charcoal/60 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-brand-sage" />
                        <span>{b.date} at {b.time}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-brand-sage" />
                        <span>{b.participants} {b.participants === 1 ? 'artist' : 'artists'}</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono font-bold text-brand-terracotta">
                        <Hash className="h-3 w-3" />
                        <span>{b.id}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right block: total price & actions */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-brand-clay/50 gap-2">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] font-bold text-brand-sage block uppercase tracking-wider">Paid amount</span>
                    <span className="text-base font-bold text-brand-charcoal">{b.totalPrice} SAR</span>
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
                            onClick={() => alert("Cancellation closed. It is less than 24 hours before class start. Please contact the front desk at +966 12 654 3210.")}
                            className="text-xs font-bold text-gray-400 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Cancel booking</span>
                            <HelpCircle className="h-3 w-3 text-brand-terracotta shrink-0" />
                          </button>

                          {/* Hover Tooltip - requested in the prompt */}
                          {hoveredTooltipId === b.id && (
                            <div className="absolute right-0 bottom-full mb-2 z-50 w-64 p-3 bg-brand-charcoal text-brand-cream rounded-xl text-[11px] leading-relaxed shadow-lg border border-brand-clay animate-in fade-in slide-in-from-bottom-2 duration-200 font-semibold">
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
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to cancel booking ${b.id}? Your payment of ${b.totalPrice} SAR will be refunded.`)) {
                              cancelBooking(b.id);
                            }
                          }}
                          className="text-xs font-bold text-brand-terracotta hover:text-brand-terracotta-hover hover:underline py-1.5 px-3 rounded-lg border border-transparent hover:border-brand-clay/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Cancel booking</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Cancelled placeholder marker */}
                  {isCancelled && (
                    <span className="text-xs font-bold text-brand-charcoal/40 italic block py-1">
                      Refund complete
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
