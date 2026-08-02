/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Palette, Mail, Lock, User, Check, AlertCircle, ArrowLeft, LogIn, KeyRound, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { PhoneInput } from './PhoneInput';
import { validatePhone, normalisePhone } from '../utils/phoneUtils';

export const AuthSection: React.FC = () => {
  const { 
    authScreen, setAuthScreen, currentUser, setCurrentUser, setCustomerTab, 
    loginCustomer, registerCustomer, resetCustomerPassword, logoutCustomer, pendingBooking 
  } = useApp();

  // Common Inputs
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password Recovery States
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset' | 'success'>('request');
  const [forgotMethod, setForgotMethod] = useState<'email' | 'phone'>('email');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const loginInput = loginIdentifier || email;
    const res = await loginCustomer(loginInput, password);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials.');
      return;
    }

    if (pendingBooking) {
      setCustomerTab('checkout-info');
    } else {
      setCustomerTab('my-bookings');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.');
      return;
    }

    if (!email || !email.includes('@')) {
      setErrorMsg('Valid email address is required.');
      return;
    }

    if (!phone) {
      setErrorMsg('Phone number is required.');
      return;
    }

    const phoneValidation = validatePhone('+966', phone);
    if (!phoneValidation.isValid) {
      setErrorMsg(phoneValidation.error || 'Valid phone number is required.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const res = await registerCustomer({
      name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
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
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const identifier = forgotMethod === 'email' ? email.trim() : recoveryIdentifier.trim();
    if (!identifier) {
      setErrorMsg(`Please enter your registered ${forgotMethod === 'email' ? 'email address' : 'phone number'}.`);
      return;
    }

    setIsSubmitting(true);
    // Standard mock verification code
    const code = '123456';
    setSentCode(code);

    setTimeout(() => {
      setIsSubmitting(false);
      setForgotStep('verify');
    }, 600);
  };

  // Step 2: Verify Code
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (inputCode.trim() !== sentCode) {
      setErrorMsg('Invalid verification code. Please check the code and try again.');
      return;
    }

    setForgotStep('reset');
  };

  // Step 3: Save New Password
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const targetIdentifier = forgotMethod === 'email' ? email.trim() : recoveryIdentifier.trim();
    const res = await resetCustomerPassword(targetIdentifier, newPassword);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to update password. Please verify account exists.');
      return;
    }

    setForgotStep('success');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 animate-in fade-in duration-300">
      
      {/* Already Logged In Panel */}
      {currentUser ? (
        <div className="max-w-md mx-auto bg-brand-cream border border-brand-clay rounded-3xl p-8 text-center space-y-6 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-terracotta text-brand-cream">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-brand-charcoal">Logged in successfully</h2>
            <p className="text-sm text-brand-charcoal/70 mt-1.5 font-semibold">Welcome back, {currentUser.name}</p>
            <p className="text-xs text-brand-charcoal/50 mt-1">{currentUser.email}</p>
          </div>

          {pendingBooking && (
            <div className="p-3 bg-brand-sand/40 border border-brand-clay/60 rounded-xl text-xs font-semibold text-brand-charcoal text-left">
              📌 You have an active booking draft for: <span className="font-bold text-brand-terracotta">{pendingBooking.workshopTitle}</span> ({pendingBooking.date})
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={() => setCustomerTab(pendingBooking ? 'checkout-info' : 'my-bookings')}
              className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3 text-xs font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors"
            >
              {pendingBooking ? 'Continue Booking' : 'View My Bookings'}
            </button>
            <button
              onClick={() => {
                logoutCustomer();
                setAuthScreen('login');
              }}
              className="w-full cursor-pointer rounded-xl bg-brand-sand py-3 text-xs font-bold text-brand-charcoal hover:bg-brand-clay/50 transition-colors"
            >
              Log Out Account
            </button>
          </div>
        </div>
      ) : (
        /* SPLIT SCREEN LAYOUT */
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-brand-clay overflow-hidden shadow-md max-w-5xl mx-auto min-h-[550px]">
          
          {/* Left Column: Warm Cafe Photo with Overlay */}
          <div className="lg:col-span-5 relative hidden lg:block bg-brand-sand min-h-full">
            <img
              src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80"
              alt="Cozy Arty Cafe interior in Jeddah"
              className="absolute inset-0 w-full h-full object-cover filter brightness-[0.75]"
              referrerPolicy="no-referrer"
            />
            
            {/* Logo overlay */}
            <div className="absolute inset-0 flex flex-col justify-between p-10 text-left bg-gradient-to-t from-brand-charcoal/80 via-transparent to-brand-charcoal/40 text-brand-cream">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-terracotta text-brand-cream">
                  <Palette className="h-5 w-5" />
                </div>
                <span className="font-display text-xl font-bold">Arty Café</span>
              </div>
              
              <div className="space-y-3">
                <p className="font-display text-3xl font-bold leading-tight">Your wheel is waiting.</p>
                <p className="text-sm text-brand-cream/80 max-w-xs font-medium">
                  Log in to track your clay pieces, review upcoming workshop sessions, and manage reservations easily.
                </p>
              </div>

              <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">Jeddah, Saudi Arabia</span>
            </div>
          </div>

          {/* Right Column: Form Column */}
          <div className="lg:col-span-7 bg-brand-cream p-8 md:p-12 flex flex-col justify-center text-left">
            
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div className="flex-1">
                  <p>{errorMsg}</p>
                  {errorMsg.includes('already exists') && (
                    <button
                      type="button"
                      onClick={() => { setErrorMsg(null); setAuthScreen('login'); }}
                      className="mt-2 text-xs font-bold text-red-800 underline cursor-pointer"
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
                  <h2 className="font-display text-3xl font-bold text-brand-charcoal">Welcome back</h2>
                  <p className="text-xs text-brand-charcoal/65 mt-1">Access your bookings and pottery pieces tracker.</p>
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
                          setForgotStep('request');
                        }}
                        className="text-xs font-bold text-brand-terracotta hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>{isSubmitting ? 'Signing in...' : 'Log In'}</span>
                  </button>
                </form>

                <div className="text-center pt-4 border-t border-brand-clay/60">
                  <p className="text-xs font-medium text-brand-charcoal/75">
                    New here?{' '}
                    <button
                      onClick={() => { setErrorMsg(null); setAuthScreen('register'); }}
                      className="text-brand-terracotta font-bold hover:underline cursor-pointer"
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
                  <h2 className="font-display text-3xl font-bold text-brand-charcoal">Join the Café</h2>
                  <p className="text-xs text-brand-charcoal/65 mt-1">Create an account to begin tracking mud creations.</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Full name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Noura Al-Amri"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Email address *</label>
                    <input
                      type="email"
                      required
                      placeholder="noura@amri.sa"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  {/* Phone with Country Code Dropdown */}
                  <PhoneInput
                    label="Phone number"
                    required
                    value={phone}
                    onChange={(val) => { setPhone(val); setErrorMsg(null); }}
                  />

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Password (min 6 chars) *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Confirm password *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErrorMsg(null); }}
                      className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-sm mt-4"
                  >
                    {isSubmitting ? 'Creating account...' : 'Create Account'}
                  </button>
                </form>

                <div className="text-center pt-4 border-t border-brand-clay/60">
                  <p className="text-xs font-medium text-brand-charcoal/75">
                    Already have an account?{' '}
                    <button
                      onClick={() => { setErrorMsg(null); setAuthScreen('login'); }}
                      className="text-brand-terracotta font-bold hover:underline cursor-pointer"
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
                  onClick={() => { 
                    setErrorMsg(null); 
                    setAuthScreen('login'); 
                    setForgotStep('request');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-terracotta hover:underline cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to login</span>
                </button>

                <div>
                  <h2 className="font-display text-3xl font-bold text-brand-charcoal">Password Recovery</h2>
                  <p className="text-xs text-brand-charcoal/65 mt-1">
                    Reset your account password via email or phone verification.
                  </p>
                </div>

                {/* STEP 1: REQUEST VERIFICATION CODE */}
                {forgotStep === 'request' && (
                  <form onSubmit={handleRequestResetCode} className="space-y-4">
                    
                    {/* Method Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-brand-sand/30 p-1 rounded-xl border border-brand-clay/60">
                      <button
                        type="button"
                        onClick={() => setForgotMethod('email')}
                        className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          forgotMethod === 'email' ? 'bg-white text-brand-terracotta shadow-xs' : 'text-brand-charcoal/60'
                        }`}
                      >
                        Email Recovery
                      </button>
                      <button
                        type="button"
                        onClick={() => setForgotMethod('phone')}
                        className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                          forgotMethod === 'phone' ? 'bg-white text-brand-terracotta shadow-xs' : 'text-brand-charcoal/60'
                        }`}
                      >
                        Phone Recovery
                      </button>
                    </div>

                    {forgotMethod === 'email' ? (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-brand-charcoal/80">Registered Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. noura@amri.sa"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                        />
                      </div>
                    ) : (
                      <PhoneInput
                        label="Registered Phone Number"
                        required
                        value={recoveryIdentifier}
                        onChange={setRecoveryIdentifier}
                      />
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-sm mt-2 flex items-center justify-center gap-2"
                    >
                      <KeyRound className="h-4 w-4" />
                      <span>{isSubmitting ? 'Sending verification code...' : 'Send Verification Code'}</span>
                    </button>
                  </form>
                )}

                {/* STEP 2: VERIFY CODE */}
                {forgotStep === 'verify' && (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Verification code dispatched!</span>
                      </p>
                      <p className="text-[11px] text-emerald-700/80">
                        We sent a 6-digit verification code to <strong className="font-bold">{forgotMethod === 'email' ? email : recoveryIdentifier}</strong>.
                      </p>
                      <p className="text-[11px] font-mono bg-white px-2 py-1 rounded border border-emerald-200 mt-2 inline-block font-bold">
                        🔑 Verification Code: {sentCode}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-brand-charcoal/80">Enter 6-Digit Code</label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="123456"
                        value={inputCode}
                        onChange={e => setInputCode(e.target.value)}
                        className="w-full text-center font-mono tracking-widest text-lg font-bold bg-brand-cream border border-brand-clay rounded-xl py-3 px-4 text-brand-charcoal shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-sm mt-2"
                    >
                      Verify Code & Proceed
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSentCode('123456');
                        alert('Resent verification code: 123456');
                      }}
                      className="w-full text-center text-xs font-bold text-brand-terracotta hover:underline pt-2 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Didn't receive code? Resend Code</span>
                    </button>
                  </form>
                )}

                {/* STEP 3: RESET PASSWORD FORM */}
                {forgotStep === 'reset' && (
                  <form onSubmit={handleSaveNewPassword} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-brand-charcoal/80">New Password (min 6 characters)</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-brand-charcoal/80">Confirm New Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={e => setConfirmNewPassword(e.target.value)}
                        className="w-full bg-brand-cream border border-brand-clay rounded-xl py-3.5 px-4 text-sm font-semibold text-brand-charcoal shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3.5 text-sm font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors shadow-sm mt-2"
                    >
                      {isSubmitting ? 'Updating password...' : 'Update Password'}
                    </button>
                  </form>
                )}

                {/* STEP 4: SUCCESS */}
                {forgotStep === 'success' && (
                  <div className="p-6 bg-brand-sand/40 border border-brand-clay rounded-2xl text-center space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold text-brand-charcoal">Password Reset Successfully!</h3>
                      <p className="text-xs text-brand-charcoal/70 mt-1">
                        Your account password has been updated. You can now log in with your new credentials.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthScreen('login');
                        setForgotStep('request');
                      }}
                      className="w-full cursor-pointer rounded-xl bg-brand-terracotta py-3 text-xs font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-colors"
                    >
                      Sign In Now
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
