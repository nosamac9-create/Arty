/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PasswordField } from './PasswordField';
import { useApp } from '../context/AppContext';
import { Palette, Mail, Lock, User, Check, AlertCircle, ArrowLeft, LogIn, KeyRound, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { PhoneInput } from './PhoneInput';
import { validatePhone, normalisePhone } from '../utils/phoneUtils';
import {
  validateCustomerForm, canonicalEmail, canonicalPhone, passwordChecklist,
  validatePasswordRule, validatePasswordConfirmation
} from '../utils/validation';

export const AuthSection: React.FC = () => {
  const { 
    authScreen, setAuthScreen, currentUser, setCurrentUser, setCustomerTab, 
    loginCustomer, claimCustomerAccount, registerCustomer, requestPasswordReset,
    logoutCustomer, pendingBooking 
  } = useApp();

  // Common Inputs
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** Set when the typed account exists but has no password yet. */
  const [claimIdentifier, setClaimIdentifier] = useState<string | null>(null);
  const [claimPassword, setClaimPassword] = useState('');
  const [claimConfirm, setClaimConfirm] = useState('');
  // Field-keyed messages from the shared validation layer.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password Recovery States
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  /** The non-committal confirmation shown after a reset request. */
  const [resetSent, setResetSent] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const loginInput = loginIdentifier || email;
    const res = await loginCustomer(loginInput, password);
    setIsSubmitting(false);

    if (!res.success) {
      // The record exists but was created at the counter without a password.
      // Offer to claim it rather than leaving them stuck.
      if (res.needsPasswordSetup) {
        setClaimIdentifier(loginInput);
        setClaimPassword('');
        setClaimConfirm('');
      }
      setErrorMsg(res.error || 'Invalid credentials.');
      return;
    }

    if (pendingBooking) {
      setCustomerTab('checkout-info');
    } else {
      setCustomerTab('my-bookings');
    }
  };

  /** Attaches a password to the existing record — never creates a new one. */
  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const match = validatePasswordConfirmation(claimPassword, claimConfirm);
    if (!match.valid) {
      setErrorMsg(match.error!);
      return;
    }

    setIsSubmitting(true);
    const res = await claimCustomerAccount(claimIdentifier || '', claimPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Could not set up your password.');
      return;
    }

    setClaimIdentifier(null);
    setClaimPassword('');
    setClaimConfirm('');
    setPassword('');
    if (pendingBooking) setCustomerTab('checkout-info');
    else setCustomerTab('my-bookings');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Every rule comes from the shared validation layer, including the
    // duplicate phone/email checks against the customers table.
    const fieldErrors = await validateCustomerForm(
      { name: fullName, email, phone, password, confirmPassword },
      { requirePassword: true }
    );
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setIsSubmitting(true);
    const res = await registerCustomer({
      name: fullName.trim(),
      // Stored in the one canonical format, so duplicate checks match later.
      email: canonicalEmail(email),
      phone: canonicalPhone(phone),
      password
    });
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Registration failed.');
      return;
    }

    if (pendingBooking) {
      setCustomerTab('checkout-info');
    } else {
      setCustomerTab('my-bookings');
    }
  };

  // Step 1: Request Password Recovery Code
  /**
   * Sends the reset link through Supabase Auth.
   *
   * Auth is the proof of ownership — only whoever can open the inbox finishes
   * the reset. The flow this replaces accepted a hardcoded "123456" code, so
   * anyone could reset any account.
   *
   * The confirmation reads the same whether or not the address is registered,
   * so it cannot be used to discover which emails exist.
   */
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSent(null);
    setIsSubmitting(true);

    const res = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Could not send the reset link.');
      return;
    }
    setResetSent(res.message || 'If an account exists for that address, a reset link is on its way.');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
      
      {/* Already Logged In Panel */}
      {currentUser ? (
        <div className="max-w-md mx-auto bg-white border border-brand-clay rounded-[28px] p-8 text-center space-y-6 shadow-card-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta text-brand-cream">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand-charcoal">Logged in successfully</h2>
            <p className="text-sm text-brand-ink mt-1.5 font-semibold">Welcome back, {currentUser.name}</p>
            <p className="text-xs text-brand-muted mt-1">{currentUser.email}</p>
          </div>

          {pendingBooking && (
            <div className="p-3 bg-brand-sand/40 border border-brand-clay rounded-xl text-xs font-semibold text-brand-charcoal text-start">
              📌 You have an active booking draft for: <span className="font-semibold text-brand-terracotta">{pendingBooking.workshopTitle}</span> ({pendingBooking.date})
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={() => setCustomerTab(pendingBooking ? 'checkout-info' : 'my-bookings')}
              className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3 text-xs font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors"
            >
              {pendingBooking ? 'Continue Booking' : 'View My Bookings'}
            </button>
            <button
              onClick={() => {
                logoutCustomer();
                setAuthScreen('login');
              }}
              className="w-full cursor-pointer rounded-xl bg-brand-sand py-3 text-xs font-semibold text-brand-charcoal hover:bg-brand-clay/50 transition-colors"
            >
              Log Out Account
            </button>
          </div>
        </div>
      ) : (
        /* SPLIT SCREEN LAYOUT */
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-[28px] border border-brand-clay overflow-hidden shadow-card-sm max-w-5xl mx-auto lg:min-h-[550px]">
          
          {/* Left Column: Warm Cafe Photo with Overlay */}
          <div className="lg:col-span-5 relative hidden lg:block bg-brand-sand min-h-full">
            <img
              src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"
              alt="Cozy Arty Cafe interior in Jeddah"
              className="absolute inset-0 w-full h-full object-cover filter brightness-[0.75]"
              referrerPolicy="no-referrer"
            />
            
            {/* Logo overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-10 text-start bg-gradient-to-t from-brand-charcoal/80 via-transparent to-brand-charcoal/40 text-brand-cream">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-terracotta text-brand-cream">
                  <Palette className="h-5 w-5" />
                </div>
                <span className="font-display text-xl font-semibold">Arty Café</span>
              </div>
              
              <div className="space-y-3">
                <p className="font-display text-3xl font-semibold leading-tight">Your wheel is waiting.</p>
                <p className="text-sm text-brand-cream/80 max-w-xs font-medium">
                  Log in to track your clay pieces, review upcoming workshop sessions, and manage reservations easily.
                </p>
              </div>

              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">Jeddah, Saudi Arabia</span>
            </div>
          </div>

          {/* Right Column: Form Column */}
          <div className="lg:col-span-7 bg-brand-cream p-8 md:p-12 flex flex-col justify-center text-start">
            
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p>{errorMsg}</p>
                  {errorMsg.includes('already exists') && (
                    <button
                      type="button"
                      onClick={() => { setErrorMsg(null); setAuthScreen('login'); }}
                      className="mt-2 text-xs font-semibold text-red-800 underline cursor-pointer"
                    >
                      Click here to Sign In
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 1. LOGIN SCREEN */}
            {authScreen === 'login' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-3xl font-semibold text-brand-charcoal">Welcome back</h2>
                  <p className="text-xs text-brand-muted mt-1">Access your bookings and pottery pieces tracker.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Email address or Phone number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. noura@amri.sa or +966501234567"
                      value={loginIdentifier}
                      onChange={e => { setLoginIdentifier(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-brand-ink">Password</label>
                      <button
                        type="button"
                        onClick={() => { 
                          setErrorMsg(null); 
                          setAuthScreen('forgot'); 
                          setResetSent(null);
                        }}
                        className="text-xs font-semibold text-brand-terracotta hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <PasswordField
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={ v => { setPassword(v); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-2 flex items-center justify-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{isSubmitting ? 'Signing in...' : 'Log In'}</span>
                  </button>
                </form>

                {/* Claim an account created at the counter. The password is
                    attached to that existing record, so their bookings, visits
                    and pottery stay on one customer. */}
                {claimIdentifier && (
                  <form onSubmit={handleClaimAccount} className="space-y-3 p-4 bg-brand-sand/30 border border-brand-clay rounded-2xl">
                    <div>
                      <h3 className="text-sm font-semibold text-brand-charcoal">Set up your password</h3>
                      <p className="text-[11px] text-brand-muted mt-0.5 leading-relaxed">
                        We already have <span className="font-semibold">{claimIdentifier}</span> on file from a
                        visit or booking. Choose a password to claim that account — your history stays with it.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-brand-ink">New password *</label>
                      <PasswordField
                        required
                        placeholder="••••••••"
                        value={claimPassword}
                        onChange={ v => { setClaimPassword(v); setErrorMsg(null); }}
                        className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
                      />
                      <ul className="space-y-0.5 pt-0.5">
                        {passwordChecklist(claimPassword).map(item => (
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-brand-ink">Confirm password *</label>
                      <PasswordField
                        required
                        placeholder="••••••••"
                        value={claimConfirm}
                        onChange={ v => { setClaimConfirm(v); setErrorMsg(null); }}
                        className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 cursor-pointer rounded-xl bg-brand-terracotta py-3 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Set password & continue'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setClaimIdentifier(null); setErrorMsg(null); }}
                        className="px-4 rounded-xl border border-brand-clay text-xs font-semibold text-brand-muted cursor-pointer hover:bg-brand-sand/40"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <div className="text-center pt-4 border-t border-brand-clay">
                  <p className="text-xs font-medium text-brand-ink">
                    New here?{' '}
                    <button
                      onClick={() => { setErrorMsg(null); setAuthScreen('register'); }}
                      className="text-brand-terracotta font-semibold hover:underline cursor-pointer"
                    >
                      Create an account
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* 2. REGISTRATION SCREEN */}
            {authScreen === 'register' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-3xl font-semibold text-brand-charcoal">Join the Café</h2>
                  <p className="text-xs text-brand-muted mt-1">Create an account to begin tracking mud creations.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Full name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Noura Al-Amri"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); setErrorMsg(null); clearError('name'); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                    {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Email address *</label>
                    <input
                      type="email"
                      required
                      placeholder="noura@amri.sa"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErrorMsg(null); clearError('email'); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                    {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
                  </div>

                  {/* Phone with Country Code Dropdown */}
                  <PhoneInput
                    label="Phone number"
                    required
                    value={phone}
                    error={errors.phone}
                    onChange={(val) => { setPhone(val); setErrorMsg(null); clearError('phone'); }}
                  />

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Password *</label>
                    <PasswordField
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={ v => { setPassword(v); setErrorMsg(null); clearError('password'); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                    {/* Live checklist, updating as they type. */}
                    <ul className="space-y-0.5 pt-0.5">
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
                    {errors.password && <p className="text-xs text-red-500 font-medium">{errors.password}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Confirm password *</label>
                    <PasswordField
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={ v => { setConfirmPassword(v); setErrorMsg(null); clearError('confirmPassword'); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                    {errors.confirmPassword && (
                      <p className="text-xs text-red-500 font-medium">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-4"
                  >
                    {isSubmitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                <div className="text-center pt-4 border-t border-brand-clay">
                  <p className="text-xs font-medium text-brand-ink">
                    Already have an account?{' '}
                    <button
                      onClick={() => { setErrorMsg(null); setAuthScreen('login'); }}
                      className="text-brand-terracotta font-semibold hover:underline cursor-pointer"
                    >
                      Log in
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* 3. FORGOT PASSWORD RECOVERY FLOW */}
            {authScreen === 'forgot' && (
              <div className="space-y-6">

                <button
                  onClick={() => { setErrorMsg(null); setAuthScreen('login'); setResetSent(null); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-terracotta hover:underline cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to login</span>
                </button>

                <div>
                  <h2 className="font-display text-3xl font-semibold text-brand-charcoal">Password Recovery</h2>
                  <p className="text-xs text-brand-muted mt-1">
                    We will email you a secure link to set a new password.
                  </p>
                </div>

                {/* Method selector. Phone is offered but not yet available. */}
                <div className="grid grid-cols-2 gap-2 bg-brand-sand/30 p-1 rounded-xl border border-brand-clay">
                  <button
                    type="button"
                    onClick={() => setForgotMethod('email')}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      forgotMethod === 'email' ? 'bg-brand-cream text-brand-terracotta shadow-card-sm' : 'text-brand-muted'
                    }`}
                  >
                    Email Recovery
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotMethod('phone')}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      forgotMethod === 'phone' ? 'bg-brand-cream text-brand-terracotta shadow-card-sm' : 'text-brand-muted'
                    }`}
                  >
                    Phone Recovery
                  </button>
                </div>

                {forgotMethod === 'email' ? (
                  <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-brand-ink">Registered Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. noura@amri.sa"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setResetSent(null); setErrorMsg(null); }}
                        className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                      />
                    </div>

                    {/* Worded identically whether or not the address is on file,
                        so this cannot be used to probe for accounts. */}
                    {resetSent && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{resetSent}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>{isSubmitting ? 'Sending reset link...' : 'Email me a reset link'}</span>
                    </button>
                  </form>
                ) : (
                  /*
                   * PHONE RECOVERY — deliberately not implemented.
                   *
                   * ⚠️ OWNERSHIP VERIFICATION
                   * A phone reset must prove the caller controls the number.
                   * Knowing it is not proof: a walk-in's number is known to
                   * anyone who has seen the booking sheet, and resetting on that
                   * basis hands over the account.
                   * TODO(stage-2): once phone auth is enabled in Supabase this is
                   * where supabase.auth.signInWithOtp({ phone }) and verifyOtp go.
                   * Until then the customer is routed to email.
                   */
                  <div className="space-y-4">
                    <div className="p-4 bg-brand-sand/40 border border-brand-clay rounded-2xl text-xs text-brand-ink space-y-1.5">
                      <p className="font-semibold text-brand-charcoal">Phone recovery — coming soon</p>
                      <p className="leading-relaxed">
                        We can only reset a password once we can confirm the account is yours.
                        SMS verification is not switched on yet, so please use email recovery.
                        If there is no email on your record, call the studio on +966 54 822 2055.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setForgotMethod('email'); setErrorMsg(null); }}
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors"
                    >
                      Use email recovery instead
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
