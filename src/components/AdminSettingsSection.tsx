/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown, Save, 
  UserPlus, Shield, Info, AlertTriangle, Palette, Clock, Lock, 
  MapPin, Sliders, Settings, Users, BookOpen, Calendar, HelpCircle, 
  ChevronDown, ChevronUp, GripVertical, RotateCcw
, Pencil } from 'lucide-react';
import {
  PipelineStage, StaffMember, WorkshopOption, StaffRole,
  WORKSHOP_OPTION_LISTS, isWorkshopOptionEnabled,
  WorkshopFieldConfig, WorkshopFieldType, WorkshopCardSection,
  WORKSHOP_FIELD_TYPES, fieldTypeUsesOptions, fieldsForCard,
  PrePaymentPopupConfig, migratePrePaymentPopup, popupParagraphs
} from '../types';
import {
  ADMIN_PAGES, defaultPermissionsForRole, sanitizePermissions, isSuperAdmin, canAccessPage,
  isSuperAdminOnlyPage
} from '../utils/adminAccess';
import { normalizeCustomerPhone } from '../utils/customerIdentity';
import { validateStaffForm, staffStorageFields } from '../utils/validation';
import { PhoneInput } from './PhoneInput';
import { PotteryLoggingConsoleSettings } from './PotteryLoggingConsoleSettings';
import { AdminCapacitySettings } from './AdminCapacitySettings';
import { AdminEventsSettings } from './AdminEventsSettings';
import { LineListTextarea } from './ui/LineListTextarea';
import { usePagination, TablePager } from './ui/TablePager';

