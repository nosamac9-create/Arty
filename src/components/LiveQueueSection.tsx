/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp, getRiyadhDateString } from '../context/AppContext';
import { 
  Users, Clock, Play, CheckCircle, PhoneCall, MoreVertical, 
  Plus, CalendarCheck, X, Edit2, Trash2, AlertTriangle, Check, Sparkles,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QueueItem } from '../types';
import { validateSaudiPhone, normaliseSaudiPhone } from '../utils/phoneUtils';
import { PhoneInput } from './PhoneInput';
import {
  resolveQueueInstructor, resolveQueueSession, getTodaysAvailableSessions,
  getSessionSeatUsage, computeQueueSessionPlan, validateHoursAndGuests, isSelfGuided,
  QueueRecordSources, AvailableSessionOption, CapacitySnapshot
} from '../utils/queueUtils';
import { timeToMinutes, getEndTimeMinutes } from '../utils/timeUtils';
import { validateCustomerForm, validateBookingForm, canonicalPhone, phoneMatchKey } from '../utils/validation';
import { checkStaffMemberAvailability } from '../utils/staffAvailabilityUtils';
import { AssignmentSources } from '../utils/staffAssignments';
import {
  searchCustomers, summarizeCustomerActivity, normalizeCustomerPhone, toDisplayPhone,
  customerPhoneKey, CustomerSearchResult
} from '../utils/customerIdentity';
import { hasWebsiteAccount } from '../utils/accountUtils';
import { CustomerAccount } from '../types';

// ==========================================
// ======== MODULAR QUEUE CARD COMPONENTS ===
// ==========================================

const WaitingCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  instructorName: string;
  onToggle: () => void;
  onEdit: (item: QueueItem) => void;
  onCancel: (item: QueueItem) => void;
  updateQueueStatus: (id: string, status: any) => void;
}> = ({ item, isExpanded, instructorName, onToggle, onEdit, onCancel, updateQueueStatus }) => {
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onToggle();
  };

  return (
    <div className="bg-white border border-brand-clay rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col gap-3 relative">
      {/* Interactive Collapsed Header Area */}
      <div 
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-terracotta rounded-xl cursor-pointer flex flex-col gap-2 select-none text-left"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="bg-brand-charcoal text-brand-cream text-xs font-extrabold px-2.5 py-1.5 rounded-lg font-mono">
              No. {item.id.replace('Q-', '')}
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
              item.source === 'Website' 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {item.source}
            </span>
          </div>
          <div className="text-brand-charcoal/40 p-1">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-terracotta' : ''}`} />
          </div>
        </div>

        <div className="space-y-0.5 text-left">
          <h3 className="font-display text-sm font-bold text-brand-charcoal">{item.name}</h3>
          <p className="text-[11px] font-mono text-brand-charcoal/50 font-bold">{item.phone}</p>
        </div>
      </div>

      {/* Expanded Inline Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-brand-clay/40 space-y-3 text-left">
              {/* Controls inside expanded view */}
              <div className="flex justify-between items-center bg-brand-sand/15 p-2 rounded-xl border border-brand-clay/30">
                <span className="text-[11px] font-bold text-brand-charcoal/50">Controls:</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => onEdit(item)}
                    title="Edit entry"
                    className="p-1.5 rounded-lg hover:bg-brand-sand border border-brand-clay/50 text-brand-charcoal/70 cursor-pointer flex items-center justify-center"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button 
                    onClick={() => onCancel(item)}
                    title="Cancel Entry"
                    className="p-1.5 rounded-lg hover:bg-red-50 border border-red-200 text-red-500 cursor-pointer flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Activity / Session Type */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-brand-charcoal/40 uppercase tracking-wider">Activity / Session:</span>
                <p className="text-xs text-brand-charcoal/70 bg-brand-cream/50 p-2 rounded-lg border border-brand-clay/30 leading-relaxed">
                  {item.activity}
                </p>
              </div>

              {/* Badges metadata: guest count, instructor, self-guided */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-brand-charcoal/60">
                <span className="font-bold flex items-center gap-1 bg-brand-sand/50 px-2 py-0.5 rounded">
                  👥 {item.participants} Guests
                </span>
                {!isSelfGuided(item) ? (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {instructorName}
                  </span>
                ) : (
                  <span className="font-bold flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                    Self-Guided
                  </span>
                )}
              </div>

              {/* The operational detail box (duration, estimated end, seats/tables,
                  session time and capacity) is intentionally not rendered here to
                  keep the collapsed card clean. The values are still saved on the
                  queue record and drive capacity, timers, completion and wait-time
                  logic, and remain visible in the detailed booking views. */}

              {/* Check-in time and elapsed wait time */}
              <div className="bg-brand-sand/10 p-2 rounded-xl border border-brand-clay/20 text-[11px] space-y-1 text-brand-charcoal/70">
                <div className="flex justify-between font-bold">
                  <span>🕒 Check-In Time:</span>
                  <span className="font-mono">{item.checkInTime}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>⏳ Wait Duration:</span>
                  <span className="font-mono">{item.elapsedMinutes} mins</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Action Buttons (Always visible) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-clay/40">
        <button
          onClick={() => updateQueueStatus(item.id, 'Called')}
          className="cursor-pointer py-2 px-3 bg-amber-500 hover:bg-amber-600 text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-2xs"
        >
          <PhoneCall className="h-3 w-3" />
          <span>Call</span>
        </button>
        <button
          onClick={() => updateQueueStatus(item.id, 'In Progress')}
          className="cursor-pointer py-2 px-3 bg-brand-sage hover:bg-brand-sage-hover text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-2xs"
        >
          <Play className="h-3 w-3" />
          <span>Seat</span>
        </button>
      </div>
    </div>
  );
};

const CalledCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  instructorName: string;
  onToggle: () => void;
  onCancel: (item: QueueItem) => void;
  updateQueueStatus: (id: string, status: any) => void;
}> = ({ item, isExpanded, instructorName, onToggle, onCancel, updateQueueStatus }) => {
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onToggle();
  };

  return (
    <div className="bg-white border-2 border-amber-500 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col gap-3 relative">
      {/* Interactive Collapsed Header Area */}
      <div 
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-terracotta rounded-xl cursor-pointer flex flex-col gap-2 select-none text-left"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="bg-brand-charcoal text-brand-cream text-xs font-extrabold px-2.5 py-1.5 rounded-lg font-mono animate-pulse">
              No. {item.id.replace('Q-', '')}
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
              item.source === 'Website' 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {item.source}
            </span>
          </div>
          <div className="text-brand-charcoal/40 p-1">
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-terracotta' : ''}`} />
          </div>
        </div>

        <div className="space-y-0.5 text-left">
          <h3 className="font-display text-sm font-bold text-brand-charcoal">{item.name}</h3>
          <p className="text-[11px] font-mono text-brand-charcoal/50 font-bold">{item.phone}</p>
        </div>
      </div>

      {/* Expanded Inline Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-brand-clay/40 space-y-3 text-left">
              {/* Controls inside expanded view */}
              <div className="flex justify-between items-center bg-brand-sand/15 p-2 rounded-xl border border-brand-clay/30">
                <span className="text-[11px] font-bold text-brand-charcoal/50">Controls:</span>
                <button 
                  onClick={() => onCancel(item)}
                  title="Cancel Entry"
                  className="p-1.5 rounded-lg hover:bg-red-50 border border-red-200 text-red-500 cursor-pointer flex items-center justify-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Activity / Session Type */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-brand-charcoal/40 uppercase tracking-wider">Activity / Session:</span>
                <p className="text-xs text-brand-charcoal/70 bg-brand-cream/50 p-2 rounded-lg border border-brand-clay/30 leading-relaxed">
                  {item.activity}
                </p>
              </div>

              {/* Badges metadata: guest count, instructor */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-brand-charcoal/60">
                <span className="font-bold flex items-center gap-1 bg-brand-sand/50 px-2 py-0.5 rounded">
                  👥 {item.participants} Guests
                </span>
                {!isSelfGuided(item) && (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {instructorName}
                  </span>
                )}
              </div>

              {/* Check-in time and elapsed wait time */}
              <div className="bg-brand-sand/10 p-2 rounded-xl border border-brand-clay/20 text-[11px] space-y-1 text-brand-charcoal/70">
                <div className="flex justify-between font-bold">
                  <span>🕒 Check-In Time:</span>
                  <span className="font-mono">{item.checkInTime}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>⏳ Wait Duration:</span>
                  <span className="font-mono">{item.elapsedMinutes} mins</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Action Buttons (Always visible) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-clay/40">
        <button
          onClick={() => onCancel(item)}
          className="cursor-pointer py-2 px-3 border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded-xl flex items-center justify-center gap-1"
        >
          <X className="h-3 w-3" />
          <span>Cancel</span>
        </button>
        <button
          onClick={() => updateQueueStatus(item.id, 'In Progress')}
          className="cursor-pointer py-2 px-3 bg-brand-sage hover:bg-brand-sage-hover text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-2xs"
        >
          <Play className="h-3 w-3" />
          <span>Seat</span>
        </button>
      </div>
    </div>
  );
};

