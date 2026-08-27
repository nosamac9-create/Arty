/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure input validation for the send-sms Edge Function. Zero Deno/Supabase
 * imports, so it can run under plain Node/tsx in logic.test.ts, same as
 * provision-staff's logic.ts.
 *
 * Deliberately does NOT touch phone-number normalization — that lives in
 * _shared/mshastra.ts, which owns the mShastra-specific format. This file
 * only rejects input that's clearly not a phone number or message at all,
 * before any network call is attempted.
 */

/** A generous, provider-agnostic sanity bound — not a value taken from
 *  mShastra's docs (which don't specify a max message length in what was
 *  shared with this project). Long enough to never reject a legitimate
 *  message, short enough to catch an obvious bug (e.g. an entire JSON
 *  object accidentally passed as `message`). */
export const MAX_MESSAGE_LENGTH = 1000;

/** E.164 allows up to 15 digits; 8 is a generous lower bound covering any
 *  real phone number, national or international, after non-digits are
 *  stripped. */
export const MIN_PHONE_DIGITS = 8;
export const MAX_PHONE_DIGITS = 15;

export type SendSmsValidation =
  | { valid: true; phone: string; message: string }
  | { valid: false; error: string };

export function validateSendSmsInput(input: { phone: unknown; message: unknown }): SendSmsValidation {
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const message = typeof input.message === 'string' ? input.message : '';

  if (!phone) {
    return { valid: false, error: 'phone is required.' };
  }

  const digitCount = phone.replace(/\D/g, '').length;
  if (digitCount < MIN_PHONE_DIGITS || digitCount > MAX_PHONE_DIGITS) {
    return { valid: false, error: 'phone does not look like a valid phone number.' };
  }

  if (!message.trim()) {
    return { valid: false, error: 'message is required.' };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  return { valid: true, phone, message };
}
