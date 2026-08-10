import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Booking, BirthdayPackage, DEFAULT_CAKE_SIZES } from '../types';
import { formatDateTime } from '../utils/calendarConfig';
import { 
  Sparkles, Calendar, Clock, User, Save, Search, Filter, CheckCircle2, 
  Package, Users, Phone, Mail, DollarSign, AlertCircle, X, ShieldAlert,
  Plus, Trash2, ChevronUp, ChevronDown, Download
} from 'lucide-react';

/** One label/value line. Optional answers are shown as "Not provided", never dropped. */
const DetailRow: React.FC<{ label: string; value?: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex justify-between gap-3 border-b border-brand-clay/25 last:border-b-0 py-1">
    <span className="text-brand-charcoal/60 font-semibold">{label}</span>
    <span className={`font-bold text-brand-charcoal text-right ${mono ? 'font-mono' : ''}`}>
      {value ? value : <span className="text-brand-charcoal/30 italic font-normal">Not provided</span>}
    </span>
  </div>
);

export const AdminEventsSection: React.FC = () => {
  const {
    cancelBooking,
    selectedEventBookingId,
    setSelectedEventBookingId,
    birthdayPackages,
    addBirthdayPackage,
    updateBirthdayPackage,
    deleteBirthdayPackage,
    reorderBirthdayPackages
  } = useApp();

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Draft edits per package, committed to the shared record on save
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  const [packageDrafts, setPackageDrafts] = useState<Record<string, BirthdayPackage>>({});

  // Keep drafts in step with the shared records
  useEffect(() => {
    setPackageDrafts(prev => {
      const next: Record<string, BirthdayPackage> = {};
      birthdayPackages.forEach(p => { next[p.id] = prev[p.id] || p; });
      return next;
    });
  }, [birthdayPackages]);

  const setDraftField = (id: string, key: keyof BirthdayPackage, value: any) => {
    setPackageDrafts(prev => ({
      ...prev,
      [id]: { ...(prev[id] || birthdayPackages.find(p => p.id === id)!), [key]: value }
    }));
  };

  const handleSavePackage = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const draft = packageDrafts[id];
    if (!draft) return;
    if (!draft.name.trim()) {
      showToast('Package name is required.');
      return;
    }
    // Writes to the one shared record the customer site reads from.
    const { id: _ignored, ...updates } = draft;
    await updateBirthdayPackage(id, updates);
    showToast(`"${draft.name}" saved. The customer site now shows these details.`);
  };

  const handleAddPackage = async () => {
    await addBirthdayPackage({
      name: 'New Birthday Package',
      image: '',
      shortDescription: '',
      fullDescription: '',
      price: 0,
      pricingType: 'Per child',
      pricingLabel: 'Per Child',
      duration: '2 Hours',
      minGuests: 1,
      maxGuests: 20,
      ageInformation: '',
      includedItems: [],
      activityChoices: [],
      additionalInfo: [],
      cakeDescription: '',
      cakeSizes: DEFAULT_CAKE_SIZES.map(size => ({ ...size })),
      trainerInfo: '',
      deliveryInfo: '',
      availableDays: [],
      availableTimes: [],
      terms: '',
      customerNotes: '',
      depositAmount: 500,
      // New packages start hidden until staff publish them.
      status: 'Draft',
      displayOrder: birthdayPackages.length
    });
    showToast('Package created as Draft. Publish it when the details are ready.');
  };

  const handleDeletePackage = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This removes it from the customer site.`)) return;
    await deleteBirthdayPackage(id);
    showToast(`"${name}" deleted.`);
  };

  const handleMovePackage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= birthdayPackages.length) return;
    const reordered = [...birthdayPackages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    await reorderBirthdayPackages(reordered);
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

  // The booking opened from the Dashboard or from a table row — the same shared record.
  const selectedEventBooking = useMemo(
    () => (selectedEventBookingId ? liveBookings.find(b => b.id === selectedEventBookingId) || null : null),
    [selectedEventBookingId, liveBookings]
  );
  const eventDetails = selectedEventBooking?.birthdayDetails;

  /** The package this booking was made against, resolved from its stable id. */
  const selectedEventPackage = useMemo(
    () => (eventDetails?.packageId
      ? birthdayPackages.find(p => p.id === eventDetails.packageId) || null
      : null),
    [eventDetails, birthdayPackages]
  );

  // Enlarged view of a submitted image
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);

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
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">Birthday Package Management</h1>
          <p className="text-xs text-brand-charcoal/60 mt-0.5">Edit the package details customers see, and view all package reservations.</p>
        </div>
      </div>

      {/* ========================================================== */}
      {/* ========= SECTION 1: SHARED PACKAGE RECORD EDITOR ========= */}
      {/* ========================================================== */}
      <div className="bg-white border-2 border-brand-clay rounded-3xl p-6 shadow-xs space-y-5">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-clay/60">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
              <Package className="h-5 w-5 text-brand-terracotta" />
              <span>Birthday Package Details</span>
            </h2>
            <p className="text-xs text-brand-charcoal/60 mt-0.5">
              These records are what the customer site shows. Booking-form fields are configured in Settings → Events &amp; Birthday.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddPackage}
            className="cursor-pointer px-4 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Package</span>
          </button>
        </div>

        {birthdayPackages.length === 0 ? (
          <p className="text-xs text-brand-charcoal/50 italic py-4">No birthday packages yet. Add one to publish it on the customer site.</p>
        ) : (
          <div className="space-y-4">
            {birthdayPackages.map((pkg, index) => {
              const isOpen = expandedPackageId === pkg.id;
              const draft = packageDrafts[pkg.id] || pkg;

              return (
                <div key={pkg.id} className="border border-brand-clay/70 rounded-2xl overflow-hidden">

                  {/* Package row header */}
                  <div className="flex items-center justify-between gap-3 p-4 bg-brand-cream/40">
                    <button
                      type="button"
                      onClick={() => setExpandedPackageId(isOpen ? null : pkg.id)}
                      className="flex items-center gap-3 text-left cursor-pointer flex-1 min-w-0"
                    >
                      {pkg.image && (
                        <img src={pkg.image} alt={pkg.name} className="h-10 w-10 rounded-lg object-cover border border-brand-clay/50 shrink-0" referrerPolicy="no-referrer" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-brand-charcoal truncate">{pkg.name}</p>
                        <p className="text-[11px] font-semibold text-brand-charcoal/60">
                          {pkg.price} SAR · {pkg.pricingType} · {pkg.duration}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        pkg.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {pkg.status}
                      </span>

                      <button
                        type="button"
                        title="Move up"
                        disabled={index === 0}
                        onClick={() => handleMovePackage(index, -1)}
                        className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Move down"
                        disabled={index === birthdayPackages.length - 1}
                        onClick={() => handleMovePackage(index, 1)}
                        className="p-1.5 rounded-lg border border-brand-clay/60 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Delete package"
                        onClick={() => handleDeletePackage(pkg.id, pkg.name)}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Package editor */}
                  {isOpen && (
                    <form
                      onSubmit={e => handleSavePackage(e, pkg.id)}
                      className="p-5 space-y-4 border-t border-brand-clay/60 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Package Name *</label>
                          <input
                            type="text"
                            required
                            value={draft.name}
                            onChange={e => setDraftField(pkg.id, 'name', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Image URL</label>
                          <input
                            type="text"
                            value={draft.image}
                            onChange={e => setDraftField(pkg.id, 'image', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Short Description</label>
                          <input
                            type="text"
                            value={draft.shortDescription}
                            onChange={e => setDraftField(pkg.id, 'shortDescription', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Full Description</label>
                          <textarea
                            rows={3}
                            value={draft.fullDescription}
                            onChange={e => setDraftField(pkg.id, 'fullDescription', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Price (SAR)</label>
                          <input
                            type="number"
                            min={0}
                            value={draft.price}
                            onChange={e => setDraftField(pkg.id, 'price', Number(e.target.value) || 0)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Pricing Type</label>
                          <select
                            value={draft.pricingType}
                            onChange={e => setDraftField(pkg.id, 'pricingType', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          >
                            <option value="Per child">Per child</option>
                            <option value="Per person">Per person</option>
                            <option value="Fixed price">Fixed price</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Pricing Label (shown to customers)</label>
                          <input
                            type="text"
                            placeholder="e.g. Per Child"
                            value={draft.pricingLabel || ''}
                            onChange={e => setDraftField(pkg.id, 'pricingLabel', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Duration</label>
                          <input
                            type="text"
                            placeholder="e.g. 2 Hours"
                            value={draft.duration}
                            onChange={e => setDraftField(pkg.id, 'duration', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Deposit (SAR)</label>
                          <input
                            type="number"
                            min={0}
                            value={draft.depositAmount ?? 0}
                            onChange={e => setDraftField(pkg.id, 'depositAmount', Number(e.target.value) || 0)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Minimum Guests</label>
                          <input
                            type="number"
                            min={1}
                            value={draft.minGuests}
                            onChange={e => setDraftField(pkg.id, 'minGuests', Number(e.target.value) || 1)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Maximum Guests</label>
                          <input
                            type="number"
                            min={1}
                            value={draft.maxGuests}
                            onChange={e => setDraftField(pkg.id, 'maxGuests', Number(e.target.value) || 1)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Age Information</label>
                          <input
                            type="text"
                            placeholder="e.g. 4+ years"
                            value={draft.ageInformation}
                            onChange={e => setDraftField(pkg.id, 'ageInformation', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Status</label>
                          <select
                            value={draft.status}
                            onChange={e => setDraftField(pkg.id, 'status', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          >
                            <option value="Published">Published (visible to customers)</option>
                            <option value="Draft">Draft (hidden from customers)</option>
                          </select>
                        </div>
                      </div>

                      {/* List fields — one entry per line */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-clay/50">
                        {([
                          ['includedItems', 'Includes (one per line)'],
                          ['activityChoices', 'Activity Choices (one per line)'],
                          ['additionalInfo', 'Additional Information (one per line)'],
                          ['availableDays', 'Available Days'],
                          ['availableTimes', 'Available Times']
                        ] as const).map(([key, label]) => (
                          <div key={key} className="space-y-1">
                            <label className="font-bold text-brand-charcoal/80 block">{label}</label>
                            <textarea
                              rows={3}
                              placeholder="One entry per line"
                              value={(draft[key] || []).join('\n')}
                              onChange={e => setDraftField(pkg.id, key, e.target.value.split('\n').map(v => v.trim()).filter(Boolean))}
                              className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Customized cake — structured, editable rows */}
                      <div className="pt-2 border-t border-brand-clay/50 space-y-3">
                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Cake Description</label>
                          <input
                            type="text"
                            placeholder="Send us your cake design and we will do it."
                            value={draft.cakeDescription}
                            onChange={e => setDraftField(pkg.id, 'cakeDescription', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="font-bold text-brand-charcoal/80 block">Cake Sizes &amp; Prices</label>
                            <button
                              type="button"
                              onClick={() => setDraftField(pkg.id, 'cakeSizes', [
                                ...(draft.cakeSizes || []),
                                { id: `cake-${Date.now()}`, label: 'New size', price: 0 }
                              ])}
                              className="text-[11px] font-bold text-brand-terracotta hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              <span>Add Size</span>
                            </button>
                          </div>

                          {(draft.cakeSizes || []).length === 0 ? (
                            <p className="text-[11px] text-brand-charcoal/50 italic">No cake sizes listed.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {(draft.cakeSizes || []).map((size, sizeIdx) => (
                                <div key={size.id} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="e.g. Small (15 cm)"
                                    value={size.label}
                                    onChange={e => setDraftField(pkg.id, 'cakeSizes',
                                      (draft.cakeSizes || []).map((c, i) => i === sizeIdx ? { ...c, label: e.target.value } : c))}
                                    className="flex-1 bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    value={size.price}
                                    onChange={e => setDraftField(pkg.id, 'cakeSizes',
                                      (draft.cakeSizes || []).map((c, i) => i === sizeIdx ? { ...c, price: Number(e.target.value) || 0 } : c))}
                                    className="w-24 bg-brand-cream/40 border border-brand-clay rounded-xl p-2 font-semibold"
                                  />
                                  <span className="text-[11px] font-bold text-brand-charcoal/50">SAR</span>
                                  <button
                                    type="button"
                                    onClick={() => setDraftField(pkg.id, 'cakeSizes',
                                      (draft.cakeSizes || []).filter((_, i) => i !== sizeIdx))}
                                    className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
                                    title="Remove size"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Trainer and delivery information */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-clay/50">
                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Trainer Information</label>
                          <input
                            type="text"
                            placeholder="Includes Professional Trainer/Artist upon request."
                            value={draft.trainerInfo}
                            onChange={e => setDraftField(pkg.id, 'trainerInfo', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Delivery / Pickup Information</label>
                          <input
                            type="text"
                            placeholder="Pottery will be delivered or collected after firing."
                            value={draft.deliveryInfo}
                            onChange={e => setDraftField(pkg.id, 'deliveryInfo', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-clay/50">
                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Terms</label>
                          <textarea
                            rows={3}
                            value={draft.terms}
                            onChange={e => setDraftField(pkg.id, 'terms', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-brand-charcoal/80 block">Customer-Visible Notes</label>
                          <textarea
                            rows={3}
                            value={draft.customerNotes}
                            onChange={e => setDraftField(pkg.id, 'customerNotes', e.target.value)}
                            className="w-full bg-brand-cream/40 border border-brand-clay rounded-xl p-2.5 font-semibold"
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-brand-clay/60 flex justify-end">
                        <button
                          type="submit"
                          className="cursor-pointer px-5 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
                        >
                          <Save className="h-4 w-4" />
                          <span>Save Package</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
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
            <p className="text-xs text-brand-charcoal/60 mt-0.5">List of all customers who reserved a birthday package or private event.</p>
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
                  <tr
                    key={b.id}
                    onClick={() => setSelectedEventBookingId(b.id)}
                    className={`hover:bg-brand-sand/20 transition-colors cursor-pointer ${
                      selectedEventBookingId === b.id ? 'bg-brand-sand/40' : ''
                    }`}
                  >
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

                    {/* Booked Package / Event — resolved from the stored package id */}
                    <td className="p-3.5">
                      <span className="font-bold text-brand-charcoal block">
                        {(b.birthdayDetails?.packageId
                          && birthdayPackages.find(p => p.id === b.birthdayDetails!.packageId)?.name)
                          || b.workshopTitle}
                      </span>
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

      {/* ========================================================== */}
      {/* ========= FULL BIRTHDAY / EVENT BOOKING DETAILS ========== */}
      {/* Same interaction pattern as the Customer Details page:      */}
      {/* one shared booking record, every submitted field shown.     */}
      {/* ========================================================== */}
      {selectedEventBooking && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl max-w-3xl w-full my-8 shadow-2xl text-left animate-in zoom-in-95 duration-150">

            <div className="flex items-start justify-between gap-4 p-6 border-b border-brand-clay/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta block">
                  Birthday / Event Reservation
                </span>
                <h2 className="font-display text-2xl font-bold text-brand-charcoal">
                  {selectedEventBooking.workshopTitle}
                </h2>
                <p className="font-mono text-xs font-bold text-brand-charcoal/60 mt-1">
                  {selectedEventBooking.id}
                </p>
              </div>

              <button
                onClick={() => setSelectedEventBookingId(null)}
                className="p-1.5 rounded-lg hover:bg-brand-sand text-brand-charcoal/60 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">

              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg font-bold bg-white border border-brand-clay/60 text-brand-charcoal">
                  Booking status: {selectedEventBooking.status}
                </span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-white border border-brand-clay/60 text-brand-charcoal">
                  Payment: {selectedEventBooking.paymentStatus}
                </span>
                <span className="px-2.5 py-1 rounded-lg font-bold bg-white border border-brand-clay/60 text-brand-charcoal">
                  Source: {selectedEventBooking.source}
                </span>
              </div>

              {/* Customer */}
              <section className="bg-white border border-brand-clay/60 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-brand-charcoal uppercase tracking-wider text-[10px]">Customer</h3>
                <DetailRow label="Name" value={selectedEventBooking.customerName} />
                <DetailRow label="Phone" value={selectedEventBooking.customerPhone} mono />
                <DetailRow label="Email" value={selectedEventBooking.customerEmail} />
              </section>

              {/* Reservation */}
              <section className="bg-white border border-brand-clay/60 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-brand-charcoal uppercase tracking-wider text-[10px]">Reservation</h3>
                <DetailRow
                  label="Package selected"
                  value={selectedEventPackage?.name || eventDetails?.packageName || selectedEventBooking.workshopTitle}
                />
                <DetailRow label="Package ID" value={eventDetails?.packageId} mono />
                <DetailRow label="Event date" value={eventDetails?.eventDate || selectedEventBooking.date} mono />
                <DetailRow label="Event time" value={eventDetails?.eventTime || selectedEventBooking.time} mono />
                <DetailRow label="Number of guests" value={String(eventDetails?.guestCount ?? selectedEventBooking.participants)} />
                <DetailRow label="Submitted" value={eventDetails?.submittedAt ? formatDateTime(eventDetails.submittedAt) : formatDateTime(selectedEventBooking.createdAt)} />
              </section>

              {/* The Celebration Details card was removed — All Submitted Form
                  Answers below is the single, complete record of what the
                  customer submitted, so nothing is duplicated. */}

              {/* Every submitted answer, by stable key */}
              {eventDetails?.fieldValues && eventDetails.fieldValues.length > 0 && (
                <section className="bg-white border border-brand-clay/60 rounded-2xl p-4 space-y-2">
                  <h3 className="font-bold text-brand-charcoal uppercase tracking-wider text-[10px]">
                    All Submitted Form Answers
                  </h3>
                  <p className="text-[10px] text-brand-charcoal/50">
                    Stored against stable field keys, so answers stay readable if labels are renamed later.
                  </p>
                  {eventDetails.fieldValues.map(field => {
                    const isImageField = !!field.imageUrl || /photo|image/i.test(field.key);

                    if (isImageField) {
                      return (
                        <div key={field.key} className="border-b border-brand-clay/25 last:border-b-0 py-2 space-y-1.5">
                          <span className="text-brand-charcoal/60 font-semibold block">
                            {field.label}
                            <span className="text-[9px] font-mono text-brand-charcoal/35 ml-1">({field.key})</span>
                          </span>

                          {field.imageUrl ? (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setPreviewImage({ url: field.imageUrl!, label: field.label })}
                                title="Click to enlarge"
                                className="h-20 w-20 rounded-xl overflow-hidden border border-brand-clay/60 shrink-0 cursor-zoom-in hover:border-brand-terracotta transition-colors"
                              >
                                <img src={field.imageUrl} alt={field.label} className="h-full w-full object-cover" />
                              </button>

                              <div className="flex flex-col gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage({ url: field.imageUrl!, label: field.label })}
                                  className="text-[11px] font-bold text-brand-terracotta hover:underline text-left cursor-pointer"
                                >
                                  View larger
                                </button>
                                <a
                                  href={field.imageUrl}
                                  download={`${field.key}-${selectedEventBooking.id}.png`}
                                  className="text-[11px] font-bold text-brand-charcoal/70 hover:text-brand-charcoal hover:underline flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Save Image</span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            <p className="text-brand-charcoal/40 italic">No image was submitted for this field.</p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={field.key} className="flex justify-between gap-3 border-b border-brand-clay/25 last:border-b-0 py-1">
                        <span className="text-brand-charcoal/60 font-semibold">
                          {field.label}
                          <span className="text-[9px] font-mono text-brand-charcoal/35 ml-1">({field.key})</span>
                        </span>
                        <span className="font-bold text-brand-charcoal text-right">
                          {field.value || <span className="text-brand-charcoal/30 italic">Not provided</span>}
                        </span>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Money */}
              <section className="bg-white border border-brand-clay/60 rounded-2xl p-4 space-y-2">
                <h3 className="font-bold text-brand-charcoal uppercase tracking-wider text-[10px]">Payment</h3>
                <DetailRow label="Total amount" value={eventDetails?.totalAmount !== undefined ? `${eventDetails.totalAmount} SAR` : ''} />
                <DetailRow
                  label="Deposit amount"
                  value={`${eventDetails?.depositAmount ?? selectedEventBooking.totalPrice} SAR`}
                />
                <DetailRow label="Payment status" value={selectedEventBooking.paymentStatus} />
              </section>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setSelectedEventBookingId(null)}
                  className="px-5 py-2.5 bg-brand-charcoal text-brand-cream rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ================= SUBMITTED IMAGE PREVIEW ================= */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-brand-charcoal/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white border border-brand-clay rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b border-brand-clay/60">
              <h3 className="font-display text-sm font-bold text-brand-charcoal">{previewImage.label}</h3>

              <div className="flex items-center gap-2">
                <a
                  href={previewImage.url}
                  download={`${previewImage.label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.png`}
                  className="px-3 py-1.5 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Save Image</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  title="Close preview"
                  className="p-1.5 rounded-lg hover:bg-brand-sand text-brand-charcoal/60 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Rendered at full stored resolution, not a resized copy */}
            <div className="p-4 overflow-auto bg-brand-cream/40 flex items-center justify-center">
              <img
                src={previewImage.url}
                alt={previewImage.label}
                className="max-w-full max-h-[70vh] object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}

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
