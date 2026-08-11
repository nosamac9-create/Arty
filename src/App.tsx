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
import { ResetPasswordSection } from './components/ResetPasswordSection';
import { MigrationWarning } from './components/MigrationWarning';

import { AdminSidebar, AdminTopBar } from './components/AdminSidebar';
import { AdminLoginSection } from './components/AdminLoginSection';
import { StaffPasswordChangeSection } from './components/StaffPasswordChangeSection';
import { firstAllowedPage, getPageLabel } from './utils/adminAccess';

/** Shown when a signed-in account opens a page it is not authorized for. */
const AdminAccessDenied: React.FC<{ pageId: string }> = ({ pageId }) => (
  <div className="p-10 flex items-center justify-center">
    <div className="max-w-md w-full bg-white border border-brand-clay rounded-3xl p-8 text-center space-y-3 shadow-sm">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
        <span className="text-xl font-bold">!</span>
      </div>
      <h2 className="font-display text-xl font-bold text-brand-charcoal">Access restricted</h2>
      <p className="text-xs text-brand-charcoal/65 leading-relaxed">
        Your account does not have permission to open <strong>{getPageLabel(pageId)}</strong>.
        Ask a Super Admin to grant it in Settings → Staff Registry.
      </p>
    </div>
  </div>
);
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


export default function App() {
  const {
    area, customerTab, adminTab, setAdminTab,
    currentStaff, staffAuthChecked, canAccessAdminPage
  } = useApp();

  // Land on, and stay on, a page this account is allowed to open.
  React.useEffect(() => {
    if (!currentStaff) return;
    if (canAccessAdminPage(adminTab)) return;
    const landing = firstAllowedPage(currentStaff);
    if (landing && landing !== adminTab) setAdminTab(landing);
  }, [currentStaff, adminTab]);

  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-charcoal flex flex-col justify-between selection:bg-brand-terracotta/20">

      {/* Names any migration that has not been applied, rather than letting it
          surface later as an unrelated failure. */}
      <MigrationWarning />
      
      {/* AREA ROUTER
          The customer site is the default area and is open to everyone. The
          staff console is a separate area: it is only ever mounted for a
          signed-in staff account. */}
      {area === 'customer' ? (
        
        /* 1. CUSTOMER SITE */
        <div className="flex flex-col flex-1 justify-between min-h-screen">
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
            {customerTab === 'reset-password' && <ResetPasswordSection />}
            {customerTab === 'birthday-booking' && <BirthdayBookingSection />}
          </main>

          <CustomerFooter />
        </div>
      ) : (
        
        /* 2. STAFF CONSOLE — guarded */
        !staffAuthChecked ? (
          <div className="flex-1 flex items-center justify-center bg-brand-cream text-xs font-bold text-brand-charcoal/50">
            Checking your session…
          </div>
        ) : !currentStaff ? (
          /* No console session: the login screen is the only thing rendered, so
             protected pages are never mounted for an unauthenticated visitor. */
          <AdminLoginSection />
        ) : currentStaff.passwordIsTemporary ? (
          /* Signed in, but still on the provisioned password. The console is
             not mounted until it is replaced. */
          <StaffPasswordChangeSection />
        ) : (
        <div className="flex flex-1 min-h-screen overflow-hidden">
          <AdminSidebar />
          
          <div className="flex-1 flex flex-col overflow-y-auto min-h-screen bg-brand-cream">
            <AdminTopBar />
            
            <main className="flex-1">
              {/* Every page is gated: the component is not rendered at all unless
                  the signed-in account is authorized for it. */}
              {!canAccessAdminPage(adminTab) ? (
                <AdminAccessDenied pageId={adminTab} />
              ) : (
                <>
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
                </>
              )}
            </main>
          </div>
        </div>
        )
      )}

    </div>
  );
}
