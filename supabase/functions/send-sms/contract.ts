/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The HTTP request/response contract for send-sms. Kept separate from
 * logic.ts (input validation) and index.ts (the Deno/Supabase plumbing),
 * same split as provision-staff. Mirrored (not imported — Vite and Deno
 * are different toolchains) in the frontend client wrapper this function
 * gets, once Chunk 2 wires a caller to it.
 *
 * Deliberately narrow and generic — { phone, message } only, with no
 * notion of "pickup reminder" or any other specific use case — so a later
 * OTP flow can call this same function with its own message text rather
 * than needing a second, near-duplicate SMS-sending function.
 */

export interface SendSmsRequest {
  phone: string;
  message: string;
}

export interface SendSmsResponse {
  success: boolean;
  error?: string;
}
