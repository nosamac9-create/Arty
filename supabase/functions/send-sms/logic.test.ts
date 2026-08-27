/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Plain-assertion tests for validateSendSmsInput() (SMS integration audit,
 * Chunk 1). No test framework — this repo has none, and logic.ts has zero
 * Deno dependencies specifically so it can run under the tsx devDependency
 * already installed here:
 *
 *   npx tsx supabase/functions/send-sms/logic.test.ts
 *
 * Phone-number NORMALIZATION (stripping 00/966/0, prepending 966) is not
 * tested here — that lives in _shared/mshastra.ts, which has no pure
 * function boundary of its own (it's one small transform inside sendSms(),
 * which does real network I/O). This file only covers the input-shape
 * validation that runs before any network call is attempted.
 */

import { validateSendSmsInput, MAX_MESSAGE_LENGTH } from './logic.ts';

let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    console.log(`  ok — ${label}`);
  } else {
    failed++;
    console.error(`  FAIL — ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('validateSendSmsInput()');

// --- valid input ---------------------------------------------------------
assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: 'Your piece is ready!' }),
  { valid: true, phone: '0501234567', message: 'Your piece is ready!' },
  'plausible local-format phone + non-empty message -> valid'
);

assertEqual(
  validateSendSmsInput({ phone: '+966 50 123 4567', message: 'قطعتك جاهزة!' }),
  { valid: true, phone: '+966 50 123 4567', message: 'قطعتك جاهزة!' },
  'international format with spaces/+, Arabic message -> valid (whitespace trimmed only at the ends)'
);

// --- phone -----------------------------------------------------------------
assertEqual(
  validateSendSmsInput({ phone: '', message: 'hello' }).valid,
  false,
  'empty phone -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '   ', message: 'hello' }).valid,
  false,
  'whitespace-only phone -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: undefined, message: 'hello' }).valid,
  false,
  'non-string phone -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '12345', message: 'hello' }).valid,
  false,
  'too few digits (5) -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '1234567', message: 'hello' }).valid,
  false,
  'one digit short of the minimum (7) -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '12345678', message: 'hello' }).valid,
  true,
  'exactly the minimum (8 digits) -> valid'
);

assertEqual(
  validateSendSmsInput({ phone: '123456789012345', message: 'hello' }).valid,
  true,
  'exactly the maximum (15 digits) -> valid'
);

assertEqual(
  validateSendSmsInput({ phone: '1234567890123456', message: 'hello' }).valid,
  false,
  'one digit over the maximum (16) -> invalid'
);

// --- message -----------------------------------------------------------------
assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: '' }).valid,
  false,
  'empty message -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: '   ' }).valid,
  false,
  'whitespace-only message -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: undefined }).valid,
  false,
  'non-string message -> invalid'
);

assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: 'x'.repeat(MAX_MESSAGE_LENGTH) }).valid,
  true,
  'message exactly at the max length -> valid'
);

assertEqual(
  validateSendSmsInput({ phone: '0501234567', message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1) }).valid,
  false,
  'message one character over the max length -> invalid'
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  // deno-lint-ignore no-process-exit -- also valid under plain Node/tsx.
  (globalThis as any).process?.exit(1);
}
