/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from './context/AppContext';
import { CustomerHeader, CustomerFooter } from './components/CustomerHeader';
import { HomeSection } from './components/HomeSection';
import { WorkshopsBrowsingSection } from './components/WorkshopsBrowsingSection';
import { WorkshopDetailSection } from './components/WorkshopDetailSection';
import { CheckoutInfoSection } from './components/CheckoutInfoSection';
import { CheckoutPaymentSection } from './components/CheckoutPaymentSection';
import { BookingConfirmationSection } from './components/BookingConfirmationSection';
import { MyBookingsSection } from './components/MyBookingsSection';
import { AuthSection } from './components/AuthSection';
import { BirthdayBookingSection } from './components/BirthdayBookingSection';
import { MyPiecesSection } from './components/MyPiecesSection';

import { AdminSidebar, AdminTopBar } from './components/AdminSidebar';
import { AdminDashboardSection } from './components/AdminDashboardSection';
import { LiveQueueSection } from './components/LiveQueueSection';
import { AdminBookingsSection } from './components/AdminBookingsSection';
import { AdminWorkshopFormSection } from './components/AdminWorkshopFormSection';
import { AdminEventsSection } from './components/AdminEventsSection';
import { AdminPiecesTrackingSection } from './components/AdminPiecesTrackingSection';
import { AdminCustomersSection } from './components/AdminCustomersSection';
import { AdminStaffSection } from './components/AdminStaffSection';
import { SystemHealthSection } from './components/SystemHealthSection';
import { AdminSettingsSection } from './components/AdminSettingsSection';

import { Sparkles, ArrowRightLeft } from 'lucide-react';

export default function App() {
  const { perspective, setPerspective, customerTab, adminTab } = useApp();

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-charcoal flex flex-col justify-between selection:bg-brand-terracotta/20">
      
      {/* PERSPECTIVE SWITCHER TOOLBAR (Floating Demo utility for easy preview) */}
      <div className="bg-brand-charcoal text-brand-cream border-b border-brand-clay/10 py-1.5 px-4 text-[11px] font-bold flex justify-between items-center z-50 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-brand-terracotta" />
          <span>Arty Café Live Mock Environment</span>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-brand-cream/60">Current Perspective:</span>
          <div className="flex bg-brand-cream/10 p-0.5 rounded-lg border border-brand-cream/15 font-semibold">
            <button
              onClick={() => setPerspective('customer')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                perspective === 'customer' 
                  ? 'bg-brand-terracotta text-brand-cream shadow-xs' 
                  : 'text-brand-cream/65 hover:text-brand-cream'
              }`}
            >
              Customer Site
            </button>
            <button
              onClick={() => setPerspective('admin')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                perspective === 'admin' 
                  ? 'bg-brand-terracotta text-brand-cream shadow-xs' 
                  : 'text-brand-cream/65 hover:text-brand-cream'
              }`}
            >
              Staff Console
            </button>
          </div>
        </div>
      </div>

      {/* PERSPECTIVE SWITCHED ROUTER FRAME */}
      {perspective === 'customer' ? (
        
        /* 1. CUSTOMER PERSPECTIVE FRAME */
        <div className="flex flex-col flex-1 justify-between min-h-[calc(100vh-32px)]">
          <CustomerHeader />
          
          <main className="flex-1 w-full bg-brand-cream">
            {customerTab === 'home' && <HomeSection />}
            {customerTab === 'workshops' && <WorkshopsBrowsingSection />}
            {customerTab === 'detail' && <WorkshopDetailSection />}
            {customerTab === 'checkout-info' && <CheckoutInfoSection />}
            {customerTab === 'checkout-payment' && <CheckoutPaymentSection />}
            {customerTab === 'confirmation' && <BookingConfirmationSection />}
            {customerTab === 'my-bookings' && <MyBookingsSection />}
            {customerTab === 'my-pieces' && <MyPiecesSection />}
            {customerTab === 'auth' && <AuthSection />}
            {customerTab === 'birthday-booking' && <BirthdayBookingSection />}
          </main>

          <CustomerFooter />
        </div>
      ) : (
        
        /* 2. ADMIN CONSOLE PERSPECTIVE FRAME */
        <div className="flex flex-1 min-h-[calc(100vh-32px)] overflow-hidden">
          <AdminSidebar />
          
          <div className="flex-1 flex flex-col overflow-y-auto min-h-screen bg-brand-cream">
            <AdminTopBar />
            
            <main className="flex-1">
              {adminTab === 'dashboard' && <AdminDashboardSection />}
              {adminTab === 'queue' && <LiveQueueSection />}
              {adminTab === 'customers' && <AdminCustomersSection />}
              {adminTab === 'staff' && <AdminStaffSection />}
              {adminTab === 'bookings' && <AdminBookingsSection />}
              {adminTab === 'workshops-admin' && <AdminWorkshopFormSection />}
              {adminTab === 'events-admin' && <AdminEventsSection />}
              {adminTab === 'pieces-admin' && <AdminPiecesTrackingSection />}
              {adminTab === 'system-health' && <SystemHealthSection />}
              {adminTab === 'settings' && <AdminSettingsSection />}
            </main>
          </div>
        </div>
      )}

    </div>
  );
}
