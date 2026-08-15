/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft, Calendar, Clock, Users, Gift, Cake, Sparkles,
  Upload, CheckCircle2, AlertCircle, ShieldAlert, Coffee
} from 'lucide-react';
import { validatePhone, normalisePhone, parsePhoneComponents } from '../utils/phoneUtils';
import { getMinBirthdayBookingDateStr } from '../utils/dateUtils';
import { PhoneInput } from './PhoneInput';
import {
  BirthdayFormField, BirthdayTermsConfig, DEFAULT_BIRTHDAY_TERMS, renderTermsLine
} from '../types';
import { DateInput } from './DateInput';
import { validatePhoneRule, canonicalPhone } from '../utils/validation';

const FALLBACK_TIMES = ['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM'];

export const BirthdayBookingSection: React.FC = () => {
  const {
    setCustomerTab,
    selectedBirthdayPackage,
    setSelectedBirthdayPackage,
    setPendingBooking,
    currentUser,
    appSettings,
    publishedBirthdayPackages,
    birthdayFormFields
  } = useApp();

  const eventsSettings = appSettings?.find(s => s.id === 'eventsSettings')?.value;
  const minNoticeDays = Number(eventsSettings?.minBirthdayNoticeDays) || 4;
  const minBookingDate = getMinBirthdayBookingDateStr(minNoticeDays);

  // Terms come from Settings → Events & Birthday, never hardcoded here.
  const terms: BirthdayTermsConfig = eventsSettings?.birthdayTerms || DEFAULT_BIRTHDAY_TERMS;
  const cancellationDays = Number(eventsSettings?.cancellationNoticeDays) || minNoticeDays;

  const [termsAccepted, setTermsAccepted] = useState(false);

  // Only fields enabled in Settings → Events & Birthday are shown.
  const activeFields = useMemo(
    () => birthdayFormFields.filter(f => f.enabled).sort((a, b) => a.order - b.order),
    [birthdayFormFields]
  );
  const fieldByKey = (key: string) => activeFields.find(f => f.key === key);
  const isActive = (key: string) => !!fieldByKey(key);
  const labelFor = (key: string, fallback: string) => fieldByKey(key)?.label || fallback;
  const isRequired = (key: string) => !!fieldByKey(key)?.required;

  const [bookingName, setBookingName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setBookingName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);

  const [numberOfPeople, setNumberOfPeople] = useState<number>(10);

  // The selected package is held by id and resolved from the shared record.
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  useEffect(() => {
    if (publishedBirthdayPackages.length === 0) return;
    const match = publishedBirthdayPackages.find(
      p => p.id === selectedBirthdayPackage || p.name === selectedBirthdayPackage
    );
    setSelectedPkgId(prev => prev || match?.id || publishedBirthdayPackages[0].id);
  }, [publishedBirthdayPackages, selectedBirthdayPackage]);

  const selectedPackage = useMemo(
    () => publishedBirthdayPackages.find(p => p.id === selectedPkgId) || null,
    [publishedBirthdayPackages, selectedPkgId]
  );

  const depositAmount = selectedPackage?.depositAmount ?? 500;
  const timeOptions = selectedPackage?.availableTimes?.length
    ? selectedPackage.availableTimes
    : FALLBACK_TIMES;

  const [bookingDate, setBookingDate] = useState<string>(minBookingDate);
  const [bookingTime, setBookingTime] = useState<string>(FALLBACK_TIMES[2]);

  useEffect(() => {
    if (timeOptions.length > 0 && !timeOptions.includes(bookingTime)) {
      setBookingTime(timeOptions[0]);
    }
  }, [timeOptions, bookingTime]);

  const [balloonColorCustom, setBalloonColorCustom] = useState<string>('');
  const [birthdayPersonName, setBirthdayPersonName] = useState<string>('');
  const [cakePhotoUrl, setCakePhotoUrl] = useState<string | null>(null);

  // Values for configurable (dropdown / text / number / date) fields, keyed by field key.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const valueOf = (field: BirthdayFormField) =>
    fieldValues[field.key] ?? (field.type === 'dropdown' ? (field.options?.[0] || '') : '');
  const setValueOf = (key: string, value: string) =>
    setFieldValues(prev => ({ ...prev, [key]: value }));

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

    if (isActive('bookingName') && isRequired('bookingName') && !bookingName.trim()) {
      errs.bookingName = `${labelFor('bookingName', 'Booking name')} is required`;
    }

    if (isActive('phone')) {
      if (!phone) {
        if (isRequired('phone')) errs.phone = 'Phone number is required';
      } else {
        // The one shared phone rule, so this form agrees with sign-up, the
        // walk-in modal and every admin form.
        const result = validatePhoneRule(phone);
        if (!result.valid) errs.phone = result.error!;
      }
    }

    if (isActive('numberOfPeople')) {
      if (!numberOfPeople || numberOfPeople < 1) {
        errs.numberOfPeople = 'At least 1 person is required';
      } else if (selectedPackage) {
        if (numberOfPeople < selectedPackage.minGuests) {
          errs.numberOfPeople = `This package requires at least ${selectedPackage.minGuests} guests`;
        } else if (numberOfPeople > selectedPackage.maxGuests) {
          errs.numberOfPeople = `This package allows up to ${selectedPackage.maxGuests} guests`;
        }
      }
    }

    if (isActive('package') && !selectedPackage) {
      errs.package = 'Please select a package';
    }

    if (isActive('bookingDate')) {
      const currentMinDate = getMinBirthdayBookingDateStr(minNoticeDays);
      if (!bookingDate) {
        errs.bookingDate = 'Please select a date';
      } else if (bookingDate < currentMinDate) {
        errs.bookingDate = `Please choose a date at least ${minNoticeDays} days from today.`;
      }
    }

    if (isActive('bookingTime') && !bookingTime) errs.bookingTime = 'Please select a time slot';

    if (isActive('birthdayPersonName') && isRequired('birthdayPersonName') && !birthdayPersonName.trim()) {
      errs.birthdayPersonName = `${labelFor('birthdayPersonName', 'Name of the birthday person')} is required`;
    }

    // Configurable fields added in Settings
    activeFields.forEach(field => {
      if (!field.required) return;
      if (['bookingName', 'phone', 'numberOfPeople', 'package', 'bookingDate', 'bookingTime', 'birthdayPersonName', 'cakePhoto'].includes(field.key)) return;
      if (!String(valueOf(field)).trim()) {
        errs[field.key] = `${field.label} is required`;
      }
    });

    if (!termsAccepted) {
      errs.terms = 'Please read and accept the event terms and guidelines to continue.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Normalize once, from the parsed components, so the country code is never doubled.
    const normPhone = canonicalPhone(phone);

    // Capture every submitted answer against its stable field key, so the value
    // stays readable even if the label is renamed in Settings later.
    const fieldValues = activeFields.map(field => {
      let value = '';
      let imageUrl: string | undefined;

      switch (field.key) {
        case 'bookingName': value = bookingName.trim(); break;
        case 'phone': value = normPhone; break;
        case 'numberOfPeople': value = String(numberOfPeople); break;
        case 'package': value = selectedPackage?.name || ''; break;
        case 'bookingDate': value = bookingDate; break;
        case 'bookingTime': value = bookingTime; break;
        case 'birthdayPersonName': value = birthdayPersonName.trim(); break;
        case 'cakePhoto':
          // The image itself is stored with the answer, not just a note about it.
          imageUrl = cakePhotoUrl || undefined;
          value = cakePhotoUrl ? 'Image submitted' : '';
          break;
        default: {
          const raw = String(valueOf(field) || '').trim();
          value = raw.toLowerCase().includes('custom') && balloonColorCustom.trim()
            ? `${raw} — ${balloonColorCustom.trim()}`
            : raw;
        }
      }

      // Any field configured as an image carries its upload the same way.
      if (field.type === 'image' && !imageUrl && cakePhotoUrl) {
        imageUrl = cakePhotoUrl;
        value = value || 'Image submitted';
      }

      return { key: field.key, label: field.label, value, imageUrl };
    });

    const answerFor = (key: string) => fieldValues.find(f => f.key === key)?.value || '';

    // Exact wording the customer saw, stored with the acceptance.
    const termsLines = [
      ...terms.leadingItems,
      terms.suppliesIntro,
      ...terms.supplies.map((item, i) => `${i + 1}. ${item}`),
      ...terms.trailingItems
    ].map(line => renderTermsLine(line, { deposit: depositAmount, cancellationDays }));

    const birthdayDetails = {
      packageId: selectedPackage?.id,
      packageName: selectedPackage?.name,
      eventDate: bookingDate,
      eventTime: bookingTime,
      guestCount: Number(numberOfPeople),
      birthdayPersonName: birthdayPersonName.trim(),
      birthdayPersonAge: answerFor('birthdayPersonAge'),
      activitySelection: answerFor('activitySelection'),
      cakeOption: selectedPackage?.cakeDescription || '',
      cakeSize: answerFor('cakeSize'),
      cakePhotoUrl: cakePhotoUrl || undefined,
      themeOrColors: answerFor('balloonColor'),
      addOns: [answerFor('drinksChoice')].filter(Boolean),
      specialRequests: answerFor('specialRequests'),
      notes: answerFor('notes'),
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: terms.version,
      termsSnapshot: termsLines,
      totalAmount: (selectedPackage?.price || 0) * Number(numberOfPeople),
      depositAmount,
      submittedAt: new Date().toISOString(),
      fieldValues
    };

    // Same draft-then-authenticate path the workshop booking uses. The full draft
    // is preserved through sign-in / account creation.
    setPendingBooking({
      workshopId: 'birthday-party-event',
      workshopTitle: `Birthday Party — ${selectedPackage?.name || 'Package'}`,
      date: bookingDate,
      time: bookingTime,
      participants: Number(numberOfPeople),
      totalPrice: depositAmount,
      // Carried into Customer Information so it is never re-typed.
      customerName: bookingName.trim(),
      customerEmail: currentUser?.email || '',
      customerPhone: normPhone,
      birthdayDetails
    });

    // Customer Information handles sign-in or account creation, then payment.
    setCustomerTab('checkout-info');
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-xl border p-3 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-500 focus:ring-red-300'
        : 'border-brand-clay/70 focus:border-brand-terracotta focus:ring-brand-terracotta/20'
    }`;

  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-brand-ink mb-1.5';

  /** Renders one configured field, preserving the existing form styling. */
  const renderField = (field: BirthdayFormField) => {
    const required = field.required;
    const label = (
      <label className={labelClass}>
        {field.label} {required && '*'}
      </label>
    );

    switch (field.key) {
      case 'bookingName':
        return (
          <div key={field.id}>
            {label}
            <input
              type="text"
              value={bookingName}
              onChange={e => setBookingName(e.target.value)}
              placeholder={field.placeholder || 'e.g. Noura Al-Amri'}
              className={inputClass(errors.bookingName)}
            />
            {errors.bookingName && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.bookingName}</p>}
          </div>
        );

      case 'phone':
        return (
          <PhoneInput
            key={field.id}
            label={field.label}
            required={required}
            value={phone}
            onChange={val => setPhone(val)}
            error={errors.phone}
          />
        );

      case 'numberOfPeople':
        return (
          <div key={field.id}>
            {label}
            <div className="relative">
              <input
                type="number"
                min={selectedPackage?.minGuests || 1}
                max={selectedPackage?.maxGuests || 100}
                value={numberOfPeople}
                onChange={e => setNumberOfPeople(parseInt(e.target.value) || 1)}
                className={inputClass(errors.numberOfPeople)}
              />
              <Users className="absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/40 pointer-events-none" />
            </div>
            {selectedPackage && (
              <p className="text-[11px] text-brand-muted mt-1 font-semibold">
                This package hosts {selectedPackage.minGuests}–{selectedPackage.maxGuests} guests.
              </p>
            )}
            {errors.numberOfPeople && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.numberOfPeople}</p>}
          </div>
        );

      case 'package':
        return (
          <div key={field.id}>
            {label}
            <select
              value={selectedPkgId}
              onChange={e => {
                setSelectedPkgId(e.target.value);
                setSelectedBirthdayPackage(e.target.value);
              }}
              className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-brand-cream"
            >
              {publishedBirthdayPackages.length === 0 && <option value="">No packages available</option>}
              {/* Options come from the shared package records */}
              {publishedBirthdayPackages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.price} SAR {p.pricingLabel || p.pricingType})
                </option>
              ))}
            </select>
            {errors.package && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.package}</p>}
          </div>
        );

      case 'bookingDate':
        return (
          <div key={field.id}>
            {label}
            <DateInput
              min={minBookingDate}
              value={bookingDate}
              onChange={e => setBookingDate(e.target.value)}
              className={inputClass(errors.bookingDate)}
            />
            <p className="text-[11px] text-brand-terracotta font-semibold mt-1">
              📌 Birthday packages must be booked at least {minNoticeDays} days in advance.
            </p>
            {selectedPackage?.availableDays?.length ? (
              <p className="text-[11px] text-brand-muted font-semibold mt-0.5">
                Available days: {selectedPackage.availableDays.join(', ')}
              </p>
            ) : null}
            {errors.bookingDate && <p className="text-[11px] text-red-500 mt-1 font-semibold">{errors.bookingDate}</p>}
          </div>
        );

      case 'bookingTime':
        return (
          <div key={field.id}>
            {label}
            <select
              value={bookingTime}
              onChange={e => setBookingTime(e.target.value)}
              className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-brand-cream"
            >
              {timeOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.bookingTime && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.bookingTime}</p>}
          </div>
        );

      case 'birthdayPersonName':
        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            <input
              type="text"
              value={birthdayPersonName}
              onChange={e => setBirthdayPersonName(e.target.value)}
              placeholder={field.placeholder || 'e.g. Maya (Turning 8!)'}
              className={inputClass(errors.birthdayPersonName)}
            />
            {errors.birthdayPersonName && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.birthdayPersonName}</p>}
          </div>
        );

      case 'cakePhoto':
        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-brand-clay/70 bg-brand-sand/20 hover:bg-brand-sand/40 transition-colors">
              {cakePhotoUrl ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-brand-clay shrink-0">
                  <img src={cakePhotoUrl} alt="Cake Design" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-sand/60 text-brand-muted shrink-0">
                  <Upload className="h-6 w-6" />
                </div>
              )}

              <div className="flex-1 text-center sm:text-start">
                <input
                  type="file"
                  id="cake-photo-upload"
                  accept="image/*"
                  onChange={handleCakePhotoChange}
                  className="hidden"
                />
                <label
                  htmlFor="cake-photo-upload"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-clay px-4 py-2 rounded-xl cursor-pointer hover:bg-brand-sand/50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{cakePhotoUrl ? 'Change Cake Photo' : 'Upload Cake Design Image'}</span>
                </label>
                <p className="text-[11px] text-brand-muted mt-1">
                  {field.helpText || 'Send us your customized cake design photo and we will prepare it for you!'}
                </p>
              </div>
            </div>
          </div>
        );

      default:
        // Fields configured in Settings → Events & Birthday
        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            {field.type === 'dropdown' ? (
              <>
                <select
                  value={valueOf(field)}
                  onChange={e => setValueOf(field.key, e.target.value)}
                  className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal focus:outline-none focus:border-brand-terracotta focus:ring-2 focus:ring-brand-terracotta/20 bg-brand-cream"
                >
                  {(field.options || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {/* Free-text companion for a "Custom" style choice */}
                {valueOf(field).toLowerCase().includes('custom') && (
                  <input
                    type="text"
                    placeholder="Please specify"
                    value={balloonColorCustom}
                    onChange={e => setBalloonColorCustom(e.target.value)}
                    className="w-full rounded-xl border border-brand-clay/70 p-3 text-sm text-brand-charcoal mt-2 focus:outline-none focus:border-brand-terracotta"
                  />
                )}
              </>
            ) : field.type === 'long_text' ? (
              <textarea
                rows={3}
                value={valueOf(field)}
                placeholder={field.placeholder}
                onChange={e => setValueOf(field.key, e.target.value)}
                className={inputClass(errors[field.key])}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={valueOf(field)}
                placeholder={field.placeholder}
                onChange={e => setValueOf(field.key, e.target.value)}
                className={inputClass(errors[field.key])}
              />
            )}
            {field.helpText && <p className="text-[11px] text-brand-muted mt-1">{field.helpText}</p>}
            {errors[field.key] && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors[field.key]}</p>}
          </div>
        );
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-in fade-in duration-300 text-start">

      {/* Back to Home button */}
      <button
        onClick={() => setCustomerTab('home')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-brand-terracotta bg-brand-cream border border-brand-clay hover:bg-brand-sand px-3.5 py-2 rounded-xl cursor-pointer mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Home</span>
      </button>

      {/* Page title — plain type on the page, no banner box. */}
      <div className="mb-10">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Private Celebration</span>
        <h1 className="mt-3 font-display text-3xl sm:text-[42px] font-semibold text-brand-charcoal">
          Birthday Package Reservation
        </h1>
        <p className="text-sm text-brand-ink mt-4 max-w-2xl leading-relaxed">
          Complete the form below to reserve your studio celebration space. A <strong className="text-brand-terracotta font-semibold">{depositAmount} SAR deposit</strong> is required to confirm your date.
        </p>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-8">

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Reservation Details — same fields, same order, same validation. */}
          <div className="lg:col-span-7 bg-brand-cream border border-brand-clay rounded-[28px] p-6 sm:p-8 shadow-card-sm space-y-6">
            <h2 className="font-display text-xl font-semibold text-brand-charcoal pb-3 border-b border-brand-clay flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-terracotta" />
              <span>Reservation Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {activeFields.map(renderField)}
            </div>
          </div>

          {/* Selected package summary — same information as before, now an
              image-led card that stays in view alongside the form. */}
          {selectedPackage && (
            <div className="lg:col-span-5 lg:sticky lg:top-24 bg-brand-cream border border-brand-clay rounded-[28px] overflow-hidden shadow-card">
              {selectedPackage.image && (
                <div className="aspect-video w-full bg-brand-sand">
                  <img
                    src={selectedPackage.image}
                    alt={selectedPackage.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="p-6 space-y-2 text-xs text-brand-ink">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">Selected Package</span>
                <p className="font-display text-xl font-semibold text-brand-charcoal">{selectedPackage.name}</p>
                <p>{selectedPackage.shortDescription}</p>
                <p className="pt-3 mt-1 border-t border-brand-clay font-semibold text-brand-terracotta text-sm">
                  {selectedPackage.price} SAR {selectedPackage.pricingLabel || selectedPackage.pricingType}
                  {selectedPackage.duration ? ` · ${selectedPackage.duration}` : ''}
                  {selectedPackage.ageInformation ? ` · ${selectedPackage.ageInformation}` : ''}
                </p>
                {/* Reservation summary reads the same shared package record */}
                {selectedPackage.cakeSizes.length > 0 && (
                  <p className="text-[11px] text-brand-ink">
                    Cake: {selectedPackage.cakeSizes.map(c => `${c.label} ${c.price} SAR`).join(' · ')}
                  </p>
                )}
                {selectedPackage.trainerInfo && (
                  <p className="text-[11px] text-brand-ink">{selectedPackage.trainerInfo}</p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Event Terms and Guidelines — content from Settings, deposit and
            cancellation window filled in from the configured values. */}
        <div className="bg-brand-cream border-2 border-brand-terracotta/40 rounded-[28px] p-6 sm:p-8 space-y-4 text-brand-charcoal shadow-card-sm">
          <div className="flex items-center gap-2 text-brand-terracotta font-semibold text-sm">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-display text-lg">{terms.title}</h3>
          </div>

          <div className="text-xs sm:text-sm space-y-3 leading-relaxed text-brand-charcoal/90">
            {terms.leadingItems.map(line => (
              <p key={line} className="font-semibold text-brand-charcoal">
                {renderTermsLine(line, { deposit: depositAmount, cancellationDays })}
              </p>
            ))}

            {terms.supplies.length > 0 && (
              <div>
                <p className="font-semibold text-brand-charcoal mb-1">
                  {renderTermsLine(terms.suppliesIntro, { deposit: depositAmount, cancellationDays })}
                </p>
                <ol className="list-decimal pl-5 space-y-0.5 text-brand-ink font-medium">
                  {terms.supplies.map(item => <li key={item}>{item}</li>)}
                </ol>
              </div>
            )}

            {terms.trailingItems.map(line => (
              <p key={line} className="font-medium text-brand-charcoal/90">
                {renderTermsLine(line, { deposit: depositAmount, cancellationDays })}
              </p>
            ))}
          </div>

          {/* Acceptance is required before the reservation can be submitted */}
          <label
            className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-colors ${
              errors.terms ? 'border-red-400 bg-red-50/50' : 'border-brand-clay bg-brand-cream/70 hover:bg-brand-cream'
            }`}
          >
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => {
                setTermsAccepted(e.target.checked);
                if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
              }}
              className="mt-0.5 h-4 w-4 accent-brand-terracotta cursor-pointer shrink-0"
            />
            <span className="text-xs font-semibold text-brand-charcoal">
              I have read and accept the event terms and guidelines. <span className="text-red-500">*</span>
            </span>
          </label>
          {errors.terms && <p className="text-[11px] text-red-600 font-semibold">{errors.terms}</p>}
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto cursor-pointer bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-base font-semibold px-10 py-4 rounded-2xl shadow-card-sm transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Proceed to Payment ({depositAmount} SAR Deposit)</span>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </button>
        </div>

      </form>
    </div>
  );
};
