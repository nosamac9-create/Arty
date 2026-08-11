/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ONE validation layer for the whole application.
 *
 * Admin, Super Admin and the Customer Site share the same Dexie database, so
 * they must share the same rules — a number rejected on the customer sign-up
 * form has to be rejected in the Live Queue walk-in modal too, and a duplicate
 * has to be found regardless of which surface created the original record.
 *
 * Everything here is either a pure function returning `ValidationResult`, or an
 * async function that additionally reads the database. No component defines its
 * own rule; forms call these and render the returned message next to the field.
 *
 * Phone numbers are normalised BEFORE they are stored or compared, so a
 * duplicate check matches whether the number was typed as 0501234567,
 * 966501234567 or +966 50 123 4567.
 */

import { sdb } from '../lib/supabaseDb';
import { CustomerAccount, StaffMember, WorkshopSessionRecord } from '../types';
import { normalizeCustomerPhone, customerPhoneKey } from './customerIdentity';
import { getSessionSeatUsage } from './queueUtils';
import { parseArabicDigits } from './phoneUtils';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * The database these checks read: Postgres, through the shared façade.
 *
 * Duplicate, capacity and existence checks therefore run against the same
 * records every other reader sees. It stays injectable so a caller can pass a
 * narrowed or stubbed source — the System Health suite passes one scoped to its
 * own namespaced rows.
 */
type TableApi = (typeof sdb)['customers'];

export type ValidationDb = {
  customers: TableApi;
  staff: TableApi;
  workshops: TableApi;
  workshopSessions: TableApi;
  bookings: TableApi;
  queue: TableApi;
};

/** The live source. */
const db = sdb as unknown as ValidationDb;


export const OK: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

/** Returns the first failing result, or OK when every rule passes. */
export function firstError(...results: ValidationResult[]): ValidationResult {
  return results.find(r => !r.valid) || OK;
}

/** Collects field-keyed results into the error map a form renders from. */
export function collectErrors(fields: Record<string, ValidationResult>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, result] of Object.entries(fields)) {
    if (!result.valid && result.error) errors[key] = result.error;
  }
  return errors;
}

// ==========================================================
// CANONICAL FORMS
// Every surface stores and compares these, never raw input.
// ==========================================================

/**
 * The single stored phone format: `+966` followed by 9 national digits.
 * Returns '' when the input is not a valid Saudi mobile number.
 */
export function canonicalPhone(input?: string | null): string {
  const national = normalizeCustomerPhone(parseArabicDigits(String(input ?? '')));
  return /^5\d{8}$/.test(national) ? `+966${national}` : '';
}

/** The digits-only key used for duplicate matching. */
export function phoneMatchKey(input?: string | null): string {
  return normalizeCustomerPhone(parseArabicDigits(String(input ?? '')));
}

/** The single stored email format: trimmed and lowercased. */
export function canonicalEmail(input?: string | null): string {
  return String(input ?? '').trim().toLowerCase();
}

// ==========================================================
// CUSTOMER / ACCOUNT — pure rules
// ==========================================================

export function validateRequired(value: any, fieldLabel: string): ValidationResult {
  const empty = Array.isArray(value)
    ? value.length === 0
    : value === undefined || value === null || String(value).trim() === '';
  return empty ? fail(`${fieldLabel} is required.`) : OK;
}

/**
 * Saudi mobile number: `+966` followed by 9 digits starting with 5, or the
 * local `05XXXXXXXX` form which normalises to the same number.
 */
export function validatePhoneRule(phone?: string | null): ValidationResult {
  const raw = parseArabicDigits(String(phone ?? '')).trim();
  if (!raw) return fail('Phone number is required.');

  // Formatting is allowed and simply stripped: a leading +, spaces, dashes,
  // dots and brackets. Only what is left must be digits, so a valid number
  // written as +966 50-123 4567 passes the format rule and goes on to the
  // duplicate check.
  const stripped = raw.replace(/^\+/, '').replace(/[\s()\-.]/g, '');
  if (!stripped) return fail('Phone number is required.');
  if (!/^\d+$/.test(stripped)) return fail('Phone number must contain digits only.');

  const national = normalizeCustomerPhone(raw);
  if (!national) return fail('Phone number is required.');
  if (!national.startsWith('5')) {
    return fail('Enter a Saudi mobile number starting with 5, e.g. 0501234567 or +966501234567.');
  }
  if (national.length !== 9) {
    return fail('A Saudi mobile number has 9 digits after the country code, e.g. +966501234567.');
  }
  return OK;
}

