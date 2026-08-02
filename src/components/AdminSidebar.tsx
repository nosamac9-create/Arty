/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, Users, CalendarDays, Palette, ListOrdered, 
  Flame, HelpCircle, ChevronLeft, ChevronRight, Menu, LogOut, ShieldAlert, Settings, Sparkles, UserCheck
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const { adminTab, setAdminTab, setPerspective } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'queue', label: 'Live Queue', icon: ListOrdered },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'staff', label: 'Staff Management', icon: UserCheck },
    { id: 'bookings', label: 'Bookings', icon: CalendarDays },
    { id: 'workshops-admin', label: 'Workshops', icon: Palette },
    { id: 'events-admin', label: 'Events & Socials', icon: Sparkles },
    { id: 'pieces-admin', label: 'Pottery Pieces', icon: Flame },
    { id: 'system-health', label: 'System Health', icon: ShieldAlert },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <aside 
      className={`bg-brand-charcoal text-brand-cream border-r border-brand-clay/10 flex flex-col justify-between transition-all duration-300 shrink-0 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex-1">
        {/* Header Branding */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-brand-clay/15">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-terracotta text-brand-cream">
              <Palette className="h-4.5 w-4.5" />
            </div>
            {!collapsed && (
              <div className="text-left animate-in fade-in duration-200">
                <span className="font-display text-sm font-bold block">Arty Portal</span>
                <span className="text-[9px] text-brand-sage uppercase font-bold tracking-wider block">Staff Console</span>
              </div>
            )}
          </div>

          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-brand-sand/15 rounded-lg text-brand-cream/60 hover:text-brand-cream focus:outline-none"
          >
            {collapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = adminTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setAdminTab(item.id)}
                className={`flex items-center w-full rounded-xl p-3 text-sm font-semibold transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-brand-terracotta text-brand-cream shadow-sm' 
                    : 'text-brand-cream/70 hover:text-brand-cream hover:bg-brand-sand/10'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-brand-cream' : 'text-brand-sage'}`} />
                {!collapsed && <span className="ml-3 text-left leading-none">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Back to Customer site */}
      <div className="p-3 border-t border-brand-clay/10 space-y-1">
        <button
          onClick={() => setPerspective('customer')}
          className="flex items-center w-full rounded-xl p-3 text-xs font-bold text-brand-cream/70 hover:text-brand-cream hover:bg-brand-terracotta/20 transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0 text-brand-terracotta" />
          {!collapsed && <span className="ml-3 text-left">Customer Site</span>}
        </button>
      </div>
    </aside>
  );
};

export const AdminTopBar: React.FC = () => {
  const { currentUser, notifications, clearAllNotifications, formattedTodayDate } = useApp();
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const staffNotifs = useMemo(() => {
    return notifications
      .filter(n => n.type === 'staff')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications]);

  const unreadCount = staffNotifs.length;

  return (
    <header className="h-16 border-b border-brand-clay bg-brand-cream flex items-center justify-between px-6 shrink-0 text-left relative">
      {/* Current date and quick search */}
      <div className="flex items-center gap-6">
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-brand-sage uppercase tracking-wider">Today's Timeline</p>
          <p className="text-sm font-bold text-brand-charcoal">{formattedTodayDate}</p>
        </div>
        
        {/* Quick Admin Search Bar */}
        <div className="relative max-w-xs">
          <input
            type="search"
            placeholder="Search bookings, pieces, phone..."
            className="w-48 sm:w-64 bg-brand-sand/50 border border-brand-clay rounded-xl py-1.5 pl-3 pr-8 text-xs font-semibold text-brand-charcoal placeholder-brand-charcoal/40"
          />
        </div>
      </div>

      {/* Right User block */}
      <div className="flex items-center gap-4">
        {/* Notification indicator */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="p-1.5 text-brand-charcoal/70 hover:text-brand-terracotta hover:bg-brand-sand rounded-xl relative focus:outline-none cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-brand-terracotta text-brand-cream text-[9px] font-bold flex items-center justify-center ring-2 ring-brand-cream">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-brand-clay rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-brand-clay/60 pb-2">
                <span className="text-xs font-bold text-brand-charcoal uppercase tracking-wider">Staff Activity Log ({unreadCount})</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={async () => {
                      await clearAllNotifications('staff');
                    }}
                    className="text-[10px] font-bold text-brand-terracotta hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2.5 no-scrollbar">
                {staffNotifs.length === 0 ? (
                  <p className="text-[11px] text-brand-charcoal/40 text-center py-6 italic font-medium">No recent piece status updates.</p>
                ) : (
                  staffNotifs.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-2.5 rounded-xl text-[11px] leading-snug border transition-all ${
                        n.highlighted 
                          ? 'bg-amber-50/75 border-amber-300 text-amber-900 ring-2 ring-amber-400/20 shadow-xs' 
                          : 'bg-brand-cream/35 border-brand-clay/60 text-brand-charcoal'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-brand-terracotta font-mono text-[9px]">{n.pieceId}</span>
                        <span className="text-[9px] text-brand-charcoal/45 font-semibold">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-semibold text-brand-charcoal/90">{n.message}</p>
                      {n.highlighted && (
                        <span className="inline-block mt-1 text-[9px] uppercase font-bold text-brand-terracotta bg-brand-terracotta/10 px-1.5 py-0.5 rounded">
                          📢 Pickup Alert Dispatched
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Staff User profile block */}
        <div className="flex items-center gap-2 border-l border-brand-clay pl-4">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"
            alt="Staff Profile"
            className="h-8 w-8 rounded-full object-cover border border-brand-clay shadow-2xs"
            referrerPolicy="no-referrer"
          />
          <div className="hidden md:block">
            <p className="text-xs font-bold text-brand-charcoal">Lina Al-Sudais</p>
            <p className="text-[9px] font-bold text-brand-sage uppercase tracking-wider">Studio Manager</p>
          </div>
        </div>
      </div>
    </header>
  );
};
