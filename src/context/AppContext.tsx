/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Workshop, Booking, QueueItem, PotteryPiece, TestResult, NotificationItem,
  PipelineStage, StaffMember, WorkshopOption, EventOption, AppSetting, AppEvent, Category,
  INITIAL_WORKSHOPS, INITIAL_BOOKINGS, INITIAL_QUEUE, INITIAL_PIECES, SYSTEM_TESTS, INITIAL_EVENTS,
  DraftBooking, DEFAULT_LOGGING_FIELDS, LoggingConsoleField
} from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { 
  getRiyadhNow, 
  parseBookingDateTimeToRiyadhDate, 
  getRiyadhDateString, 
  getRiyadhFormattedDate, 
  getRelativeRiyadhDateStr 
} from '../utils/dateUtils';
import { validateSaudiPhone, normaliseSaudiPhone, normalisePhone } from '../utils/phoneUtils';

export { 
  getRiyadhNow, 
  parseBookingDateTimeToRiyadhDate, 
  getRiyadhDateString, 
  getRiyadhFormattedDate, 
  getRelativeRiyadhDateStr 
};

interface AppContextType {
  // Navigation
  perspective: 'customer' | 'admin';
  setPerspective: (p: 'customer' | 'admin') => void;
  customerTab: 'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking';
  setCustomerTab: (tab: 'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking') => void;
  adminTab: 'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings';
  setAdminTab: (tab: 'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings') => void;
  
  // Pending Checkout State
  pendingBooking: DraftBooking | null;
  setPendingBooking: (booking: DraftBooking | null) => void;
  
  // Birthday Package State
  selectedBirthdayPackage: string;
  setSelectedBirthdayPackage: (pkg: string) => void;
  
