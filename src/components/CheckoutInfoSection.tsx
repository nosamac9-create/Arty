/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, Mail, Phone, ArrowLeft, ArrowRight, ShieldCheck, LogIn, CheckCircle2, Lock } from 'lucide-react';
import { validateSaudiPhone, normaliseSaudiPhone } from '../utils/phoneUtils';
import { PhoneInput } from './PhoneInput';
import {
  validateCustomerForm, canonicalPhone, canonicalEmail, passwordChecklist
} from '../utils/validation';

export const CheckoutInfoSection: React.FC = () => {
  const {
    pendingBooking, setPendingBooking, setCustomerTab, currentUser, setCurrentUser,
    workshops, loginCustomer, registerCustomer, publishedBirthdayPackages
  } = useApp();

  const workshop = workshops.find(w => w.id === pendingBooking?.workshopId) || workshops[0];

  // A birthday reservation is summarised from its own package record, not from a
  // workshop that happens to be first in the list.
  const birthday = pendingBooking?.birthdayDetails;
  const birthdayPackage = birthday?.packageId
    ? publishedBirthdayPackages.find(p => p.id === birthday.packageId)
    : undefined;

  const [name, setName] = useState(pendingBooking?.customerName || currentUser?.name || '');
  const [email, setEmail] = useState(pendingBooking?.customerEmail || currentUser?.email || '');
  const [phone, setPhone] = useState(pendingBooking?.customerPhone || currentUser?.phone || '');

  // Reconcile what the customer already entered with their account details:
  // values carried from the booking form win, the account fills the gaps. This
  // is what stops a birthday customer re-typing their name and phone.
  useEffect(() => {
    if (!currentUser) return;

    setName(prev => prev || pendingBooking?.customerName || currentUser.name || '');
    setEmail(prev => prev || pendingBooking?.customerEmail || currentUser.email || '');
    setPhone(prev => prev || pendingBooking?.customerPhone || currentUser.phone || '');

    if (pendingBooking) {
      setPendingBooking({
        ...pendingBooking,
        customerName: pendingBooking.customerName || currentUser.name,
        customerEmail: pendingBooking.customerEmail || currentUser.email,
        customerPhone: pendingBooking.customerPhone || currentUser.phone,
      });
    }
  }, [currentUser]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formGlobalError, setFormGlobalError] = useState<string | null>(null);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  /** The typed account exists but was created without a password. */
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = async () => {
    // A signed-in customer is editing their own details, so their own record
    // must not be reported as a duplicate; a guest is creating a new account,
    // where an existing phone or email genuinely is a clash.
    const errs = await validateCustomerForm(
      { name, email, phone, password, confirmPassword },
      {
        requirePassword: !currentUser,
        excludeId: currentUser?.id,
        allowExistingCustomer: !!currentUser
      }
    );

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormGlobalError(null);
    if (!(await validate())) return;

    // One canonical stored format everywhere.
    const normPhone = canonicalPhone(phone);
    const normEmail = canonicalEmail(email);

    // If currentUser is not logged in, register account explicitly
    if (!currentUser) {
      const regRes = await registerCustomer({
        name: name.trim(),
        email: normEmail,
        phone: normPhone,
        password: password
      });

      if (!regRes.success) {
        if (regRes.error?.includes('already exists')) {
          setFormGlobalError('An account with these details already exists. Please sign in below to continue.');
          setLoginEmail(normEmail);
          setIsLoginModalOpen(true);
        } else {
          setFormGlobalError(regRes.error || 'Registration failed.');
        }
        return;
      }
    } else {
      setCurrentUser({
        ...currentUser,
        name: name.trim(),
        email: normEmail,
        phone: normPhone
      });
    }

    // Update pending booking
    if (pendingBooking) {
      setPendingBooking({
        ...pendingBooking,
        customerName: name.trim(),
        customerEmail: normEmail,
        customerPhone: normPhone
      });
    }

    setCustomerTab('checkout-payment');
  };

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!loginEmail.trim()) return;

    const res = await loginCustomer(loginEmail, loginPassword);
    if (!res.success) {
      setModalError(res.error || 'Login failed.');
      // The record exists but has no password. Sending them to the Login page
      // is where the claim step lives.
      setNeedsPasswordSetup(!!res.needsPasswordSetup);
      return;
    }

    setIsLoginModalOpen(false);
  };

  if (!pendingBooking) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h2 className="font-display text-2xl font-bold text-brand-charcoal">No Workshop Selected</h2>
        <p className="text-sm text-brand-charcoal/70 mt-2">Please select a workshop from the catalog to book.</p>
        <button
          onClick={() => setCustomerTab('workshops')}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-terracotta px-6 py-3 text-sm font-bold text-brand-cream"
        >
          Browse Workshops
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-in fade-in duration-300 text-left">
      
      {/* Back to detail button */}
      <button
        onClick={() => setCustomerTab('detail')}
        className="inline-flex items-center gap-2 text-xs font-bold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3.5 py-2 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Workshop Details</span>
      </button>

      {/* Progress Step Indicator */}
      <div className="mb-8 flex items-center justify-between border-b border-brand-clay/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream text-xs font-bold shadow-xs">
            1
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-charcoal">Customer Information</h1>
            <p className="text-xs text-brand-charcoal/60">Step 1 of 2: Enter your contact details for booking confirmation</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-brand-charcoal/40">
          <span className="text-brand-terracotta">1. Info</span>
          <span>→</span>
          <span>2. Payment</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Column */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-brand-clay/60 shadow-md">
          
          {/* Quick Sign in banner if not logged in */}
          {!currentUser ? (
            <div className="mb-6 p-4 bg-brand-sand/50 rounded-2xl border border-brand-clay/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-brand-terracotta shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-brand-charcoal">Have an account?</p>
                  <p className="text-brand-charcoal/70">Sign in to autofill your details and view saved bookings.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-brand-terracotta bg-white border border-brand-terracotta/30 rounded-xl hover:bg-brand-terracotta hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            </div>
          ) : (
            <div className="mb-6 p-3.5 bg-brand-sage/10 rounded-2xl border border-brand-sage/30 flex items-center gap-3 text-xs text-brand-charcoal">
              <CheckCircle2 className="h-4 w-4 text-brand-sage shrink-0" />
              <span>Signed in as <strong>{currentUser.name}</strong> ({currentUser.email})</span>
            </div>
          )}

          <form onSubmit={handleContinue} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider mb-2">
                Full Name <span className="text-brand-terracotta">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                <input
                  type="text"
                  placeholder="e.g. Noura Al-Amri"
                  value={name}
                  onChange={e => { setName(e.target.value); if (errors.name) setErrors({...errors, name: ''}); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-1 font-medium">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider mb-2">
                Email Address <span className="text-brand-terracotta">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                <input
                  type="email"
                  placeholder="e.g. noura@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({...errors, email: ''}); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1 font-medium">{errors.email}</p>}
            </div>

            {formGlobalError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-700">
                {formGlobalError}
              </div>
            )}

            <PhoneInput
              label="Saudi Mobile Phone Number"
              required
              value={phone}
              onChange={val => { setPhone(val); if (errors.phone) setErrors({...errors, phone: ''}); }}
              error={errors.phone}
            />

            {!currentUser && (
              <>
                <div>
                  <label className="block text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider mb-2">
                    Account Password <span className="text-brand-terracotta">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (errors.password) setErrors({...errors, password: ''}); }}
                      className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                    />
                  </div>
                  {/* Live checklist, updating as they type. */}
                  <ul className="space-y-0.5 mt-1.5">
                    {passwordChecklist(password).map(item => (
                      <li
                        key={item.label}
                        className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                          item.met ? 'text-brand-sage' : 'text-brand-charcoal/45'
                        }`}
                      >
                        <span>{item.met ? '✓' : '•'}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                  {errors.password && <p className="text-xs text-red-500 mt-1 font-medium">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider mb-2">
                    Confirm Password <span className="text-brand-terracotta">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors({...errors, confirmPassword: ''}); }}
                      className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmPassword}</p>}
                </div>
              </>
            )}

            <div className="pt-4">
              <button
                type="submit"
                className="w-full cursor-pointer bg-brand-terracotta text-brand-cream font-bold py-4 rounded-2xl shadow-md hover:bg-brand-terracotta-hover transition-all flex items-center justify-center gap-2 text-base"
              >
                <span>Continue to Payment</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-charcoal/50 pt-2">
              <ShieldCheck className="h-4 w-4 text-brand-sage" />
              <span>Your contact details are encrypted and used solely for workshop management.</span>
            </div>
          </form>

        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5">
          <div className="bg-brand-sand/30 rounded-3xl p-6 border border-brand-clay/80 space-y-4">
            <h3 className="font-display text-lg font-bold text-brand-charcoal border-b border-brand-clay/60 pb-3">
              Order Summary
            </h3>

            <div className="flex gap-4">
              <img
                src={birthday ? (birthdayPackage?.image || workshop.image) : workshop.image}
                alt={birthday ? (birthdayPackage?.name || 'Birthday package') : workshop.title}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 bg-brand-sand border border-brand-clay/40"
              />
              <div>
                <span className="text-[10px] font-bold text-brand-sage uppercase tracking-wider block">
                  {birthday ? 'Birthday Package' : workshop.category}
                </span>
                <h4 className="font-bold text-brand-charcoal text-sm leading-tight">{pendingBooking.workshopTitle}</h4>
                <p className="text-xs text-brand-charcoal/70 mt-1">
                  {birthday
                    ? `${birthdayPackage?.duration || ''}${birthdayPackage?.ageInformation ? ` • ${birthdayPackage.ageInformation}` : ''}`
                    : `${workshop.duration} • ${workshop.room.split('(')[0]}`}
                </p>
              </div>
            </div>

            <div className="border-t border-brand-clay/60 pt-3 space-y-2 text-xs text-brand-charcoal/80">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-bold text-brand-charcoal">{pendingBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Slot:</span>
                <span className="font-bold text-brand-charcoal">{pendingBooking.time}</span>
              </div>
              <div className="flex justify-between">
                <span>{birthday ? 'Guests:' : 'Participants:'}</span>
                <span className="font-bold text-brand-charcoal">{pendingBooking.participants} {pendingBooking.participants === 1 ? 'person' : 'people'}</span>
              </div>
              <div className="flex justify-between">
                <span>{birthday ? (birthdayPackage?.pricingLabel || 'Per child') : 'Price per person'}:</span>
                <span className="font-bold text-brand-charcoal">
                  {birthday ? (birthdayPackage?.price ?? 0) : workshop.price} SAR
                </span>
              </div>
              {birthday?.birthdayPersonName && (
                <div className="flex justify-between">
                  <span>Birthday person:</span>
                  <span className="font-bold text-brand-charcoal">{birthday.birthdayPersonName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-brand-clay/60 pt-3 flex justify-between items-center text-brand-charcoal">
              <span className="font-bold text-sm">{birthday ? 'Deposit Due:' : 'Total Due:'}</span>
              <span className="font-serif text-xl font-bold text-brand-terracotta">{pendingBooking.totalPrice} SAR</span>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-brand-charcoal/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-brand-clay text-left animate-in zoom-in-95 duration-150">
            <h3 className="font-display text-xl font-bold text-brand-charcoal mb-2">Sign In</h3>
            <p className="text-xs text-brand-charcoal/70 mb-4">Enter your email to quickly sign in and autofill your details.</p>
            
            {modalError && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold space-y-2">
                <p>{modalError}</p>
                {needsPasswordSetup && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginModalOpen(false);
                      setCustomerTab('auth');
                    }}
                    className="font-bold underline cursor-pointer"
                  >
                    Set up your password
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-brand-charcoal/70 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. noura@example.com"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setModalError(null); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-brand-charcoal/70 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => { setLoginPassword(e.target.value); setModalError(null); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay/80 rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-brand-clay text-xs font-bold text-brand-charcoal hover:bg-brand-sand cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-terracotta text-xs font-bold text-brand-cream hover:bg-brand-terracotta-hover cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
