/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WorkshopSessionRecord {
  id: string; // e.g. "sess-10293"
  workshopId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "11:00 AM" or "16:00"
  endTime?: string;
  duration?: string;
  instructor?: string;
  staffId?: string;
  capacity: number;
  status: 'Published' | 'Cancelled' | 'Unavailable' | 'Unpublished';
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkshopSession {
  id: number | string;
  date: string;
  time: string;
  capacity: number;
  spotsLeft: number;
  isFull: boolean;
  status?: 'Published' | 'Cancelled' | 'Unavailable' | 'Unpublished';
  instructor?: string;
  staffId?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface RecurringScheduleRule {
  id: string;
  daysOfWeek: string[]; // e.g. ['Sunday', 'Tuesday']
  startTime: string; // e.g. "04:00 PM"
  endTime?: string; // e.g. "06:00 PM"
  duration?: string; // e.g. "2 hours"
  instructor: string;
  staffId?: string;
  capacity: number;
  room?: string;
  effectiveStartDate: string; // YYYY-MM-DD
  effectiveEndDate?: string; // YYYY-MM-DD
  status: 'Active' | 'Inactive';
}

export interface SessionException {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'cancel' | 'extra' | 'modify' | 'unavailable';
  startTime?: string;
  endTime?: string;
  instructor?: string;
  staffId?: string;
  capacity?: number;
  reason?: string;
}

export interface Workshop {
  id: string;
  title: string;
  slug: string;
  category: string;
  hook: string;
  description: string;
  fullDetails: string;
  duration: string; // e.g. "2 hours"
  ageRange: string; // e.g. "12+ years"
  price: number; // in SAR
  pricingType?: 'Per person' | 'Per pair' | 'Fixed price';
  capacity: number;
  spotsLeft: number;
  image: string;
  additionalImages?: string[];
  instructor: string;
  staffId?: string;
  room: string;
  materials: string[];
  whatWeProvide?: string[];
  instructions?: string;
  cancellationPolicy?: string;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  status?: 'Draft' | 'Published' | 'Archived';
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
  sessions?: WorkshopSession[] | WorkshopSessionRecord[];
  recurringSchedules?: RecurringScheduleRule[];
  sessionExceptions?: SessionException[];
}

export interface DraftBooking {
  workshopId: string;
  workshopTitle: string;
  date: string;
  time: string;
  participants: number;
  totalPrice: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface CustomerAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  source?: 'Website Registration' | 'Workshop Booking' | 'Event Booking' | 'Birthday Package' | 'Live Queue' | 'Admin Created' | 'Walk-in' | string;
  status?: 'Active' | 'VIP' | 'Inactive' | 'Blocked' | string;
  notes?: string;
  hasAccount?: boolean;
  createdAt: string;
  updatedAt?: string;
  totalSpent?: number;
}

export interface Booking {
  id: string; // Reference code e.g. "ART-93821"
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  workshopId: string;
  workshopTitle: string;
  date: string; // e.g. "2026-07-20"
  time: string; // e.g. "16:00"
  participants: number;
  totalPrice: number; // in SAR
  source: 'Website' | 'Walk-in' | 'Admin';
  status: 'Pending' | 'Checked In' | 'In Progress' | 'Completed' | 'Cancelled';
  paymentStatus: 'Paid' | 'Unpaid' | 'Refunded' | 'Deposit Paid';
  notes?: string;
  createdAt: string;
  timeline: { time: string; action: string }[];
}

export interface QueueItem {
  id: string; // e.g. "Q-034"
  bookingId?: string; // e.g. "ART-10293"
  name: string;
  phone: string;
  activity: string; // e.g. "Pottery Wheel Workshop" or "Walk-in Clay Play"
  participants: number;
  checkInTime: string; // e.g. "11:15 AM"
  elapsedMinutes: number;
  staffAvatar: string;
  staffName: string;
  status: 'Waiting' | 'Called' | 'In Progress' | 'Completed' | 'Cancelled';
  source: 'Website' | 'Walk-in' | 'Admin';
  type: 'With Instructor' | 'Without Instructor';
  hours?: number;
  workshopType?: 'Painting' | 'Wheel' | 'Pottery' | 'Handbuilding' | 'Other';
  date: string; // YYYY-MM-DD
  seatedTime?: string; // ISO string
  history: { status: 'Waiting' | 'Called' | 'In Progress' | 'Completed' | 'Cancelled'; timestamp: string }[];
}

export interface PotteryPiece {
  id: string; // e.g. "PC-8802"
  pieceCode?: string; // e.g. "AC-8802"
  name: string;
  workshopName: string;
  customerName: string;
  customerPhone: string;
  customerId?: string;
  dateCreated: string;
  image: string;
  status: 'Created' | 'Drying' | 'In Processing' | 'Glazing' | 'Firing' | 'Ready for Collection' | 'Collected';
  daysElapsed: number;
  assignedStaff: string;
  storageLocation?: string;
  notes?: string;
  additionalDescriptionGlazingNotes?: string;
  expectedCompletion?: string;
  expectedReadyDate?: string;
  history?: { status: string; timestamp: string; user: string; reason?: string }[];
  [key: string]: any;
}

export interface NotificationItem {
  id: string;
  type: 'customer' | 'staff';
  customerPhone?: string;
  title: string;
  message: string;
  pieceId?: string;
  pieceName?: string;
  newStatus?: string;
  performedBy?: string;
  timestamp: string;
  isRead: boolean;
  highlighted?: boolean;
}

export interface TestResult {
  id: string;
  name: string;
  category: 'Database' | 'Authentication' | 'Roles & Permissions' | 'Bookings & Capacity' | 'Queue' | 'Pieces' | 'Data Integrity' | 'Routes';
  description: string;
  duration: number; // ms
  status: 'passed' | 'failed' | 'skipped';
  expected?: string;
  actual?: string;
  failureMessage?: string;
}

import { getRelativeRiyadhDateStr } from './utils/dateUtils';

// Initial robust seed data
export const INITIAL_WORKSHOPS: Workshop[] = [
  {
    id: 'ws-1',
    title: 'Wheel Throwing Masterclass',
    slug: 'wheel-throwing-masterclass',
    category: 'Pottery',
    hook: 'Spin, mold, and fire your very first clay bowl on the potter’s wheel.',
    description: 'Learn the foundational techniques of wheel throwing from our expert ceramicists.',
    fullDetails: 'Perfect for complete beginners! In this 2.5-hour workshop, you will learn to center clay on the wheel, pull walls, and shape your own bowls or cups. We use premium local terracotta clay. After your piece dries, we glaze and fire it in our kiln, ready for pickup in 10-14 days.',
    duration: '2.5 Hours',
    ageRange: '16+ years',
    price: 320,
    capacity: 8,
    spotsLeft: 3,
    image: 'https://images.unsplash.com/photo-1565192647048-f997ded87958?auto=format&fit=crop&w=800&q=80',
    instructor: 'Ali bin Khalid',
    room: 'The Clay Station (Studio A)',
    materials: ['Terracotta Clay', 'Apron', 'Trimming Tools', 'Kiln Firing & Glazing'],
    skillLevel: 'Beginner',
    status: 'Published',
    sessions: [
      { id: 1, date: getRelativeRiyadhDateStr(0), time: '11:00 AM', capacity: 8, spotsLeft: 0, isFull: true },
      { id: 2, date: getRelativeRiyadhDateStr(1), time: '04:30 PM', capacity: 8, spotsLeft: 4, isFull: false },
      { id: 3, date: getRelativeRiyadhDateStr(2), time: '07:30 PM', capacity: 8, spotsLeft: 3, isFull: false }
    ]
  },
  {
    id: 'ws-2',
    title: 'Hand-Building Ceramics',
    slug: 'hand-building-ceramics',
    category: 'Pottery',
    hook: 'Pinch, coil, and slab-build beautiful plates and functional art pieces.',
    description: 'A meditative introduction to handcrafting pottery without a wheel.',
    fullDetails: 'Discover the ancient art of hand-building. You’ll learn pinching, coiling, and slab construction techniques to create customizable mugs, trinket dishes, or planters. Great for socializing and unleashing tactile creativity.',
    duration: '2.0 Hours',
    ageRange: '12+ years',
    price: 240,
    capacity: 12,
    spotsLeft: 5,
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80',
    instructor: 'Aisha Al-Jahdali',
    room: 'The Handcraft Lounge',
    materials: ['Stoneware Clay', 'Texture Stamps', 'Engobes & Glazes', 'Firing included'],
    skillLevel: 'Beginner',
    status: 'Published',
    sessions: [
      { id: 1, date: getRelativeRiyadhDateStr(0), time: '01:00 PM', capacity: 12, spotsLeft: 5, isFull: false }
    ]
  },
  {
    id: 'ws-3',
    title: 'Acrylic Landscape Painting',
    slug: 'acrylic-landscape-painting',
    category: 'Painting',
    hook: 'Capture the majestic beauty of AlUla landscapes on canvas.',
    description: 'A vibrant acrylic painting session guided step-by-step by local painters.',
    fullDetails: 'Bring the gorgeous warm colors of Saudi Arabia to life. Our artist will guide you in blending sunset hues, detailing sand dunes, and structuring rocks. No prior painting experience required. Sip specialty coffee and paint away!',
    duration: '3.0 Hours',
    ageRange: '14+ years',
    price: 280,
    capacity: 15,
    spotsLeft: 0, // Mark as fully booked/full to test disabled state
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=800&q=80',
    instructor: 'Faisal Al-Otaibi',
    room: 'The Canvas Atelier (Studio B)',
    materials: ['40x50cm Canvas', 'Artist-grade Acrylics', 'Brushes & Easel', 'Café Drink'],
    skillLevel: 'All Levels',
    status: 'Published',
    sessions: [
      { id: 1, date: getRelativeRiyadhDateStr(0), time: '06:00 PM', capacity: 15, spotsLeft: 0, isFull: true }
    ]
  },
  {
    id: 'ws-4',
    title: 'Kids Clay Creatures',
    slug: 'kids-clay-creatures',
    category: 'Kids',
    hook: 'Let your child’s imagination run wild with soft air-dry clay sculpting.',
    description: 'A playful and safe molding workshop designed especially for little hands.',
    fullDetails: 'A high-energy, fun-filled class where kids learn basic sculpting, pinching, and painting. They will make colorful dinosaurs, fairy houses, or friendly monsters to take home on the same day!',
    duration: '1.5 Hours',
    ageRange: '6-11 years',
    price: 180,
    capacity: 10,
    spotsLeft: 8,
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
    instructor: 'Sara Al-Malki',
    room: 'Kids Creative Corner',
    materials: ['Safe Air-Dry Clay', 'Kid-friendly Clay Tools', 'Acrylic paints', 'Kids juice box'],
    skillLevel: 'Beginner',
    status: 'Published',
    sessions: [
      { id: 1, date: getRelativeRiyadhDateStr(1), time: '10:00 AM', capacity: 10, spotsLeft: 8, isFull: false }
    ]
  },
  {
    id: 'ws-5',
    title: 'Couples Pottery & Coffee Date',
    slug: 'couples-pottery-coffee',
    category: 'Couples',
    hook: 'A romantic evening of joint-throwing and artisanal Jeddah coffee.',
    description: 'Create memorable matching coffee mugs alongside your significant other.',
    fullDetails: 'Designed for pairs! Work together on adjacent potter wheels. Learn to center clay and help each other shape matching coffee mugs. Each ticket includes professional instruction, clay for two, firing services, and two premium specialty hot drinks from our espresso bar.',
    duration: '2.5 Hours',
    ageRange: '18+ years',
    price: 550, // Per couple
    capacity: 6, // 6 couples
    spotsLeft: 2,
    image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
    instructor: 'Ali bin Khalid',
    room: 'The Clay Station (Studio A)',
    materials: ['Double portion Clay', 'Mug Trimming Tools', 'Underglazes', '2 Specialty Coffees'],
    skillLevel: 'All Levels',
    status: 'Published',
    sessions: [
      { id: 1, date: getRelativeRiyadhDateStr(0), time: '06:00 PM', capacity: 6, spotsLeft: 2, isFull: false }
    ]
  }
];

export const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 'ART-82941',
    customerName: 'Noura Al-Amri',
    customerEmail: 'noura.amri@outlook.com',
    customerPhone: '+966 50 123 4567',
    workshopId: 'ws-1',
    workshopTitle: 'Wheel Throwing Masterclass',
    date: getRelativeRiyadhDateStr(0),
    time: '16:00',
    participants: 2,
    totalPrice: 640,
    source: 'Website',
    status: 'Pending',
    paymentStatus: 'Paid',
    createdAt: `${getRelativeRiyadhDateStr(-1)} 14:32`,
    timeline: [
      { time: '14:32', action: 'Booking created on website' },
      { time: '14:33', action: 'Online payment captured successfully' }
    ]
  },
  {
    id: 'ART-10394',
    customerName: 'Yasser Qahtani',
    customerEmail: 'yasser@qahtani.sa',
    customerPhone: '+966 54 987 6543',
    workshopId: 'ws-2',
    workshopTitle: 'Hand-Building Ceramics',
    date: getRelativeRiyadhDateStr(0),
    time: '11:00',
    participants: 1,
    totalPrice: 240,
    source: 'Walk-in',
    status: 'Checked In',
    paymentStatus: 'Paid',
    createdAt: `${getRelativeRiyadhDateStr(0)} 10:45`,
    timeline: [
      { time: '10:45', action: 'Walk-in booking created at front desk' },
      { time: '10:45', action: 'Payment completed via POS (Credit Card)' },
      { time: '10:50', action: 'Customer checked in and directed to The Handcraft Lounge' }
    ]
  },
  {
    id: 'ART-99201',
    customerName: 'Sarah Johansson',
    customerEmail: 'sarah.j@gmail.com',
    customerPhone: '+966 56 111 2222',
    workshopId: 'ws-3',
    workshopTitle: 'Acrylic Landscape Painting',
    date: getRelativeRiyadhDateStr(0),
    time: '18:00',
    participants: 3,
    totalPrice: 840,
    source: 'Website',
    status: 'Pending',
    paymentStatus: 'Paid',
    createdAt: `${getRelativeRiyadhDateStr(-2)} 09:12`,
    timeline: [
      { time: '09:12', action: 'Booking created on website' },
      { time: '09:13', action: 'Online payment captured' }
    ]
  },
  {
    id: 'ART-77210',
    customerName: 'Mohammed Al-Saeed',
    customerEmail: 'm.saeed@gmail.com',
    customerPhone: '+966 55 444 5555',
    workshopId: 'ws-1',
    workshopTitle: 'Wheel Throwing Masterclass',
    date: getRelativeRiyadhDateStr(2),
    time: '16:00',
    participants: 1,
    totalPrice: 320,
    source: 'Admin',
    status: 'Pending',
    paymentStatus: 'Unpaid',
    notes: 'Requested back-row seat if possible. Needs to pay at the counter.',
    createdAt: `${getRelativeRiyadhDateStr(0)} 08:30`,
    timeline: [
      { time: '08:30', action: 'Admin created draft booking' }
    ]
  }
];

