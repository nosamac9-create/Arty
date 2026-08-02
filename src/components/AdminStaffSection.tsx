/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StaffMember, StaffWeeklyShift, StaffTimeOff } from '../types';
import { 
  Users, UserPlus, Calendar, Clock, CheckCircle2, AlertCircle, XCircle, 
  Search, Filter, Edit3, Trash2, CalendarDays, Award, Phone, Mail, 
  ChevronLeft, ChevronRight, Briefcase, Plus, UserCheck, Shield, Sparkles
} from 'lucide-react';
import { checkStaffMemberAvailability, minutesToTimeString, timeToMinutes, getEndTimeMinutes } from '../utils/staffAvailabilityUtils';
import { getRiyadhDateString } from '../utils/dateUtils';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_SHIFT: StaffWeeklyShift = {
  isWorking: true,
  startTime: '10:00 AM',
  endTime: '06:00 PM',
  breakStart: '01:00 PM',
  breakEnd: '02:00 PM'
};

export const AdminStaffSection: React.FC = () => {
  const { 
    staff, 
    workshops, 
    bookings, 
    queue, 
    events, 
    todayDateStr, 
    formattedTodayDate,
    setAdminTab
  } = useApp();

  // Navigation / View Tabs inside Staff Section
  const [activeTab, setActiveTab] = useState<'roster' | 'calendar' | 'schedule'>('roster');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState<string>(todayDateStr);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals & Active selections
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);

  // Form state for Add/Edit Staff
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
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

  // Derived assignments across workshops, events, etc.
  const staffAssignments = useMemo(() => {
    const map = new Map<string, Array<{
      id: string;
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      type: 'Workshop Session' | 'Event' | 'Queue Duty';
      location: string;
    }>>();

    staff.forEach(s => map.set(s.id, []));

    // Scan workshops sessions
    workshops.forEach(ws => {
      if (ws.sessions && Array.isArray(ws.sessions)) {
        ws.sessions.forEach(sess => {
          if (sess.status === 'Cancelled' || sess.status === 'Unavailable' || (sess as any).status === 'Archived') return;
          const sName = (sess.instructor || ws.instructor || '').trim().toLowerCase();
          const sStaffId = sess.staffId || ws.staffId;
          const matchStaff = staff.find(st => st.id === sStaffId || st.name.trim().toLowerCase() === sName);
          if (matchStaff) {
            const list = map.get(matchStaff.id) || [];
            const startTime = 'startTime' in sess && sess.startTime ? sess.startTime : ((sess as any).time || '10:00 AM');
            const endMins = (sess as any).endTime ? timeToMinutes((sess as any).endTime) : getEndTimeMinutes(startTime, ws.duration || '2 Hours');
            const endTime = (sess as any).endTime || minutesToTimeString(endMins);

            list.push({
              id: `ws-${ws.id}-${sess.id}`,
              title: ws.title,
              date: sess.date,
              startTime,
              endTime,
              type: 'Workshop Session',
              location: ws.room || 'Studio A'
            });
            map.set(matchStaff.id, list);
          }
        });
      }
    });

    // Scan Events
    events.forEach(evt => {
      if (evt.status === 'Cancelled' || evt.status === 'Archived') return;
      const hostName = (evt.host || '').trim().toLowerCase();
      const hostStaffId = evt.staffId;
      const matchStaff = staff.find(st => st.id === hostStaffId || st.name.trim().toLowerCase() === hostName);
      if (matchStaff) {
        const list = map.get(matchStaff.id) || [];
        const startTime = evt.startTime || '10:00 AM';
        const endMins = getEndTimeMinutes(startTime, evt.duration || '2 Hours');
        const endTime = minutesToTimeString(endMins);

        list.push({
          id: `evt-${evt.id}`,
          title: evt.title,
          date: evt.date,
          startTime,
          endTime,
          type: 'Event',
          location: evt.location || 'The Terrace'
        });
        map.set(matchStaff.id, list);
      }
    });

    return map;
  }, [staff, workshops, events]);

  // Handle open Add Modal
  const handleOpenAdd = () => {
    setEditStaffId(null);
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
    setFormData({ ...member });
    setShowAddEditModal(true);
  };

  // Save Staff Record
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;

    if (editStaffId) {
      // Edit existing in Dexie
      const { db } = await import('../db');
      await db.staff.update(editStaffId, {
        ...formData,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Add new to Dexie
      const { db } = await import('../db');
      const newId = `staff-${Date.now()}`;
      await db.staff.add({
        id: newId,
        name: formData.name || 'New Staff',
        position: formData.position || 'Instructor',
        phone: formData.phone || '',
        countryCode: formData.countryCode || '+966',
        email: formData.email || '',
        status: formData.status || 'Active',
        skills: formData.skills || ['Wheel Throwing'],
        weeklySchedule: formData.weeklySchedule || {},
        notes: formData.notes || '',
        canAssignWorkshops: formData.canAssignWorkshops ?? true,
        canAssignPieces: formData.canAssignPieces ?? true,
        createdAt: todayDateStr
      } as StaffMember);
    }

    setShowAddEditModal(false);
  };

  // Add Time Off
  const handleSaveTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const { db } = await import('../db');
    const newTimeOff: StaffTimeOff = {
      id: `to-${Date.now()}`,
      ...timeOffData
    };

    const updatedTimeOff = [...(selectedStaff.timeOff || []), newTimeOff];
    await db.staff.update(selectedStaff.id, {
      timeOff: updatedTimeOff,
      status: timeOffData.startDate <= todayDateStr && timeOffData.endDate >= todayDateStr ? 'On Leave' : selectedStaff.status
    });

    setSelectedStaff({
      ...selectedStaff,
      timeOff: updatedTimeOff
    });

    setShowTimeOffModal(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-left">
      
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
            const avail = checkStaffMemberAvailability(
              member, 
              todayDateStr, 
              '04:00 PM', 
              '06:00 PM', 
              '2.0 Hours', 
              [], events, [], workshops
            );

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
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="pt-3 border-t border-brand-clay/50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedStaff(member);
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
              <input
                type="date"
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
                const cur = new Date(calendarDate);
                const day = cur.getDay();
                const sun = new Date(cur);
                sun.setDate(cur.getDate() - day);
                const sat = new Date(sun);
                sat.setDate(sun.getDate() + 6);
                const sunStr = sun.toISOString().split('T')[0];
                const satStr = sat.toISOString().split('T')[0];
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
            <div>
              <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Assigned Workshops & Events</span>
                <span className="text-[10px] text-brand-terracotta font-semibold">
                  {(staffAssignments.get(selectedStaff.id) || []).length} assigned
                </span>
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-brand-clay/60 rounded-xl p-3 bg-brand-cream/20">
                {(staffAssignments.get(selectedStaff.id) || []).length === 0 ? (
                  <p className="text-xs text-brand-charcoal/50 italic py-2 text-center">No workshops or events assigned to this staff member.</p>
                ) : (
                  (staffAssignments.get(selectedStaff.id) || []).map(a => (
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
                  const shift = selectedStaff.weeklySchedule?.[day];
                  return (
                    <div key={day} className="flex items-center justify-between text-xs p-1.5 border-b border-brand-clay/30 last:border-b-0">
                      <span className="font-bold text-brand-charcoal w-24">{day}</span>
                      {shift?.isWorking ? (
                        <span className="font-semibold text-emerald-800">{shift.startTime} – {shift.endTime}</span>
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
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Sara Al-Malki"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Position / Title *</label>
                <input
                  type="text"
                  required
                  value={formData.position}
                  onChange={e => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g. Master Instructor"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="50 123 4567"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@artycafe.com"
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
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
                  {Object.values(formData.weeklySchedule || {}).filter((s: any) => s?.isWorking).length > 0
                    ? `${Object.values(formData.weeklySchedule || {}).filter((s: any) => s?.isWorking).length} days configured`
                    : 'No working hours set (Empty schedule)'}
                </span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto border border-brand-clay/60 rounded-xl p-3 bg-brand-cream/30">
                {WEEKDAYS.map(day => {
                  const shift = formData.weeklySchedule?.[day];
                  const isWorking = !!shift?.isWorking;

                  return (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-white rounded-lg border border-brand-clay/40 text-xs">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <input
                          type="checkbox"
                          id={`working-${day}`}
                          checked={isWorking}
                          onChange={e => {
                            const checked = e.target.checked;
                            const updated = { ...(formData.weeklySchedule || {}) };
                            if (checked) {
                              updated[day] = {
                                isWorking: true,
                                startTime: shift?.startTime || '10:00 AM',
                                endTime: shift?.endTime || '06:00 PM',
                                breakStart: shift?.breakStart || '01:00 PM',
                                breakEnd: shift?.breakEnd || '02:00 PM'
                              };
                            } else {
                              if (updated[day]) {
                                updated[day] = { ...updated[day]!, isWorking: false };
                              }
                            }
                            setFormData({ ...formData, weeklySchedule: updated });
                          }}
                          className="h-4 w-4 accent-brand-terracotta cursor-pointer"
                        />
                        <label htmlFor={`working-${day}`} className="font-bold text-brand-charcoal cursor-pointer">
                          {day}
                        </label>
                      </div>

                      {isWorking ? (
                        <div className="flex items-center gap-2 flex-1 justify-end">
                          <input
                            type="text"
                            value={shift?.startTime || '10:00 AM'}
                            onChange={e => {
                              const updated = { ...(formData.weeklySchedule || {}) };
                              updated[day] = { ...updated[day]!, startTime: e.target.value };
                              setFormData({ ...formData, weeklySchedule: updated });
                            }}
                            placeholder="Start (e.g. 10:00 AM)"
                            className="w-24 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                          />
                          <span className="text-brand-charcoal/60 font-bold">–</span>
                          <input
                            type="text"
                            value={shift?.endTime || '06:00 PM'}
                            onChange={e => {
                              const updated = { ...(formData.weeklySchedule || {}) };
                              updated[day] = { ...updated[day]!, endTime: e.target.value };
                              setFormData({ ...formData, weeklySchedule: updated });
                            }}
                            placeholder="End (e.g. 06:00 PM)"
                            className="w-24 bg-brand-cream/50 border border-brand-clay rounded-lg px-2 py-1 text-xs font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...(formData.weeklySchedule || {}) };
                              delete updated[day];
                              setFormData({ ...formData, weeklySchedule: updated });
                            }}
                            className="text-[10px] text-red-600 hover:underline px-1 font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 italic font-semibold">Off (No Shift)</span>
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
                <input
                  type="date"
                  required
                  value={timeOffData.startDate}
                  onChange={e => setTimeOffData({ ...timeOffData, startDate: e.target.value })}
                  className="w-full bg-brand-cream/50 border border-brand-clay rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold">End Date</label>
                <input
                  type="date"
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