/** How long before "time is up" a card turns red. */
const ENDING_SOON_MS = 5 * 60 * 1000;

/**
 * When an In Progress visit is due to finish, for either instructor type.
 *
 *  - Without Instructor: the paid hours, counted from when they were seated.
 *  - With Instructor: the booked session's end time on today's date, falling
 *    back to its start time plus the session duration.
 *
 * Returns null when there is no known end — an entry with neither paid hours
 * nor a session never warns and never auto-completes.
 */
function getVisitEnd(item: QueueItem, todayDateStr: string): Date | null {
  if (item.type === 'Without Instructor') {
    if (!item.hours || !item.seatedTime) return null;
    return new Date(new Date(item.seatedTime).getTime() + item.hours * 60 * 60 * 1000);
  }

  const endLabel = item.sessionEndTime;
  const minutes = endLabel
    ? timeToMinutes(endLabel)
    : (item.sessionStartTime
        ? getEndTimeMinutes(item.sessionStartTime, item.sessionDuration)
        : null);

  if (minutes === null || Number.isNaN(minutes)) return null;

  const day = new Date(`${item.date || todayDateStr}T00:00:00`);
  if (Number.isNaN(day.getTime())) return null;
  day.setMinutes(day.getMinutes() + minutes);
  return day;
}

/** Normal -> ending soon -> overtime, from the end time and the current tick. */
function getVisitTiming(item: QueueItem, todayDateStr: string, now: Date) {
  const endTime = getVisitEnd(item, todayDateStr);
  if (!endTime) {
    return { endTime: null, remainingMs: null, isExceeded: false, isEndingSoon: false };
  }

  const remainingMs = endTime.getTime() - now.getTime();
  return {
    endTime,
    remainingMs,
    isExceeded: remainingMs <= 0,
    isEndingSoon: remainingMs > 0 && remainingMs <= ENDING_SOON_MS
  };
}

const InProgressCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  instructorName: string;
  onToggle: () => void;
  updateQueueStatus: (id: string, status: any) => void;
  now: Date;
  todayDateStr: string;
}> = ({ item, isExpanded, instructorName, onToggle, updateQueueStatus, now, todayDateStr }) => {
  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onToggle();
  };

  // Calculate live timer
  const startTime = item.seatedTime ? new Date(item.seatedTime) : null;
  const elapsedMs = startTime ? (now.getTime() - startTime.getTime()) : (item.elapsedMinutes * 60000);
  const totalSecs = Math.max(0, Math.floor(elapsedMs / 1000));
  
  const hrsStr = Math.floor(totalSecs / 3600);
  const minsStr = Math.floor((totalSecs % 3600) / 60);
  const secsStr = totalSecs % 60;
  
  const timerStr = `${hrsStr > 0 ? hrsStr + 'h ' : ''}${minsStr}m ${secsStr}s`;

  // Handle warning state calculations for Self-Guided with Hour limits
  const isWithoutInstructor = item.type === 'Without Instructor';
  const hasHours = !!item.hours;
  
  // Timing applies to both instructor types: paid hours for a self-guided
  // visit, the booked session's end time for an instructor-led one.
  const { endTime, remainingMs, isExceeded, isEndingSoon } =
    getVisitTiming(item, todayDateStr, now);

  const expectedCheckout = endTime
    ? endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';

  let remainingTimeStr = '';
  if (remainingMs !== null) {
    const rMins = Math.floor(Math.abs(remainingMs) / 60000);
    const rHrs = Math.floor(rMins / 60);
    const spread = `${rHrs > 0 ? rHrs + 'h ' : ''}${rMins % 60}m`;
    remainingTimeStr = isExceeded ? `Overtime by ${spread}` : `${spread} left`;
  }

  return (
    <div className={`rounded-2xl p-4 shadow-2xs border-2 transition-all duration-300 flex flex-col gap-3 ${
      isExceeded || isEndingSoon
        ? 'border-red-500 bg-red-50/70 shadow-md animate-pulse'
        : 'border-brand-clay bg-white hover:shadow-xs'
    }`}>
      {/* Interactive Collapsed Header Area */}
      <div 
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-terracotta rounded-xl cursor-pointer flex flex-col gap-2 select-none text-left"
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div className="bg-brand-charcoal text-brand-cream text-xs font-extrabold px-2.5 py-1.5 rounded-lg font-mono">
              No. {item.id.replace('Q-', '')}
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
              item.source === 'Website' 
                ? 'bg-blue-50 border-blue-200 text-blue-700' 
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {item.source}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(isExceeded || isEndingSoon) && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-1 text-red-700 flex items-center gap-0.5 text-[9px] font-extrabold animate-bounce">
                <AlertTriangle className="h-3 w-3" />
                <span>{isExceeded ? 'OVERTIME' : '5 MIN LEFT'}</span>
              </div>
            )}
            <div className="text-brand-charcoal/40 p-1">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-brand-terracotta' : ''}`} />
            </div>
          </div>
        </div>

        <div className="space-y-0.5 text-left">
          <h3 className="font-display text-sm font-bold text-brand-charcoal">{item.name}</h3>
          <p className="text-[11px] font-mono text-brand-charcoal/50 font-bold">{item.phone}</p>
        </div>
      </div>

      {/* Expanded Inline Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-brand-clay/30 space-y-3 text-left">
              {/* Activity / Session Type */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-brand-charcoal/40 uppercase tracking-wider">Activity / Session:</span>
                <p className="text-xs text-brand-charcoal/70 bg-brand-cream/50 p-2 rounded-lg border border-brand-clay/30 leading-relaxed">
                  {item.activity}
                </p>
              </div>

              {/* Running timer */}
              <div className="flex items-center justify-between text-xs font-bold text-brand-charcoal bg-brand-sand/20 p-2 rounded-xl border border-brand-clay/20">
                <span className="flex items-center gap-1 text-brand-charcoal/60">
                  <Clock className="h-3.5 w-3.5 text-brand-terracotta" />
                  <span>Session Time:</span>
                </span>
                <span className="font-mono text-brand-terracotta bg-brand-sand/40 px-2 py-1 rounded">
                  {timerStr}
                </span>
              </div>

              {/* Instructor and Workshop where applicable */}
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-brand-charcoal/60">
                <span className="font-bold flex items-center gap-1 bg-brand-sand/50 px-2 py-0.5 rounded">
                  👥 {item.participants} Guests
                </span>
                {!isSelfGuided(item) ? (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {instructorName}
                  </span>
                ) : (
                  <span className="font-bold flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                    Self-Guided
                  </span>
                )}
              </div>

              {/* Self guided Expected checkout details */}
              {endTime && (
                <div className={`p-2 rounded-xl text-[11px] border leading-relaxed ${
                  isExceeded || isEndingSoon
                    ? 'bg-red-100 border-red-200 text-red-800'
                    : 'bg-brand-sand/20 border-brand-clay/40 text-brand-charcoal/80'
                }`}>
                  {isWithoutInstructor && hasHours && (
                    <div className="flex justify-between font-bold">
                      <span>Paid Hours:</span>
                      <span>{item.hours} hrs</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>{isWithoutInstructor ? 'Est Checkout:' : 'Session Ends:'}</span>
                    <span>{expectedCheckout}</span>
                  </div>
                  <div className="flex justify-between font-extrabold border-t border-brand-clay/20 mt-1 pt-1">
                    <span>Status:</span>
                    <span className={isExceeded || isEndingSoon ? 'text-red-600 animate-pulse' : 'text-brand-sage-hover'}>
                      {remainingTimeStr}
                    </span>
                  </div>
                </div>
              )}

              {/* Check-in time & Seated time */}
              <div className="bg-brand-sand/10 p-2 rounded-xl border border-brand-clay/20 text-[11px] space-y-1 text-brand-charcoal/70 font-bold">
                <div className="flex justify-between">
                  <span>🕒 Check-In Time:</span>
                  <span className="font-mono">{item.checkInTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>🕒 Seated At:</span>
                  <span className="font-mono">{item.seatedTime ? new Date(item.seatedTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Action Buttons (Always visible) */}
      <div className="pt-2 border-t border-brand-clay/30">
        <button
          onClick={() => updateQueueStatus(item.id, 'Completed')}
          className="cursor-pointer w-full py-2.5 bg-brand-sage hover:bg-brand-sage-hover text-brand-cream text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
        >
          <CheckCircle className="h-4 w-4" />
          <span>Complete Session</span>
        </button>
      </div>
    </div>
  );
};

const CompletedCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  instructorName: string;
  onToggle: () => void;
  onReturnToWaiting: (item: QueueItem) => void;
}> = ({ item, isExpanded, instructorName, onToggle, onReturnToWaiting }) => {
  const handleCardClick = () => {
    onToggle();
  };

  // Find transition intervals
  const progressEvent = item.history?.find(h => h.status === 'In Progress');
  const completedEvent = item.history?.find(h => h.status === 'Completed');
  let timeSpentStr = '';
  if (progressEvent && completedEvent) {
    const tStart = new Date(progressEvent.timestamp).getTime();
    const tEnd = new Date(completedEvent.timestamp).getTime();
    const totalSecs = Math.max(0, Math.floor((tEnd - tStart) / 1000));
    const totalMins = Math.max(1, Math.round(totalSecs / 60));
    timeSpentStr = `${totalMins} mins`;
  } else {
    timeSpentStr = `${item.elapsedMinutes} mins`;
  }

  return (
    <div className="bg-white/70 border border-brand-clay/60 rounded-2xl p-4 shadow-3xs hover:shadow-xs transition-shadow flex flex-col gap-2 opacity-85">
      {/* Interactive Collapsed Header Area */}
      <div 
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-terracotta rounded-xl cursor-pointer flex flex-col gap-2 select-none text-left"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-brand-clay text-brand-charcoal/70 text-[11px] font-extrabold px-2 py-1 rounded-md font-mono">
              No. {item.id.replace('Q-', '')}
            </div>
            <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded">
              {item.source}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="text-brand-sage flex items-center gap-1 text-xs font-bold">
              <CheckCircle className="h-4 w-4" />
              <span>Completed</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-brand-charcoal/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        <div className="space-y-0.5 text-left">
          <h3 className="font-display text-xs font-bold text-brand-charcoal">{item.name}</h3>
          <p className="text-[10px] font-mono text-brand-charcoal/50">{item.phone}</p>
        </div>
      </div>

      {/* Expanded Inline Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 border-t border-brand-clay/30 space-y-2 text-left text-xs text-brand-charcoal/80 font-bold">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-brand-charcoal/40 uppercase tracking-wider">Activity:</span>
                <p className="text-xs text-brand-charcoal/70 bg-brand-cream/50 p-2 rounded-lg border border-brand-clay/30 font-medium">
                  {item.activity}
                </p>
              </div>

              {/* Stats footer */}
              <div className="flex items-center justify-between text-[11px] font-bold text-brand-charcoal/60 pt-2 border-t border-brand-clay/30">
                <span>👥 {item.participants} Guests</span>
                <span className="flex items-center gap-1 font-mono text-brand-sage-hover">
                  🕒 {timeSpentStr} spent
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-brand-charcoal/60">
                <span>{isSelfGuided(item) ? 'Self-Guided' : `🎓 ${instructorName}`}</span>
                {item.hours !== undefined && <span>{item.hours} hrs booked</span>}
              </div>

              {item.extendedByQueueId && (
                <p className="text-[10px] font-bold text-brand-terracotta">
                  Extended into queue entry No. {item.extendedByQueueId.replace('Q-', '')} — this completed session is kept as history.
                </p>
              )}
              {item.returnedFromQueueId && (
                <p className="text-[10px] font-bold text-brand-charcoal/50">
                  Continuation of completed entry No. {item.returnedFromQueueId.replace('Q-', '')}.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Only self-guided sessions can be given more time. Instructor-led sessions
          stay completed and are never restarted. */}
      {isSelfGuided(item) && (
        <div className="pt-2 border-t border-brand-clay/30">
          <button
            onClick={() => onReturnToWaiting(item)}
            className="cursor-pointer w-full py-2 border border-brand-terracotta/50 text-brand-terracotta hover:bg-brand-terracotta/5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add More Time / Return to Waiting</span>
          </button>
        </div>
      )}
    </div>
  );
};

export const LiveQueueSection: React.FC = () => {
  const {
    queue, updateQueueStatus, updateQueueItem, addQueueItem, returnQueueItemToWaiting,
    todayDateStr, formattedTodayDate, appSettings,
    staff, workshops, workshopSessions, bookings, events,
    customers, pieces, resolveCustomer, updateCustomer, addStaffNotification,
    updateWorkshopSession, appendBookingTimeline,
    birthdayPackages,
} = useApp();

  // One shared view of the real records the queue depends on.
  const recordSources: QueueRecordSources = useMemo(
    () => ({ staff, workshops, workshopSessions, bookings, queue }),
    [staff, workshops, workshopSessions, bookings, queue]
  );

  // Same assignment sources the staff console uses, for schedule conflict checks.
  const assignmentSources: AssignmentSources = useMemo(
    () => ({ staff, workshopSessions, workshops, events, bookings, birthdayPackages, queue }),
    [staff, workshopSessions, workshops, events, bookings, birthdayPackages, queue]
  );

  const capacityConfig = appSettings?.find(s => s.id === 'capacitySettings')?.value;
  const totalSeats = Number(capacityConfig?.totalSeats) || 32;
  const totalTables = Number(capacityConfig?.totalTables) || (capacityConfig?.tables?.length || 8);

  // Compute live occupied seats (In Progress status)
  const inProgressQueue = useMemo(() => {
    return queue.filter(q => q.date === todayDateStr && q.status === 'In Progress');
  }, [queue, todayDateStr]);

  const occupiedSeats = useMemo(() => {
    return inProgressQueue.reduce((acc, curr) => acc + (curr.participants || 1), 0);
  }, [inProgressQueue]);

  const availableSeats = Math.max(0, totalSeats - occupiedSeats);
  const capacityPct = Math.min(100, Math.round((occupiedSeats / totalSeats) * 100));

  // Estimate tables occupied (assume avg 4 seats per table)
  const defaultSeatsPerTable = Number(capacityConfig?.defaultSeatsPerTable) || 4;
  const occupiedTables = Math.min(totalTables, Math.ceil(occupiedSeats / defaultSeatsPerTable));
  const availableTables = Math.max(0, totalTables - occupiedTables);

  // Collapsed / Expanded state for cards
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Force re-render every second for live timers
  const [now, setNow] = useState<Date>(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Acts once when an In Progress visit reaches its end time.
   *
   *  - Without Instructor: the paid time is over, so the visit is completed
   *    automatically through the same mutator the Complete button uses, and
   *    staff are told.
   *  - With Instructor: the card is deliberately left alone — staff finish the
   *    class themselves — but staff are still told the session time is up.
   *
   * The ref records what has already been acted on, so the one-second tick
   * cannot fire it repeatedly.
   */
  const timeUpHandled = useRef<Set<string>>(new Set());

  useEffect(() => {
    const active = queue.filter(q => q.date === todayDateStr && q.status === 'In Progress');

    // Forget entries that are no longer running, so a returned guest can be
    // acted on again on their next visit.
    const activeIds = new Set(active.map(q => q.id));
    timeUpHandled.current.forEach(id => {
      if (!activeIds.has(id)) timeUpHandled.current.delete(id);
    });

    active.forEach(item => {
      const { isExceeded } = getVisitTiming(item, todayDateStr, now);
      if (!isExceeded || timeUpHandled.current.has(item.id)) return;

      timeUpHandled.current.add(item.id);

      if (item.type === 'Without Instructor') {
        // Same transition as the Complete button, so history is appended.
        updateQueueStatus(item.id, 'Completed');
        addStaffNotification(
          '⏱ Self-guided session ended',
          `${item.name} (${item.id}) finished their ${item.hours ?? ''} hour session and was moved to Completed Today automatically.`,
          { newStatus: 'Completed', highlighted: true }
        );
      } else {
        // Instructor-led: notify only. The card stays In Progress.
        addStaffNotification(
          '⏱ Workshop session time is up',
          `${item.name} (${item.id}) has reached the end of their session. Complete the visit when the class is finished.`,
          { highlighted: true }
        );
      }
    });
  }, [now, queue, todayDateStr]);

  // Filter queue strictly for TODAY ONLY (Riyadh local time)
  const todayQueue = useMemo(() => {
    return queue.filter(item => item.date === todayDateStr);
  }, [queue, todayDateStr]);

  // Screen layout tabs (for mobile responsiveness)
  const [activeFilterTab, setActiveFilterTab] = useState<'Waiting' | 'Called' | 'In Progress' | 'Completed'>('Waiting');

  // Walk-In check-in modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [walkInType, setWalkInType] = useState<'Without Instructor' | 'With Instructor'>('Without Instructor');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+966 5');
  const [newGuests, setNewGuests] = useState(1);
  const [newHours, setNewHours] = useState(1); // Without Instructor
  const [newSessionId, setNewSessionId] = useState(''); // With Instructor — real session
  // Returning-customer lookup, against the one shared customers table.
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerAccount | null>(null);
  /** Set when a walk-in would rename the account that already owns this number. */
  const [nameConflict, setNameConflict] = useState<
    { existing: CustomerAccount; enteredName: string } | null
  >(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit item modal states (for Waiting items)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [editGuests, setEditGuests] = useState(1);
  const [editHours, setEditHours] = useState(1);
  // Instructor being assigned while editing a With Instructor entry.
  const [editStaffId, setEditStaffId] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Return-to-waiting modal (completed self-guided guests)
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningItem, setReturningItem] = useState<QueueItem | null>(null);
  const [returnHours, setReturnHours] = useState(1);
  const [returnGuests, setReturnGuests] = useState(1);
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});

  // Cancel confirmation dialog states
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancellingItem, setCancellingItem] = useState<QueueItem | null>(null);

  // Stats
  const activeQueueCount = todayQueue.filter(q => q.status !== 'Completed' && q.status !== 'Cancelled').length;
  const avgWaitTime = useMemo(() => {
    const todayWaiting = todayQueue.filter(q => q.status === 'Waiting');
    if (todayWaiting.length === 0) return 0;
    return Math.round(todayWaiting.reduce((sum, curr) => sum + curr.elapsedMinutes, 0) / todayWaiting.length);
  }, [todayQueue]);

  // Live capacity snapshot shared by every derived calculation.
  const capacitySnapshot: CapacitySnapshot = useMemo(() => ({
    totalSeats,
    totalTables,
    defaultSeatsPerTable,
    oneGroupPerTable: capacityConfig?.oneGroupPerTable,
    occupiedSeats,
    occupiedTables
  }), [totalSeats, totalTables, defaultSeatsPerTable, capacityConfig, occupiedSeats, occupiedTables]);

  // Today's real, still-bookable sessions for a With Instructor walk-in.
  const availableSessions: AvailableSessionOption[] = useMemo(() => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return getTodaysAvailableSessions(recordSources, todayDateStr, nowMinutes);
  }, [recordSources, todayDateStr, now]);

  const selectedSession = useMemo(
    () => availableSessions.find(s => s.sessionId === newSessionId) || null,
    [availableSessions, newSessionId]
  );

  // Instructor per queue entry, always resolved from the current staff record.
  const instructorFor = (item: QueueItem) => resolveQueueInstructor(item, recordSources).name;

  /**
   * Matching customers for what staff have typed so far — the same search the
   * Pottery Logging Console uses, over every customer regardless of how they
   * first reached the studio.
   */
  const customerMatches: CustomerSearchResult[] = useMemo(() => {
    if (linkedCustomer) return [];
    const query = customerQuery.trim() || newName.trim() || newPhone.trim();
    if (query.length < 2) return [];
    if (query === '+966 5' || query === '+966') return [];
    return searchCustomers(customers, query, 5);
  }, [customers, customerQuery, newName, newPhone, linkedCustomer]);

  /** Populates the form from an existing customer and links the visit to them. */
  const handleSelectExistingCustomer = (customer: CustomerAccount) => {
    setLinkedCustomer(customer);
    setNewName(customer.name || '');
    setNewPhone(customer.displayPhone || customer.phone || '');
    setCustomerQuery('');
    setErrors(prev => ({ ...prev, name: '', phone: '' }));
  };

  const handleClearLinkedCustomer = () => {
    setLinkedCustomer(null);
  };

  // Validation & Walk-in Submission
  const validateForm = async () => {
    // Name and phone come from the shared customer rules. A walk-in that
    // matches an existing customer is a returning guest, not a duplicate —
    // resolveCustomer reuses that record — so the duplicate check is skipped.
    const newErrors: Record<string, string> = await validateCustomerForm(
      { name: newName, phone: newPhone },
      { requireEmail: false, allowExistingCustomer: true }
    );

    if (walkInType === 'With Instructor') {
      // Capacity is re-read from the database at submit time, not taken from
      // the snapshot the modal opened with.
      const bookingErrors = await validateBookingForm({
        sessionId: newSessionId,
        participants: newGuests
      });
      if (bookingErrors.sessionId) newErrors.session = bookingErrors.sessionId;
      else if (bookingErrors.participants) newErrors.session = bookingErrors.participants;
    } else {
      Object.assign(newErrors, validateHoursAndGuests(newHours, newGuests));
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await validateForm())) return;

    const enteredName = newName.trim();
    const phoneKey = phoneMatchKey(newPhone);

    // The account this number already belongs to, if any.
    const existing = linkedCustomer
      || customers.find(c => customerPhoneKey(c) === phoneKey);

    // Saving would rename that account. Ask first rather than overwriting.
    if (existing && existing.name && existing.name.trim().toLowerCase() !== enteredName.toLowerCase()) {
      setNameConflict({ existing, enteredName });
      return;
    }

    await submitWalkIn(enteredName, existing);
  };

  /**
   * Writes the walk-in. `nameToUse` is what the shared customer record ends up
   * with, so the caller decides whether an existing account keeps its name.
   */
  const submitWalkIn = async (nameToUse: string, existing?: CustomerAccount) => {
    const isWithInstructor = walkInType === 'With Instructor';
    const activity = isWithInstructor && selectedSession
      ? `${selectedSession.workshopTitle} (${selectedSession.startTime})`
      : `Walk-in (No Instructor - ${newHours} hrs)`;

    // Stored in the one canonical format so the match key always agrees.
    const normPhone = canonicalPhone(newPhone);

    // One shared customer record: an existing number always links to its own
    // account, never to a second record. resolveCustomer matches on the
    // normalized phone, so passing the chosen name is what decides whether the
    // stored name changes.
    const { customer } = await resolveCustomer({ name: nameToUse, phone: normPhone });

    // "Update to new name" was chosen for an account that already existed.
    if (existing && nameToUse !== existing.name) {
      await updateCustomer(customer.id, { name: nameToUse });
    }

    await addQueueItem({
      customerId: customer.id,
      name: nameToUse,
      phone: normPhone,
      activity,
      participants: newGuests,
      staffAvatar: '',
      // Real staff record for instructor-led entries; no default tutor.
      staffName: isWithInstructor ? (selectedSession?.instructorName || 'Unassigned') : 'Self-guided',
      staffId: isWithInstructor ? selectedSession?.instructorStaffId : undefined,
      source: 'Walk-in',
      type: walkInType,
      hours: isWithInstructor ? undefined : newHours,
      // Real workshop/session links saved with the entry.
      workshopId: isWithInstructor ? selectedSession?.workshopId : undefined,
      sessionId: isWithInstructor ? selectedSession?.sessionId : undefined,
      sessionStartTime: isWithInstructor ? selectedSession?.startTime : undefined,
      sessionEndTime: isWithInstructor ? selectedSession?.endTime : undefined,
      sessionDuration: isWithInstructor ? selectedSession?.duration : undefined,
      sessionCapacity: isWithInstructor ? selectedSession?.capacity : undefined
    });

    // Reset Form
    setNewName('');
    setNewPhone('+966 5');
    setNewGuests(1);
    setNewHours(1);
    setNewSessionId('');
    setLinkedCustomer(null);
    setCustomerQuery('');
    setErrors({});
    setNameConflict(null);
    setAddModalOpen(false);
    setActiveFilterTab('Waiting'); // Focus on Waiting tab for instant visual feedback
  };

  // Handle Edit Queue Item
  const handleOpenEdit = (item: QueueItem) => {
    setEditingItem(item);
    setEditGuests(item.participants);
    setEditHours(item.hours ?? 1);
    // Resolve the current instructor from the shared records — no default.
    setEditStaffId(resolveQueueInstructor(item, recordSources).staffId || '');
    setEditErrors({});
    setEditModalOpen(true);
  };

  /** The session an entry being edited belongs to, from the shared records. */
  const editingSession = useMemo(
    () => (editingItem ? resolveQueueSession(editingItem, recordSources) : undefined),
    [editingItem, recordSources]
  );

  /** Seats this session still has, excluding the entry being edited. */
  const editingCapacity = useMemo(() => {
    if (!editingSession || !editingItem) return null;
    const usage = getSessionSeatUsage(editingSession, {
      workshops,
      bookings,
      queue: queue.filter(q => q.id !== editingItem.id)
    });
    return usage;
  }, [editingSession, editingItem, workshops, bookings, queue]);

  /**
   * Staff who can take this session: active, and free for its date and time.
   * The instructor currently assigned stays selectable.
   */
  const availableInstructors = useMemo(() => {
    if (!editingItem || isSelfGuided(editingItem)) return [];

    const date = editingItem.date;
    const startTime = editingItem.sessionStartTime || editingSession?.startTime || editingItem.checkInTime;
    const endTime = editingItem.sessionEndTime || editingSession?.endTime;
    const duration = editingItem.sessionDuration || editingSession?.duration;

    return staff
      .filter(member => member.status === 'Active' || member.id === editingItem.staffId)
      .map(member => {
        const avail = checkStaffMemberAvailability({
          staff: member,
          date,
          startTime,
          endTime,
          duration,
          sources: assignmentSources,
          exclude: {
            sessionIds: editingItem.sessionId ? [String(editingItem.sessionId)] : []
          }
        });
        return { member, avail };
      })
      // Only currently available staff (plus whoever is already assigned).
      .filter(({ member, avail }) => avail.isAvailable || member.id === editingItem.staffId);
  }, [editingItem, editingSession, staff, assignmentSources]);

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    const selfGuided = isSelfGuided(editingItem);

    const validationErrors = selfGuided
      ? validateHoursAndGuests(editHours, editGuests)
      : validateHoursAndGuests(1, editGuests); // instructor-led entries keep session hours
    if (!selfGuided) delete validationErrors.hours;

    // Guests may not exceed what the session still has free.
    if (!selfGuided && editingCapacity) {
      const guests = Number(editGuests);
      if (Number.isFinite(guests) && guests > editingCapacity.remainingCapacity) {
        validationErrors.guests =
          `Only ${editingCapacity.remainingCapacity} seat(s) remain in this session ` +
          `(capacity ${editingCapacity.capacity}, ${editingCapacity.seatsTaken} already taken).`;
      }
    }

    if (!selfGuided && !editStaffId) {
      validationErrors.instructor = 'Select an instructor for this session.';
    }

    if (Object.keys(validationErrors).length > 0) {
      setEditErrors(validationErrors);
      return;
    }

    const updates: Partial<QueueItem> = { participants: Number(editGuests) };

    if (selfGuided) {
      // Hours drive duration, estimated end time and the capacity figures, all of
      // which are recomputed from the saved record.
      updates.hours = Number(editHours);
      updates.activity = `Walk-in (No Instructor - ${Number(editHours)} hrs)`;
    } else if (editStaffId && editStaffId !== editingItem.staffId) {
      const member = staff.find(m => m.id === editStaffId);
      if (!member) {
        setEditErrors({ instructor: 'That staff member no longer exists.' });
        return;
      }
      // Store the stable id; the name is denormalized for display only.
      updates.staffId = member.id;
      updates.staffName = member.name;
    }

    await updateQueueItem(editingItem.id, updates);

    // Keep the linked booking and workshop session pointing at the same tutor,
    // so the staff calendar and customer view agree. Workshop and session links
    // are left untouched.
    if (!selfGuided && editStaffId && editStaffId !== editingItem.staffId) {
      const member = staff.find(m => m.id === editStaffId);
      if (member) {
        if (editingItem.sessionId) {
          await updateWorkshopSession(String(editingItem.sessionId), {
            staffId: member.id,
            instructor: member.name
          });
        }
        if (editingItem.bookingId) {
          await appendBookingTimeline(
            String(editingItem.bookingId),
            `Instructor reassigned to ${member.name} via Live Queue`
          );
        }
      }
    }

    setEditModalOpen(false);
    setEditingItem(null);
    setEditErrors({});
  };

  // Handle returning a completed self-guided guest to Waiting for more time
  const handleOpenReturn = (item: QueueItem) => {
    setReturningItem(item);
    setReturnHours(1);
    setReturnGuests(item.participants || 1);
    setReturnErrors({});
    setReturnModalOpen(true);
  };

  const handleConfirmReturn = async () => {
    if (!returningItem) return;

    const validationErrors = validateHoursAndGuests(returnHours, returnGuests);
    if (Object.keys(validationErrors).length > 0) {
      setReturnErrors(validationErrors);
      return;
    }

    const result = await returnQueueItemToWaiting(returningItem.id, {
      hours: Number(returnHours),
      participants: Number(returnGuests)
    });

    if (!result.success) {
      setReturnErrors({ form: result.message || 'Could not return this guest to Waiting.' });
      return;
    }

    setReturnModalOpen(false);
    setReturningItem(null);
    setActiveFilterTab('Waiting');
  };

  // Handle Cancellation flow
  const handleRequestCancel = (item: QueueItem) => {
    setCancellingItem(item);
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingItem) return;
    await updateQueueStatus(cancellingItem.id, 'Cancelled');
    setCancelConfirmOpen(false);
    setCancellingItem(null);
  };

  // Categories of filtered queue lists for today
  const waitingItems = useMemo(() => todayQueue.filter(q => q.status === 'Waiting'), [todayQueue]);
  const calledItems = useMemo(() => todayQueue.filter(q => q.status === 'Called'), [todayQueue]);
  /**
   * In Progress, with anyone in their last five minutes lifted to the top.
   *
   * The ordering is derived from the same `getVisitTiming` the card itself
   * uses, so the list and the card can never disagree about who is urgent.
   * Within each group the original queue order is kept, so two urgent guests
   * stay in the order they were seated rather than swapping places on a tick.
   */
  const inProgressItems = useMemo(() => {
    const active = todayQueue.filter(q => q.status === 'In Progress');
    return active
      .map((item, index) => ({
        item,
        index,
        timing: getVisitTiming(item, todayDateStr, now)
      }))
      .sort((a, b) => {
        // Overtime counts as urgent too — it is past the warning, not before it.
        const aUrgent = a.timing.isEndingSoon || a.timing.isExceeded;
        const bUrgent = b.timing.isEndingSoon || b.timing.isExceeded;
        if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;
        if (aUrgent && bUrgent) {
          // Least time left first.
          return (a.timing.remainingMs ?? 0) - (b.timing.remainingMs ?? 0);
        }
        return a.index - b.index;
      })
      .map(entry => entry.item);
  }, [todayQueue, todayDateStr, now]);

  /**
   * Whose five-minute warning is currently live.
   *
   * Keyed on the visit's end time as well as the entry id, so a guest who is
   * seated again later warns again — while a warning that has been dismissed
   * stays dismissed for that session, however many times this re-renders.
   */
  const endingSoonWarnings = useMemo(
    () =>
      todayQueue
        .filter(q => q.status === 'In Progress')
        .map(item => {
          const timing = getVisitTiming(item, todayDateStr, now);
          return { item, timing };
        })
        .filter(entry => entry.timing.isEndingSoon && entry.timing.endTime)
        .map(entry => ({
          key: `${entry.item.id}:${entry.timing.endTime!.getTime()}`,
          item: entry.item,
          minutesLeft: Math.max(1, Math.ceil((entry.timing.remainingMs ?? 0) / 60000))
        })),
    [todayQueue, todayDateStr, now]
  );

  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);
  const visibleWarnings = endingSoonWarnings.filter(w => !dismissedWarnings.includes(w.key));
  const completedItems = useMemo(() => todayQueue.filter(q => q.status === 'Completed'), [todayQueue]);

  return (
    <div className="p-4 sm:p-6 space-y-6 min-w-0 text-left bg-brand-cream min-h-full">
      
      {/* High-visibility Tablet Friendly Header - Read-only static date */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 bg-brand-charcoal text-brand-cream rounded-3xl shadow-md gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-brand-sage uppercase tracking-widest">Live Studio Queue &bull; Riyadh Local Time</p>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold select-none">{formattedTodayDate}</h1>
            <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
          </div>
          <div className="flex items-center gap-4 text-xs text-brand-cream/70 font-semibold pt-1">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-brand-terracotta" />
              <span>{activeQueueCount} active artists today</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-brand-sage" />
              <span>Avg Wait Time: {avgWaitTime} minutes</span>
            </span>
          </div>
        </div>

        {/* Primary Action Panel */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => setAddModalOpen(true)}
            className="cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-terracotta text-brand-cream text-sm font-bold px-5 py-4 rounded-xl hover:bg-brand-terracotta-hover transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 stroke-[3]" />
            <span>+ Check In Walk-In</span>
          </button>
        </div>
      </div>

      {/* LIVE QUEUE CAPACITY & SEATING METRICS BAR */}
      <div className="bg-white border border-brand-clay/60 rounded-3xl p-5 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Seats Occupancy Metric */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-brand-charcoal/70 uppercase tracking-wider text-[10px]">Studio Seats Occupied</span>
            <span className="font-mono text-brand-charcoal">
              {occupiedSeats} / {totalSeats} Seats ({capacityPct}%)
            </span>
          </div>
          <div className="w-full h-3 bg-brand-cream border border-brand-clay/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                capacityPct >= 90
                  ? 'bg-red-500'
                  : capacityPct >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${capacityPct}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-brand-charcoal/60 font-medium">
            Available: <strong className="text-emerald-700 font-bold font-mono">{availableSeats} seats</strong> left
          </p>
        </div>

        {/* Tables Inventory Metric */}
        <div className="p-3 bg-brand-cream/40 border border-brand-clay/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/60 block">Table Inventory</span>
            <span className="text-sm font-extrabold text-brand-charcoal font-mono">{availableTables} / {totalTables} Tables Free</span>
          </div>
          <div className="flex items-center justify-center h-10 w-10 bg-brand-sand/60 text-brand-terracotta rounded-xl font-bold text-xs">
            {occupiedTables}/{totalTables}
          </div>
        </div>

        {/* Dynamic Queue Wait-Time Throughput */}
        <div className="p-3 bg-brand-cream/40 border border-brand-clay/40 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/60 block">Queue Throughput</span>
            <span className="text-sm font-extrabold text-brand-charcoal font-mono">
              ~{waitingItems.length > 0 ? Math.max(10, Math.round((waitingItems.length * 15) / Math.max(1, availableTables))) : 0} min wait
            </span>
          </div>
          <div className="flex items-center justify-center h-10 w-10 bg-brand-sage/30 text-brand-sage-hover rounded-xl font-bold text-xs">
            ⏳
          </div>
        </div>
      </div>

      {/* MOBILE ONLY navigation tabs */}
      <div className="flex lg:hidden border-b border-brand-clay overflow-x-auto no-scrollbar gap-2 pb-1">
        {(['Waiting', 'Called', 'In Progress', 'Completed'] as const).map(tab => {
          const isActive = activeFilterTab === tab;
          const list = tab === 'Waiting' ? waitingItems 
                     : tab === 'Called' ? calledItems 
                     : tab === 'In Progress' ? inProgressItems 
                     : completedItems;
          return (
            <button
              key={tab}
              onClick={() => setActiveFilterTab(tab)}
              className={`px-5 py-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive 
                  ? 'border-brand-terracotta text-brand-terracotta bg-white/40' 
                  : 'border-transparent text-brand-charcoal/50 hover:text-brand-terracotta'
              }`}
            >
              <span>{tab}</span>
              {list.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-sand text-brand-charcoal">
                  {list.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* FIVE-MINUTE WARNINGS — one banner per guest, dismissed individually.
          Dismissal is keyed on the visit's end time, so closing one does not
          silence the next guest and does not come back on the next tick. */}
      {visibleWarnings.length > 0 && (
        <div className="space-y-2">
          {visibleWarnings.map(warning => (
            <div
              key={warning.key}
              role="status"
              className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 shadow-card-sm"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">
                  {warning.item.name} has {warning.minutesLeft} minute{warning.minutesLeft === 1 ? '' : 's'} left
                </p>
                <p className="mt-0.5 text-xs font-semibold text-amber-800/80">
                  {warning.item.activity || 'Studio session'}
                  {warning.item.id ? ` · ${warning.item.id}` : ''}
                  {warning.item.staffName ? ` · with ${warning.item.staffName}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedWarnings(prev => [...prev, warning.key])}
                aria-label={`Dismiss the warning for ${warning.item.name}`}
                className="shrink-0 rounded-lg p-1 text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KANBAN BOARD WRAPPER: All columns side-by-side on lg screen, tab-filtered on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* ================= COLUMN 1: WAITING ================= */}
        <div className={`flex flex-col gap-4 bg-brand-sand/15 p-4 rounded-3xl border border-brand-clay/30 min-h-[400px] ${activeFilterTab === 'Waiting' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-brand-clay/40">
            <h2 className="font-display text-sm font-bold text-brand-charcoal flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              <span>Waiting List</span>
            </h2>
            <span className="bg-brand-sand px-2 py-0.5 rounded-full text-xs font-bold text-brand-charcoal/60">{waitingItems.length}</span>
          </div>

          {/* Three cards tall, then the list scrolls inside itself — one busy
              column must not stretch the page and push the others out of
              reach. `always-scrollbar` keeps the bar visible so it is obvious
              there is more below. */}
          <div className="max-h-[27rem] space-y-4 overflow-y-auto always-scrollbar pe-1">
            {waitingItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-charcoal/40 bg-white/40 rounded-2xl border border-dashed border-brand-clay/50">
                No guests waiting.
              </div>
            ) : (
              waitingItems.map(item => (
                <WaitingCard
                  key={item.id}
                  item={item}
                  isExpanded={!!expandedCards[item.id]}
                  instructorName={instructorFor(item)}
                  onToggle={() => toggleExpand(item.id)}
                  onEdit={handleOpenEdit}
                  onCancel={handleRequestCancel}
                  updateQueueStatus={updateQueueStatus}
                />
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: CALLED ================= */}
        <div className={`flex flex-col gap-4 bg-brand-sand/15 p-4 rounded-3xl border border-brand-clay/30 min-h-[400px] ${activeFilterTab === 'Called' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-brand-clay/40">
            <h2 className="font-display text-sm font-bold text-brand-charcoal flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-600 animate-pulse"></span>
              <span>Called List</span>
            </h2>
            <span className="bg-brand-sand px-2 py-0.5 rounded-full text-xs font-bold text-brand-charcoal/60">{calledItems.length}</span>
          </div>

          <div className="max-h-[27rem] space-y-4 overflow-y-auto always-scrollbar pe-1">
            {calledItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-charcoal/40 bg-white/40 rounded-2xl border border-dashed border-brand-clay/50">
                No called entries.
              </div>
            ) : (
              calledItems.map(item => (
                <CalledCard
                  key={item.id}
                  item={item}
                  isExpanded={!!expandedCards[item.id]}
                  instructorName={instructorFor(item)}
                  onToggle={() => toggleExpand(item.id)}
                  onCancel={handleRequestCancel}
                  updateQueueStatus={updateQueueStatus}
                />
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: IN PROGRESS ================= */}
        <div className={`flex flex-col gap-4 bg-brand-sand/15 p-4 rounded-3xl border border-brand-clay/30 min-h-[400px] ${activeFilterTab === 'In Progress' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-brand-clay/40">
            <h2 className="font-display text-sm font-bold text-brand-charcoal flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
              <span>In Progress</span>
            </h2>
            <span className="bg-brand-sand px-2 py-0.5 rounded-full text-xs font-bold text-brand-charcoal/60">{inProgressItems.length}</span>
          </div>

          <div className="max-h-[27rem] space-y-4 overflow-y-auto always-scrollbar pe-1">
            {inProgressItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-charcoal/40 bg-white/40 rounded-2xl border border-dashed border-brand-clay/50">
                No active studio sessions.
              </div>
            ) : (
              inProgressItems.map(item => (
                <InProgressCard
                  key={item.id}
                  item={item}
                  isExpanded={!!expandedCards[item.id]}
                  instructorName={instructorFor(item)}
                  onToggle={() => toggleExpand(item.id)}
                  updateQueueStatus={updateQueueStatus}
                  now={now}
                  todayDateStr={todayDateStr}
                />
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 4: COMPLETED ================= */}
        <div className={`flex flex-col gap-4 bg-brand-sand/15 p-4 rounded-3xl border border-brand-clay/30 min-h-[400px] ${activeFilterTab === 'Completed' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center pb-2 border-b border-brand-clay/40">
            <h2 className="font-display text-sm font-bold text-brand-charcoal flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span>Completed Today</span>
            </h2>
            <span className="bg-brand-sand px-2 py-0.5 rounded-full text-xs font-bold text-brand-charcoal/60">{completedItems.length}</span>
          </div>

          <div className="max-h-[27rem] space-y-4 overflow-y-auto always-scrollbar pe-1">
            {completedItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-charcoal/40 bg-white/40 rounded-2xl border border-dashed border-brand-clay/50">
                No sessions completed yet today.
              </div>
            ) : (
              completedItems.map(item => (
                <CompletedCard
                  key={item.id}
                  item={item}
                  isExpanded={!!expandedCards[item.id]}
                  instructorName={instructorFor(item)}
                  onToggle={() => toggleExpand(item.id)}
                  onReturnToWaiting={handleOpenReturn}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* ========================================================== */}
      {/* ================ WALK-IN CHECK-IN MODAL ================= */}
      {/* ========================================================== */}
      {/* Existing account, different name — ask before renaming it */}
      {nameConflict && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-brand-clay rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-left">
            <h3 className="text-base font-bold text-brand-charcoal">This number already has an account</h3>

            <div className="space-y-2 text-xs text-brand-charcoal/80">
              <p>
                This number already has an account under{' '}
                <span className="font-bold text-brand-charcoal">"{nameConflict.existing.name}"</span>.
              </p>
              <p>
                You entered <span className="font-bold text-brand-charcoal">"{nameConflict.enteredName}"</span>.
              </p>
              <p className="text-brand-charcoal/60">
                The visit is linked to the existing account either way — choose which name it should keep.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  const existing = nameConflict.existing;
                  setNameConflict(null);
                  await submitWalkIn(existing.name, existing);
                }}
                className="w-full py-2.5 rounded-xl bg-brand-terracotta text-brand-cream text-xs font-bold cursor-pointer hover:bg-brand-terracotta-hover transition-colors"
              >
                Keep existing name ("{nameConflict.existing.name}")
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { existing, enteredName } = nameConflict;
                  setNameConflict(null);
                  await submitWalkIn(enteredName, existing);
                }}
                className="w-full py-2.5 rounded-xl bg-brand-sand text-brand-charcoal border border-brand-clay text-xs font-bold cursor-pointer hover:bg-brand-clay/30 transition-colors"
              >
                Update to new name ("{nameConflict.enteredName}")
              </button>
              <button
                type="button"
                onClick={() => setNameConflict(null)}
                className="w-full py-2 rounded-xl text-xs font-bold text-brand-charcoal/60 cursor-pointer hover:bg-brand-sand/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {addModalOpen && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-md w-full text-left space-y-5 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <h3 className="font-display text-lg font-bold text-brand-charcoal flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-terracotta" />
                <span>Add Walk-In to Queue</span>
              </h3>
              <button 
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 rounded-lg text-brand-charcoal hover:bg-brand-sand border border-transparent hover:border-brand-clay/40 cursor-pointer focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TWO OPTIONS AT THE TOP presented as large clearly-selectable buttons or tabs */}
            <div className="grid grid-cols-2 gap-2 bg-brand-sand/30 p-1.5 rounded-xl border border-brand-clay">
              <button
                type="button"
                onClick={() => { setWalkInType('Without Instructor'); setErrors({}); }}
                className={`py-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  walkInType === 'Without Instructor' 
                    ? 'bg-brand-terracotta text-brand-cream shadow-sm' 
                    : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-sand/30'
                }`}
              >
                Without Instructor
              </button>
              <button
                type="button"
                onClick={() => { setWalkInType('With Instructor'); setErrors({}); }}
                className={`py-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  walkInType === 'With Instructor' 
                    ? 'bg-brand-terracotta text-brand-cream shadow-sm' 
                    : 'text-brand-charcoal/60 hover:text-brand-charcoal hover:bg-brand-sand/30'
                }`}
              >
                With Instructor
              </button>
            </div>

            {/* FORM FIELDS */}
            <form onSubmit={handleAddWalkIn} className="space-y-4">
              
              {/* Name Field */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-charcoal/80 flex justify-between">
                  <span>Guest Name <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  placeholder="Sara Al-Fahad"
                  value={newName}
                  onChange={e => {
                    setNewName(e.target.value);
                    setCustomerQuery(e.target.value);
                    if (linkedCustomer) setLinkedCustomer(null);
                    if(errors.name) setErrors(prev => ({...prev, name: ''}));
                  }}
                  className={`w-full bg-white border rounded-xl py-3 px-3.5 text-xs font-semibold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none ${
                    errors.name ? 'border-red-500 bg-red-50/20' : 'border-brand-clay'
                  }`}
                />
                {errors.name && <p className="text-[11px] text-red-500 font-bold">{errors.name}</p>}
              </div>

              <PhoneInput
                label="Phone Number"
                required
                value={newPhone}
                onChange={val => {
                  setNewPhone(val);
                  setCustomerQuery(val);
                  if (linkedCustomer) setLinkedCustomer(null);
                  if(errors.phone) setErrors(prev => ({...prev, phone: ''}));
                }}
                error={errors.phone}
              />

              {/* Returning-customer lookup over the shared customers table.
                  Matching is by normalized phone, so any format finds them. */}
              {linkedCustomer ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      Existing customer linked
                    </p>
                    <p className="text-xs font-bold text-brand-charcoal truncate">{linkedCustomer.name}</p>
                    <p className="text-[11px] font-mono text-brand-charcoal/60">
                      {linkedCustomer.displayPhone || linkedCustomer.phone}
                      {linkedCustomer.email ? ` · ${linkedCustomer.email}` : ''}
                    </p>
                    {(() => {
                      const summary = summarizeCustomerActivity(linkedCustomer, { bookings, queue, pieces });
                      return (
                        <p className="text-[10px] font-semibold text-brand-charcoal/55 mt-0.5">
                          {summary.visits} previous visit{summary.visits === 1 ? '' : 's'} ·{' '}
                          {summary.bookings} booking{summary.bookings === 1 ? '' : 's'} ·{' '}
                          {hasWebsiteAccount(linkedCustomer) ? 'Registered account' : 'No website account'} ·{' '}
                          <span className="font-mono">{linkedCustomer.id}</span>
                        </p>
                      );
                    })()}
                  </div>
                  <button
                    type="button"
                    onClick={handleClearLinkedCustomer}
                    className="text-[10px] font-bold text-brand-charcoal/50 hover:text-red-600 shrink-0 cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              ) : customerMatches.length > 0 && (
                <div className="bg-brand-sand/25 border border-brand-clay/50 rounded-xl p-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/50 px-1 pb-1">
                    Matching customers
                  </p>
                  {/* Fixed height with the rest reached by scrolling — the same
                      shape the piece logging console's customer search uses.
                      Stacking every match grew the card off the screen whenever
                      several customers shared a name. */}
                  <div className="max-h-40 overflow-y-auto always-scrollbar space-y-1 pe-1">
                  {customerMatches.map(({ customer }) => {
                    const summary = summarizeCustomerActivity(customer, { bookings, queue, pieces });
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectExistingCustomer(customer)}
                        className="w-full text-left p-2 rounded-lg bg-white hover:bg-brand-sand/40 border border-brand-clay/40 cursor-pointer"
                      >
                        <p className="text-xs font-bold text-brand-charcoal">{customer.name}</p>
                        <p className="text-[11px] font-mono text-brand-charcoal/60">
                          {customer.displayPhone || customer.phone}
                        </p>
                        <p className="text-[10px] font-semibold text-brand-charcoal/50">
                          {summary.visits} previous visit{summary.visits === 1 ? '' : 's'} ·{' '}
                          {hasWebsiteAccount(customer) ? 'Registered account' : 'Walk-in / guest'}
                        </p>
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}

              {/* Guest Count Numeric Stepper (Tablet friendly) */}
              <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3">
                <div className="text-left">
                  <p className="text-xs font-bold text-brand-charcoal/80">Number of Guests</p>
                  <p className="text-[10px] text-brand-charcoal/40 font-bold">Minimum 1 guest</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNewGuests(prev => Math.max(1, prev - 1))}
                    className="h-10 w-10 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal text-base cursor-pointer focus:outline-none"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold text-brand-charcoal w-6 text-center">{newGuests}</span>
                  <button
                    type="button"
                    onClick={() => setNewGuests(prev => prev + 1)}
                    className="h-10 w-10 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal text-base cursor-pointer focus:outline-none"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* OPTION A: WITHOUT INSTRUCTOR SPECIFIC FIELDS */}
              {walkInType === 'Without Instructor' && (
                <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3 animate-in fade-in duration-200">
                  <div className="text-left">
                    <p className="text-xs font-bold text-brand-charcoal/80">Number of Hours</p>
                    <p className="text-[10px] text-brand-charcoal/40 font-bold">Time limit for clay play</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setNewHours(prev => Math.max(1, prev - 1))}
                      className="h-10 w-10 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal text-base cursor-pointer focus:outline-none"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold text-brand-charcoal w-6 text-center">{newHours}</span>
                    <button
                      type="button"
                      onClick={() => setNewHours(prev => prev + 1)}
                      className="h-10 w-10 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal text-base cursor-pointer focus:outline-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* OPTION B: WITH INSTRUCTOR — pick one of today's real sessions */}
              {walkInType === 'With Instructor' && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-brand-charcoal/80">
                    Today's Workshop Session <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newSessionId}
                    onChange={e => {
                      setNewSessionId(e.target.value);
                      if (errors.session) setErrors(prev => ({ ...prev, session: '' }));
                    }}
                    disabled={availableSessions.length === 0}
                    className={`w-full bg-white border rounded-xl py-3 px-3.5 text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none disabled:opacity-60 ${
                      errors.session ? 'border-red-500 bg-red-50/20' : 'border-brand-clay'
                    }`}
                  >
                    <option value="">
                      {availableSessions.length === 0
                        ? 'No available sessions left today'
                        : 'Select a session...'}
                    </option>
                    {availableSessions.map(s => (
                      <option key={s.sessionId} value={s.sessionId}>{s.label}</option>
                    ))}
                  </select>
                  {errors.session && <p className="text-[11px] text-red-500 font-bold">{errors.session}</p>}

                  {selectedSession && (
                    <div className="mt-2 bg-brand-sand/20 border border-brand-clay/40 rounded-xl p-2.5 text-[11px] font-bold text-brand-charcoal/80 space-y-1">
                      <div className="flex justify-between"><span>Workshop:</span><span>{selectedSession.workshopTitle}</span></div>
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="font-mono">{selectedSession.startTime} – {selectedSession.endTime}</span>
                      </div>
                      <div className="flex justify-between"><span>Instructor:</span><span>{selectedSession.instructorName}</span></div>
                      <div className="flex justify-between">
                        <span>Seats Left:</span>
                        <span>{selectedSession.remainingCapacity} of {selectedSession.capacity}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* The derived summary (duration, estimated end, seats/tables, wait) is
                  intentionally not shown here. computeQueueSessionPlan still runs for
                  queue timing, capacity, auto-completion, wait estimates and seat and
                  table allocation — only the box was removed. Validation messages stay. */}
              {walkInType === 'Without Instructor' && (errors.hours || errors.guests) && (
                <div className="space-y-1">
                  {errors.hours && <p className="text-[11px] text-red-500 font-bold">{errors.hours}</p>}
                  {errors.guests && <p className="text-[11px] text-red-500 font-bold">{errors.guests}</p>}
                </div>
              )}

              {/* Primary / Secondary CTA Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="cursor-pointer py-3.5 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer py-3.5 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-xs font-bold rounded-xl text-center shadow-md"
                >
                  Add to Queue
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* =================== EDIT GUEST DIALOG ==================== */}
      {/* ========================================================== */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-sm w-full text-left space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <h3 className="font-display text-sm font-bold text-brand-charcoal">
                Edit Queue Entry {editingItem.id}
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-brand-charcoal hover:bg-brand-sand p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">

              {/* Stepper for Guests */}
              <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3">
                <span className="text-xs font-bold text-brand-charcoal/80">Guests Count</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setEditGuests(prev => Math.max(1, prev - 1))}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={editGuests}
                    onChange={e => {
                      setEditGuests(Number(e.target.value));
                      if (editErrors.guests) setEditErrors(prev => ({ ...prev, guests: '' }));
                    }}
                    className="text-sm font-bold text-brand-charcoal w-14 text-center bg-brand-cream/50 border border-brand-clay rounded-lg py-1"
                  />
                  <button
                    onClick={() => setEditGuests(prev => prev + 1)}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    +
                  </button>
                </div>
              </div>
              {editErrors.guests && <p className="text-[11px] text-red-500 font-bold">{editErrors.guests}</p>}

              {/* Hours — self-guided entries only */}
              {isSelfGuided(editingItem) && (
                <>
                  <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3">
                    <span className="text-xs font-bold text-brand-charcoal/80">Number of Hours</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditHours(prev => Math.max(1, prev - 1))}
                        className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        step="0.5"
                        value={editHours}
                        onChange={e => {
                          setEditHours(Number(e.target.value));
                          if (editErrors.hours) setEditErrors(prev => ({ ...prev, hours: '' }));
                        }}
                        className="text-sm font-bold text-brand-charcoal w-14 text-center bg-brand-cream/50 border border-brand-clay rounded-lg py-1"
                      />
                      <button
                        onClick={() => setEditHours(prev => prev + 1)}
                        className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {editErrors.hours && <p className="text-[11px] text-red-500 font-bold">{editErrors.hours}</p>}

                  {/* The derived summary box is intentionally not shown here.
                      computeQueueSessionPlan still runs where the figures are used —
                      queue timing, capacity, auto-completion, wait estimates and
                      seat/table allocation — and the saved hours/guests are unchanged. */}
                </>
              )}

              {/* Instructor-led entries: reassign the tutor and see live capacity */}
              {!isSelfGuided(editingItem) && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-charcoal/80">Assigned Instructor</label>
                    {/* Only staff who are free for this session's date and time. */}
                    <select
                      value={editStaffId}
                      onChange={e => {
                        setEditStaffId(e.target.value);
                        if (editErrors.instructor) setEditErrors(prev => ({ ...prev, instructor: '' }));
                      }}
                      className="w-full bg-white border border-brand-clay rounded-xl py-2.5 px-3.5 text-xs font-bold text-brand-charcoal cursor-pointer"
                    >
                      <option value="">Select instructor...</option>
                      {availableInstructors.map(({ member, avail }) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                          {member.id === editingItem.staffId && !avail.isAvailable ? ' (currently assigned)' : ''}
                        </option>
                      ))}
                    </select>
                    {availableInstructors.length === 0 && (
                      <p className="text-[11px] font-bold text-amber-700">
                        No staff are free for this session's time.
                      </p>
                    )}
                    {editErrors.instructor && (
                      <p className="text-[11px] text-red-500 font-bold">{editErrors.instructor}</p>
                    )}
                  </div>

                  {/* The session/capacity summary box is intentionally not shown.
                      editingCapacity is still computed and still enforces the guest
                      limit on save, and the session and booking links are unchanged. */}
                </>
              )}

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="cursor-pointer py-3 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="cursor-pointer py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-xs font-bold rounded-xl text-center shadow-md"
                >
                  Save Changes
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* ============ ADD MORE TIME / RETURN TO WAITING =========== */}
      {/* ========================================================== */}
      {returnModalOpen && returningItem && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-sm w-full text-left space-y-5 animate-in zoom-in-95 duration-200">

            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-brand-charcoal">Add More Time</h3>
                <p className="text-[11px] font-bold text-brand-charcoal/50">
                  {returningItem.name} · completed entry No. {returningItem.id.replace('Q-', '')}
                </p>
              </div>
              <button onClick={() => setReturnModalOpen(false)} className="text-brand-charcoal hover:bg-brand-sand p-1 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] font-semibold text-brand-charcoal/60 bg-white border border-brand-clay/50 rounded-xl p-2.5">
              The completed session stays in Completed Today as history. A new Waiting entry is created for the extra time.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3">
                <span className="text-xs font-bold text-brand-charcoal/80">Additional Hours</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReturnHours(prev => Math.max(1, prev - 1))}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={returnHours}
                    onChange={e => {
                      setReturnHours(Number(e.target.value));
                      if (returnErrors.hours) setReturnErrors(prev => ({ ...prev, hours: '' }));
                    }}
                    className="text-sm font-bold text-brand-charcoal w-14 text-center bg-brand-cream/50 border border-brand-clay rounded-lg py-1"
                  />
                  <button
                    onClick={() => setReturnHours(prev => prev + 1)}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    +
                  </button>
                </div>
              </div>
              {returnErrors.hours && <p className="text-[11px] text-red-500 font-bold">{returnErrors.hours}</p>}

              <div className="flex items-center justify-between border border-brand-clay bg-white rounded-xl p-3">
                <span className="text-xs font-bold text-brand-charcoal/80">Guests</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReturnGuests(prev => Math.max(1, prev - 1))}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={returnGuests}
                    onChange={e => {
                      setReturnGuests(Number(e.target.value));
                      if (returnErrors.guests) setReturnErrors(prev => ({ ...prev, guests: '' }));
                    }}
                    className="text-sm font-bold text-brand-charcoal w-14 text-center bg-brand-cream/50 border border-brand-clay rounded-lg py-1"
                  />
                  <button
                    onClick={() => setReturnGuests(prev => prev + 1)}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    +
                  </button>
                </div>
              </div>
              {returnErrors.guests && <p className="text-[11px] text-red-500 font-bold">{returnErrors.guests}</p>}

              {(() => {
                const preview = computeQueueSessionPlan({
                  hours: returnHours,
                  guests: returnGuests,
                  startTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                  capacity: capacitySnapshot,
                  aheadInQueue: waitingItems
                });
                return (
                  <div className="bg-brand-sand/20 border border-brand-clay/40 rounded-xl p-3 text-[11px] font-bold text-brand-charcoal/80 space-y-1">
                    <div className="flex justify-between"><span>New Session Duration:</span><span>{preview.durationLabel}</span></div>
                    <div className="flex justify-between"><span>Est. End Time:</span><span className="font-mono">{preview.estimatedEndTime}</span></div>
                    <div className="flex justify-between"><span>Seats / Tables Required:</span><span>{preview.seatsRequired} / {preview.tablesRequired}</span></div>
                  </div>
                );
              })()}

              {returnErrors.form && (
                <p className="text-[11px] text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl p-2.5">
                  {returnErrors.form}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setReturnModalOpen(false)}
                  className="cursor-pointer py-3 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReturn}
                  className="cursor-pointer py-3 bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-xs font-bold rounded-xl text-center shadow-md"
                >
                  Return to Waiting
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* ================= CANCEL CONFIRMATION ==================== */}
      {/* ========================================================== */}
      {cancelConfirmOpen && cancellingItem && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                Confirm Cancel Queue Entry?
              </h3>
              <p className="text-xs text-brand-charcoal/60 leading-relaxed">
                Are you sure you want to cancel the queue entry for <span className="font-bold text-brand-charcoal">{cancellingItem.name}</span> (No. {cancellingItem.id.replace('Q-', '')})? This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setCancelConfirmOpen(false)}
                className="cursor-pointer py-3 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl"
              >
                Keep Entry
              </button>
              <button
                onClick={handleConfirmCancel}
                className="cursor-pointer py-3 bg-red-600 hover:bg-red-700 text-brand-cream text-xs font-bold rounded-xl shadow-md"
              >
                Yes, Cancel Entry
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
