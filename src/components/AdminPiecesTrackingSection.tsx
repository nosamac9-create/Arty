/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp, getRiyadhDateString } from '../context/AppContext';
import { 
  Flame, LayoutGrid, List, Search, Filter, AlertCircle, X, Check, 
  MapPin, User, Calendar, RefreshCw, ClipboardList, Clock, Sparkles,
  Camera, Hash, Upload
} from 'lucide-react';
import { PotteryPiece } from '../types';
import { PhoneInput } from './PhoneInput';

export const AdminPiecesTrackingSection: React.FC = () => {
  const { pieces, updatePieceStatus, addPiece, updatePiece, workshops, bookings } = useApp();

  // Views and Filters state
  const [viewMode, setViewMode] = useState<'Board' | 'Table'>('Board');
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [awaitingCollectionOnly, setAwaitingCollectionOnly] = useState(false);

  // Date Filters state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [dateField, setDateField] = useState<'dateCreated' | 'expectedCompletion' | 'readyDate' | 'collectionDate'>('dateCreated');

  // Modal State
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  // Editing Piece State (within Detail Modal)
  const [isEditingPiece, setIsEditingPiece] = useState(false);
  const [editExpectedReadyDate, setEditExpectedReadyDate] = useState('');
  const [editStorageLocation, setEditStorageLocation] = useState('');
  const [editPieceCode, setEditPieceCode] = useState('');
  const [editGlazingNotes, setEditGlazingNotes] = useState('');

  // On-screen staff toasts state
  const [toasts, setToasts] = useState<{ id: string; title: string; message: string; highlighted?: boolean }[]>([]);

  // Manual Log Form Modal State
  const [showManualLogModal, setShowManualLogModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [selectedCust, setSelectedCust] = useState<{ name: string; phone: string; email: string } | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [isNewCust, setIsNewCust] = useState(false);

  const [relatedWorkshopId, setRelatedWorkshopId] = useState('');
  const [pieceType, setPieceType] = useState('Mug');
  const [pieceCodeInput, setPieceCodeInput] = useState(() => `AC-${Math.floor(1000 + Math.random() * 9000)}`);
  const [pieceNameInput, setPieceNameInput] = useState('Custom Clay Vessel');
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState('Mug');
  const [dateCreatedInput, setDateCreatedInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [assignedStaffInput, setAssignedStaffInput] = useState('Lina');
  const [initialStatus, setInitialStatus] = useState<PotteryPiece['status']>('Created');
  const [storageLocationInput, setStorageLocationInput] = useState('Shelf A-1');
  const [expectedCompletionInput, setExpectedCompletionInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [expectedReadyDateInput, setExpectedReadyDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [manualNotes, setManualNotes] = useState('');

  // Backward Move Confirmation Modal State
  const [backwardMoveTarget, setBackwardMoveTarget] = useState<{ pieceId: string; currentStatus: PotteryPiece['status']; targetStatus: PotteryPiece['status'] } | null>(null);
  const [backwardPerformer, setBackwardPerformer] = useState('Lina Al-Sudais');
  const [backwardReason, setBackwardReason] = useState('');

  // Preset design photos mapping
  const PHOTO_PRESETS: Record<string, string> = {
    Mug: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
    Bowl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=400&q=80',
    Plate: 'https://images.unsplash.com/photo-1535401991746-da3d9055713e?auto=format&fit=crop&w=400&q=80',
    Vase: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=400&q=80',
    Sculpture: 'https://images.unsplash.com/photo-1576016770956-debb63d900ee?auto=format&fit=crop&w=400&q=80',
    Other: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=80'
  };

  // Helper to trigger animated on-screen toasts for staff
  const triggerToast = (title: string, message: string, highlighted?: boolean) => {
    const id = String(Date.now() + Math.random());
    setToasts(prev => [...prev, { id, title, message, highlighted }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Extract unique customers from existing bookings
  const uniqueCustomers = useMemo(() => {
    const customersMap = new Map<string, { name: string; phone: string; email: string }>();
    (bookings || []).forEach(b => {
      if (b.customerPhone) {
        customersMap.set(b.customerPhone, {
          name: b.customerName,
          phone: b.customerPhone,
          email: b.customerEmail || ''
        });
      }
    });
    return Array.from(customersMap.values());
  }, [bookings]);

  // Customer match filtering for typing autocomplete
  const filteredCustResults = useMemo(() => {
    if (!custSearch.trim()) return [];
    const q = custSearch.toLowerCase();
    return uniqueCustomers.filter(c => 
      (c.name || '').toLowerCase().includes(q) || 
      (c.phone || '').includes(q)
    );
  }, [uniqueCustomers, custSearch]);

  // Kanban Columns definitions
  const COLUMNS: PotteryPiece['status'][] = [
    'Created', 'Drying', 'In Processing', 'Glazing', 'Firing', 'Ready for Collection', 'Collected'
  ];

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper wrapper to handle piece status updates & trigger toast notices
  const handleUpdatePieceStatus = async (pieceId: string, status: PotteryPiece['status'], user: string, reason?: string) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;

    await updatePieceStatus(pieceId, status, user, reason);

    const isReady = status === 'Ready for Collection';
    triggerToast(
      isReady ? '🚨 Ready for Collection pickup!' : 'Status Shipped Successfully',
      `Piece ${piece.pieceCode || pieceId} (${piece.customerName}) has been updated to "${status}" by ${user}.${reason ? ` Reason: ${reason}` : ''}`,
      isReady
    );
  };

  // Route any status changes (Kanban drag-drop or details dropdown) to validate backward moves
  const onAttemptStatusChange = (pieceId: string, targetStatus: PotteryPiece['status']) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const oldStatus = piece.status;
    if (oldStatus === targetStatus) return;

    const stages = ['Created', 'Drying', 'In Processing', 'Glazing', 'Firing', 'Ready for Collection', 'Collected'];
    const oldIdx = stages.indexOf(oldStatus);
    const newIdx = stages.indexOf(targetStatus);

    if (newIdx < oldIdx) {
      setBackwardMoveTarget({
        pieceId,
        currentStatus: oldStatus,
        targetStatus
      });
      setBackwardPerformer('Lina Al-Sudais');
      setBackwardReason('');
    } else {
      handleUpdatePieceStatus(pieceId, targetStatus, 'Staff');
    }
  };

  const getColumnColorClass = (col: PotteryPiece['status']) => {
    switch (col) {
      case 'Created': return 'text-blue-600 border-blue-500 bg-blue-50';
      case 'Drying': return 'text-amber-600 border-amber-500 bg-amber-50';
      case 'In Processing': return 'text-indigo-600 border-indigo-500 bg-indigo-50';
      case 'Glazing': return 'text-purple-600 border-purple-500 bg-purple-50';
      case 'Firing': return 'text-orange-600 border-orange-500 bg-orange-50';
      case 'Ready for Collection': return 'text-emerald-700 border-emerald-500 bg-emerald-50';
      case 'Collected': return 'text-gray-600 border-gray-400 bg-gray-50';
      default: return 'text-brand-charcoal border-brand-clay bg-brand-sand';
    }
  };

  const getPieceDateValue = (p: PotteryPiece, field: typeof dateField): string => {
    switch (field) {
      case 'dateCreated': return p.dateCreated;
      case 'expectedCompletion': return p.expectedCompletion || '';
      case 'readyDate':
        return p.history?.find(h => h.status === 'Ready for Collection')?.timestamp.split('T')[0] || '';
      case 'collectionDate':
        return p.history?.find(h => h.status === 'Collected')?.timestamp.split('T')[0] || '';
      default: return p.dateCreated;
    }
  };

  const applyDateShortcut = (shortcut: 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'This Month' | 'All Time') => {
    const today = new Date();
    const rToday = getRiyadhDateString(today);
    if (shortcut === 'Today') {
      setStartDate(rToday);
      setEndDate(rToday);
    } else if (shortcut === 'Last 7 Days') {
      const past = new Date();
      past.setDate(today.getDate() - 6);
      setStartDate(getRiyadhDateString(past));
      setEndDate(rToday);
    } else if (shortcut === 'Last 30 Days') {
      const past = new Date();
      past.setDate(today.getDate() - 29);
      setStartDate(getRiyadhDateString(past));
      setEndDate(rToday);
    } else if (shortcut === 'This Month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(getRiyadhDateString(startOfMonth));
      setEndDate(rToday);
    } else if (shortcut === 'All Time') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Filter Pieces
  const processedPieces = useMemo(() => {
    let result = [...pieces];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => 
        (p.id || '').toLowerCase().includes(q) || 
        (p.pieceCode && p.pieceCode.toLowerCase().includes(q)) ||
        (p.name || '').toLowerCase().includes(q) || 
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.customerPhone || '').includes(q)
      );
    }

    if (overdueOnly) {
      result = result.filter(p => p.status !== 'Collected' && p.daysElapsed >= 10);
    }

    if (awaitingCollectionOnly) {
      result = result.filter(p => p.status === 'Ready for Collection');
    }

    if (startDate || endDate) {
      result = result.filter(p => {
        const val = getPieceDateValue(p, dateField);
        if (!val) return false;
        if (startDate && val < startDate) return false;
        if (endDate && val > endDate) return false;
        return true;
      });
    }

    return result;
  }, [pieces, search, overdueOnly, awaitingCollectionOnly, startDate, endDate, dateField]);

  const selectedPiece = useMemo(() => {
    return pieces.find(p => p.id === selectedPieceId) || null;
  }, [pieces, selectedPieceId]);

  return (
    <div className="p-6 space-y-6 text-left bg-brand-cream min-h-full">
      
      {/* Header with Title and Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-brand-clay/60 pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal flex items-center gap-2">
            <Flame className="h-6 w-6 text-brand-terracotta shrink-0" />
            <span>Ceramics Kiln & Shelf Tracker</span>
          </h1>
          <p className="text-xs text-brand-charcoal/60 mt-1">
            Supervise drying stages, kiln firing schedules, glaze dip stations, and pickup shelves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* Log Piece Manually Button */}
          <button
            onClick={() => {
              setPieceCodeInput(`AC-${Math.floor(1000 + Math.random() * 9000)}`);
              setShowManualLogModal(true);
            }}
            className="cursor-pointer px-4 py-2 bg-brand-terracotta hover:bg-brand-terracotta/95 text-brand-cream rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all duration-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>+ Log Piece Manually</span>
          </button>

          {/* Board vs List Table Switcher */}
          <div className="bg-white border border-brand-clay/70 p-1.5 rounded-xl flex items-center gap-2">
            <button
              onClick={() => setViewMode('Board')}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                viewMode === 'Board' ? 'bg-brand-terracotta text-brand-cream shadow-sm' : 'text-brand-charcoal/60 hover:text-brand-terracotta'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
            <button
              onClick={() => setViewMode('Table')}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                viewMode === 'Table' ? 'bg-brand-terracotta text-brand-cream shadow-sm' : 'text-brand-charcoal/60 hover:text-brand-terracotta'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-brand-clay/70 rounded-2xl p-4 shadow-2xs flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center">
        
        {/* Search and Toggles */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center flex-1">
          {/* Search by piece, customer, phone, code */}
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-charcoal/40" />
            <input
              type="text"
              placeholder="Search piece code, customer, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-brand-cream/40 border border-brand-clay/60 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-brand-charcoal"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setOverdueOnly(!overdueOnly)}
              className={`cursor-pointer px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                overdueOnly 
                  ? 'bg-red-50 text-red-700 border-red-300' 
                  : 'bg-brand-cream/35 border-brand-clay text-brand-charcoal/70 hover:bg-brand-sand'
              }`}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>Overdue Only (&gt;=10 days)</span>
            </button>

            <button
              onClick={() => setAwaitingCollectionOnly(!awaitingCollectionOnly)}
              className={`cursor-pointer px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors flex items-center gap-1.5 ${
                awaitingCollectionOnly 
                  ? 'bg-green-50 text-green-700 border-green-300' 
                  : 'bg-brand-cream/35 border-brand-clay text-brand-charcoal/70 hover:bg-brand-sand'
              }`}
            >
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>Ready for Pickup Only</span>
            </button>
          </div>
        </div>

        {/* Date Filter Dropdown and Date Inputs */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 bg-brand-cream/20 p-2.5 rounded-xl border border-brand-clay/40 shrink-0">
          <div className="flex items-center gap-1 bg-white px-2 py-1 border border-brand-clay/40 rounded-lg">
            <Calendar className="h-3.5 w-3.5 text-brand-charcoal/50 shrink-0" />
            <select
              value={dateField}
              onChange={e => setDateField(e.target.value as any)}
              className="bg-transparent border-none text-[11px] font-bold text-brand-charcoal focus:ring-0 cursor-pointer pr-8 py-0.5"
            >
              <option value="dateCreated">Date Created</option>
              <option value="expectedCompletion">Expected Completion Date</option>
              <option value="readyDate">Ready Date</option>
              <option value="collectionDate">Collection Date</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 justify-center">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-brand-clay/60 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
            />
            <span className="text-[11px] font-bold text-brand-charcoal/50">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-brand-clay/60 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-charcoal focus:outline-none focus:border-brand-terracotta"
            />
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center justify-center gap-1.5 border-t sm:border-t-0 sm:border-l border-brand-clay/30 pt-2 sm:pt-0 sm:pl-3">
            {(['Today', 'Last 7 Days', 'Last 30 Days', 'This Month', 'All Time'] as const).map(shortcut => {
              const rToday = getRiyadhDateString();
              const isToday = shortcut === 'Today' && startDate === rToday && endDate === rToday;
              const isAllTime = shortcut === 'All Time' && !startDate && !endDate;

              return (
                <button
                  key={shortcut}
                  onClick={() => applyDateShortcut(shortcut)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    isToday || isAllTime
                      ? 'bg-brand-terracotta text-brand-cream'
                      : 'bg-brand-sand/50 hover:bg-brand-sand text-brand-charcoal/70'
                  }`}
                >
                  {shortcut}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* VIEW PANEL: KANBAN BOARD */}
      {viewMode === 'Board' ? (
        <div className="flex flex-row flex-nowrap gap-4 overflow-x-auto pb-4 w-full select-none no-scrollbar items-start">
          {COLUMNS.map((col) => {
            const columnPieces = processedPieces.filter(p => p.status === col);
            
            return (
              <div 
                key={col} 
                className="flex flex-col shrink-0 w-[260px] bg-brand-cream/35 border border-brand-clay rounded-2xl p-3 h-[620px]"
              >
                
                {/* Column header title */}
                <div className={`p-2.5 h-11 rounded-xl border flex items-center justify-between font-bold text-xs shrink-0 ${getColumnColorClass(col)}`}>
                  <span className="truncate pr-1 uppercase tracking-wider text-[10px] self-center">{col}</span>
                  <span className="bg-brand-cream rounded-full h-5 w-5 flex items-center justify-center text-[10px] text-brand-charcoal/80 border border-brand-clay/40 shrink-0 self-center">
                    {columnPieces.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto pr-1 py-1 mt-3 space-y-3 flex flex-col no-scrollbar">
                  {columnPieces.map((p) => {
                    const isOverdue = p.daysElapsed >= 10 && col !== 'Collected';
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedPieceId(p.id);
                          setEditExpectedReadyDate(p.expectedReadyDate || p.expectedCompletion || '');
                          setEditStorageLocation(p.storageLocation || '');
                          setEditPieceCode(p.pieceCode || p.id);
                          setEditGlazingNotes(p.additionalDescriptionGlazingNotes || p.notes || '');
                          setIsEditingPiece(false);
                        }}
                        className={`cursor-pointer bg-white p-3 rounded-xl border hover:shadow-2xs transition-all text-left space-y-3 w-full shrink-0 ${
                          isOverdue 
                            ? 'border-2 border-brand-terracotta ring-2 ring-brand-terracotta/5' 
                            : 'border-brand-clay/60 hover:border-brand-terracotta/45'
                        }`}
                      >
                        {/* Image */}
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-brand-sand shrink-0">
                          <img src={p.image} alt={p.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        </div>

                        {/* Title and stats */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[9px] font-bold text-brand-terracotta shrink-0 flex items-center gap-0.5">
                              <Hash className="h-2.5 w-2.5" />
                              {p.pieceCode || p.id}
                            </span>
                            <span className="text-[10px] font-bold text-brand-charcoal/50 shrink-0">{p.dateCreated}</span>
                          </div>
                          <h4 className="text-xs font-bold text-brand-charcoal truncate" title={p.name}>{p.name}</h4>
                          <p className="text-[10px] text-brand-sage font-semibold truncate" title={p.workshopName}>{p.workshopName}</p>
                          {(p.expectedReadyDate || p.expectedCompletion) && (
                            <p className="text-[9px] text-brand-terracotta font-bold flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Ready: {p.expectedReadyDate || p.expectedCompletion}</span>
                            </p>
                          )}
                        </div>

                        {/* Customer and days counter */}
                        <div className="pt-2 border-t border-brand-clay/30 flex items-center justify-between text-[10px] min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-brand-charcoal truncate pr-2" title={p.customerName}>{p.customerName}</p>
                          </div>
                          
                          <span className={`font-bold uppercase tracking-wider text-[9px] shrink-0 ${
                            isOverdue ? 'text-red-500 animate-pulse font-extrabold' : 'text-brand-charcoal/40'
                          }`}>
                            {p.daysElapsed} days
                          </span>
                        </div>

                      </div>
                    );
                  })}

                  {columnPieces.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-brand-clay/40 rounded-xl bg-brand-cream/10 p-4">
                      <p className="text-[10px] text-brand-charcoal/30 text-center font-bold italic">Empty stage</p>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW PANEL: DATA TABLE LIST */
        <div className="bg-white border border-brand-clay rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-brand-cream/40 border-b border-brand-clay/60 text-brand-charcoal/50 uppercase tracking-wider font-semibold">
                  <th className="p-4">Piece Code</th>
                  <th className="p-4">Piece Name</th>
                  <th className="p-4">Owner Name</th>
                  <th className="p-4">Workshop Origin</th>
                  <th className="p-4">Creation Date</th>
                  <th className="p-4">Expected Ready Date</th>
                  <th className="p-4">Storage Shelf</th>
                  <th className="p-4 text-center">Lifecycle Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-clay/30">
                {processedPieces.map((p) => {
                  const isOverdue = p.daysElapsed >= 10 && p.status !== 'Collected';
                  return (
                    <tr 
                      key={p.id}
                      onClick={() => {
                        setSelectedPieceId(p.id);
                        setEditExpectedReadyDate(p.expectedReadyDate || p.expectedCompletion || '');
                        setEditStorageLocation(p.storageLocation || '');
                        setEditPieceCode(p.pieceCode || p.id);
                        setEditGlazingNotes(p.additionalDescriptionGlazingNotes || p.notes || '');
                        setIsEditingPiece(false);
                      }}
                      className="cursor-pointer hover:bg-brand-sand/15 font-semibold"
                    >
                      <td className="p-4 font-mono font-bold text-brand-terracotta">{p.pieceCode || p.id}</td>
                      <td className="p-4 text-brand-charcoal font-bold">{p.name}</td>
                      <td className="p-4">{p.customerName}</td>
                      <td className="p-4 text-brand-sage">{p.workshopName}</td>
                      <td className="p-4">{p.dateCreated}</td>
                      <td className="p-4 font-bold text-brand-terracotta">{p.expectedReadyDate || p.expectedCompletion || 'N/A'}</td>
                      <td className="p-4 font-bold font-mono">{p.storageLocation || 'Unassigned'}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[10px] font-bold border ${getColumnColorClass(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PIECE DETAIL DIALOG MODAL */}
      {selectedPiece && (
        <div className="fixed inset-0 bg-brand-charcoal/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-lg w-full text-left space-y-6 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-brand-terracotta font-mono uppercase tracking-widest block">PIECE TRACKER DETAIL</span>
                <h3 className="font-display text-xl font-bold text-brand-charcoal">
                  <span>Code: {selectedPiece.pieceCode || selectedPiece.id}</span>
                </h3>
              </div>
              <button 
                onClick={() => setSelectedPieceId(null)}
                className="p-1 rounded-lg text-brand-charcoal hover:bg-brand-sand cursor-pointer focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Left Column: Big Photo Preview */}
              <div className="space-y-4">
                <div className="aspect-square w-full rounded-2xl overflow-hidden border border-brand-clay bg-brand-sand">
                  <img src={selectedPiece.image} alt={selectedPiece.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-brand-sage uppercase tracking-wider block">Assigned Pottery Staff</span>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-brand-terracotta text-brand-cream flex items-center justify-center font-bold text-[10px]">
                      {selectedPiece.assignedStaff?.charAt(0) || 'L'}
                    </div>
                    <span className="text-xs font-bold text-brand-charcoal">{selectedPiece.assignedStaff || 'Lina'}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Metadata Fields */}
              <div className="space-y-4 text-xs text-brand-charcoal">
                
                <div className="space-y-1.5">
                  <span className="font-bold text-brand-charcoal/50 block">Ceramic Piece Name</span>
                  <p className="text-sm font-bold text-brand-charcoal">{selectedPiece.name}</p>
                </div>

                <div className="space-y-1.5">
                  <span className="font-bold text-brand-charcoal/50 block">Artist Owner Info</span>
                  <div className="p-2.5 bg-brand-sand/40 border border-brand-clay rounded-xl">
                    <p className="font-bold">{selectedPiece.customerName}</p>
                    <p className="text-[10px] text-brand-charcoal/50 font-bold">{selectedPiece.customerPhone}</p>
                  </div>
                </div>

                {/* Editable Expected Ready Date and Storage Shelf */}
                <div className="space-y-3 bg-brand-sand/30 p-3 rounded-2xl border border-brand-clay/60">
                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block flex items-center justify-between">
                      <span>Expected-Ready Date</span>
                      <span className="text-[9px] text-brand-terracotta">Syncs to My Pieces</span>
                    </label>
                    <input
                      type="date"
                      value={editExpectedReadyDate}
                      onChange={e => setEditExpectedReadyDate(e.target.value)}
                      className="w-full bg-white border border-brand-clay/80 rounded-xl p-2 font-bold text-brand-charcoal"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">Storage Shelf</label>
                    <input
                      type="text"
                      value={editStorageLocation}
                      onChange={e => setEditStorageLocation(e.target.value)}
                      placeholder="Shelf C-4"
                      className="w-full bg-white border border-brand-clay/80 rounded-xl p-2 font-mono font-bold text-brand-charcoal"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/70 block">Additional Description / Glazing Notes</label>
                    <textarea
                      rows={3}
                      value={editGlazingNotes}
                      onChange={e => setEditGlazingNotes(e.target.value)}
                      placeholder="Add optional piece details, glazing colour requests, finishing instructions, or other notes…"
                      className="w-full bg-white border border-brand-clay/80 rounded-xl p-2 font-semibold text-brand-charcoal text-xs resize-y"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await updatePiece(selectedPiece.id, {
                        expectedReadyDate: editExpectedReadyDate,
                        expectedCompletion: editExpectedReadyDate,
                        storageLocation: editStorageLocation,
                        additionalDescriptionGlazingNotes: editGlazingNotes,
                        notes: editGlazingNotes
                      });
                      triggerToast('Updated Piece Details', `Piece details and glazing notes updated successfully.`, false);
                    }}
                    className="w-full bg-brand-terracotta text-brand-cream font-bold py-2 rounded-xl text-xs hover:bg-brand-terracotta-hover transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>

                {/* Status selector directly within the detail dialog */}
                <div className="space-y-1.5 pt-1">
                  <label className="font-bold text-brand-charcoal/50 block">Advance Lifecycle State</label>
                  <select
                    value={selectedPiece.status}
                    onChange={e => onAttemptStatusChange(selectedPiece.id, e.target.value as any)}
                    className="w-full bg-brand-cream border border-brand-clay rounded-xl p-2 font-bold text-brand-charcoal cursor-pointer"
                  >
                    {COLUMNS.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

              </div>

            </div>

            {/* Action buttons panel */}
            <div className="pt-4 border-t border-brand-clay/60 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onAttemptStatusChange(selectedPiece.id, 'Ready for Collection');
                  setSelectedPieceId(null);
                }}
                className="cursor-pointer bg-green-600 hover:bg-green-700 text-brand-cream font-bold text-xs py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Mark Ready for Pickup</span>
              </button>

              <button
                onClick={() => {
                  onAttemptStatusChange(selectedPiece.id, 'Collected');
                  setSelectedPieceId(null);
                }}
                className="cursor-pointer bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <ClipboardList className="h-4 w-4" />
                <span>Mark Collected / Picked Up</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Backward Move Confirmation Modal */}
      {backwardMoveTarget && (
        <div className="fixed inset-0 bg-brand-charcoal/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-md w-full text-left space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <h3 className="font-display text-lg font-bold text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <span>Confirm Reverting Stage</span>
              </h3>
              <button 
                onClick={() => setBackwardMoveTarget(null)}
                className="p-1 rounded-lg hover:bg-brand-sand cursor-pointer text-brand-charcoal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-brand-charcoal/70 leading-relaxed font-semibold">
              Warning: You are moving piece <span className="font-mono font-bold text-brand-terracotta">{backwardMoveTarget.pieceId}</span> backward from <span className="font-bold uppercase text-brand-charcoal">{backwardMoveTarget.currentStatus}</span> to <span className="font-bold uppercase text-brand-terracotta">{backwardMoveTarget.targetStatus}</span>. Reverting stages requires validation and a recorded justification.
            </p>

            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-brand-charcoal/60 block">Who is performing this reversal?</label>
                <input
                  type="text"
                  value={backwardPerformer}
                  onChange={e => setBackwardPerformer(e.target.value)}
                  className="w-full bg-brand-cream border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal"
                  placeholder="E.g. Lina Al-Sudais"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-brand-charcoal/60 block">Reason for Reversal / Correction note</label>
                <textarea
                  value={backwardReason}
                  onChange={e => setBackwardReason(e.target.value)}
                  className="w-full bg-brand-cream border border-brand-clay rounded-xl p-2.5 font-semibold text-brand-charcoal"
                  rows={3}
                  placeholder="E.g. Piece needs more drying time, glazing correction required..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setBackwardMoveTarget(null)}
                className="bg-brand-sand/60 hover:bg-brand-sand text-brand-charcoal font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors text-center"
              >
                Cancel Move
              </button>
              <button
                onClick={() => {
                  handleUpdatePieceStatus(
                    backwardMoveTarget.pieceId,
                    backwardMoveTarget.targetStatus,
                    backwardPerformer || 'Staff',
                    backwardReason || 'Stage corrected backward'
                  );
                  setBackwardMoveTarget(null);
                }}
                className="bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream font-bold text-xs py-3 rounded-xl cursor-pointer transition-colors text-center shadow-sm"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANUAL LOG PIECE MODAL - Cleaned & Updated to Prompt Rules */}
      {showManualLogModal && (
        <div className="fixed inset-0 bg-brand-charcoal/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl p-6 shadow-2xl max-w-2xl w-full text-left space-y-5 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] no-scrollbar">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-brand-terracotta font-mono uppercase tracking-widest block">Pottery Logging Console</span>
                <h3 className="font-display text-xl font-bold text-brand-charcoal flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-terracotta shrink-0" />
                  <span>Log Piece Manually</span>
                </h3>
              </div>
              <button 
                onClick={() => setShowManualLogModal(false)}
                className="p-1 rounded-lg text-brand-charcoal hover:bg-brand-sand cursor-pointer focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs text-brand-charcoal">
              
              {/* Left Column: Customer & Piece Type */}
              <div className="space-y-4">
                
                {/* Searchable Customer Input with PhoneInput */}
                <div className="space-y-1.5 relative">
                  <label className="font-bold text-brand-charcoal/60 block">1. Customer / Ceramic Owner *</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-charcoal/40" />
                    <input
                      type="text"
                      placeholder="Type customer name to search existing..."
                      value={custSearch}
                      onChange={e => {
                        setCustSearch(e.target.value);
                        if (selectedCust) {
                          setSelectedCust(null);
                          setIsNewCust(false);
                        }
                      }}
                      className="w-full bg-white border border-brand-clay rounded-xl py-2.5 pl-9 pr-3 font-semibold text-brand-charcoal"
                    />
                  </div>

                  {/* Customer matches drop-down list */}
                  {!selectedCust && custSearch.trim() && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-brand-clay rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-brand-clay/20">
                      {filteredCustResults.map(c => (
                        <button
                          key={c.phone}
                          type="button"
                          onClick={() => {
                            setSelectedCust(c);
                            setCustSearch(`${c.name} (${c.phone})`);
                            setManualName(c.name);
                            setManualPhone(c.phone);
                            setManualEmail(c.email);
                            setIsNewCust(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-brand-sand/35 font-semibold text-xs flex justify-between items-center cursor-pointer"
                        >
                          <div>
                            <p className="font-bold text-brand-charcoal">{c.name}</p>
                            <p className="text-[10px] text-brand-charcoal/50">{c.phone}</p>
                          </div>
                          <span className="text-[9px] font-bold bg-brand-sand/50 text-brand-sage px-1.5 py-0.5 rounded uppercase">Stored</span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCust({ name: custSearch, phone: '', email: '' });
                          setManualName(custSearch);
                          setManualPhone('');
                          setManualEmail('');
                          setIsNewCust(true);
                        }}
                        className="w-full text-left p-2.5 hover:bg-brand-terracotta/5 font-bold text-brand-terracotta text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Add "{custSearch}" as New Customer</span>
                      </button>
                    </div>
                  )}

                  {/* Customer Phone & Name */}
                  <div className="p-3 bg-brand-sand/35 border border-brand-clay/60 rounded-xl space-y-3 mt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-brand-charcoal/70">Customer Name *</label>
                      <input
                        type="text"
                        required
                        value={manualName}
                        onChange={e => setManualName(e.target.value)}
                        placeholder="e.g. Noura Al-Amri"
                        className="w-full bg-white border border-brand-clay rounded-xl p-2 font-bold text-brand-charcoal"
                      />
                    </div>

                    <PhoneInput
                      label="Customer Phone Number"
                      required
                      value={manualPhone}
                      onChange={setManualPhone}
                    />
                  </div>
                </div>

                {/* Optional Workshop dropdown */}
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-charcoal/60 block">2. Workshop / Class Origin (Optional)</label>
                  <select
                    value={relatedWorkshopId}
                    onChange={e => setRelatedWorkshopId(e.target.value)}
                    className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold text-brand-charcoal cursor-pointer"
                  >
                    <option value="">None / Freestyle Studio Play</option>
                    {workshops.map(w => (
                      <option key={w.id} value={w.id}>{w.title}</option>
                    ))}
                  </select>
                </div>

                {/* Piece Type Selection */}
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-charcoal/60 block">3. Pottery Piece Type</label>
                  <select
                    value={pieceType}
                    onChange={e => {
                      setPieceType(e.target.value);
                      setSelectedPresetPhoto(e.target.value);
                    }}
                    className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
                  >
                    <option value="Mug">Mug</option>
                    <option value="Bowl">Bowl</option>
                    <option value="Plate">Plate</option>
                    <option value="Vase">Vase</option>
                    <option value="Sculpture">Sculpture</option>
                    <option value="Other">Other (Trinket Box, Tile, etc.)</option>
                  </select>
                </div>

                {/* Additional Description / Glazing Notes */}
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-charcoal/80 block">4. Additional Description / Glazing Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Add optional piece details, glazing colour requests, finishing instructions, or other notes…"
                    value={manualNotes}
                    onChange={e => setManualNotes(e.target.value)}
                    className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold text-brand-charcoal text-xs resize-y"
                  />
                </div>

              </div>

              {/* Right Column: Piece Code, Camera Capture, Dates */}
              <div className="space-y-4">
                
                {/* OPTION 5: PIECE CODE (Required, Unique, Searchable) */}
                <div className="space-y-1.5">
                  <label className="font-bold text-brand-charcoal/80 block flex items-center justify-between">
                    <span>5. Piece Code *</span>
                    <span className="text-[10px] text-brand-terracotta font-mono">Unique Identifier</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-terracotta" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. AC-8802"
                      value={pieceCodeInput}
                      onChange={e => setPieceCodeInput(e.target.value.toUpperCase())}
                      className="w-full bg-white border-2 border-brand-terracotta/40 rounded-xl py-2.5 pl-9 pr-3 font-mono font-bold text-brand-charcoal uppercase tracking-wider"
                    />
                  </div>
                  <p className="text-[10px] text-brand-charcoal/50 font-semibold">Unique piece code stamped/written on the physical piece.</p>
                </div>

                {/* OPTION 6: PHONE-CAMERA CAPTURE & PHOTO PREVIEW */}
                <div className="space-y-2 bg-brand-sand/30 p-3 rounded-2xl border border-brand-clay/60">
                  <label className="font-bold text-brand-charcoal/80 block">6. Photo Capture & Preview</label>
                  
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="aspect-video rounded-xl bg-brand-sand overflow-hidden border border-brand-clay relative">
                      <img 
                        src={customPhotoUrl || PHOTO_PRESETS[selectedPresetPhoto] || PHOTO_PRESETS.Other} 
                        alt="Preview" 
                        className="h-full w-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="cursor-pointer bg-brand-terracotta hover:bg-brand-terracotta-hover text-brand-cream text-[11px] font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors">
                        <Camera className="h-4 w-4" />
                        <span>Take Photo / Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleCameraCapture}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[9px] text-brand-charcoal/60 leading-tight">Use phone camera to snap piece photo directly.</p>
                    </div>
                  </div>
                </div>

                {/* DATES: Logged Date & Expected Ready Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-brand-charcoal/60 block">7. Date Logged</label>
                    <input
                      type="date"
                      value={dateCreatedInput}
                      onChange={e => setDateCreatedInput(e.target.value)}
                      className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-brand-charcoal/80 block text-brand-terracotta">8. Expected Ready Date *</label>
                    <input
                      type="date"
                      required
                      value={expectedReadyDateInput}
                      onChange={e => setExpectedReadyDateInput(e.target.value)}
                      className="w-full bg-white border-2 border-brand-terracotta/40 rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
                    />
                  </div>
                </div>

                {/* Storage shelf & Staff Assignment */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-bold text-brand-charcoal/60 block">9. Storage Shelf</label>
                    <input
                      type="text"
                      placeholder="Shelf B-1"
                      value={storageLocationInput}
                      onChange={e => setStorageLocationInput(e.target.value)}
                      className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-brand-charcoal/60 block">10. Assigned Staff</label>
                    <select
                      value={assignedStaffInput}
                      onChange={e => setAssignedStaffInput(e.target.value)}
                      className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
                    >
                      <option value="Lina">Lina (Studio Manager)</option>
                      <option value="Ali Khalid">Ali Khalid (Instructor)</option>
                      <option value="Aisha Al-Jahdali">Aisha Al-Jahdali (Instructor)</option>
                      <option value="Sami">Sami (Barista & Staff)</option>
                    </select>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-brand-clay/60 grid grid-cols-2 gap-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowManualLogModal(false)}
                className="bg-brand-sand/60 hover:bg-brand-sand text-brand-charcoal font-bold py-3 rounded-xl cursor-pointer transition-colors text-center"
              >
                Cancel / Reset
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!manualName.trim() || !manualPhone.trim()) {
                    alert('Please specify Customer Name and Phone number.');
                    return;
                  }

                  if (!pieceCodeInput.trim()) {
                    alert('Piece Code is required and must be unique.');
                    return;
                  }

                  // Uniqueness check for Piece Code
                  const normalizedPieceCode = pieceCodeInput.trim().toUpperCase();
                  const codeExists = pieces.some(p => {
                    const existingCode = (p.pieceCode || p.id).trim().toUpperCase();
                    return existingCode === normalizedPieceCode;
                  });

                  if (codeExists) {
                    alert(`Piece code '${normalizedPieceCode}' already exists. Please use a unique code.`);
                    return;
                  }

                  const selectedWorkshop = workshops.find(w => w.id === relatedWorkshopId);
                  const newPieceData = {
                    pieceCode: pieceCodeInput.trim(),
                    name: pieceNameInput.trim() || `${pieceType} Piece`,
                    workshopName: selectedWorkshop ? selectedWorkshop.title : 'Freestyle Handbuilding',
                    customerName: manualName.trim(),
                    customerPhone: manualPhone.trim(),
                    dateCreated: dateCreatedInput,
                    image: customPhotoUrl || PHOTO_PRESETS[selectedPresetPhoto] || PHOTO_PRESETS.Other,
                    status: initialStatus,
                    assignedStaff: assignedStaffInput,
                    storageLocation: storageLocationInput,
                    notes: manualNotes,
                    additionalDescriptionGlazingNotes: manualNotes,
                    expectedCompletion: expectedReadyDateInput,
                    expectedReadyDate: expectedReadyDateInput
                  };

                  await addPiece(newPieceData);

                  triggerToast(
                    '🎨 Ceramic Piece Added Successfully',
                    `Logged piece "${pieceCodeInput}" under customer "${manualName}".`,
                    false
                  );

                  setShowManualLogModal(false);
                  setPieceNameInput('Custom Clay Vessel');
                  setCustSearch('');
                  setManualName('');
                  setManualPhone('');
                  setSelectedCust(null);
                  setIsNewCust(false);
                  setRelatedWorkshopId('');
                  setCustomPhotoUrl('');
                  setManualNotes('');
                }}
                className="bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream font-bold py-3 rounded-xl cursor-pointer transition-colors text-center shadow-sm"
              >
                Create Piece Record
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Toast notifications container */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-xl flex gap-3 items-start justify-between animate-in slide-in-from-bottom-5 duration-300 ${
              t.highlighted 
                ? 'bg-gradient-to-r from-amber-50 to-amber-100/40 border-amber-400 text-amber-950 ring-4 ring-amber-400/10' 
                : 'bg-brand-charcoal text-brand-cream border-brand-charcoal/40'
            }`}
          >
            <div className="text-left">
              <p className={`text-xs font-extrabold uppercase tracking-wider ${t.highlighted ? 'text-amber-800 animate-pulse' : 'text-brand-sage'}`}>
                {t.title}
              </p>
              <p className="text-[11px] font-semibold mt-1 leading-relaxed">
                {t.message}
              </p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-xs font-bold hover:scale-110 cursor-pointer shrink-0 opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};
