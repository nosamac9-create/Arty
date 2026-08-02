/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown, Save, 
  UserPlus, Shield, Info, AlertTriangle, Palette, Clock, Lock, 
  MapPin, Sliders, Settings, Users, BookOpen, Calendar, HelpCircle, 
  ChevronDown, ChevronUp, GripVertical, RotateCcw
} from 'lucide-react';
import { PipelineStage, StaffMember, WorkshopOption } from '../types';
import { PhoneInput } from './PhoneInput';
import { PotteryLoggingConsoleSettings } from './PotteryLoggingConsoleSettings';
import { AdminCapacitySettings } from './AdminCapacitySettings';
import { AdminEventsSettings } from './AdminEventsSettings';

export const AdminSettingsSection: React.FC = () => {
  const {
    pipelineStages, staff, workshopOptions, appSettings,
    addPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages,
    addStaffMember, updateStaffMember, deleteStaffMember,
    addWorkshopOption, updateWorkshopOption, deleteWorkshopOption, reorderWorkshopOptions,
    updateSetting, pieces, workshops, removeAllData, reseedSampleData
  } = useApp();

  // Collapsible section states
  const [activeTab, setActiveTab] = useState<'stages' | 'workshops' | 'pottery-logging' | 'popup' | 'staff' | 'capacity' | 'events' | 'data-reset'>('stages');

  // Error/Notice modal state
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null);

  // Success feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ==========================================
  // SECTION 1: STAGES STATES & HANDLERS
  // ==========================================
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#E07A5F');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState('');
  const [editingStageColor, setEditingStageColor] = useState('');

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;
    await addPipelineStage({
      name: newStageName.trim(),
      color: newStageColor,
      visibleToCustomer: true
    });
    setNewStageName('');
    triggerToast('Pipeline stage added successfully!');
  };

  const handleSaveStageEdit = async (id: string) => {
    if (!editingStageName.trim()) return;
    await updatePipelineStage(id, {
      name: editingStageName.trim(),
      color: editingStageColor
    });
    setEditingStageId(null);
    triggerToast('Stage updated successfully!');
  };

  const handleDeleteStageClick = async (id: string) => {
    const res = await deletePipelineStage(id);
    if (!res.success) {
      setAlertModal({
        title: 'Action Blocked',
        message: res.message || 'Cannot delete stage.'
      });
    } else {
      triggerToast('Stage deleted successfully.');
    }
  };

  const handleMoveStage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pipelineStages.length) return;
    
    const reordered = [...pipelineStages];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    await reorderPipelineStages(reordered);
  };

  // HTML5 Drag handlers for native drag-and-drop
  const handleDragStartStage = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDropStage = async (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;
    const reordered = [...pipelineStages];
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, removed);
    await reorderPipelineStages(reordered);
  };

  // ==========================================
  // SECTION 2: WORKSHOP DETAIL OPTIONS HANDLERS
  // ==========================================
  const [selectedWorkshopListType, setSelectedWorkshopListType] = useState<WorkshopOption['type']>('skillLevel');
  const [newWorkshopOptionVal, setNewWorkshopOptionVal] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionVal, setEditingOptionVal] = useState('');

  const currentWorkshopListOptions = workshopOptions.filter(o => o.type === selectedWorkshopListType);

  const handleAddWorkshopOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkshopOptionVal.trim()) return;
    await addWorkshopOption({
      type: selectedWorkshopListType,
      value: newWorkshopOptionVal.trim()
    });
    setNewWorkshopOptionVal('');
    triggerToast('Option value added successfully!');
  };

  const handleSaveOptionEdit = async (id: string) => {
    if (!editingOptionVal.trim()) return;
    await updateWorkshopOption(id, editingOptionVal.trim());
    setEditingOptionId(null);
    triggerToast('Option updated successfully!');
  };

  const handleDeleteOptionClick = async (id: string) => {
    const res = await deleteWorkshopOption(id);
    if (!res.success) {
      setAlertModal({
        title: 'Option In Use',
        message: res.message || 'Cannot delete option.'
      });
    } else {
      triggerToast('Option deleted successfully.');
    }
  };

  const handleMoveOption = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentWorkshopListOptions.length) return;
    
    const reordered = [...currentWorkshopListOptions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    await reorderWorkshopOptions(selectedWorkshopListType, reordered);
  };

  // ==========================================
  // SECTION 3: PRE-PAYMENT INSTRUCTIONS HANDLERS
  // ==========================================
  const prePaymentConfig = appSettings.find(s => s.id === 'prePaymentInstructions')?.value || {
    enabled: true,
    title: 'Important Studio Safety & Timeline Instructions',
    body: '',
    requiredCheckbox: true,
    checkboxLabel: 'I confirm that I have read the guidelines and understand the timeline.'
  };

  const handleSavePrePaymentSettings = async (updates: Partial<typeof prePaymentConfig>) => {
    const newVal = { ...prePaymentConfig, ...updates };
    await updateSetting('prePaymentInstructions', newVal);
    triggerToast('Booking popup configuration updated!');
  };

  // ==========================================
  // SECTION 4: STAFF SECTION HANDLERS
  // ==========================================
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPosition, setNewStaffPosition] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  
  // Quick form for editing/adding
  const [staffForm, setStaffForm] = useState<Omit<StaffMember, 'id'>>({
    name: '',
    position: '',
    phone: '',
    email: '',
    status: 'Active',
    canAssignWorkshops: true,
    canAssignPieces: true
  });

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) return;
    await addStaffMember(staffForm);
    setStaffForm({
      name: '',
      position: '',
      phone: '',
      email: '',
      status: 'Active',
      canAssignWorkshops: true,
      canAssignPieces: true
    });
    triggerToast('Staff member added successfully!');
  };

  const handleStartEditStaff = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setStaffForm({
      name: member.name,
      position: member.position,
      phone: member.phone,
      email: member.email,
      status: member.status,
      canAssignWorkshops: member.canAssignWorkshops,
      canAssignPieces: member.canAssignPieces
    });
  };

  const handleSaveStaffEdit = async (id: string) => {
    await updateStaffMember(id, staffForm);
    setEditingStaffId(null);
    setStaffForm({
      name: '',
      position: '',
      phone: '',
      email: '',
      status: 'Active',
      canAssignWorkshops: true,
      canAssignPieces: true
    });
    triggerToast('Staff profile saved successfully!');
  };

  const handleDeleteStaffClick = async (id: string) => {
    const res = await deleteStaffMember(id);
    if (!res.success) {
      setAlertModal({
        title: 'Staff Active Assignments',
        message: res.message || 'Cannot delete staff.'
      });
    } else {
      triggerToast('Staff deleted successfully.');
    }
  };



  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300 text-left">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-brand-clay/30 mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-brand-charcoal">System Settings</h1>
          <p className="text-sm text-brand-charcoal/70 mt-1">
            Configure system lists, staff registry, pre-payment workflows, and pottery pipeline stages.
          </p>
        </div>
      </div>

      {/* QUICK FLOATING TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-brand-charcoal text-brand-cream text-xs font-bold py-3.5 px-6 rounded-xl border border-brand-clay/30 shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-5 duration-200">
          <Check className="h-4 w-4 text-brand-sage" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-brand-clay/30 pb-3">
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'stages'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Sliders className="h-4 w-4" />
          <span>Piece Pipeline Stages</span>
        </button>

        <button
          onClick={() => setActiveTab('workshops')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'workshops'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Palette className="h-4 w-4" />
          <span>Workshop Detail Lists</span>
        </button>

        <button
          onClick={() => setActiveTab('pottery-logging')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pottery-logging'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Pottery Logging Console</span>
        </button>

        <button
          onClick={() => setActiveTab('popup')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'popup'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Booking Pop-up</span>
        </button>

        <button
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Staff Registry</span>
        </button>

        <button
          onClick={() => setActiveTab('capacity')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'capacity'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Users className="h-4 w-4 text-brand-sage" />
          <span>Capacity & Tables</span>
        </button>

        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'events'
              ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
              : 'bg-white border-brand-clay/50 text-brand-charcoal/80 hover:bg-brand-sand/55'
          }`}
        >
          <Calendar className="h-4 w-4 text-brand-sand" />
          <span>Events & Birthdays</span>
        </button>

        <button
          onClick={() => setActiveTab('data-reset')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'data-reset'
              ? 'bg-red-600 border-red-600 text-white shadow-sm'
              : 'bg-white border-brand-clay/50 text-red-700 hover:bg-red-50'
          }`}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
          <span>Database & Reset</span>
        </button>

      </div>

      {/* ACTIVE SCREEN CONTENT PANEL */}
      <div className="bg-white border border-brand-clay/50 rounded-3xl p-6 md:p-8 shadow-xs">
        
        {/* =======================================================
            TAB: DATABASE & DATA RESET
            ======================================================= */}
        {activeTab === 'data-reset' && (
          <div className="space-y-6 text-left animate-in fade-in duration-200">
            <div className="border-b border-brand-clay/40 pb-4">
              <h2 className="font-display text-xl font-extrabold text-brand-charcoal">Database Operations & Data Purge</h2>
              <p className="text-xs text-brand-charcoal/70 mt-1">
                Manage IndexedDB persistent storage, perform full data wipes, or restore initial sample data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 bg-red-50/50 border border-red-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <Trash2 className="h-5 w-5" />
                  <span>Wipe All Website Data</span>
                </div>
                <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                  Permanently deletes all customer accounts, bookings, queue entries, pottery pieces, events, workshops, staff profiles, and studio configuration records.
                </p>
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to completely remove ALL data from the website? This cannot be undone.")) {
                      await removeAllData();
                      alert("All website data has been wiped clean.");
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Purge All Data Now</span>
                </button>
              </div>

              <div className="p-5 bg-brand-cream/35 border border-brand-clay rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-brand-terracotta font-bold text-sm">
                  <RotateCcw className="h-5 w-5" />
                  <span>Restore Sample Data</span>
                </div>
                <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                  Re-populates the website database with initial default sample workshops, sessions, queue items, and staff records.
                </p>
                <button
                  onClick={async () => {
                    if (window.confirm("Do you want to restore initial sample data to the website?")) {
                      await reseedSampleData();
                    }
                  }}
                  className="px-4 py-2 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Re-seed Sample Data</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* =======================================================
            TAB: POTTERY LOGGING CONSOLE
            ======================================================= */}
        {activeTab === 'pottery-logging' && (
          <PotteryLoggingConsoleSettings />
        )}

        {/* =======================================================
            TAB: CAPACITY & TABLES
            ======================================================= */}
        {activeTab === 'capacity' && (
          <AdminCapacitySettings />
        )}

        {/* =======================================================
            TAB: EVENTS & BIRTHDAYS
            ======================================================= */}
        {activeTab === 'events' && (
          <AdminEventsSettings />
        )}
        
        {/* =======================================================
            TAB 1: PIECE PIPELINE STAGES
            ======================================================= */}
        {activeTab === 'stages' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-charcoal flex items-center gap-2">
                <Sliders className="h-5 w-5 text-brand-terracotta" />
                <span>Piece Pipeline Stages Management</span>
              </h2>
              <p className="text-xs text-brand-charcoal/60 mt-1">
                Customize the sequence of ceramic lifecycle stages. Drag and drop stage items or use the up/down arrows to reorder them. 
                Visible stages appear on the customer progress timeline.
              </p>
            </div>

            {/* Quick Add Stage Form */}
            <form onSubmit={handleAddStage} className="p-4 bg-brand-sand/30 border border-brand-clay/40 rounded-2xl flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <label className="text-xs font-bold text-brand-charcoal/80">Stage Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Clay Drying"
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                />
              </div>

              <div className="space-y-1.5 shrink-0">
                <label className="text-xs font-bold text-brand-charcoal/80 block">Label Color Accent</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newStageColor}
                    onChange={e => setNewStageColor(e.target.value)}
                    className="h-9 w-12 rounded border border-brand-clay cursor-pointer p-0"
                  />
                  <span className="text-xs font-mono font-bold text-brand-charcoal/60">{newStageColor.toUpperCase()}</span>
                </div>
              </div>

              <button
                type="submit"
                className="bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 h-9"
              >
                <Plus className="h-4 w-4" />
                <span>Add Stage</span>
              </button>
            </form>

            {/* List Table with native drag and drop indicator */}
            <div className="border border-brand-clay/50 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-sand/30 border-b border-brand-clay/30 text-brand-charcoal/60 font-bold">
                    <th className="p-3 w-12"></th>
                    <th className="p-3">Stage Name</th>
                    <th className="p-3 w-28 text-center">Status Color</th>
                    <th className="p-3 w-40 text-center">Visible to Customers</th>
                    <th className="p-3 w-32 text-center">Reorder</th>
                    <th className="p-3 w-24 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-clay/20">
                  {pipelineStages.map((stage, idx) => {
                    const isEditing = editingStageId === stage.id;
                    const stageCount = pieces.filter(p => p.status === stage.name).length;
                    
                    return (
                      <tr 
                        key={stage.id} 
                        draggable={!isEditing}
                        onDragStart={(e) => handleDragStartStage(e, idx)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDropStage(e, idx)}
                        className={`hover:bg-brand-sand/15 transition-colors group ${
                          isEditing ? 'bg-brand-sand/20' : ''
                        }`}
                      >
                        {/* Drag Handle Indicator */}
                        <td className="p-3 text-center text-brand-charcoal/30 cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-4 w-4 mx-auto group-hover:text-brand-charcoal/60 transition-colors" />
                        </td>

                        {/* Stage Name Block */}
                        <td className="p-3 font-semibold text-brand-charcoal">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingStageName}
                              onChange={e => setEditingStageName(e.target.value)}
                              className="w-full bg-white border border-brand-clay/80 rounded-lg p-1.5 text-xs font-semibold text-brand-charcoal"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{stage.name}</span>
                              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-brand-sand text-brand-charcoal/60 border border-brand-clay/40">
                                {stageCount} piece(s)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Status Color Badge block */}
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <input
                              type="color"
                              value={editingStageColor}
                              onChange={e => setEditingStageColor(e.target.value)}
                              className="h-8 w-14 rounded border border-brand-clay cursor-pointer p-0"
                            />
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="h-3 w-3 rounded-full border border-brand-charcoal/10" style={{ backgroundColor: stage.color }}></span>
                              <span className="font-mono text-[10px] font-semibold text-brand-charcoal/60">{stage.color.toUpperCase()}</span>
                            </div>
                          )}
                        </td>

                        {/* Customer visibility slider block */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => updatePipelineStage(stage.id, { visibleToCustomer: !stage.visibleToCustomer })}
                            className={`px-3 py-1 text-[10px] font-extrabold rounded-full border cursor-pointer transition-all ${
                              stage.visibleToCustomer 
                                ? 'bg-brand-sage/10 text-brand-sage border-brand-sage' 
                                : 'bg-brand-charcoal/5 text-brand-charcoal/40 border-brand-clay/60'
                            }`}
                          >
                            {stage.visibleToCustomer ? '✓ Timeline Visible' : '✗ Hidden'}
                          </button>
                        </td>

                        {/* Arrow key manual sorting fallback block */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveStage(idx, 'up')}
                              className="p-1 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === pipelineStages.length - 1}
                              onClick={() => handleMoveStage(idx, 'down')}
                              className="p-1 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Standard edit and delete actions block */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveStageEdit(stage.id)}
                                  className="p-1 bg-brand-sage text-brand-cream rounded-lg border border-brand-sage hover:bg-brand-sage/95 cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingStageId(null)}
                                  className="p-1 bg-brand-terracotta text-brand-cream rounded-lg border border-brand-terracotta hover:bg-brand-terracotta/95 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStageId(stage.id);
                                    setEditingStageName(stage.name);
                                    setEditingStageColor(stage.color);
                                  }}
                                  className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 text-brand-charcoal/75 cursor-pointer"
                                  title="Edit Stage"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStageClick(stage.id)}
                                  className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-red-50 text-red-600 hover:border-red-300 cursor-pointer"
                                  title="Delete Stage"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 2: WORKSHOP DETAIL OPTIONS
            ======================================================= */}
        {activeTab === 'workshops' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-charcoal flex items-center gap-2">
                <Palette className="h-5 w-5 text-brand-terracotta" />
                <span>Workshop Detail Options Manager</span>
              </h2>
              <p className="text-xs text-brand-charcoal/60 mt-1">
                Configure option dropdown lists utilized by the workshop scheduler and creation forms. 
                Deleting an option will be blocked if any workshop currently depends on it.
              </p>
            </div>

            {/* List Type Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-brand-clay/30 pb-4">
              {([
                { key: 'skillLevel', label: 'Skill Levels' },
                { key: 'category', label: 'Categories' },
                { key: 'workshopType', label: 'Workshop Types' },
                { key: 'room', label: 'Studio Rooms' },
                { key: 'material', label: 'Materials' },
              ] as const).map(l => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => {
                    setSelectedWorkshopListType(l.key);
                    setEditingOptionId(null);
                  }}
                  className={`py-2 px-3 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                    selectedWorkshopListType === l.key
                      ? 'bg-brand-charcoal border-brand-charcoal text-brand-cream'
                      : 'bg-brand-sand/20 border-brand-clay text-brand-charcoal/85 hover:bg-brand-sand/50'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {/* Add Option Form */}
            <form onSubmit={handleAddWorkshopOption} className="p-4 bg-brand-sand/30 border border-brand-clay/40 rounded-2xl flex gap-3 items-end">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-bold text-brand-charcoal/80 block capitalize">New {selectedWorkshopListType.replace(/([A-Z])/g, ' $1')} Value</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Masterclass or Studio C"
                  value={newWorkshopOptionVal}
                  onChange={e => setNewWorkshopOptionVal(e.target.value)}
                  className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                />
              </div>

              <button
                type="submit"
                className="bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-xs font-bold py-2.5 px-4 rounded-xl transition-colors cursor-pointer flex items-center gap-2 h-9 shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
            </form>

            {/* List Table */}
            <div className="border border-brand-clay/50 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-sand/30 border-b border-brand-clay/30 text-brand-charcoal/60 font-bold">
                    <th className="p-3">Option Value</th>
                    <th className="p-3 w-40 text-center">Order Ranking</th>
                    <th className="p-3 w-32 text-center">Sort</th>
                    <th className="p-3 w-32 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-clay/20">
                  {currentWorkshopListOptions.map((opt, idx) => {
                    const isEditing = editingOptionId === opt.id;
                    
                    return (
                      <tr key={opt.id} className="hover:bg-brand-sand/15 transition-colors">
                        {/* Value Column */}
                        <td className="p-3 font-semibold text-brand-charcoal">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingOptionVal}
                              onChange={e => setEditingOptionVal(e.target.value)}
                              className="w-full max-w-sm bg-white border border-brand-clay/80 rounded-lg p-1.5 text-xs font-semibold text-brand-charcoal"
                            />
                          ) : (
                            <span>{opt.value}</span>
                          )}
                        </td>

                        {/* Order ranking Index */}
                        <td className="p-3 text-center font-semibold font-mono text-brand-charcoal/55">
                          Index {idx}
                        </td>

                        {/* Order arrow ranking buttons */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveOption(idx, 'up')}
                              className="p-1 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === currentWorkshopListOptions.length - 1}
                              onClick={() => handleMoveOption(idx, 'down')}
                              className="p-1 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Value actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveOptionEdit(opt.id)}
                                  className="p-1 bg-brand-sage text-brand-cream rounded-lg border border-brand-sage hover:bg-brand-sage/95 cursor-pointer"
                                  title="Save Changes"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOptionId(null)}
                                  className="p-1 bg-brand-terracotta text-brand-cream rounded-lg border border-brand-terracotta hover:bg-brand-terracotta/95 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingOptionId(opt.id);
                                    setEditingOptionVal(opt.value);
                                  }}
                                  className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 text-brand-charcoal/75 cursor-pointer"
                                  title="Edit Item"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOptionClick(opt.id)}
                                  className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-red-50 text-red-600 hover:border-red-300 cursor-pointer"
                                  title="Delete Item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 3: PRE-PAYMENT INSTRUCTIONS POP-UP
            ======================================================= */}
        {activeTab === 'popup' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-charcoal flex items-center gap-2">
                <Clock className="h-5 w-5 text-brand-terracotta" />
                <span>Pre-payment Instructions Pop-up Config</span>
              </h2>
              <p className="text-xs text-brand-charcoal/60 mt-1">
                Customize the overlay dialog modal displayed to customers right before they confirm their payment booking. 
                This ensures they agree to safety standards, workshop timelines, and studio guidelines beforehand.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Form Config Block */}
              <div className="lg:col-span-2 space-y-5">
                {/* Active switch slider */}
                <div className="flex items-center justify-between p-4 bg-brand-sand/20 border border-brand-clay/40 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-bold text-brand-charcoal">Enable Guidelines Pop-up Overlay</h4>
                    <p className="text-[10px] text-brand-charcoal/60">Toggle whether this popup appears prior to checkouts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSavePrePaymentSettings({ enabled: !prePaymentConfig.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      prePaymentConfig.enabled ? 'bg-brand-sage' : 'bg-brand-charcoal/25'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        prePaymentConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Pop-up Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-charcoal/80">Pop-up Header Title</label>
                  <input
                    type="text"
                    required
                    value={prePaymentConfig.title}
                    onChange={e => handleSavePrePaymentSettings({ title: e.target.value })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>

                {/* Pop-up Rich Text HTML Body */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-brand-charcoal/80">Pop-up Content (Pristine HTML Mode)</label>
                    <span className="text-[10px] font-bold text-brand-terracotta bg-brand-terracotta/5 px-2 py-0.5 rounded border border-brand-terracotta/25">HTML Supported</span>
                  </div>
                  <textarea
                    rows={8}
                    value={prePaymentConfig.body}
                    onChange={e => handleSavePrePaymentSettings({ body: e.target.value })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl p-3 text-xs font-mono text-brand-charcoal leading-relaxed"
                    placeholder="<p>Safety Rules...</p>"
                  />
                </div>

                {/* Toggle checkbox requirement */}
                <div className="flex items-start gap-3 p-4 bg-brand-sand/10 border border-brand-clay/30 rounded-2xl">
                  <input
                    type="checkbox"
                    id="reqCheck"
                    checked={prePaymentConfig.requiredCheckbox}
                    onChange={e => handleSavePrePaymentSettings({ requiredCheckbox: e.target.checked })}
                    className="h-4 w-4 text-brand-terracotta border-brand-clay rounded focus:ring-brand-terracotta mt-0.5 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="reqCheck" className="text-xs font-bold text-brand-charcoal cursor-pointer">Require Checkout Checkbox Confirmation</label>
                    <p className="text-[10px] text-brand-charcoal/60">If enabled, the customer MUST check a box affirming they understand before purchasing.</p>
                  </div>
                </div>

                {/* Custom checkbox Label Input */}
                {prePaymentConfig.requiredCheckbox && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-charcoal/80">Custom Checkbox Agreement Label</label>
                    <input
                      type="text"
                      value={prePaymentConfig.checkboxLabel}
                      onChange={e => handleSavePrePaymentSettings({ checkboxLabel: e.target.value })}
                      className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal"
                    />
                  </div>
                )}
              </div>

              {/* Interactive Live Preview Box */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-brand-charcoal uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-brand-terracotta animate-pulse" />
                  <span>Real-time Live Preview</span>
                </h4>

                <div className="bg-brand-sand/30 border border-brand-clay/75 rounded-2xl p-5 space-y-4 shadow-sm text-left relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-terracotta"></div>
                  
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-brand-terracotta/10 rounded-xl text-brand-terracotta shrink-0">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-brand-charcoal">{prePaymentConfig.title || 'Untitled guidelines'}</h3>
                      <p className="text-[10px] text-brand-charcoal/50 font-bold uppercase tracking-wider mt-0.5">Pre-Payment studio briefing</p>
                    </div>
                  </div>

                  {/* Render content snippet */}
                  <div 
                    className="text-xs text-brand-charcoal/80 leading-relaxed space-y-2 border-y border-brand-clay/30 py-3 my-2 max-h-48 overflow-y-auto pr-1"
                    dangerouslySetInnerHTML={{ __html: prePaymentConfig.body || '<i>No guidelines body configured yet.</i>' }}
                  />

                  {/* Render Checkbox Confirmation preview */}
                  {prePaymentConfig.requiredCheckbox ? (
                    <div className="flex items-start gap-2.5 pt-1">
                      <input type="checkbox" readOnly checked={false} className="h-3.5 w-3.5 border-brand-clay text-brand-terracotta rounded mt-0.5" />
                      <span className="text-[10px] font-semibold text-brand-charcoal/70 leading-normal">{prePaymentConfig.checkboxLabel}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold text-brand-sage flex items-center gap-1 bg-brand-sage/5 p-2 rounded-lg border border-brand-sage/10">
                      <span>✓ Unconditional Booking: Customers can immediately click purchase.</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2 text-[10px] font-bold">
                    <button type="button" className="px-3.5 py-2 rounded-lg border border-brand-clay bg-white text-brand-charcoal/60">Cancel</button>
                    <button type="button" className="px-4 py-2 rounded-lg bg-brand-terracotta text-brand-cream">Confirm & Pay</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =======================================================
            TAB 4: STAFF REGISTRY
            ======================================================= */}
        {activeTab === 'staff' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-charcoal flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-terracotta" />
                <span>Staff Member Registry & Permissions</span>
              </h2>
              <p className="text-xs text-brand-charcoal/60 mt-1">
                Registry list for instructors, coaches, and studio managers. 
                Configure granular roles for tutoring class assignments or tracking handcrafted pieces.
              </p>
            </div>

            {/* Quick Add / Edit Form Block */}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingStaffId) {
                handleSaveStaffEdit(editingStaffId);
              } else {
                handleAddStaff(e);
              }
            }} className="p-5 bg-brand-sand/30 border border-brand-clay/50 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider">
                {editingStaffId ? '✏️ Edit Staff Profile' : '➕ Register New Staff Member'}
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Staff Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lina Al-Sudais"
                    value={staffForm.name}
                    onChange={e => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Position / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Instructor"
                    value={staffForm.position}
                    onChange={e => setStaffForm(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>

                <PhoneInput
                  label="Phone Number"
                  value={staffForm.phone}
                  onChange={val => setStaffForm(prev => ({ ...prev, phone: val }))}
                />

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. lina@artycafe.com"
                    value={staffForm.email}
                    onChange={e => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>
              </div>

              {/* Status and roles switches */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-brand-clay/20">
                <div className="flex items-center gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-brand-charcoal/80 block">Activity Status</label>
                    <select
                      value={staffForm.status}
                      onChange={e => setStaffForm(prev => ({ ...prev, status: e.target.value as any }))}
                      className="bg-white border border-brand-clay/60 rounded-lg p-1 text-xs font-bold text-brand-charcoal cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Roles checkboxes */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-brand-charcoal">
                    <input
                      type="checkbox"
                      checked={staffForm.canAssignWorkshops}
                      onChange={e => setStaffForm(prev => ({ ...prev, canAssignWorkshops: e.target.checked }))}
                      className="h-4 w-4 border-brand-clay text-brand-terracotta rounded"
                    />
                    <span>Can tutor classes</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-brand-charcoal">
                    <input
                      type="checkbox"
                      checked={staffForm.canAssignPieces}
                      onChange={e => setStaffForm(prev => ({ ...prev, canAssignPieces: e.target.checked }))}
                      className="h-4 w-4 border-brand-clay text-brand-terracotta rounded"
                    />
                    <span>Can process pottery</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  {editingStaffId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaffId(null);
                        setStaffForm({
                          name: '',
                          position: '',
                          phone: '',
                          email: '',
                          status: 'Active',
                          canAssignWorkshops: true,
                          canAssignPieces: true
                        });
                      }}
                      className="px-4 py-2 border border-brand-clay rounded-xl text-xs font-bold text-brand-charcoal hover:bg-white transition-colors cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-xs font-bold py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 h-9 shrink-0"
                  >
                    {editingStaffId ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    <span>{editingStaffId ? 'Save Profile' : 'Register Staff'}</span>
                  </button>
                </div>
              </div>
            </form>

            {/* List registry grid table */}
            <div className="border border-brand-clay/50 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-sand/30 border-b border-brand-clay/30 text-brand-charcoal/60 font-bold">
                    <th className="p-3">Staff Profile</th>
                    <th className="p-3">Contact info</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Permissions</th>
                    <th className="p-3 w-28 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-clay/20">
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-brand-sand/15 transition-colors">
                      {/* Avatar & Name */}
                      <td className="p-3 text-left">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-brand-sand/65 text-brand-charcoal font-bold flex items-center justify-center border border-brand-clay/40 shrink-0 uppercase">
                            {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-bold text-brand-charcoal">{member.name}</h4>
                            <p className="text-[10px] text-brand-charcoal/60 font-semibold">{member.position}</p>
                          </div>
                        </div>
                      </td>

                      {/* Contact Column */}
                      <td className="p-3">
                        <div className="space-y-0.5 text-brand-charcoal/80 font-medium">
                          <p>{member.phone || '—'}</p>
                          <p className="text-[10px] text-brand-charcoal/50">{member.email || '—'}</p>
                        </div>
                      </td>

                      {/* Status badge Column */}
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                          member.status === 'Active'
                            ? 'bg-brand-sage/10 text-brand-sage border-brand-sage/40'
                            : member.status === 'On Leave'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-brand-charcoal/5 text-brand-charcoal/40 border-brand-clay/60'
                        }`}>
                          {member.status}
                        </span>
                      </td>

                      {/* Permissions badges Column */}
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {member.canAssignWorkshops && (
                            <span className="bg-brand-sand px-2 py-0.5 rounded text-[9px] font-bold text-brand-charcoal/65 border border-brand-clay/50">
                              Tutoring
                            </span>
                          )}
                          {member.canAssignPieces && (
                            <span className="bg-brand-sand px-2 py-0.5 rounded text-[9px] font-bold text-brand-charcoal/65 border border-brand-clay/50">
                              Ceramics
                            </span>
                          )}
                          {!member.canAssignWorkshops && !member.canAssignPieces && (
                            <span className="text-brand-charcoal/40 italic text-[10px]">None</span>
                          )}
                        </div>
                      </td>

                      {/* Registry actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditStaff(member)}
                            className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-brand-sand/50 text-brand-charcoal/75 cursor-pointer"
                            title="Edit Profile"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStaffClick(member.id)}
                            className="p-1.5 rounded-lg border border-brand-clay/40 hover:bg-red-50 text-red-600 hover:border-red-300 cursor-pointer"
                            title="Delete Profile"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}



      </div>

      {/* ALERT / EXPLANATORY MODAL OVERLAY */}
      {alertModal && (
        <div className="fixed inset-0 bg-brand-charcoal/65 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white border border-brand-clay rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-brand-terracotta/10 text-brand-terracotta rounded-xl shrink-0">
                <AlertTriangle className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <h3 className="font-display text-lg font-extrabold text-brand-charcoal">{alertModal.title}</h3>
                <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                  {alertModal.message}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAlertModal(null)}
                className="px-5 py-2.5 bg-brand-charcoal hover:bg-brand-charcoal/90 text-brand-cream text-xs font-bold rounded-xl cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