export function validateEmailRule(email?: string | null, required = true): ValidationResult {
  const value = canonicalEmail(email);
  if (!value) return required ? fail('Email address is required.') : OK;
  // Deliberately simple: one @, something either side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)) {
    return fail('Enter a valid email address, e.g. name@example.com.');
  }
  return OK;
}

export interface PasswordChecklistItem {
  label: string;
  met: boolean;
}

/** The live checklist a sign-up form renders as the customer types. */
export function passwordChecklist(password?: string | null): PasswordChecklistItem[] {
  const value = String(password ?? '');
  return [
    { label: 'At least 8 characters', met: value.length >= 8 },
    { label: 'Contains a letter', met: /[a-zA-Z]/.test(value) },
    { label: 'Contains a number', met: /\d/.test(value) }
  ];
}

export function validatePasswordRule(password?: string | null): ValidationResult {
  const unmet = passwordChecklist(password).filter(item => !item.met);
  if (!String(password ?? '')) return fail('Password is required.');
  if (unmet.length === 0) return OK;
  return fail(`Password must have: ${unmet.map(u => u.label.toLowerCase()).join(', ')}.`);
}

export function validatePasswordConfirmation(
  password?: string | null,
  confirmation?: string | null
): ValidationResult {
  if (!String(confirmation ?? '')) return fail('Please confirm your password.');
  return String(password ?? '') === String(confirmation ?? '')
    ? OK
    : fail('The two passwords do not match.');
}

// ==========================================================
// CUSTOMER / ACCOUNT — database-aware rules
// ==========================================================

/**
 * `excludeId` is the record being edited, so a customer editing their own
 * profile is not reported as a duplicate of themselves.
 */
export async function checkDuplicateCustomerPhone(
  phone?: string | null,
  excludeId?: string,
  source: ValidationDb = db
): Promise<ValidationResult> {
  const key = phoneMatchKey(phone);
  if (!key) return OK;

  const customers = await source.customers.toArray();
  const existing = customers.find(c => c.id !== excludeId && customerPhoneKey(c) === key);
  if (!existing) return OK;

  return fail(`This number already has an account under ${existing.name || 'another customer'}.`);
}

export async function checkDuplicateCustomerEmail(
  email?: string | null,
  excludeId?: string,
  source: ValidationDb = db
): Promise<ValidationResult> {
  const value = canonicalEmail(email);
  if (!value) return OK;

  const customers = await source.customers.toArray();
  const existing = customers.find(c => c.id !== excludeId && canonicalEmail(c.email) === value);
  if (!existing) return OK;

  return fail(`This email already has an account under ${existing.name || 'another customer'}.`);
}

