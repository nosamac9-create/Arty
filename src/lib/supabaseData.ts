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

/**
 * Whether a realtime message actually carried the row.
 *
 * Realtime caps the size of a record it will deliver (`max_record_bytes`,
 * 1MB by default). A row over that cap is not sent: the message arrives with
 * an error marker and its columns stripped, carrying at most the primary key.
 * Workshops storing photographs as base64 in a text column are several
 * megabytes, so every update to one produces exactly that.
 *
 * Such a message says nothing about the row's contents, so it must never be
 * written to the cache — see `mergeRow` for what happened when it was.
 */
function isTruncatedPayload(payload: any): boolean {
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return true;

  const record = payload?.new;
  if (!record || typeof record !== 'object') return true;

  // A record reduced to its key (or to nothing) is a truncation, not a row
  // that genuinely has one column.
  const keys = Object.keys(record);
  return keys.length === 0 || (keys.length === 1 && keys[0] === 'id');
}

/**
 * Folds an incoming row into the one already cached.
 *
 * The update branch used to assign the incoming row over the cached one. That
 * made a partial message destructive: anything the message omitted was dropped
 * from the cache, and the workshop form — which reads the cached list, not the
 * database — then loaded a record with its photographs and long text missing.
 * Saving from that form wrote the placeholder fallbacks back over real content,
 * so a read defect quietly became a write one.
 *
 * Only keys the message actually carried are taken. `undefined` never
 * overwrites a known value; an explicit `null` does, because that is a real
 * value the database can hold and clearing a field is a legitimate update.
 */
function mergeRow<T>(cached: T, incoming: any): T {
  if (!cached) return incoming as T;

  const merged: any = { ...cached };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as T;
}

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

          // A message that did not carry its row tells us only that the row
          // changed. Applying it would erase whatever it omitted, so the cache
          // is left alone and the row is re-read over REST instead, which has
          // no size cap. Deletes are exempt: they legitimately carry only a key.
          if (payload.eventType !== 'DELETE' && isTruncatedPayload(payload)) {
            const changedId = (payload.new as any)?.id ?? (payload.old as any)?.id;
            console.warn(
              `Realtime payload for ${table} arrived without its row` +
                (changedId ? ` (id ${changedId})` : '') +
                ' — re-reading it directly. This means the row is over the realtime size cap.'
            );
            if (changedId) {
              supabase!
                .from(table)
                .select('*')
                .eq('id', changedId)
                .maybeSingle()
                .then(({ data, error }) => {
                  if (cancelled || error || !data) return;
                  const fresh = rowToModel<T>(data);
                  setRows(current => {
                    const list = current ? [...current] : [];
                    const idx = list.findIndex((r: any) => r?.id === (fresh as any)?.id);
                    if (idx === -1) return sortRows([...list, fresh]) as T[];
                    list[idx] = fresh;
                    return sortRows(list) as T[];
                  });
                });
            }
            return;
          }

          setRows(current => {
            const list = current ? [...current] : [];
            const idOf = (r: any) => r?.id;

            if (payload.eventType === 'INSERT') {
              const model = rowToModel<T>(payload.new as any);
              const idx = list.findIndex(r => idOf(r) === idOf(model));
              // An insert for a row already held is treated as an update, not
              // ignored: the cached copy may predate it.
              if (idx !== -1) {
                list[idx] = mergeRow(list[idx], model);
                return sortRows(list) as T[];
              }
              return sortRows([...list, model]) as T[];
            }

            if (payload.eventType === 'UPDATE') {
              const model = rowToModel<T>(payload.new as any);
              const idx = list.findIndex(r => idOf(r) === idOf(model));
              if (idx === -1) return sortRows([...list, model]) as T[];
              // Merged, not assigned: a message that omits a column must not
              // remove it from the cache.
              list[idx] = mergeRow(list[idx], model);
              return sortRows(list) as T[];
            }

            if (payload.eventType === 'DELETE') {
              const goneId = idOf(payload.old as any);
              // Without a key there is nothing to match. Dropping through would
              // compare against undefined and quietly remove nothing; saying so
              // is better than a delete that silently did not happen.
              if (goneId === undefined || goneId === null) {
                console.warn(`Realtime DELETE for ${table} carried no id — cache left unchanged.`);
                return list;
              }
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
