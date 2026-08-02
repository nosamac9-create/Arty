import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { AppEvent, Booking } from '../types';
import { 
  Sparkles, Calendar, Clock, User, Save, Search, Filter, CheckCircle2, 
  Package, Users, Phone, Mail, DollarSign, AlertCircle, X, ShieldAlert 
} from 'lucide-react';

export const AdminEventsSection: React.FC = () => {
  const { cancelBooking } = useApp();

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Package 01 Form State
  const [pkg1Title, setPkg1Title] = useState('Package 01 — Canvas & Create');
  const [pkg1Price, setPkg1Price] = useState<number>(165);
  const [pkg1Deposit, setPkg1Deposit] = useState<number>(500);
  const [pkg1Capacity, setPkg1Capacity] = useState<number>(10);
  const [pkg1ShortDesc, setPkg1ShortDesc] = useState('Pre-sketched Canvas, Acrylic Painting, Balloons & Studio Decor.');
  const [pkg1FullDetails, setPkg1FullDetails] = useState('Includes 2 hours of private studio space, pre-sketched canvas per child, acrylic paints, brushes, easel, balloon decoration, and fresh juices.');
  const [pkg1Image, setPkg1Image] = useState('https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80');
  const [pkg1Status, setPkg1Status] = useState<'Published' | 'Draft'>('Published');

  // Package 02 Form State
  const [pkg2Title, setPkg2Title] = useState('Package 02 — Pottery Party');
  const [pkg2Price, setPkg2Price] = useState<number>(200);
  const [pkg2Deposit, setPkg2Deposit] = useState<number>(500);
  const [pkg2Capacity, setPkg2Capacity] = useState<number>(10);
  const [pkg2ShortDesc, setPkg2ShortDesc] = useState('Handbuilding Clay, Underglazing, Firing Service & Studio Decor.');
  const [pkg2FullDetails, setPkg2FullDetails] = useState('Includes 2.5 hours of private studio space, clay play & sculpting experience, ceramic underglazes, kiln firing for all created pieces, balloon decoration, and specialty beverages.');
  const [pkg2Image, setPkg2Image] = useState('https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80');
  const [pkg2Status, setPkg2Status] = useState<'Published' | 'Draft'>('Published');

  // Load Package 01 and Package 02 from Dexie db.events on mount
  useEffect(() => {
    const loadPackages = async () => {
      try {
        const p1 = await db.events.get('pkg-1');
        if (p1) {
          setPkg1Title(p1.title);
          setPkg1Price(p1.price);
          setPkg1Capacity(p1.capacity);
          setPkg1ShortDesc(p1.shortDescription);
          setPkg1FullDetails(p1.fullDetails);
          setPkg1Image(p1.image);
          setPkg1Status(p1.status === 'Draft' ? 'Draft' : 'Published');
        }

        const p2 = await db.events.get('pkg-2');
        if (p2) {
          setPkg2Title(p2.title);
          setPkg2Price(p2.price);
          setPkg2Capacity(p2.capacity);
          setPkg2ShortDesc(p2.shortDescription);
          setPkg2FullDetails(p2.fullDetails);
          setPkg2Image(p2.image);
          setPkg2Status(p2.status === 'Draft' ? 'Draft' : 'Published');
        }
      } catch (err) {
        console.error('Error loading packages:', err);
      }
    };
    loadPackages();
  }, []);

  // Save Handlers
  const handleSavePackage1 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pkg1Data: AppEvent = {
        id: 'pkg-1',
        title: pkg1Title,
        category: 'Birthday & Socials',
        eventType: 'Package 01',
        shortDescription: pkg1ShortDesc,
        fullDetails: pkg1FullDetails,
        image: pkg1Image,
        date: new Date().toISOString().split('T')[0],
        startTime: '04:00 PM',
        duration: '2.0 Hours',
        capacity: pkg1Capacity,
        spotsLeft: pkg1Capacity,
        price: pkg1Price,
        host: 'Studio Staff',
        location: 'Main Lounge',
        ageRequirement: '4+ years',
        skillLevel: 'All Levels',
        status: pkg1Status
      };
      await db.events.put(pkg1Data);
      showToast('Package 01 information saved successfully!');
    } catch (err) {
      console.error('Error saving Package 01:', err);
    }
  };

  const handleSavePackage2 = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pkg2Data: AppEvent = {
        id: 'pkg-2',
        title: pkg2Title,
        category: 'Birthday & Socials',
        eventType: 'Package 02',
        shortDescription: pkg2ShortDesc,
        fullDetails: pkg2FullDetails,
        image: pkg2Image,
        date: new Date().toISOString().split('T')[0],
        startTime: '04:00 PM',
        duration: '2.5 Hours',
        capacity: pkg2Capacity,
        spotsLeft: pkg2Capacity,
        price: pkg2Price,
        host: 'Studio Staff',
        location: 'The Handcraft Lounge',
        ageRequirement: '6+ years',
        skillLevel: 'All Levels',
        status: pkg2Status
      };
      await db.events.put(pkg2Data);
      showToast('Package 02 information saved successfully!');
    } catch (err) {
      console.error('Error saving Package 02:', err);
    }
  };

  // Live Query Bookings for Customer Table
  const liveBookings = useLiveQuery(() => db.bookings.toArray()) || [];

  // Table Filters & Search & Pagination
  const [tableSearch, setTableSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter event bookings
  const eventBookings = useMemo(() => {
    return liveBookings.filter(b => {
      const wTitle = (b.workshopTitle || '').toLowerCase();
      // Check if this booking is for Package 01, Package 02, or any Birthday/Event
      const isEventBooking = 
        b.workshopId === 'birthday-party-event' ||
        wTitle.includes('package') ||
        wTitle.includes('option') ||
        wTitle.includes('birthday') ||
        wTitle.includes('party') ||
        wTitle.includes('event') ||
        wTitle.includes('social');

      if (!isEventBooking) return false;

      const q = tableSearch.toLowerCase();
      const matchesSearch = 
        (b.id || '').toLowerCase().includes(q) ||
        (b.customerName || '').toLowerCase().includes(q) ||
        (b.customerPhone || '').toLowerCase().includes(q) ||
        (b.customerEmail || '').toLowerCase().includes(q) ||
        wTitle.includes(q);

      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [liveBookings, tableSearch, statusFilter]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tableSearch, statusFilter]);

  const totalEventPages = Math.max(1, Math.ceil(eventBookings.length / ITEMS_PER_PAGE));
  const paginatedEventBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return eventBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [eventBookings, currentPage]);

  // Handle Cancel Booking from Table
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  const confirmCancel = async (id: string) => {
    await cancelBooking(id, 'Staff', 'Refunded');
    setCancellingBookingId(null);
    showToast(`Booking ${id} has been cancelled.`);
  };

  return (
    <div className="space-y-8 text-left pb-12 animate-in fade-in duration-300">
      
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-brand-cream border border-brand-clay p-6 rounded-3xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-brand-terracotta" />
            <span className="text-xs font-bold uppercase tracking-wider text-brand-terracotta">Events & Socials Console</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">Package 01 & Package 02 Management</h1>
          <p className="text-xs text-brand-charcoal/60 mt-0.5">Edit celebration package offerings and view all customer event reservations.</p>
        </div>
      </div>

      {/* ========================================================== */}
      {/* ================= SECTION 1: PACKAGE EDITORS ============= */}
      {/* ========================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ------------ PACKAGE 01 CARD ------------ */}
        <div className="bg-white border-2 border-brand-clay rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-brand-clay/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-brand-terracotta/10 text-brand-terracotta flex items-center justify-center font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-brand-charcoal">Package 01 Details</h2>
                  <span className="text-[10px] font-bold text-brand-charcoal/50">Canvas & Painting Celebrations</span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                pkg1Status === 'Published' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {pkg1Status}
              </span>
            </div>

            <form id="pkg1-form" onSubmit={handleSavePackage1} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Package Name / Title *
                </label>
                <input
                  type="text"
                  value={pkg1Title}
                  onChange={e => setPkg1Title(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  required
                />
              </div>

              {/* Price & Deposit & Capacity */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Price / Guest (SAR)
                  </label>
                  <input
                    type="number"
                    value={pkg1Price}
                    onChange={e => setPkg1Price(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Required Deposit (SAR)
                  </label>
                  <input
                    type="number"
                    value={pkg1Deposit}
                    onChange={e => setPkg1Deposit(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Min Capacity / Guests
                  </label>
                  <input
                    type="number"
                    value={pkg1Capacity}
                    onChange={e => setPkg1Capacity(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={pkg1ShortDesc}
                  onChange={e => setPkg1ShortDesc(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-semibold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                />
              </div>

              {/* Full Details */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Full Details & Inclusions
                </label>
                <textarea
                  rows={3}
                  value={pkg1FullDetails}
                  onChange={e => setPkg1FullDetails(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                />
              </div>

              {/* Image URL & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Cover Image URL
                  </label>
                  <input
                    type="url"
                    value={pkg1Image}
                    onChange={e => setPkg1Image(e.target.value)}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-mono text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Status
                  </label>
                  <select
                    value={pkg1Status}
                    onChange={e => setPkg1Status(e.target.value as any)}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="pkg1-form"
            className="cursor-pointer w-full py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save Package 01 Info</span>
          </button>
        </div>

        {/* ------------ PACKAGE 02 CARD ------------ */}
        <div className="bg-white border-2 border-brand-clay rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-brand-clay/60">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-brand-sage/20 text-brand-sage flex items-center justify-center font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-brand-charcoal">Package 02 Details</h2>
                  <span className="text-[10px] font-bold text-brand-charcoal/50">Pottery & Clay Parties</span>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                pkg2Status === 'Published' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {pkg2Status}
              </span>
            </div>

            <form id="pkg2-form" onSubmit={handleSavePackage2} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Package Name / Title *
                </label>
                <input
                  type="text"
                  value={pkg2Title}
                  onChange={e => setPkg2Title(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  required
                />
              </div>

              {/* Price & Deposit & Capacity */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Price / Guest (SAR)
                  </label>
                  <input
                    type="number"
                    value={pkg2Price}
                    onChange={e => setPkg2Price(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Required Deposit (SAR)
                  </label>
                  <input
                    type="number"
                    value={pkg2Deposit}
                    onChange={e => setPkg2Deposit(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Min Capacity / Guests
                  </label>
                  <input
                    type="number"
                    value={pkg2Capacity}
                    onChange={e => setPkg2Capacity(Number(e.target.value))}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                    required
                  />
                </div>
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={pkg2ShortDesc}
                  onChange={e => setPkg2ShortDesc(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-semibold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                />
              </div>

              {/* Full Details */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                  Full Details & Inclusions
                </label>
                <textarea
                  rows={3}
                  value={pkg2FullDetails}
                  onChange={e => setPkg2FullDetails(e.target.value)}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                />
              </div>

              {/* Image URL & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Cover Image URL
                  </label>
                  <input
                    type="url"
                    value={pkg2Image}
                    onChange={e => setPkg2Image(e.target.value)}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-mono text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1">
                    Status
                  </label>
                  <select
                    value={pkg2Status}
                    onChange={e => setPkg2Status(e.target.value as any)}
                    className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl p-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
                  >
                    <option value="Published">Published</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>
            </form>
          </div>

          <button
            type="submit"
            form="pkg2-form"
            className="cursor-pointer w-full py-3 bg-brand-sage hover:bg-brand-sage-hover text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save Package 02 Info</span>
          </button>
        </div>

      </div>

      {/* ========================================================== */}
      {/* ================= SECTION 2: BOOKED CUSTOMERS TABLE ====== */}
      {/* ========================================================== */}
      <div className="bg-white border-2 border-brand-clay rounded-3xl p-6 shadow-xs space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-clay/60">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-terracotta" />
              <span>Customer Event & Package Bookings</span>
            </h2>
            <p className="text-xs text-brand-charcoal/60 mt-0.5">List of all customers who reserved Package 01, Package 02, or private events.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-brand-sand px-3 py-1 rounded-full text-xs font-bold text-brand-charcoal">
              {eventBookings.length} Total Reservations
            </span>
          </div>
        </div>

        {/* Table Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-brand-charcoal/40" />
            <input
              type="text"
              placeholder="Search by customer name, phone, email, or booking ref..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-brand-charcoal/50" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-brand-sand/20 border border-brand-clay/80 rounded-xl px-3 py-2.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Checked In">Checked In</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto rounded-2xl border border-brand-clay/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-brand-sand/40 border-b border-brand-clay/60 font-bold uppercase text-brand-charcoal/70 tracking-wider">
              <tr>
                <th className="p-3.5">Booking Ref</th>
                <th className="p-3.5">Customer Details</th>
                <th className="p-3.5">Event / Package</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Guests</th>
                <th className="p-3.5">Price & Payment</th>
                <th className="p-3.5">Booking Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-clay/30 font-medium text-brand-charcoal">
              {eventBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-brand-charcoal/50 bg-brand-cream/30">
                    No customer event bookings found.
                  </td>
                </tr>
              ) : (
                paginatedEventBookings.map(b => (
                  <tr key={b.id} className="hover:bg-brand-sand/20 transition-colors">
                    {/* Booking Ref */}
                    <td className="p-3.5 font-mono font-bold text-brand-terracotta">
                      {b.id}
                    </td>

                    {/* Customer Info */}
                    <td className="p-3.5">
                      <div className="font-bold text-brand-charcoal">{b.customerName}</div>
                      <div className="text-[10px] text-brand-charcoal/60 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        <span>{b.customerPhone}</span>
                      </div>
                      {b.customerEmail && (
                        <div className="text-[10px] text-brand-charcoal/50 font-mono truncate max-w-[150px]">
                          {b.customerEmail}
                        </div>
                      )}
                    </td>

                    {/* Booked Package / Event */}
                    <td className="p-3.5">
                      <span className="font-bold text-brand-charcoal block">{b.workshopTitle}</span>
                      <span className="text-[10px] text-brand-charcoal/50 uppercase font-bold">
                        Source: {b.source || 'Website'}
                      </span>
                    </td>

                    {/* Date & Time */}
                    <td className="p-3.5">
                      <div className="font-bold">{b.date}</div>
                      <div className="text-[10px] text-brand-charcoal/60 font-mono">{b.time}</div>
                    </td>

                    {/* Guests */}
                    <td className="p-3.5 font-bold">
                      {b.participants} Guests
                    </td>

                    {/* Price & Payment Status */}
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-brand-charcoal">{b.totalPrice} SAR</div>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold mt-1 ${
                        b.paymentStatus === 'Paid' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : b.paymentStatus === 'Refunded'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.paymentStatus}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="p-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        b.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : b.status === 'Checked In'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : b.status === 'Cancelled'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {b.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="p-3.5 text-right">
                      {b.status !== 'Cancelled' ? (
                        <button
                          type="button"
                          onClick={() => setCancellingBookingId(b.id)}
                          className="cursor-pointer px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold rounded-lg transition-colors"
                        >
                          Cancel Booking
                        </button>
                      ) : (
                        <span className="text-[10px] text-brand-charcoal/40 font-bold">Cancelled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {eventBookings.length > 0 && (
          <div className="p-4 border-t border-brand-clay/40 bg-brand-sand/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs font-semibold text-brand-charcoal/60">
              Showing <span className="font-bold text-brand-charcoal">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>–<span className="font-bold text-brand-charcoal">{Math.min(currentPage * ITEMS_PER_PAGE, eventBookings.length)}</span> of <span className="font-bold text-brand-charcoal">{eventBookings.length}</span> event bookings
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-brand-clay rounded-xl text-xs font-bold text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-sand transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-brand-charcoal px-2">
                Page {currentPage} of {totalEventPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalEventPages}
                onClick={() => setCurrentPage(prev => Math.min(totalEventPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-brand-clay rounded-xl text-xs font-bold text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-sand transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Cancel Confirmation Modal */}
      {cancellingBookingId && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 max-w-sm w-full text-left space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="font-display text-base font-bold text-brand-charcoal">Cancel Event Booking?</h3>
            </div>
            <p className="text-xs text-brand-charcoal/70 leading-relaxed">
              Are you sure you want to cancel booking <strong className="font-mono text-brand-charcoal">{cancellingBookingId}</strong>? This will release reserved seats and mark the reservation as cancelled.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setCancellingBookingId(null)}
                className="cursor-pointer py-2.5 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl"
              >
                Keep Booking
              </button>
              <button
                onClick={() => confirmCancel(cancellingBookingId)}
                className="cursor-pointer py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