export const INITIAL_QUEUE: QueueItem[] = [
  {
    id: 'Q-001',
    bookingId: 'ART-10293',
    name: 'Abdulrahman Al-Fassi',
    phone: '+966 50 222 3333',
    activity: 'Wheel Throwing Masterclass',
    participants: 2,
    checkInTime: '10:30 AM',
    elapsedMinutes: 22,
    staffAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
    staffName: 'Ali bin Khalid',
    status: 'Waiting',
    source: 'Website',
    type: 'With Instructor',
    workshopType: 'Wheel',
    date: getRelativeRiyadhDateStr(0),
    history: [
      { status: 'Waiting', timestamp: new Date().toISOString() }
    ]
  },
  {
    id: 'Q-002',
    name: 'Fatima Al-Harbi',
    phone: '+966 53 444 8888',
    activity: 'Walk-in Clay Play',
    participants: 1,
    checkInTime: '10:42 AM',
    elapsedMinutes: 10,
    staffAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    staffName: 'Self-guided',
    status: 'Waiting',
    source: 'Walk-in',
    type: 'Without Instructor',
    hours: 2,
    date: getRelativeRiyadhDateStr(0),
    history: [
      { status: 'Waiting', timestamp: new Date().toISOString() }
    ]
  },
  {
    id: 'Q-003',
    name: 'Yasser Qahtani',
    phone: '+966 54 987 6543',
    activity: 'Hand-Building Ceramics',
    participants: 1,
    checkInTime: '10:45 AM',
    elapsedMinutes: 7,
    staffAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    staffName: 'Self-guided',
    status: 'In Progress',
    source: 'Walk-in',
    type: 'Without Instructor',
    hours: 1,
    date: getRelativeRiyadhDateStr(0),
    seatedTime: new Date().toISOString(),
    history: [
      { status: 'Waiting', timestamp: new Date().toISOString() },
      { status: 'In Progress', timestamp: new Date().toISOString() }
    ]
  }
];

