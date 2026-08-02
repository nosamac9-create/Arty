/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CalendarDays, Globe, User, ListOrdered, Palette, Box, AlertTriangle, Coins, 
  TrendingUp, TrendingDown, Clock, Cake, Bell, CheckCircle2, Phone, Mail, ChevronRight, Sparkles, Filter
} from 'lucide-react';
import { Booking, PotteryPiece } from '../types';

export const AdminDashboardSection: React.FC = () => {
  const { 
    bookings, 
    queue, 
    pieces, 
    workshops, 
    setAdminTab, 
    todayDateStr, 
    getRelativeRiyadhDateStr, 
    updatePieceStatus, 
    updatePiece 
  } = useApp();

  const tomorrowDateStr = useMemo(() => getRelativeRiyadhDateStr(1), [getRelativeRiyadhDateStr]);
  const currentRiyadhMonth = useMemo(() => todayDateStr.slice(0, 7), [todayDateStr]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. TODAY'S BOOKINGS
  const todaysBookings = useMemo(() => {
    return bookings
      .filter(b => b.date === todayDateStr && b.status !== 'Cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings, todayDateStr]);

  const todaysTotalParticipants = useMemo(() => {
    return todaysBookings.reduce((sum, b) => sum + b.participants, 0);
  }, [todaysBookings]);

  // 2. TOMORROW'S BOOKINGS
  const tomorrowsBookings = useMemo(() => {
    return bookings
      .filter(b => b.date === tomorrowDateStr && b.status !== 'Cancelled')
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookings, tomorrowDateStr]);

  const tomorrowsTotalParticipants = useMemo(() => {
    return tomorrowsBookings.reduce((sum, b) => sum + b.participants, 0);
  }, [tomorrowsBookings]);

  // 3. BIRTHDAY BOOKINGS THIS MONTH
  const monthlyBirthdayBookings = useMemo(() => {
    return bookings
      .filter(b => {
        const isBirthday = b.workshopId === 'birthday-party-event' || 
          b.workshopTitle.toLowerCase().includes('birthday') || 
          b.workshopTitle.toLowerCase().includes('package');
        return isBirthday && b.status !== 'Cancelled' && b.date.startsWith(currentRiyadhMonth);
      })
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) return dateDiff;
        return a.time.localeCompare(b.time);
      });
  }, [bookings, currentRiyadhMonth]);

  // 4. OVERDUE READY-FOR-PICKUP PIECES (7+ DAYS)
  const overduePickupPieces = useMemo(() => {
    return pieces
      .filter(p => {
        if (p.status !== 'Ready for Collection') return false;
        
        // Calculate days waiting since ready date or daysElapsed
        const readyDate = p.expectedReadyDate || p.actualReadyDate || p.readyDate || p.dateCreated || todayDateStr;
        let daysWaiting = p.daysElapsed || 0;
        
        if (readyDate) {
          const t1 = new Date(todayDateStr).getTime();
          const t2 = new Date(readyDate.split('T')[0]).getTime();
          if (!isNaN(t1) && !isNaN(t2)) {
            const diffDays = Math.max(0, Math.floor((t1 - t2) / (1000 * 60 * 60 * 24)));
            daysWaiting = Math.max(daysWaiting, diffDays);
          }
        }
        
        return daysWaiting >= 7;
      })
      .map(p => {
        const readyDate = p.expectedReadyDate || p.actualReadyDate || p.readyDate || p.dateCreated || todayDateStr;
        const t1 = new Date(todayDateStr).getTime();
        const t2 = new Date(readyDate.split('T')[0]).getTime();
        let daysWaiting = p.daysElapsed || 7;
        if (!isNaN(t1) && !isNaN(t2)) {
          const diffDays = Math.max(0, Math.floor((t1 - t2) / (1000 * 60 * 60 * 24)));
          daysWaiting = Math.max(daysWaiting, diffDays);
        }
        return {
          ...p,
          daysWaiting
        };
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting);
  }, [pieces, todayDateStr]);

  // Handle Mark Piece as Collected
  const handleMarkCollected = async (pieceId: string, pieceCode: string, customerName: string) => {
    await updatePieceStatus(pieceId, 'Collected', 'Front Desk Admin', 'Customer collected piece in-store.');
    await updatePiece(pieceId, { collectionDate: todayDateStr });
    showToast(`Piece ${pieceCode || pieceId} marked as Collected for ${customerName}!`);
  };

  // Handle Send Pickup Reminder
  const handleSendReminder = async (pieceId: string, pieceCode: string, customerName: string) => {
    await updatePiece(pieceId, { lastNotificationDate: todayDateStr });
    showToast(`Pickup reminder notification sent to ${customerName} for piece ${pieceCode || pieceId}.`);
  };

  // Live Queue & Revenue Metrics
  const metrics = useMemo(() => {
    const inQueueCount = queue.filter(q => (q.status === 'Waiting' || q.status === 'In Progress') && q.date === todayDateStr).length;
    const unpaidBookingsCount = bookings.filter(b => b.paymentStatus === 'Unpaid' && b.status !== 'Cancelled').length;
    const totalRevenue = bookings
      .filter(b => (b.paymentStatus === 'Paid' || b.paymentStatus === 'Deposit Paid') && b.status !== 'Cancelled')
      .reduce((sum, curr) => sum + curr.totalPrice, 0);

    return {
      inQueueCount,
      unpaidBookingsCount,
      totalRevenue
    };
  }, [queue, bookings, todayDateStr]);

  return (
    <div className="p-6 space-y-6 text-left animate-in fade-in duration-300 bg-brand-cream min-h-full">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-brand-charcoal text-brand-cream px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-brand-clay/30 animate-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Riyadh Date Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-brand-clay/70 p-5 rounded-3xl shadow-2xs">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">Admin Operational Dashboard</h1>
          <p className="text-xs text-brand-charcoal/60 mt-0.5">
            Real-time daily management, studio attendance, and pottery collection lifecycle in Riyadh Time (GMT+3).
          </p>
        </div>

        <div className="flex items-center gap-3 bg-brand-sand/50 border border-brand-clay/60 px-4 py-2 rounded-2xl">
          <CalendarDays className="h-4 w-4 text-brand-terracotta" />
          <div className="text-xs">
            <p className="text-[10px] font-bold text-brand-sage uppercase tracking-wider">Operational Riyadh Date</p>
            <p className="font-bold font-mono text-brand-charcoal">{todayDateStr}</p>
          </div>
        </div>
      </div>

      {/* Top 6 High-Level KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Card 1: Today's Active Bookings */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">Today's Bookings</span>
            <div className="p-1.5 rounded-lg bg-brand-terracotta/10 text-brand-terracotta">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-brand-charcoal">{todaysBookings.length}</p>
            <p className="text-[10px] font-semibold text-brand-sage mt-0.5">{todaysTotalParticipants} total participants</p>
          </div>
        </div>

        {/* Card 2: Tomorrow's Active Bookings */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">Tomorrow's Bookings</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <CalendarDays className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-brand-charcoal">{tomorrowsBookings.length}</p>
            <p className="text-[10px] font-semibold text-blue-600 mt-0.5">{tomorrowsTotalParticipants} scheduled guests</p>
          </div>
        </div>

        {/* Card 3: Monthly Birthday Packages */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">Birthdays This Month</span>
            <div className="p-1.5 rounded-lg bg-pink-50 text-pink-600">
              <Cake className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-pink-700">{monthlyBirthdayBookings.length}</p>
            <p className="text-[10px] font-semibold text-pink-600 mt-0.5">{currentRiyadhMonth} reservations</p>
          </div>
        </div>

        {/* Card 4: Awaiting Pickup 7+ Days */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">Overdue Pickup (7d+)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Box className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-2xl font-bold ${overduePickupPieces.length > 0 ? 'text-amber-700' : 'text-brand-charcoal'}`}>
              {overduePickupPieces.length}
            </p>
            <p className="text-[10px] font-semibold text-amber-800 mt-0.5">Shelved & ready 7+ days</p>
          </div>
        </div>

        {/* Card 5: In Live Queue Now */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">In Live Queue</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ListOrdered className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-emerald-700">{metrics.inQueueCount}</p>
            <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">Walk-in studio guests</p>
          </div>
        </div>

        {/* Card 6: Total Recorded Revenue */}
        <div className="bg-white border border-brand-clay/70 p-4 rounded-2xl shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-charcoal/60 uppercase">Recorded Revenue</span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-purple-800">{metrics.totalRevenue} SAR</p>
            <p className="text-[10px] font-semibold text-purple-600 mt-0.5">Paid & deposits</p>
          </div>
        </div>

      </div>

      {/* =========================================================
          SECTION 1: TODAY'S BOOKINGS
          ========================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-terracotta/10 rounded-xl text-brand-terracotta">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-brand-charcoal">Today's Bookings</h2>
              <p className="text-xs text-brand-charcoal/60">
                Scheduled workshops, special events, and birthday package reservations for today ({todayDateStr}).
              </p>
            </div>
          </div>

          <button
            onClick={() => setAdminTab('bookings')}
            className="text-xs font-bold text-brand-terracotta hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Manage All Bookings</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {todaysBookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-charcoal/50 italic bg-brand-cream/30 rounded-2xl border border-dashed border-brand-clay">
            No active bookings scheduled for today ({todayDateStr}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-clay/60 text-brand-charcoal/50 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Booking Type</th>
                  <th className="py-2.5 px-3">Workshop / Event Title</th>
                  <th className="py-2.5 px-3">Guests</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30 font-medium">
                {todaysBookings.map(b => (
                  <tr key={b.id} className="hover:bg-brand-sand/15 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-brand-terracotta">{b.time}</td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{b.customerName}</td>
                    <td className="py-3 px-3 font-mono text-brand-charcoal/80">{b.customerPhone}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        b.workshopId === 'birthday-party-event' || b.workshopTitle.toLowerCase().includes('birthday') ? 'bg-pink-50 text-pink-800 border-pink-200' :
                        b.workshopTitle.toLowerCase().includes('event') ? 'bg-purple-50 text-purple-800 border-purple-200' :
                        'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {b.workshopId === 'birthday-party-event' || b.workshopTitle.toLowerCase().includes('birthday') ? 'Birthday Package' :
                         b.workshopTitle.toLowerCase().includes('event') ? 'Event' : 'Workshop'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{b.workshopTitle}</td>
                    <td className="py-3 px-3 font-mono">{b.participants} guest(s)</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        b.paymentStatus === 'Paid' || b.paymentStatus === 'Deposit Paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        b.status === 'Checked In' || b.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setAdminTab('bookings')}
                        className="bg-brand-sand border border-brand-clay/60 text-brand-charcoal px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-brand-clay/40 transition-all cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 2: TOMORROW'S BOOKINGS
          ========================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-brand-charcoal">Tomorrow's Bookings</h2>
              <p className="text-xs text-brand-charcoal/60">
                Advance reservations scheduled for tomorrow ({tomorrowDateStr}).
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-xl">
            {tomorrowsBookings.length} sessions booked ({tomorrowsTotalParticipants} guests)
          </span>
        </div>

        {tomorrowsBookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-charcoal/50 italic bg-brand-cream/30 rounded-2xl border border-dashed border-brand-clay">
            No bookings scheduled for tomorrow ({tomorrowDateStr}) yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-clay/60 text-brand-charcoal/50 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Booking Type</th>
                  <th className="py-2.5 px-3">Workshop / Event Title</th>
                  <th className="py-2.5 px-3">Guests</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30 font-medium">
                {tomorrowsBookings.map(b => (
                  <tr key={b.id} className="hover:bg-brand-sand/15 transition-colors">
                    <td className="py-3 px-3">
                      <p className="font-bold text-brand-charcoal">{b.date}</p>
                      <p className="font-mono text-[10px] text-brand-terracotta font-bold">{b.time}</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{b.customerName}</td>
                    <td className="py-3 px-3 font-mono text-brand-charcoal/80">{b.customerPhone}</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {b.workshopTitle.toLowerCase().includes('birthday') ? 'Birthday Package' : 'Workshop'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{b.workshopTitle}</td>
                    <td className="py-3 px-3 font-mono">{b.participants} guest(s)</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        b.paymentStatus === 'Paid' || b.paymentStatus === 'Deposit Paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setAdminTab('bookings')}
                        className="bg-brand-sand border border-brand-clay/60 text-brand-charcoal px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-brand-clay/40 transition-all cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 3: BIRTHDAY BOOKINGS THIS MONTH
          ========================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
              <Cake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-brand-charcoal">Birthday Package Reservations ({currentRiyadhMonth})</h2>
              <p className="text-xs text-brand-charcoal/60">
                All confirmed birthday celebration bookings scheduled for this month.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-pink-700 bg-pink-50 border border-pink-200 px-3 py-1 rounded-xl">
            {monthlyBirthdayBookings.length} birthday events
          </span>
        </div>

        {monthlyBirthdayBookings.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-charcoal/50 italic bg-brand-cream/30 rounded-2xl border border-dashed border-brand-clay">
            No birthday packages are booked for this month ({currentRiyadhMonth}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-clay/60 text-brand-charcoal/50 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Session Date & Time</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Contact Phone</th>
                  <th className="py-2.5 px-3">Birthday Package Name</th>
                  <th className="py-2.5 px-3">Guests</th>
                  <th className="py-2.5 px-3">Deposit / Price</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30 font-medium">
                {monthlyBirthdayBookings.map(b => (
                  <tr key={b.id} className="hover:bg-brand-sand/15 transition-colors">
                    <td className="py-3 px-3">
                      <p className="font-bold text-brand-charcoal">{b.date}</p>
                      <p className="font-mono text-[10px] text-pink-600 font-bold">{b.time}</p>
                    </td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{b.customerName}</td>
                    <td className="py-3 px-3 font-mono text-brand-charcoal/80">{b.customerPhone}</td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal flex items-center gap-1.5">
                      <Cake className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                      <span>{b.workshopTitle}</span>
                    </td>
                    <td className="py-3 px-3 font-mono">{b.participants} guests</td>
                    <td className="py-3 px-3 font-bold text-emerald-800">{b.totalPrice} SAR</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                        b.paymentStatus === 'Paid' || b.paymentStatus === 'Deposit Paid' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                        'bg-red-50 text-red-800 border-red-200'
                      }`}>
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-pink-50 text-pink-800 border border-pink-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => setAdminTab('bookings')}
                        className="bg-brand-sand border border-brand-clay/60 text-brand-charcoal px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-brand-clay/40 transition-all cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================
          SECTION 4: AWAITING PICKUP FOR 7+ DAYS
          ========================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-brand-charcoal">Pottery Awaiting Pickup for 7+ Days</h2>
              <p className="text-xs text-brand-charcoal/60">
                Pieces in "Ready for Collection" status that have been waiting on storage shelves for 7 days or longer.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
            {overduePickupPieces.length} items overdue
          </span>
        </div>

        {overduePickupPieces.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-charcoal/50 italic bg-brand-cream/30 rounded-2xl border border-dashed border-brand-clay">
            🎉 Excellent! No pottery pieces are currently overdue for collection (7+ days).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-brand-clay/60 text-brand-charcoal/50 uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Piece Code</th>
                  <th className="py-2.5 px-3">Pottery Item</th>
                  <th className="py-2.5 px-3">Customer Name</th>
                  <th className="py-2.5 px-3">Contact Phone</th>
                  <th className="py-2.5 px-3">Ready Date</th>
                  <th className="py-2.5 px-3">Days Waiting</th>
                  <th className="py-2.5 px-3">Last Reminder</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30 font-medium">
                {overduePickupPieces.map(p => (
                  <tr key={p.id} className="hover:bg-brand-sand/15 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-brand-terracotta">{p.pieceCode || p.id}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="h-9 w-9 rounded-lg object-cover border border-brand-clay shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-brand-terracotta/10 border border-brand-terracotta/20 flex items-center justify-center text-brand-terracotta shrink-0">
                            <Box className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-brand-charcoal">{p.name}</p>
                          <p className="text-[10px] text-brand-charcoal/50">{p.workshopName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-brand-charcoal">{p.customerName}</td>
                    <td className="py-3 px-3 font-mono text-brand-charcoal/80">{p.customerPhone}</td>
                    <td className="py-3 px-3 font-mono text-brand-charcoal/70">
                      {p.expectedReadyDate || p.actualReadyDate || p.readyDate || p.dateCreated || todayDateStr}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {p.daysWaiting} days waiting
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-brand-charcoal/60">
                      {p.lastNotificationDate || 'No reminder sent'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSendReminder(p.id, p.pieceCode || p.id, p.customerName)}
                          className="bg-brand-sand border border-brand-clay/70 text-brand-charcoal hover:bg-brand-clay/30 px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Bell className="h-3 w-3 text-amber-600" />
                          <span>Send Reminder</span>
                        </button>

                        <button
                          onClick={() => handleMarkCollected(p.id, p.pieceCode || p.id, p.customerName)}
                          className="bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Mark Collected</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
