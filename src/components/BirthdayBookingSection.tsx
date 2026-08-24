/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft, Cake, Upload, Check, ChevronDown,
  ShieldAlert, CalendarDays, Clock, PartyPopper
, Info } from 'lucide-react';
import { getMinBirthdayBookingDateStr } from '../utils/dateUtils';
import { PhoneInput } from './PhoneInput';
import {
  BirthdayFormField, BirthdayTermsConfig, DEFAULT_BIRTHDAY_TERMS, renderTermsLine
} from '../types';
import { DateInput } from './DateInput';
import { validatePhoneRule, canonicalPhone } from '../utils/validation';
import { minBirthdayNoticeDays, isBirthdayDateFull, isBirthdaySlotFull } from '../utils/queueUtils';

const FALLBACK_TIMES = ['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM'];

/**
 * Which step each configured field belongs to.
 *
 * Anything the studio adds in Settings that is not one of these lands in
 * Extras, which is where an unknown question makes the most sense: the party
 * details step is the fixed set the booking record itself is built from.
 */
const DETAIL_KEYS = [
  'bookingName', 'phone', 'numberOfPeople', 'bookingDate', 'bookingTime',
  'birthdayPersonName', 'birthdayPersonAge'
];

const STEPS = [
  { n: 1, label: 'Package' },
  { n: 2, label: 'Party Details' },
  { n: 3, label: 'Extras' },
  { n: 4, label: 'Review & Deposit' }
];

/** Swatches for colour-style choices, so a balloon colour reads as a colour. */
const COLOR_SWATCHES: Record<string, string> = {
  red: '#C2412D', pink: '#E39AB0', blue: '#708D9C', 'light blue': '#A8C4D4',
  green: '#7C8F80', sage: '#7C8F80', yellow: '#E3B23C', orange: '#D9813F',
  purple: '#8B7AA8', gold: '#C9A227', silver: '#BFBFBF', white: '#FAF6EF',
  black: '#2E211A', brown: '#5A4132', cream: '#FAF6EF', peach: '#E8B49A',
  'pastel mix': 'linear-gradient(135deg,#E39AB0,#A8C4D4,#E3B23C)',
  rainbow: 'linear-gradient(135deg,#C2412D,#E3B23C,#7C8F80,#708D9C,#8B7AA8)'
};

const swatchFor = (option: string): string | null => {
  const key = option.trim().toLowerCase();
  if (COLOR_SWATCHES[key]) return COLOR_SWATCHES[key];
  const hit = Object.keys(COLOR_SWATCHES).find(c => key.includes(c));
  return hit ? COLOR_SWATCHES[hit] : null;
};

