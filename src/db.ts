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

