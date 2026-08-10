/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A Dexie-shaped façade over Supabase.
 *
 * Stage 2 moves the data layer to Postgres. The mutators in AppContext carry
 * invariants that are easy to lose in a rewrite — timeline appends, piece
 * history entries, phone normalisation, spots recalculation — so rather than
 * restating ~55 of them, their bodies are left intact and the storage
 * underneath them is swapped.
 *
 * Every method here is a network call. Two consequences the callers must
 * respect, and which are handled explicitly in AppContext:
 *
 *   1. Seat allocation must NOT be read-modify-written through this façade.
 *      Booking uses the book_session_seats RPC so two concurrent callers
 *      cannot both take the last seat.
 *   2. `transaction()` is a pass-through, not a real transaction. Anything
 *      needing atomicity belongs in an RPC.
 *
 * Column names are translated by lib/mappers: the app keeps camelCase.
 */

import { getDataClient } from './supabase';
import { rowToModel, rowsToModels, toRow } from './mappers';

/** Dexie store name -> Postgres table. */
const TABLE_FOR: Record<string, string> = {
  workshops: 'workshops',
  workshopSessions: 'workshop_sessions',
  bookings: 'bookings',
  queue: 'queue',
  pieces: 'pieces',
  pieceHistory: 'piece_history',
  categories: 'categories',
  notifications: 'notifications',
  pipelineStages: 'pipeline_stages',
  staff: 'staff',
  workshopOptions: 'workshop_options',
  eventOptions: 'event_options',
  appSettings: 'app_settings',
  events: 'events',
  customers: 'customers',
  birthdayPackages: 'birthday_packages',
  studioResources: 'studio_resources'
};

const rowsOf = async (table: string): Promise<any[]> => {
  const supabase = getDataClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Read failed on ${table}:`, error.message);
    return [];
  }
  return rowsToModels(data);
};

/** A Dexie `where(...)` chain, evaluated against the fetched rows. */
class WhereClause {
  constructor(private table: string, private field: string) {}

  private async matching(predicate: (value: any) => boolean): Promise<any[]> {
    const rows = await rowsOf(this.table);
    return rows.filter(r => predicate((r as any)[this.field]));
  }

  equals(value: any) {
    return this.collection(v => v === value);
  }

  equalsIgnoreCase(value: any) {
    const wanted = String(value ?? '').toLowerCase();
    return this.collection(v => String(v ?? '').toLowerCase() === wanted);
  }

  private collection(predicate: (value: any) => boolean) {
    const matching = () => this.matching(predicate);
    return {
      toArray: matching,
      first: async () => (await matching())[0],
      count: async () => (await matching()).length,
      filter: (fn: (row: any) => boolean) => {
        const filtered = async () => (await matching()).filter(fn);
        return {
          toArray: filtered,
          first: async () => (await filtered())[0],
          count: async () => (await filtered()).length
        };
      },
      delete: async () => {
        const rows = await matching();
        for (const row of rows) await tableApi(this.table).delete(row.id);
        return rows.length;
      }
    };
  }
}

function tableApi(table: string) {
  return {
    async toArray() {
      return rowsOf(table);
    },

    async get(id: string) {
      const supabase = getDataClient();
      if (!supabase || !id) return undefined;
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error || !data) return undefined;
      return rowToModel(data);
    },

    async count() {
      const supabase = getDataClient();
      if (!supabase) return 0;
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      return error ? 0 : (count || 0);
    },

    async put(model: any) {
      const supabase = getDataClient();
      if (!supabase) return;
      const { error } = await supabase.from(table).upsert(toRow(table, model), { onConflict: 'id' });
      if (error) throw new Error(`Write failed on ${table}: ${error.message}`);
      return model?.id;
    },

    async add(model: any) {
      const supabase = getDataClient();
      if (!supabase) return;
      const row = toRow(table, model);
      // piece_history generates its own uuid primary key.
      if (table === 'piece_history') delete row.id;
      const { error } = await supabase.from(table).insert(row);
      if (error) throw new Error(`Insert failed on ${table}: ${error.message}`);
      return model?.id;
    },

    async update(id: string, updates: any) {
      const supabase = getDataClient();
      if (!supabase || !id) return 0;
      const row = toRow(table, updates);
      if (Object.keys(row).length === 0) return 0;
      const { error } = await supabase.from(table).update(row).eq('id', id);
      if (error) throw new Error(`Update failed on ${table}: ${error.message}`);
      return 1;
    },

    async delete(id: string) {
      const supabase = getDataClient();
      if (!supabase || !id) return;
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(`Delete failed on ${table}: ${error.message}`);
    },

    async bulkPut(models: any[]) {
      const supabase = getDataClient();
      if (!supabase || !models?.length) return;
      const { error } = await supabase
        .from(table)
        .upsert(models.map(m => toRow(table, m)), { onConflict: 'id' });
      if (error) throw new Error(`Bulk write failed on ${table}: ${error.message}`);
    },

    async bulkAdd(models: any[]) {
      return this.bulkPut(models);
    },

    async bulkDelete(ids: string[]) {
      const supabase = getDataClient();
      if (!supabase || !ids?.length) return;
      const { error } = await supabase.from(table).delete().in('id', ids);
      if (error) throw new Error(`Bulk delete failed on ${table}: ${error.message}`);
    },

    async clear() {
      const supabase = getDataClient();
      if (!supabase) return;
      // PostgREST requires a filter; every row has a non-null id.
      const { error } = await supabase.from(table).delete().not('id', 'is', null);
      if (error) throw new Error(`Clear failed on ${table}: ${error.message}`);
    },

    where(field: string) {
      return new WhereClause(table, field);
    },

    /** Dexie's client-side filter: fetch, then apply the predicate. */
    filter(predicate: (row: any) => boolean) {
      const matching = async () => (await rowsOf(table)).filter(predicate);
      return {
        toArray: matching,
        first: async () => (await matching())[0],
        count: async () => (await matching()).length,
        delete: async () => {
          const rows = await matching();
          for (const row of rows) await tableApi(table).delete(row.id);
          return rows.length;
        }
      };
    },

    orderBy(field: string) {
      const sorted = async () => {
        const rows = await rowsOf(table);
        return rows.sort((a, b) => {
          const av = (a as any)[field], bv = (b as any)[field];
          if (av === bv) return 0;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          return av < bv ? -1 : 1;
        });
      };
      return {
        toArray: sorted,
        first: async () => (await sorted())[0],
        reverse: () => ({ toArray: async () => (await sorted()).reverse() })
      };
    },

    toCollection() {
      return {
        toArray: () => rowsOf(table),
        modify: async (changes: any) => {
          const rows = await rowsOf(table);
          for (const row of rows) await tableApi(table).update(row.id, changes);
        }
      };
    }
  };
}

type TableApi = ReturnType<typeof tableApi>;

/**
 * The Supabase-backed stand-in for the Dexie `db` object.
 *
 * `transaction` runs the callback directly: it groups related writes for
 * readability but gives no atomicity. Operations that genuinely need it use an
 * RPC instead (see 0002_capacity_rpc.sql).
 */
export const sdb = {
  ...(Object.fromEntries(
    Object.entries(TABLE_FOR).map(([name, table]) => [name, tableApi(table)])
  ) as Record<keyof typeof TABLE_FOR, TableApi>),

  async transaction(_mode: string, ..._args: any[]) {
    const work = _args[_args.length - 1];
    return typeof work === 'function' ? work() : undefined;
  }
} as Record<string, TableApi> & { transaction: (mode: string, ...args: any[]) => Promise<any> };
