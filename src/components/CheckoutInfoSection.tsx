/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PasswordField } from './PasswordField';
import { useApp } from '../context/AppContext';
import { User, Mail, Phone, ArrowLeft, ArrowRight, ShieldCheck, LogIn, CheckCircle2, Lock } from 'lucide-react';
import { validateSaudiPhone, normaliseSaudiPhone } from '../utils/phoneUtils';
import { PhoneInput } from './PhoneInput';
import {
  validateCustomerForm, canonicalPhone, canonicalEmail, passwordChecklist
} from '../utils/validation';
import { CheckoutStepper } from './ui/CheckoutStepper';

export const CheckoutInfoSection: React.FC = () => {
  const {
    pendingBooking, setPendingBooking, setCustomerTab, currentUser, setCurrentUser,
    workshops, loginCustomer, registerCustomer, requestPasswordReset, publishedBirthdayPackages
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
  const [resetSent, setResetSent] = useState<string | null>(null);
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

  /** Sends a reset link for whatever email is in the modal. */
  const handleModalForgotPassword = async () => {
    setModalError(null);
    setResetSent(null);

    const res = await requestPasswordReset(loginEmail || email);
    if (!res.success) {
      setModalError(res.error || 'Could not send the reset link.');
      return;
    }
    setResetSent(res.message || 'If an account exists for that address, a reset link is on its way.');
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-in fade-in duration-300 text-start">
      
      {/* Back to detail button */}
      <button
        onClick={() => setCustomerTab('detail')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3.5 py-2 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Workshop Details</span>
      </button>

      {/* Title then stepper — the same header the birthday reservation uses. */}
      <div className="mb-8">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
          Workshop Booking
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brand-charcoal sm:text-[42px]">
          Customer Information
        </h1>
        <p className="mt-3 text-sm text-brand-ink">
          Enter your contact details for booking confirmation.
        </p>
      </div>

      <CheckoutStepper steps={['Customer Information', 'Payment']} current={1} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Form Column */}
        <div className="lg:col-span-7 bg-brand-cream rounded-[28px] p-6 sm:p-8 border border-brand-clay shadow-card-sm">
          
          {/* Quick Sign in banner if not logged in */}
          {!currentUser ? (
            <div className="mb-6 p-4 bg-brand-sand/50 rounded-[22px] border border-brand-clay flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <LogIn className="h-5 w-5 text-brand-terracotta shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-brand-charcoal">Have an account?</p>
                  <p className="text-brand-ink">Sign in to autofill your details and view saved bookings.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-terracotta/30 rounded-xl hover:bg-brand-terracotta hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
              <label className="block text-xs font-semibold text-brand-ink uppercase tracking-wider mb-2">
                Full Name <span className="text-brand-terracotta">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                <input
                  type="text"
                  placeholder="e.g. Noura Al-Amri"
                  value={name}
                  onChange={e => { setName(e.target.value); if (errors.name) setErrors({...errors, name: ''}); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-1 font-medium">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-ink uppercase tracking-wider mb-2">
                Email Address <span className="text-brand-terracotta">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                <input
                  type="email"
                  placeholder="e.g. noura@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (errors.email) setErrors({...errors, email: ''}); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
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
                  <label className="block text-xs font-semibold text-brand-ink uppercase tracking-wider mb-2">
                    Account Password <span className="text-brand-terracotta">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                    <PasswordField
                      placeholder="••••••••"
                      value={password}
                      onChange={ v => { setPassword(v); if (errors.password) setErrors({...errors, password: ''}); }}
                      className="w-full bg-brand-sand/20 border border-brand-clay rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
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
                  <label className="block text-xs font-semibold text-brand-ink uppercase tracking-wider mb-2">
                    Confirm Password <span className="text-brand-terracotta">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-charcoal/40" />
                    <PasswordField
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={ v => { setConfirmPassword(v); if (errors.confirmPassword) setErrors({...errors, confirmPassword: ''}); }}
                      className="w-full bg-brand-sand/20 border border-brand-clay rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                    />
                  </div>
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 font-medium">{errors.confirmPassword}</p>}
                </div>
              </>
            )}

            <div className="pt-4">
              <button
                type="submit"
                className="w-full cursor-pointer bg-brand-terracotta text-brand-cream font-semibold py-4 rounded-2xl shadow-card-sm hover:bg-brand-terracotta-hover transition-all flex items-center justify-center gap-2 text-base"
              >
                <span>Continue to Payment</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted pt-2">
              <ShieldCheck className="h-4 w-4 text-brand-sage" />
              <span>Your contact details are encrypted and used solely for workshop management.</span>
            </div>
          </form>

        </div>

        {/* Right Summary Column */}
        <div className="lg:col-span-5">
          <div className="bg-brand-sand/30 rounded-[28px] p-6 border border-brand-clay space-y-4">
            <h3 className="font-display text-lg font-semibold text-brand-charcoal border-b border-brand-clay pb-3">
              Order Summary
            </h3>

            <div className="flex gap-4">
              <img
                src={birthday ? (birthdayPackage?.image || workshop.image) : workshop.image}
                alt={birthday ? (birthdayPackage?.name || 'Birthday package') : workshop.title}
                className="w-20 h-20 rounded-2xl object-cover shrink-0 bg-brand-sand border border-brand-clay"
              />
              <div>
                <span className="text-[10px] font-semibold text-brand-sage uppercase tracking-wider block">
                  {birthday ? 'Birthday Package' : workshop.category}
                </span>
                <h4 className="font-semibold text-brand-charcoal text-sm leading-tight">{pendingBooking.workshopTitle}</h4>
                <p className="text-xs text-brand-ink mt-1">
                  {birthday
                    ? `${birthdayPackage?.duration || ''}${birthdayPackage?.ageInformation ? ` • ${birthdayPackage.ageInformation}` : ''}`
                    : `${workshop.duration} • ${workshop.room.split('(')[0]}`}
                </p>
              </div>
            </div>

            <div className="border-t border-brand-clay pt-3 space-y-2 text-xs text-brand-ink">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Slot:</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.time}</span>
              </div>
              <div className="flex justify-between">
                <span>{birthday ? 'Guests:' : 'Participants:'}</span>
                <span className="font-semibold text-brand-charcoal">{pendingBooking.participants} {pendingBooking.participants === 1 ? 'guest' : 'guests'}</span>
              </div>
              <div className="flex justify-between">
                <span>{birthday ? (birthdayPackage?.pricingLabel || 'Per child') : 'Price per person'}:</span>
                <span className="font-semibold text-brand-charcoal">
                  {birthday ? (birthdayPackage?.price ?? 0) : workshop.price} SAR
                </span>
              </div>
              {birthday?.birthdayPersonName && (
                <div className="flex justify-between">
                  <span>Birthday person:</span>
                  <span className="font-semibold text-brand-charcoal">{birthday.birthdayPersonName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-brand-clay pt-3 flex justify-between items-center text-brand-charcoal">
              <span className="font-semibold text-sm">{birthday ? 'Deposit Due:' : 'Total Due:'}</span>
              <span className="font-serif text-xl font-semibold text-brand-terracotta">{pendingBooking.totalPrice} SAR</span>
            </div>
          </div>
        </div>

      </div>

      {/* Quick Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 bg-brand-charcoal/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-brand-cream rounded-[28px] p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-brand-clay text-start animate-in zoom-in-95 duration-150">
            <h3 className="font-display text-xl font-semibold text-brand-charcoal mb-2">Sign In</h3>
            <p className="text-xs text-brand-ink mb-4">Enter your email to quickly sign in and autofill your details.</p>
            
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
                    className="font-semibold underline cursor-pointer"
                  >
                    Set up your password
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleQuickLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-1">Email or phone</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. noura@example.com or 0501234567"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setModalError(null); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-ink mb-1">Password</label>
                <PasswordField
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={ v => { setLoginPassword(v); setModalError(null); }}
                  className="w-full bg-brand-sand/20 border border-brand-clay rounded-xl py-2.5 px-3 text-sm font-semibold text-brand-charcoal"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLoginModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-brand-clay text-xs font-semibold text-brand-charcoal hover:bg-brand-sand cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-terracotta text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover cursor-pointer"
                >
                  Sign In
                </button>
              </div>

              {/* Forgot password, same as every other sign-in surface. */}
              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleModalForgotPassword}
                  className="text-[11px] font-semibold text-brand-muted hover:text-brand-terracotta cursor-pointer"
                >
                  Forgot password?
                </button>
                {/* Worded the same whether or not the address is registered. */}
                {resetSent && (
                  <p className="text-[11px] font-semibold text-brand-sage leading-relaxed">{resetSent}</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
