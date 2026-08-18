/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PasswordField } from './PasswordField';
import { useApp } from '../context/AppContext';
import { ScrollReveal } from './ui/ScrollReveal';
import { motion, useReducedMotion } from 'motion/react';
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
    logoutCustomer, pendingBooking, changeCustomerPassword 
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
  /** Masked form of the address on the record, e.g. "n****a@gmail.com". */
  const [claimEmailHint, setClaimEmailHint] = useState<string | null>(null);
  /** Typed when claiming by phone: the account needs an address to confirm. */
  const [claimEmail, setClaimEmail] = useState('');
  // Field-keyed messages from the shared validation layer.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Change-password state for the account page.
  const prefersReducedMotion = useReducedMotion();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  /** Sets a new password for whoever is signed in. Nothing else is editable. */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);

    const match = validatePasswordConfirmation(newPassword, confirmNewPassword);
    if (!match.valid) {
      setPasswordError(match.error!);
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await changeCustomerPassword(newPassword);
      if (!res.success) {
        setPasswordError(res.error || 'Could not change your password.');
        return;
      }
      setShowPasswordForm(false);
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMsg('Your password has been changed. Use it next time you sign in.');
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    } finally {
      setIsSavingPassword(false);
    }
  };

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
        setClaimEmail('');
        setClaimEmailHint(res.claimEmailHint || null);
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
    // Claiming by phone needs an address for the confirmation link; claiming by
    // email already has one.
    const res = await claimCustomerAccount(claimIdentifier || '', claimPassword, claimEmail || undefined);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Could not set up your password.');
      return;
    }

    setClaimIdentifier(null);
    setClaimPassword('');
    setClaimConfirm('');
    setClaimEmail('');
    setClaimEmailHint(null);
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
      
      {/* ACCOUNT DETAILS — read-only profile; the only thing changeable
          here is the password. */}
      {currentUser ? (
        <div className="mx-auto max-w-2xl space-y-6">

          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="text-start">
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand-charcoal">
                Account Details
              </h1>
              <p className="mt-2 text-brand-ink">Manage your Arty Café profile</p>
            </div>
          </ScrollReveal>

          {/* Avatar + name */}
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
            transition={{ delay: 0.12, duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="flex items-center gap-4 rounded-[28px] border border-brand-clay bg-white p-6 shadow-card-sm text-start">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-terracotta font-display text-2xl font-semibold text-brand-cream"
                aria-hidden="true"
              >
                {(currentUser.name || currentUser.email || '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-brand-charcoal truncate">
                  {currentUser.name || 'Your account'}
                </p>
                <p className="mt-0.5 text-sm text-brand-muted truncate">{currentUser.email}</p>
              </div>
            </div>
          </ScrollReveal>

          {/* Read-only profile. Deliberately not inputs — these are changed by
              the studio, not here. */}
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
            transition={{ delay: 0.24, duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="rounded-[28px] border border-brand-clay bg-white p-6 sm:p-7 shadow-card-sm text-start">
              <h2 className="font-display text-lg font-semibold text-brand-charcoal">Profile</h2>
              <p className="mt-1 text-xs text-brand-muted">
                Ask the studio if any of these need changing.
              </p>

              <dl className="mt-5 text-sm">
                {[
                  { label: 'Full Name', value: currentUser.name },
                  { label: 'Email Address', value: currentUser.email },
                  { label: 'Phone Number', value: currentUser.phone }
                ].map(row => (
                  <div key={row.label} className="border-t border-brand-clay py-4 last:border-b">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-muted">
                      {row.label}
                    </dt>
                    <dd className={`mt-1.5 break-words ${row.value ? 'text-brand-charcoal ltr-numerals' : 'text-brand-muted italic'}`}>
                      {row.value || 'Not on file'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </ScrollReveal>

          {/* The one action: a new password. */}
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
            transition={{ delay: 0.36, duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="rounded-[28px] border border-brand-clay bg-white p-6 sm:p-7 shadow-card-sm text-start">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-brand-charcoal">Password</h2>
                  <p className="mt-1 text-xs text-brand-muted">
                    Choose a new password for signing in.
                  </p>
                </div>
                {!showPasswordForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(true);
                      setPasswordMsg(null);
                      setPasswordError(null);
                    }}
                    className="shrink-0 cursor-pointer rounded-full border border-brand-clay bg-brand-cream px-5 py-2.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-clay-soft"
                  >
                    Change Password
                  </button>
                )}
              </div>

              {showPasswordForm && (
                <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">New password *</label>
                    <PasswordField
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={v => { setNewPassword(v); setPasswordError(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
                    />
                    <ul className="space-y-0.5 pt-0.5">
                      {passwordChecklist(newPassword).map(item => (
                        <li
                          key={item.label}
                          className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                            item.met ? 'text-brand-sage' : 'text-brand-muted'
                          }`}
                        >
                          <span>{item.met ? '✓' : '•'}</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-brand-ink">Confirm new password *</label>
                    <PasswordField
                      required
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={v => { setConfirmNewPassword(v); setPasswordError(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
                    />
                  </div>

                  {passwordError && (
                    <p className="text-xs font-semibold text-red-600">{passwordError}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={isSavingPassword}
                      className="cursor-pointer rounded-full bg-brand-terracotta px-6 py-3 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingPassword ? 'Saving…' : 'Save new password'}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingPassword}
                      onClick={() => {
                        setShowPasswordForm(false);
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setPasswordError(null);
                      }}
                      className="cursor-pointer rounded-full border border-brand-clay px-5 py-3 text-sm font-semibold text-brand-muted transition-colors hover:bg-brand-sand/40 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {passwordMsg && (
                <p className="mt-4 rounded-xl border border-brand-sage-line bg-brand-sage-soft px-4 py-3 text-xs font-semibold text-brand-sage-hover">
                  {passwordMsg}
                </p>
              )}
            </div>
          </ScrollReveal>

          {/* Actions */}
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.2, margin: '0px 0px -80px 0px' }}
            transition={{ delay: 0.48, duration: 0.5, ease: 'easeOut' }}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          >
            <div className="space-y-3">
              {pendingBooking && (
                <div className="rounded-[22px] border border-brand-clay bg-brand-sand/40 p-4 text-xs font-semibold text-brand-charcoal text-start">
                  📌 You have an active booking draft for:{' '}
                  <span className="text-brand-terracotta">{pendingBooking.workshopTitle}</span> ({pendingBooking.date})
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setCustomerTab(pendingBooking ? 'checkout-info' : 'my-bookings')}
                  className="flex-1 cursor-pointer rounded-full bg-brand-terracotta px-6 py-3.5 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover"
                >
                  {pendingBooking ? 'Continue Booking' : 'View My Bookings'}
                </button>
                <button
                  onClick={() => {
                    logoutCustomer();
                    setAuthScreen('login');
                  }}
                  className="flex-1 cursor-pointer rounded-full border border-brand-clay bg-brand-cream px-6 py-3.5 text-sm font-semibold text-brand-charcoal transition-colors hover:bg-brand-clay-soft"
                >
                  Log Out
                </button>
              </div>
            </div>
          </ScrollReveal>

        </div>
      ) : (
        /* SPLIT SCREEN LAYOUT — the same entrance the Custom Events card
           uses: the panel wipes in from the side while the card rises. */
        <ScrollReveal
          once
          viewOptions={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          className="max-w-5xl mx-auto"
        >
        {/* `layout` animates the height between the two forms. The fixed
            min-height it replaces was the resize bug: it held the card at
            550px whatever the login form actually needed, so returning from
            the taller sign-up form left dead space below the fields. The card
            now sizes to its own content in both directions. */}
        <motion.div
          layout={!prefersReducedMotion}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="grid grid-cols-1 lg:grid-cols-12 rounded-[28px] border border-brand-clay overflow-hidden shadow-card-sm"
        >
          
          {/* Left Column: the studio, with just the overlay copy on top —
              no brand chip, no location label. */}
          {/* The observed element is never clipped: an element clipped to zero
              area reports zero intersection, so useInView would never fire and
              the reveal would hold it invisible for good. The wipe lives on an
              inner element that inherits the variant instead. */}
          <ScrollReveal
            once
            viewOptions={{ once: true, amount: 0.15 }}
            transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            className="lg:col-span-5 relative hidden lg:block bg-brand-sand min-h-full"
          >
            <motion.div
              className="absolute inset-0"
              variants={{
                hidden: { clipPath: 'inset(0 100% 0 0)' },
                visible: { clipPath: 'inset(0 0% 0 0)' }
              }}
              transition={{ delay: 0.15, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
            <img
              src="/images/auth-panel.jpg"
              alt="The Arty Café studio in Jeddah"
              className="absolute inset-0 w-full h-full object-cover filter brightness-[0.75]"
            />

            <div className="absolute inset-0 flex flex-col justify-end p-10 text-start bg-gradient-to-t from-brand-charcoal/80 via-transparent to-brand-charcoal/40 text-brand-cream">
              <div className="space-y-3">
                <p className="font-display text-3xl font-semibold leading-tight">Your wheel is waiting.</p>
                <p className="text-sm text-brand-cream/80 max-w-xs font-medium">
                  Log in to track your clay pieces, review upcoming workshop sessions, and manage reservations easily.
                </p>
              </div>
            </div>
            </motion.div>
          </ScrollReveal>

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
                    className="w-full cursor-pointer rounded-full bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-2 flex items-center justify-center gap-2"
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

                    {/* Claiming by phone: the account is created against an
                        address, and the confirmation link proves it is yours.
                        It has to be the address already on the record. */}
                    {!claimIdentifier.includes('@') && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-brand-ink">Your email address *</label>
                        <input
                          type="email"
                          required
                          value={claimEmail}
                          onChange={e => { setClaimEmail(e.target.value); setErrorMsg(null); }}
                          placeholder={claimEmailHint || 'you@example.com'}
                          className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-sm font-semibold text-brand-charcoal"
                        />
                        <p className="text-[11px] text-brand-muted leading-relaxed">
                          {claimEmailHint
                            ? `Use the address on your record — it looks like ${claimEmailHint}. We will send a confirmation link to it.`
                            : 'We will send a confirmation link to this address to finish claiming your account.'}
                        </p>
                      </div>
                    )}

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
                        className="flex-1 cursor-pointer rounded-full bg-brand-terracotta py-3 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Set password & continue'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setClaimIdentifier(null); setErrorMsg(null); }}
                        className="px-4 rounded-full border border-brand-clay text-xs font-semibold text-brand-muted cursor-pointer hover:bg-brand-sand/40"
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
                    className="w-full cursor-pointer rounded-full bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-4"
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
                <div className="grid grid-cols-2 gap-2 bg-brand-sand/30 p-1 rounded-full border border-brand-clay">
                  <button
                    type="button"
                    onClick={() => setForgotMethod('email')}
                    className={`py-2 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
                      forgotMethod === 'email' ? 'bg-brand-cream text-brand-terracotta shadow-card-sm' : 'text-brand-muted'
                    }`}
                  >
                    Email Recovery
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotMethod('phone')}
                    className={`py-2 text-xs font-semibold rounded-full transition-colors cursor-pointer ${
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
                      className="w-full cursor-pointer rounded-full bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-card-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
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
                      className="w-full cursor-pointer rounded-full bg-brand-terracotta py-3.5 text-sm font-semibold text-brand-cream hover:bg-brand-terracotta-hover transition-colors"
                    >
                      Use email recovery instead
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>

        </motion.div>
        </ScrollReveal>
      )}

    </div>
  );
};