export const AdminSettingsSection: React.FC = () => {
  const {
    pipelineStages, staff, workshopOptions, appSettings,
    addPipelineStage, updatePipelineStage, deletePipelineStage, reorderPipelineStages,
    addStaffMember, updateStaffMember, deleteStaffMember,
    addWorkshopOption, updateWorkshopOption, deleteWorkshopOption, reorderWorkshopOptions,
    updateSetting, pieces, workshops, removeAllData, reseedSampleData,
    currentStaff, settingsSection, workshopFields, updateWorkshopFields
  } = useApp();

  // The open section comes from the sidebar submenu, so it survives a refresh
  // and direct navigation lands on the right section.
  const activeTab = settingsSection;

  // Nested sub-tab inside Workshop Detail Lists: which Workshop card is being configured.
  const [workshopListCard, setWorkshopListCard] = useState<WorkshopCardSection>('curriculum');

  // ---- Workshop card field configuration ----
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const cardFields = useMemo(
    () => fieldsForCard(workshopFields, workshopListCard, true),
    [workshopFields, workshopListCard]
  );

  const handleUpdateWorkshopField = (fieldId: string, updates: Partial<WorkshopFieldConfig>) => {
    updateWorkshopFields(
      workshopFields.map(f => (f.fieldId === fieldId ? { ...f, ...updates } : f))
    );
  };

  const handleToggleWorkshopField = (fieldId: string) => {
    const field = workshopFields.find(f => f.fieldId === fieldId);
    if (!field) return;
    handleUpdateWorkshopField(fieldId, { enabled: !field.enabled });
  };

  /** Reorders within the field's own card, leaving the other card untouched. */
  const handleMoveWorkshopField = (fieldId: string, direction: -1 | 1) => {
    const field = workshopFields.find(f => f.fieldId === fieldId);
    if (!field) return;

    const siblings = fieldsForCard(workshopFields, field.cardSection, true);
    const index = siblings.findIndex(f => f.fieldId === fieldId);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);

    const orderById = new Map(reordered.map((f, i) => [f.fieldId, i]));
    updateWorkshopFields(
      workshopFields.map(f =>
        orderById.has(f.fieldId) ? { ...f, displayOrder: orderById.get(f.fieldId)! } : f
      )
    );
  };

  const handleAddWorkshopField = () => {
    const stamp = Date.now();
    const siblings = fieldsForCard(workshopFields, workshopListCard, true);
    const newField: WorkshopFieldConfig = {
      fieldId: `wf-${stamp}`,
      // Stable key, independent of the label so renaming never loses values.
      fieldKey: `custom_${stamp}`,
      cardSection: workshopListCard,
      label: 'New Field',
      fieldType: 'short_text',
      required: false,
      enabled: true,
      displayOrder: siblings.length,
      customerVisible: false,
      createdAt: new Date().toISOString()
    };
    updateWorkshopFields([...workshopFields, newField]);
    setEditingFieldId(newField.fieldId);
  };

  /**
   * Deleting only removes the configuration record. Values already saved on
   * workshops stay in the database, so re-creating the field with the same key
   * brings them back.
   */
  const handleDeleteWorkshopField = (fieldId: string) => {
    const field = workshopFields.find(f => f.fieldId === fieldId);
    if (!field || field.system) return;

    const inUse = workshops.filter(w => w.customFields?.[field.fieldKey] !== undefined).length;
    const warning = inUse > 0
      ? `\n\n${inUse} workshop(s) already have a value for this field. Those values are kept in the database and are not deleted.`
      : '';

    if (!window.confirm(`Delete the "${field.label}" field?${warning}\n\nDisabling it instead keeps it on the form configuration.`)) return;

    updateWorkshopFields(workshopFields.filter(f => f.fieldId !== fieldId));
    setEditingFieldId(null);
  };

  /* Five rows a page in the registry. */
  const staffPager = usePagination(staff, 5);

  // ---- Staff Registry: console account & page permissions ----
  const [permissionsStaffId, setPermissionsStaffId] = useState<string | null>(null);
  const [permDraft, setPermDraft] = useState<{
    role: StaffRole;
    hasConsoleAccess: boolean;
    password: string;
    permissions: string[];
  }>({ role: 'Staff', hasConsoleAccess: false, password: '', permissions: [] });
  const [permSaved, setPermSaved] = useState(false);

  const permissionsStaff = permissionsStaffId
    ? staff.find(m => m.id === permissionsStaffId) || null
    : null;

  /** Only a Super Admin may grant or change console access. */
  const canManagePermissions = isSuperAdmin(currentStaff);

  const handleOpenPermissions = (member: StaffMember) => {
    setPermissionsStaffId(member.id);
    setPermDraft({
      role: member.role || 'Staff',
      hasConsoleAccess: member.hasConsoleAccess === true,
      password: member.password || '',
      permissions: sanitizePermissions(member.permissions)
    });
    setPermSaved(false);
  };

  const handleTogglePermission = (pageId: string) => {
    setPermDraft(prev => ({
      ...prev,
      permissions: prev.permissions.includes(pageId)
        ? prev.permissions.filter(id => id !== pageId)
        : [...prev.permissions, pageId]
    }));
  };

  const handleSavePermissions = async () => {
    if (!permissionsStaff) return;

    await updateStaffMember(permissionsStaff.id, {
      role: permDraft.role,
      hasConsoleAccess: permDraft.hasConsoleAccess,
      // Super Admin needs no page list; the role grants everything.
      permissions: permDraft.role === 'Super Admin' ? [] : sanitizePermissions(permDraft.permissions),
      password: permDraft.hasConsoleAccess ? (permDraft.password || undefined) : undefined,
      // staff.user_id is established ONLY by the provision-staff Edge
      // Function now (audit finding C-3) — never written from here. This
      // used to write userId: permissionsStaff.id (the staff record's own
      // id, not a real Auth uuid) whenever access was toggled on, silently
      // overwriting a correctly-provisioned real user_id with a placeholder.
      normalizedPhone: normalizeCustomerPhone(permissionsStaff.phone)
    });

    setPermSaved(true);
    setTimeout(() => setPermSaved(false), 2500);
  };

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

  // Workshop option lists are now configured per field inside the field editor
  // (Workshop Detail Lists), so the standalone option-list handlers are gone.

  // ==========================================
  // SECTION 3: PRE-PAYMENT INSTRUCTIONS HANDLERS
  // ==========================================
  // Always read through the migration so a legacy HTML body is surfaced as
  // editable plain text rather than markup.
  const prePaymentConfig = migratePrePaymentPopup(
    appSettings.find(s => s.id === 'prePaymentInstructions')?.value
  );

  // Edits are held locally until Save Changes is pressed. Writing on every
  // keystroke re-rendered the inputs from the database mid-typing, which moved
  // the caret and stripped spaces as they were typed.
  const [popupDraft, setPopupDraft] = useState<PrePaymentPopupConfig | null>(null);
  const [popupSaved, setPopupSaved] = useState(false);

  const savedPrePaymentConfig = prePaymentConfig;
  const popupForm = popupDraft ?? savedPrePaymentConfig;
  const popupDirty = popupDraft !== null;

  /** Records an edit without touching the database. */
  const editPrePaymentSettings = (updates: Partial<PrePaymentPopupConfig>) => {
    setPopupDraft(current => ({ ...(current ?? savedPrePaymentConfig), ...updates }));
    setPopupSaved(false);
  };

  const handleSavePrePaymentSettings = async () => {
    if (!popupDraft) return;
    // `body` is dropped on save, retiring the old HTML field for good.
    const newVal: PrePaymentPopupConfig = {
      ...popupDraft,
      // Blank leading/trailing lines are trimmed away; everything the admin
      // typed inside a line, spaces included, is stored exactly as written.
      instructions: popupDraft.instructions.filter(line => line.trim().length > 0)
    };
    await updateSetting('prePaymentInstructions', newVal);
    setPopupDraft(null);
    setPopupSaved(true);
    triggerToast('Booking pop-up saved!');
  };

  // ==========================================
  // SECTION 4: STAFF SECTION HANDLERS
  // ==========================================
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPosition, setNewStaffPosition] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  // Field-keyed messages from the shared validation layer.
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const clearStaffError = (key: string) =>
    setStaffErrors(prev => (prev[key] ? { ...prev, [key]: '' } : prev));
  
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

    // Shared rules: required fields plus duplicate phone/email across staff.
    const fieldErrors = await validateStaffForm(staffForm);
    setStaffErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    // Stored in the canonical format so duplicate checks and login matching work.
    await addStaffMember({ ...staffForm, ...staffStorageFields(staffForm) });
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
    setStaffErrors({});
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
    const fieldErrors = await validateStaffForm(staffForm, id);
    setStaffErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    await updateStaffMember(id, { ...staffForm, ...staffStorageFields(staffForm) });
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

      {/* Section navigation lives in the sidebar submenu under Settings, so the
          page renders only the selected section — no duplicate tab row here. */}


      {/* ACTIVE SCREEN CONTENT PANEL
          Every section renders inside one card, except Events & Birthday, which
          brings its own three — nesting those inside this one produced a card
          within a card. */}
      <div className={
        activeTab === 'settings-events'
          ? ''
          : 'bg-white border border-brand-clay/50 rounded-3xl p-6 md:p-8 shadow-xs'
      }>
        
        {/* =======================================================
            TAB: DATABASE & DATA RESET
            ======================================================= */}
        {activeTab === 'settings-data-reset' && (
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
                  Permanently deletes all customer accounts, bookings, queue entries, pottery pieces, workshops, and events. Staff profiles and studio configuration (pipeline stages, birthday packages, option lists) are preserved.
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
        {activeTab === 'settings-pottery-logging' && (
          <PotteryLoggingConsoleSettings />
        )}

        {/* =======================================================
            TAB: CAPACITY & TABLES
            ======================================================= */}
        {activeTab === 'settings-capacity' && (
          <AdminCapacitySettings />
        )}

        {/* =======================================================
            TAB: EVENTS & BIRTHDAYS
            ======================================================= */}
        {activeTab === 'settings-events' && (
          <AdminEventsSettings />
        )}
        
        {/* =======================================================
            TAB 1: PIECE PIPELINE STAGES
            ======================================================= */}
        {activeTab === 'settings-stages' && (
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
                    <th className="p-3 w-56">Customer-facing</th>
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

                        {/* Customer-facing settings — three labelled toggle
                            rows and the label field, rather than four chips of
                            different shapes competing in one cell. */}
                        <td className="p-3 align-top">
                          <div className="space-y-1.5 text-left">
                            {([
                              {
                                label: 'Enabled',
                                hint: 'Selectable for new updates',
                                on: stage.enabled !== false,
                                toggle: () => updatePipelineStage(stage.id, { enabled: stage.enabled === false })
                              },
                              {
                                label: 'On customer timeline',
                                hint: 'Shown on My Pieces',
                                on: stage.visibleToCustomer,
                                toggle: () => updatePipelineStage(stage.id, { visibleToCustomer: !stage.visibleToCustomer })
                              },
                              {
                                label: 'Notifies customer',
                                hint: 'Message sent on entering',
                                on: stage.notifyCustomer !== false,
                                toggle: () => updatePipelineStage(stage.id, { notifyCustomer: stage.notifyCustomer === false })
                              }
                            ]).map(row => (
                              <button
                                key={row.label}
                                type="button"
                                onClick={row.toggle}
                                role="switch"
                                aria-checked={row.on}
                                title={row.hint}
                                className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-brand-sand/40 cursor-pointer"
                              >
                                <span className={`text-[10px] font-bold ${
                                  row.on ? 'text-brand-charcoal' : 'text-brand-charcoal/40'
                                }`}>
                                  {row.label}
                                </span>
                                {/* One switch shape for all three, so the state
                                    reads at a glance down the column. */}
                                <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
                                  row.on ? 'bg-brand-sage' : 'bg-brand-clay'
                                }`}>
                                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                                    row.on ? 'left-3.5' : 'left-0.5'
                                  }`} />
                                </span>
                              </button>
                            ))}

                            <div className="space-y-0.5 border-t border-brand-clay/40 pt-1.5">
                              <label className="block px-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-charcoal/45">
                                Customer label
                              </label>
                              <input
                                type="text"
                                value={stage.customerLabel || ''}
                                onChange={e => updatePipelineStage(stage.id, { customerLabel: e.target.value })}
                                placeholder={stage.name}
                                className="w-full rounded-lg border border-brand-clay bg-brand-cream/40 px-2 py-1 text-[10px] font-semibold text-brand-charcoal"
                              />
                            </div>
                          </div>
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

              <div className="px-3 pb-3">
                <TablePager
                  page={staffPager.page}
                  totalPages={staffPager.totalPages}
                  from={staffPager.from}
                  to={staffPager.to}
                  total={staffPager.total}
                  onPage={staffPager.setPage}
                  noun="staff"
                />
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 2: WORKSHOP DETAIL OPTIONS
            ======================================================= */}
        {activeTab === 'settings-workshop-lists' && (
          <div className="space-y-6 text-left animate-in fade-in duration-200">

            <div>
              <h3 className="font-display text-xl font-extrabold text-brand-charcoal">Workshop Detail Lists</h3>
              <p className="text-xs text-brand-charcoal/70 mt-1">
                Controls the complete field structure of the two Workshop cards. Add, rename, reorder,
                disable and configure fields — the Workshop form renders exactly what is configured here.
              </p>
            </div>

            {/* Nested sub-tabs: the two Workshop page cards. */}
            <div className="flex gap-2 border-b border-brand-clay/30 pb-3">
              {([
                { key: 'curriculum', label: 'Curriculum Basics' },
                { key: 'logistics', label: 'Logistics & Metadata' }
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setWorkshopListCard(tab.key); setEditingFieldId(null); }}
                  className={`px-4 py-2 text-xs font-bold border rounded-xl transition-all cursor-pointer ${
                    workshopListCard === tab.key
                      ? 'bg-brand-terracotta border-brand-terracotta text-brand-cream shadow-sm'
                      : 'bg-white border-brand-clay text-brand-charcoal/80 hover:bg-brand-sand/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                onClick={handleAddWorkshopField}
                className="ml-auto px-4 py-2 bg-brand-charcoal hover:bg-black text-brand-cream rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {/* Field list for the selected card */}
            <div className="space-y-3">
              {cardFields.length === 0 && (
                <p className="text-xs text-brand-charcoal/50 italic py-4">
                  No fields configured for this card yet.
                </p>
              )}

              {cardFields.map((field, idx) => {
                const isEditingField = editingFieldId === field.fieldId;

                return (
                  <div
                    key={field.fieldId}
                    className={`border rounded-2xl overflow-hidden ${
                      field.enabled ? 'border-brand-clay bg-white' : 'border-brand-clay/50 bg-brand-sand/20'
                    }`}
                  >
                    {/* Row header */}
                    <div className="flex items-center justify-between gap-3 p-3.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-brand-charcoal/35">#{idx + 1}</span>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold truncate ${
                            field.enabled ? 'text-brand-charcoal' : 'text-brand-charcoal/45'
                          }`}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          <p className="text-[10px] font-mono text-brand-charcoal/40">
                            {field.fieldKey} · {WORKSHOP_FIELD_TYPES.find(t => t.value === field.fieldType)?.label}
                            {field.dataSource === 'staff' && ' · live: Staff Management'}
                            {field.dataSource === 'studio-resources' && ' · live: Capacity'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {field.customerVisible && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            Customer
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleWorkshopField(field.fieldId)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                            field.enabled
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-gray-100 border-gray-300 text-gray-600'
                          }`}
                          title={field.enabled
                            ? 'Disable — hidden from the Workshop form, saved values kept'
                            : 'Re-enable this field'}
                        >
                          {field.enabled ? 'Enabled' : 'Disabled'}
                        </button>

                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveWorkshopField(field.fieldId, -1)}
                          className="p-1.5 rounded-lg border border-brand-clay/50 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === cardFields.length - 1}
                          onClick={() => handleMoveWorkshopField(field.fieldId, 1)}
                          className="p-1.5 rounded-lg border border-brand-clay/50 text-brand-charcoal/60 hover:bg-brand-sand disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingFieldId(isEditingField ? null : field.fieldId)}
                          className="p-1.5 rounded-lg border border-brand-clay/50 text-brand-charcoal/70 hover:bg-brand-sand cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={field.system}
                          onClick={() => handleDeleteWorkshopField(field.fieldId)}
                          title={field.system
                            ? 'Core field — disable it instead of deleting'
                            : 'Delete this field'}
                          className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Field editor */}
                    {isEditingField && (
                      <div className="border-t border-brand-clay/50 p-4 bg-brand-cream/30 space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="font-bold text-brand-charcoal/75 block">Label</label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={e => handleUpdateWorkshopField(field.fieldId, { label: e.target.value })}
                              className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold"
                            />
                            <p className="text-[10px] text-brand-charcoal/45">
                              Renaming is safe — values are stored against <span className="font-mono">{field.fieldKey}</span>.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-brand-charcoal/75 block">Field Type</label>
                            <select
                              value={field.fieldType}
                              onChange={e => handleUpdateWorkshopField(field.fieldId, {
                                fieldType: e.target.value as WorkshopFieldType
                              })}
                              className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold cursor-pointer"
                            >
                              {WORKSHOP_FIELD_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                            <p className="text-[10px] text-brand-charcoal/45">
                              Any field can change type — saved values are kept and reshaped to suit.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="font-bold text-brand-charcoal/75 block">Placeholder</label>
                            <input
                              type="text"
                              value={field.placeholder || ''}
                              onChange={e => handleUpdateWorkshopField(field.fieldId, { placeholder: e.target.value })}
                              className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold"
                            />
                          </div>

                        </div>

                        {/* Toggles */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateWorkshopField(field.fieldId, { required: !field.required })}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              field.required
                                ? 'bg-brand-terracotta/10 border-brand-terracotta/40 text-brand-terracotta'
                                : 'bg-white border-brand-clay text-brand-charcoal/60'
                            }`}
                          >
                            {field.required ? 'Required' : 'Optional'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleUpdateWorkshopField(field.fieldId, { customerVisible: !field.customerVisible })}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                              field.customerVisible
                                ? 'bg-blue-50 border-blue-200 text-blue-800'
                                : 'bg-white border-brand-clay text-brand-charcoal/60'
                            }`}
                            title="Show this field's saved value on the Customer Site workshop page"
                          >
                            {field.customerVisible ? 'Visible to Customers' : 'Staff Console only'}
                          </button>
                        </div>

                        {/* Live source notice, or an editable option list */}
                        {field.dataSource ? (
                          <p className="text-[11px] font-semibold text-brand-charcoal/65 bg-white border border-brand-clay/60 rounded-xl p-2.5">
                            Options come from{' '}
                            <span className="font-bold">
                              {field.dataSource === 'staff' ? 'Staff Management' : 'Settings → Capacity'}
                            </span>{' '}
                            and stay synchronized with those records. Only the label, required status,
                            position and visibility are configured here.
                          </p>
                        ) : fieldTypeUsesOptions(field.fieldType) ? (
                          <div className="space-y-1">
                            <label className="font-bold text-brand-charcoal/75 block">Options (one per line)</label>
                            <LineListTextarea
                              rows={4}
                              value={field.options || []}
                              onChange={options => handleUpdateWorkshopField(field.fieldId, { options })}
                              className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold"
                            />
                            {field.fieldKey === 'category' && (
                              <p className="text-[10px] text-brand-charcoal/45">
                                Leave empty to use the shared Categories list.
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 3: PRE-PAYMENT INSTRUCTIONS POP-UP
            ======================================================= */}
        {activeTab === 'settings-popup' && (
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
                    onClick={() => editPrePaymentSettings({ enabled: !popupForm.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      popupForm.enabled ? 'bg-brand-sage' : 'bg-brand-charcoal/25'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        popupForm.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Pop-up Title */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-charcoal/80">Pop-up Title</label>
                  <input
                    type="text"
                    required
                    value={popupForm.title}
                    onChange={e => editPrePaymentSettings({ title: e.target.value })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>

                {/* Main message — plain text only */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-charcoal/80">Message</label>
                  <textarea
                    rows={4}
                    value={popupForm.message}
                    onChange={e => editPrePaymentSettings({ message: e.target.value })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl p-3 text-xs font-semibold text-brand-charcoal leading-relaxed"
                    placeholder="Please note the following studio rules before proceeding to payment."
                  />
                  <p className="text-[10px] text-brand-charcoal/45">
                    Plain text. Leave a blank line to start a new paragraph.
                  </p>
                </div>

                {/* Optional short instructions, one per line */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-charcoal/80">
                    Short Instructions <span className="font-semibold text-brand-charcoal/45">(optional)</span>
                  </label>
                  <textarea
                    rows={5}
                    value={popupForm.instructions.join('\n')}
                    onChange={e => editPrePaymentSettings({
                      instructions: e.target.value.split('\n')
                    })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl p-3 text-xs font-semibold text-brand-charcoal leading-relaxed"
                    placeholder={'One instruction per line, for example:\nPieces take 10 to 14 days to be ready.\nAprons are provided.'}
                  />
                  <p className="text-[10px] text-brand-charcoal/45">
                    One per line. Each line appears as a bullet point.
                  </p>
                </div>

                {/* Confirm button label */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-brand-charcoal/80">Confirm Button Label</label>
                  <input
                    type="text"
                    value={popupForm.buttonLabel}
                    onChange={e => editPrePaymentSettings({ buttonLabel: e.target.value })}
                    className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                </div>

                {/* Toggle checkbox requirement */}
                <div className="flex items-start gap-3 p-4 bg-brand-sand/10 border border-brand-clay/30 rounded-2xl">
                  <input
                    type="checkbox"
                    id="reqCheck"
                    checked={popupForm.requiredCheckbox}
                    onChange={e => editPrePaymentSettings({ requiredCheckbox: e.target.checked })}
                    className="h-4 w-4 text-brand-terracotta border-brand-clay rounded focus:ring-brand-terracotta mt-0.5 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="reqCheck" className="text-xs font-bold text-brand-charcoal cursor-pointer">Require Checkout Checkbox Confirmation</label>
                    <p className="text-[10px] text-brand-charcoal/60">If enabled, the customer MUST check a box affirming they understand before purchasing.</p>
                  </div>
                </div>

                {/* Custom checkbox Label Input */}
                {popupForm.requiredCheckbox && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-brand-charcoal/80">Custom Checkbox Agreement Label</label>
                    <input
                      type="text"
                      value={popupForm.checkboxLabel}
                      onChange={e => editPrePaymentSettings({ checkboxLabel: e.target.value })}
                      className="w-full bg-brand-cream/20 border border-brand-clay/60 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal"
                    />
                  </div>
                )}

                {/* Save */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  {popupSaved && !popupDirty && (
                    <span className="text-[11px] font-bold text-brand-sage flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      <span>Saved</span>
                    </span>
                  )}
                  {popupDirty && (
                    <span className="text-[11px] font-bold text-brand-charcoal/45">Unsaved changes</span>
                  )}
                  <button
                    type="button"
                    disabled={!popupDirty}
                    onClick={handleSavePrePaymentSettings}
                    className="px-5 py-2.5 rounded-xl bg-brand-terracotta text-brand-cream text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save Changes
                  </button>
                </div>
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
                      <h3 className="text-sm font-bold text-brand-charcoal">{popupForm.title || 'Untitled guidelines'}</h3>
                      <p className="text-[10px] text-brand-charcoal/50 font-bold uppercase tracking-wider mt-0.5">Pre-Payment studio briefing</p>
                    </div>
                  </div>

                  {/* Exactly what the customer reads — plain text, never markup */}
                  <div className="text-xs text-brand-charcoal/80 leading-relaxed space-y-2 border-y border-brand-clay/30 py-3 my-2 max-h-48 overflow-y-auto pr-1">
                    {popupParagraphs(popupForm.message).map((paragraph, i) => (
                      <p key={i} className="whitespace-pre-line">{paragraph}</p>
                    ))}
                    {popupForm.instructions.filter(line => line.trim()).map((line, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand-terracotta shrink-0" />
                        <span>{line}</span>
                      </div>
                    ))}
                    {!popupForm.message.trim() && !popupForm.instructions.some(l => l.trim()) && (
                      <p className="text-brand-charcoal/40">No message written yet.</p>
                    )}
                  </div>

                  {/* Render Checkbox Confirmation preview */}
                  {popupForm.requiredCheckbox ? (
                    <div className="flex items-start gap-2.5 pt-1">
                      <input type="checkbox" readOnly checked={false} className="h-3.5 w-3.5 border-brand-clay text-brand-terracotta rounded mt-0.5" />
                      <span className="text-[10px] font-semibold text-brand-charcoal/70 leading-normal">{popupForm.checkboxLabel}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-bold text-brand-sage flex items-center gap-1 bg-brand-sage/5 p-2 rounded-lg border border-brand-sage/10">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      <span>Unconditional Booking: Customers can immediately click purchase.</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2 text-[10px] font-bold">
                    <button type="button" className="px-3.5 py-2 rounded-lg border border-brand-clay bg-white text-brand-charcoal/60">Cancel</button>
                    <button type="button" className="px-4 py-2 rounded-lg bg-brand-terracotta text-brand-cream">{popupForm.buttonLabel}</button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =======================================================
            TAB 4: STAFF REGISTRY
            ======================================================= */}
        {activeTab === 'settings-staff-registry' && (
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
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-brand-charcoal uppercase tracking-wider">
                {editingStaffId ? <Pencil className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                <span>{editingStaffId ? 'Edit Staff Profile' : 'Register New Staff Member'}</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Staff Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lina Al-Sudais"
                    value={staffForm.name}
                    onChange={e => { setStaffForm(prev => ({ ...prev, name: e.target.value })); clearStaffError('name'); }}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                  {staffErrors.name && <p className="text-[11px] text-red-500 font-bold">{staffErrors.name}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Position / Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lead Instructor"
                    value={staffForm.position}
                    onChange={e => { setStaffForm(prev => ({ ...prev, position: e.target.value })); clearStaffError('position'); }}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                  {staffErrors.position && <p className="text-[11px] text-red-500 font-bold">{staffErrors.position}</p>}
                </div>

                <PhoneInput
                  label="Phone Number"
                  value={staffForm.phone}
                  error={staffErrors.phone}
                  onChange={val => { setStaffForm(prev => ({ ...prev, phone: val })); clearStaffError('phone'); }}
                />

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-brand-charcoal/80">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. lina@artycafe.com"
                    value={staffForm.email}
                    onChange={e => { setStaffForm(prev => ({ ...prev, email: e.target.value })); clearStaffError('email'); }}
                    className="w-full bg-white border border-brand-clay/60 rounded-xl py-2 px-3 text-xs font-semibold text-brand-charcoal"
                  />
                  {staffErrors.email && <p className="text-[11px] text-red-500 font-bold">{staffErrors.email}</p>}
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
                  {staffPager.pageItems.map((member) => (
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

                      {/* Console account & page permissions */}
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {member.role === 'Super Admin' ? (
                            <span className="bg-brand-terracotta/10 text-brand-terracotta px-2 py-0.5 rounded text-[9px] font-bold border border-brand-terracotta/30">
                              Super Admin — full access
                            </span>
                          ) : member.hasConsoleAccess ? (
                            <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[9px] font-bold border border-emerald-200">
                              {sanitizePermissions(member.permissions).length} page
                              {sanitizePermissions(member.permissions).length === 1 ? '' : 's'}
                            </span>
                          ) : (
                            <span className="text-brand-charcoal/40 italic text-[10px]">No console access</span>
                          )}

                          <button
                            type="button"
                            disabled={!canManagePermissions}
                            onClick={() => handleOpenPermissions(member)}
                            title={canManagePermissions
                              ? 'Manage console access and page permissions'
                              : 'Only a Super Admin can change permissions'}
                            className="text-[10px] font-bold text-brand-terracotta hover:underline disabled:text-brand-charcoal/30 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
                          >
                            Manage
                          </button>
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

              <div className="px-3 pb-3">
                <TablePager
                  page={staffPager.page}
                  totalPages={staffPager.totalPages}
                  from={staffPager.from}
                  to={staffPager.to}
                  total={staffPager.total}
                  onPage={staffPager.setPage}
                  noun="staff"
                />
              </div>
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


      {/* ================= STAFF CONSOLE PERMISSIONS ================= */}
      {permissionsStaff && (
        <div className="fixed inset-0 bg-brand-charcoal/60 backdrop-blur-xs z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-brand-cream border border-brand-clay rounded-3xl max-w-lg w-full my-8 shadow-2xl text-left">

            <div className="flex items-start justify-between gap-4 p-6 border-b border-brand-clay/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta block">
                  Admin Console Access
                </span>
                <h3 className="font-display text-xl font-bold text-brand-charcoal">{permissionsStaff.name}</h3>
                <p className="text-[11px] font-mono font-bold text-brand-charcoal/50 mt-0.5">
                  {permissionsStaff.id}
                </p>
              </div>
              <button
                onClick={() => setPermissionsStaffId(null)}
                className="p-1.5 rounded-lg hover:bg-brand-sand text-brand-charcoal/60 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">

              {/* Console access toggle */}
              <label className="flex items-start gap-3 p-3 bg-white border border-brand-clay rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={permDraft.hasConsoleAccess}
                  onChange={e => setPermDraft(prev => ({ ...prev, hasConsoleAccess: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-brand-terracotta cursor-pointer"
                />
                <span>
                  <span className="font-bold text-brand-charcoal block">Allow Admin Console sign-in</span>
                  <span className="text-[11px] text-brand-charcoal/60">
                    A staff profile can exist without a login account. Turn this on to give them one.
                  </span>
                </span>
              </label>

              {permDraft.hasConsoleAccess && (
                <>
                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/80 block">Role</label>
                    <select
                      value={permDraft.role}
                      onChange={e => {
                        const role = e.target.value as StaffRole;
                        setPermDraft(prev => ({
                          ...prev,
                          role,
                          permissions: role === 'Super Admin' ? [] : defaultPermissionsForRole(role)
                        }));
                      }}
                      className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-bold text-brand-charcoal cursor-pointer"
                    >
                      <option value="Staff">Staff</option>
                      <option value="Admin">Admin</option>
                      <option value="Super Admin">Super Admin</option>
                    </select>
                    {permDraft.role === 'Super Admin' && (
                      <p className="text-[11px] font-bold text-brand-terracotta">
                        Super Admin has unrestricted access to every page. No pages need selecting.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-brand-charcoal/80 block">Password</label>
                    <input
                      type="text"
                      value={permDraft.password}
                      onChange={e => setPermDraft(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Set a sign-in password"
                      className="w-full bg-white border border-brand-clay rounded-xl p-2.5 font-semibold text-brand-charcoal"
                    />
                    <p className="text-[10px] text-brand-charcoal/50">
                      They can sign in with this password and either their email
                      ({permissionsStaff.email || 'no email on file'}) or phone ({permissionsStaff.phone}).
                    </p>
                  </div>

                  {/* Page permissions */}
                  {permDraft.role !== 'Super Admin' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-brand-charcoal/80 block">Permissions</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPermDraft(prev => ({
                              ...prev,
                              permissions: ADMIN_PAGES.filter(p => !isSuperAdminOnlyPage(p.id)).map(p => p.id)
                            }))}
                            className="text-[10px] font-bold text-brand-terracotta hover:underline cursor-pointer"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setPermDraft(prev => ({ ...prev, permissions: [] }))}
                            className="text-[10px] font-bold text-brand-charcoal/50 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border border-brand-clay rounded-2xl p-3 space-y-1.5">
                        {/* The real Admin Console pages, minus the ones only a
                            Super Admin may open — those cannot be granted. */}
                        {ADMIN_PAGES.filter(page => !isSuperAdminOnlyPage(page.id)).map(page => (
                          <label
                            key={page.id}
                            className="flex items-center gap-2.5 py-1 cursor-pointer hover:bg-brand-sand/25 rounded-lg px-1.5"
                          >
                            <input
                              type="checkbox"
                              checked={permDraft.permissions.includes(page.id)}
                              onChange={() => handleTogglePermission(page.id)}
                              className="h-4 w-4 accent-brand-terracotta cursor-pointer"
                            />
                            <span className="font-semibold text-brand-charcoal">{page.label}</span>
                            <span className="text-[9px] font-mono text-brand-charcoal/30 ml-auto">{page.id}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {permSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold rounded-xl flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Permissions saved. They apply the next time this account loads a page.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setPermissionsStaffId(null)}
                  className="py-3 border border-brand-clay hover:bg-brand-sand text-brand-charcoal text-xs font-bold rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="py-3 bg-brand-terracotta hover:bg-brand-terracotta/90 text-brand-cream text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Permissions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
