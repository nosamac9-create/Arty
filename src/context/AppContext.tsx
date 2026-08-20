/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Workshop, Booking, QueueItem, PotteryPiece, TestResult, NotificationItem,
  PipelineStage, StaffMember, WorkshopOption, EventOption, AppSetting, AppEvent, Category,
  WorkshopSessionRecord, StaffScheduleDayEntry, BirthdayPackage, BirthdayFormField,
  DEFAULT_BIRTHDAY_PACKAGES, DEFAULT_BIRTHDAY_FORM_FIELDS, normalizeBirthdayPackage,
  StudioResource, DEFAULT_STUDIO_RESOURCES, CustomerAccount, StaffRole,
  DEFAULT_PIPELINE_STAGES, isStageEnabled, stageCustomerLabel, migrateLegacyPieceStatus,
  DEFAULT_WORKSHOP_OPTIONS, isWorkshopOptionEnabled,
  WorkshopFieldConfig, DEFAULT_WORKSHOP_FIELDS,
  DraftBooking, DEFAULT_LOGGING_FIELDS, LoggingConsoleField
} from '../types';
import { useLiveTable, fetchTable, fetchRow } from '../lib/supabaseData';
import { getDataClient } from '../lib/supabase';
import { toRow, rowToModel } from '../lib/mappers';
// Stage 2: the data layer is Supabase. `db` is the Dexie-shaped façade over it
// (lib/supabaseDb), so each mutator keeps its exact logic and invariants while
// the storage underneath changed. Seat allocation does NOT go through it — see
// addBooking, which uses the atomic book_session_seats RPC.
import { sdb as db } from '../lib/supabaseDb';
import { normalizeDateString, timeToMinutes } from '../utils/timeUtils';
import { hasWebsiteAccount, buildAccountLink } from '../utils/accountUtils';
import {
  supabase, supabaseStaff, isSupabaseConfigured, SUPABASE_NOT_CONFIGURED, setStaffSessionActive
} from '../lib/supabase';
import {
  normalizeCustomerPhone, toDisplayPhone, findCustomerMatch, buildCustomerIdentity,
  mergeCustomerDetails, findDuplicateGroups, customerPhoneKey
} from '../utils/customerIdentity';
import {
  validateRequired, validatePhoneRule, validateEmailRule, validatePasswordRule,
  canonicalPhone, canonicalEmail, phoneMatchKey, customerStorageFields, staffStorageFields
} from '../utils/validation';
import {
  canAccessPage, hasConsoleAccount, sanitizePermissions,
  SettingsSectionId, resolveSettingsSection
} from '../utils/adminAccess';
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
  /**
   * Which area of the app is showing. The customer site is the default and is
   * open to everyone; the staff console is a separate area reached only by an
   * explicit staff sign-in. There is no free toggle between the two.
   */
  area: 'customer' | 'staff';
  /** Opens the staff sign-in screen. Grants nothing on its own. */
  goToStaffLogin: () => void;
  /** Leaves the staff area for the customer site, keeping the session. */
  viewCustomerSite: () => void;
  /** Returns a signed-in staff member to the console. */
  returnToStaffConsole: () => void;
  customerTab: 'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking' | 'reset-password';
  setCustomerTab: (tab: 'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking' | 'reset-password') => void;
  adminTab: 'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings';
  setAdminTab: (tab: 'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings') => void;
  
  // Pending Checkout State
  pendingBooking: DraftBooking | null;
  setPendingBooking: (booking: DraftBooking | null) => void;
  
  // Birthday Package State
  selectedBirthdayPackage: string;
  setSelectedBirthdayPackage: (pkg: string) => void;
  /** Category chip the Workshops page should open on, e.g. set to 'Birthday Packages'
   *  before navigating there from the home page. Callers that navigate to the
   *  Workshops page for a general browse should reset this to 'All' first. */
  workshopsInitialCategory: string;
  setWorkshopsInitialCategory: (category: string) => void;

  // Auth state
  currentUser: { id?: string; name: string; email: string; phone: string } | null;
  setCurrentUser: (user: { id?: string; name: string; email: string; phone: string } | null) => void;
  authScreen: 'login' | 'register' | 'forgot';
  setAuthScreen: (screen: 'login' | 'register' | 'forgot') => void;
  registerCustomer: (data: { name: string; email: string; phone: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  /**
   * Signs a customer in with EITHER their phone number or their email address.
   * `needsPasswordSetup` means the identifier matched an unclaimed record and
   * the claim flow should be offered instead of a password error.
   */
  loginCustomer: (emailOrPhone: string, password?: string) =>
    Promise<{
      success: boolean;
      error?: string;
      needsPasswordSetup?: boolean;
      /** The masked address the claim confirmation will be sent to, if known. */
      claimEmailHint?: string;
      /** True when the record has no email, so the claim needs phone OTP. */
      awaitingPhoneVerification?: boolean;
    }>;
  /**
   * Attaches a password to an existing passwordless record and signs them in.
   * `email` is required when the identifier is a phone number: the auth account
   * is created against an address, and the record's own address is never
   * disclosed to the browser.
   */
  claimCustomerAccount: (emailOrPhone: string, password: string, email?: string) =>
    Promise<{
      success: boolean;
      error?: string;
      customerId?: string;
      needsEmailConfirmation?: boolean;
    }>;
  /** Sends a reset link. The reply never reveals whether the email exists. */
  requestPasswordReset: (email: string) =>
    Promise<{ success: boolean; error?: string; message?: string }>;
  /** True once the emailed link's recovery session has been established. */
  hasRecoverySession: () => Promise<boolean>;
  /** Supabase's own explanation when it rejected a reset link. */
  recoveryLinkError: string | null;
  /** Sets the new password using the recovery session from the emailed link. */
  completePasswordReset: (newPassword: string) =>
    Promise<{ success: boolean; error?: string; expired?: boolean }>;
  resetCustomerPassword: (emailOrPhone: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * Changes the signed-in customer's own password. Requires their live session
   * — there is no identifier argument, so it can only ever act on the caller.
   */
  changeCustomerPassword: (newPassword: string) =>
    Promise<{ success: boolean; error?: string; needsSignIn?: boolean }>;
  logoutCustomer: () => void;

  // Active items for detail/editing
  selectedWorkshopId: string;
  setSelectedWorkshopId: (id: string) => void;
  lastBookingCreated: Booking | null;
  setLastBookingCreated: (b: Booking | null) => void;
  editingWorkshopId: string | null;
  /** Which Settings subsection is open. Driven by the sidebar submenu. */
  settingsSection: SettingsSectionId;
  setSettingsSection: (section: SettingsSectionId) => void;

  /** Booking the Events & Socials page should open, set by the Dashboard. */
  selectedEventBookingId: string | null;
  setSelectedEventBookingId: (id: string | null) => void;
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
  /** Canonical workshop session table — the single source of truth for staff assignments. */
  workshopSessions: WorkshopSessionRecord[];
  /** Stored customer accounts. The account-type filter reads these. */
  customers: CustomerAccount[];

  // ---- Admin Console session ----
  /** The signed-in staff member, or null. Never defaults to a staff record. */
  currentStaff: StaffMember | null;
  staffAuthChecked: boolean;
  loginStaff: (emailOrPhone: string, password: string) =>
    Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  /** Replaces the signed-in staff member's password (Supabase Auth). */
  changeStaffPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logoutStaff: () => void;
  /** Page-level authorization for the signed-in staff member. */
  canAccessAdminPage: (pageId: string) => boolean;

  /**
   * Finds the shared customer for these details, or creates one. The primary
   * match is the normalized phone, so a returning customer is never duplicated.
   */
  resolveCustomer: (input: {
    name?: string;
    phone?: string;
    email?: string;
  }) => Promise<{ customer: CustomerAccount; created: boolean; matchedOn: string }>;

  /** Studio rooms and table stations — one shared record used everywhere. */
  studioResources: StudioResource[];
  addStudioResource: (resource: Omit<StudioResource, 'id'>) => Promise<void>;
  updateStudioResource: (id: string, updates: Partial<StudioResource>) => Promise<void>;
  /** Resources tied to history are deactivated, never hard-deleted. */
  removeStudioResource: (id: string) => Promise<{ success: boolean; message?: string; deactivated?: boolean }>;

  /** Shared birthday packages — edited in the Staff Console, rendered on the customer site. */
  birthdayPackages: BirthdayPackage[];
  publishedBirthdayPackages: BirthdayPackage[];
  addBirthdayPackage: (pkg: Omit<BirthdayPackage, 'id'>) => Promise<void>;
  updateBirthdayPackage: (id: string, updates: Partial<BirthdayPackage>) => Promise<void>;
  deleteBirthdayPackage: (id: string) => Promise<void>;
  reorderBirthdayPackages: (ordered: BirthdayPackage[]) => Promise<void>;
  /** Field structure of the two Workshop cards, configured in Settings. */
  workshopFields: WorkshopFieldConfig[];
  updateWorkshopFields: (fields: WorkshopFieldConfig[]) => Promise<void>;

  /** Customer birthday booking-form fields, configured in Settings → Events/Birthday. */
  birthdayFormFields: BirthdayFormField[];
  updateBirthdayFormFields: (fields: BirthdayFormField[]) => Promise<void>;

  // Settings & Lists
  pipelineStages: PipelineStage[];
  staff: StaffMember[];
  workshopOptions: WorkshopOption[];
  eventOptions: EventOption[];
  categories: Category[];
  /** Raw workshop/event queries: `undefined` until the first read resolves. */
  rawWorkshops: Workshop[] | undefined;
  rawEvents: AppEvent[] | undefined;
  appSettings: AppSetting[];
  loggingFields: LoggingConsoleField[];
  updateLoggingFields: (fields: LoggingConsoleField[]) => Promise<void>;
  
  // Mutators
  addWorkshop: (ws: Omit<Workshop, 'id' | 'slug'>) => void;
  updateWorkshop: (id: string, updates: Partial<Workshop>) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'timeline'>) => Booking;
  /** Set when the last booking write failed, so the UI never claims success. */
  bookingError: string | null;
  clearBookingError: () => void;
  cancelBooking: (id: string, user?: string, paymentStatusUpdate?: 'Refunded' | 'Paid' | 'Unpaid') => void;
  updateBookingStatus: (id: string, status: Booking['status'], paymentStatus?: Booking['paymentStatus'], user?: string) => void;
  /** A fresh read of the records an assignment conflict check needs. */
  getFreshAssignmentSources: () => Promise<{
    staff: StaffMember[];
    workshopSessions: WorkshopSessionRecord[];
    workshops: Workshop[];
    events: AppEvent[];
    queue: QueueItem[];
    studioResources: StudioResource[];
    appSettings: AppSetting[];
  }>;
  /** Staff read straight from the database, bypassing the cached list. */
  getFreshStaff: () => Promise<StaffMember[]>;
  /** Assigns or clears the staff member hosting a birthday/event booking. */
  assignBookingStaff: (bookingId: string, staffId: string | null) =>
    Promise<{ success: boolean; error?: string }>;
  /** Adds a category unless one with that name already exists. */
  addCategoryIfMissing: (name: string) => Promise<{ created: boolean; id?: string }>;
  /** Updates a single workshop session record. */
  updateWorkshopSession: (id: string, updates: Partial<WorkshopSessionRecord>) => Promise<void>;
  /** Appends one entry to a booking's timeline. */
  appendBookingTimeline: (bookingId: string, action: string) => Promise<void>;
  /** Raises a staff notification through the shared notifications table. */
  addStaffNotification: (
    title: string,
    message: string,
    meta?: { newStatus?: string; performedBy?: string; highlighted?: boolean }
  ) => Promise<void>;
  addQueueItem: (item: Omit<QueueItem, 'id' | 'checkInTime' | 'elapsedMinutes' | 'status' | 'date' | 'history'>) => Promise<void>;
  updateQueueStatus: (id: string, status: QueueItem['status']) => void;
  updateQueueItem: (id: string, updates: Partial<QueueItem>) => Promise<void>;
  returnQueueItemToWaiting: (
    id: string,
    opts: { hours: number; participants: number }
  ) => Promise<{ success: boolean; message?: string; newId?: string }>;
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
  deletePipelineStage: (id: string) => Promise<{ success: boolean; message?: string; deactivated?: boolean }>;
  reorderPipelineStages: (newStages: PipelineStage[]) => Promise<void>;

  /** Creates a guest customer record. Never linked to a website account. */
  addCustomer: (
    customer: Omit<CustomerAccount, 'id' | 'createdAt'>
  ) => Promise<{ success: boolean; error?: string; customerId?: string }>;
  updateCustomer: (id: string, updates: Partial<CustomerAccount>) =>
    Promise<{ success: boolean; error?: string }>;
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


// The previous hardcoded bootstrap credentials were removed in Stage 1b: they
// were committed to a public repository and are permanently compromised.
// Supabase Auth owns credentials; see README, "First Super Admin".

interface BookingSessionLink {
  sessionId?: string;
  staffId?: string;
  staffName: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  capacity?: number;
}

/**
 * Resolves a booking's real workshop session and its assigned staff member:
 * booking.sessionId → workshop session → staffId → current staff record.
 * Returns an unassigned link rather than guessing when nothing matches — there is
 * deliberately no default instructor.
 */
const resolveBookingSessionLink = async (booking: Booking): Promise<BookingSessionLink> => {
  const unassigned: BookingSessionLink = { staffName: 'Unassigned' };
  try {
    let session = booking.sessionId ? await db.workshopSessions.get(String(booking.sessionId)) : undefined;

    if (!session && booking.workshopId && booking.date) {
      // Legacy bookings saved before sessionId existed.
      const candidates = await db.workshopSessions.where('workshopId').equals(booking.workshopId).toArray();
      const bookingDate = normalizeDateString(booking.date);
      const bookingStart = booking.time ? timeToMinutes(booking.time.split(' - ')[0].trim()) : null;
      session = candidates.find(s =>
        normalizeDateString(s.date) === bookingDate &&
        (bookingStart === null || timeToMinutes(s.startTime) === bookingStart)
      );
    }

    if (!session) return unassigned;

    const member = session.staffId ? await db.staff.get(session.staffId) : undefined;

    return {
      sessionId: String(session.id),
      staffId: member?.id,
      staffName: member?.name || 'Unassigned',
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      capacity: session.capacity
    };
  } catch (err) {
    console.error('Failed to resolve booking session link:', err);
    return unassigned;
  }
};


// ================= AUTH HELPERS (Stage 1b) =================

/** Turns a Supabase Auth error into something a customer can act on. */
function friendlyAuthError(message: string): string {
  const m = String(message || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'An account with this email address already exists. Please sign in instead.';
  }
  if (m.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email address first — check your inbox for the link.';
  }
  return message || 'Sign-in failed. Please try again.';
}

/**
 * Attaches an auth user to the ONE shared customer record for that identifier.
 *
 * ⚠️ OWNERSHIP VERIFICATION
 * This links an account to a record found by phone or email. It must only run
 * once Supabase Auth has proven the caller controls that identifier. Today that
 * proof is the email confirmation link. A phone-only claim MUST NOT attach on
 * knowledge of the number alone.
 * TODO(stage-2): when phone sign-in is enabled, gate this behind
 * supabase.auth.verifyOtp() for the phone channel before calling the RPC.
 *
 * Stage 2: the RPC is the only writer. There is no local customer write.
 */
async function linkAuthToCustomer(identifier: string | undefined, authId: string): Promise<string | null> {
  const input = String(identifier || '').trim();
  if (!input || !authId || !supabase) return null;

  // The RPC is the real path: a customer session cannot read a row whose
  // user_id is null, so the lookup has to happen with elevated rights. It
  // matches on the same normalized phone/email rule as the app, is idempotent,
  // and returns null identically for "no record" and "claimed by someone else"
  // so it cannot be used to discover which numbers are on file.
  const { data, error } = await supabase.rpc('link_existing_customer', {
    identifier: input,
    new_auth_id: authId
  });

  if (error) {
    console.error('link_existing_customer failed:', error.message);
    return null;
  }
  return (typeof data === 'string' && data) ? data : null;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Navigation State
  // Everyone starts on the customer site.
  const [area, setArea] = useState<'customer' | 'staff'>('customer');
  /** What Supabase said about a reset link, when it refused one. */
  const [recoveryLinkError, setRecoveryLinkError] = useState<string | null>(null);

  /**
   * A password-reset link opens the recovery screen.
   *
   * Supabase puts `type=recovery` in the URL fragment and raises
   * PASSWORD_RECOVERY once it has exchanged it for a short-lived session.
   * Either signal routes there.
   */
  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';

    // Supabase reports a dead link as an error in the fragment. Capture it so
    // the screen can say what went wrong rather than guessing.
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const linkError = params.get('error_description') || params.get('error');
    if (linkError) setRecoveryLinkError(linkError.replace(/\+/g, ' '));

    if (
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      search.includes('type=recovery') ||
      linkError
    ) {
      setArea('customer');
      setCustomerTab('reset-password');
    }

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') {
        setArea('customer');
        setCustomerTab('reset-password');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const [customerTab, setCustomerTab] = useState<'home' | 'workshops' | 'detail' | 'checkout-info' | 'checkout-payment' | 'confirmation' | 'my-bookings' | 'my-pieces' | 'auth' | 'birthday-booking' | 'reset-password'>('home');
  const [adminTab, setAdminTab] = useState<'dashboard' | 'queue' | 'customers' | 'staff' | 'bookings' | 'workshops-admin' | 'events-admin' | 'pieces-admin' | 'system-health' | 'settings'>('dashboard');
  
  // Pending Checkout State
  const [pendingBooking, setPendingBooking] = useState<DraftBooking | null>(null);
  /**
   * Set when a booking write fails. The booking used to fail silently in the
   * background while the confirmation screen still said "confirmed" — the
   * customer left believing they had a seat.
   */
  const [bookingError, setBookingError] = useState<string | null>(null);
  
  // Birthday Package Selection State
  // Holds the id of the package the customer picked; resolved from the shared record.
  const [selectedBirthdayPackage, setSelectedBirthdayPackage] = useState<string>('');
  const [workshopsInitialCategory, setWorkshopsInitialCategory] = useState<string>('All');

  // Auth State (Initialized ONLY from localStorage session, defaults strictly to null)
  // Derived from the Supabase session on load, never trusted from storage.
  const [currentUser, setCurrentUser] = useState<{ id?: string; name: string; email: string; phone: string } | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgot'>('login');

  const registerCustomer = async (data: { name: string; email: string; phone: string; password?: string }) => {
    // The same shared rules the forms use, enforced again here so no caller can
    // write an invalid record by skipping a form.
    const nameCheck = validateRequired(data.name, 'Full name');
    if (!nameCheck.valid) return { success: false, error: nameCheck.error };

    const emailCheck = validateEmailRule(data.email);
    if (!emailCheck.valid) return { success: false, error: emailCheck.error };

    const phoneCheck = validatePhoneRule(data.phone);
    if (!phoneCheck.valid) return { success: false, error: phoneCheck.error };

    const passwordCheck = validatePasswordRule(data.password);
    if (!passwordCheck.valid) return { success: false, error: passwordCheck.error };

    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const normEmail = canonicalEmail(data.email);
    const normPhone = canonicalPhone(data.phone);
    const phoneKey = phoneMatchKey(data.phone);

    // Matched on the normalized key, so a record stored in any older format is
    // still recognised as the same person.
    const allCustomers = await db.customers.toArray();
    const existingEmail = allCustomers.find(c => canonicalEmail(c.email) === normEmail);
    const existingPhone = allCustomers.find(c => customerPhoneKey(c) === phoneKey);
    const existing = existingEmail || existingPhone;

    // A record that is already linked to an account must sign in instead.
    if (existing && hasWebsiteAccount(existing)) {
      return {
        success: false,
        error: existingEmail
          ? 'An account with this email address already exists. Please sign in instead.'
          : 'An account with this phone number already exists. Please sign in instead.'
      };
    }

    // Supabase Auth creates and hashes the credential. No password is ever
    // written to a customer record.
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: normEmail,
      password: data.password!
    });

    if (signUpError) {
      return { success: false, error: friendlyAuthError(signUpError.message) };
    }

    const authId = signUp.user?.id;
    if (!authId) {
      return { success: false, error: 'Could not create the account. Please try again.' };
    }

    // Attach the auth user to the shared customer record.
    // One call does the whole thing in Postgres: reuse the existing record for
    // this phone/email if there is one — so a walk-in keeps their history —
    // otherwise create it, and attach the new auth user either way.
    //
    // This must not be a client-side insert: right after sign-up there may be
    // no session yet (email confirmation), so the caller is still anonymous and
    // RLS would refuse the write. That is exactly what left an auth user with
    // no customer record.
    const { data: resolvedId, error: linkError } = await supabase.rpc('resolve_customer_record', {
      p_name: data.name.trim(),
      p_phone: normPhone,
      p_email: normEmail,
      p_auth_id: authId,
      p_source: 'Website Registration'
    });

    if (linkError || !resolvedId) {
      return {
        success: false,
        error: linkError?.message || 'Account created, but the customer record could not be saved.'
      };
    }

    const custId: string = resolvedId;

    // Email confirmation is on: there is no session until they confirm.
    if (!signUp.session) {
      return {
        success: false,
        needsEmailConfirmation: true,
        error: 'Almost there — check your email and confirm your address to finish creating your account.'
      };
    }

    setCurrentUser({ id: custId, name: data.name.trim(), email: normEmail, phone: normPhone });
    return { success: true };
  };

  /**
   * Asks Postgres which sign-in route an identifier needs.
   *
   * This cannot be answered in the browser: an anonymous visitor cannot read
   * `customers` at all (the RLS policies are `to authenticated` and scoped to
   * their own row), so a local lookup finds nothing before sign-in and every
   * walk-in would be told their password was wrong.
   *
   * The function folds "no record" and "already claimed" into the same
   * `password` answer, so this cannot be used to discover which numbers or
   * addresses are on file.
   */
  const resolveSignInRoute = async (
    identifier: string
  ): Promise<{ route: 'password' | 'claim_email' | 'claim_phone_pending'; emailHint?: string }> => {
    if (!supabase) return { route: 'password' };

    const { data, error } = await supabase.rpc('customer_signin_route', {
      identifier: String(identifier || '').trim()
    });

    if (error) {
      console.error('customer_signin_route failed:', error.message);
      // Fail closed: ask for a password rather than opening the claim flow on
      // an identifier whose status is unknown.
      return { route: 'password' };
    }

    const route = (data as any)?.route;
    if (route === 'claim_email' || route === 'claim_phone_pending') {
      return { route, emailHint: (data as any)?.email_hint || undefined };
    }
    return { route: 'password' };
  };

  const signInCustomerRecord = (customer: CustomerAccount) => {
    setCurrentUser({
      id: customer.id, name: customer.name, email: customer.email, phone: customer.phone
    });
  };

  /**
   * Customer sign-in with EITHER a phone number or an email address.
   *
   * The identifier is resolved server-side first, because which of three things
   * should happen depends on a row the browser is not allowed to read:
   *
   *   - an unclaimed record (a walk-in, an admin entry, a counter booking)
   *     is routed into the claim flow — never told its password is wrong;
   *   - a real website account is asked for its password, and a wrong one
   *     gets the ordinary error, NOT the claim flow;
   *   - an identifier with nothing behind it is answered exactly like a real
   *     account, so this cannot be used to discover who is on file.
   *
   * Supabase Auth still mints every session. A phone sign-in only needs the
   * address the account lives at, and the RPC releases that solely to a caller
   * who has already proved they hold the password.
   */
  const loginCustomer = async (emailOrPhone: string, password?: string) => {
    const input = String(emailOrPhone || '').trim();
    if (!input) return { success: false, error: 'Email or phone number is required.' };
    if (!password) return { success: false, error: 'Enter your password.' };
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const typedEmail = canonicalEmail(input);
    const looksLikeEmail = typedEmail.includes('@');

    // Step 1 — which route? An unclaimed record is offered the claim flow
    // before any credential is tried, so it never sees a password error.
    const { route, emailHint } = await resolveSignInRoute(input);

    if (route === 'claim_email') {
      return {
        success: false,
        needsPasswordSetup: true,
        claimEmailHint: emailHint,
        error: looksLikeEmail
          ? 'This email is on file from a visit or booking, but it does not have an account yet. Set a password to claim it.'
          : 'This number is on file from a visit or booking, but it does not have an account yet. Set a password to claim it.'
      };
    }

    if (route === 'claim_phone_pending') {
      // ⚠️ OWNERSHIP VERIFICATION — the record has a phone and no email, so
      // there is nothing to send a confirmation to and knowing the number
      // proves nothing. The claim is offered but cannot complete; see
      // claimCustomerAccount().
      // TODO(stage-2): gate behind supabase.auth.signInWithOtp({ phone }) +
      // verifyOtp() once SMS is enabled, then allow it without an email.
      return {
        success: false,
        // No claim form is offered: it could not complete, and an unusable form
        // is worse than a clear explanation.
        awaitingPhoneVerification: true,
        error: 'This number is on file from a visit or booking, but there is no email address on the record to send a confirmation link to. Please ask the studio to add your email, then set your password here.'
      };
    }

    // Step 2 — a password is expected. Signing in by phone needs the address
    // the auth account lives at; the RPC returns it only once the password
    // checks out, and returns nothing at all for a wrong one or an unknown
    // identifier, so the two are indistinguishable.
    let email = typedEmail;
    if (!looksLikeEmail) {
      const { data: resolvedEmail, error: lookupError } = await supabase.rpc('customer_signin_email', {
        p_identifier: input,
        p_password: password
      });

      if (lookupError) {
        console.error('customer_signin_email failed:', lookupError.message);
        return { success: false, error: 'Could not sign you in right now. Please try again.' };
      }

      if (typeof resolvedEmail !== 'string' || !resolvedEmail.includes('@')) {
        return { success: false, error: 'Incorrect phone number or password.' };
      }
      email = canonicalEmail(resolvedEmail);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      // Route resolution already handled the unclaimed case, so a failure here
      // is a genuinely wrong credential and says so plainly.
      return { success: false, error: friendlyAuthError(error?.message || '') };
    }

    // Resolve the shared record from the auth id, linking it on first sign-in.
    const linkedId = await linkAuthToCustomer(email, data.user.id);
    let customer =
      (await db.customers.toArray()).find(c => c.userId === data.user!.id) ||
      (linkedId ? await db.customers.get(linkedId) : undefined);

    // An authenticated account with no customer record behind it. This happens
    // when sign-up created the auth user but the record write did not land.
    // Create and attach it now rather than leaving them locked out.
    if (!customer) {
      const { data: healedId } = await supabase.rpc('resolve_customer_record', {
        p_name: data.user.user_metadata?.name ?? null,
        p_phone: null,
        p_email: email,
        p_auth_id: data.user.id,
        p_source: 'Website Registration'
      });
      if (healedId) customer = await db.customers.get(healedId);
    }

    if (!customer) {
      return { success: false, error: 'No customer record is linked to this account yet.' };
    }

    signInCustomerRecord(customer);
    return { success: true };
  };

  /**
   * Claims an existing passwordless record: creates the auth user and attaches
   * it to the record already found by normalized phone or email. No second
   * customer is ever created.
   *
   * ⚠️ OWNERSHIP VERIFICATION — see linkAuthToCustomer(). The claim only
   * completes once Supabase Auth has proven the caller controls the address
   * (the email confirmation link). Knowing a phone number must never be enough.
   */
  const claimCustomerAccount = async (emailOrPhone: string, password: string, email?: string) => {
    const input = String(emailOrPhone || '').trim();
    if (!input) return { success: false, error: 'Email or phone number is required.' };
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const strength = validatePasswordRule(password);
    if (!strength.valid) return { success: false, error: strength.error };

    // The record itself is unreadable from here — an anonymous caller cannot
    // select a row whose user_id is null — so its status comes from the same
    // route function the sign-in used. A claimed identifier is refused without
    // confirming that it is claimed.
    const { route } = await resolveSignInRoute(input);
    if (route === 'password') {
      return {
        success: false,
        error: 'That account cannot be set up here. Please sign in, or use Forgot password.'
      };
    }

    if (route === 'claim_phone_pending') {
      // ⚠️ OWNERSHIP VERIFICATION — the record holds a phone number and no
      // email, so there is nothing to send a confirmation link to. Knowing the
      // number proves nothing, and letting any address claim it would hand the
      // record to whoever typed the number first. The claim stops here.
      // TODO(stage-2): when SMS is enabled, prove the phone channel with
      // supabase.auth.signInWithOtp({ phone }) + verifyOtp() and claim on that
      // verification instead of on an email.
      return {
        success: false,
        error: 'We cannot finish setting this up online yet — there is no email address on your record. Please ask the studio to add one, then claim your account.'
      };
    }

    // The address the auth account is created against, and where the
    // confirmation link goes. Either the identifier itself is an email, or one
    // was typed in the claim form; the record's own address is never disclosed
    // to the browser, only ever masked as a hint.
    const claimEmail = canonicalEmail(email) || canonicalEmail(input);

    if (!claimEmail.includes('@')) {
      return {
        success: false,
        error: 'Enter the email address on your record, and we will send a confirmation link to finish claiming your account.'
      };
    }

    // Claiming by phone: the typed address must be the one the studio already
    // holds. The confirmation link only proves the visitor owns that address —
    // it says nothing about their being this customer — so any other address
    // would let whoever knows the number take the record.
    if (canonicalEmail(input) !== claimEmail) {
      const { data: matches, error: matchError } = await supabase.rpc('customer_claim_email_matches', {
        p_identifier: input,
        p_email: claimEmail
      });

      if (matchError) {
        console.error('customer_claim_email_matches failed:', matchError.message);
        return { success: false, error: 'Could not set up your account right now. Please try again.' };
      }

      if (matches !== true) {
        // Deliberately does not say which address is on file.
        return {
          success: false,
          error: 'That email address does not match the one on your record. Check the hint above, or ask the studio to confirm it.'
        };
      }
    }

    // The claim attaches to the record matched by the ORIGINAL identifier — the
    // phone number, when that is what was typed — so a walk-in's bookings,
    // queue visits and pottery all stay on the one record. The typed email only
    // ever names the auth account.
    const { data, error } = await supabase.auth.signUp({ email: claimEmail, password });
    if (error) return { success: false, error: friendlyAuthError(error.message) };

    const authId = data.user?.id;
    if (!authId) return { success: false, error: 'Could not create the account. Please try again.' };

    // Matched on the identifier that was signed in with, not on the typed
    // email, so no second customer is ever created for the same person.
    const linkedId = await linkAuthToCustomer(input, authId);
    if (!linkedId) {
      return { success: false, error: 'No account found with these details. Please create an account.' };
    }

    if (!data.session) {
      return {
        success: false,
        needsEmailConfirmation: true,
        error: 'Almost there — check your email and confirm your address to finish claiming your account.'
      };
    }

    const claimed = await db.customers.get(linkedId);
    if (claimed) signInCustomerRecord(claimed);

    return { success: true, customerId: linkedId };
  };

  /**
   * Sends a password-reset link.
   *
   * Supabase Auth owns the proof of ownership: only someone who can open the
   * inbox can complete the reset. That is also why this is the correct path for
   * an unclaimed customer record — no special case is needed or wanted.
   *
   * The response is deliberately identical whether or not the address is on
   * file, so this cannot be used to discover which emails are registered.
   */
  const requestPasswordReset = async (email: string) => {
    const address = canonicalEmail(email);
    const generic = 'If an account exists for that address, a reset link is on its way. Check your inbox and spam folder.';

    if (!address.includes('@')) {
      return { success: false, error: 'Enter a valid email address.' };
    }
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const { error } = await supabase.auth.resetPasswordForEmail(address, {
      // No fragment of our own: Supabase appends its token as the URL
      // fragment, and a URL can only have one. Adding "#reset-password" here
      // produced "#reset-password#access_token=..." — unparseable, so no
      // session was ever created and every link looked expired.
      // The reset screen is reached from `type=recovery` / PASSWORD_RECOVERY.
      redirectTo: `${window.location.origin}${window.location.pathname}`
    });

    // A failure is logged but never distinguished to the caller: reporting
    // "no such user" here would leak the account list.
    if (error) console.error('Password reset request failed:', error.message);

    return { success: true, message: generic };
  };

  /**
   * Whether a recovery session exists yet.
   *
   * Reading the token out of the URL is asynchronous, so the reset screen can
   * render before it lands. This is polled briefly rather than declaring a
   * perfectly good link expired.
   */
  const hasRecoverySession = async (): Promise<boolean> => {
    const clients = [supabase, supabaseStaff].filter(Boolean) as NonNullable<typeof supabase>[];
    for (const client of clients) {
      const { data } = await client.auth.getSession();
      if (data.session) return true;
    }
    return false;
  };

  /**
   * Completes a reset. Requires the recovery session Supabase establishes when
   * the emailed link is opened; without it there is nothing to update.
   */
  const completePasswordReset = async (newPassword: string) => {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const strength = validatePasswordRule(newPassword);
    if (!strength.valid) return { success: false, error: strength.error };

    // The recovery session belongs to whichever client read the link. The
    // default client is the only one that reads the URL, but a staff member
    // resetting while signed in to the console may hold it there instead, so
    // both are checked before declaring the link dead.
    const clients = [supabase, supabaseStaff].filter(Boolean) as NonNullable<typeof supabase>[];

    let holder: (typeof clients)[number] | null = null;
    for (const client of clients) {
      const { data } = await client.auth.getSession();
      if (data.session) { holder = client; break; }
    }

    if (!holder) {
      return {
        success: false,
        expired: true,
        error: 'This reset link has expired or has already been used. Request a new one.'
      };
    }

    const { error } = await holder.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: friendlyAuthError(error.message) };

    return { success: true };
  };

  /**
   * Retired. It set a password from an identifier alone, which is exactly the
   * unverified reset the fake "123456" flow relied on: knowing an email or a
   * phone number was enough to take over an account.
   *
   * Resets now go through Supabase Auth — requestPasswordReset emails a link,
   * completePasswordReset uses the recovery session it creates. Kept only so
   * the context contract does not change; it never succeeds.
   */
  const resetCustomerPassword = async (
    _emailOrPhone: string,
    _newPassword: string
  ): Promise<{ success: boolean; error?: string }> => ({
    success: false,
    error: 'Password resets are sent by email. Use "Forgot password?" to get a secure link.'
  });

  /**
   * Changes the password of whoever is signed in on the customer client.
   *
   * Supabase resolves the account from the session cookie, so there is nothing
   * to pass and nothing to spoof: a caller can only change their own. An
   * account that was never claimed has no auth session, and is told to use the
   * emailed link rather than being handed a way to set a password from the
   * page.
   */
  const changeCustomerPassword = async (newPassword: string) => {
    if (!supabase) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const strength = validatePasswordRule(newPassword);
    if (!strength.valid) return { success: false, error: strength.error };

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      return {
        success: false,
        needsSignIn: true,
        error: 'Your session has expired, or this account has not been set up with a password yet. Sign in again, or use "Forgot password?" to set one by email.'
      };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: friendlyAuthError(error.message) };

    return { success: true };
  };

  const logoutCustomer = async () => {
    // Supabase owns the session; signing out clears it everywhere.
    if (supabase) await supabase.auth.signOut();
    setCurrentUser(null);
    setCustomerTab('home');
  };

  // Active element triggers
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('ws-1');
  const [lastBookingCreated, setLastBookingCreated] = useState<Booking | null>(null);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);
  const [selectedEventBookingId, setSelectedEventBookingId] = useState<string | null>(null);

  // Settings subsection, restored on refresh so the same section reopens.
  const [settingsSection, setSettingsSectionState] = useState<SettingsSectionId>(
    () => resolveSettingsSection(localStorage.getItem('artycafe_settings_section'))
  );

  const setSettingsSection = (section: SettingsSectionId) => {
    setSettingsSectionState(section);
    localStorage.setItem('artycafe_settings_section', section);
  };
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

  // ================= LIVE DATA (Supabase) =================
  // Each list is fetched once and then kept current by a realtime channel.
  //
  // `undefined` means the first read has not resolved yet. That is the loading
  // signal — there are no seed-data fallbacks: a pending or failed read yields
  // an empty list so the UI can never show phantom records.
  const rawWorkshops = useLiveTable<Workshop>('workshops');
  const rawEvents = useLiveTable<AppEvent>('events');
  const rawBookings = useLiveTable<Booking>('bookings');
  const rawQueue = useLiveTable<QueueItem>('queue');
  const rawPieces = useLiveTable<PotteryPiece>('pieces');
  const rawPieceHistory = useLiveTable<any>('piece_history', { orderBy: 'timestamp' });
  const rawCustomers = useLiveTable<CustomerAccount>('customers');
  const rawStaff = useLiveTable<StaffMember>('staff');
  const rawSessions = useLiveTable<WorkshopSessionRecord>('workshop_sessions');
  const rawNotifications = useLiveTable<NotificationItem>('notifications');
  const rawCategories = useLiveTable<Category>('categories');
  const rawAppSettings = useLiveTable<AppSetting>('app_settings');
  const rawStudioResources = useLiveTable<StudioResource>('studio_resources', { orderBy: 'order' });
  const rawBirthdayPackages = useLiveTable<BirthdayPackage>('birthday_packages', { orderBy: 'display_order' });
  const rawPipelineStages = useLiveTable<PipelineStage>('pipeline_stages', { orderBy: 'order' });
  const rawWorkshopOptions = useLiveTable<WorkshopOption>('workshop_options', { orderBy: 'order' });
  const rawEventOptions = useLiveTable<EventOption>('event_options', { orderBy: 'order' });

  const events = rawEvents || [];
  const bookings = rawBookings || [];
  const queue = rawQueue || [];
  const customers = rawCustomers || [];
  const staff = rawStaff || [];
  const notifications = rawNotifications || [];
  const categories = rawCategories || [];
  const appSettings = rawAppSettings || [];
  const studioResources = rawStudioResources || [];
  const pipelineStages = rawPipelineStages || [];
  const workshopOptions = rawWorkshopOptions || [];
  const eventOptions = rawEventOptions || [];
  const workshopSessions = rawSessions || [];

  // Results are produced by running the real suite, not seeded from a list.
  const systemTests: TestResult[] = [];

  // A piece's history lives in its own append-only table; it is stitched back
  // onto the piece so every existing reader of `piece.history` still works.
  const pieces = React.useMemo(() => {
    const byPiece = new Map<string, any[]>();
    for (const entry of rawPieceHistory || []) {
      const list = byPiece.get(entry.pieceId) || [];
      list.push({
        status: entry.status,
        timestamp: entry.timestamp,
        riyadhTime: entry.riyadhTime,
        user: entry.user,
        reason: entry.reason || undefined
      });
      byPiece.set(entry.pieceId, list);
    }
    return (rawPieces || []).map(p => ({ ...p, history: byPiece.get(p.id) || [] }));
  }, [rawPieces, rawPieceHistory]);

  // Sessions are their own table now. They are also attached to their workshop
  // so the places that read `workshop.sessions` keep working unchanged.
  const workshops = React.useMemo(() => {
    const byWorkshop = new Map<string, WorkshopSessionRecord[]>();
    for (const session of rawSessions || []) {
      const list = byWorkshop.get(session.workshopId) || [];
      list.push(session);
      byWorkshop.set(session.workshopId, list);
    }
    return (rawWorkshops || []).map(w => ({ ...w, sessions: byWorkshop.get(w.id) || [] }));
  }, [rawWorkshops, rawSessions]);

  // Older records are filled in so the customer site has one consistent shape.
  const birthdayPackages = React.useMemo(
    () => (rawBirthdayPackages || []).map(normalizeBirthdayPackage),
    [rawBirthdayPackages]
  );

  /**
   * Makes sure every default birthday package exists and is up to date.
   *
   * Creates a package that is missing entirely (the previous version only
   * upgraded packages that already existed, so a database holding just Package 1
   * never gained Package 2), and refreshes records saved before the structured
   * content fields existed. Staff edits are preserved: display order, published
   * state and a custom image are kept, and packages that already carry the
   * structured fields are left untouched.
   */
  // Birthday packages are seeded by 0001_init.sql; there is no client-side
  // self-heal any more.


  // The database is seeded by supabase/migrations/0001_init.sql. There is no
  // client-side seeding: an empty table means an empty table.


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
            // Resolve the real tutor through the booked session — no default staff member.
            const link = await resolveBookingSessionLink(b);
            const qItem: QueueItem = {
              id: qId,
              bookingId: b.id,
              name: b.customerName,
              phone: b.customerPhone,
              activity: b.workshopTitle,
              participants: b.participants,
              checkInTime: b.time || '12:00 PM',
              elapsedMinutes: 0,
              staffAvatar: '',
              staffName: link.staffName,
              staffId: link.staffId,
              status: b.status === 'Checked In' ? 'In Progress' : (b.status === 'Completed' ? 'Completed' : 'Waiting'),
              source: b.source || 'Website',
              type: 'With Instructor',
              workshopId: b.workshopId,
              sessionId: link.sessionId,
              sessionStartTime: link.startTime,
              sessionEndTime: link.endTime,
              sessionDuration: link.duration,
              sessionCapacity: link.capacity,
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

  /** Returns a cancelled booking's seats, clamped to capacity, in one statement. */
  const releaseSeats = async (bookingId: string) => {
    if (!supabase || !bookingId) return;
    const { error } = await supabase.rpc('release_booking_seats', { p_booking_id: bookingId });
    if (error) console.error('Failed to release seats:', error.message);
  };

  /**
   * The next queue number for today, from Postgres.
   *
   * The number is computed server-side so two walk-ins checked in at the same
   * moment cannot be handed the same one. The local fallback below only runs
   * when the RPC is unavailable.
   */
  /**
   * A fresh read of everything an assignment/space conflict check needs.
   *
   * Deliberately not the cached lists: the check must see a session someone
   * else saved a moment ago, or it will approve a double booking.
   */
  const getFreshAssignmentSources = async () => {
    const [staffRows, sessions, workshopRows, eventRows, queueRows, resources, settings] =
      await Promise.all([
        fetchTable<StaffMember>('staff'),
        fetchTable<WorkshopSessionRecord>('workshop_sessions'),
        fetchTable<Workshop>('workshops'),
        fetchTable<AppEvent>('events'),
        fetchTable<QueueItem>('queue'),
        fetchTable<StudioResource>('studio_resources'),
        fetchTable<AppSetting>('app_settings')
      ]);
    return {
      staff: staffRows,
      workshopSessions: sessions,
      workshops: workshopRows,
      events: eventRows,
      queue: queueRows,
      studioResources: resources,
      appSettings: settings
    };
  };

  /** Staff read straight from Postgres, for checks that must not be stale. */
  const getFreshStaff = async (): Promise<StaffMember[]> => fetchTable<StaffMember>('staff');

  const generateNextQueueId = async (): Promise<string> => {
    const today = getRiyadhDateString();

    if (supabase) {
      const { data, error } = await supabase.rpc('next_queue_id', { p_date: today });
      if (!error && typeof data === 'string' && data) return data;
      if (error) console.error('next_queue_id failed, numbering locally:', error.message);
    }

    const todaysItems = (await db.queue.toArray()).filter(qi => qi.date === today);
    const highest = todaysItems.reduce((max, qi) => {
      const match = String(qi.id).match(/\d+/);
      return Math.max(max, match ? parseInt(match[0], 10) : 0);
    }, 0);
    return `Q-${String(highest + 1).padStart(3, '0')}`;
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

                // Seats go back in one clamped Postgres statement, never a
                // read-modify-write from here.
                await releaseSeats(b.id);
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
        duration: s.duration || ws.duration,
        capacity: Number(s.capacity) || Number(ws.capacity) || 10,
        status: s.status || 'Published',
        instructor: s.instructor || ws.instructor || '',
        staffId: s.staffId || ws.staffId,
        // Stable studio-space and rule links travel with the session.
        roomId: s.roomId || ws.roomId,
        room: s.room || ws.room,
        tableId: s.tableId || ws.tableId,
        ruleId: s.ruleId
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
          duration: s.duration || updates.duration,
          capacity: Number(s.capacity) || Number(updates.capacity) || 10,
          status: s.status || 'Published',
          instructor: s.instructor || updates.instructor || '',
          staffId: s.staffId || updates.staffId,
          roomId: s.roomId || updates.roomId,
          room: s.room || updates.room,
          tableId: s.tableId || updates.tableId,
          ruleId: s.ruleId
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

                  // Seats go back in one clamped Postgres statement.
                  await releaseSeats(b.id);
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
    setBookingError(null);
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

    // The insert and the seat check happen in one Postgres statement, with the
    // session row locked: two people taking the last seat cannot both succeed.
    // Never read capacity here and write it back.
    (async () => {
      const client = getDataClient();
      if (!client) throw new Error(SUPABASE_NOT_CONFIGURED);

      // The customer record is resolved FIRST, so the booking carries
      // customer_id. Without it the booking is invisible to the person who
      // made it: the customer row-level policy matches on that column, so
      // My Bookings would always be empty.
      let customerId = newBookingData.customerId;
      if (!customerId && (newBookingData.customerEmail || newBookingData.customerPhone)) {
        const resolved = await resolveCustomer({
          name: newBookingData.customerName,
          email: newBookingData.customerEmail,
          phone: newBookingData.customerPhone
        });
        customerId = resolved.customer?.id;
      }

      newBooking.customerId = customerId;

      const { error } = await client.rpc('book_session_seats', {
        p_booking: toRow('bookings', { ...newBooking, customerId }),
        p_session_id: newBooking.sessionId || null
      });
      if (error) throw new Error(error.message);
    })().catch(err => {
      console.error("Failed to add booking:", err);
      setBookingError(err?.message || 'The booking could not be saved.');
    });

    // If walk-in or admin, automatically add to today's live queue
    if (newBookingData.source === 'Walk-in' || newBookingData.source === 'Admin') {
      Promise.all([generateNextQueueId(), resolveBookingSessionLink(newBooking)]).then(([qId, link]) => {
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
          staffAvatar: '',
          // Tutor comes from the booked session, not a default staff member.
          staffName: link.staffName,
          staffId: link.staffId,
          status: 'Waiting',
          source: newBookingData.source,
          type: 'With Instructor',
          workshopId: newBookingData.workshopId,
          sessionId: link.sessionId,
          sessionStartTime: link.startTime,
          sessionEndTime: link.endTime,
          sessionDuration: link.duration,
          sessionCapacity: link.capacity,
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

    // A booking creates no piece. Pieces exist once a real object exists, which
    // only the studio can know — so one is logged by hand in the Pottery
    // Logging Console. Auto-creating one here put pieces on the customer's My
    // Pieces page for workshops they had not attended yet.

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

        // Seats go back in one clamped Postgres statement.
        await releaseSeats(booking.id);
      });
    }
  };

  /**
   * Adds a workshop/event category unless one with that name already exists.
   * The comparison is case-insensitive, so "Pottery" typed again never creates
   * a second row. Used by both Publish and Save Draft.
   */
  /**
   * Assigns (or clears) the staff member hosting a birthday/event booking.
   *
   * Stores the stable id with the name denormalised beside it, exactly as a
   * workshop session does, and records the change on the booking's timeline.
   * Passing null clears the assignment.
   */
  const assignBookingStaff = async (bookingId: string, staffId: string | null) => {
    if (!bookingId) return { success: false, error: 'No booking selected.' };

    const member = staffId ? (await fetchTable<StaffMember>('staff')).find(m => m.id === staffId) : null;
    if (staffId && !member) return { success: false, error: 'That staff member no longer exists.' };

    try {
      await db.bookings.update(bookingId, {
        staffId: staffId || null,
        staffName: member?.name || null,
        updatedAt: new Date().toISOString()
      } as any);

      await appendBookingTimeline(
        bookingId,
        member ? `Assigned to ${member.name}` : 'Staff assignment cleared'
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not save the assignment.' };
    }
  };

  const addCategoryIfMissing = async (name: string): Promise<{ created: boolean; id?: string }> => {
    const clean = String(name || '').trim();
    if (!clean) return { created: false };

    const all = await db.categories.toArray();
    const existing = all.find(c => String(c.name || '').trim().toLowerCase() === clean.toLowerCase());
    if (existing) return { created: false, id: existing.id };

    const id = `cat-${Date.now()}`;
    await db.categories.add({ id, name: clean });
    return { created: true, id };
  };

  /**
   * Updates one workshop session. Kept as a mutator so session writes go
   * through the data layer rather than straight to the table.
   */
  const updateWorkshopSession = async (id: string, updates: Partial<WorkshopSessionRecord>) => {
    if (!id) return;
    await db.workshopSessions.update(String(id), { ...updates, updatedAt: new Date().toISOString() });
  };

  /**
   * Appends one entry to a booking's timeline, preserving what is already
   * there. Every booking write keeps its own audit trail this way.
   */
  const appendBookingTimeline = async (bookingId: string, action: string) => {
    if (!bookingId || !action) return;
    const booking = await db.bookings.get(String(bookingId));
    if (!booking) return;

    const nowStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    await db.bookings.update(booking.id, {
      timeline: [...(booking.timeline || []), { time: nowStr, action }]
    });
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
          const link = await resolveBookingSessionLink(booking);
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
            staffAvatar: '',
            staffName: link.staffName,
            staffId: link.staffId,
            status: 'Waiting',
            source: booking.source,
            type: 'With Instructor',
            workshopId: booking.workshopId,
            sessionId: link.sessionId,
            sessionStartTime: link.startTime,
            sessionEndTime: link.endTime,
            sessionDuration: link.duration,
            sessionCapacity: link.capacity,
            date: getRiyadhDateString(),
            history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
          };
          await db.queue.put(qItem);
        }
      }
    }
  };

  /**
   * Raises a staff notification. Same table and shape the pottery pipeline
   * uses, exposed so pages never write to the notifications table themselves.
   */
  const addStaffNotification = async (
    title: string,
    message: string,
    meta: { newStatus?: string; performedBy?: string; highlighted?: boolean } = {}
  ) => {
    try {
      await db.notifications.add({
        id: `NOTIF-STAFF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'staff',
        title,
        message,
        newStatus: meta.newStatus,
        performedBy: meta.performedBy || 'System',
        timestamp: new Date().toISOString(),
        isRead: false,
        highlighted: meta.highlighted === true
      } as NotificationItem);
    } catch (err) {
      console.error('Failed to raise staff notification:', err);
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

  /**
   * Adds a completed self-guided guest back to Waiting for more time.
   * The completed record is left intact — a new Waiting entry is created and
   * linked to it, so history is preserved and no duplicate active entry appears.
   */
  const returnQueueItemToWaiting = async (
    id: string,
    opts: { hours: number; participants: number }
  ): Promise<{ success: boolean; message?: string; newId?: string }> => {
    const original = await db.queue.get(id);
    if (!original) return { success: false, message: 'Queue entry not found' };

    if (original.type !== 'Without Instructor') {
      return { success: false, message: 'Only self-guided (Without Instructor) sessions can be returned to Waiting.' };
    }
    if (original.status !== 'Completed') {
      return { success: false, message: 'Only completed sessions can be returned to Waiting.' };
    }

    const hours = Number(opts.hours);
    const participants = Number(opts.participants);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { success: false, message: 'Additional hours must be a positive number.' };
    }
    if (!Number.isFinite(participants) || participants <= 0 || !Number.isInteger(participants)) {
      return { success: false, message: 'Guests must be a whole number of at least 1.' };
    }

    const todayRiyadh = getRiyadhDateString();

    // Guard against a duplicate active entry for the same guest.
    const activeDuplicate = (await db.queue.toArray()).find(q =>
      q.date === todayRiyadh &&
      q.id !== original.id &&
      q.phone === original.phone &&
      q.status !== 'Completed' &&
      q.status !== 'Cancelled'
    );
    if (activeDuplicate) {
      return {
        success: false,
        message: `${original.name} already has an active queue entry (No. ${activeDuplicate.id.replace('Q-', '')}).`
      };
    }

    const newId = await generateNextQueueId();
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    await db.queue.put({
      ...original,
      id: newId,
      participants,
      hours,
      activity: `Walk-in (No Instructor - ${hours} hrs, extended)`,
      checkInTime: timeStr,
      elapsedMinutes: 0,
      seatedTime: undefined,
      status: 'Waiting',
      date: todayRiyadh,
      returnedFromQueueId: original.id,
      extendedByQueueId: undefined,
      history: [{ status: 'Waiting', timestamp: new Date().toISOString() }]
    });

    // Additive pointer only — the completed session record itself is untouched.
    await db.queue.update(original.id, { extendedByQueueId: newId });

    return { success: true, newId };
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
        // Riyadh-local stamp alongside the ISO timestamp
        riyadhTime: `${getRiyadhDateString()} ${getRiyadhNow().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        user: performerUser,
        reason: reason || undefined
      };
      const pieceUpdates: Partial<PotteryPiece> = { status };
      // Broken keeps the internal damage note on the piece; it never leaves the console.
      if (status === 'Broken' && reason) {
        pieceUpdates.damageNote = reason;
      }
      await db.pieces.update(id, pieceUpdates);

      // History is its own append-only table now, so the trail cannot be
      // overwritten by a concurrent update the way a JSON column could.
      await db.pieceHistory.add({ pieceId: id, ...historyEntry });

      // Generate CUSTOMER notification
      let friendlyMsg = `Your piece "${piece.name}" has been updated to "${status}".`;
      if (status === 'Ready for Collection') {
        friendlyMsg = `Your beautiful pottery piece "${piece.name}" is ready for collection! Please come pick it up at the café shelf.`;
      } else if (status === 'Collected') {
        friendlyMsg = `Thank you for picking up your piece "${piece.name}"! We hope you loved crafting it at Arty Café.`;
      } else if (status === 'Bisque Firing') {
        friendlyMsg = `Your piece "${piece.name}" is now being fired in our high-temperature kiln.`;
      } else if (status === 'Glazing') {
        friendlyMsg = `Your piece "${piece.name}" is currently at the glazing station.`;
      } else if (status === 'Greenware') {
        friendlyMsg = `Your piece "${piece.name}" is now resting on the drying racks.`;
      } else if (status === 'Broken') {
        // States the outcome plainly, without exposing the internal damage note.
        friendlyMsg = `Unfortunately, your pottery piece ${piece.pieceCode || piece.id} was damaged and has been marked as broken. Please contact Arty Café so our team can assist you.`;
      }

      // Stages can be configured not to notify the customer at all.
      const stageConfig = (await db.pipelineStages.toArray()).find(x => x.name === status);
      if (stageConfig && stageConfig.notifyCustomer === false) {
        return;
      }

      // Exactly one customer notification per status change for this piece.
      const alreadyNotified = await db.notifications
        .filter(n =>
          n.type === 'customer' &&
          n.pieceId === piece.id &&
          n.newStatus === status &&
          // Same change, re-applied within a short window.
          Date.now() - new Date(n.timestamp).getTime() < 60 * 1000
        )
        .count();

      if (alreadyNotified > 0) {
        return;
      }

      // Exactly one customer notification, addressed to this piece's customer.
      await db.notifications.add({
        id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'customer',
        customerPhone: piece.customerPhone,
        title: status === 'Ready for Collection'
          ? 'Piece Ready for Pickup!'
          : status === 'Broken'
            ? `Piece ${piece.pieceCode || piece.id} marked as broken`
            : `Piece Status Update: ${status}`,
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
        title: status === 'Ready for Collection'
          ? 'Piece Ready for Pickup Alert'
          : status === 'Broken'
            ? 'Piece Marked Broken'
            : 'Piece Status Shifted',
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

  /**
   * Allocates an identifier that no piece is already using.
   *
   * The old generator picked a number out of a 700-wide range and hoped — which
   * is how the board ended up showing AC-1806 twice. This reads the codes in
   * use first, and falls back to a timestamp suffix if the random space is
   * somehow exhausted, so it always terminates with something unique.
   */
  const allocatePieceIdentifier = async (prefix: string, taken: Set<string>) => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidate = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      if (!taken.has(candidate.toUpperCase())) return candidate;
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  };

  const addPiece = async (piece: Omit<PotteryPiece, 'id' | 'daysElapsed' | 'expectedCompletion' | 'notes'> & Partial<Pick<PotteryPiece, 'expectedCompletion' | 'notes'>>) => {
    // Read once, check both the id and the piece code against it: the two share
    // a namespace on screen, where a piece falls back to its id when it has no
    // code of its own.
    const existing = await db.pieces.toArray();
    const taken = new Set<string>();
    existing.forEach(p => {
      if (p.id) taken.add(p.id.trim().toUpperCase());
      if (p.pieceCode) taken.add(p.pieceCode.trim().toUpperCase());
    });

    const id = await allocatePieceIdentifier('PC', taken);
    taken.add(id.toUpperCase());

    const requestedCode = piece.pieceCode?.trim();
    if (requestedCode && taken.has(requestedCode.toUpperCase())) {
      // The console checks this before calling, so reaching here means two
      // people logged the same code at once. Refusing beats silently writing a
      // duplicate.
      throw new Error(`Piece code "${requestedCode}" is already in use.`);
    }

    const newPiece: PotteryPiece = {
      name: 'Ceramic Piece',
      workshopName: 'Freestyle Handbuilding',
      customerName: 'Walk-in Customer',
      customerPhone: '+966500000000',
      image: '',
      dateCreated: new Date().toISOString().split('T')[0],
      assignedStaff: 'Lina',
      ...piece,
      // Never a legacy or hand-typed stage name — the column's check constraint
      // only accepts the six current ones.
      status: migrateLegacyPieceStatus(piece.status),
      pieceCode: requestedCode || (await allocatePieceIdentifier('AC', taken)),
      id,
      daysElapsed: 0
    };
    await db.pieces.add(newPiece);

    // The opening history entry, in the append-only table.
    await db.pieceHistory.add({
      pieceId: id,
      status: newPiece.status,
      timestamp: new Date().toISOString(),
      riyadhTime: `${getRiyadhDateString()} ${getRiyadhNow().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      user: 'Staff',
      reason: 'Piece manually logged or initialized'
    });
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

  /**
   * Left as a no-op: it faked a failure in the old hardcoded test list, which
   * was replaced by the real suite in utils/systemTests. There is no
   * system_tests table — results come from actually running the tests. Kept so
   * the context contract is unchanged.
   */
  const toggleTestResult = async (_id: string) => {
    /* results are produced by running the suite, not toggled */
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
    
    // A stage referenced by any piece — current status or past history — is
    // disabled rather than deleted, so historical records stay readable.
    const allPieces = await db.pieces.toArray();
    const piecesInStage = allPieces.filter(p => p.status === stage.name).length;
    const piecesInHistory = allPieces.filter(
      p => (p.history || []).some(h => h.status === stage.name)
    ).length;

    if (piecesInStage > 0 || piecesInHistory > 0) {
      await db.pipelineStages.update(id, { enabled: false });
      return {
        success: true,
        deactivated: true,
        message: `"${stage.name}" is used by ${piecesInStage} current and ${piecesInHistory} historical piece(s), so it was disabled instead of deleted. Existing records keep this stage.`
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



  /**
   * Guarantees the Admin Console is reachable.
   *
   * The main seed is skipped once the one-time data-wipe flag is set, so a
   * Backfills the phone match key on staff rows, so a record saved before the
   * field existed is still found by phone. No account is ever created here:
   * credentials belong to Supabase Auth.
   */
  const ensureStaffPhoneKeys = async () => {
    if (!supabase) return;
    try {
      const allStaff = await fetchTable<StaffMember>('staff');
      for (const member of allStaff) {
        const key = normalizeCustomerPhone(member.phone);
        if (key && member.normalizedPhone !== key) {
          await supabase.from('staff').update({ normalized_phone: key }).eq('id', member.id);
        }
      }
    } catch (err) {
      console.error('Failed to backfill staff sign-in keys:', err);
    }
  };

  useEffect(() => {
    ensureStaffPhoneKeys();
  }, []);


  /**
   * Guarantees the pottery pipeline configuration exists.
   *
   * The main seed is skipped once the one-time data-wipe flag is set, which left
   * Settings → Piece Pipeline Stages empty even though the Pottery Pieces page
   * was using these very statuses. This runs on every load: it creates the
   * stages if none exist and backfills the newer fields on older rows, without
   * touching a stage an admin has already customised.
   */
  // Pipeline stages are seeded by 0001_init.sql.



  /**
   * Ensures the Workshop option lists exist. Like the other configuration, the
   * main seed is skipped once the data-wipe flag is set, so this runs on every
   * load. Existing options are never overwritten — only missing lists are added
   * and older rows have `enabled` backfilled.
   */
  // Workshop option lists are seeded by 0001_init.sql.


  // ================= ADMIN CONSOLE SESSION =================
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
  const [staffAuthChecked, setStaffAuthChecked] = useState(false);

  /**
   * Restores the Supabase session on load and re-derives who is signed in.
   *
   * Nothing about identity or role is read from local storage: the session
   * gives an auth id, and the staff/customer row is looked up from it, so a
   * revoked role or a deactivated account takes effect on the next load.
   */
  useEffect(() => {
    let cancelled = false;

    /** Who is signed in, re-derived from each session's auth id. */
    const resolveSessions = async (staffAuthId: string | null, customerAuthId: string | null) => {
      if (cancelled) return;

      // The staff session decides which client data reads use, so set it
      // before reading anything.
      setStaffSessionActive(!!staffAuthId);

      if (staffAuthId) {
        const staffRows = await fetchTable<StaffMember>('staff');
        if (cancelled) return;
        const row = staffRows.find(m => m.userId === staffAuthId);
        setCurrentStaffId(row ? row.id : null);
        if (!row) setStaffSessionActive(false);
      } else {
        setCurrentStaffId(null);
      }

      if (customerAuthId) {
        const customerRows = await fetchTable<CustomerAccount>('customers');
        if (cancelled) return;
        const row = customerRows.find(c => c.userId === customerAuthId);
        setCurrentUser(row
          ? { id: row.id, name: row.name, email: row.email, phone: row.phone }
          : null);
      } else {
        setCurrentUser(null);
      }

      setStaffAuthChecked(true);
    };

    if (!supabase || !supabaseStaff) {
      setStaffAuthChecked(true);
      return;
    }

    let staffId: string | null = null;
    let customerId: string | null = null;

    Promise.all([
      supabaseStaff.auth.getSession(),
      supabase.auth.getSession()
    ]).then(([staffSession, customerSession]) => {
      staffId = staffSession.data.session?.user?.id ?? null;
      customerId = customerSession.data.session?.user?.id ?? null;
      resolveSessions(staffId, customerId);
    });

    const staffSub = supabaseStaff.auth.onAuthStateChange((_e, session) => {
      staffId = session?.user?.id ?? null;
      resolveSessions(staffId, customerId);
    });

    const customerSub = supabase.auth.onAuthStateChange((_e, session) => {
      customerId = session?.user?.id ?? null;
      resolveSessions(staffId, customerId);
    });

    return () => {
      cancelled = true;
      staffSub.data.subscription.unsubscribe();
      customerSub.data.subscription.unsubscribe();
    };
  }, []);

  /** Always re-read from the live staff table so role and permission edits apply. */
  const currentStaff = React.useMemo(
    () => (currentStaffId ? staff.find(s => s.id === currentStaffId) || null : null),
    [currentStaffId, staff]
  );

  // A staff member who loses console access is signed out immediately.
  useEffect(() => {
    if (currentStaffId && staff.length > 0 && !hasConsoleAccount(currentStaff)) {
      // Losing console access signs them out immediately.
      setCurrentStaffId(null);
      setStaffSessionActive(false);
      supabaseStaff?.auth.signOut();
    }
  }, [currentStaffId, currentStaff, staff]);

  /**
   * Signs a staff member in with an email address or a phone number in any
   * format. There is no default staff account: a failed match signs nobody in.
   */
  const loginStaff = async (emailOrPhone: string, password: string) => {
    const input = String(emailOrPhone || '').trim();
    if (!input) return { success: false, error: 'Enter your email address or phone number.' };
    if (!password) return { success: false, error: 'Enter your password.' };
    if (!supabaseStaff) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const email = canonicalEmail(input);
    if (!email.includes('@')) {
      // Console sign-in is by email; the phone field stays for the customer site.
      return { success: false, error: 'Sign in with your work email address.' };
    }

    // 1. Supabase Auth verifies the credential, on the console's own session
    //    so signing in as a customer elsewhere does not sign staff out.
    const { data, error } = await supabaseStaff.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      // The real reason, so "email not confirmed" is not reported as a wrong
      // password.
      return { success: false, error: friendlyAuthError(error?.message || '') };
    }

    // 2. The staff record, resolved from the auth id. Role and permissions are
    //    read from this row — never from the token or anything stored locally.
    // Read fresh, not from the cached list: a role or access change made a
    // moment ago must apply to this sign-in.
    const all = await fetchTable<StaffMember>('staff');
    const account =
      all.find(member => member.userId === data.user!.id) ||
      // First sign-in after the account was provisioned: link by email once.
      all.find(member => canonicalEmail(member.email) === email);

    if (!account) {
      await supabaseStaff.auth.signOut();
      return { success: false, error: 'No staff account found with those details.' };
    }

    // 3. The existing console guards, unchanged.
    if (!account.hasConsoleAccess) {
      await supabaseStaff.auth.signOut();
      return { success: false, error: 'This staff profile does not have Admin Console access.' };
    }
    if (account.status === 'Inactive' || account.status === 'Former Staff') {
      await supabaseStaff.auth.signOut();
      return { success: false, error: `This account is ${account.status} and cannot sign in.` };
    }

    // Data reads now go through the staff session, so RLS grants the
    // staff-only tables.
    setStaffSessionActive(true);
    setCurrentStaffId(account.id);
    await db.staff.update(account.id, {
      lastLoginAt: new Date().toISOString(),
      // Bind the record to this auth user on first sign-in.
      userId: account.userId || data.user.id
    });

    return { success: true, mustChangePassword: account.passwordIsTemporary === true };
  };

  /**
   * Replaces the signed-in staff member's password through Supabase Auth and
   * clears the temporary flag, so the console stops asking.
   */
  const changeStaffPassword = async (newPassword: string) => {
    if (!supabaseStaff) return { success: false, error: SUPABASE_NOT_CONFIGURED };

    const strength = validatePasswordRule(newPassword);
    if (!strength.valid) return { success: false, error: strength.error };

    try {
      // A hung request must not leave the screen stuck on "Saving...".
      const update = supabaseStaff!.auth.updateUser({ password: newPassword });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('The authentication service did not respond. Check your connection and try again.')), 15000)
      );
      const { error } = await Promise.race([update, timeout]) as { error: any };

      if (error) return { success: false, error: friendlyAuthError(error.message) };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Could not save the new password.' };
    }

    if (currentStaffId) {
      await db.staff.update(currentStaffId, { passwordIsTemporary: false });
      // The flag was set in Postgres by the provisioning script, so clear it
      // there too — otherwise the next sign-in asks again. Not fatal if it
      // fails: Dexie is authoritative until Stage 2.
      try {
        await supabase.from('staff').update({ password_is_temporary: false }).eq('id', currentStaffId);
      } catch (err) {
        console.warn('Could not clear password_is_temporary in Supabase:', err);
      }
    }

    return { success: true };
  };

  const logoutStaff = async () => {
    if (supabaseStaff) await supabaseStaff.auth.signOut();
    setStaffSessionActive(false);
    setCurrentStaffId(null);
    // Signing out always drops back to the public site.
    setArea('customer');
  };

  const goToStaffLogin = () => setArea('staff');
  const viewCustomerSite = () => setArea('customer');
  /** Only meaningful for an authenticated staff member. */
  const returnToStaffConsole = () => {
    if (currentStaffId) setArea('staff');
  };

  const canAccessAdminPage = (pageId: string) => canAccessPage(currentStaff, pageId);

  // ================= UNIFIED CUSTOMER IDENTITY =================
  /**
   * The single find-or-create used by every surface that captures a customer:
   * the queue, bookings, the pottery console and admin creation. Matching is by
   * normalized phone first, so the same person is never stored twice.
   */
  const resolveCustomer = async (input: { name?: string; phone?: string; email?: string }) => {
    // Find-or-create runs in Postgres. It has to: a guest booking is made by an
    // anonymous visitor, who cannot read or insert customer rows directly, and
    // doing the lookup client-side would also race two simultaneous walk-ins
    // into two records for the same person.
    const known = await db.customers.toArray();
    const { customer: cached, reason } = findCustomerMatch(known, {
      phone: input.phone,
      email: input.email
    });

    if (!supabase) {
      return { customer: (cached || { id: '', name: input.name || 'Guest' }) as CustomerAccount, created: false, matchedOn: reason };
    }

    const { data: id, error } = await supabase.rpc('resolve_customer_record', {
      p_name: input.name ?? null,
      p_phone: input.phone ?? null,
      p_email: input.email ?? null,
      p_auth_id: null,
      p_source: null
    });

    if (error || !id) {
      console.error('resolve_customer_record failed:', error?.message);
      return { customer: (cached || { id: '', name: input.name || 'Guest' }) as CustomerAccount, created: false, matchedOn: reason };
    }

    // Read the row back. A guest has no session, so this goes through the
    // summary function rather than a direct select.
    const { data: summary } = await supabase.rpc('get_customer_summary', { p_id: id });
    const row = Array.isArray(summary) ? summary[0] : summary;

    const customer = (row ? rowToModel<CustomerAccount>(row) : { ...buildCustomerIdentity(input), id }) as CustomerAccount;

    return { customer, created: !cached, matchedOn: cached ? reason : 'none' };
  };

  /**
   * Backfills match keys and consolidates records that share a phone number.
   * History is never deleted: relationships are re-pointed at the canonical
   * record and the duplicate is removed only once nothing references it.
   */
  useEffect(() => {
    const consolidate = async () => {
      try {
        const all = await db.customers.toArray();
        if (all.length === 0) return;

        // 1. Backfill the normalized key on older records.
        for (const customer of all) {
          if (!customer.normalizedPhone && customer.phone) {
            await db.customers.update(customer.id, {
              normalizedPhone: normalizeCustomerPhone(customer.phone),
              displayPhone: customer.displayPhone || toDisplayPhone(customer.phone)
            });
          }
        }

        // 2. Consolidate duplicates that share a normalized phone.
        const groups = findDuplicateGroups(await db.customers.toArray());
        for (const group of groups) {
          for (const duplicate of group.duplicates) {
            const canonicalId = group.canonical.id;

            const [bookingRows, queueRows, pieceRows] = await Promise.all([
              db.bookings.toArray(),
              db.queue.toArray(),
              db.pieces.toArray()
            ]);

            await Promise.all([
              ...bookingRows
                .filter(b => b.customerId === duplicate.id)
                .map(b => db.bookings.update(b.id, { customerId: canonicalId })),
              ...queueRows
                .filter(q => q.customerId === duplicate.id)
                .map(q => db.queue.update(q.id, { customerId: canonicalId })),
              ...pieceRows
                .filter(p => p.customerId === duplicate.id)
                .map(p => db.pieces.update(p.id, { customerId: canonicalId }))
            ]);

            // Keep any detail the duplicate had that the canonical record lacks.
            const fill: Partial<CustomerAccount> = {};
            if (!group.canonical.email && duplicate.email) fill.email = duplicate.email;
            if (!group.canonical.notes && duplicate.notes) fill.notes = duplicate.notes;
            if (Object.keys(fill).length > 0) await db.customers.update(canonicalId, fill);

            await db.customers.delete(duplicate.id);
          }
        }
      } catch (err) {
        console.error('Customer consolidation failed:', err);
      }
    };

    consolidate();
  }, []);

  // ---- Customer mutators ----
  /**
   * Creates a customer record from the Staff Console. These are guest records:
   * no authentication link is created, so they stay Walk-In / Guest until an
   * account is linked to them.
   */
  const addCustomer = async (customer: Omit<CustomerAccount, 'id' | 'createdAt'>) => {
    // Shared rules, enforced at the write itself so no caller can bypass them.
    const nameCheck = validateRequired(customer.name, 'Customer name');
    if (!nameCheck.valid) return { success: false, error: nameCheck.error };

    const phoneCheck = validatePhoneRule(customer.phone);
    if (!phoneCheck.valid) return { success: false, error: phoneCheck.error };

    const emailCheck = validateEmailRule(customer.email, false);
    if (!emailCheck.valid) return { success: false, error: emailCheck.error };

    const canonical = customerStorageFields({ phone: customer.phone, email: customer.email });

    // Reuse an existing record rather than creating a duplicate. Matched on the
    // normalized key so any stored format is recognised.
    const allCustomers = await db.customers.toArray();
    const existing = allCustomers.find(c => customerPhoneKey(c) === canonical.normalizedPhone);
    if (existing) {
      return {
        success: false,
        error: `This number already has an account under ${existing.name || 'another customer'}.`,
        customerId: existing.id
      };
    }

    const id = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;
    await db.customers.put({
      ...customer,
      id,
      name: customer.name.trim(),
      ...canonical,
      // Explicitly not an account: no userId, no credential.
      hasAccount: false,
      createdAt: new Date().toISOString()
    });

    return { success: true, customerId: id };
  };

  const updateCustomer = async (id: string, updates: Partial<CustomerAccount>) => {
    const identity = (updates.phone !== undefined || updates.email !== undefined)
      ? customerStorageFields({
          phone: updates.phone ?? (await db.customers.get(id))?.phone,
          email: updates.email ?? (await db.customers.get(id))?.email
        })
      : {};
    try {
      await db.customers.update(id, { ...updates, ...identity, updatedAt: new Date().toISOString() });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update customer details.' };
    }
  };

  // Staff Mutators
  const addStaffMember = async (member: Omit<StaffMember, 'id'>) => {
    const id = `staff-${Date.now()}`;
    await db.staff.add({
      ...member,
      // Canonical phone/email, so duplicate checks and login matching agree.
      ...staffStorageFields({ phone: member.phone, email: member.email }),
      id,
      // New staff start with no working hours; the admin adds them manually.
      weeklySchedule: member.weeklySchedule || {},
      createdAt: member.createdAt || new Date().toISOString()
    });
  };

  const updateStaffMember = async (id: string, updates: Partial<StaffMember>) => {
    // Only re-canonicalise the identity fields when they are actually part of
    // this update, so a schedule-only save leaves them untouched.
    const identity = (updates.phone !== undefined || updates.email !== undefined)
      ? staffStorageFields({ phone: updates.phone, email: updates.email })
      : {};
    await db.staff.update(id, { ...updates, ...identity, updatedAt: new Date().toISOString() });
  };

  const deleteStaffMember = async (id: string) => {
    const member = await db.staff.get(id);
    if (!member) return { success: false, message: 'Staff member not found' };

    // Match by staff ID, falling back to the name for legacy rows saved without one.
    const workshopsAssigned = await db.workshops
      .filter(w => w.staffId === id || (!w.staffId && w.instructor === member.name))
      .toArray();
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

  /**
   * Settings -> Data Reset.
   *
   * This now clears the SHARED database, not one browser's copy: every device
   * sees the result. Two things are deliberately preserved.
   *
   *  - staff, because deleting those rows would remove the signed-in Super
   *    Admin's own record and permanently lock the console (the auth user
   *    would survive with nothing to link to).
   *  - the configuration seeded by the migrations — stages, option lists,
   *    packages, resources, settings — which is no longer re-created by the
   *    client and could not be recovered without re-running the migration.
   */
  const removeAllData = async () => {
    localStorage.removeItem('artycafe_current_user');
    localStorage.removeItem('artycafe_pending_booking');

    // Operational records only, children before parents.
    await db.pieceHistory.clear();
    await db.notifications.clear();
    await db.queue.clear();
    await db.pieces.clear();
    await db.bookings.clear();
    await db.workshopSessions.clear();
    await db.workshops.clear();
    await db.events.clear();
    await db.customers.clear();

    setCurrentUser(null);
  };

  /**
   * Sample data is no longer generated by the app: the database is seeded by
   * supabase/migrations. Kept so the Settings button keeps its contract.
   */
  const reseedSampleData = async () => {
    console.info(
      'Sample data is seeded by supabase/migrations, not by the app. ' +
      'Re-run the migration to restore configuration rows.'
    );
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

  // ---- Studio rooms and table stations ----
  const addStudioResource = async (resource: Omit<StudioResource, 'id'>) => {
    const id = `res-${Date.now()}`;
    await db.studioResources.add({
      ...resource,
      id,
      order: resource.order ?? studioResources.length,
      createdAt: new Date().toISOString()
    });
  };

  const updateStudioResource = async (id: string, updates: Partial<StudioResource>) => {
    await db.studioResources.update(id, { ...updates, updatedAt: new Date().toISOString() });
  };

  /**
   * Resources referenced by a saved session, event or workshop are deactivated
   * rather than deleted, so historical assignments stay readable.
   */
  const removeStudioResource = async (id: string) => {
    const resource = await db.studioResources.get(id);
    if (!resource) return { success: false, message: 'Resource not found' };

    const [sessions, events, workshops] = await Promise.all([
      db.workshopSessions.toArray(),
      db.events.toArray(),
      db.workshops.toArray()
    ]);

    const usedBySession = sessions.some(x => x.roomId === id || x.tableId === id);
    const usedByEvent = events.some(x => x.roomId === id || x.tableId === id);
    const usedByWorkshop = workshops.some(x => x.roomId === id || x.tableId === id);

    if (usedBySession || usedByEvent || usedByWorkshop) {
      await db.studioResources.update(id, { status: 'Inactive', updatedAt: new Date().toISOString() });
      return {
        success: true,
        deactivated: true,
        message: `"${resource.name}" is used by existing sessions, so it was set to Inactive instead of being deleted.`
      };
    }

    await db.studioResources.delete(id);
    return { success: true, deactivated: false };
  };

  // ---- Birthday packages (shared between Staff Console and customer site) ----
  const publishedBirthdayPackages = React.useMemo(
    () => birthdayPackages
      .filter(p => p.status === 'Published')
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)),
    [birthdayPackages]
  );

  const addBirthdayPackage = async (pkg: Omit<BirthdayPackage, 'id'>) => {
    const id = `bpkg-${Date.now()}`;
    await db.birthdayPackages.add({
      ...pkg,
      id,
      displayOrder: pkg.displayOrder ?? birthdayPackages.length,
      createdAt: new Date().toISOString()
    });
  };

  const updateBirthdayPackage = async (id: string, updates: Partial<BirthdayPackage>) => {
    await db.birthdayPackages.update(id, { ...updates, updatedAt: new Date().toISOString() });
  };

  const deleteBirthdayPackage = async (id: string) => {
    await db.birthdayPackages.delete(id);
  };

  const reorderBirthdayPackages = async (ordered: BirthdayPackage[]) => {
    for (let i = 0; i < ordered.length; i++) {
      await db.birthdayPackages.update(ordered[i].id, { displayOrder: i });
    }
  };

  // ---- Birthday booking-form fields (Settings → Events/Birthday only) ----
  const birthdayFieldsSetting = appSettings.find(s => s.id === 'birthdayFormFields')?.value;
  const birthdayFormFields: BirthdayFormField[] = React.useMemo(() => {
    if (Array.isArray(birthdayFieldsSetting) && birthdayFieldsSetting.length > 0) {
      return [...birthdayFieldsSetting].sort((a, b) => (a.order || 0) - (b.order || 0));
    }
    return DEFAULT_BIRTHDAY_FORM_FIELDS;
  }, [birthdayFieldsSetting]);

  // ---- Workshop card field configuration ----
  const workshopFieldsSetting = appSettings.find(s => s.id === 'workshopFieldConfig')?.value;
  const workshopFields: WorkshopFieldConfig[] = React.useMemo(() => {
    if (Array.isArray(workshopFieldsSetting) && workshopFieldsSetting.length > 0) {
      // Any core field missing from a stored configuration is restored, so the
      // Workshop form can never lose a field the data model depends on.
      const stored: WorkshopFieldConfig[] = [...workshopFieldsSetting];
      const keys = new Set(stored.map(f => f.fieldKey));
      const missing = DEFAULT_WORKSHOP_FIELDS.filter(f => !keys.has(f.fieldKey));
      return [...stored, ...missing];
    }
    return DEFAULT_WORKSHOP_FIELDS;
  }, [workshopFieldsSetting]);

  const updateWorkshopFields = async (fields: WorkshopFieldConfig[]) => {
    const stamped = fields.map(f => ({ ...f, updatedAt: new Date().toISOString() }));
    await updateSetting('workshopFieldConfig', stamped);
  };

  const updateBirthdayFormFields = async (fields: BirthdayFormField[]) => {
    const sorted = [...fields].map((f, idx) => ({ ...f, order: idx }));
    await updateSetting('birthdayFormFields', sorted);
  };

  // Determine if overall health check is passing
  useEffect(() => {
    const hasFailures = systemTests.some(t => t.status === 'failed');
    setTestsPassing(!hasFailures);
  }, [systemTests]);

  return (
    <AppContext.Provider value={{
      area, goToStaffLogin, viewCustomerSite, returnToStaffConsole,
      customerTab, setCustomerTab,
      adminTab, setAdminTab,
      pendingBooking, setPendingBooking,
      selectedBirthdayPackage, setSelectedBirthdayPackage,
      workshopsInitialCategory, setWorkshopsInitialCategory,
      currentUser, setCurrentUser,
      authScreen, setAuthScreen,
      registerCustomer, loginCustomer, claimCustomerAccount, changeCustomerPassword,
      requestPasswordReset, completePasswordReset, hasRecoverySession, recoveryLinkError,
      resetCustomerPassword, logoutCustomer,
      selectedWorkshopId, setSelectedWorkshopId,
      lastBookingCreated, setLastBookingCreated,
      editingWorkshopId, setEditingWorkshopId,
      selectedEventBookingId, setSelectedEventBookingId,
      settingsSection, setSettingsSection,
      todayDateStr, formattedTodayDate,
      getRelativeRiyadhDateStr, getRiyadhFormattedDate,
      workshops, bookings, queue, pieces, systemTests, notifications, events, workshopSessions,
      pipelineStages, staff, workshopOptions, eventOptions, categories, appSettings,
      rawWorkshops, rawEvents,
      loggingFields, updateLoggingFields,
      customers,
      currentStaff, staffAuthChecked, loginStaff, changeStaffPassword, logoutStaff, canAccessAdminPage,
      resolveCustomer,
      studioResources, addStudioResource, updateStudioResource, removeStudioResource,
      birthdayPackages, publishedBirthdayPackages,
      addBirthdayPackage, updateBirthdayPackage, deleteBirthdayPackage, reorderBirthdayPackages,
      workshopFields, updateWorkshopFields,
      birthdayFormFields, updateBirthdayFormFields,
      addWorkshop, updateWorkshop,
      addBooking, bookingError, clearBookingError: () => setBookingError(null),
      cancelBooking, updateBookingStatus,
      addCategoryIfMissing, assignBookingStaff, updateWorkshopSession, appendBookingTimeline,
      getFreshAssignmentSources, getFreshStaff,
      addQueueItem, addStaffNotification, updateQueueStatus, updateQueueItem, reorderQueue, returnQueueItemToWaiting,
      updatePieceStatus, addPiece, updatePiece, markNotificationAsRead, clearAllNotifications,
      runAllTests, toggleTestResult,
      isTestRunning, testProgress, testsPassing,
      addEvent, updateEvent, deleteEvent,
      addPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages,
      addCustomer, updateCustomer,
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
