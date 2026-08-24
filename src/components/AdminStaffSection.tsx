/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp, ProvisionStaffOutcome } from '../context/AppContext';
import { StaffMember, StaffTimeOff, StaffScheduleDayEntry, StaffWeeklyShift } from '../types';
import { isSuperAdmin } from '../utils/adminAccess';
import {
  Users, UserPlus, Calendar, Clock, CheckCircle2, AlertCircle, XCircle,
  Search, Filter, Edit3, Trash2, CalendarDays, Award, Phone, Mail,
  ChevronLeft, ChevronRight, Briefcase, Plus, UserCheck, Shield, Sparkles, RefreshCw
} from 'lucide-react';
import { checkStaffMemberAvailability } from '../utils/staffAvailabilityUtils';
import { buildStaffAssignmentMap, getUpcomingAssignments, describeInactiveWarning } from '../utils/staffAssignments';
import { validateStaffForm, staffStorageFields } from '../utils/validation';
import { WEEKDAYS, toDaySchedule, createShift, countScheduledDays } from '../utils/staffScheduleUtils';
import { getRiyadhDateString } from '../utils/dateUtils';
import { DateInput } from './DateInput';
import { matchesQuery } from '../utils/search';
import { TimePicker } from './ui/TimePicker';
import { normalizeDateString } from '../utils/timeUtils';
import { ConsoleModal } from './ui/ConsoleModal';
import { timeToMinutes } from '../utils/timeUtils';

/** One width for every time control, so the columns line up down the day list. */
const timeInputClass =
  'w-full min-w-0 rounded-lg border border-brand-clay bg-white px-2 py-1.5 text-xs font-semibold text-brand-charcoal';