export const BirthdayBookingSection: React.FC = () => {
  const {
    setCustomerTab,
    selectedBirthdayPackage,
    setSelectedBirthdayPackage,
    setPendingBooking,
    pendingBooking,
    currentUser,
    appSettings,
    publishedBirthdayPackages,
    birthdayFormFields,
    bookings
  } = useApp();

  const prefersReducedMotion = useReducedMotion();
  const ease = [0.22, 1, 0.36, 1] as const;

  const eventsSettings = appSettings?.find(s => s.id === 'eventsSettings')?.value;

  // Terms come from Settings → Events & Birthday, never hardcoded here.
  const terms: BirthdayTermsConfig = eventsSettings?.birthdayTerms || DEFAULT_BIRTHDAY_TERMS;
  const cancellationDays = Number(eventsSettings?.cancellationNoticeDays) || 4;

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

  const detailFields = useMemo(
    () => activeFields.filter(f => DETAIL_KEYS.includes(f.key)),
    [activeFields]
  );
  const extraFields = useMemo(
    () => activeFields.filter(f => !DETAIL_KEYS.includes(f.key) && f.key !== 'package'),
    [activeFields]
  );

  const [bookingName, setBookingName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  useEffect(() => {
    if (currentUser) {
      if (currentUser.name) setBookingName(currentUser.name);
      if (currentUser.phone) setPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Everything below starts empty on purpose: the ticket beside the form is a
  // live summary, and a pre-filled default would show it as booked information
  // the visitor never actually chose.
  const [numberOfPeople, setNumberOfPeople] = useState<number | ''>('');

  /**
   * Advance notice depends on the total headcount (which already includes
   * the birthday person — it is never subtracted here). Until a headcount is
   * chosen, the stricter 4-day notice is assumed so the date field is never
   * more permissive than the rule actually allows.
   */
  const minNoticeDays = minBirthdayNoticeDays(Number(numberOfPeople) || 5);
  const minBookingDate = getMinBirthdayBookingDateStr(minNoticeDays);

  // Clearing a date that a lowered headcount doesn't retroactively save is
  // deliberately NOT automatic here: collectErrors() re-checks it, so the
  // visitor sees exactly why before moving on rather than losing a valid pick
  // to a stricter default assumption.

  // The selected package is held by id and resolved from the shared record.
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  useEffect(() => {
    if (publishedBirthdayPackages.length === 0) return;
    const match = publishedBirthdayPackages.find(
      p => p.id === selectedBirthdayPackage || p.name === selectedBirthdayPackage
    );
    // Only what the visitor picked on the packages page — never a default.
    if (match) setSelectedPkgId(prev => prev || match.id);
  }, [publishedBirthdayPackages, selectedBirthdayPackage]);

  const selectedPackage = useMemo(
    () => publishedBirthdayPackages.find(p => p.id === selectedPkgId) || null,
    [publishedBirthdayPackages, selectedPkgId]
  );

  const depositAmount = selectedPackage?.depositAmount ?? 500;
  const timeOptions = selectedPackage?.availableTimes?.length
    ? selectedPackage.availableTimes
    : FALLBACK_TIMES;

  const [bookingDate, setBookingDate] = useState<string>('');
  const [bookingTime, setBookingTime] = useState<string>('');

  useEffect(() => {
    // Switching package can retire a slot. Clear it rather than silently
    // moving the booking to a time nobody picked.
    if (bookingTime && timeOptions.length > 0 && !timeOptions.includes(bookingTime)) {
      setBookingTime('');
    }
  }, [timeOptions, bookingTime]);

  useEffect(() => {
    // Changing the date can land the previously chosen time on a slot that is
    // now full (or a date that is full outright) for the new date.
    if (
      bookingDate && bookingTime &&
      (isBirthdayDateFull(bookings, bookingDate) || isBirthdaySlotFull(bookings, bookingDate, bookingTime))
    ) {
      setBookingTime('');
    }
  }, [bookingDate, bookings]);

  const [balloonColorCustom, setBalloonColorCustom] = useState<string>('');
  const [birthdayPersonName, setBirthdayPersonName] = useState<string>('');
  const [cakePhotoUrl, setCakePhotoUrl] = useState<string | null>(null);

  // Values for configurable (dropdown / text / number / date) fields, keyed by field key.
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const valueOf = (field: BirthdayFormField) => fieldValues[field.key] ?? '';
  const setValueOf = (key: string, value: string) =>
    setFieldValues(prev => ({ ...prev, [key]: value }));

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step state. `furthest` keeps completed steps clickable in the stepper.
  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);

  /**
   * Resuming from the shared payment flow's Back button: this component
   * remounts from scratch, so without this the customer would land back on
   * Step 1 with everything they typed gone. If there is a birthday draft
   * already sitting in `pendingBooking`, restore it and jump straight back
   * to Review & Deposit — once, so it does not fight further edits.
   */
  const hydratedFromDraft = React.useRef(false);
  useEffect(() => {
    if (hydratedFromDraft.current) return;
    if (!pendingBooking || pendingBooking.workshopId !== 'birthday-party-event') return;
    const d = pendingBooking.birthdayDetails as any;
    if (!d) return;
    hydratedFromDraft.current = true;

    if (pendingBooking.customerName) setBookingName(pendingBooking.customerName);
    if (pendingBooking.customerPhone) setPhone(pendingBooking.customerPhone);
    if (d.packageId) setSelectedPkgId(d.packageId);
    if (typeof pendingBooking.participants === 'number') setNumberOfPeople(pendingBooking.participants);
    if (pendingBooking.date) setBookingDate(pendingBooking.date);
    if (pendingBooking.time) setBookingTime(pendingBooking.time);
    if (d.birthdayPersonName) setBirthdayPersonName(d.birthdayPersonName);
    if (d.cakePhotoUrl) setCakePhotoUrl(d.cakePhotoUrl);

    const restoredValues: Record<string, string> = {};
    for (const f of (d.fieldValues || [])) {
      if (f.key === 'balloonColor' && typeof f.value === 'string' && f.value.includes(' — ')) {
        const [base, custom] = f.value.split(' — ');
        restoredValues[f.key] = base;
        setBalloonColorCustom(custom || '');
      } else if (typeof f.value === 'string') {
        restoredValues[f.key] = f.value;
      }
    }
    setFieldValues(prev => ({ ...prev, ...restoredValues }));
    setTermsAccepted(!!d.termsAccepted);
    setStep(4);
    setFurthest(4);
  }, [pendingBooking]);

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

  /**
   * Every booking rule, unchanged and in one place.
   *
   * The step buttons show only the subset that belongs to the step being left,
   * so a visitor is never blocked by an error for a question they have not
   * reached — but nothing is submitted without the full set passing.
   */
  const collectErrors = () => {
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
      // Recomputed from the actual headcount typed, not the placeholder
      // assumption the date field's `min` used before a headcount was picked.
      const noticeForCount = minBirthdayNoticeDays(Number(numberOfPeople) || 0);
      const currentMinDate = getMinBirthdayBookingDateStr(noticeForCount);
      if (!bookingDate) {
        errs.bookingDate = 'Please select a date';
      } else if (numberOfPeople && bookingDate < currentMinDate) {
        errs.bookingDate = `Birthday bookings for ${numberOfPeople} guests need at least ${noticeForCount} day${noticeForCount === 1 ? '' : 's'} notice.`;
      } else if (bookingDate && isBirthdayDateFull(bookings, bookingDate)) {
        errs.bookingDate = 'This date is fully booked for birthday celebrations. Please choose another date.';
      }
    }

    if (isActive('bookingTime')) {
      if (!bookingTime) {
        errs.bookingTime = 'Please select a time slot';
      } else if (bookingDate && !errs.bookingDate && isBirthdaySlotFull(bookings, bookingDate, bookingTime)) {
        errs.bookingTime = 'This time slot is fully booked for birthday celebrations. Please choose another time.';
      }
    }

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

    return errs;
  };

  const validate = () => {
    const errs = collectErrors();
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** The error keys a given step is allowed to report. */
  const keysForStep = (s: number): string[] => {
    if (s === 1) return ['package'];
    if (s === 2) return detailFields.map(f => f.key);
    if (s === 3) return extraFields.map(f => f.key);
    return [];
  };

  const goToStep = (target: number) => {
    // Moving backwards never validates — the visitor is going back to fix
    // something, and blocking that is how forms trap people.
    if (target < step) {
      setStep(target);
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      return;
    }

    const all = collectErrors();
    const relevant: Record<string, string> = {};
    for (let s = step; s < target; s++) {
      keysForStep(s).forEach(key => {
        if (all[key]) relevant[key] = all[key];
      });
    }

    setErrors(relevant);
    if (Object.keys(relevant).length > 0) return;

    setStep(target);
    setFurthest(prev => Math.max(prev, target));
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      // A failure here is almost always a field on an earlier step, which the
      // review step does not render — showing the message where it cannot be
      // seen would look like the button was simply dead.
      const failing = collectErrors();
      const offending = [1, 2, 3].find(s => keysForStep(s).some(key => failing[key]));
      if (offending) setStep(offending);
      return;
    }

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
    `w-full rounded-2xl border bg-white p-3.5 text-sm text-brand-charcoal focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-red-500 focus:ring-red-300'
        : 'border-brand-clay focus:border-brand-terracotta focus:ring-brand-terracotta/20'
    }`;

  const labelClass = 'block text-xs font-bold text-brand-charcoal/80 mb-1.5';
  const fieldError = (key: string) =>
    errors[key] ? <p className="mt-1.5 text-[11px] font-semibold text-red-500">{errors[key]}</p> : null;

  /** Chip / tile picker — the visual replacement for a plain option list. */
  const OptionTiles: React.FC<{
    options: string[];
    value: string;
    onSelect: (v: string) => void;
    withSwatches?: boolean;
    priceFor?: (option: string) => number | undefined;
    disabledOptions?: string[];
  }> = ({ options, value, onSelect, withSwatches, priceFor, disabledOptions }) => (
    <div className="flex flex-wrap gap-2.5">
      {options.map(option => {
        const isOn = value === option;
        const isDisabled = !!disabledOptions?.includes(option);
        const swatch = withSwatches ? swatchFor(option) : null;
        const price = priceFor?.(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isOn}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            onClick={() => !isDisabled && onSelect(option)}
            className={`group flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
              isDisabled
                ? 'cursor-not-allowed border-brand-clay bg-brand-sand/40 text-brand-muted opacity-60'
                : `cursor-pointer ${isOn
                    ? 'border-brand-terracotta bg-brand-terracotta/8 text-brand-charcoal'
                    : 'border-brand-clay bg-white text-brand-ink hover:border-brand-muted'}`
            }`}
          >
            {swatch && (
              <span
                aria-hidden="true"
                className="h-5 w-5 shrink-0 rounded-full ring-1 ring-brand-clay"
                style={swatch.startsWith('linear') ? { backgroundImage: swatch } : { backgroundColor: swatch }}
              />
            )}
            <span className="text-start">
              {option}
              {isDisabled ? (
                <span className="block text-[11px] font-medium text-brand-muted">Full</span>
              ) : price !== undefined && (
                <span className="block text-[11px] font-medium text-brand-muted ltr-numerals">{price} SAR</span>
              )}
            </span>
            {isOn && !isDisabled && <Check className="h-4 w-4 shrink-0 text-brand-terracotta" />}
          </button>
        );
      })}
    </div>
  );

  /** Renders one configured field. Same keys, same values, new controls. */
  const renderField = (field: BirthdayFormField) => {
    const required = field.required;
    const label = (
      <label className={labelClass}>
        {field.label} {required && <span className="text-red-500">*</span>}
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
            {fieldError('bookingName')}
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

      case 'numberOfPeople': {
        const min = selectedPackage?.minGuests || 1;
        const max = selectedPackage?.maxGuests || 100;
        return (
          <div key={field.id}>
            {label}
            {/* Stepper rather than a bare number input: guest count is the one
                field with a hard range, and nudging it is faster than typing —
                especially on a phone. */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Fewer guests"
                onClick={() => setNumberOfPeople(n => Math.max(min, (n || min) - 1))}
                className="h-12 w-12 shrink-0 rounded-full border border-brand-clay bg-white text-lg font-semibold text-brand-charcoal transition-colors hover:bg-brand-sand/50 cursor-pointer"
              >
                −
              </button>
              {/* `no-spinner` drops the browser's own up/down arrows: they sat
                  inside the field next to the custom buttons, which read as two
                  competing sets of controls. */}
              <input
                type="number"
                inputMode="numeric"
                min={min}
                max={max}
                placeholder="—"
                value={numberOfPeople}
                onChange={e => {
                  const raw = e.target.value;
                  setNumberOfPeople(raw === '' ? '' : (parseInt(raw) || ''));
                }}
                className={`${inputClass(errors.numberOfPeople)} no-spinner flex-1 text-center font-semibold ltr-numerals`}
              />
              <button
                type="button"
                aria-label="More guests"
                onClick={() => setNumberOfPeople(n => Math.min(max, (n || min) + 1))}
                className="h-12 w-12 shrink-0 rounded-full border border-brand-clay bg-white text-lg font-semibold text-brand-charcoal transition-colors hover:bg-brand-sand/50 cursor-pointer"
              >
                +
              </button>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-brand-muted">
              Include the birthday person in the total.
            </p>
            {selectedPackage && (
              <p className="mt-1 text-[11px] font-semibold text-brand-muted">
                This package hosts {selectedPackage.minGuests}–{selectedPackage.maxGuests} guests.
              </p>
            )}
            {fieldError('numberOfPeople')}
          </div>
        );
      }

      case 'package':
        // The package is chosen on step 1 with the picker, not with a select.
        return null;

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
            <p className="mt-1.5 text-[11px] font-semibold text-brand-terracotta">
              <Info className="inline h-3.5 w-3.5 me-1 align-[-2px]" />
              {numberOfPeople
                ? `For ${numberOfPeople} guests, book at least ${minBirthdayNoticeDays(Number(numberOfPeople))} day${minBirthdayNoticeDays(Number(numberOfPeople)) === 1 ? '' : 's'} in advance.`
                : 'Parties of 3–4 need 1 day notice; 5 or more need 4 days notice.'}
            </p>
            {selectedPackage?.availableDays?.length ? (
              <p className="mt-0.5 text-[11px] font-semibold text-brand-muted">
                Available days: {selectedPackage.availableDays.join(', ')}
              </p>
            ) : null}
            {fieldError('bookingDate')}
          </div>
        );

      case 'bookingTime': {
        // A slot at BIRTHDAY_SAME_SLOT_MAX is disabled here — the same rule
        // collectErrors() and the submit-time re-check both enforce — even
        // when the day overall still has room.
        const fullTimes = bookingDate
          ? timeOptions.filter(t => isBirthdaySlotFull(bookings, bookingDate, t))
          : [];
        const dateFull = bookingDate ? isBirthdayDateFull(bookings, bookingDate) : false;
        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            <OptionTiles
              options={timeOptions}
              value={bookingTime}
              onSelect={setBookingTime}
              disabledOptions={dateFull ? timeOptions : fullTimes}
            />
            {dateFull && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-500">
                This date is fully booked for birthday celebrations. Please choose another date.
              </p>
            )}
            {fieldError('bookingTime')}
          </div>
        );
      }

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
            {fieldError('birthdayPersonName')}
          </div>
        );

      case 'cakePhoto':
        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            <div className="flex flex-col items-center gap-4 rounded-[28px] border-2 border-dashed border-brand-clay bg-white p-5 transition-colors hover:bg-brand-sand/20 sm:flex-row">
              {cakePhotoUrl ? (
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-brand-clay">
                  <img src={cakePhotoUrl} alt="Cake Design" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-sand/60 text-brand-muted">
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
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-clay bg-brand-cream px-4 py-2.5 text-xs font-semibold text-brand-terracotta transition-colors hover:bg-brand-sand/50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{cakePhotoUrl ? 'Change cake photo' : 'Upload cake design image'}</span>
                </label>
                <p className="mt-1.5 text-[11px] text-brand-muted">
                  {field.helpText || 'Send us your customized cake design photo and we will prepare it for you!'}
                </p>
              </div>
            </div>
          </div>
        );

      default: {
        // Fields configured in Settings → Events & Birthday. A dropdown with a
        // handful of options becomes tiles; only long option lists stay a
        // select, where scanning tiles would be slower than a list.
        const options = field.options || [];
        const asTiles = field.type === 'dropdown' && options.length > 0 && options.length <= 8;
        const cakePriceFor = (option: string) =>
          selectedPackage?.cakeSizes.find(
            c => c.label.toLowerCase() === option.trim().toLowerCase()
          )?.price;

        return (
          <div key={field.id} className="sm:col-span-2">
            {label}
            {field.type === 'dropdown' ? (
              <>
                {asTiles ? (
                  <OptionTiles
                    options={options}
                    value={valueOf(field)}
                    onSelect={v => setValueOf(field.key, v)}
                    withSwatches={field.key.toLowerCase().includes('color') || field.key.toLowerCase().includes('colour')}
                    priceFor={field.key === 'cakeSize' ? cakePriceFor : undefined}
                  />
                ) : (
                  <select
                    value={valueOf(field)}
                    onChange={e => setValueOf(field.key, e.target.value)}
                    className="w-full rounded-2xl border border-brand-clay bg-white p-3.5 text-sm text-brand-charcoal focus:border-brand-terracotta focus:outline-none focus:ring-2 focus:ring-brand-terracotta/20"
                  >
                    {options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {/* Free-text companion for a "Custom" style choice */}
                {valueOf(field).toLowerCase().includes('custom') && (
                  <input
                    type="text"
                    placeholder="Please specify"
                    value={balloonColorCustom}
                    onChange={e => setBalloonColorCustom(e.target.value)}
                    className={`${inputClass()} mt-2.5`}
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
            {field.helpText && <p className="mt-1.5 text-[11px] text-brand-muted">{field.helpText}</p>}
            {fieldError(field.key)}
          </div>
        );
      }
    }
  };

  /** Extras the visitor has actually answered, for the summary and review. */
  const chosenExtras = useMemo(
    () =>
      extraFields
        .map(f => ({
          label: f.label,
          value: f.key === 'cakePhoto'
            ? (cakePhotoUrl ? 'Design image attached' : '')
            : String(valueOf(f) || '').trim()
        }))
        .filter(entry => entry.value),
    // valueOf reads fieldValues, so both drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraFields, fieldValues, cakePhotoUrl]
  );

  const estimatedTotal = (selectedPackage?.price || 0) * Number(numberOfPeople || 0);

  const prettyDate = useMemo(() => {
    if (!bookingDate) return '';
    const d = new Date(`${bookingDate}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? bookingDate
      : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }, [bookingDate]);

  /**
   * The one celebration ticket.
   *
   * Rendered in exactly one place at a time — beside the form while filling in,
   * in the middle of the page at the review step — and carrying a `layoutId`,
   * so Motion moves the same element between the two positions instead of
   * swapping one card for another.
   *
   * Every row reads live state; nothing is defaulted. A row the visitor has not
   * answered shows a dash, so the ticket never presents an unmade choice as a
   * booked one.
   */
  const ticketRows: Array<{ label: string; value: string }> = [
    { label: 'Booked by', value: bookingName.trim() },
    { label: 'Phone', value: phone.trim() },
    { label: 'Birthday person', value: birthdayPersonName.trim() },
    { label: 'Guests', value: numberOfPeople === '' ? '' : String(numberOfPeople) },
    { label: 'Date', value: prettyDate },
    { label: 'Time', value: bookingTime },
    ...chosenExtras
  ];

  const ticketInner = (
      <div className="space-y-4">
        {selectedPackage?.image ? (
          <div className="h-32 w-full overflow-hidden rounded-2xl bg-brand-sand">
            <img
              src={selectedPackage.image}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl bg-brand-sand/60 text-xs font-semibold text-brand-muted">
            No package chosen yet
          </div>
        )}

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
            Your celebration
          </span>
          <p className={`mt-1 font-display text-xl font-semibold ${
            selectedPackage ? 'text-brand-charcoal' : 'text-brand-muted'
          }`}>
            {selectedPackage?.name || 'No package selected'}
          </p>
        </div>

        <dl className="space-y-2.5 border-t border-brand-clay pt-4 text-sm">
          {ticketRows.map(row => (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <dt className="text-brand-muted">{row.label}</dt>
              <dd className={`text-end ltr-numerals ${
                row.value ? 'font-semibold text-brand-charcoal' : 'text-brand-muted'
              }`}>
                {row.value || '—'}
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2 border-t border-brand-clay pt-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-brand-muted">
              Estimated total
              {selectedPackage && numberOfPeople !== '' && (
                <span className="ltr-numerals"> ({selectedPackage.price} × {numberOfPeople})</span>
              )}
            </span>
            <span className={`ltr-numerals ${
              estimatedTotal ? 'font-semibold text-brand-charcoal' : 'text-brand-muted'
            }`}>
              {estimatedTotal ? `${estimatedTotal} SAR` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-semibold text-brand-charcoal">Deposit due today</span>
            <span className="font-display text-xl font-semibold text-brand-terracotta ltr-numerals">
              {depositAmount} SAR
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-brand-muted">
            The balance is settled at the studio. Any cake upgrade is added to the final bill.
          </p>
        </div>
      </div>
  );

  /**
   * The moving copy. Only ever mounted once — the mobile drawer below uses the
   * plain content instead, because two elements sharing a `layoutId` at the
   * same time would fight over the animation.
   */
  const Ticket: React.FC<{ centred?: boolean }> = ({ centred }) => (
    <motion.div
      layoutId="bday-ticket"
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.45, ease }}
      className={`rounded-[28px] bg-white p-6 shadow-card ring-1 ring-brand-clay ${
        centred ? 'mx-auto w-full max-w-xl' : ''
      }`}
    >
      {ticketInner}
    </motion.div>
  );

  const stepVariants = prefersReducedMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 }
      };

  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-32 text-start lg:pb-8">

      <button
        onClick={() => setCustomerTab('home')}
        className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-clay bg-brand-cream px-4 py-2 text-xs font-semibold text-brand-terracotta hover:bg-brand-sand"
      >
        <ArrowLeft className="h-4 w-4 flip-rtl" />
        <span>Back to Home</span>
      </button>

      <div className="mb-8">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-sage">
          Private Celebration
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold text-brand-charcoal sm:text-[42px]">
          Reserve your party
        </h1>
      </div>

      {/* STEPPER */}
      <nav aria-label="Reservation steps" className="mb-10 border-b border-brand-clay pb-5">
        <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:gap-4">
          {STEPS.map(({ n, label }) => {
            const isCurrent = n === step;
            const isDone = n < step;
            const reachable = n <= furthest;
            return (
              <li key={n} className="flex shrink-0 items-center gap-2 sm:gap-4">
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => reachable && goToStep(n)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex items-center gap-2.5 rounded-full px-1 py-1 text-sm transition-colors ${
                    reachable ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isCurrent
                        ? 'bg-brand-terracotta text-brand-cream'
                        : isDone
                          ? 'bg-brand-sage text-brand-cream'
                          : 'border border-brand-clay bg-white text-brand-muted'
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : n}
                  </span>
                  <span
                    className={`whitespace-nowrap font-semibold ${
                      isCurrent ? 'text-brand-charcoal' : 'text-brand-muted'
                    } ${isCurrent ? '' : 'hidden sm:inline'}`}
                  >
                    {label}
                  </span>
                </button>
                {n < STEPS.length && <span className="h-px w-4 bg-brand-clay sm:w-8" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">

          {/* THE STEP */}
          <div className={step === 4 ? 'lg:col-span-12' : 'lg:col-span-7 xl:col-span-8'}>
            {step === 4 && (
              <>
                <header className="mb-6">
                  <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-charcoal">
                    <PartyPopper className="h-6 w-6 text-brand-terracotta" />
                    Review your booking
                  </h2>
                  <p className="mt-1.5 text-sm text-brand-ink">
                    Check everything below, then pay the deposit to hold your date.
                  </p>
                </header>

                {/* The same ticket from the sidebar, moved here rather than
                    rebuilt — so the review shows the booking once, not twice. */}
                <div className="mb-6">
                  <Ticket centred />
                </div>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={stepVariants.initial}
                animate={stepVariants.animate}
                exit={stepVariants.exit}
                transition={{ duration: 0.32, ease }}
              >

                {/* 1 — PACKAGE */}
                {step === 1 && (
                  <section className="space-y-5">
                    <header>
                      <h2 className="font-display text-2xl font-semibold text-brand-charcoal">
                        Which celebration?
                      </h2>
                      <p className="mt-1.5 text-sm text-brand-ink">
                        Pick the package for your party. You can change it before you pay.
                      </p>
                    </header>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {publishedBirthdayPackages.map(pkg => {
                        const isOn = pkg.id === selectedPkgId;
                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            aria-pressed={isOn}
                            onClick={() => {
                              setSelectedPkgId(pkg.id);
                              setSelectedBirthdayPackage(pkg.id);
                            }}
                            className={`overflow-hidden rounded-[28px] border-2 text-start transition-colors cursor-pointer ${
                              isOn
                                ? 'border-brand-terracotta bg-white'
                                : 'border-transparent bg-white ring-1 ring-brand-clay hover:ring-brand-muted'
                            }`}
                          >
                            {pkg.image && (
                              <div className="h-32 w-full overflow-hidden bg-brand-sand">
                                <img
                                  src={pkg.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-display text-lg font-semibold text-brand-charcoal">
                                  {pkg.name}
                                </h3>
                                {isOn && (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-terracotta text-brand-cream">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-xs text-brand-ink">
                                {[pkg.duration, `${pkg.minGuests}–${pkg.maxGuests} guests`, pkg.ageInformation]
                                  .filter(Boolean).join(' · ')}
                              </p>
                              <p className="mt-3 font-display text-xl font-semibold text-brand-charcoal ltr-numerals">
                                {pkg.price}
                                <span className="ms-1.5 text-xs font-medium text-brand-muted">
                                  SAR {pkg.pricingLabel || pkg.pricingType}
                                </span>
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {fieldError('package')}
                  </section>
                )}

                {/* 2 — PARTY DETAILS */}
                {step === 2 && (
                  <section className="space-y-5">
                    <header>
                      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-charcoal">
                        <CalendarDays className="h-6 w-6 text-brand-terracotta" />
                        Party details
                      </h2>
                      <p className="mt-1.5 text-sm text-brand-ink">
                        Who the party is for, when it is, and how to reach you.
                      </p>
                    </header>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {detailFields.map(renderField)}
                    </div>
                  </section>
                )}

                {/* 3 — EXTRAS */}
                {step === 3 && (
                  <section className="space-y-5">
                    <header>
                      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-charcoal">
                        <Cake className="h-6 w-6 text-brand-terracotta" />
                        The finishing touches
                      </h2>
                      <p className="mt-1.5 text-sm text-brand-ink">
                        Colours, cake and anything else that makes the day theirs.
                      </p>
                    </header>
                    {extraFields.length > 0 ? (
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {extraFields.map(renderField)}
                      </div>
                    ) : (
                      <p className="rounded-[28px] bg-brand-sand/50 p-6 text-sm text-brand-ink">
                        Nothing to choose here — your package already covers everything.
                      </p>
                    )}
                  </section>
                )}

                {/* 4 — REVIEW & DEPOSIT. The heading and the ticket sit above
                    this block, outside the step transition. */}
                {step === 4 && (
                  <section className="space-y-6">
                    {/* TERMS — shown in full. Nothing here is behind a click:
                        it is the wording the acceptance below is bound to. */}
                    <div className="mx-auto w-full max-w-xl rounded-[28px] bg-white p-6 ring-1 ring-brand-clay">
                      <h3 className="flex items-center gap-2 font-display text-base font-semibold text-brand-charcoal">
                        <ShieldAlert className="h-5 w-5 text-brand-terracotta" />
                        {terms.title}
                      </h3>

                      <div className="mt-4 space-y-3 text-xs leading-relaxed text-brand-ink">
                              {terms.leadingItems.map(line => (
                                <p key={line} className="font-semibold text-brand-charcoal">
                                  {renderTermsLine(line, { deposit: depositAmount, cancellationDays })}
                                </p>
                              ))}

                              {terms.supplies.length > 0 && (
                                <div>
                                  <p className="mb-1 font-semibold text-brand-charcoal">
                                    {renderTermsLine(terms.suppliesIntro, { deposit: depositAmount, cancellationDays })}
                                  </p>
                                  <ol className="list-decimal space-y-0.5 ps-5 font-medium">
                                    {terms.supplies.map(item => <li key={item}>{item}</li>)}
                                  </ol>
                                </div>
                              )}

                              {terms.trailingItems.map(line => (
                                <p key={line} className="font-medium">
                                  {renderTermsLine(line, { deposit: depositAmount, cancellationDays })}
                                </p>
                              ))}
                      </div>

                      <label
                        className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                          errors.terms ? 'border-red-400 bg-red-50/50' : 'border-brand-clay hover:bg-brand-sand/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={e => {
                            setTermsAccepted(e.target.checked);
                            if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
                          }}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-terracotta"
                        />
                        <span className="text-xs font-semibold text-brand-charcoal">
                          I have read and accept the event terms and guidelines.{' '}
                          <span className="text-red-500">*</span>
                        </span>
                      </label>
                      {errors.terms && (
                        <p className="mt-2 text-[11px] font-semibold text-red-600">{errors.terms}</p>
                      )}
                    </div>
                  </section>
                )}

              </motion.div>
            </AnimatePresence>

            {/* STEP NAVIGATION */}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => goToStep(step - 1)}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-brand-clay bg-white px-6 py-3.5 text-sm font-semibold text-brand-ink transition-colors hover:text-brand-charcoal"
                >
                  <ArrowLeft className="h-4 w-4 flip-rtl" />
                  Back
                </button>
              ) : <span className="hidden sm:block" />}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => goToStep(step + 1)}
                  className="cursor-pointer rounded-full bg-brand-terracotta px-8 py-4 text-sm font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.99]"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  className="cursor-pointer rounded-full bg-brand-terracotta px-8 py-4 text-base font-semibold text-brand-cream shadow-button transition-colors hover:bg-brand-terracotta-hover active:scale-[0.99]"
                >
                  Pay {depositAmount} SAR Deposit
                </button>
              )}
            </div>
          </div>

          {/* THE TICKET — beside the form from lg up, until the review step
              takes it into the middle of the page. */}
          {step < 4 && (
            <aside className="hidden lg:col-span-5 lg:block xl:col-span-4">
              <div className="sticky top-24">
                <Ticket />
              </div>
            </aside>
          )}
        </div>
      </form>

      {/* MOBILE SUMMARY — a bar that stays out of the way until it is opened.
          Hidden on the review step, where the ticket is already the page. */}
      <div className={`fixed inset-x-0 bottom-0 z-30 border-t border-brand-clay bg-brand-cream/95 backdrop-blur-md lg:hidden ${
        step === 4 ? 'hidden' : ''
      }`}>
        <AnimatePresence initial={false}>
          {mobileSummaryOpen && (
            <motion.div
              initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease }}
              className="max-h-[55vh] overflow-y-auto"
            >
              <div className="px-4 py-5">{ticketInner}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setMobileSummaryOpen(v => !v)}
          aria-expanded={mobileSummaryOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] text-start"
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-brand-ink">
              {selectedPackage?.name || 'Select a package'}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand-muted">
              <Clock className="h-3 w-3" />
              <span className="truncate">{prettyDate || '—'} · {bookingTime || '—'}</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="font-display text-lg font-semibold text-brand-terracotta ltr-numerals">
              {depositAmount} SAR
            </span>
            <ChevronDown className={`h-4 w-4 text-brand-muted transition-transform ${mobileSummaryOpen ? '' : 'rotate-180'}`} />
          </span>
        </button>
      </div>
    </div>
  );
};
