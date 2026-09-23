/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reads an entire table/view through PostgREST, past its `max-rows` cap (1000 by
 * default on Supabase) instead of silently truncating at one page.
 *
 * A stable order is required for `.range()` paging to be well-defined — without
 * one, Postgres gives no guarantee that two range windows over the same query
 * partition its rows without gaps or duplicates. The caller's own orderBy (if
 * given) is honoured for display order; `id` is added as a tiebreaker (or used
 * outright when the caller gave none), so paging itself is always stable even
 * when the caller's chosen column has duplicate values. Every table this app
 * reads through the three callers of this helper has an `id` primary key
 * (0001_init.sql), so this is safe to apply unconditionally.
 *
 * Stops as soon as a page comes back shorter than pageSize — the natural
 * end-of-data signal — rather than relying on a count header.
 */
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

/** Matches PostgREST's own default max-rows cap, so one page is one server round trip. */
const DEFAULT_PAGE_SIZE = 1000;

export interface FetchAllRowsOptions {
  orderBy?: string;
  ascending?: boolean;
  pageSize?: number;
}

export interface FetchAllRowsResult {
  data: any[] | null;
  error: PostgrestError | null;
}

export async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  options: FetchAllRowsOptions = {}
): Promise<FetchAllRowsResult> {
  const { orderBy, ascending = true, pageSize = DEFAULT_PAGE_SIZE } = options;
  const rows: any[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select('*');
    query = orderBy && orderBy !== 'id'
      ? query.order(orderBy, { ascending }).order('id', { ascending: true })
      : query.order('id', { ascending: true });

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < pageSize) break;   // shorter than a full page: no more data
    from += pageSize;
  }

  return { data: rows, error: null };
}