export const INITIAL_PIECES: PotteryPiece[] = [
  {
    id: 'PC-201',
    name: 'Turquoise Ribbed Mug',
    workshopName: 'Wheel Throwing Masterclass',
    customerName: 'Rania Al-Sharif',
    customerPhone: '+966 50 112 3344',
    dateCreated: '2026-07-05',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=200&q=80',
    status: 'Ready for Collection',
    daysElapsed: 14,
    assignedStaff: 'Ali Khalid',
    storageLocation: 'Shelf C-12',
    notes: 'Beautiful glaze finish. Handle is well attached.'
  },
  {
    id: 'PC-202',
    name: 'Sage Green Bowl',
    workshopName: 'Hand-Building Ceramics',
    customerName: 'Yousef Al-Ghamdi',
    customerPhone: '+966 54 888 7777',
    dateCreated: '2026-07-12',
    image: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=200&q=80',
    status: 'Firing',
    daysElapsed: 7,
    assignedStaff: 'Aisha Al-Jahdali',
    storageLocation: 'Kiln Room 2',
    notes: 'Secondary firing in progress.'
  },
  {
    id: 'PC-203',
    name: 'Miniature Cactus Planter',
    workshopName: 'Kids Clay Creatures',
    customerName: 'Talal Al-Amri',
    customerPhone: '+966 50 123 4567',
    dateCreated: '2026-07-18',
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=200&q=80',
    status: 'Created',
    daysElapsed: 1,
    assignedStaff: 'Sara Al-Malki',
    storageLocation: 'Drying Rack B',
    notes: 'Air drying. Delicate features.'
  },
  {
    id: 'PC-204',
    name: 'Symmetrical Terracotta Pitcher',
    workshopName: 'Wheel Throwing Masterclass',
    customerName: 'Bassem Yamani',
    customerPhone: '+966 55 999 1111',
    dateCreated: '2026-07-02',
    image: 'https://images.unsplash.com/photo-1565192647048-f997ded87958?auto=format&fit=crop&w=200&q=80',
    status: 'Ready for Collection',
    daysElapsed: 17,
    assignedStaff: 'Ali Khalid',
    storageLocation: 'Shelf C-03',
    notes: 'Slightly heavy base, but gorgeous organic rim.'
  },
  {
    id: 'PC-205',
    name: 'Abstract Paint Canvas (Sealed)',
    workshopName: 'Acrylic Landscape Painting',
    customerName: 'Hessa Al-Subaie',
    customerPhone: '+966 56 222 3344',
    dateCreated: '2026-07-15',
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=200&q=80',
    status: 'Collected',
    daysElapsed: 4,
    assignedStaff: 'Faisal Al-Otaibi',
    storageLocation: 'Delivered',
    notes: 'Customer extremely pleased!'
  }
];

