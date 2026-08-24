/**
 * DEAD CODE — not wired into the running app. Audit finding C-5 traced
 * this fully: nothing in src/ imports ArtyCafeDatabase or ARTY_STORES_V9
 * outside this file, and `new ArtyCafeDatabase()` (below) is the only
 * instantiation, so this IndexedDB store is never actually created in the
 * browser. It was superseded by src/lib/supabaseDb.ts (`sdb`) in the
 * Stage 2 migration to direct Supabase reads — there is no local cache of
 * customer/staff data today.
 *
 * DO NOT wire this into logout (or anything else) without first
 * re-verifying what any `db`-like object in that scope actually resolves
 * to. Elsewhere in this codebase, `db` is an alias for `sdb`
 * (`import { sdb as db } from './lib/supabaseDb'`), and `sdb`'s `.clear()`
 * is not a local-cache clear — it issues a live, authenticated
 * `DELETE FROM <table> WHERE id IS NOT NULL` against production Supabase.
 * Calling it from logoutCustomer()/logoutStaff() under that name would
 * silently wipe the real customers/pieces/staff tables on every sign-out,
 * not clear a cache — this was caught before any such code was written.
 */

import Dexie, { type Table } from 'dexie';
import {
  Workshop, Booking, QueueItem, PotteryPiece, TestResult, Category, NotificationItem,
  PipelineStage, StaffMember, WorkshopOption, EventOption, AppSetting, AppEvent, CustomerAccount,
  WorkshopSessionRecord, BirthdayPackage, StudioResource
} from './types';

/**
 * The current (version 9) store definitions.
 *
 * Named so a temporary database — used by the System Health suite, which must
 * never write into the real tables — is created from exactly the same schema.
 */
export const ARTY_STORES_V9 = {
  workshops: 'id, category, title, status',
  workshopSessions: 'id, workshopId, date, status',
  bookings: 'id, date, status, workshopId',
  queue: 'id, date, status, type, bookingId',
  pieces: 'id, status',
  systemTests: 'id',
  categories: 'id, name',
  notifications: 'id, type, customerPhone',
  pipelineStages: 'id, order',
  staff: 'id, status',
  workshopOptions: 'id, type, value, order',
  eventOptions: 'id, type, value, order',
  appSettings: 'id',
  events: 'id, category, title, date, status',
  customers: 'id, email, phone',
  birthdayPackages: 'id, status, displayOrder',
  studioResources: 'id, type, status, order'
};

export class ArtyCafeDatabase extends Dexie {
  workshops!: Table<Workshop>;
  workshopSessions!: Table<WorkshopSessionRecord>;
  bookings!: Table<Booking>;
  queue!: Table<QueueItem>;
  pieces!: Table<PotteryPiece>;
  systemTests!: Table<TestResult>;
  categories!: Table<Category>;
  notifications!: Table<NotificationItem>;
  pipelineStages!: Table<PipelineStage>;
  staff!: Table<StaffMember>;
  workshopOptions!: Table<WorkshopOption>;
  eventOptions!: Table<EventOption>;
  appSettings!: Table<AppSetting>;
  events!: Table<AppEvent>;
  customers!: Table<CustomerAccount>;
  birthdayPackages!: Table<BirthdayPackage>;
  studioResources!: Table<StudioResource>;

  /** `name` lets a throwaway database be created alongside the real one. */
  constructor(name: string = 'ArtyCafeDatabase') {
    super(name);
    this.version(3).stores({
      workshops: 'id, category, title',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id'
    });

    this.version(4).stores({
      workshops: 'id, category, title',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id',
      events: 'id, category, title, date, status'
    });

    this.version(5).stores({
      workshops: 'id, category, title',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id',
      events: 'id, category, title, date, status',
      customers: 'id, email, phone'
    });

    this.version(6).stores({
      workshops: 'id, category, title, status',
      workshopSessions: 'id, workshopId, date, status',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id',
      events: 'id, category, title, date, status',
      customers: 'id, email, phone'
    });

    this.version(7).stores({
      workshops: 'id, category, title, status',
      workshopSessions: 'id, workshopId, date, status',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type, bookingId',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id',
      events: 'id, category, title, date, status',
      customers: 'id, email, phone'
    });

    this.version(8).stores({
      workshops: 'id, category, title, status',
      workshopSessions: 'id, workshopId, date, status',
      bookings: 'id, date, status, workshopId',
      queue: 'id, date, status, type, bookingId',
      pieces: 'id, status',
      systemTests: 'id',
      categories: 'id, name',
      notifications: 'id, type, customerPhone',
      pipelineStages: 'id, order',
      staff: 'id, status',
      workshopOptions: 'id, type, value, order',
      eventOptions: 'id, type, value, order',
      appSettings: 'id',
      events: 'id, category, title, date, status',
      customers: 'id, email, phone',
      birthdayPackages: 'id, status, displayOrder'
    });

    this.version(9).stores(ARTY_STORES_V9);
  }
}

export const db = new ArtyCafeDatabase();

