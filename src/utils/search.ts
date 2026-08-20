/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared helpers for the console's search fields.
 *
 * Every one of them was written as `record.field.toLowerCase().includes(q)`,
 * which is fine until a record arrives without that field — a staff member with
 * no email, a workshop with no instructor — and then the whole page throws on a
 * keystroke and renders blank. Reading through these helpers means a missing
 * field is a non-match instead of a crash.
 */

import { useEffect, useState } from 'react';

/** Lowercased text for any value, including null, undefined and numbers. */
export const searchText = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).toLowerCase();

/**
 * True when any field contains the query. An empty query matches everything,
 * so clearing a search always restores the full list.
 */
export const matchesQuery = (fields: unknown[], query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some(field => searchText(field).includes(q));
};

/** Digits only, for matching a phone number whatever way it was typed. */
export const searchDigits = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).replace(/\D/g, '');

/**
 * Holds back a fast-changing value.
 *
 * The larger tables re-derive their rows from several tables on every
 * keystroke; at a few thousand records that is what makes typing feel like the
 * page has locked up. The input itself stays uncontrolled by this — only the
 * filtering waits.
 */
export function useDebouncedValue<T>(value: T, delayMs = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