export interface CustomerInput {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface CustomerValidationOptions {
  /** Id of the record being edited. */
  excludeId?: string;
  /** Sign-up sets this; admin-created records have no password. */
  requirePassword?: boolean;
  requireEmail?: boolean;
  /**
   * A returning customer matched by phone is expected, not a duplicate — the
   * Live Queue walk-in and checkout flows reuse the existing record.
   */
  allowExistingCustomer?: boolean;
  /** Database to read for the duplicate checks. Defaults to the live one. */
  source?: ValidationDb;
}

/** Every customer-creating form runs this before writing to Dexie. */
export async function validateCustomerForm(
  input: CustomerInput,
  options: CustomerValidationOptions = {}
): Promise<Record<string, string>> {
  const {
    excludeId,
    requirePassword = false,
    requireEmail = true,
    allowExistingCustomer = false,
    source = db
  } = options;

  const fields: Record<string, ValidationResult> = {
    name: validateRequired(input.name, 'Name'),
    phone: validatePhoneRule(input.phone),
    email: validateEmailRule(input.email, requireEmail)
  };

  if (requirePassword) {
    fields.password = validatePasswordRule(input.password);
    fields.confirmPassword = validatePasswordConfirmation(input.password, input.confirmPassword);
  }

  // Duplicate checks only run once the value itself is well formed.
  if (!allowExistingCustomer) {
    if (fields.phone.valid) {
      fields.phone = await checkDuplicateCustomerPhone(input.phone, excludeId, source);
    }
    if (fields.email.valid) {
      fields.email = await checkDuplicateCustomerEmail(input.email, excludeId, source);
    }
  }

  return collectErrors(fields);
}

// ==========================================================
// STAFF
// ==========================================================

export async function checkDuplicateStaffPhone(
  phone?: string | null,
  excludeId?: string,
  source: ValidationDb = db
): Promise<ValidationResult> {
  const key = phoneMatchKey(phone);
  if (!key) return OK;

  const staff = await source.staff.toArray();
  const existing = staff.find(
    s => s.id !== excludeId && (s.normalizedPhone || phoneMatchKey(s.phone)) === key
  );
  if (!existing) return OK;

  return fail(`This number is already registered to ${existing.name || 'another staff member'}.`);
}

export async function checkDuplicateStaffEmail(
  email?: string | null,
  excludeId?: string,
  source: ValidationDb = db
): Promise<ValidationResult> {
  const value = canonicalEmail(email);
  if (!value) return OK;

  const staff = await source.staff.toArray();
  const existing = staff.find(s => s.id !== excludeId && canonicalEmail(s.email) === value);
  if (!existing) return OK;

  return fail(`This email is already registered to ${existing.name || 'another staff member'}.`);
}

export interface StaffInput {
  name?: string;
  position?: string;
  phone?: string;
  email?: string;
}

export async function validateStaffForm(
  input: StaffInput,
  excludeId?: string,
  source: ValidationDb = db
): Promise<Record<string, string>> {
  const fields: Record<string, ValidationResult> = {
    name: validateRequired(input.name, 'Name'),
    position: validateRequired(input.position, 'Position'),
    phone: validatePhoneRule(input.phone),
    email: validateEmailRule(input.email, true)
  };

  if (fields.phone.valid) fields.phone = await checkDuplicateStaffPhone(input.phone, excludeId, source);
  if (fields.email.valid) fields.email = await checkDuplicateStaffEmail(input.email, excludeId, source);

  return collectErrors(fields);
}

// ==========================================================
// BOOKING
// Capacity is re-read from the database at submit time. Reading
// it once when the page loaded is what let two people book the
// last seat.
// ==========================================================

export interface SessionAvailability {
  session?: WorkshopSessionRecord;
  remaining: number;
  /** Set when the session itself cannot be booked at all. */
  error?: string;
}

/**
 * Reads the session and its bookings back out of Dexie and returns what is
 * genuinely left right now.
 */
export async function getSessionAvailability(
  sessionId?: string,
  source: ValidationDb = db
): Promise<SessionAvailability> {
  if (!sessionId) {
    return { remaining: 0, error: 'Select a date and time for this booking.' };
  }

  const session = await source.workshopSessions.get(sessionId);
  if (!session) {
    return { remaining: 0, error: 'That session is no longer available. Please choose another date or time.' };
  }
  if (session.status !== 'Published') {
    return { session, remaining: 0, error: 'That session is no longer open for booking. Please choose another date or time.' };
  }

  // Seats are counted by the one shared helper, so this agrees exactly with
  // what the Live Queue and the workshop pages show.
  const [workshops, bookings, queue] = await Promise.all([
    source.workshops.toArray(),
    source.bookings.toArray(),
    source.queue.toArray()
  ]);
  const usage = getSessionSeatUsage(session, { workshops, bookings, queue });
  return { session, remaining: usage.remainingCapacity };
}

export interface BookingInput {
  sessionId?: string;
  participants?: number | string;
}

/**
 * Re-checks capacity against the database at submit time, so a session that
 * filled up while the customer was on the page is caught.
 */
export async function validateBookingForm(
  input: BookingInput,
  source: ValidationDb = db
): Promise<Record<string, string>> {
  const fields: Record<string, ValidationResult> = {};

  const participants = Number(input.participants);
  if (!input.participants || Number.isNaN(participants) || participants < 1) {
    fields.participants = fail('Enter at least 1 participant.');
  }

  const availability = await getSessionAvailability(input.sessionId, source);
  if (availability.error) {
    fields.sessionId = fail(availability.error);
    return collectErrors(fields);
  }

  if (availability.remaining <= 0) {
    fields.sessionId = fail('This session is now fully booked. Please choose another date or time.');
  } else if (!fields.participants && participants > availability.remaining) {
    fields.participants = fail(
      `Only ${availability.remaining} ${availability.remaining === 1 ? 'spot is' : 'spots are'} left for this session.`
    );
  }

  return collectErrors(fields);
}

// ==========================================================
// WORKSHOP / EVENT
// ==========================================================

export interface WorkshopInput {
  title?: string;
  category?: string;
  price?: number | string;
  capacity?: number | string;
  ageRange?: string;
  /** Sessions or dates attached to this workshop/event. */
  sessions?: unknown[];
}

export function validatePrice(price?: number | string): ValidationResult {
  if (price === undefined || price === null || String(price).trim() === '') {
    return fail('Price is required.');
  }
  const value = Number(price);
  if (Number.isNaN(value)) return fail('Price must be a number.');
  return value >= 0 ? OK : fail('Price cannot be negative.');
}

export function validateCapacity(capacity?: number | string): ValidationResult {
  if (capacity === undefined || capacity === null || String(capacity).trim() === '') {
    return fail('Capacity is required.');
  }
  const value = Number(capacity);
  if (Number.isNaN(value)) return fail('Capacity must be a number.');
  return value >= 1 ? OK : fail('Capacity must be at least 1.');
}

export function validateWorkshopForm(input: WorkshopInput): Record<string, string> {
  return collectErrors({
    title: validateRequired(input.title, 'Workshop title'),
    category: validateRequired(input.category, 'Category'),
    price: validatePrice(input.price),
    capacity: validateCapacity(input.capacity),
    ageRange: validateRequired(input.ageRange, 'Age range'),
    sessions: (input.sessions || []).length > 0
      ? OK
      : fail('Add at least one session date before publishing.')
  });
}

export interface EventInput extends WorkshopInput {
  date?: string;
}

export function validateEventForm(input: EventInput): Record<string, string> {
  return collectErrors({
    title: validateRequired(input.title, 'Event title'),
    category: validateRequired(input.category, 'Category'),
    price: validatePrice(input.price),
    capacity: validateCapacity(input.capacity),
    ageRequirement: validateRequired(input.ageRange, 'Age requirement'),
    date: validateRequired(input.date, 'Event date')
  });
}

// ==========================================================
// STORAGE HELPERS
// Canonical values, applied on the way into Dexie.
// ==========================================================

/** Phone/email fields normalised for a customer record. */
export function customerStorageFields(input: { phone?: string; email?: string }): Pick<
  CustomerAccount, 'phone' | 'displayPhone' | 'normalizedPhone' | 'email'
> {
  const phone = canonicalPhone(input.phone);
  return {
    phone,
    displayPhone: phone,
    normalizedPhone: phoneMatchKey(input.phone),
    email: canonicalEmail(input.email)
  };
}

/** Phone/email fields normalised for a staff record. */
export function staffStorageFields(input: { phone?: string; email?: string }): Pick<
  StaffMember, 'phone' | 'normalizedPhone' | 'email'
> {
  return {
    phone: canonicalPhone(input.phone),
    normalizedPhone: phoneMatchKey(input.phone),
    email: canonicalEmail(input.email)
  };
}