export const SYSTEM_TESTS: TestResult[] = [
  { id: 't-1', name: 'Database Connectivity Check', category: 'Database', description: 'Verifies the application can establish a secure, low-latency connection to the Firestore instance.', duration: 18, status: 'passed' },
  { id: 't-2', name: 'Auth Key Signing', category: 'Authentication', description: 'Tests JWT token encoding, decoding, and salt rotations for secure client authentication sessions.', duration: 32, status: 'passed' },
  { id: 't-3', name: 'Access Controls on Firing Kilns', category: 'Roles & Permissions', description: 'Ensures only validated staff and admin profiles can shift statuses to "Firing" or "Collected".', duration: 12, status: 'passed' },
  { id: 't-4', name: 'Double Booking Prevention Race Condition', category: 'Bookings & Capacity', description: 'Simulates 5 concurrent requests attempting to purchase the last spot in a pottery wheel masterclass.', duration: 145, status: 'passed' },
  { id: 't-5', name: 'Waitlist Automation Overflow', category: 'Queue', description: 'Tests if live queue cards properly re-index and trigger SMS notifications when position changes.', duration: 48, status: 'passed' },
  { id: 't-6', name: 'Pottery Firing Timeline Integrity', category: 'Pieces', description: 'Validates days-elapsed logic and prevents skipping critical stages (e.g. going straight from Created to Ready).', duration: 14, status: 'passed' },
  { id: 't-7', name: 'Check-in POS Sync', category: 'Database', description: 'Ensures checked-in bookings sync instantly with the tablet dashboard without manual pull refresh.', duration: 24, status: 'passed' },
  { id: 't-8', name: 'Date-Strip Available Slot Checker', category: 'Routes', description: 'Verifies the mobile date-strip calculations properly mark dates with available workshops.', duration: 9, status: 'passed' },
  { id: 't-9', name: 'Jeddah SMS Country Prefix Parser', category: 'Data Integrity', description: 'Fails if telephone field fails to format +966 inputs correctly into E.164 standard.', duration: 11, status: 'passed' },
  { id: 't-10', name: 'Vite Production Build Artifact Integrity', category: 'Routes', description: 'Ensures all compiled script modules have correctly resolved entry-points.', duration: 124, status: 'passed' }
];

export interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  visibleToCustomer: boolean;
}

export interface StaffWeeklyShift {
  isWorking: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface StaffTimeOff {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Approved' | 'Pending' | 'Rejected';
}

export interface StaffMember {
  id: string;
  name: string;
  profileImage?: string;
  countryCode?: string;
  phone: string;
  email: string;
  position: string;
  skills?: string[];
  status: 'Active' | 'On Leave' | 'Inactive' | 'Former Staff';
  weeklySchedule?: Record<string, StaffWeeklyShift>; // Key: 'Sunday', 'Monday', etc.
  breakPeriods?: { name: string; startTime: string; endTime: string }[];
  timeOff?: StaffTimeOff[];
  notes?: string;
  canAssignWorkshops?: boolean;
  canAssignPieces?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudioTableConfig {
  id: string;
  name: string; // e.g. "Table 1"
  seats: number;
  status: 'Active' | 'Inactive' | 'Maintenance';
}

export interface CapacitySettingsConfig {
  totalTables: number;
  totalSeats: number;
  defaultSeatsPerTable: number;
  maxGroupSize: number;
  oneGroupPerTable: boolean;
  tables: StudioTableConfig[];
}

export interface EventsSettingsConfig {
  minimumBirthdayBookingDays?: number;
  minBirthdayNoticeDays?: number;
  maxBirthdayGuests?: number;
  maxGuestsPerEvent?: number;
  depositPercentage?: number;
  cancellationNoticeDays?: number;
}

export interface WorkshopOption {
  id: string;
  type: 'skillLevel' | 'category' | 'workshopType' | 'room' | 'material';
  value: string;
  order: number;
}

export interface EventOption {
  id: string;
  type: 'eventCategory' | 'eventType' | 'location' | 'host';
  value: string;
  order: number;
}

export interface AppSetting {
  id: string;
  value: any;
}

export interface LoggingConsoleField {
  id: string;
  key: string;
  label: string;
  type: 'short_text' | 'long_text' | 'number' | 'date' | 'dropdown' | 'multi_select' | 'customer' | 'staff' | 'workshop' | 'status' | 'piece_code' | 'image';
  placeholder?: string;
  required: boolean;
  enabled: boolean;
  order: number;
  options?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_LOGGING_FIELDS: LoggingConsoleField[] = [
  {
    id: 'f_customer',
    key: 'customer',
    label: '1. Customer / Ceramic Owner',
    type: 'customer',
    placeholder: 'Type customer name to search existing...',
    required: true,
    enabled: true,
    order: 1
  },
  {
    id: 'f_workshop',
    key: 'workshop',
    label: '2. Workshop / Class Origin (Optional)',
    type: 'workshop',
    placeholder: 'Select workshop or freestyle',
    required: false,
    enabled: true,
    order: 2
  },
  {
    id: 'f_piece_type',
    key: 'pieceType',
    label: '3. Pottery Piece Type',
    type: 'dropdown',
    placeholder: 'Select piece type',
    required: false,
    enabled: true,
    order: 3,
    options: ['Mug', 'Bowl', 'Plate', 'Vase', 'Sculpture', 'Other']
  },
  {
    id: 'f_glazing_notes',
    key: 'additionalDescriptionGlazingNotes',
    label: '4. Additional Description / Glazing Notes',
    type: 'long_text',
    placeholder: 'Add optional piece details, glazing colour requests, finishing instructions, or other notes…',
    required: false,
    enabled: true,
    order: 4
  },
  {
    id: 'f_piece_code',
    key: 'pieceCode',
    label: '5. Piece Code',
    type: 'piece_code',
    placeholder: 'e.g. AC-8802',
    required: true,
    enabled: true,
    order: 5
  },
  {
    id: 'f_image',
    key: 'image',
    label: '6. Photo Capture & Preview',
    type: 'image',
    placeholder: '',
    required: false,
    enabled: true,
    order: 6
  },
  {
    id: 'f_name',
    key: 'name',
    label: '7. Piece Label / Title',
    type: 'short_text',
    placeholder: 'E.g. Turquoise Ribbed Tea Mug',
    required: true,
    enabled: true,
    order: 7
  },
  {
    id: 'f_date_created',
    key: 'dateCreated',
    label: '8. Creation Date',
    type: 'date',
    placeholder: '',
    required: true,
    enabled: true,
    order: 8
  },
  {
    id: 'f_assigned_staff',
    key: 'assignedStaff',
    label: '9. Assigned Staff Member',
    type: 'staff',
    placeholder: 'Select staff member',
    required: false,
    enabled: true,
    order: 9
  },
  {
    id: 'f_status',
    key: 'status',
    label: '10. Initial Lifecycle Status',
    type: 'status',
    placeholder: '',
    required: true,
    enabled: true,
    order: 10
  },
  {
    id: 'f_storage_location',
    key: 'storageLocation',
    label: '11. Storage Location / Shelf',
    type: 'short_text',
    placeholder: 'e.g. Shelf A-1',
    required: false,
    enabled: true,
    order: 11
  },
  {
    id: 'f_expected_ready_date',
    key: 'expectedReadyDate',
    label: '12. Expected Ready Date',
    type: 'date',
    placeholder: '',
    required: false,
    enabled: true,
    order: 12
  }
];

export interface AppEvent {
  id: string;
  title: string;
  category: string;
  eventType: string;
  shortDescription: string;
  fullDetails: string;
  image: string;
  date: string;
  startTime: string;
  duration: string;
  capacity: number;
  spotsLeft: number;
  price: number;
  host: string;
  staffId?: string;
  location: string;
  ageRequirement: string;
  skillLevel: string;
  status: 'Draft' | 'Published' | 'Fully Booked' | 'Cancelled' | 'Completed' | 'Archived';
}

export const INITIAL_EVENTS: AppEvent[] = [
  {
    id: 'evt-1',
    title: 'Jeddah Sunset Clay & Jazz Night',
    category: 'Socials',
    eventType: 'Clay & Jazz',
    shortDescription: 'Unique sunset clay sculpting and live acoustic jazz performance.',
    fullDetails: 'Join us for an unforgettable evening at Arty Café Jeddah! Mold clay with professional ceramicists while enjoying smooth sunset jazz vibes. No experience required. Each ticket includes terracotta clay, glazing service, and one hot café beverage.',
    image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80',
    date: getRelativeRiyadhDateStr(0),
    startTime: '07:30 PM',
    duration: '2.5 Hours',
    capacity: 20,
    spotsLeft: 4,
    price: 350,
    host: 'Studio Manager Lina',
    location: 'The Terrace',
    ageRequirement: '16+ years',
    skillLevel: 'All Levels',
    status: 'Published'
  },
  {
    id: 'evt-2',
    title: 'Coffee Mug Glazing Masterclass',
    category: 'Masterclass',
    eventType: 'Glazing Party',
    shortDescription: 'Master the chemistry of dipping, brushing, and splashing professional ceramic glazes.',
    fullDetails: 'Take your hand-built or wheel-thrown mugs to the next level. In this deep-dive glazing session, you will learn the secrets of wax resist, glaze layering, bubble glazing, and gradient finishes. Includes 2 practice bisque-fired cups and professional-grade glazes.',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80',
    date: getRelativeRiyadhDateStr(4),
    startTime: '04:00 PM',
    duration: '2.5 Hours',
    capacity: 15,
    spotsLeft: 5,
    price: 280,
    host: 'Guest Artist Faisal',
    location: 'Studio A',
    ageRequirement: '12+ years',
    skillLevel: 'Intermediate',
    status: 'Published'
  }
];

