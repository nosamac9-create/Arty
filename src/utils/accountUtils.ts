/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account type for a customer record.
 *
 * The only thing that decides this is whether the record is linked to an
 * authenticated website account. Deliberately NOT considered:
 *
 *   - the customer's source text (Walk-in / Website Registered / Admin Created)
 *   - whether an email address is present, real or empty
 *   - whether the customer has bookings, payments or pottery pieces
 *
 * A guest with a real email, a long booking history and paid invoices is still a
 * guest until an account is linked to their record.
 */

import { CustomerAccount } from '../types';

/**
 * True when the record is linked to an authentication account.
 *
 * Accepted links, in the order they are checked:
 *  1. `userId` / `authUserId` — an explicit link to an auth user record.
 *  2. `hasAccount` — the flag set when an account is created or linked.
 *  3. A stored credential — this app authenticates against `password`, so a
 *     record holding one can sign in and is by definition registered.
 */
export function hasWebsiteAccount(customer: Partial<CustomerAccount> | null | undefined): boolean {
  if (!customer) return false;

  const linkedUserId = (customer as any).userId || (customer as any).authUserId;
  if (linkedUserId && String(linkedUserId).trim().length > 0) return true;

  if (customer.hasAccount === true) return true;

  if (customer.password && String(customer.password).length > 0) return true;

  return false;
}

export type AccountType = 'Registered' | 'Guest';

export function getAccountType(customer: Partial<CustomerAccount> | null | undefined): AccountType {
  return hasWebsiteAccount(customer) ? 'Registered' : 'Guest';
}

/** Filter predicate for the Account Type control. The two groups never overlap. */
export function matchesAccountType(
  customer: Partial<CustomerAccount> | null | undefined,
  filter: 'All' | AccountType | string
): boolean {
  if (!filter || filter === 'All') return true;
  if (filter === 'Registered') return hasWebsiteAccount(customer);
  if (filter === 'Guest') return !hasWebsiteAccount(customer);
  return true;
}

/**
 * The fields that link an existing guest record to a newly created account.
 * Applied to the guest's own record so no duplicate customer is created.
 */
export function buildAccountLink(userId: string, password?: string): Partial<CustomerAccount> {
  return {
    userId,
    hasAccount: true,
    ...(password ? { password } : {}),
    updatedAt: new Date().toISOString()
  } as Partial<CustomerAccount>;
}
