/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PasswordField } from './PasswordField';
import { useApp } from '../context/AppContext';
import { ScrollReveal } from './ui/ScrollReveal';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Palette, Mail, Lock, User, Check, AlertCircle, ArrowLeft, LogIn, KeyRound, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { PhoneInput } from './PhoneInput';
import { AuthBackdrop } from './AuthBackdrop';
import { validatePhone, normalisePhone } from '../utils/phoneUtils';
import {
  validateCustomerForm, canonicalEmail, canonicalPhone, passwordChecklist,
  validatePasswordRule, validatePasswordConfirmation
} from '../utils/validation';

/** Staggered fade-up for the title block over the photograph. */
const textVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1, ease: 'easeOut' as const } }
};

/**
 * The overlay copy, in four parts so the composition is a hierarchy rather
 * than one large caption: a small sans kicker, the serif line that carries the
 * meaning, an emphasised close, and a quiet supporting sentence.
 *
 * Both tabs use the same four slots, so switching changes the words and never
 * the shape of the block. Placeholder wording — the studio edits these.
 */
const AUTH_OVERLAY = {
  login: {
    kicker: 'Returning maker',
    lead: 'Where clay',
    accent: 'meets calm.',
    support: 'Your wheel, your shelf, and every piece you have made are waiting.'
  },
  register: {
    kicker: 'Your first piece',
    lead: 'Every masterpiece begins with',
    accent: 'a single touch of clay.',
    support: 'Follow each piece from the wheel to the kiln to the shelf.'
  }
} as const;

/** Each line arrives just behind the one above it. */
const overlayLineVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } }
};

