/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * One customer identity service for the whole application.
 *
 * A customer is one person regardless of how they reached Arty Café — website
 * registration, a workshop/birthday/event booking, a Live Queue walk-in, an
 * admin-created record or the Pottery Logging Console. Every one of those
 * surfaces resolves through the functions here, against the same shared
 * customers table, so there is never a second list of "walk-in customers" or
 * "pottery customers".
 *
 * The primary returning-customer key is the NORMALIZED PHONE NUMBER, so the same
 * person is recognised whether staff type 0501234567, 966501234567 or
 * +966501234567.
 */

import { CustomerAccount, Booking, QueueItem, PotteryPiece } from '../types';
import { parsePhoneComponents, normalisePhone } from './phoneUtils';
import { hasWebsiteAccount } from './accountUtils';

/**
 * Digits-only national form used for matching: country code and any leading
 * zero removed, so every valid way of writing a number collapses to one key.
 */
export function normalizeCustomerPhone(phone?: string | null): string {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('966')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

/** International display form, e.g. "+966501234567". */
export function toDisplayPhone(phone?: string | null): string {
  if (!phone) return '';
  try {
    const { countryCode, nationalNumber } = parsePhoneComponents(phone);
    const full = normalisePhone(countryCode, nationalNumber);
    if (full && full.length > 3) return full;
  } catch {
    /* fall through to the raw value */
  }
  return String(phone).trim();
}

/** The stored key for a customer, tolerating records saved before the field existed. */
export function customerPhoneKey(customer: Partial<CustomerAccount>): string {
  return customer.normalizedPhone || normalizeCustomerPhone(customer.phone);
}

function cleanEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

export type MatchReason = 'phone' | 'account' | 'email' | 'none';

export interface CustomerMatch {
  customer?: CustomerAccount;
  reason: MatchReason;
}

/**
 * Finds the existing customer for a set of identifiers.
 *
 * Order matters: the phone number is the main rule, then an explicit account
 * link, then email. Email is checked last because several people can share a
 * household address, while a mobile number identifies a person.
 */
export function findCustomerMatch(
  customers: CustomerAccount[],
  identifiers: { phone?: string; email?: string; userId?: string }
): CustomerMatch {
  const phoneKey = normalizeCustomerPhone(identifiers.phone);
  if (phoneKey) {
    const byPhone = customers.find(c => customerPhoneKey(c) === phoneKey);
    if (byPhone) return { customer: byPhone, reason: 'phone' };
  }

  if (identifiers.userId) {
    const byAccount = customers.find(
      c => c.userId === identifiers.userId || c.id === identifiers.userId
    );
    if (byAccount) return { customer: byAccount, reason: 'account' };
  }

  const email = cleanEmail(identifiers.email);
  if (email) {
    const byEmail = customers.find(c => cleanEmail(c.email) === email);
    if (byEmail) return { customer: byEmail, reason: 'email' };
  }

  return { reason: 'none' };
}

/** Convenience wrapper for the common phone-only lookup. */
export function findCustomerByPhone(
  customers: CustomerAccount[],
  phone?: string
): CustomerAccount | undefined {
  return findCustomerMatch(customers, { phone }).customer;
}

export interface CustomerSearchResult {
  customer: CustomerAccount;
  /** Which field matched, for a hint in the UI. */
  matchedOn: 'name' | 'phone' | 'email' | 'id';
}

/**
 * One search used by every customer selector: Live Queue, Pottery Logging, the
 * Customers page, booking creation and admin customer creation.
 */
export function searchCustomers(
  customers: CustomerAccount[],
  query: string,
  limit = 8
): CustomerSearchResult[] {
  const raw = String(query || '').trim();
  if (!raw) return [];

  const q = raw.toLowerCase();
  const digits = normalizeCustomerPhone(raw);
  const isPhoneQuery = /^[+\d\s()\-.]+$/.test(raw) && digits.length >= 3;

  const results: CustomerSearchResult[] = [];

  for (const customer of customers) {
    if (isPhoneQuery && customerPhoneKey(customer).includes(digits)) {
      results.push({ customer, matchedOn: 'phone' });
      continue;
    }
    if ((customer.name || '').toLowerCase().includes(q)) {
      results.push({ customer, matchedOn: 'name' });
      continue;
    }
    if (cleanEmail(customer.email).includes(q)) {
      results.push({ customer, matchedOn: 'email' });
      continue;
    }
    if ((customer.id || '').toLowerCase().includes(q)) {
      results.push({ customer, matchedOn: 'id' });
    }
  }

  return results.slice(0, limit);
}

export interface CustomerActivitySummary {
  visits: number;
  bookings: number;
  pieces: number;
  hasAccount: boolean;
  lastVisit?: string;
}

/**
 * Activity counts for a customer, matched by id first and phone second.
 *
 * `piecesCount`, when given, replaces filtering the `pieces` array entirely
 * — pieces (unlike bookings/queue) is gated on the pieces-admin permission
 * (0014), so the global pieces context value a caller without that
 * permission sees is always empty. Pass a count already fetched via
 * count_pieces_for_customer() (migration 0020) instead of `sources.pieces`
 * in that case. `sources.pieces` stays as a fallback for a caller that
 * genuinely has the full array (e.g. a pieces-admin session).
 */
export function summarizeCustomerActivity(
  customer: CustomerAccount,
  sources: { bookings?: Booking[]; queue?: QueueItem[]; pieces?: PotteryPiece[]; piecesCount?: number }
): CustomerActivitySummary {
  const { bookings = [], queue = [], pieces = [], piecesCount } = sources;
  const key = customerPhoneKey(customer);

  const belongs = (customerId?: string, phone?: string) =>
    (customerId && customerId === customer.id) ||
    (!!key && normalizeCustomerPhone(phone) === key);

  const theirQueue = queue.filter(q => belongs(q.customerId, q.phone));
  const theirBookings = bookings.filter(b => belongs(b.customerId, b.customerPhone));
  const theirPiecesCount = typeof piecesCount === 'number'
    ? piecesCount
    : pieces.filter(p => belongs(p.customerId, p.customerPhone)).length;

  const dates = [...theirQueue.map(q => q.date), ...theirBookings.map(b => b.date)]
    .filter(Boolean)
    .sort();

  return {
    visits: theirQueue.length,
    bookings: theirBookings.length,
    pieces: theirPiecesCount,
    hasAccount: hasWebsiteAccount(customer),
    lastVisit: dates[dates.length - 1]
  };
}

/** Fields kept in step whenever a customer is resolved or created. */
export function buildCustomerIdentity(input: {
  name?: string;
  phone?: string;
  email?: string;
}): Pick<CustomerAccount, 'name' | 'phone' | 'email' | 'normalizedPhone' | 'displayPhone'> {
  const display = toDisplayPhone(input.phone);
  return {
    name: (input.name || '').trim(),
    phone: display,
    displayPhone: display,
    normalizedPhone: normalizeCustomerPhone(input.phone),
    email: cleanEmail(input.email)
  };
}

/**
 * Merges new details onto an existing customer WITHOUT destroying what is
 * already known: a blank incoming email never clears a stored one, and the
 * account relationship is never touched here.
 */
export function mergeCustomerDetails(
  existing: CustomerAccount,
  incoming: { name?: string; phone?: string; email?: string }
): Partial<CustomerAccount> {
  const updates: Partial<CustomerAccount> = {};

  const name = (incoming.name || '').trim();
  if (name && name !== existing.name) updates.name = name;

  const email = cleanEmail(incoming.email);
  if (email && email !== cleanEmail(existing.email)) updates.email = email;

  const phoneKey = normalizeCustomerPhone(incoming.phone);
  if (phoneKey && phoneKey !== customerPhoneKey(existing)) {
    updates.phone = toDisplayPhone(incoming.phone);
    updates.displayPhone = toDisplayPhone(incoming.phone);
    updates.normalizedPhone = phoneKey;
  } else if (phoneKey && !existing.normalizedPhone) {
    // Backfill the match key on a record saved before the field existed.
    updates.normalizedPhone = phoneKey;
    updates.displayPhone = existing.displayPhone || existing.phone;
  }

  return updates;
}

export interface DuplicateGroup {
  normalizedPhone: string;
  /** The record everything should be consolidated onto. */
  canonical: CustomerAccount;
  duplicates: CustomerAccount[];
}

/**
 * Groups records that share a normalized phone number.
 *
 * Only the phone is used — records are never grouped because their names look
 * similar. The canonical record is the one with a website account, falling back
 * to the oldest, so an account relationship is never lost in consolidation.
 */
export function findDuplicateGroups(customers: CustomerAccount[]): DuplicateGroup[] {
  const byPhone = new Map<string, CustomerAccount[]>();

  customers.forEach(customer => {
    const key = customerPhoneKey(customer);
    if (!key) return;
    byPhone.set(key, [...(byPhone.get(key) || []), customer]);
  });

  const groups: DuplicateGroup[] = [];

  byPhone.forEach((group, normalizedPhone) => {
    if (group.length < 2) return;

    const ranked = [...group].sort((a, b) => {
      const accountDiff = Number(hasWebsiteAccount(b)) - Number(hasWebsiteAccount(a));
      if (accountDiff !== 0) return accountDiff;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

    groups.push({
      normalizedPhone,
      canonical: ranked[0],
      duplicates: ranked.slice(1)
    });
  });

  return groups;
}