export const AdminStaffSection: React.FC = () => {
  const {
    staff,
    workshops,
    workshopSessions,
    bookings,
    queue,
    events,
    todayDateStr,
    formattedTodayDate,
    setAdminTab,
    addStaffMember,
    updateStaffMember,
    birthdayPackages,
    currentStaff,
    provisionStaff,
} = useApp();

  /** Only a Super Admin may provision a staff account (audit finding C-3) — mirrors the same check AdminSettingsSection.tsx already uses for its own Super-Admin-only actions. The Edge Function re-verifies this server-side regardless. */
  const isCurrentUserSuperAdmin = isSuperAdmin(currentStaff);

  /** staffId -> true while a provision request for that row is in flight. */
  const [provisioningStaffId, setProvisioningStaffId] = useState<Record<string, boolean>>({});
  /** staffId -> the last outcome shown for that row, cleared at the start of each new attempt. */
  const [provisionOutcomes, setProvisionOutcomes] = useState<Record<string, { tone: 'success' | 'info' | 'error'; text: string }>>({});

  /**
   * Turns a ProvisionStaffOutcome into what the card shows. Leans on the
   * Edge Function's own message for every rejection reason — those are
   * already specific and PII-safe per audit finding C-3 (see logic.ts) — and
   * only adds the non-sensitive hasExistingCustomerRecord hint for the
   * identity_collision case, exactly as designed: no PII beyond what the
   * response already includes, and no "proceed anyway" action.
   */
  const describeProvisionOutcome = (outcome: ProvisionStaffOutcome) => {
    // Fully explicit if/else throughout — this project doesn't enable
    // strictNullChecks, under which an early-return-then-fall-through
    // pattern (`if (!x.success) return ...; return x.something;`) does not
    // reliably narrow a boolean-discriminated union; verified directly
    // against this exact tsconfig before writing it this way.
    if (outcome.kind === 'network_error') {
      return { tone: 'error' as const, text: `Could not reach the server — ${outcome.message}` };
    } else {
      const response = outcome.response;
      if (response.success === true) {
        return response.status === 'already-provisioned'
          ? { tone: 'info' as const, text: 'Already provisioned — this staff member is already linked to a sign-in account. Nothing was changed.' }
          : { tone: 'success' as const, text: 'Invite sent — this staff member can set their own password from the link emailed to their Work Email.' };
      } else {
        // Non-sensitive hint only for the collision case — per audit finding
        // C-3, never any PII beyond what contract.ts already includes.
        if (response.code === 'identity_collision') {
          return {
            tone: 'error' as const,
            text: response.message + (response.hasExistingCustomerRecord
              ? ' (That account also has an existing ARTY customer record.)'
              : '')
          };
        } else {
          return { tone: 'error' as const, text: response.message };
        }
      }
    }
  };

  const handleProvisionStaff = async (member: StaffMember) => {
    setProvisioningStaffId(prev => ({ ...prev, [member.id]: true }));
    setProvisionOutcomes(prev => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });

    const outcome = await provisionStaff(member.id);

    setProvisioningStaffId(prev => {
      const next = { ...prev };
      delete next[member.id];
      return next;
    });
    setProvisionOutcomes(prev => ({ ...prev, [member.id]: describeProvisionOutcome(outcome) }));
  };

  // Navigation / View Tabs inside Staff Section
  const [activeTab, setActiveTab] = useState<'roster' | 'calendar' | 'schedule'>('roster');
  /**
   * The view the user picked, or null when nothing is selected.
   *
   * Null is a real state rather than a stand-in for the default: after Clear
   * Filters none of the three tabs should look active, while the calendar still
   * has to draw something. `effectiveCalendarView` is what the range and the
   * navigation read; `calendarView` is only what the tabs highlight.
   */
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month' | null>('week');
  const effectiveCalendarView = calendarView ?? 'week';
  const [calendarDate, setCalendarDate] = useState<string>(todayDateStr);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Active selections (staff is always re-read from the live roster by id)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);

  // Form state for Add/Edit Staff
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  // Field-keyed messages from the shared validation layer.
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Partial<StaffMember>>({
    name: '',
    position: 'Instructor',
    phone: '',
    countryCode: '+966',
    email: '',
    status: 'Active',
    skills: ['Wheel Throwing'],
    weeklySchedule: {}, // Empty by default for new staff
    notes: '',
    canAssignWorkshops: true,
    canAssignPieces: true
  });

  // Time off form
  const [timeOffData, setTimeOffData] = useState<Omit<StaffTimeOff, 'id'>>({
    startDate: todayDateStr,
    endDate: todayDateStr,
    reason: 'Personal Vacation',
    status: 'Approved'
  });

  // Always resolve the open profile from the live roster so edits show immediately.
  const selectedStaff = useMemo(
    () => (selectedStaffId ? staff.find(s => s.id === selectedStaffId) || null : null),
    [staff, selectedStaffId]
  );

  /**
   * The window the calendar is showing.
   *
   * Computed once from the selected date and the view, rather than per staff
   * member inside the render. Both ends are inclusive `YYYY-MM-DD` strings, and
   * every assignment date is normalised before comparison — an assignment
   * stored as "2026-7-1" sorts before "2026-06-30" as a plain string, which is
   * why days and months were showing the wrong rows.
   */
  const calendarRange = useMemo(() => {
    // Nothing chosen at all — no view, no anchor date — is a real state, not a
    // default to invent a range for. Clear Filters lands here, and the section
    // then lists every assignment rather than silently filtering to this week.
    if (!calendarView && !calendarDate) return null;

    // The anchor. The view decides how it is read; the date itself never
    // changes when the view does, so switching never asks for it again.
    const base = calendarDate || todayDateStr;
    const [y, m, d] = base.split('-').map(Number);
    // Built from parts as a local date. Parsing "2026-08-20" as a string would
    // be read as UTC midnight and land on the 19th west of Greenwich, which is
    // how assignments end up one day out.
    const cur = new Date(y || 1970, (m || 1) - 1, d || 1);
    const toStr = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    if (effectiveCalendarView === 'day') {
      const day = toStr(cur);
      return {
        start: day,
        end: day,
        label: cur.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      };
    }

    if (effectiveCalendarView === 'week') {
      // Sunday through Saturday, containing the anchor whichever day it is.
      const sun = new Date(cur);
      sun.setDate(cur.getDate() - cur.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);

      // "16–22 Aug 2026" when the week sits in one month, and the longer
      // "28 Sep – 4 Oct 2026" only when it actually straddles two.
      const sameMonth = sun.getMonth() === sat.getMonth() && sun.getFullYear() === sat.getFullYear();
      const label = sameMonth
        ? `${sun.getDate()}–${sat.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `${sun.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${sat.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

      return { start: toStr(sun), end: toStr(sat), label };
    }

    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    // Day 0 of the next month is the last day of this one, leap years included.
    const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    return {
      start: toStr(first),
      end: toStr(last),
      label: cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    };
  }, [calendarDate, calendarView, effectiveCalendarView, todayDateStr]);

  /**
   * Whether anything is narrowing what the calendar shows.
   *
   * The roster search and status are included because this section renders the
   * same filtered staff list as the list tab — clearing here has to clear those
   * too, or rows would stay hidden with no visible reason.
   */
  const calendarFiltersActive =
    calendarDate !== '' ||
    calendarView !== null ||
    searchQuery.trim() !== '' ||
    statusFilter !== 'all';

  const clearCalendarFilters = () => {
    // The anchor is emptied rather than reset to today: with no view selected
    // either, the section has no range to apply and shows everything.
    setCalendarDate('');
    setCalendarView(null);
    setSearchQuery('');
    setStatusFilter('all');
  };

  /** Steps the selected date by one whole view unit in either direction. */
  const shiftCalendar = (direction: -1 | 1) => {
    // Stepping from the cleared state anchors on today and adopts a view, so
    // the arrows always move something visible.
    if (!calendarView) setCalendarView('day');
    const base = calendarDate || todayDateStr;
    const [y, m, d] = base.split('-').map(Number);
    const cur = new Date(y || 1970, (m || 1) - 1, d || 1);

    if (effectiveCalendarView === 'day') cur.setDate(cur.getDate() + direction);
    else if (effectiveCalendarView === 'week') cur.setDate(cur.getDate() + direction * 7);
    else cur.setMonth(cur.getMonth() + direction);

    setCalendarDate(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    );
  };

  // Filtered staff roster
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      // A staff record without a phone or an email is normal — reading the
      // fields directly threw on the first keystroke and blanked the page.
      const matchesSearch = matchesQuery(
        [member.name, member.position, member.phone, member.email, member.role],
        searchQuery
      );
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [staff, searchQuery, statusFilter]);

  // Shared assignment records — same source used by the availability checker.
  const assignmentSources = useMemo(
    // Bookings included: a staff member hosting a birthday is assigned then too.
    () => ({ staff, workshopSessions, workshops, events, bookings, birthdayPackages, queue }),
    [staff, workshopSessions, workshops, events, bookings, birthdayPackages, queue]
  );

  const staffAssignments = useMemo(
    () => buildStaffAssignmentMap(assignmentSources),
    [assignmentSources]
  );

  // Handle open Add Modal
  const handleOpenAdd = () => {
    setEditStaffId(null);
    setStaffErrors({});
    setFormData({
      name: '',
      position: 'Instructor',
      phone: '',
      countryCode: '+966',
      email: '',
      status: 'Active',
      skills: ['Wheel Throwing'],
      weeklySchedule: {}, // EMPTY BY DEFAULT for new staff
      notes: '',
      canAssignWorkshops: true,
      canAssignPieces: true
    });
    setShowAddEditModal(true);
  };

  // Handle open Edit Modal
  const handleOpenEdit = (member: StaffMember) => {
    setEditStaffId(member.id);
    setStaffErrors({});
    setFormData({ ...member });
    setShowAddEditModal(true);
  };

  /**
   * A shift that ends before it starts.
   *
   * The picker rules out malformed times, but not an impossible pair — 2 PM to
   * 10 AM is two valid times in the wrong order. Returned keyed by
   * `${day}-${index}` so the offending row can be marked as well as blocked.
   * Overnight shifts are not a case the studio has, so end === start is invalid
   * too: a zero-length shift would silently block every assignment that day.
   */
  const shiftTimeProblems = useMemo(() => {
    const problems: Record<string, string> = {};
    const schedule = formData.weeklySchedule || {};

    Object.entries(schedule).forEach(([day, entry]) => {
      // Older records store a single shift rather than a day object, so the
      // entry goes through the same normaliser the editor itself uses.
      const shifts = toDaySchedule(entry).shifts;

      shifts.forEach((shift, idx) => {
        const key = `${day}-${idx}`;
        const start = shift.startTime ? timeToMinutes(shift.startTime) : null;
        const end = shift.endTime ? timeToMinutes(shift.endTime) : null;

        // Equal counts as invalid: a zero-length shift would silently block
        // every assignment that day. Overnight shifts are not a case the studio
        // has, so no wrap-around is allowed for either.
        if (start !== null && end !== null && end <= start) {
          problems[key] = 'Shift end must be after its start.';
          return;
        }

        const breakStart = shift.breakStart ? timeToMinutes(shift.breakStart) : null;
        const breakEnd = shift.breakEnd ? timeToMinutes(shift.breakEnd) : null;

        // Both halves of a break, or neither — one alone has no meaning.
        if ((breakStart === null) !== (breakEnd === null)) {
          problems[key] = 'A break needs both a start and an end, or neither.';
          return;
        }

        if (breakStart !== null && breakEnd !== null) {
          if (breakEnd <= breakStart) {
            problems[key] = 'Break end must be after its start.';
            return;
          }
          if (start !== null && end !== null && (breakStart < start || breakEnd > end)) {
            problems[key] = 'The break must fall inside the shift.';
            return;
          }
        }
      });

      // Two shifts on one day may not cover the same minutes — the second one
      // would be unassignable and the availability check would read the overlap
      // as double capacity.
      shifts.forEach((shift, idx) => {
        if (problems[`${day}-${idx}`]) return;
        const start = shift.startTime ? timeToMinutes(shift.startTime) : null;
        const end = shift.endTime ? timeToMinutes(shift.endTime) : null;
        if (start === null || end === null) return;

        const clashes = shifts.some((other, otherIdx) => {
          if (otherIdx === idx || !other.startTime || !other.endTime) return false;
          const otherStart = timeToMinutes(other.startTime);
          const otherEnd = timeToMinutes(other.endTime);
          // Touching end-to-start is fine; only true overlap is a clash.
          return start < otherEnd && otherStart < end;
        });

        if (clashes) problems[`${day}-${idx}`] = 'This shift overlaps another shift on the same day.';
      });
    });

    return problems;
  }, [formData.weeklySchedule]);

  // Save Staff Record
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    // The same shared rules the Staff Registry uses, so both surfaces agree.
    const fieldErrors = await validateStaffForm(
      { name: formData.name, position: formData.position, phone: formData.phone, email: formData.email },
      editStaffId || undefined
    );
    setStaffErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    // The schedule is saved with the record, so an impossible shift has to stop
    // the save rather than being written and found later by availability code.
    if (Object.keys(shiftTimeProblems).length > 0) {
      window.alert('Please fix the highlighted working hours before saving:\n\n' +
        [...new Set(Object.values(shiftTimeProblems))].join('\n'));
      return;
    }

    const canonical = staffStorageFields({ phone: formData.phone, email: formData.email });

    if (editStaffId) {
      // Going Inactive/Former Staff while still holding upcoming sessions or
      // events would silently leave them without an instructor — warn before
      // saving, the same rule STF-03 checks in System Health.
      const previous = staff.find(s => s.id === editStaffId);
      const nextStatus = formData.status || previous?.status || 'Active';
      const held = getUpcomingAssignments(editStaffId, assignmentSources, todayDateStr);
      const warning = describeInactiveWarning(previous?.status, nextStatus, held);
      if (warning && !window.confirm(`${warning}\n\nSave anyway?`)) return;

      // Persist the edited record (including the schedule) to the shared data layer.
      await updateStaffMember(editStaffId, {
        ...formData,
        ...canonical,
        weeklySchedule: formData.weeklySchedule || {}
      });
    } else {
      await addStaffMember({
        name: formData.name || 'New Staff',
        position: formData.position || 'Instructor',
        phone: canonical.phone,
        normalizedPhone: canonical.normalizedPhone,
        countryCode: formData.countryCode || '+966',
        email: canonical.email,
        status: formData.status || 'Active',
        skills: formData.skills || [],
        // New staff members have no working hours until an admin adds them.
        weeklySchedule: formData.weeklySchedule || {},
        notes: formData.notes || '',
        canAssignWorkshops: formData.canAssignWorkshops ?? true,
        canAssignPieces: formData.canAssignPieces ?? true,
        createdAt: todayDateStr
      } as Omit<StaffMember, 'id'>);
    }

    setShowAddEditModal(false);
    setStaffErrors({});
  };

  // ---- Weekly schedule editing (multiple shifts per day supported) ----
  const updateDaySchedule = (day: string, mutate: (current: { isWorking: boolean; shifts: StaffWeeklyShift[] }) => { isWorking: boolean; shifts: StaffWeeklyShift[] } | null) => {
    const schedule: Record<string, StaffScheduleDayEntry> = { ...(formData.weeklySchedule || {}) };
    const next = mutate(toDaySchedule(schedule[day]));
    if (next === null || next.shifts.length === 0) {
      delete schedule[day];
    } else {
      schedule[day] = next;
    }
    setFormData({ ...formData, weeklySchedule: schedule });
  };

  const handleAddShift = (day: string) => {
    updateDaySchedule(day, current => ({
      isWorking: true,
      shifts: [...current.shifts, createShift({ startTime: '10:00 AM', endTime: '02:00 PM' })]
    }));
  };

  const handleUpdateShift = (day: string, index: number, updates: Partial<StaffWeeklyShift>) => {
    updateDaySchedule(day, current => ({
      isWorking: true,
      shifts: current.shifts.map((s, i) => (i === index ? { ...s, ...updates } : s))
    }));
  };

  const handleRemoveShift = (day: string, index: number) => {
    updateDaySchedule(day, current => ({
      isWorking: true,
      shifts: current.shifts.filter((_, i) => i !== index)
    }));
  };

  const handleClearDay = (day: string) => {
    updateDaySchedule(day, () => null);
  };

  // Add Time Off
  const handleSaveTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const newTimeOff: StaffTimeOff = {
      id: `to-${Date.now()}`,
      ...timeOffData
    };

    await updateStaffMember(selectedStaff.id, {
      timeOff: [...(selectedStaff.timeOff || []), newTimeOff],
      status: timeOffData.startDate <= todayDateStr && timeOffData.endDate >= todayDateStr ? 'On Leave' : selectedStaff.status
    });

    setShowTimeOffModal(false);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 min-w-0 text-left">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-brand-clay/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-brand-terracotta text-xs font-bold uppercase tracking-wider mb-1">
            <Users className="h-4 w-4" />
            <span>Staff Management & Rosters</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-brand-charcoal">
            Staff Console & Work Schedules
          </h1>
          <p className="text-xs font-semibold text-brand-charcoal/60 mt-1">
            Manage instructors, working hours, leave requests, and assignment availability in Riyadh local time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-brand-terracotta hover:bg-brand-terracotta-dark text-brand-cream rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add New Staff Member</span>
          </button>
        </div>
      </div>

      {/* SECTION TABS */}
      <div className="flex items-center justify-between border-b border-brand-clay pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'roster' 
                ? 'bg-brand-charcoal text-brand-cream shadow-xs' 
                : 'text-brand-charcoal/70 hover:bg-brand-sand/50'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Staff Roster ({staff.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'calendar' 
                ? 'bg-brand-charcoal text-brand-cream shadow-xs' 
                : 'text-brand-charcoal/70 hover:bg-brand-sand/50'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Schedule & Calendar View</span>
          </button>
        </div>

        {activeTab === 'roster' && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-brand-charcoal/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search staff name, role, email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-brand-clay rounded-xl text-xs font-semibold text-brand-charcoal placeholder-brand-charcoal/40 w-56"
              />
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-brand-clay rounded-xl py-1.5 px-3 text-xs font-semibold text-brand-charcoal"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
              <option value="Former Staff">Former Staff</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: ROSTER VIEW */}
      {activeTab === 'roster' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStaff.map(member => {
            const avail = checkStaffMemberAvailability({
              staff: member,
              date: todayDateStr,
              startTime: '04:00 PM',
              endTime: '06:00 PM',
              duration: '2.0 Hours',
              sources: assignmentSources
            });

            const assignments = staffAssignments.get(member.id) || [];
            const upcomingCount = assignments.filter(a => a.date >= todayDateStr).length;

            return (
              <div 
                key={member.id}
                className="bg-white border border-brand-clay rounded-2xl p-5 shadow-xs hover:border-brand-terracotta/40 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header Card */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-brand-sand flex items-center justify-center text-brand-terracotta font-bold text-lg overflow-hidden shrink-0 border border-brand-clay/60">
                        {member.profileImage ? (
                          <img src={member.profileImage} alt={member.name} className="h-full w-full object-cover" />
                        ) : (
                          member.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-brand-charcoal leading-tight">{member.name}</h3>
                        <p className="text-xs text-brand-terracotta font-semibold">{member.position}</p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      member.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                      member.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {member.status}
                    </span>
                  </div>

                  {/* Skills tags */}
                  {member.skills && member.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {member.skills.map((skill, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-brand-cream border border-brand-clay/60 rounded-md text-[10px] font-semibold text-brand-charcoal/70">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Contact details */}
                  <div className="space-y-1.5 text-xs text-brand-charcoal/70 mb-4 bg-brand-cream/50 p-3 rounded-xl border border-brand-clay/30">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-brand-terracotta shrink-0" />
                      <span>{member.countryCode || '+966'} {member.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-brand-terracotta shrink-0" />
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-brand-terracotta shrink-0" />
                      <span>{upcomingCount} Upcoming Assignments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-brand-terracotta shrink-0" />
                      <span className={avail.isAvailable ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {avail.isAvailable ? 'Available this afternoon' : avail.status}
                      </span>
                    </div>
                  </div>

                  {/* Provisioning (audit finding C-3): only shown while this
                      row has no linked Auth account. Once staff.user_id is
                      set, this block simply stops rendering — no separate
                      "provisioned" state to maintain. */}
                  {!member.userId && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-amber-800">
                        <Shield className="h-3.5 w-3.5 shrink-0" />
                        <span>Not yet provisioned — no linked sign-in account</span>
                      </div>

                      {provisionOutcomes[member.id] && (
                        <p className={`mt-2 text-[11px] font-semibold ${
                          provisionOutcomes[member.id].tone === 'success' ? 'text-emerald-700' :
                          provisionOutcomes[member.id].tone === 'info' ? 'text-brand-charcoal/70' :
                          'text-red-700'
                        }`}>
                          {provisionOutcomes[member.id].text}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => handleProvisionStaff(member)}
                        disabled={!isCurrentUserSuperAdmin || !!provisioningStaffId[member.id]}
                        title={isCurrentUserSuperAdmin ? undefined : 'Only a Super Admin can provision staff accounts.'}
                        className={`mt-2 w-full rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                          !isCurrentUserSuperAdmin
                            ? 'bg-brand-cream text-brand-charcoal/40 cursor-not-allowed'
                            : 'bg-brand-terracotta text-white hover:bg-brand-terracotta/90 cursor-pointer disabled:opacity-60 disabled:cursor-wait'
                        }`}
                      >
                        {provisioningStaffId[member.id] ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Provisioning…</span>
                          </>
                        ) : (
                          <>
                            <Shield className="h-3.5 w-3.5" />
                            <span>Provision Account</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Card footer actions */}
                <div className="pt-3 border-t border-brand-clay/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedStaffId(member.id);
                      setShowDetailModal(true);
                    }}
                    className="px-3 py-1.5 bg-brand-sand/50 hover:bg-brand-sand text-brand-charcoal rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>View Profile</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(member)}
                    className="p-1.5 hover:bg-brand-cream rounded-lg text-brand-charcoal/60 hover:text-brand-terracotta transition-all cursor-pointer"
                    title="Edit Staff Member"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CALENDAR VIEW */}
      {activeTab === 'calendar' && (
        <div className="bg-white border border-brand-clay rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-clay pb-4">
            <div>
              <h2 className="font-bold text-sm text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand-terracotta" />
                <span>Staff Assignments Schedule</span>
              </h2>
              <p className="text-xs text-brand-charcoal/60 font-semibold mt-0.5">
                Viewing assigned workshops and studio events in Riyadh time
              </p>
              {/* Says exactly what is on screen, so the view and the range can
                  never be read as disagreeing. */}
              <p className="mt-1 text-xs font-bold text-brand-terracotta">
                {calendarRange ? calendarRange.label : 'All scheduled assignments'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Steps by whichever unit is being viewed — a day, a week or a
                  month — so the arrows always move the visible range by one
                  screenful rather than always by a day. */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`Previous ${effectiveCalendarView}`}
                  onClick={() => shiftCalendar(-1)}
                  className="rounded-xl border border-brand-clay bg-white p-1.5 text-brand-charcoal transition-colors hover:bg-brand-sand/60 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Next ${effectiveCalendarView}`}
                  onClick={() => shiftCalendar(1)}
                  className="rounded-xl border border-brand-clay bg-white p-1.5 text-brand-charcoal transition-colors hover:bg-brand-sand/60 cursor-pointer"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <DateInput
                value={calendarDate}
                onChange={e => {
                  setCalendarDate(e.target.value);
                  // Choosing a date with no view selected would otherwise change
                  // nothing on screen. Day is the narrowest reading of "this
                  // date" and matches what picking one implies.
                  if (e.target.value && !calendarView) setCalendarView('day');
                }}
                className="bg-brand-cream/50 border border-brand-clay rounded-xl px-2.5 py-1 text-xs font-semibold text-brand-charcoal"
              />
              <div className="flex bg-brand-cream p-1 rounded-xl border border-brand-clay text-xs font-bold">
                {(['day', 'week', 'month'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setCalendarView(v)}
                    className={`px-3 py-1 rounded-lg capitalize cursor-pointer transition-all ${
                      calendarView === v ? 'bg-brand-terracotta text-brand-cream' : 'text-brand-charcoal/60 hover:text-brand-charcoal'
                    }`}
                  >
                    {v} View
                  </button>
                ))}
              </div>

              {/* Same control as the Bookings page: only shown when something
                  is actually filtering, so it never reads as an active state
                  of its own. Resets the date, the view and the roster filters
                  this section shares with the list tab. */}
              {calendarFiltersActive && (
                <button
                  type="button"
                  onClick={clearCalendarFilters}
                  className="text-xs font-bold text-brand-terracotta hover:underline ml-1 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-brand-clay/60 border border-brand-clay/60 rounded-xl overflow-hidden">
            {/* The same roster the list tab is showing, so the search and
                status filters apply here too instead of the two tabs
                disagreeing about who is on the team. */}
            {filteredStaff.map(member => {
              const assignments = staffAssignments.get(member.id) || [];
              // No range selected means no date filtering at all.
              const filteredAssignments = calendarRange
                ? assignments.filter(a => {
                    const date = normalizeDateString(a.date);
                    return !!date && date >= calendarRange.start && date <= calendarRange.end;
                  })
                : assignments;

              return (
                <div key={member.id} className="p-4 hover:bg-brand-cream/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-[200px]">
                    <div className="h-9 w-9 rounded-full bg-brand-terracotta/10 text-brand-terracotta font-bold flex items-center justify-center text-xs">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-brand-charcoal">{member.name}</p>
                      <p className="text-[10px] font-semibold text-brand-terracotta">{member.position}</p>
                    </div>
                  </div>

                  <div className="flex-1">
                    {filteredAssignments.length === 0 ? (
                      <span className="text-xs text-brand-charcoal/40 italic">No assignments scheduled for this period</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredAssignments.map(a => (
                          <div key={a.id} className="px-3 py-1.5 bg-brand-sand/60 border border-brand-clay rounded-xl text-xs flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-brand-terracotta" />
                              <span className="font-bold text-brand-charcoal">{a.date} ({a.startTime} – {a.endTime})</span>
                            </div>
                            <span className="font-semibold text-brand-charcoal/80 truncate max-w-[180px]">{a.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-white rounded border border-brand-clay/40 text-brand-sage font-bold">{a.location}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && selectedStaff && (
        <ConsoleModal
          maxWidth="max-w-2xl"
          onClose={() => setShowDetailModal(false)}
          title={
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-terracotta text-lg font-bold text-brand-cream">
                {selectedStaff.name.charAt(0)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-bold text-brand-charcoal">{selectedStaff.name}</span>
                <span className="block truncate text-xs font-semibold text-brand-terracotta">{selectedStaff.position}</span>
              </span>
            </span>
          }
          footer={
            <div className="flex w-full items-center justify-between gap-3">
              <button
                onClick={() => setShowTimeOffModal(true)}
                className="px-3.5 py-2 bg-brand-sand hover:bg-brand-sand/80 text-brand-charcoal rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Time Off / Leave</span>
              </button>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-brand-charcoal text-brand-cream rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >

            {/* Availability status */}
            <div className="bg-brand-cream border border-brand-clay rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-charcoal uppercase block">Today's Availability</span>
                <span className="text-xs text-brand-charcoal/70">Riyadh Local Time</span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                selectedStaff.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {selectedStaff.status}
              </span>
            </div>

            {/* Assigned Workshops & Events */}
            {(() => {
              const allAssignments = staffAssignments.get(selectedStaff.id) || [];
              const upcoming = allAssignments.filter(a => a.date >= todayDateStr);

              return (
                <div>
                  <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Upcoming Assignments</span>
                    <span className="text-[10px] text-brand-terracotta font-semibold">
                      {upcoming.length} upcoming · {allAssignments.length} total
                    </span>
                  </h3>
                  {/* Fixed height with the rest reached by scrolling — the
                      same shape the piece logging console's customer search
                      uses, so a heavily booked instructor cannot stretch the
                      modal. */}
                  <div className="max-h-56 space-y-2 overflow-y-auto always-scrollbar rounded-xl border border-brand-clay/60 bg-brand-cream/20 p-3">
                    {upcoming.length === 0 ? (
                      <p className="text-xs text-brand-charcoal/50 italic py-2 text-center">No upcoming workshops or events assigned to this staff member.</p>
                    ) : (
                      upcoming.map(a => (
                        <div key={a.id} className="p-2.5 bg-white rounded-lg border border-brand-clay/40 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-brand-charcoal">{a.title}</span>
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-brand-sand text-brand-charcoal rounded">{a.type}</span>
                            </div>
                            <p className="text-[11px] text-brand-charcoal/70 mt-0.5">
                              {a.date} • {a.startTime} – {a.endTime} ({a.location})
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Weekly Schedule Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider">Weekly Availability Schedule</h3>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenEdit(selectedStaff);
                  }}
                  className="text-xs font-bold text-brand-terracotta hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit Schedule</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-brand-clay/60 rounded-xl p-3 bg-brand-sand/10">
                {WEEKDAYS.map(day => {
                  const shifts = toDaySchedule(selectedStaff.weeklySchedule?.[day]).shifts;
                  return (
                    <div key={day} className="flex items-start justify-between text-xs p-1.5 border-b border-brand-clay/30 last:border-b-0 gap-2">
                      <span className="font-bold text-brand-charcoal w-24 shrink-0">{day}</span>
                      {shifts.length > 0 ? (
                        <span className="font-semibold text-emerald-800 text-right">
                          {shifts.map((s, i) => (
                            <span key={s.id || i} className="block">{s.startTime} – {s.endTime}</span>
                          ))}
                        </span>
                      ) : (
                        <span className="font-semibold text-gray-400 italic">Off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

        </ConsoleModal>
      )}

      {/* ADD / EDIT STAFF MODAL */}
      {showAddEditModal && (
        <ConsoleModal
          maxWidth="max-w-2xl"
          onClose={() => setShowAddEditModal(false)}
          onSubmit={handleSaveStaff}
          title={
            <>
              <UserCheck className="h-5 w-5 text-brand-terracotta" />
              <span>{editStaffId ? 'Edit Staff Member' : 'Add New Staff Member'}</span>
            </>
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 bg-brand-sand text-brand-charcoal rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-brand-terracotta hover:bg-brand-terracotta-dark text-brand-cream rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Save Staff Record
              </button>
            </>
          }
        >

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-brand-charcoal">
              <div>
                <label className="block mb-1 font-bold">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => {
                    setFormData({ ...formData, name: e.target.value });
                    setStaffErrors(prev => (prev.name ? { ...prev, name: '' } : prev));
                  }}
                  placeholder="e.g. Sara Al-Malki"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
                {staffErrors.name && <p className="text-[11px] text-red-500 font-bold mt-1">{staffErrors.name}</p>}
              </div>

              <div>
                <label className="block mb-1 font-bold">Position / Title *</label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={e => {
                    setFormData({ ...formData, position: e.target.value });
                    setStaffErrors(prev => (prev.position ? { ...prev, position: '' } : prev));
                  }}
                  placeholder="e.g. Master Instructor"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
                {staffErrors.position && <p className="text-[11px] text-red-500 font-bold mt-1">{staffErrors.position}</p>}
              </div>

              <div>
                <label className="block mb-1 font-bold">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={e => {
                    setFormData({ ...formData, phone: e.target.value });
                    setStaffErrors(prev => (prev.phone ? { ...prev, phone: '' } : prev));
                  }}
                  placeholder="50 123 4567"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
                {staffErrors.phone && <p className="text-[11px] text-red-500 font-bold mt-1">{staffErrors.phone}</p>}
              </div>

              <div>
                <label className="block mb-1 font-bold">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => {
                    setFormData({ ...formData, email: e.target.value });
                    setStaffErrors(prev => (prev.email ? { ...prev, email: '' } : prev));
                  }}
                  placeholder="staff@artycafe.com"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
                {staffErrors.email && <p className="text-[11px] text-red-500 font-bold mt-1">{staffErrors.email}</p>}
              </div>

              <div>
                <label className="block mb-1 font-bold">Employment Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5 font-semibold"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Former Staff">Former Staff</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-bold">Skills (comma separated)</label>
                <input
                  type="text"
                  value={formData.skills?.join(', ')}
                  onChange={e => setFormData({ ...formData, skills: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="Wheel, Handbuilding, Acrylic"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>
            </div>

            {/* WEEKLY SCHEDULE EDITOR */}
            <div className="pt-2 border-t border-brand-clay/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-xs text-brand-charcoal uppercase tracking-wider">
                  Weekly Schedule & Working Hours
                </label>
                <span className="text-[10px] text-brand-charcoal/60">
                  {countScheduledDays(formData.weeklySchedule) > 0
                    ? `${countScheduledDays(formData.weeklySchedule)} days configured`
                    : 'No working hours set (Empty schedule)'}
                </span>
              </div>

              <p className="text-[10px] text-brand-charcoal/50">
                Add a shift for each working day. A day can hold more than one shift (e.g. a morning and an evening shift).
                Days with no shift count as non-working and block assignments.
              </p>

              <div className="max-h-80 space-y-2 overflow-y-auto always-scrollbar rounded-xl border border-brand-clay/60 bg-brand-cream/30 p-3">
                {WEEKDAYS.map(day => {
                  const shifts = toDaySchedule(formData.weeklySchedule?.[day]).shifts;

                  return (
                    <div key={day} className="p-2 bg-white rounded-lg border border-brand-clay/40 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-brand-charcoal">{day}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddShift(day)}
                            className="text-[10px] font-bold text-brand-terracotta hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            <span>Add Shift</span>
                          </button>
                          {shifts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleClearDay(day)}
                              className="text-[10px] text-red-600 hover:underline font-bold cursor-pointer"
                            >
                              Clear Day
                            </button>
                          )}
                        </div>
                      </div>

                      {shifts.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic font-semibold">Off (No shift scheduled)</span>
                      ) : (
                        <div className="space-y-1.5">
                          {shifts.map((shift, idx) => (
                            /* Two labelled pairs on their own rows rather than
                               eight controls wrapping into each other — the
                               row used to reflow unpredictably at narrow
                               widths and the break inputs lost their label. */
                            <div
                              key={shift.id || idx}
                              className={`rounded-xl border p-2.5 space-y-2 ${
                                shiftTimeProblems[`${day}-${idx}`]
                                  ? 'border-red-400 bg-red-50/40'
                                  : 'border-brand-clay/60 bg-brand-cream/40'
                              }`}
                            >
                              {/* One grid for both rows, so the labels, the two
                                  time fields, the dash and the trailing action
                                  sit on the same four columns instead of each
                                  row laying itself out independently. */}
                              <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto_minmax(0,1fr)_5rem] items-center gap-x-2 gap-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-charcoal/50">
                                  Shift
                                </span>
                                <TimePicker
                                  ariaLabel={`${day} shift ${idx + 1} start time`}
                                  value={shift.startTime}
                                  onChange={val => handleUpdateShift(day, idx, { startTime: val })}
                                  invalid={!!shiftTimeProblems[`${day}-${idx}`]}
                                />
                                <span className="text-center font-bold text-brand-charcoal/40">–</span>
                                <TimePicker
                                  ariaLabel={`${day} shift ${idx + 1} end time`}
                                  value={shift.endTime}
                                  onChange={val => handleUpdateShift(day, idx, { endTime: val })}
                                  invalid={!!shiftTimeProblems[`${day}-${idx}`]}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveShift(day, idx)}
                                  className="justify-self-end text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                                >
                                  Remove
                                </button>

                                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-charcoal/50">
                                  Break
                                </span>
                                <TimePicker
                                  ariaLabel={`${day} shift ${idx + 1} break start`}
                                  value={shift.breakStart}
                                  onChange={val => handleUpdateShift(day, idx, { breakStart: val })}
                                  invalid={!!shiftTimeProblems[`${day}-${idx}`]}
                                  optional
                                />
                                <span className="text-center font-bold text-brand-charcoal/40">–</span>
                                <TimePicker
                                  ariaLabel={`${day} shift ${idx + 1} break end`}
                                  value={shift.breakEnd}
                                  onChange={val => handleUpdateShift(day, idx, { breakEnd: val })}
                                  invalid={!!shiftTimeProblems[`${day}-${idx}`]}
                                  optional
                                />
                                <span className="justify-self-end text-[10px] font-semibold text-brand-charcoal/35">
                                  optional
                                </span>
                              </div>

                              {shiftTimeProblems[`${day}-${idx}`] && (
                                <p className="text-[10px] font-bold text-red-600">
                                  {shiftTimeProblems[`${day}-${idx}`]}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

        </ConsoleModal>
      )}

      {/* RECORD TIME OFF MODAL */}
      {showTimeOffModal && selectedStaff && (
        /* Opened from the profile modal, so it needs the same portalled shell —
           left inline it would inherit the broken containing block again. */
        <ConsoleModal
          onClose={() => setShowTimeOffModal(false)}
          onSubmit={handleSaveTimeOff}
          title={<span className="truncate">Record Leave for {selectedStaff.name}</span>}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowTimeOffModal(false)}
                className="px-4 py-2 bg-brand-sand text-brand-charcoal rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-4 py-2 bg-brand-terracotta text-brand-cream rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Leave Record
              </button>
            </>
          }
        >

            <div className="space-y-3 text-xs font-semibold text-brand-charcoal">
              <div>
                <label className="block mb-1 font-bold">Start Date</label>
                <DateInput
                  required
                  value={timeOffData.startDate}
                  onChange={e => setTimeOffData({ ...timeOffData, startDate: e.target.value })}
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">End Date</label>
                <DateInput
                  required
                  value={timeOffData.endDate}
                  onChange={e => setTimeOffData({ ...timeOffData, endDate: e.target.value })}
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Reason</label>
                <input
                  type="text"
                  required
                  value={timeOffData.reason}
                  onChange={e => setTimeOffData({ ...timeOffData, reason: e.target.value })}
                  placeholder="e.g. Annual Leave, Medical Leave"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>
            </div>

        </ConsoleModal>
      )}

    </div>
  );
};
