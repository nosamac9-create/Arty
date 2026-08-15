/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StaffMember, StaffTimeOff, StaffScheduleDayEntry, StaffWeeklyShift } from '../types';
import {
  Users, UserPlus, Calendar, Clock, CheckCircle2, AlertCircle, XCircle,
  Search, Filter, Edit3, Trash2, CalendarDays, Award, Phone, Mail,
  ChevronLeft, ChevronRight, Briefcase, Plus, UserCheck, Shield, Sparkles
} from 'lucide-react';
import { checkStaffMemberAvailability } from '../utils/staffAvailabilityUtils';
import { buildStaffAssignmentMap, getUpcomingAssignments, describeInactiveWarning } from '../utils/staffAssignments';
import { validateStaffForm, staffStorageFields } from '../utils/validation';
import { WEEKDAYS, toDaySchedule, createShift, countScheduledDays } from '../utils/staffScheduleUtils';
import { getRiyadhDateString } from '../utils/dateUtils';
import { DateInput } from './DateInput';

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
} = useApp();

  // Navigation / View Tabs inside Staff Section
  const [activeTab, setActiveTab] = useState<'roster' | 'calendar' | 'schedule'>('roster');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
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

  // Filtered staff roster
  const filteredStaff = useMemo(() => {
    return staff.filter(member => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = 
        member.name.toLowerCase().includes(q) ||
        member.position.toLowerCase().includes(q) ||
        member.phone.includes(q) ||
        member.email.toLowerCase().includes(q);
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
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <DateInput
                value={calendarDate}
                onChange={e => setCalendarDate(e.target.value)}
                className="bg-brand-cream/50 border border-brand-clay rounded-xl px-2.5 py-1 text-xs font-semibold text-brand-charcoal"
              />
              <button
                onClick={() => setCalendarDate(todayDateStr)}
                className="px-2.5 py-1 bg-brand-sand hover:bg-brand-sand/80 text-brand-charcoal rounded-xl text-xs font-bold"
              >
                Today
              </button>

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
            </div>
          </div>

          <div className="divide-y divide-brand-clay/60 border border-brand-clay/60 rounded-xl overflow-hidden">
            {staff.map(member => {
              const assignments = staffAssignments.get(member.id) || [];
              let filteredAssignments = assignments;

              if (calendarView === 'day') {
                filteredAssignments = assignments.filter(a => a.date === calendarDate);
              } else if (calendarView === 'week') {
                // Parse as a local date so the week window is not shifted by UTC.
                const [y, m, d] = calendarDate.split('-').map(Number);
                const cur = new Date(y, (m || 1) - 1, d || 1);
                const sun = new Date(cur);
                sun.setDate(cur.getDate() - cur.getDay());
                const sat = new Date(sun);
                sat.setDate(sun.getDate() + 6);
                const toStr = (dt: Date) =>
                  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                const sunStr = toStr(sun);
                const satStr = toStr(sat);
                filteredAssignments = assignments.filter(a => a.date >= sunStr && a.date <= satStr);
              } else if (calendarView === 'month') {
                const prefix = calendarDate.substring(0, 7);
                filteredAssignments = assignments.filter(a => a.date.startsWith(prefix));
              }

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
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-brand-clay rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl text-left">
            <div className="flex items-start justify-between border-b border-brand-clay pb-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-brand-terracotta text-brand-cream font-bold text-xl flex items-center justify-center">
                  {selectedStaff.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-brand-charcoal">{selectedStaff.name}</h2>
                  <p className="text-xs text-brand-terracotta font-semibold">{selectedStaff.position}</p>
                </div>
              </div>

              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-1 hover:bg-brand-sand rounded-lg text-brand-charcoal/60"
              >
                ✕
              </button>
            </div>

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
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-brand-clay/60 rounded-xl p-3 bg-brand-cream/20">
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

            {/* Time off actions */}
            <div className="pt-2 flex justify-between items-center">
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
          </div>
        </div>
      )}

      {/* ADD / EDIT STAFF MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <form onSubmit={handleSaveStaff} className="bg-white border border-brand-clay rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl text-left">
            <h2 className="text-lg font-bold text-brand-charcoal border-b border-brand-clay pb-3">
              {editStaffId ? 'Edit Staff Member' : 'Add New Staff Member'}
            </h2>

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

              <div className="space-y-2 max-h-72 overflow-y-auto border border-brand-clay/60 rounded-xl p-3 bg-brand-cream/30">
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
                            <div key={shift.id || idx} className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={shift.startTime}
                                onChange={e => handleUpdateShift(day, idx, { startTime: e.target.value })}
                                placeholder="Start (e.g. 10:00 AM)"
                                className="w-24 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                              />
                              <span className="text-brand-charcoal/60 font-bold">–</span>
                              <input
                                type="text"
                                value={shift.endTime}
                                onChange={e => handleUpdateShift(day, idx, { endTime: e.target.value })}
                                placeholder="End (e.g. 02:00 PM)"
                                className="w-24 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                              />

                              <span className="text-[10px] font-bold text-brand-charcoal/50">Break</span>
                              <input
                                type="text"
                                value={shift.breakStart || ''}
                                onChange={e => handleUpdateShift(day, idx, { breakStart: e.target.value })}
                                placeholder="optional"
                                className="w-20 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                              />
                              <span className="text-brand-charcoal/60 font-bold">–</span>
                              <input
                                type="text"
                                value={shift.breakEnd || ''}
                                onChange={e => handleUpdateShift(day, idx, { breakEnd: e.target.value })}
                                placeholder="optional"
                                className="w-20 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                              />

                              <button
                                type="button"
                                onClick={() => handleRemoveShift(day, idx)}
                                className="text-[10px] text-red-600 hover:underline px-1 font-bold cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-brand-clay flex justify-end gap-3">
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
            </div>
          </form>
        </div>
      )}

      {/* RECORD TIME OFF MODAL */}
      {showTimeOffModal && selectedStaff && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <form onSubmit={handleSaveTimeOff} className="bg-white border border-brand-clay rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <h2 className="text-sm font-bold text-brand-charcoal uppercase tracking-wider border-b border-brand-clay pb-3">
              Record Leave for {selectedStaff.name}
            </h2>

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

            <div className="pt-3 border-t border-brand-clay flex justify-end gap-2">
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
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
