/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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

// ==========================================
// ======== MODULAR QUEUE CARD COMPONENTS ===
// ==========================================

const WaitingCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (item: QueueItem) => void;
  onCancel: (item: QueueItem) => void;
  updateQueueStatus: (id: string, status: any) => void;
}> = ({ item, isExpanded, onToggle, onEdit, onCancel, updateQueueStatus }) => {
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
                {item.type === 'With Instructor' ? (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {item.staffName}
                  </span>
                ) : (
                  <span className="font-bold flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                    Self-Guided
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
  onToggle: () => void;
  onCancel: (item: QueueItem) => void;
  updateQueueStatus: (id: string, status: any) => void;
}> = ({ item, isExpanded, onToggle, onCancel, updateQueueStatus }) => {
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
                {item.type === 'With Instructor' && (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {item.staffName}
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

const InProgressCard: React.FC<{
  item: QueueItem;
  isExpanded: boolean;
  onToggle: () => void;
  updateQueueStatus: (id: string, status: any) => void;
  now: Date;
}> = ({ item, isExpanded, onToggle, updateQueueStatus, now }) => {
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
  
  let expectedCheckout = '';
  let remainingTimeStr = '';
  let isExceeded = false;

  if (isWithoutInstructor && hasHours && startTime) {
    const paidDurationMs = item.hours * 60 * 60 * 1000;
    const endTime = new Date(startTime.getTime() + paidDurationMs);
    
    expectedCheckout = endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    
    const remainingMs = endTime.getTime() - now.getTime();
    isExceeded = remainingMs <= 0;
    
    const absRemainingMs = Math.abs(remainingMs);
    const rSecs = Math.floor(absRemainingMs / 1000);
    const rMins = Math.floor(rSecs / 60);
    const rHrs = Math.floor(rMins / 60);
    
    remainingTimeStr = isExceeded
      ? `Overtime by ${rHrs > 0 ? rHrs + 'h ' : ''}${rMins % 60}m`
      : `${rHrs > 0 ? rHrs + 'h ' : ''}${rMins % 60}m left`;
  }

  return (
    <div className={`rounded-2xl p-4 shadow-2xs border-2 transition-all duration-300 flex flex-col gap-3 ${
      isExceeded 
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
            {isExceeded && (
              <div className="bg-red-100 border border-red-300 rounded-lg p-1 text-red-700 flex items-center gap-0.5 text-[9px] font-extrabold animate-bounce">
                <AlertTriangle className="h-3 w-3" />
                <span>OVERTIME</span>
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
                {item.type === 'With Instructor' ? (
                  <span className="font-bold flex items-center gap-1 bg-brand-sage/20 text-brand-sage-hover px-2 py-0.5 rounded">
                    🎓 {item.staffName}
                  </span>
                ) : (
                  <span className="font-bold flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                    Self-Guided
                  </span>
                )}
              </div>

              {/* Self guided Expected checkout details */}
              {isWithoutInstructor && hasHours && (
                <div className={`p-2 rounded-xl text-[11px] border leading-relaxed ${
                  isExceeded 
                    ? 'bg-red-100 border-red-200 text-red-800' 
                    : 'bg-brand-sand/20 border-brand-clay/40 text-brand-charcoal/80'
                }`}>
                  <div className="flex justify-between font-bold">
                    <span>Paid Hours:</span>
                    <span>{item.hours} hrs</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Est Checkout:</span>
                    <span>{expectedCheckout}</span>
                  </div>
                  <div className="flex justify-between font-extrabold border-t border-brand-clay/20 mt-1 pt-1">
                    <span>Status:</span>
                    <span className={isExceeded ? 'text-red-600 animate-pulse' : 'text-brand-sage-hover'}>
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
  onToggle: () => void;
}> = ({ item, isExpanded, onToggle }) => {
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const LiveQueueSection: React.FC = () => {
  const { queue, updateQueueStatus, updateQueueItem, addQueueItem, todayDateStr, formattedTodayDate, appSettings } = useApp();

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
  const [newWorkshopType, setNewWorkshopType] = useState<'Painting' | 'Wheel' | 'Pottery' | 'Handbuilding' | 'Other'>('Painting'); // With Instructor
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit item modal states (for Waiting items)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QueueItem | null>(null);
  const [editGuests, setEditGuests] = useState(1);
  const [editStaffName, setEditStaffName] = useState('Unassigned');

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

  // Validation & Walk-in Submission
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!newName.trim()) {
      newErrors.name = 'Guest name is required';
    }
    if (!validateSaudiPhone(newPhone)) {
      newErrors.phone = 'Enter a valid Saudi mobile number, such as 0501234567 or +966501234567';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const isWithInstructor = walkInType === 'With Instructor';
    const activity = isWithInstructor
      ? `Walk-in (With Instructor: ${newWorkshopType})`
      : `Walk-in (No Instructor - ${newHours} hrs)`;

    const normPhone = normaliseSaudiPhone(newPhone);

    await addQueueItem({
      name: newName.trim(),
      phone: normPhone,
      activity,
      participants: newGuests,
      staffAvatar: isWithInstructor 
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      staffName: isWithInstructor ? 'Aisha Al-Jahdali' : 'Self-guided',
      source: 'Walk-in',
      type: walkInType,
      hours: isWithInstructor ? undefined : newHours,
      workshopType: isWithInstructor ? newWorkshopType : undefined
    });

    // Reset Form
    setNewName('');
    setNewPhone('+966 5');
    setNewGuests(1);
    setNewHours(1);
    setNewWorkshopType('Painting');
    setErrors({});
    setAddModalOpen(false);
    setActiveFilterTab('Waiting'); // Focus on Waiting tab for instant visual feedback
  };

  // Handle Edit Queue Item
  const handleOpenEdit = (item: QueueItem) => {
    setEditingItem(item);
    setEditGuests(item.participants);
    setEditStaffName(item.staffName);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    // Update the queue item fields
    const updates: Partial<QueueItem> = {
      participants: editGuests,
      staffName: editStaffName
    };
    
    // If with instructor, also update activity string to reflect staffName
    if (editingItem.type === 'With Instructor') {
      const parts = editingItem.activity.split(':');
      const wsType = parts[1] ? parts[1].replace(')', '').trim() : (editingItem.workshopType || 'Other');
      updates.activity = `Walk-in (With Instructor: ${wsType})`;
    }

    await updateQueueItem(editingItem.id, updates);
    setEditModalOpen(false);
    setEditingItem(null);
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
  const inProgressItems = useMemo(() => todayQueue.filter(q => q.status === 'In Progress'), [todayQueue]);
  const completedItems = useMemo(() => todayQueue.filter(q => q.status === 'Completed'), [todayQueue]);

  return (
    <div className="p-6 space-y-6 text-left bg-brand-cream min-h-full">
      
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

          <div className="space-y-4">
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

          <div className="space-y-4">
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

          <div className="space-y-4">
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
                  onToggle={() => toggleExpand(item.id)}
                  updateQueueStatus={updateQueueStatus}
                  now={now}
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

          <div className="space-y-4">
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
                  onToggle={() => toggleExpand(item.id)}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* ========================================================== */}
      {/* ================ WALK-IN CHECK-IN MODAL ================= */}
      {/* ========================================================== */}
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
                  onChange={e => { setNewName(e.target.value); if(errors.name) setErrors(prev => ({...prev, name: ''})); }}
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
                onChange={val => { setNewPhone(val); if(errors.phone) setErrors(prev => ({...prev, phone: ''})); }}
                error={errors.phone}
              />

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

              {/* OPTION B: WITH INSTRUCTOR SPECIFIC FIELDS */}
              {walkInType === 'With Instructor' && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <label className="text-xs font-bold text-brand-charcoal/80">
                    Workshop Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newWorkshopType}
                    onChange={e => setNewWorkshopType(e.target.value as any)}
                    className="w-full bg-white border border-brand-clay rounded-xl py-3 px-3.5 text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-terracotta focus:outline-none"
                  >
                    <option value="Painting">Painting</option>
                    <option value="Wheel">Wheel Throwing</option>
                    <option value="Pottery">Pottery</option>
                    <option value="Handbuilding">Handbuilding</option>
                    <option value="Other">Other</option>
                  </select>
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
                  <span className="text-sm font-bold text-brand-charcoal w-6 text-center">{editGuests}</span>
                  <button
                    onClick={() => setEditGuests(prev => prev + 1)}
                    className="h-8 w-8 rounded-lg bg-brand-sand hover:bg-brand-clay flex items-center justify-center font-bold text-brand-charcoal"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Dropdown for Instructor */}
              {editingItem.type === 'With Instructor' && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-charcoal/80">Assigned Instructor</label>
                  <select
                    value={editStaffName}
                    onChange={e => setEditStaffName(e.target.value)}
                    className="w-full bg-white border border-brand-clay rounded-xl py-2.5 px-3.5 text-xs font-bold text-brand-charcoal"
                  >
                    <option value="Aisha Al-Jahdali">Aisha Al-Jahdali</option>
                    <option value="Ali bin Khalid">Ali bin Khalid</option>
                    <option value="Faisal Al-Otaibi">Faisal Al-Otaibi</option>
                    <option value="Lina">Lina</option>
                    <option value="Sami">Sami</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
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
