/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live table reads, replacing Dexie's useLiveQuery.
 *
 * Each subscription does an initial fetch and then listens on a realtime
 * channel, applying inserts, updates and deletes to local state, so the UI
 * stays current the way liveQuery did.
 *
 * The value is `undefined` until the first read resolves. That is the loading
 * signal: callers render an empty list and a loading state, never seed data.
 * A failed read also yields an empty list — never phantom rows.
 */

import { useEffect, useState, useRef } from 'react';
import { getDataClient, onDataClientChange } from './supabase';
import { rowToModel, rowsToModels } from './mappers';

export interface LiveTableOptions {
  /** Column to sort by, applied to the initial fetch and to realtime inserts. */
  orderBy?: string;
  ascending?: boolean;
  /** Skip the subscription entirely (e.g. while Supabase is unconfigured). */
  enabled?: boolean;
}

/**
 * Reads a table and keeps it live.
 *
 * Returns `undefined` while loading, then an array. Errors are logged and
 * surface as an empty array so nothing downstream sees invented data.
 */
export function useLiveTable<T = any>(
  table: string,
  options: LiveTableOptions = {}
): T[] | undefined {
  const { orderBy, ascending = true, enabled = true } = options;
  const [rows, setRows] = useState<T[] | undefined>(undefined);

  // Kept in a ref so the realtime handler always sorts the current way without
  // resubscribing when a caller passes a new options object.
  const sortRef = useRef({ orderBy, ascending });
  sortRef.current = { orderBy, ascending };

  // Bumped when the signed-in session changes, so the subscription is rebuilt
  // against the client that now has the right privileges.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  useEffect(() => onDataClientChange(() => setSessionEpoch(n => n + 1)), []);

  useEffect(() => {
    const supabase = getDataClient();
    if (!enabled || !supabase) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const sortRows = (list: any[]) => {
      const { orderBy: key, ascending: asc } = sortRef.current;
      if (!key) return list;
      return [...list].sort((a, b) => {
        const av = a[key], bv = b[key];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      });
    };

    const load = async () => {
      let query = supabase!.from(table).select('*');
      if (orderBy) query = query.order(orderBy, { ascending });

      const { data, error } = await query;
      if (cancelled) return;

      if (error) {
        // Empty, never seed data: a failed read must not look like real rows.
        console.error(`Failed to read ${table}:`, error.message);
        setRows([]);
        return;
      }
      setRows(rowsToModels<T>(data));
    };

    load();

    const channel = supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        payload => {
          if (cancelled) return;
          setRows(current => {
            const list = current ? [...current] : [];
            const idOf = (r: any) => r?.id;

            if (payload.eventType === 'INSERT') {
              const model = rowToModel<T>(payload.new as any);
              if (list.some(r => idOf(r) === idOf(model))) return list;
              return sortRows([...list, model]) as T[];
            }

            if (payload.eventType === 'UPDATE') {
              const model = rowToModel<T>(payload.new as any);
              const idx = list.findIndex(r => idOf(r) === idOf(model));
              if (idx === -1) return sortRows([...list, model]) as T[];
              list[idx] = model;
              return sortRows(list) as T[];
            }

            if (payload.eventType === 'DELETE') {
              const goneId = idOf(payload.old as any);
              return list.filter(r => idOf(r) !== goneId);
            }

            return list;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase!.removeChannel(channel);
    };
    // `table` alone: sorting changes are read from the ref, so the channel is
    // not torn down and rebuilt on every render.
  }, [table, enabled, sessionEpoch]);

  return rows;
}

/** One-off fresh read, for checks that must not use cached state. */
export async function fetchTable<T = any>(table: string): Promise<T[]> {
  const supabase = getDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Failed to read ${table}:`, error.message);
    return [];
  }
  return rowsToModels<T>(data);
}

/** One row by id, or undefined. */
export async function fetchRow<T = any>(table: string, id: string): Promise<T | undefined> {
  const supabase = getDataClient();
  if (!supabase || !id) return undefined;
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error || !data) return undefined;
  return rowToModel<T>(data);
}
