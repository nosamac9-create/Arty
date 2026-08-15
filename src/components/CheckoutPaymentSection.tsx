/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CreditCard, Smartphone, ShieldCheck, ArrowLeft, Check, Lock } from 'lucide-react';
import { getMinBirthdayBookingDateStr } from '../utils/dateUtils';
import { PhoneInput } from './PhoneInput';
import { PrePaymentPopup } from './PrePaymentPopup';
import { migratePrePaymentPopup } from '../types';
import { validateBookingForm } from '../utils/validation';

export const CheckoutPaymentSection: React.FC = () => {
  const { 
    pendingBooking, setPendingBooking, setCustomerTab, addBooking, setLastBookingCreated, workshops, currentUser,
    appSettings
  } = useApp();

  // The guidelines pop-up is configured in Settings -> Booking Pop-up. Reading
  // it live means an admin edit shows up here without a rebuild or a reload.
  const popupConfig = migratePrePaymentPopup(
    appSettings.find(s => s.id === 'prePaymentInstructions')?.value
  );
  const [showPopup, setShowPopup] = useState(false);
  // Capacity/session message from the shared validation layer.
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<'card' | 'applepay' | 'stcpay'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState(pendingBooking?.customerName || '');
  const [stcPhone, setStcPhone] = useState(pendingBooking?.customerPhone || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const workshop = workshops.find(w => w.id === pendingBooking?.workshopId) || workshops[0];

  if (!pendingBooking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-semibold text-brand-charcoal">No Workshop Selected</h2>
        <p className="text-sm text-brand-ink mt-2">Please select a workshop from the catalog to book.</p>
        <button
          onClick={() => setCustomerTab('workshops')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-6 py-3 text-sm font-semibold text-brand-cream"
        >
          Browse Workshops
        </button>
      </div>
    );
  }

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    // Capacity is re-read from the database here, at submit time. The number
    // shown when the page loaded may be stale — someone else can take the last
    // seat while this customer is filling in their card details.
    const bookingErrors = await validateBookingForm({
      sessionId: pendingBooking.sessionId,
      participants: pendingBooking.participants
    });
    // A birthday package has no workshop session; its own rules apply below.
    const isBirthday = pendingBooking.workshopId === 'birthday-party-event' ||
      pendingBooking.workshopTitle.toLowerCase().includes('birthday');
    const capacityError = Object.values(bookingErrors)[0];
    if (!isBirthday && capacityError) {
      setBookingError(capacityError);
      return;
    }
    setBookingError(null);

    // Enforce 4-day advance rule for birthday packages before payment completion
    if (
      pendingBooking.workshopId === 'birthday-party-event' ||
      pendingBooking.workshopTitle.toLowerCase().includes('birthday')
    ) {
      const minBirthdayDate = getMinBirthdayBookingDateStr();
      if (pendingBooking.date < minBirthdayDate) {
        alert('Birthday packages must be booked at least 4 days in advance. Please select a valid date.');
        setIsProcessing(false);
        return;
      }
    }

    // The studio guidelines are shown before the card is charged.
    if (popupConfig.enabled) {
      setShowPopup(true);
      return;
    }

    completePayment();
  };

  const completePayment = () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const name = pendingBooking.customerName || currentUser?.name || 'Guest Customer';
    const email = pendingBooking.customerEmail || currentUser?.email || 'guest@artycafe.sa';
    const phone = pendingBooking.customerPhone || currentUser?.phone || '';

    setTimeout(() => {
      // Create official booking in Dexie database
      const newBooking = addBooking({
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        workshopId: pendingBooking.workshopId,
        // Keep the booked session on the booking so the tutor resolves from it.
        sessionId: pendingBooking.sessionId,
        workshopTitle: pendingBooking.workshopTitle,
        date: pendingBooking.date,
        time: pendingBooking.time,
        participants: pendingBooking.participants,
        totalPrice: pendingBooking.totalPrice,
        source: 'Website',
        status: 'Pending',
        paymentStatus: 'Paid',
        // The full birthday submission travels onto the one shared booking record.
        birthdayDetails: pendingBooking.birthdayDetails
      });

      // Bookings for today are placed on the Live Queue by the shared booking→queue
      // sync, which resolves the tutor from the booked session. Adding one here too
      // produced a second, instructor-less entry for the same booking.

      setLastBookingCreated(newBooking);
      setPendingBooking(null);
      setIsProcessing(false);
      setCustomerTab('confirmation');
    }, 800);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-in fade-in duration-300 text-start">

      {showPopup && (
        <PrePaymentPopup
          config={popupConfig}
          onCancel={() => setShowPopup(false)}
          onConfirm={() => {
            setShowPopup(false);
            completePayment();
          }}
        />
      )}
      
      {/* Back button */}
      <button
        onClick={() => setCustomerTab('checkout-info')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3.5 py-2 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Contact Information</span>
      </button>

      {/* Progress Step Indicator */}
      <div className="mb-8 flex items-center justify-between border-b border-brand-clay pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream text-xs font-semibold shadow-card-sm">
            2
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-brand-charcoal">Payment Method</h1>
            <p className="text-xs text-brand-muted">Step 2 of 2: Select your preferred payment option</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-brand-charcoal/40">
          <span className="text-brand-sage">1. Info</span>
          <span>→</span>
          <span className="text-brand-terracotta">2. Payment</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Payment Methods Selection */}
        <div className="lg:col-span-7 bg-brand-cream rounded-[28px] p-6 sm:p-8 border border-brand-clay shadow-card-sm">
          
          <h2 className="font-display text-lg font-semibold text-brand-charcoal mb-4">Choose Payment Method</h2>

          {/* Payment Method Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            
            {/* Mada / Credit Card */}
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={`p-4 rounded-2xl border flex flex-col items-start gap-2 cursor-pointer transition-all ${
                paymentMethod === 'card'
                  ? 'border-2 border-brand-terracotta bg-brand-terracotta/5 text-brand-terracotta'
                  : 'border-brand-clay bg-brand-sand/10 hover:border-brand-terracotta/50 text-brand-charcoal'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <CreditCard className="h-5 w-5" />
                {paymentMethod === 'card' && <Check className="h-4 w-4 text-brand-terracotta" />}
              </div>
              <div className="text-start">
                <p className="font-semibold text-xs">Mada / Credit Card</p>
                <p className="text-[10px] opacity-70">Visa, Mastercard, Mada</p>
              </div>
            </button>

            {/* Apple Pay */}
            <button
              type="button"
              onClick={() => setPaymentMethod('applepay')}
              className={`p-4 rounded-2xl border flex flex-col items-start gap-2 cursor-pointer transition-all ${
                paymentMethod === 'applepay'
                  ? 'border-2 border-brand-terracotta bg-brand-terracotta/5 text-brand-terracotta'
                  : 'border-brand-clay bg-brand-sand/10 hover:border-brand-terracotta/50 text-brand-charcoal'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-base">Pay</span>
                {paymentMethod === 'applepay' && <Check className="h-4 w-4 text-brand-terracotta" />}
              </div>
              <div className="text-start">
                <p className="font-semibold text-xs">Apple Pay</p>
                <p className="text-[10px] opacity-70">Instant 1-Click Pay</p>
              </div>
            </button>

            {/* STC Pay */}
            <button
              type="button"
              onClick={() => setPaymentMethod('stcpay')}
              className={`p-4 rounded-2xl border flex flex-col items-start gap-2 cursor-pointer transition-all ${
                paymentMethod === 'stcpay'
                  ? 'border-2 border-brand-terracotta bg-brand-terracotta/5 text-brand-terracotta'
                  : 'border-brand-clay bg-brand-sand/10 hover:border-brand-terracotta/50 text-brand-charcoal'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Smartphone className="h-5 w-5" />
                {paymentMethod === 'stcpay' && <Check className="h-4 w-4 text-brand-terracotta" />}
              </div>
              <div className="text-start">
                <p className="font-semibold text-xs">STC Pay</p>
                <p className="text-[10px] opacity-70">Digital Wallet</p>
              </div>
            </button>

          </div>

          <form onSubmit={handlePay} className="space-y-4">
            
            {/* Card Form */}
            {paymentMethod === 'card' && (
              <div className="space-y-3 p-4 bg-brand-sand/20 rounded-[22px] border border-brand-clay animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">Name on Card</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Noura Al-Amri"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    className="w-full bg-brand-cream border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-ink mb-1">Card Number</label>
                  <input
                    type="text"
                    required
                    placeholder="4000 1234 5678 9010"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full bg-brand-cream border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      required
                      placeholder="08/28"
                      value={cardExpiry}
                      onChange={e => setCardExpiry(e.target.value)}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-brand-ink mb-1">CVV</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      placeholder="123"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value)}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Apple Pay Prompt */}
            {paymentMethod === 'applepay' && (
              <div className="p-6 bg-brand-sand/30 rounded-[22px] border border-brand-clay text-center space-y-2 animate-in fade-in duration-150">
                <span className="font-semibold text-2xl">Pay</span>
                <p className="text-xs text-brand-ink">
                  Click the button below to authorize payment securely via Apple Pay on your device.
                </p>
              </div>
            )}

            {/* STC Pay Prompt */}
            {paymentMethod === 'stcpay' && (
              <div className="p-4 bg-brand-sand/20 rounded-[22px] border border-brand-clay space-y-3 animate-in fade-in duration-150">
                <PhoneInput
                  label="STC Pay Registered Phone Number"
                  required
                  value={stcPhone}
                  onChange={setStcPhone}
                />
                <p className="text-[11px] text-brand-muted">A payment authorization notification will be pushed to your STC Pay app.</p>
              </div>
            )}

            {bookingError && (
              <p className="text-xs text-red-500 font-semibold text-center">{bookingError}</p>
            )}

            <button
              type="submit"
              disabled={isProcessing || !!bookingError}
              className="w-full cursor-pointer bg-brand-terracotta text-brand-cream font-semibold py-4 rounded-2xl shadow-card-sm hover:bg-brand-terracotta-hover transition-all flex items-center justify-center gap-2 text-base mt-6 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>
                {isProcessing ? 'Processing Payment...' : `Complete Booking (${pendingBooking.totalPrice} SAR)`}
              </span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted pt-1">
              <ShieldCheck className="h-4 w-4 text-brand-sage" />
              <span>SSL 256-Bit Encrypted Payment • Immediate Admin Sync</span>
            </div>

          </form>

        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5">
          <div className="bg-brand-sand/30 rounded-[28px] p-6 border border-brand-clay space-y-4">
            <h3 className="font-display text-lg font-semibold text-brand-charcoal border-b border-brand-clay pb-3">
              Booking Details
            </h3>

            <div className="space-y-1 text-xs text-brand-ink">
              <p className="text-[10px] font-semibold uppercase text-brand-sage">Customer</p>
              <p className="font-semibold text-brand-charcoal text-sm">{pendingBooking.customerName}</p>
              <p>{pendingBooking.customerEmail}</p>
              <p>{pendingBooking.customerPhone}</p>
            </div>

            <div className="border-t border-brand-clay pt-3 space-y-2 text-xs text-brand-ink">
              <div className="flex justify-between">
                <span>Workshop:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.workshopTitle}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Slot:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.time}</span>
              </div>
              <div className="flex justify-between">
                <span>Participants:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.participants} {pendingBooking.participants === 1 ? 'person' : 'people'}</span>
              </div>
            </div>

            <div className="border-t border-brand-clay pt-3 flex justify-between items-center text-brand-charcoal">
              <span className="font-semibold text-sm">Total Amount:</span>
              <span className="font-serif text-2xl font-semibold text-brand-terracotta">{pendingBooking.totalPrice} SAR</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
