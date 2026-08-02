/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ArrowLeft, Calendar, Clock, Users, Gift, Cake, Sparkles, 
  Upload, CheckCircle2, AlertCircle, ShieldAlert, Coffee
} from 'lucide-react';
import { validatePhone, normalisePhone, normaliseSaudiPhone } from '../utils/phoneUtils';
import { getMinBirthdayBookingDateStr } from '../utils/dateUtils';
import { PhoneInput } from './PhoneInput';

export const BirthdayBookingSection: React.FC = () => {
  const { 
    setCustomerTab, 
    selectedBirthdayPackage, 
    setSelectedBirthdayPackage,
    setPendingBooking, 
    currentUser,
    appSettings
  } = useApp();

  const eventsSettings = appSettings?.find(s => s.id === 'eventsSettings')?.value;
  const minNoticeDays = Number(eventsSettings?.minBirthdayNoticeDays) || 4;
  const minBookingDate = getMinBirthdayBookingDateStr(minNoticeDays);

  const [bookingName, setBookingName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setBookingName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);
  const [numberOfPeople, setNumberOfPeople] = useState<number>(10);
  const [selectedPkg, setSelectedPkg] = useState<string>(selectedBirthdayPackage || 'Option 1 — Canvas & Create');
  const [bookingDate, setBookingDate] = useState<string>(minBookingDate);
  const [bookingTime, setBookingTime] = useState<string>('04:00 PM');
  const [balloonColor, setBalloonColor] = useState<string>('Pink & White');
  const [balloonColorCustom, setBalloonColorCustom] = useState<string>('');
  const [drinksChoice, setDrinksChoice] = useState<string>('Fresh Juices (Orange, Lemonade, Watermelon)');
  const [birthdayPersonName, setBirthdayPersonName] = useState<string>('');
  const [cakePhotoUrl, setCakePhotoUrl] = useState<string | null>(null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCakePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCakePhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!bookingName.trim()) errs.bookingName = 'Booking name is required';
    if (!phone) {
      errs.phone = 'Phone number is required';
    } else {
      const v = validatePhone('+966', phone);
      if (!v.isValid) errs.phone = v.error || 'Enter a valid phone number';
    }
    if (!numberOfPeople || numberOfPeople < 1) errs.numberOfPeople = 'At least 1 person is required';
    
    // Check minNoticeDays advance rule against live Riyadh date
    const currentMinDate = getMinBirthdayBookingDateStr(minNoticeDays);
    if (!bookingDate) {
      errs.bookingDate = 'Please select a date';
    } else if (bookingDate < currentMinDate) {
      errs.bookingDate = `Please choose a date at least ${minNoticeDays} days from today.`;
    }

    if (!bookingTime) errs.bookingTime = 'Please select a time slot';
    if (!birthdayPersonName.trim()) errs.birthdayPersonName = 'Name of the birthday person is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalBalloon = balloonColor === 'Custom Mix' && balloonColorCustom.trim() ? balloonColorCustom.trim() : balloonColor;
    const normPhone = normaliseSaudiPhone(phone);

    setPendingBooking({
      workshopId: 'birthday-party-event',
      workshopTitle: `Birthday Party — ${selectedPkg}`,
      date: bookingDate,
      time: bookingTime,
      participants: Number(numberOfPeople),
      totalPrice: 500, // 500 SAR Deposit required
      customerName: bookingName.trim(),
      customerEmail: currentUser?.email || 'events@artycafe.sa',
      customerPhone: normPhone,
    });

    setCustomerTab('checkout-payment');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 animate-in fade-in duration-300 text-left">
      
      {/* Back to Home button */}
      <button
        onClick={() => setCustomerTab('home')}
        className="inline-flex items-center gap-2 text-xs font-bold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3.5 py-2 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Home</span>
      </button>

      {/* Header Banner */}
      <div className="bg-brand-cream border-2 border-brand-clay rounded-3xl p-6 sm:p-8 shadow-sm mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-terracotta/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-terracotta text-brand-cream shrink-0">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-terracotta block">Private Celebration</span>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-brand-charcoal">Birthday Package Reservation</h1>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-brand-charcoal/70 mt-2">
          Complete the form below to reserve your studio celebration space. A <strong className="text-brand-terracotta font-bold">500 SAR deposit</strong> is required to confirm your date.
        </p>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        
        <div className="bg-white border border-brand-clay/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <h2 className="font-display text-xl font-bold text-brand-charcoal pb-3 border-b border-brand-clay/50 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-terracotta" />
            <span>Reservation Details</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Booking Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Booking Name *
              </label>
              <input
                type="text"
                value={bookingName}
                onChange={(e) => setBookingName(e.target.value)}
                placeholder="e.g. Noura Al-Amri"
                className={`w-full rounded-xl border p-3 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
                  errors.bookingName ? 'border-red-500 focus:ring-red-300' : 'border-brand-clay/70 focus:border-brand-terracotta focus:ring-brand-terracotta/20'
                }`}
              />
              {errors.bookingName && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.bookingName}</p>}
            </div>

            {/* Phone Number */}
            <PhoneInput
              label="Phone Number"
              required
              value={phone}
              onChange={(val) => setPhone(val)}
              error={errors.phone}
            />

            {/* Number of People */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Number of People *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={numberOfPeople}
                  onChange={(e) => setNumberOfPeople(parseInt(e.target.value) || 1)}
                  className={`w-full rounded-xl border p-3 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
                    errors.numberOfPeople ? 'border-red-500 focus:ring-red-300' : 'border-brand-clay/70 focus:border-brand-terracotta focus:ring-brand-terracotta/20'
                  }`}
                />
                <Users className="absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/40 pointer-events-none" />
              </div>
              {errors.numberOfPeople && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.numberOfPeople}</p>}
            </div>

            {/* Package */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Package *
              </label>
              <select
                value={selectedPkg}
                onChange={(e) => {
                  setSelectedPkg(e.target.value);
                  setSelectedBirthdayPackage(e.target.value);
                }}
                className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-white"
              >
                <option value="Option 1 — Canvas & Create">Option 1 — Canvas & Create (165 SAR / child)</option>
                <option value="Option 2 — Pottery Party">Option 2 — Pottery Party (200 SAR / child)</option>
              </select>
            </div>

            {/* Date / Day with 4-Day Advance Requirement */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Date / Day *
              </label>
              <input
                type="date"
                min={minBookingDate}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className={`w-full rounded-xl border p-3 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
                  errors.bookingDate ? 'border-red-500 focus:ring-red-300' : 'border-brand-clay/70 focus:border-brand-terracotta focus:ring-brand-terracotta/20'
                }`}
              />
              <p className="text-[11px] text-brand-terracotta font-semibold mt-1">
                📌 Birthday packages must be booked at least {minNoticeDays} days in advance.
              </p>
              {errors.bookingDate && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.bookingDate}</p>}
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Time *
              </label>
              <select
                value={bookingTime}
                onChange={(e) => setBookingTime(e.target.value)}
                className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-white"
              >
                <option value="10:00 AM">10:00 AM - 12:00 PM</option>
                <option value="01:00 PM">01:00 PM - 03:00 PM</option>
                <option value="04:00 PM">04:00 PM - 06:00 PM</option>
                <option value="07:00 PM">07:00 PM - 09:00 PM</option>
              </select>
              {errors.bookingTime && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.bookingTime}</p>}
            </div>

            {/* Balloon Color 🎈 */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Balloon Color 🎈
              </label>
              <select
                value={balloonColor}
                onChange={(e) => setBalloonColor(e.target.value)}
                className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-white"
              >
                <option value="Pink & White">Pink & White</option>
                <option value="Pastel Blue & White">Pastel Blue & White</option>
                <option value="Gold & Cream">Gold & Cream</option>
                <option value="Rose Gold & Blush">Rose Gold & Blush</option>
                <option value="Sage Green & Neutral">Sage Green & Neutral</option>
                <option value="Rainbow Multi-Color">Rainbow Multi-Color</option>
                <option value="Custom Mix">Custom Mix (specify below)</option>
              </select>
              {balloonColor === 'Custom Mix' && (
                <input
                  type="text"
                  placeholder="Specify custom balloon colors (e.g., Purple, Gold & White)"
                  value={balloonColorCustom}
                  onChange={(e) => setBalloonColorCustom(e.target.value)}
                  className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal mt-2 focus:outline-none focus:border-brand-terracotta"
                />
              )}
            </div>

            {/* Drinks */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                Drinks — coffee or fresh juices of your choice
              </label>
              <select
                value={drinksChoice}
                onChange={(e) => setDrinksChoice(e.target.value)}
                className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-white"
              >
                <option value="Fresh Juices (Orange, Lemonade, Watermelon)">Fresh Juices (Orange, Lemonade, Watermelon)</option>
                <option value="Specialty Coffee Bar (Latte, Cappuccino, Spanish Latte)">Specialty Coffee Bar (Latte, Cappuccino, Spanish Latte)</option>
                <option value="Mixed Bar (Coffee & Fresh Juices)">Mixed Bar (Coffee & Fresh Juices)</option>
              </select>
            </div>

            {/* Birthday Person & Cake Attachment */}
            <div className="sm:col-span-2 space-y-4 pt-2 border-t border-brand-clay/40">
              <h3 className="text-sm font-bold text-brand-charcoal flex items-center gap-2">
                <Cake className="h-4 w-4 text-brand-terracotta" />
                <span>Cake & Birthday Person Information</span>
              </h3>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                  Name of the Birthday Person *
                </label>
                <input
                  type="text"
                  value={birthdayPersonName}
                  onChange={(e) => setBirthdayPersonName(e.target.value)}
                  placeholder="e.g. Maya (Turning 8!)"
                  className={`w-full rounded-xl border p-3 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
                    errors.birthdayPersonName ? 'border-red-500 focus:ring-red-300' : 'border-brand-clay/70 focus:border-brand-terracotta focus:ring-brand-terracotta/20'
                  }`}
                />
                {errors.birthdayPersonName && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.birthdayPersonName}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70 mb-1.5">
                  Please attach a photo of the cake
                </label>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-brand-clay/70 bg-brand-sand/20 hover:bg-brand-sand/40 transition-colors">
                  {cakePhotoUrl ? (
                    <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-brand-clay shrink-0">
                      <img src={cakePhotoUrl} alt="Cake Design" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-sand/60 text-brand-charcoal/50 shrink-0">
                      <Upload className="h-6 w-6" />
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left">
                    <input
                      type="file"
                      id="cake-photo-upload"
                      accept="image/*"
                      onChange={handleCakePhotoChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="cake-photo-upload"
                      className="inline-flex items-center gap-2 text-xs font-bold text-brand-terracotta bg-white border border-brand-clay/60 px-4 py-2 rounded-xl cursor-pointer hover:bg-brand-sand/50 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{cakePhotoUrl ? 'Change Cake Photo' : 'Upload Cake Design Image'}</span>
                    </label>
                    <p className="text-[11px] text-brand-charcoal/60 mt-1">
                      Send us your customized cake design photo and we will prepare it for you!
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Terms and Conditions Section */}
        <div className="bg-brand-cream border-2 border-brand-terracotta/40 rounded-3xl p-6 sm:p-8 space-y-4 text-brand-charcoal shadow-xs">
          <div className="flex items-center gap-2 text-brand-terracotta font-bold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-display text-lg">Event Terms & Guidelines</h3>
          </div>

          <div className="text-xs sm:text-sm space-y-3 leading-relaxed text-brand-charcoal/90">
            <p className="font-semibold text-brand-charcoal">
              Please arrive on time for the event.
            </p>

            <div>
              <p className="font-semibold text-brand-charcoal mb-1">
                All supplies will be provided by Arty:
              </p>
              <ol className="list-decimal pl-5 space-y-0.5 text-brand-charcoal/80 font-medium">
                <li>Celebration cake</li>
                <li>Balloons</li>
                <li>Drinks</li>
                <li>Music</li>
              </ol>
            </div>

            <p className="font-medium bg-white/70 p-3 rounded-xl border border-brand-clay/50">
              A <strong className="text-brand-terracotta font-bold">500 SAR deposit</strong> is required to confirm the booking.
            </p>

            <p className="text-brand-charcoal/80">
              Changes or cancellations must be made at least four days before the scheduled date to receive a refund of the deposit.
            </p>

            <p className="font-bold text-red-600 bg-red-50/80 p-3 rounded-xl border border-red-200 flex items-center gap-1.5">
              <span>Please note: bringing any outside food or drinks is not allowed ‼️</span>
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto cursor-pointer bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-base font-bold px-10 py-4 rounded-2xl shadow-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Proceed to Payment (500 SAR Deposit)</span>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </button>
        </div>

      </form>
    </div>
  );
};