  // Auth state
  currentUser: { id?: string; name: string; email: string; phone: string } | null;
  setCurrentUser: (user: { id?: string; name: string; email: string; phone: string } | null) => void;
  authScreen: 'login' | 'register' | 'forgot';
  setAuthScreen: (screen: 'login' | 'register' | 'forgot') => void;
  registerCustomer: (data: { name: string; email: string; phone: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  loginCustomer: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  resetCustomerPassword: (emailOrPhone: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logoutCustomer: () => void;

  // Active items for detail/editing
  selectedWorkshopId: string;
  setSelectedWorkshopId: (id: string) => void;
  lastBookingCreated: Booking | null;
  setLastBookingCreated: (b: Booking | null) => void;
  editingWorkshopId: string | null;
  setEditingWorkshopId: (id: string | null) => void;

  // Global Data States
  todayDateStr: string;
  formattedTodayDate: string;
  getRelativeRiyadhDateStr: (daysOffset: number, baseDate?: Date) => string;
  getRiyadhFormattedDate: (date?: Date) => string;
  workshops: Workshop[];
  bookings: Booking[];
  queue: QueueItem[];
  pieces: PotteryPiece[];
  systemTests: TestResult[];
  notifications: NotificationItem[];
  events: AppEvent[];
  
  // Settings & Lists
  pipelineStages: PipelineStage[];
  staff: StaffMember[];
  workshopOptions: WorkshopOption[];
  eventOptions: EventOption[];
  categories: Category[];
  appSettings: AppSetting[];
  loggingFields: LoggingConsoleField[];
  updateLoggingFields: (fields: LoggingConsoleField[]) => Promise<void>;
  
  // Mutators
  addWorkshop: (ws: Omit<Workshop, 'id' | 'slug'>) => void;
  updateWorkshop: (id: string, updates: Partial<Workshop>) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'timeline'>) => Booking;
  cancelBooking: (id: string, user?: string, paymentStatusUpdate?: 'Refunded' | 'Paid' | 'Unpaid') => void;
  updateBookingStatus: (id: string, status: Booking['status'], paymentStatus?: Booking['paymentStatus'], user?: string) => void;
  addQueueItem: (item: Omit<QueueItem, 'id' | 'checkInTime' | 'elapsedMinutes' | 'status'>) => void;
  updateQueueStatus: (id: string, status: QueueItem['status']) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => void;
  reorderQueue: (newQueue: QueueItem[]) => void;
  updatePieceStatus: (id: string, status: PotteryPiece['status'], performerUser?: string, reason?: string) => void;
  addPiece: (piece: Omit<PotteryPiece, 'id' | 'daysElapsed' | 'expectedCompletion' | 'notes'> & Partial<Pick<PotteryPiece, 'expectedCompletion' | 'notes'>>) => void;
  updatePiece: (id: string, updates: Partial<PotteryPiece>) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  clearAllNotifications: (type?: 'customer' | 'staff') => Promise<void>;
  runAllTests: () => void;
  toggleTestResult: (id: string) => void;
  isTestRunning: boolean;
  testProgress: number;
  testsPassing: boolean;

  // Events Mutators
  addEvent: (evt: Omit<AppEvent, 'id' | 'spotsLeft'>) => Promise<void>;
  updateEvent: (id: string, updates: Partial<AppEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Settings Mutators
  addPipelineStage: (stage: Omit<PipelineStage, 'id' | 'order'>) => Promise<void>;
  updatePipelineStage: (id: string, updates: Partial<PipelineStage>) => Promise<void>;
  deletePipelineStage: (id: string) => Promise<{ success: boolean; message?: string }>;
  reorderPipelineStages: (newStages: PipelineStage[]) => Promise<void>;

  addStaffMember: (member: Omit<StaffMember, 'id'>) => Promise<void>;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => Promise<void>;
  deleteStaffMember: (id: string) => Promise<{ success: boolean; message?: string; assignmentsCount?: number }>;

  addWorkshopOption: (option: Omit<WorkshopOption, 'id' | 'order'>) => Promise<void>;
  updateWorkshopOption: (id: string, value: string) => Promise<void>;
  deleteWorkshopOption: (id: string) => Promise<{ success: boolean; message?: string }>;
  reorderWorkshopOptions: (type: WorkshopOption['type'], newOptions: WorkshopOption[]) => Promise<void>;

  addEventOption: (option: Omit<EventOption, 'id' | 'order'>) => Promise<void>;
  updateEventOption: (id: string, value: string) => Promise<void>;
  deleteEventOption: (id: string) => Promise<{ success: boolean; message?: string }>;
  reorderEventOptions: (type: EventOption['type'], newOptions: EventOption[]) => Promise<void>;

  updateSetting: (id: string, value: any) => Promise<void>;
  removeAllData: () => Promise<void>;
  reseedSampleData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

let isSeedingDatabase = false;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State
  const [perspective, setPerspective] = useState<'customer' | 'admin'>('customer');
  const [customerTab, setCustomerTab] = useState<'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking'>('home');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings'>('dashboard');
  
  // Pending Checkout State
  const [pendingBooking, setPendingBooking] = useState<DraftBooking | null>(null);
  
  // Birthday Package Selection State
  const [selectedBirthdayPackage, setSelectedBirthdayPackage] = useState<string>('Option 1 — Canvas & Create');
  
  // Auth State (Initialized ONLY from localStorage session, defaults strictly to null)
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; email: string; phone: string } | null>(() => {
    try {
      const saved = localStorage.getItem('artycafe_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgot'>('login');

  const registerCustomer = async (data: { name: string; email: string; phone: string; password?: string }) => {
    const normEmail = data.email.trim().toLowerCase();

    if (!data.name.trim()) return { success: false, error: 'Full name is required.' };
    if (!normEmail || !normEmail.includes('@')) return { success: false, error: 'Valid email address is required.' };
    
    if (!validateSaudiPhone(data.phone)) {
      return { success: false, error: 'Enter a valid Saudi mobile number, such as 0501234567 or +966501234567.' };
    }
    const normPhone = normaliseSaudiPhone(data.phone);

    if (!data.password || data.password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const existingEmail = await db.customers.where('email').equalsIgnoreCase(normEmail).first();
    if (existingEmail) {
      return { success: false, error: 'An account with this email address already exists. Please sign in instead.' };
    }

    const existingPhone = await db.customers.where('phone').equals(normPhone).first();
    if (existingPhone) {
      return { success: false, error: 'An account with this phone number already exists. Please sign in instead.' };
    }

    const custId = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCustomer = {
      id: custId,
      name: data.name.trim(),
      email: normEmail,
      phone: normPhone,
      password: data.password,
      createdAt: new Date().toISOString()
    };

    await db.customers.put(newCustomer);

    const userObj = { id: custId, name: newCustomer.name, email: newCustomer.email, phone: newCustomer.phone };
    setCurrentUser(userObj);
    localStorage.setItem('artycafe_user', JSON.stringify(userObj));

    return { success: true };
  };

  const loginCustomer = async (emailOrPhone: string, password?: string) => {
    const input = emailOrPhone.trim();
    if (!input) return { success: false, error: 'Email or phone number is required.' };

    const normEmail = input.toLowerCase();
    let customer = await db.customers.where('email').equalsIgnoreCase(normEmail).first();

    if (!customer && validateSaudiPhone(input)) {
      const normPhone = normaliseSaudiPhone(input);
      customer = await db.customers.where('phone').equals(normPhone).first();
    }

    if (!customer) {
      return { success: false, error: 'No account found with these details. Please create an account.' };
    }

    if (password && customer.password && customer.password !== password) {
      return { success: false, error: 'Incorrect password. Please try again.' };
    }

    const userObj = { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone };
    setCurrentUser(userObj);
    localStorage.setItem('artycafe_user', JSON.stringify(userObj));

    return { success: true };
  };

  const resetCustomerPassword = async (emailOrPhone: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const input = emailOrPhone.trim();
    if (!input) return { success: false, error: 'Email or phone number is required.' };

    const normEmail = input.toLowerCase();
    let customer = await db.customers.where('email').equalsIgnoreCase(normEmail).first();

    if (!customer) {
      // Try by phone number
      const normPhone = normalisePhone('+966', input);
      customer = await db.customers.where('phone').equals(normPhone).first();
    }

    if (!customer) {
      // General filter match
      customer = await db.customers.filter(c => c.phone.includes(input) || c.email.toLowerCase() === normEmail).first();
    }

    if (!customer) {
      return { success: false, error: 'No registered customer account found with these details.' };
    }

    await db.customers.update(customer.id, { password: newPassword });
    return { success: true };
  };

  const logoutCustomer = () => {
    setCurrentUser(null);
    localStorage.removeItem('artycafe_user');
    setCustomerTab('home');
  };

  // Active element triggers
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('ws-1');
  const [lastBookingCreated, setLastBookingCreated] = useState<Booking | null>(null);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);
  const isSyncingQueueRef = React.useRef(false);

  // Shared Date State (Riyadh Local Time)
  const [todayDateStr, setTodayDateStr] = useState<string>(() => getRiyadhDateString());
  const [formattedTodayDate, setFormattedTodayDate] = useState<string>(() => getRiyadhFormattedDate());

  // Timer to keep shared date live past midnight
  useEffect(() => {
    const updateTodayDate = () => {
      const currentStr = getRiyadhDateString();
      const currentFormatted = getRiyadhFormattedDate();
      setTodayDateStr(prev => (prev !== currentStr ? currentStr : prev));
      setFormattedTodayDate(prev => (prev !== currentFormatted ? currentFormatted : prev));
    };

    updateTodayDate();
    const interval = setInterval(updateTodayDate, 10000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic lists from Dexie Live Query
  const workshops = useLiveQuery(() => db.workshops.toArray()) || INITIAL_WORKSHOPS;
  const bookings = useLiveQuery(() => db.bookings.toArray()) || INITIAL_BOOKINGS;
  const queue = useLiveQuery(() => db.queue.toArray()) || INITIAL_QUEUE;
  const pieces = useLiveQuery(() => db.pieces.toArray()) || INITIAL_PIECES;
  const systemTests = useLiveQuery(() => db.systemTests.toArray()) || SYSTEM_TESTS;
  const notifications = useLiveQuery(() => db.notifications.toArray()) || [];
  const events = useLiveQuery(() => db.events.toArray()) || INITIAL_EVENTS;

  const pipelineStages = useLiveQuery(() => db.pipelineStages.orderBy('order').toArray()) || [];
  const staff = useLiveQuery(() => db.staff.toArray()) || [];
  const workshopOptions = useLiveQuery(() => db.workshopOptions.orderBy('order').toArray()) || [];
  const eventOptions = useLiveQuery(() => db.eventOptions.orderBy('order').toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const appSettings = useLiveQuery(() => db.appSettings.toArray()) || [];

  // Seeding database if empty
  useEffect(() => {
    const seedDatabase = async () => {
      if (isSeedingDatabase) return;
      if (localStorage.getItem('artycafe_data_cleared') === 'true') return;
      
      // Execute explicit user request to wipe data for testing on initial load
      if (localStorage.getItem('artycafe_initial_wipe_v1') !== 'true') {
        localStorage.setItem('artycafe_initial_wipe_v1', 'true');
        localStorage.setItem('artycafe_data_cleared', 'true');
        await removeAllData();
        return;
      }

      isSeedingDatabase = true;
      try {
        await db.transaction('rw', [
          db.workshops,
          db.workshopSessions,
          db.categories,
          db.bookings,
          db.queue,
          db.pieces,
          db.systemTests,
          db.pipelineStages,
          db.staff,
          db.workshopOptions,
          db.eventOptions,
          db.appSettings,
          db.events,
          db.customers
        ], async () => {
          // Robust, defensively-isolated table seeds inside transaction
          try {
            const customersCount = await db.customers.count();
            if (customersCount === 0) {
              await db.customers.bulkPut([
                {
                  id: 'CUST-82941',
                  name: 'Noura Al-Amri',
                  email: 'nosamac9@gmail.com',
                  phone: '+966 50 123 4567',
                  password: 'password123',
                  createdAt: getRelativeRiyadhDateStr(-30)
                },
                {
                  id: 'CUST-10394',
                  name: 'Yasser Qahtani',
                  email: 'yasser@qahtani.sa',
                  phone: '+966 54 987 6543',
                  password: 'password123',
                  createdAt: getRelativeRiyadhDateStr(-20)
                }
              ]);
            }
          } catch (err) {
            console.error("Dexie seed customers error:", err);
          }

          try {
            const workshopsCount = await db.workshops.count();
            if (workshopsCount === 0) {
              await db.workshops.bulkPut(INITIAL_WORKSHOPS);
            }
          } catch (err) {
            console.error("Dexie seed workshops error:", err);
          }

          try {
            const sessionsCount = await db.workshopSessions.count();
            if (sessionsCount === 0) {
              const defaultSessions = [
                // ws-1: Wheel Throwing
                { id: 'sess-ws1-1', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(0), startTime: '11:00 AM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-2', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(0), startTime: '04:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-3', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(0), startTime: '07:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-4', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(1), startTime: '11:00 AM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-5', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(1), startTime: '04:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-6', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(1), startTime: '07:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-7', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(2), startTime: '11:00 AM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-8', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(2), startTime: '04:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws1-9', workshopId: 'ws-1', date: getRelativeRiyadhDateStr(2), startTime: '07:30 PM', capacity: 8, status: 'Published' as const, instructor: 'Ali bin Khalid' },

                // ws-2: Hand-Building
                { id: 'sess-ws2-1', workshopId: 'ws-2', date: getRelativeRiyadhDateStr(0), startTime: '01:00 PM', capacity: 12, status: 'Published' as const, instructor: 'Aisha Al-Jahdali' },
                { id: 'sess-ws2-2', workshopId: 'ws-2', date: getRelativeRiyadhDateStr(0), startTime: '05:00 PM', capacity: 12, status: 'Published' as const, instructor: 'Aisha Al-Jahdali' },
                { id: 'sess-ws2-3', workshopId: 'ws-2', date: getRelativeRiyadhDateStr(1), startTime: '01:00 PM', capacity: 12, status: 'Published' as const, instructor: 'Aisha Al-Jahdali' },
                { id: 'sess-ws2-4', workshopId: 'ws-2', date: getRelativeRiyadhDateStr(1), startTime: '05:00 PM', capacity: 12, status: 'Published' as const, instructor: 'Aisha Al-Jahdali' },
                { id: 'sess-ws2-5', workshopId: 'ws-2', date: getRelativeRiyadhDateStr(2), startTime: '01:00 PM', capacity: 12, status: 'Published' as const, instructor: 'Aisha Al-Jahdali' },

                // ws-3: Acrylic Landscape
                { id: 'sess-ws3-1', workshopId: 'ws-3', date: getRelativeRiyadhDateStr(0), startTime: '06:00 PM', capacity: 15, status: 'Published' as const, instructor: 'Faisal Al-Otaibi' },
                { id: 'sess-ws3-2', workshopId: 'ws-3', date: getRelativeRiyadhDateStr(1), startTime: '06:00 PM', capacity: 15, status: 'Published' as const, instructor: 'Faisal Al-Otaibi' },
                { id: 'sess-ws3-3', workshopId: 'ws-3', date: getRelativeRiyadhDateStr(2), startTime: '06:00 PM', capacity: 15, status: 'Published' as const, instructor: 'Faisal Al-Otaibi' },

                // ws-4: Kids Clay
                { id: 'sess-ws4-1', workshopId: 'ws-4', date: getRelativeRiyadhDateStr(0), startTime: '10:00 AM', capacity: 10, status: 'Published' as const, instructor: 'Sara Al-Malki' },
                { id: 'sess-ws4-2', workshopId: 'ws-4', date: getRelativeRiyadhDateStr(0), startTime: '02:00 PM', capacity: 10, status: 'Published' as const, instructor: 'Sara Al-Malki' },
                { id: 'sess-ws4-3', workshopId: 'ws-4', date: getRelativeRiyadhDateStr(1), startTime: '10:00 AM', capacity: 10, status: 'Published' as const, instructor: 'Sara Al-Malki' },

                // ws-5: Couples Pottery
                { id: 'sess-ws5-1', workshopId: 'ws-5', date: getRelativeRiyadhDateStr(0), startTime: '07:00 PM', capacity: 6, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws5-2', workshopId: 'ws-5', date: getRelativeRiyadhDateStr(0), startTime: '09:00 PM', capacity: 6, status: 'Published' as const, instructor: 'Ali bin Khalid' },
                { id: 'sess-ws5-3', workshopId: 'ws-5', date: getRelativeRiyadhDateStr(1), startTime: '07:00 PM', capacity: 6, status: 'Published' as const, instructor: 'Ali bin Khalid' }
              ];
              await db.workshopSessions.bulkPut(defaultSessions);
            }
          } catch (err) {
            console.error("Dexie seed workshopSessions error:", err);
          }

          try {
            const eventsCount = await db.events.count();
            if (eventsCount === 0) {
              await db.events.bulkPut(INITIAL_EVENTS);
            }
          } catch (err) {
            console.error("Dexie seed events error:", err);
          }

          try {
            const categoriesCount = await db.categories.count();
            if (categoriesCount === 0) {
              await db.categories.bulkPut([
                { id: 'cat-1', name: 'Pottery' },
                { id: 'cat-2', name: 'Painting' },
                { id: 'cat-3', name: 'Kids' },
                { id: 'cat-4', name: 'Couples' },
                { id: 'cat-5', name: 'Group' }
              ]);
            }
          } catch (err) {
            console.error("Dexie seed categories error:", err);
          }

          try {
            const todayRiyadh = getRiyadhDateString();
            const bookingsCount = await db.bookings.count();
            if (bookingsCount === 0) {
              await db.bookings.bulkPut(INITIAL_BOOKINGS);
            } else {
              const existingBookings = await db.bookings.toArray();
              const hasTodayBookings = existingBookings.some(b => b.date === todayRiyadh);
              if (!hasTodayBookings && existingBookings.length > 0) {
                // Migrate initial sample bookings to today
                for (const b of existingBookings) {
                  if (['ART-10394', 'ART-99201', 'ART-82941'].includes(b.id)) {
                    await db.bookings.update(b.id, { date: todayRiyadh });
                  }
                }
              }
            }
          } catch (err) {
            console.error("Dexie seed bookings error:", err);
          }

          try {
            const todayRiyadh = getRiyadhDateString();
            const queueCount = await db.queue.count();
            if (queueCount === 0) {
              const seededQueue = INITIAL_QUEUE.map(item => ({
                ...item,
                date: todayRiyadh
              }));
              await db.queue.bulkPut(seededQueue);
            }
          } catch (err) {
            console.error("Dexie seed queue error:", err);
          }

          try {
            const piecesCount = await db.pieces.count();
            if (piecesCount === 0) {
              await db.pieces.bulkPut(INITIAL_PIECES);
            }
          } catch (err) {
            console.error("Dexie seed pieces error:", err);
          }

          try {
            const testsCount = await db.systemTests.count();
            if (testsCount === 0) {
              await db.systemTests.bulkPut(SYSTEM_TESTS);
            }
          } catch (err) {
            console.error("Dexie seed systemTests error:", err);
          }

          try {
            const stagesCount = await db.pipelineStages.count();
            if (stagesCount === 0) {
              await db.pipelineStages.bulkPut([
                { id: 'stage-1', name: 'Created', color: '#E07A5F', order: 0, visibleToCustomer: true },
                { id: 'stage-2', name: 'Drying', color: '#D4C5B9', order: 1, visibleToCustomer: false },
                { id: 'stage-3', name: 'In Processing', color: '#3D405B', order: 2, visibleToCustomer: true },
                { id: 'stage-4', name: 'Glazing', color: '#81B29A', order: 3, visibleToCustomer: false },
                { id: 'stage-5', name: 'Firing', color: '#F2CC8F', order: 4, visibleToCustomer: false },
                { id: 'stage-6', name: 'Ready for Collection', color: '#335C67', order: 5, visibleToCustomer: true },
                { id: 'stage-7', name: 'Collected', color: '#111111', order: 6, visibleToCustomer: true }
              ]);
            }
          } catch (err) {
            console.error("Dexie seed pipelineStages error:", err);
          }

          try {
            const staffCount = await db.staff.count();
            if (staffCount === 0) {
              await db.staff.bulkPut([
                { id: 'staff-1', name: 'Ali bin Khalid', position: 'Master Wheelist / Instructor', phone: '+966 50 111 2222', email: 'ali@artycafe.com', status: 'Active', canAssignWorkshops: true, canAssignPieces: true },
                { id: 'staff-2', name: 'Aisha Al-Jahdali', position: 'Handcraft Specialist / Instructor', phone: '+966 54 333 4444', email: 'aisha@artycafe.com', status: 'Active', canAssignWorkshops: true, canAssignPieces: true },
                { id: 'staff-3', name: 'Faisal Al-Otaibi', position: 'Acrylic Specialist / Instructor', phone: '+966 56 555 6666', email: 'faisal@artycafe.com', status: 'Active', canAssignWorkshops: true, canAssignPieces: true },
                { id: 'staff-4', name: 'Lina Al-Sudais', position: 'Studio Manager', phone: '+966 55 777 8888', email: 'lina@artycafe.com', status: 'Active', canAssignWorkshops: true, canAssignPieces: true },
                { id: 'staff-5', name: 'Sara Al-Malki', position: 'Kids Coach / Instructor', phone: '+966 50 999 0000', email: 'sara@artycafe.com', status: 'Active', canAssignWorkshops: true, canAssignPieces: true }
              ]);
            }
          } catch (err) {
            console.error("Dexie seed staff error:", err);
          }

          try {
            const optionsCount = await db.workshopOptions.count();
            if (optionsCount === 0) {
              const defaultOptions: Omit<WorkshopOption, 'id'>[] = [
                { type: 'skillLevel', value: 'Beginner', order: 0 },
                { type: 'skillLevel', value: 'Intermediate', order: 1 },
                { type: 'skillLevel', value: 'Advanced', order: 2 },
                { type: 'skillLevel', value: 'All Levels', order: 3 },
                { type: 'category', value: 'Pottery', order: 0 },
                { type: 'category', value: 'Painting', order: 1 },
                { type: 'category', value: 'Kids', order: 2 },
                { type: 'category', value: 'Couples', order: 3 },
                { type: 'category', value: 'Group', order: 4 },
                { type: 'workshopType', value: 'Wheel Throwing', order: 0 },
                { type: 'workshopType', value: 'Handbuilding', order: 1 },
                { type: 'workshopType', value: 'Glazing', order: 2 },
                { type: 'workshopType', value: 'Painting', order: 3 },
                { type: 'workshopType', value: 'Special Event', order: 4 },
                { type: 'room', value: 'The Clay Station (Studio A)', order: 0 },
                { type: 'room', value: 'The Handcraft Lounge', order: 1 },
                { type: 'room', value: 'The Canvas Atelier (Studio B)', order: 2 },
                { type: 'room', value: 'Kiln Room 2', order: 3 },
                { type: 'material', value: 'Terracotta Clay', order: 0 },
                { type: 'material', value: 'Apron', order: 1 },
                { type: 'material', value: 'Trimming Tools', order: 2 },
                { type: 'material', value: 'Kiln Firing & Glazing', order: 3 },
                { type: 'material', value: 'Stoneware Clay', order: 4 },
                { type: 'material', value: 'Texture Stamps', order: 5 },
                { type: 'material', value: 'Engobes & Glazes', order: 6 },
                { type: 'material', value: 'Firing included', order: 7 },
                { type: 'material', value: '40x50cm Canvas', order: 8 },
                { type: 'material', value: 'Artist-grade Acrylics', order: 9 },
                { type: 'material', value: 'Brushes & Easel', order: 10 },
                { type: 'material', value: 'Café Drink', order: 11 }
              ];
              await db.workshopOptions.bulkPut(defaultOptions.map((opt, i) => ({ ...opt, id: `wopt-${i}` })));
            }
          } catch (err) {
            console.error("Dexie seed workshopOptions error:", err);
          }

          try {
            const eventOptionsCount = await db.eventOptions.count();
            if (eventOptionsCount === 0) {
              const defaultEventOptions: Omit<EventOption, 'id'>[] = [
                { type: 'eventCategory', value: 'Socials', order: 0 },
                { type: 'eventCategory', value: 'Masterclass', order: 1 },
                { type: 'eventCategory', value: 'Holiday Special', order: 2 },
                { type: 'eventCategory', value: 'Community Meetup', order: 3 },
                { type: 'eventType', value: 'Clay & Jazz', order: 0 },
                { type: 'eventType', value: 'Glazing Party', order: 1 },
                { type: 'eventType', value: 'Kids Playdate', order: 2 },
                { type: 'eventType', value: 'Beginner Painting', order: 3 },
                { type: 'location', value: 'Studio A', order: 0 },
                { type: 'location', value: 'Studio B', order: 1 },
                { type: 'location', value: 'The Terrace', order: 2 },
                { type: 'location', value: 'Main Lounge', order: 3 },
                { type: 'host', value: 'Arty Café Instructors', order: 0 },
                { type: 'host', value: 'Guest Artist Faisal', order: 1 },
                { type: 'host', value: 'Studio Manager Lina', order: 2 }
              ];
              await db.eventOptions.bulkPut(defaultEventOptions.map((opt, i) => ({ ...opt, id: `eopt-${i}` })));
            }
          } catch (err) {
            console.error("Dexie seed eventOptions error:", err);
          }

          try {
            const appSettingsCount = await db.appSettings.count();
            if (appSettingsCount === 0) {
              await db.appSettings.bulkPut([
                {
                  id: 'prePaymentInstructions',
                  value: {
                    enabled: true,
                    title: 'Important Studio Safety & Timeline Instructions',
                    body: `<p>Please note the following studio rules before proceeding to payment:</p><ul><li><strong>Clay Processing Time:</strong> All pottery created in the studio takes <strong>10 to 14 days</strong> to completely air dry, undergo bisque-firing, be hand-glazed, and fired a second time.</li><li><strong>Live Tracker:</strong> Once booked, your piece will appear in your "My Pieces" collection tracker where you can track its lifecycle stages.</li><li><strong>Safety Attire:</strong> We recommend wearing clothes you do not mind getting a little clay on (although aprons are provided!).</li><li><strong>Storage Window:</strong> Your finished pieces will be held at our collection shelves for up to <strong>30 days</strong> post-firing.</li></ul>`,
                    requiredCheckbox: true,
                    checkboxLabel: 'I confirm I have read these safety rules and understand the 10-14 day firing timeline.'
                  }
                },
                {
                  id: 'defaultEventSettings',
                  value: {
                    defaultCapacity: 15,
                    defaultDuration: '2.5 hours',
                    defaultPrice: 300
                  }
                }
              ]);
            }
          } catch (err) {
            console.error("Dexie seed appSettings error:", err);
          }
        });
      } catch (err) {
        console.error("Dexie seeding transaction error:", err);
      } finally {
        isSeedingDatabase = false;
      }
    };
    seedDatabase();
  }, []);

  // Migrate any existing "No Show" to "Cancelled" and "Confirmed" to "Pending"
  useEffect(() => {
    const runMigration = async () => {
      try {
        const allBookings = await db.bookings.toArray();
        for (const b of allBookings) {
          let updated = false;
          let updatedStatus = b.status;
          let updatedTimeline = b.timeline ? [...b.timeline] : [];
          
          if ((b.status as string) === 'No Show') {
            updatedStatus = 'Cancelled';
            updatedTimeline.push({
              time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              action: 'Migrated status from No Show to Cancelled'
            });
            updated = true;
          } else if ((b.status as string) === 'Confirmed') {
            updatedStatus = 'Pending';
            updatedTimeline.push({
              time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              action: 'Migrated status from Confirmed to Pending'
            });
            updated = true;
          }
          
          if (updated) {
            await db.bookings.update(b.id, {
              status: updatedStatus,
              timeline: updatedTimeline
            });
          }
        }
      } catch (err) {
        console.error("Error migrating statuses in DB:", err);
      }
    };
    runMigration();
  }, [bookings.length]);

  // Sanitize queue items: Ensure completed/cancelled items from previous days are assigned their actual completion date
  useEffect(() => {
    const sanitizeQueueDates = async () => {
      try {
        const todayRiyadh = getRiyadhDateString();
        const allQueue = await db.queue.toArray();
        for (const item of allQueue) {
          if (item.status === 'Completed' || item.status === 'Cancelled') {
            const completedHist = item.history?.find(h => h.status === 'Completed' || h.status === 'Cancelled');
            if (completedHist && completedHist.timestamp) {
              const compDate = completedHist.timestamp.split('T')[0];
              if (compDate && compDate < todayRiyadh && item.date === todayRiyadh) {
                await db.queue.update(item.id, { date: compDate });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error sanitizing queue dates:", err);
      }
    };
    sanitizeQueueDates();
  }, [todayDateStr]);

  // Auto-sync today's bookings into the Live Queue when their day comes
  useEffect(() => {
    const syncTodayBookingsToQueue = async () => {
      if (isSyncingQueueRef.current) return;
      isSyncingQueueRef.current = true;
      try {
        const todayRiyadh = getRiyadhDateString();
        const todayBookings = await db.bookings.where('date').equals(todayRiyadh).toArray();

        for (const b of todayBookings) {
          if (b.status === 'Cancelled') continue;

          // Fresh query on each iteration to prevent race conditions within loop
          const currentQueue = await db.queue.toArray();

          // Check if already in queue for today
          const exists = currentQueue.some(q => 
            q.date === todayRiyadh && 
            (q.bookingId === b.id || q.id === `Q-${b.id}` || (q.phone && q.phone === b.customerPhone) || (q.name && q.name === b.customerName))
          );

          if (!exists) {
            const qId = await generateNextQueueId();
            const qItem: QueueItem = {
              id: qId,
              bookingId: b.id,
              name: b.customerName,
              phone: b.customerPhone,
              activity: b.workshopTitle,
              participants: b.participants,
              checkInTime: b.time || '12:00 PM',
              elapsedMinutes: 0,
              staffAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
              staffName: 'Lina',
              status: b.status === 'Checked In' ? 'In Progress' : (b.status === 'Completed' ? 'Completed' : 'Waiting'),
              source: b.source || 'Website',
              type: 'With Instructor',
              workshopType: 'Other',
              date: todayRiyadh,
              history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
            };

            try {
              await db.queue.put(qItem);
            } catch (putErr) {
              console.warn("Queue put failed, retrying with fresh ID:", putErr);
              const retryId = await generateNextQueueId();
              await db.queue.put({ ...qItem, id: retryId });
            }
          }
        }
      } catch (err) {
        console.error("Error syncing today's bookings to queue:", err);
      } finally {
        isSyncingQueueRef.current = false;
      }
    };

    syncTodayBookingsToQueue();
  }, [todayDateStr, bookings.length]);

  const generateNextQueueId = async (): Promise<string> => {
    // Query ALL queue items across the entire table to prevent primary key collisions
    const allQueueItems = await db.queue.toArray();
    
    let nextNum = 1;
    if (allQueueItems.length > 0) {
      const numbers = allQueueItems.map(qi => {
        const match = qi.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      });
      nextNum = Math.max(...numbers, 0) + 1;
    }
    
    let id = `Q-${String(nextNum).padStart(3, '0')}`;
    let exists = await db.queue.get(id);
    while (exists) {
      nextNum++;
      id = `Q-${String(nextNum).padStart(3, '0')}`;
      exists = await db.queue.get(id);
    }
    return id;
  };

  // Test Running State
  const [isTestRunning, setIsTestRunning] = useState<boolean>(false);
  const [testProgress, setTestProgress] = useState<number>(0);
  const [testsPassing, setTestsPassing] = useState<boolean>(true);

  // Auto increment elapsed queue times (for visual realism)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const items = await db.queue.toArray();
        for (const item of items) {
          if (item.status === 'Waiting' || item.status === 'In Progress') {
            await db.queue.update(item.id, { elapsedMinutes: item.elapsedMinutes + 1 });
          }
        }
      } catch (err) {
        console.error("Failed to auto-increment elapsedMinutes:", err);
      }
    }, 60000); // every minute
    return () => clearInterval(timer);
  }, []);

  // Periodic check for Pending bookings that are past their 15-minute grace period
  useEffect(() => {
    const checkPendingCancellations = async () => {
      try {
        const nowRiyadh = getRiyadhNow();
        const activeBookings = await db.bookings.toArray();
        for (const b of activeBookings) {
          if (b.status === 'Pending') {
            const scheduledTime = parseBookingDateTimeToRiyadhDate(b.date, b.time);
            const elapsedMs = nowRiyadh.getTime() - scheduledTime.getTime();
            
            // If check-in time has passed and we have exceeded 15 minutes (900,000 ms)
            if (elapsedMs >= 15 * 60 * 1000) {
              const nowStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
              const nowIso = new Date().toISOString();
              
              await db.transaction('rw', db.bookings, db.queue, db.workshops, async () => {
                await db.bookings.update(b.id, {
                  status: 'Cancelled',
                  notes: b.notes ? `${b.notes}\n[Did not show up — auto-cancelled]` : 'Did not show up — auto-cancelled',
                  timeline: [
                    ...(b.timeline || []),
                    { time: nowStr, action: 'Did not show up — auto-cancelled (System Action)' }
                  ]
                });

                // Find linked queue entry by bookingId or fallback ID/phone matching
                let queueEntry = await db.queue.where('bookingId').equals(b.id).first();
                if (!queueEntry) {
                  const allQueue = await db.queue.toArray();
                  queueEntry = allQueue.find(q => 
                    q.bookingId === b.id || 
                    q.id === `Q-${b.id}` || 
                    (q.phone && q.phone === b.customerPhone && q.date === b.date && q.name === b.customerName)
                  );
                }

                if (queueEntry && queueEntry.status !== 'Completed' && queueEntry.status !== 'In Progress' && queueEntry.status !== 'Called') {
                  await db.queue.update(queueEntry.id, {
                    status: 'Cancelled',
                    history: [...(queueEntry.history || []), { status: 'Cancelled', timestamp: nowIso }]
                  });
                }

                // Refund spots left back to workshop
                if (b.workshopId && b.workshopId !== 'birthday-party-event') {
                  const ws = await db.workshops.get(b.workshopId);
                  if (ws) {
                    await db.workshops.update(b.workshopId, {
                      spotsLeft: Math.min(ws.capacity, ws.spotsLeft + b.participants)
                    });
                  }
                }
              });
            }
          }
        }
      } catch (err) {
        console.error("Error in checkPendingCancellations background check:", err);
      }
    };

    const interval = setInterval(checkPendingCancellations, 5000);
    // Run once initially with a small timeout to let DB settle
    const initialTimeout = setTimeout(checkPendingCancellations, 500);
    
    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [bookings]); // re-run or keep active

  // Mutators
  const addWorkshop = async (ws: Omit<Workshop, 'id' | 'slug'>) => {
    const id = `ws-${Date.now()}`;
    const slug = ws.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newWs: Workshop = { ...ws, id, slug };
    await db.workshops.add(newWs);

    if (ws.sessions && Array.isArray(ws.sessions)) {
      const sessionRecords = ws.sessions.map((s: any, idx: number) => ({
        id: s.id ? String(s.id) : `sess-${id}-${idx}`,
        workshopId: id,
        date: s.date,
        startTime: s.time || s.startTime,
        endTime: s.endTime,
        capacity: Number(s.capacity) || Number(ws.capacity) || 10,
        status: s.status || 'Published',
        instructor: s.instructor || ws.instructor || '',
        staffId: s.staffId || ws.staffId
      }));
      await db.workshopSessions.bulkPut(sessionRecords);
    }
  };

  const updateWorkshop = async (id: string, updates: Partial<Workshop>) => {
    await db.workshops.update(id, updates);

    if (updates.sessions && Array.isArray(updates.sessions)) {
      const existing = await db.workshopSessions.where('workshopId').equals(id).toArray();
      const newSessionIds = new Set<string>();

      const sessionRecords = updates.sessions.map((s: any, idx: number) => {
        const sessId = s.id ? String(s.id) : `sess-${id}-${idx}`;
        newSessionIds.add(sessId);
        return {
          id: sessId,
          workshopId: id,
          date: s.date,
          startTime: s.time || s.startTime,
          endTime: s.endTime,
          capacity: Number(s.capacity) || Number(updates.capacity) || 10,
          status: s.status || 'Published',
          instructor: s.instructor || updates.instructor || '',
          staffId: s.staffId || updates.staffId
        };
      });

      await db.workshopSessions.bulkPut(sessionRecords);

      for (const ex of existing) {
        if (!newSessionIds.has(ex.id)) {
          const activeBookingsCount = await db.bookings
            .where('workshopId').equals(id)
            .filter(b => b.date === ex.date && b.time === ex.startTime && b.status !== 'Cancelled')
            .count();
          if (activeBookingsCount === 0) {
            await db.workshopSessions.delete(ex.id);
          } else {
            await db.workshopSessions.update(ex.id, { status: 'Cancelled' });
          }
        }
      }
    } else if (updates.instructor !== undefined || updates.staffId !== undefined) {
      const existing = await db.workshopSessions.where('workshopId').equals(id).toArray();
      for (const ex of existing) {
        const sessUpdates: any = {};
        if (updates.instructor !== undefined) sessUpdates.instructor = updates.instructor;
        if (updates.staffId !== undefined) sessUpdates.staffId = updates.staffId;
        await db.workshopSessions.update(ex.id, sessUpdates);
      }
    }
  };

  const addEvent = async (evt: Omit<AppEvent, 'id' | 'spotsLeft'>) => {
    const id = `evt-${Date.now()}`;
    const newEvt: AppEvent = {
      ...evt,
      id,
      spotsLeft: evt.capacity
    };
    await db.events.add(newEvt);
  };

  const updateEvent = async (id: string, updates: Partial<AppEvent>) => {
    await db.events.update(id, updates);
  };

  const deleteEvent = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const bookingsCount = await db.bookings.where('workshopId').equals(id).count();
    if (bookingsCount > 0) {
      return { success: false, message: 'Cannot delete event with existing bookings. Please cancel or archive it instead.' };
    }
    await db.events.delete(id);
    return { success: true };
  };

  // 15-Minute Unpaid Pending Booking Auto-Cancellation Effect
  useEffect(() => {
    const checkPendingExpiries = async () => {
      try {
        const allBookings = await db.bookings.toArray();
        const nowMs = Date.now();
        
        for (const b of allBookings) {
          if (b.status === 'Pending' && b.paymentStatus === 'Unpaid') {
            const createdMs = new Date(b.createdAt).getTime();
            if (!isNaN(createdMs)) {
              const diffMinutes = (nowMs - createdMs) / (1000 * 60);
              if (diffMinutes >= 15) {
                const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const nowIso = new Date().toISOString();

                await db.transaction('rw', db.bookings, db.queue, db.workshops, async () => {
                  await db.bookings.update(b.id, {
                    status: 'Cancelled',
                    timeline: [...(b.timeline || []), { time: timeStr, action: 'Cancelled automatically due to 15-minute payment timeout' }]
                  });

                  // Find linked queue entry by bookingId or fallback matching
                  let queueEntry = await db.queue.where('bookingId').equals(b.id).first();
                  if (!queueEntry) {
                    const allQueue = await db.queue.toArray();
                    queueEntry = allQueue.find(q => 
                      q.bookingId === b.id || 
                      q.id === `Q-${b.id}` || 
                      (q.phone && q.phone === b.customerPhone && q.date === b.date && q.name === b.customerName)
                    );
                  }

                  if (queueEntry && queueEntry.status !== 'Completed' && queueEntry.status !== 'In Progress' && queueEntry.status !== 'Called') {
                    await db.queue.update(queueEntry.id, {
                      status: 'Cancelled',
                      history: [...(queueEntry.history || []), { status: 'Cancelled', timestamp: nowIso }]
                    });
                  }

                  // Release spots back
                  if (b.workshopId && b.workshopId !== 'birthday-party-event') {
                    const ws = await db.workshops.get(b.workshopId);
                    if (ws) {
                      await db.workshops.update(b.workshopId, {
                        spotsLeft: Math.min(ws.capacity, ws.spotsLeft + b.participants)
                      });
                    }
                  }
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error checking pending expiries:", err);
      }
    };

    checkPendingExpiries();
    const interval = setInterval(checkPendingExpiries, 15000);
    return () => clearInterval(interval);
  }, []);

  const addBooking = (newBookingData: Omit<Booking, 'id' | 'createdAt' | 'timeline'>): Booking => {
    const refCode = `ART-${Math.floor(10000 + Math.random() * 90000)}`;
    const nowStr = new Date().toISOString();
    
    let pStatus: Booking['paymentStatus'] = newBookingData.paymentStatus || 'Paid';
    if (newBookingData.workshopId === 'birthday-party-event' || newBookingData.workshopTitle.toLowerCase().includes('birthday') || newBookingData.workshopTitle.toLowerCase().includes('package')) {
      if (pStatus === 'Paid') {
        pStatus = 'Deposit Paid';
      }
    }

    const newBooking: Booking = {
      ...newBookingData,
      paymentStatus: pStatus,
      status: (newBookingData.status as string === 'Confirmed' || !newBookingData.status) ? 'Pending' : newBookingData.status,
      id: refCode,
      createdAt: nowStr,
      timeline: [
        { time: nowStr.substring(11, 16), action: `Booking created via ${newBookingData.source}` },
        { time: nowStr.substring(11, 16), action: pStatus === 'Paid' || pStatus === 'Deposit Paid' ? 'Payment processed successfully' : 'Booking awaiting payment' }
      ]
    };

    // Save to DB asynchronously
    db.bookings.put(newBooking).then(async () => {
      // Update Spots Left in matching workshop
      if (newBookingData.workshopId && newBookingData.workshopId !== 'birthday-party-event') {
        const ws = await db.workshops.get(newBookingData.workshopId);
        if (ws) {
          await db.workshops.update(newBookingData.workshopId, {
            spotsLeft: Math.max(0, ws.spotsLeft - newBookingData.participants)
          });
        }
      }

      // Upsert/Link Customer Account
      if (newBookingData.customerEmail || newBookingData.customerPhone) {
        const normEmail = (newBookingData.customerEmail || '').trim().toLowerCase();
        if (normEmail) {
          const existing = await db.customers.where('email').equalsIgnoreCase(normEmail).first();
          if (!existing) {
            await db.customers.put({
              id: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
              name: newBookingData.customerName,
              email: normEmail,
              phone: newBookingData.customerPhone,
              password: 'password123',
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }).catch(err => {
      console.error("Failed to add booking:", err);
    });

    // If walk-in or admin, automatically add to today's live queue
    if (newBookingData.source === 'Walk-in' || newBookingData.source === 'Admin') {
      generateNextQueueId().then(qId => {
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const newQItem: QueueItem = {
          id: qId,
          bookingId: newBooking.id,
          name: newBookingData.customerName,
          phone: newBookingData.customerPhone,
          activity: newBookingData.workshopTitle,
          participants: newBookingData.participants,
          checkInTime: timeStr,
          elapsedMinutes: 0,
          staffAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
          staffName: 'Lina',
          status: 'Waiting',
          source: newBookingData.source,
          type: 'With Instructor',
          workshopType: 'Other',
          date: getRiyadhDateString(),
          history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
        };
        db.queue.put(newQItem).catch(err => {
          console.error("Failed to add queue item in addBooking:", err);
        });
      }).catch(err => {
        console.error("Failed to generate queue ID in addBooking:", err);
      });
    }

    // Automatically generate a piece in 'Created' state if it is a Pottery workshop!
    const targetWs = workshops.find(w => w.id === newBookingData.workshopId);
    if (targetWs && targetWs.category === 'Pottery') {
      const pieceId = `PC-${Math.floor(300 + Math.random() * 700)}`;
      const newPiece: PotteryPiece = {
        id: pieceId,
        name: `${targetWs.title.split(' ')[0]} Masterpiece`,
        workshopName: targetWs.title,
        customerName: newBookingData.customerName,
        customerPhone: newBookingData.customerPhone,
        dateCreated: new Date().toISOString().split('T')[0],
        image: targetWs.image,
        status: 'Created',
        daysElapsed: 0,
        assignedStaff: targetWs.instructor
      };
      db.pieces.add(newPiece).catch(err => {
        console.error("Failed to add piece in addBooking:", err);
      });
    }

    return newBooking;
  };

  const cancelBooking = async (id: string, user: string = 'Staff', paymentStatusUpdate?: 'Refunded' | 'Paid' | 'Unpaid' | 'Deposit Paid') => {
    const booking = await db.bookings.get(id);
    if (booking && booking.status !== 'Cancelled') {
      const now = getRiyadhNow();
      let startObj: Date;
      try {
        const timeClean = booking.time.split(' - ')[0].trim();
        startObj = parseBookingDateTimeToRiyadhDate(booking.date, timeClean);
      } catch (e) {
        startObj = new Date(`${booking.date}T16:00:00`);
      }

      const diffMs = startObj.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let finalPaymentStatus: Booking['paymentStatus'] = paymentStatusUpdate || booking.paymentStatus;
      let actionMsg = `Booking cancelled by ${user}`;

      if (paymentStatusUpdate) {
        actionMsg += ` (${paymentStatusUpdate})`;
      } else {
        if (diffHours > 24) {
          finalPaymentStatus = 'Refunded';
          actionMsg += ' — Refund issued (>24h notice)';
        } else {
          actionMsg += ' — Non-refundable (within 24h cutoff)';
        }
      }

      const nowStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const nowIso = new Date().toISOString();

      await db.transaction('rw', db.bookings, db.queue, db.workshops, async () => {
        await db.bookings.update(id, {
          status: 'Cancelled',
          paymentStatus: finalPaymentStatus,
          timeline: [...booking.timeline, { time: nowStr, action: actionMsg }]
        });

        // Find linked queue entry by bookingId or fallback matching
        let queueEntry = await db.queue.where('bookingId').equals(id).first();
        if (!queueEntry) {
          const allQueue = await db.queue.toArray();
          queueEntry = allQueue.find(q => 
            q.bookingId === id || 
            q.id === `Q-${id}` || 
            (q.phone && q.phone === booking.customerPhone && q.date === booking.date && q.name === booking.customerName)
          );
        }

        if (queueEntry && queueEntry.status !== 'Completed' && queueEntry.status !== 'In Progress' && queueEntry.status !== 'Called') {
          await db.queue.update(queueEntry.id, {
            status: 'Cancelled',
            history: [...(queueEntry.history || []), { status: 'Cancelled', timestamp: nowIso }]
          });
        }

        // Refund spots left back to workshop
        if (booking.workshopId && booking.workshopId !== 'birthday-party-event') {
          const ws = await db.workshops.get(booking.workshopId);
          if (ws) {
            await db.workshops.update(booking.workshopId, {
              spotsLeft: Math.min(ws.capacity, ws.spotsLeft + booking.participants)
            });
          }
        }
      });
    }
  };

  const updateBookingStatus = async (id: string, status: Booking['status'], paymentStatus?: Booking['paymentStatus'], user: string = 'Staff') => {
    const booking = await db.bookings.get(id);
    if (booking) {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const newTimeline = [...booking.timeline, { time: nowStr, action: `Status updated to ${status} by ${user}` }];
      if (paymentStatus && paymentStatus !== booking.paymentStatus) {
        newTimeline.push({ time: nowStr, action: `Payment updated to ${paymentStatus} by ${user}` });
      }

      await db.bookings.update(id, {
        status,
        paymentStatus: paymentStatus || booking.paymentStatus,
        timeline: newTimeline
      });

      // If booking status becomes 'Checked In', sync it to the live queue list
      if (status === 'Checked In') {
        const queueItems = await db.queue.toArray();
        const alreadyInQueue = queueItems.some(q => q.name === booking.customerName && q.status !== 'Completed');
        if (!alreadyInQueue) {
          const qId = await generateNextQueueId();
          const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          const qItem: QueueItem = {
            id: qId,
            bookingId: booking.id,
            name: booking.customerName,
            phone: booking.customerPhone,
            activity: booking.workshopTitle,
            participants: booking.participants,
            checkInTime: timeStr,
            elapsedMinutes: 0,
            staffAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
            staffName: 'Sami',
            status: 'Waiting',
            source: booking.source,
            type: 'With Instructor',
            workshopType: 'Other',
            date: getRiyadhDateString(),
            history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
          };
          await db.queue.put(qItem);
        }
      }
    }
  };

  const addQueueItem = async (item: Omit<QueueItem, 'id' | 'checkInTime' | 'elapsedMinutes' | 'status' | 'date' | 'history'>) => {
    const todayRiyadh = getRiyadhDateString();
    const id = await generateNextQueueId();
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    const newItem: QueueItem = {
      ...item,
      id,
      checkInTime: timeStr,
      elapsedMinutes: 0,
      status: 'Waiting',
      date: todayRiyadh,
      history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
    };
    await db.queue.put(newItem);
  };

  const updateQueueStatus = async (id: string, status: QueueItem['status']) => {
    const item = await db.queue.get(id);
    if (item) {
      const todayRiyadh = getRiyadhDateString();
      const updates: Partial<QueueItem> = {
        status,
        date: todayRiyadh,
        history: [...(item.history || []), { status, timestamp: new Date().toISOString() }]
      };
      if (status === 'In Progress') {
        updates.seatedTime = new Date().toISOString();
      }
      await db.queue.update(id, updates);

      // Sync status to matching booking in db.bookings
      try {
        const allBookings = await db.bookings.toArray();
        const matchingBooking = allBookings.find(b => 
          (b.id === id || b.id === id.replace('Q-', '') || (b.customerPhone === item.phone && b.date === todayRiyadh))
        );
        if (matchingBooking) {
          let bStatus: Booking['status'] = matchingBooking.status;
          if (status === 'In Progress') bStatus = 'Checked In';
          else if (status === 'Completed') bStatus = 'Completed';
          else if (status === 'Cancelled') bStatus = 'Cancelled';
          
          await db.bookings.update(matchingBooking.id, { 
            status: bStatus,
            timeline: [...(matchingBooking.timeline || []), {
              time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
              action: `Status updated to ${bStatus} via Live Queue`
            }]
          });
        }
      } catch (err) {
        console.error("Error syncing queue status to booking:", err);
      }
    }
  };

  const updateQueueItem = async (id: string, updates: Partial<QueueItem>) => {
    await db.queue.update(id, updates);
  };

  const reorderQueue = async (newQueue: QueueItem[]) => {
    await db.queue.clear();
    await db.queue.bulkAdd(newQueue);
  };

  const updatePieceStatus = async (id: string, status: PotteryPiece['status'], performerUser: string = 'Staff', reason?: string) => {
    const piece = await db.pieces.get(id);
    if (piece) {
      const historyEntry = {
        status,
        timestamp: new Date().toISOString(),
        user: performerUser,
        reason: reason || undefined
      };
      const newHistory = [...(piece.history || []), historyEntry];
      await db.pieces.update(id, { status, history: newHistory });

      // Generate CUSTOMER notification
      let friendlyMsg = `Your piece "${piece.name}" has been updated to "${status}".`;
      if (status === 'Ready for Collection') {
        friendlyMsg = `🎁 Your beautiful pottery piece "${piece.name}" is ready for collection! Please come pick it up at the café shelf.`;
      } else if (status === 'Collected') {
        friendlyMsg = `Thank you for picking up your piece "${piece.name}"! We hope you loved crafting it at Arty Café.`;
      } else if (status === 'Firing') {
        friendlyMsg = `Your piece "${piece.name}" is now being fired in our high-temperature kiln.`;
      } else if (status === 'Glazing') {
        friendlyMsg = `Your piece "${piece.name}" is currently at the glazing station.`;
      } else if (status === 'In Processing') {
        friendlyMsg = `Your piece "${piece.name}" is now in processing.`;
      } else if (status === 'Drying') {
        friendlyMsg = `Your piece "${piece.name}" is now resting on the drying racks.`;
      }

      await db.notifications.add({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'customer',
        customerPhone: piece.customerPhone,
        title: status === 'Ready for Collection' ? '🎁 Piece Ready for Pickup!' : `Piece Status Update: ${status}`,
        message: friendlyMsg,
        pieceId: piece.id,
        pieceName: piece.name,
        newStatus: status,
        timestamp: new Date().toISOString(),
        isRead: false,
        highlighted: status === 'Ready for Collection'
      });

      // Generate STAFF notification
      await db.notifications.add({
        id: `NOTIF-STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'staff',
        title: status === 'Ready for Collection' ? '🚨 Piece Ready for Pickup Alert' : 'Piece Status Shifted',
        message: `Piece ${piece.id} (${piece.customerName}) moved to "${status}" by ${performerUser}.${reason ? ` Reason: ${reason}` : ''}`,
        pieceId: piece.id,
        pieceName: piece.name,
        newStatus: status,
        performedBy: performerUser,
        timestamp: new Date().toISOString(),
        isRead: false,
        highlighted: status === 'Ready for Collection'
      });
    }
  };

  const addPiece = async (piece: Omit<PotteryPiece, 'id' | 'daysElapsed' | 'expectedCompletion' | 'notes'> & Partial<Pick<PotteryPiece, 'expectedCompletion' | 'notes'>>) => {
    const id = `PC-${Math.floor(300 + Math.random() * 700)}`;
    const newPiece: PotteryPiece = {
      name: 'Ceramic Piece',
      workshopName: 'Freestyle Handbuilding',
      customerName: 'Walk-in Customer',
      customerPhone: '+966500000000',
      image: '',
      status: 'Created',
      dateCreated: new Date().toISOString().split('T')[0],
      assignedStaff: 'Lina',
      ...piece,
      id,
      daysElapsed: 0,
      history: [{
        status: piece.status || 'Created',
        timestamp: new Date().toISOString(),
        user: 'Staff',
        reason: 'Piece manually logged or initialized'
      }]
    };
    await db.pieces.add(newPiece);
  };

  const updatePiece = async (id: string, updates: Partial<PotteryPiece>) => {
    await db.pieces.update(id, updates);
  };

  const markNotificationAsRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
  };

  const clearAllNotifications = async (type?: 'customer' | 'staff') => {
    if (type) {
      const items = await db.notifications.where('type').equals(type).toArray();
      const keys = items.map(item => item.id);
      await db.notifications.bulkDelete(keys);
    } else {
      await db.notifications.clear();
    }
  };

  const runAllTests = () => {
    setIsTestRunning(true);
    setTestProgress(0);
    
    // Simulate test suite running with loading progress bar
    const interval = setInterval(() => {
      setTestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTestRunning(false);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const toggleTestResult = async (id: string) => {
    const test = await db.systemTests.get(id);
    if (test) {
      const newStatus = test.status === 'passed' ? 'failed' : 'passed';
      const updates: Partial<TestResult> = { status: newStatus };
      if (newStatus === 'failed') {
        updates.expected = 'Status: HTTP 200 OK';
        updates.actual = 'Status: HTTP 500 Internal Server Error';
        updates.failureMessage = 'Uncaught DBTimeoutException: Could not reserve seating in Clay Studio A under high transactional load.';
      } else {
        updates.expected = undefined;
        updates.actual = undefined;
        updates.failureMessage = undefined;
      }
      await db.systemTests.update(id, updates);
    }
  };

  // Pipeline Stages Mutators
  const addPipelineStage = async (stage: Omit<PipelineStage, 'id' | 'order'>) => {
    const all = await db.pipelineStages.toArray();
    const order = all.length > 0 ? Math.max(...all.map(s => s.order)) + 1 : 0;
    const id = `stage-${Date.now()}`;
    await db.pipelineStages.add({ ...stage, id, order });
  };

  const updatePipelineStage = async (id: string, updates: Partial<PipelineStage>) => {
    await db.pipelineStages.update(id, updates);
  };

  const deletePipelineStage = async (id: string) => {
    const stage = await db.pipelineStages.get(id);
    if (!stage) return { success: false, message: 'Stage not found' };
    
    // check if any piece currently sits in it
    const piecesInStage = await db.pieces.where('status').equals(stage.name).count();
    if (piecesInStage > 0) {
      return { 
        success: false, 
        message: `Cannot delete stage "${stage.name}" because there are currently ${piecesInStage} pottery piece(s) in this stage. Please reassign those pieces first.` 
      };
    }
    
    await db.pipelineStages.delete(id);
    return { success: true };
  };

  const reorderPipelineStages = async (newStages: PipelineStage[]) => {
    for (let i = 0; i < newStages.length; i++) {
      await db.pipelineStages.update(newStages[i].id, { order: i });
    }
  };

  // Staff Mutators
  const addStaffMember = async (member: Omit<StaffMember, 'id'>) => {
    const id = `staff-${Date.now()}`;
    await db.staff.add({ ...member, id });
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>) => {
    await db.staff.update(id, updates);
  };

  const deleteStaffMember = async (id: string) => {
    const member = await db.staff.get(id);
    if (!member) return { success: false, message: 'Staff member not found' };

    // check assignments in workshops (tutor/instructor is string match on name)
    const workshopsAssigned = await db.workshops.filter(w => w.instructor === member.name).toArray();
    // check assignments in pieces (assignedStaff string match)
    const piecesAssigned = await db.pieces.filter(p => p.assignedStaff === member.name).toArray();

    const totalWorkshops = workshopsAssigned.length;
    const totalPieces = piecesAssigned.length;

    if (totalWorkshops > 0 || totalPieces > 0) {
      return {
        success: false,
        message: `Cannot delete staff member "${member.name}" because they are currently assigned to ${totalWorkshops} workshop(s) and ${totalPieces} pottery piece(s). Please reassign their work first.`,
        assignmentsCount: totalWorkshops + totalPieces
      };
    }

    await db.staff.delete(id);
    return { success: true };
  };

  // Workshop Option Mutators
  const addWorkshopOption = async (option: Omit<WorkshopOption, 'id' | 'order'>) => {
    const all = await db.workshopOptions.where('type').equals(option.type).toArray();
    const order = all.length > 0 ? Math.max(...all.map(o => o.order)) + 1 : 0;
    const id = `wopt-${Date.now()}`;
    await db.workshopOptions.add({ ...option, id, order });
  };

  const updateWorkshopOption = async (id: string, value: string) => {
    await db.workshopOptions.update(id, { value });
  };

  const deleteWorkshopOption = async (id: string) => {
    const opt = await db.workshopOptions.get(id);
    if (!opt) return { success: false, message: 'Option not found' };

    // Check if in use
    let inUse = false;
    if (opt.type === 'skillLevel') {
      const count = await db.workshops.filter(w => w.skillLevel === opt.value).count();
      if (count > 0) inUse = true;
    } else if (opt.type === 'category') {
      const count = await db.workshops.filter(w => w.category === opt.value).count();
      if (count > 0) inUse = true;
    } else if (opt.type === 'room') {
      const count = await db.workshops.filter(w => w.room === opt.value).count();
      if (count > 0) inUse = true;
    } else if (opt.type === 'material') {
      const count = await db.workshops.filter(w => w.materials.includes(opt.value)).count();
      if (count > 0) inUse = true;
    }

    if (inUse) {
      return {
        success: false,
        message: `Cannot remove "${opt.value}" because it is currently in use by one or more workshops. Please edit those workshops to remove or change this option first.`
      };
    }

    await db.workshopOptions.delete(id);
    return { success: true };
  };

  const reorderWorkshopOptions = async (type: WorkshopOption['type'], newOptions: WorkshopOption[]) => {
    for (let i = 0; i < newOptions.length; i++) {
      await db.workshopOptions.update(newOptions[i].id, { order: i });
    }
  };

  // Event Option Mutators
  const addEventOption = async (option: Omit<EventOption, 'id' | 'order'>) => {
    const all = await db.eventOptions.where('type').equals(option.type).toArray();
    const order = all.length > 0 ? Math.max(...all.map(o => o.order)) + 1 : 0;
    const id = `eopt-${Date.now()}`;
    await db.eventOptions.add({ ...option, id, order });
  };

  const updateEventOption = async (id: string, value: string) => {
    await db.eventOptions.update(id, { value });
  };

  const deleteEventOption = async (id: string) => {
    const opt = await db.eventOptions.get(id);
    if (!opt) return { success: false, message: 'Option not found' };

    await db.eventOptions.delete(id);
    return { success: true };
  };

  const reorderEventOptions = async (type: EventOption['type'], newOptions: EventOption[]) => {
    for (let i = 0; i < newOptions.length; i++) {
      await db.eventOptions.update(newOptions[i].id, { order: i });
    }
  };

  const updateSetting = async (id: string, value: any) => {
    await db.appSettings.put({ id, value });
  };

  const removeAllData = async () => {
    localStorage.setItem('artycafe_data_cleared', 'true');
    localStorage.removeItem('artycafe_current_user');
    localStorage.removeItem('artycafe_pending_booking');

    await Promise.all([
      db.workshops.clear(),
      db.workshopSessions.clear(),
      db.bookings.clear(),
      db.queue.clear(),
      db.pieces.clear(),
      db.systemTests.clear(),
      db.categories.clear(),
      db.notifications.clear(),
      db.pipelineStages.clear(),
      db.staff.clear(),
      db.workshopOptions.clear(),
      db.eventOptions.clear(),
      db.appSettings.clear(),
      db.events.clear(),
      db.customers.clear()
    ]);
    setCurrentUser(null);
  };

  const reseedSampleData = async () => {
    localStorage.removeItem('artycafe_data_cleared');
    localStorage.removeItem('artycafe_initial_wipe_v1');
    isSeedingDatabase = false;
    window.location.reload();
  };


  const loggingFieldsSetting = appSettings.find(s => s.id === 'potteryLoggingConsoleFields')?.value;
  const loggingFields: LoggingConsoleField[] = React.useMemo(() => {
    if (Array.isArray(loggingFieldsSetting) && loggingFieldsSetting.length > 0) {
      return [...loggingFieldsSetting].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return DEFAULT_LOGGING_FIELDS;
  }, [loggingFieldsSetting]);

  const updateLoggingFields = async (fields: LoggingConsoleField[]) => {
    const sorted = [...fields].map((f, idx) => ({ ...f, order: idx + 1, updatedAt: new Date().toISOString() }));
    await updateSetting('potteryLoggingConsoleFields', sorted);
  };

  // Determine if overall health check is passing
  useEffect(() => {
    const hasFailures = systemTests.some(t => t.status === 'failed');
    setTestsPassing(!hasFailures);
  }, [systemTests]);

  return (
    <AppContext.Provider value={{
      perspective, setPerspective,
      customerTab, setCustomerTab,
      adminTab, setAdminTab,
      pendingBooking, setPendingBooking,
      selectedBirthdayPackage, setSelectedBirthdayPackage,
      currentUser, setCurrentUser,
      authScreen, setAuthScreen,
      registerCustomer, loginCustomer, resetCustomerPassword, logoutCustomer,
      selectedWorkshopId, setSelectedWorkshopId,
      lastBookingCreated, setLastBookingCreated,
      editingWorkshopId, setEditingWorkshopId,
      todayDateStr, formattedTodayDate,
      getRelativeRiyadhDateStr, getRiyadhFormattedDate,
      workshops, bookings, queue, pieces, systemTests, notifications, events,
      pipelineStages, staff, workshopOptions, eventOptions, categories, appSettings,
      loggingFields, updateLoggingFields,
      addWorkshop, updateWorkshop,
      addBooking, cancelBooking, updateBookingStatus,
      addQueueItem, updateQueueStatus, updateQueueItem, reorderQueue,
      updatePieceStatus, addPiece, updatePiece, markNotificationAsRead, clearAllNotifications,
      runAllTests, toggleTestResult,
      isTestRunning, testProgress, testsPassing,
      addEvent, updateEvent, deleteEvent,
      addPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages,
      addStaffMember, updateStaffMember, deleteStaffMember,
      addWorkshopOption, updateWorkshopOption, deleteWorkshopOption, reorderWorkshopOptions,
      addEventOption, updateEventOption, deleteEventOption, reorderEventOptions,
      updateSetting, removeAllData, reseedSampleData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