/** The form swapping between logging in and signing up. */
const formVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: 'easeIn' as const } }
};

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
    <div
      className={
        currentUser
          ? 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300'
          : // Signed out, the page is a split screen and each half sets its own
            // padding — no shared gutter here.
            'w-full animate-in fade-in duration-300'
      }
    >

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
        /* SPLIT SCREEN: the slideshow and the title on one half, the form on a
           solid panel on the other. On phones the halves stack — the image
           becomes a banner rather than a full screen, so the fields are not
           pushed below the fold.

           `items-start` is what decouples the two columns: a grid item
           stretches to the tallest row by default, which is why the taller
           sign-up form was making the image column grow and re-crop the
           photograph. */
        <div className="grid grid-cols-1 items-start lg:grid-cols-2 lg:min-h-[calc(100vh-5rem)]">

        {/* IMAGE HALF. The slideshow is contained to this column, so the form
            never sits over a moving photograph. */}
        {/* Fixed to the viewport below the header on desktop, so the crop is
            identical whichever form is showing, and pinned while a longer form
            scrolls past it. */}
        <div className="relative overflow-hidden flex items-end justify-center h-[40vh] min-h-[260px] p-6 sm:p-10 lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:min-h-[calc(100vh-5rem)] lg:p-14">
          <AuthBackdrop />

          {/* EDITORIAL OVERLAY — a kicker, a rule, the serif line, then the
              supporting sentence. Anchored to the lower-left of the frame and
              held to a narrow measure so it reads as part of the photograph
              rather than a caption laid across it.

              Keyed on the screen so the tab swap plays, and `wait` so the two
              never overlap on top of a moving image. The stagger comes from the
              parent; the shadow is what keeps it legible as the slideshow moves
              underneath, since the scrim alone is not enough for text this
              size. */}
          <AnimatePresence mode="wait" initial={false}>
            {(authScreen === 'login' || authScreen === 'register') && (() => {
              const copy = AUTH_OVERLAY[authScreen];
              return (
                <motion.figure
                  key={authScreen}
                  initial={prefersReducedMotion ? false : 'initial'}
                  animate="animate"
                  exit={prefersReducedMotion ? undefined : 'exit'}
                  variants={{
                    animate: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 } },
                    exit: { transition: { staggerChildren: 0 } }
                  }}
                  className="relative z-10 w-full max-w-lg text-center lg:text-start auth-heading-shadow"
                >
                  {/* Kicker — sans, wide-tracked, sage. The one accent colour. */}
                  <motion.figcaption
                    variants={overlayLineVariants}
                    className="flex items-center justify-center gap-3 lg:justify-start"
                  >
                    <span className="hidden h-px w-10 bg-brand-sage/70 lg:block" aria-hidden="true" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-sage">
                      {copy.kicker}
                    </span>
                  </motion.figcaption>

                  {/* The line itself. The close is set in italic so the phrase
                      turns without needing a second size or weight. */}
                  <motion.blockquote
                    variants={overlayLineVariants}
                    className="auth-title mt-5 text-[30px] leading-[1.12] text-brand-cream sm:text-[40px] lg:text-[46px]"
                  >
                    {copy.lead}{' '}
                    <span className="italic text-brand-cream/90">{copy.accent}</span>
                  </motion.blockquote>

                  <motion.div
                    variants={overlayLineVariants}
                    aria-hidden="true"
                    className="mx-auto mt-7 h-px w-16 bg-brand-cream/35 lg:mx-0"
                  />

                  <motion.p
                    variants={overlayLineVariants}
                    className="mx-auto mt-5 max-w-sm text-sm font-medium leading-relaxed text-brand-cream/75 lg:mx-0"
                  >
                    {copy.support}
                  </motion.p>

                  <motion.p
                    variants={overlayLineVariants}
                    className="mt-8 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-cream/45"
                  >
                    Arty Café · Jeddah
                  </motion.p>
                </motion.figure>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* FORM HALF — a solid panel, so the fields read against a flat
            surface rather than a photograph. */}
        <div className="flex min-h-full items-center justify-center bg-brand-cream px-4 py-10 sm:px-8 lg:min-h-[calc(100vh-5rem)] lg:px-14 lg:py-16">
        {/* `layout` animates the height between the two forms. The fixed
            min-height it replaces was the resize bug: it held the card at
            550px whatever the login form actually needed, so returning from
            the taller sign-up form left dead space below the fields. The card
            now sizes to its own content in both directions. */}
        <motion.div
          layout={!prefersReducedMotion}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-md"
        >

          {/* TABS — the primary switch between the two forms. Password
              recovery is reached from inside the sign-in form, so it is not a
              tab: it is a detour, not a third destination. The pill slides
              between them with a shared layout id rather than a width
              transition, so it tracks whatever the labels measure. */}
          {(authScreen === 'login' || authScreen === 'register') && (
            <div
              role="tablist"
              aria-label="Account"
              className="mb-8 grid grid-cols-2 gap-1 rounded-full border border-brand-clay bg-brand-sand/50 p-1"
            >
              {([
                { screen: 'login' as const, label: 'Sign In' },
                { screen: 'register' as const, label: 'Create Account' }
              ]).map(tab => {
                const isOn = authScreen === tab.screen;
                return (
                  <button
                    key={tab.screen}
                    type="button"
                    role="tab"
                    aria-selected={isOn}
                    onClick={() => { setErrorMsg(null); setAuthScreen(tab.screen); }}
                    className={`relative cursor-pointer rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                      isOn ? 'text-brand-cream' : 'text-brand-ink hover:text-brand-charcoal'
                    }`}
                  >
                    {isOn && (
                      <motion.span
                        layoutId={prefersReducedMotion ? undefined : 'auth-tab-pill'}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full bg-brand-terracotta"
                      />
                    )}
                    <span className="relative">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Keyed on the screen so the outgoing form actually plays its exit
              before the incoming one arrives — without a changing key React
              would reuse the node and neither transition would run. `wait`
              keeps the two forms from overlapping while the card resizes. */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={authScreen}
            variants={formVariants}
            initial={prefersReducedMotion ? false : 'initial'}
            animate="animate"
            exit={prefersReducedMotion ? undefined : 'exit'}
            className="flex flex-col justify-center text-start"
          >

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
                  <p className="mt-1.5 text-sm text-brand-ink">
                    Access your bookings and pottery pieces tracker.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Email address or Phone number</label>
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
                      <label className="text-xs font-bold text-brand-charcoal/80">Password</label>
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
                        <label className="text-xs font-bold text-brand-charcoal/80">Your email address *</label>
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
                      <label className="text-xs font-bold text-brand-charcoal/80">New password *</label>
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
                      <label className="text-xs font-bold text-brand-charcoal/80">Confirm password *</label>
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

                <div className="text-center pt-2">
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
                  <p className="mt-1.5 text-sm text-brand-ink">
                    Create an account to begin tracking mud creations.
                  </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Full name *</label>
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
                    <label className="text-xs font-bold text-brand-charcoal/80">Email address *</label>
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
                    <label className="text-xs font-bold text-brand-charcoal/80">Password *</label>
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
                    <label className="text-xs font-bold text-brand-charcoal/80">Confirm password *</label>
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

                <div className="text-center pt-2">
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
                      <label className="text-xs font-bold text-brand-charcoal/80">Registered Email Address</label>
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

          </motion.div>
          </AnimatePresence>

        </motion.div>
        </div>

        </div>
      )}

    </div>
  );
};
