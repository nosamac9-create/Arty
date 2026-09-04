/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  RecurringScheduleRule, isWorkshopOptionEnabled,
  WorkshopFieldConfig, fieldsForCard, fieldSpansFullRow, coerceFieldValue
} from '../types';
import { generateSessionsForMonth } from '../utils/scheduleGenerator';
import { checkStaffMemberAvailability } from '../utils/staffAvailabilityUtils';
import { resolveStaffId, resolveStaffName, AssignmentSources } from '../utils/staffAssignments';
import {
  getStudioSpaces, checkSpaceAvailability, findSpaceConflictAcrossSlots,
  StudioSpace, SpaceSources
} from '../utils/spaceAvailability';
import { findRuleConflict, getRuleSlots, formatSlotDate, RuleConflict } from '../utils/recurringConflicts';
import { validateWorkshopForm } from '../utils/validation';
import { getSessionSeatUsage } from '../utils/queueUtils';
import { uploadImages, removeImages } from '../lib/mediaUpload';
import { 
  Upload, Trash2, Plus, AlertCircle, Sparkles, Image as ImageIcon, 
  Settings, FolderKanban, Check, Save, Eye, Bold, Italic, Link, AlignLeft, X,
  Search, ArrowUpDown, ChevronUp, ChevronDown, Layers, Calendar, User, Clock, RefreshCw
} from 'lucide-react';
import { DateInput } from './DateInput';
import { MONTH_NAMES } from '../utils/calendarConfig';
import { matchesQuery } from '../utils/search';

export const AdminWorkshopFormSection: React.FC = () => {
  const { 
    addWorkshop, 
    updateWorkshop, 
    setCustomerTab, 
    editingWorkshopId, 
    setEditingWorkshopId,
    staff,
    todayDateStr,
    events,
    queue,
    workshopSessions,
    bookings,
    // The merged list: each workshop carries its sessions from the
    // workshop_sessions table.
    workshops: workshopsWithSessions,
    studioResources,
    workshopOptions,
    workshopFields,
    appSettings,
    // Shared category list and the mutator that writes to it.
    categories: dbCategories,
    addCategoryIfMissing,
    // Raw queries so the loading skeleton still distinguishes "not yet read"
    // from "no workshops".
    rawWorkshops,
    rawEvents,
    // Fresh reads for conflict checks and tutor resolution.
    getFreshAssignmentSources,
    getFreshStaff,
    birthdayPackages,
} = useApp();

  // `rawWorkshops === undefined` is purely the loading signal. The list the
  // page renders is the merged one, so the Sessions column and the Sessions
  // Calendar see the real sessions rather than an absent nested array.
  const isWorkshopsLoading = rawWorkshops === undefined;
  const workshops = workshopsWithSessions;

  // Saving state to prevent duplicate submissions
  const [isSaving, setIsSaving] = useState(false);
  // Field-keyed messages from the shared validation layer.
  const [workshopErrors, setWorkshopErrors] = useState<Record<string, string>>({});

  // Load categories from Dexie

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Pottery');
  const [categoryInput, setCategoryInput] = useState('Pottery');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [hook, setHook] = useState('');
  const [description, setDescription] = useState('');
  const [fullDetails, setFullDetails] = useState('');
  const [price, setPrice] = useState(250);
  const [duration, setDuration] = useState('2 Hours');
  const [capacity, setCapacity] = useState(10);
  // The tutor is held as a stable staff ID; names are resolved from Staff Management.
  const [tutorStaffId, setTutorStaffId] = useState('');
  const [room, setRoom] = useState('The Clay Station (Studio A)');
  // Stable studio space id; `room` is only the label kept for display.
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Published' | 'Archived'>('Published');
  const [skillLevel, setSkillLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels'>('Beginner');
  /**
   * Every photo on this workshop, cover first.
   *
   * The record still stores a single `image` (the cover) plus
   * `additionalImages` — the shape the table and the column allow-list have
   * always had — so nothing about the schema changes. The form just works in
   * one list and splits it again on save.
   */
  const [images, setImages] = useState<string[]>([]);
  /** An upload is in flight. Indeterminate on purpose: supabase-js's
   *  upload() reports no progress, so claiming a percentage would be a
   *  fiction. Saving is blocked while it is true. */
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  
  // Tag input list
  const [materialInput, setMaterialInput] = useState('');
  const [materials, setMaterials] = useState<string[]>(['Terracotta Clay', 'Trimming tools', 'Kiln firing']);

  // Required Field in Error State
  const [ageRange, setAgeRange] = useState(''); // empty by default to trigger the error state
  const [errorTouched, setErrorTouched] = useState(true);

  // Values for admin-created fields, keyed by stable fieldKey.
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [customTagInputs, setCustomTagInputs] = useState<Record<string, string>>({});

  // Sessions Repeatable List
  const [sessions, setSessions] = useState<any[]>([]);

  // Monthly Recurring Schedule Rules
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringScheduleRule[]>([]);
  /**
   * Which month "Generate Monthly Sessions" targets. Defaults to the
   * current Riyadh-local month, but is independently selectable —
   * a rule's own Effective From/Until range is often for a future
   * month (the whole point of scheduling ahead), and generation used
   * to silently ignore that, always targeting today's real month
   * regardless of what any rule actually covered.
   */
  const [genTargetYear, setGenTargetYear] = useState<number>(() => Number(todayDateStr.split('-')[0]));
  const [genTargetMonth, setGenTargetMonth] = useState<number>(() => Number(todayDateStr.split('-')[1]));
  /** Fixed to today's real year regardless of what's selected, so the
   *  year dropdown's own option list doesn't shift under the admin. */
  const genBaseYear = Number(todayDateStr.split('-')[0]);

  // Table states
  const [tableSearch, setTableSearch] = useState('');
  const [tableSortField, setTableSortField] = useState<string>('title');
  const [tableSortAsc, setTableSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedWorkshopIds, setExpandedWorkshopIds] = useState<Set<string>>(new Set());

  /**
   * Adds the chosen photos to the list — it never replaces what is already
   * there. Several may be picked at once, and more added later.
   */
  /**
   * Uploads the chosen photographs and keeps their URLs.
   *
   * These used to be read with FileReader into base64 and stored inline in the
   * workshop row — megabytes per row, pulled by every read of the table, and
   * past the size Realtime will deliver. They go to Storage now; the row holds
   * a URL.
   *
   * Validation lives in mediaUpload so every upload in the app applies the same
   * rules. Uploads are awaited rather than fired and forgotten: staff need to
   * know a photo did not make it before they save, not after.
   */
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Cleared straight away so the same file can be picked again after removal,
    // and so the value does not survive the awaits below.
    e.target.value = '';
    if (files.length === 0) return;

    setUploadingPhotos(true);
    try {
      const { urls, errors } = await uploadImages(files, { folder: 'workshops' });

      if (urls.length > 0) {
        // Appended and de-duplicated, so the same photo added twice does not
        // give the slider two identical frames.
        setImages(prev => Array.from(new Set([...prev, ...urls])));
      }

      if (errors.length > 0) {
        alert(
          `${errors.length === files.length ? 'No photos were added.' : 'Some photos were not added.'}\n\n${errors.join('\n')}`
        );
      }
    } finally {
      setUploadingPhotos(false);
    }
  };

  /**
   * Removes one photo. If it was the cover, the next one becomes the cover.
   *
   * The stored object goes too, or the bucket fills with files nothing points
   * at. Best effort and unawaited: cleanup failing must never stop someone
   * removing a photo, and removeImages ignores anything that is not one of
   * ours — a workshop still holding base64 has nothing to delete.
   */
  const handleRemoveImage = (src: string) => {
    setImages(prev => prev.filter(item => item !== src));
    void removeImages([src]);
  };

  /** Promotes a photo to cover — the cover is simply the first in the list. */
  const handleMakeCover = (src: string) => {
    setImages(prev => [src, ...prev.filter(item => item !== src)]);
  };

  const resetForm = () => {
    setTitle('');
    setCategory('Pottery');
    setCategoryInput('Pottery');
    setHook('');
    setDescription('');
    setFullDetails('');
    setPrice(250);
    setDuration('2 Hours');
    setCapacity(10);
    setTutorStaffId('');
    setRoom('The Clay Station (Studio A)');
    setRoomId('');
    setStatus('Published');
    setSkillLevel('Beginner');
    setImages([]);
    setMaterials(['Terracotta Clay', 'Trimming tools', 'Kiln firing']);
    setAgeRange('');
    setSessions([]);
    setRecurringSchedules([]);
    setCustomFieldValues({});
    setCustomTagInputs({});
    setErrorTouched(false);
    // Whatever the form has just been set to becomes the new clean state.
    setBaselinePending(true);
  };

  /**
   * Is there unsaved work?
   *
   * Derived by comparing the whole form against the state it was last reset or
   * loaded into, rather than by each control reporting a change. A per-field
   * flag would have to be added to every input — and forgotten on the next one
   * — while this covers images, materials, sessions and admin-defined custom
   * fields for free.
   */
  const formSnapshot = useMemo(() => JSON.stringify({
    title, category, categoryInput, hook, description, fullDetails, price, duration,
    capacity, tutorStaffId, room, roomId, status, skillLevel, images, materials,
    ageRange, sessions, recurringSchedules, customFieldValues, customTagInputs
  }), [
    title, category, categoryInput, hook, description, fullDetails, price, duration,
    capacity, tutorStaffId, room, roomId, status, skillLevel, images, materials,
    ageRange, sessions, recurringSchedules, customFieldValues, customTagInputs
  ]);

  const [pristineSnapshot, setPristineSnapshot] = useState<string | null>(null);
  const [baselinePending, setBaselinePending] = useState(true);

  /*
   * The baseline is captured a render after it is requested, not inside
   * `resetForm`: those setters are queued, so reading the snapshot immediately
   * would record the values being replaced.
   */
  useEffect(() => {
    if (!baselinePending) return;
    setPristineSnapshot(formSnapshot);
    setBaselinePending(false);
  }, [baselinePending, formSnapshot]);

  const isFormDirty = pristineSnapshot !== null && formSnapshot !== pristineSnapshot;

  /**
   * The action bar belongs to an in-progress workshop, so it appears when one
   * is being edited or when a new one has been touched at all — and goes away
   * again on publish, save, cancel or reset, each of which resets the form and
   * therefore the baseline.
   */
  const showActionBar = !!editingWorkshopId || isFormDirty;

  /**
   * Pins the sessions grid to exactly two rows.
   *
   * The height comes from a real card rather than a guessed pixel value: a
   * session card grows a line when its room or instructor name wraps, and a
   * fixed cap would then slice the second row in half. Re-measured whenever a
   * card resizes or the session count changes.
   */
  const sessionsGridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const grid = sessionsGridRef.current;
    const firstCard = grid?.firstElementChild as HTMLElement | null;
    if (!grid || !firstCard) return;

    const apply = () => {
      grid.style.setProperty('--session-row-height', `${firstCard.offsetHeight}px`);
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(firstCard);
    return () => observer.disconnect();
  }, [sessions.length]);

  /** The top of the form, so an edit starts where the fields are. */
  const formTopRef = useRef<HTMLDivElement>(null);
  const scrollFormIntoView = () => {
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Which workshop the form has actually been populated from.
   *
   * `undefined` means nothing has been loaded yet, which is distinct from
   * `null` (a new workshop, deliberately blank). The effect below re-runs
   * whenever `workshops` or `staff` change — both are live tables — so it needs
   * to tell "the selection changed" from "some unrelated row changed".
   */
  const loadedWorkshopIdRef = useRef<string | null | undefined>(undefined);

  /**
   * The selection as of the previous run, so an explicit change can be told
   * from a re-run caused by an unrelated table refresh. Choosing a different
   * workshop is a deliberate act and always loads it, even over unsaved work.
   */
  const lastSeenWorkshopIdRef = useRef<string | null | undefined>(undefined);

  /** Mirrors isFormDirty for the effect, which must not re-run when it flips. */
  const isFormDirtyRef = useRef(false);
  isFormDirtyRef.current = isFormDirty;

  /*
   * Load the selected workshop into the form.
   *
   * This effect depends on `workshops` and `staff`, and it must: the selection
   * can be made before either list has arrived, and the form can only be filled
   * once the record exists. But both are live tables, so the effect also re-runs
   * on every unrelated refresh of them — and it used to reload or reset the form
   * every time.
   *
   * That was destructive in two ways. On a new workshop it fell to `resetForm()`,
   * blanking half-entered work and, because the baseline was recaptured from the
   * now-empty form, hiding the action bar with it. On an existing one it
   * overwrote in-progress edits with the stored values.
   *
   * Neither needed a rare race to happen. `useLiveTable` sets a table to `[]`
   * when a read fails, so a single failing `workshops` request — the 500s that
   * this table's multi-megabyte rows produce — was enough to wipe the form
   * mid-edit. A photo upload simply widened the window for one to land.
   *
   * So the form is only touched when the selection itself changed, or when the
   * record it is waiting for finally arrives and there is no unsaved work to
   * lose.
   */
  useEffect(() => {
    const userChangedSelection = lastSeenWorkshopIdRef.current !== editingWorkshopId;
    lastSeenWorkshopIdRef.current = editingWorkshopId;
    const alreadyLoaded = loadedWorkshopIdRef.current === editingWorkshopId;

    // Someone picking a different workshop — or clearing the selection — is an
    // explicit act, so it always takes effect. Everything below concerns
    // re-runs where the selection did not change.
    if (!userChangedSelection) {
      // Already showing this selection: an unrelated refresh of workshops or
      // staff. Re-running here is what blanked the form mid-edit.
      if (alreadyLoaded) return;

      // Not loaded yet — the record had not arrived when it was selected, so
      // this branch stays live to pick it up. That retry must not overwrite
      // anything typed while waiting: unsaved work outranks a reload.
      if (editingWorkshopId && isFormDirtyRef.current) return;
    }

    if (editingWorkshopId) {
      const ws = workshops.find(w => w.id === editingWorkshopId);
      if (ws) {
        setTitle(ws.title || '');
        setCategory(ws.category || 'Pottery');
        setCategoryInput(ws.category || 'Pottery');
        setHook(ws.hook || '');
        setDescription(ws.description || '');
        setFullDetails(ws.fullDetails || '');
        setPrice(ws.price || 250);
        setDuration(ws.duration || '2 Hours');
        setCapacity(ws.capacity || 10);
        // Legacy workshops stored only a tutor name — resolve it back to a staff ID.
        setTutorStaffId(resolveStaffId(staff, ws.staffId, ws.instructor) || '');
        setRoom(ws.room || 'The Clay Station (Studio A)');
        setRoomId(ws.roomId || '');
        setStatus(ws.status || 'Published');
        setSkillLevel(ws.skillLevel || 'Beginner');
        // Backward compatible: a workshop saved with a single image loads as
        // a list of one.
        setImages(
          Array.from(new Set([ws.image, ...(ws.additionalImages || [])].filter(Boolean))) as string[]
        );
        setMaterials(ws.materials || []);
        setAgeRange(ws.ageRange || '');
        // Sessions store no seat counter: what is left is derived from the
        // live bookings and walk-ins. Compute it as they load so the calendar
        // shows real numbers instead of an absent field.
        setSessions((ws.sessions || []).map((sess: any) => {
          const usage = getSessionSeatUsage(sess, { workshops, bookings, queue });
          return {
            ...sess,
            time: sess.time || sess.startTime,
            capacity: usage.capacity,
            spotsLeft: usage.remainingCapacity,
            isFull: usage.remainingCapacity <= 0
          };
        }));
        setRecurringSchedules(ws.recurringSchedules || []);
        // Admin-created field values, kept even for fields later disabled.
        setCustomFieldValues(ws.customFields || {});
        setErrorTouched(false);
        // The loaded workshop is the clean state; edits are measured from here.
        setBaselinePending(true);
        // The Edit buttons live in the table far below the form, so loading a
        // workshop without moving left staff staring at the list they just
        // clicked in, with no sign anything had happened.
        scrollFormIntoView();
        // Only now is the form actually showing this workshop. Leaving the ref
        // alone when the record was not found lets a later run retry once the
        // table arrives.
        loadedWorkshopIdRef.current = editingWorkshopId;
      }
    } else {
      resetForm();
      loadedWorkshopIdRef.current = null;
    }
  }, [editingWorkshopId, workshops, staff]);

  // Shared assignment sources for every availability check on this page.
  const assignmentSources: AssignmentSources = useMemo(
    () => ({
      staff, workshopSessions, workshops, events: rawEvents || events || [],
      bookings, birthdayPackages, queue
    }),
    [staff, workshopSessions, workshops, rawEvents, events, bookings, birthdayPackages, queue]
  );

  /**
   * Option lists from Settings → Workshop Detail Lists. A value already saved on
   * the workshop stays selectable even if the option was later disabled, so
   * editing an existing workshop never silently changes it.
   */
  const optionValues = (type: string, currentValue?: string) => {
    const list = (workshopOptions || [])
      .filter(o => o.type === type)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const enabled = list.filter(isWorkshopOptionEnabled).map(o => o.value);
    if (currentValue && !enabled.includes(currentValue)) return [...enabled, currentValue];
    return enabled;
  };

  const selectedTutor = useMemo(
    () => staff.find(s => s.id === tutorStaffId) || null,
    [staff, tutorStaffId]
  );

  // Studio rooms and tables come from the shared option list and capacity settings.
  const capacityConfig = useMemo(
    () => appSettings?.find(s => s.id === 'capacitySettings')?.value,
    [appSettings]
  );

  // Rooms and table stations come from Settings → Capacity, never a fixed list.
  const studioSpaces: StudioSpace[] = useMemo(
    () => getStudioSpaces(studioResources),
    [studioResources]
  );

  const spaceSources: SpaceSources = useMemo(
    () => ({ workshopSessions, workshops, events: rawEvents || events || [], queue }),
    [workshopSessions, workshops, rawEvents, events, queue]
  );

  const selectedSpace = useMemo(
    () => studioSpaces.find(sp => sp.id === roomId) || null,
    [studioSpaces, roomId]
  );

  const selectedSpaceLabel = selectedSpace?.name || '';



  /** Exclusions so the workshop being edited never conflicts with itself. */
  const editingExclusion = useMemo(() => ({
    workshopId: editingWorkshopId ? String(editingWorkshopId) : undefined,
    sessionIds: sessions.map(s => String(s.id))
  }), [editingWorkshopId, sessions]);

  /** Live warning for the workshop-level room against this workshop's own sessions. */
  const roomWarning = useMemo(() => {
    if (!selectedSpace) return '';
    const slots = sessions
      .filter(s => s.date && (s.time || s.startTime))
      .map(s => ({
        date: s.date,
        startTime: s.time || s.startTime,
        endTime: s.endTime,
        duration: s.duration || duration
      }));
    if (slots.length === 0) {
      if (selectedSpace.status === 'Active') return '';
      return `${selectedSpace.name} is ${selectedSpace.status === 'Maintenance' ? 'under maintenance' : 'inactive'}.`;
    }
    const conflict = findSpaceConflictAcrossSlots(selectedSpace, slots, spaceSources, editingExclusion);
    return conflict ? conflict.reason || conflict.label : '';
  }, [selectedSpace, sessions, duration, spaceSources, editingExclusion]);

  /**
   * Runs the full recurring-rule check: every session each active rule will
   * generate, for both the instructor and the studio space.
   */
  const findRecurringConflict = (
    rules: RecurringScheduleRule[]
  ): { rule: RecurringScheduleRule; conflict: RuleConflict } | null => {
    for (const rule of rules) {
      if (rule.status !== 'Active') continue;

      const ruleStaffId = resolveStaffId(staff, rule.staffId, rule.instructor);
      const ruleStaff = ruleStaffId ? staff.find(s => s.id === ruleStaffId) || null : null;
      const ruleSpace = studioSpaces.find(sp => sp.id === (rule.roomId || roomId)) || null;

      const conflict = findRuleConflict({
        rule,
        workshop: { duration },
        staff: ruleStaff,
        space: ruleSpace,
        assignmentSources,
        spaceSources,
        assignmentExclusion: editingExclusion,
        spaceExclusion: editingExclusion,
        ownSessions: workshopSessions
      });

      if (conflict) return { rule, conflict };
    }
    return null;
  };

  const handleAddSession = () => {
    const nextId = sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
    setSessions([...sessions, {
      id: nextId,
      date: '2026-07-24',
      time: '04:30 PM',
      capacity,
      spotsLeft: capacity,
      isFull: false
    }]);
  };

  const handleRemoveSession = (id: number) => {
    setSessions(sessions.filter(s => s.id !== id));
  };

  const handleAddMaterial = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && materialInput.trim()) {
      e.preventDefault();
      if (!materials.includes(materialInput.trim())) {
        setMaterials([...materials, materialInput.trim()]);
      }
      setMaterialInput('');
    }
  };

  const handleRemoveMaterial = (m: string) => {
    setMaterials(materials.filter(mat => mat !== m));
  };

  // Process data for category combobox filter
  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return dbCategories;
    return dbCategories.filter(c => matchesQuery([c.name], categoryInput));
  }, [dbCategories, categoryInput]);

  /**
   * Validates the selected tutor against their saved schedule and every existing
   * assignment (workshops, events, birthdays, queue appointments, breaks, leave).
   * Returns a blocking message, or null when the assignment is clear to save.
   */
  const findAssignmentConflict = async (): Promise<string | null> => {
    const hasSessions = sessions && sessions.length > 0;
    const activeRules = recurringSchedules.filter(r => r.status === 'Active');
    if (!tutorStaffId && !hasSessions && activeRules.length === 0) return null;

    // Read fresh rows so the check never runs against stale component state.
    // The fetch itself lives in the data layer.
    const {
      staff: latestStaff,
      workshopSessions: latestSessions,
      workshops: latestWorkshops,
      events: latestEvents,
      queue: latestQueue,
      studioResources: latestResources,
      appSettings: latestSettings
    } = await getFreshAssignmentSources();

    const sources: AssignmentSources = {
      staff: latestStaff,
      workshopSessions: latestSessions,
      workshops: latestWorkshops,
      events: latestEvents,
      queue: latestQueue
    };
    const freshSpaceSources: SpaceSources = {
      workshopSessions: latestSessions,
      workshops: latestWorkshops,
      events: latestEvents,
      queue: latestQueue
    };
    const freshSpaces = getStudioSpaces(latestResources);

    // The sessions of the workshop being edited are not conflicts with themselves.
    const exclude = {
      workshopId: editingWorkshopId ? String(editingWorkshopId) : undefined,
      sessionIds: sessions.map(s => String(s.id))
    };

    // 1. One-time sessions against the workshop tutor.
    if (tutorStaffId && hasSessions) {
      const member = latestStaff.find(s => s.id === tutorStaffId);
      if (!member) {
        return 'The selected tutor no longer exists in Staff Management. Please select another staff member.';
      }

      for (const sess of sessions) {
        const sessTime = sess.time || sess.startTime;
        if (!sess.date || !sessTime) continue;

        const avail = checkStaffMemberAvailability({
          staff: member,
          date: sess.date,
          startTime: sessTime,
          endTime: sess.endTime,
          duration: sess.duration || duration,
          sources,
          exclude
        });

        if (!avail.isAvailable) {
          return avail.reason || `${member.name} is not available on ${sess.date} at ${sessTime}.`;
        }
      }
    }

    // 2. The workshop's own room, across its one-time sessions.
    const workshopSpace = freshSpaces.find(sp => sp.id === roomId);
    if (workshopSpace && hasSessions) {
      const slots = sessions
        .filter(s => s.date && (s.time || s.startTime))
        .map(s => ({
          date: s.date,
          startTime: s.time || s.startTime,
          endTime: s.endTime,
          duration: s.duration || duration
        }));
      const spaceConflict = findSpaceConflictAcrossSlots(workshopSpace, slots, freshSpaceSources, exclude);
      if (spaceConflict) {
        return spaceConflict.reason || spaceConflict.label;
      }
    }

    // 3. EVERY session each active recurring rule will generate — instructor and room.
    for (const rule of activeRules) {
      const ruleStaffId = resolveStaffId(latestStaff, rule.staffId, rule.instructor) || tutorStaffId;
      const ruleStaff = ruleStaffId ? latestStaff.find(s => s.id === ruleStaffId) || null : null;
      const ruleSpace = freshSpaces.find(sp => sp.id === (rule.roomId || roomId)) || null;

      const conflict = findRuleConflict({
        rule,
        workshop: { duration },
        staff: ruleStaff,
        space: ruleSpace,
        assignmentSources: sources,
        spaceSources: freshSpaceSources,
        assignmentExclusion: exclude,
        spaceExclusion: exclude,
        ownSessions: latestSessions
      });

      if (conflict) return conflict.message;
    }

    return null;
  };

  // ==========================================================
  // DYNAMIC WORKSHOP CARD RENDERING
  // Both cards are built from Settings → Workshop Detail Lists.
  // Core fields bind to real workshop properties; admin-created
  // fields store their value under their stable fieldKey.
  // ==========================================================

  /** Reads the value for a field, whether it is a core property or custom. */
  const getFieldValue = (field: WorkshopFieldConfig): any => {
    switch (field.boundTo) {
      case 'title': return title;
      case 'category': return category;
      case 'hook': return hook;
      case 'description': return description;
      case 'fullDetails': return fullDetails;
      case 'price': return price;
      case 'duration': return duration;
      case 'ageRange': return ageRange;
      case 'skillLevel': return skillLevel;
      case 'staffId': return tutorStaffId;
      case 'roomId': return roomId;
      case 'materials': return materials;
      default: return customFieldValues[field.fieldKey] ?? '';
    }
  };

  const setFieldValue = (field: WorkshopFieldConfig, raw: any) => {
    // A core property keeps its own shape even when the field type changed.
    const value = Array.isArray(raw) && field.boundTo !== 'materials' ? raw.join(', ') : raw;
    switch (field.boundTo) {
      case 'title': setTitle(value); break;
      case 'category': setCategory(value); setCategoryInput(value); break;
      case 'hook': setHook(value); break;
      case 'description': setDescription(value); break;
      case 'fullDetails': setFullDetails(value); break;
      case 'price': setPrice(Number(value) || 0); break;
      case 'duration': setDuration(value); break;
      case 'ageRange': setAgeRange(value); if (String(value).trim()) setErrorTouched(false); break;
      case 'skillLevel': setSkillLevel(value); break;
      case 'staffId': setTutorStaffId(value); break;
      case 'roomId': {
        setRoomId(value);
        const space = studioSpaces.find(sp => sp.id === value);
        if (space) setRoom(space.name);
        break;
      }
      case 'materials':
        setMaterials(Array.isArray(value)
          ? value
          : String(value ?? '').split(',').map(v => v.trim()).filter(Boolean));
        break;
      default:
        setCustomFieldValues(prev => ({ ...prev, [field.fieldKey]: value }));
    }
  };

  /** Choices for a field: live records, its own options, or a shared list. */
  const choicesFor = (field: WorkshopFieldConfig, current?: string): Array<{ value: string; label: string; disabled?: boolean }> => {
    if (field.dataSource === 'staff') {
      return staff
        .filter(st => st.status === 'Active' || st.id === current)
        .map(st => ({ value: st.id, label: st.name }));
    }

    if (field.dataSource === 'studio-resources') {
      return studioSpaces.map(space => ({
        value: space.id,
        label: `${space.name}${space.status === 'Active' ? '' : ` — ${space.status}`}`,
        disabled: space.status !== 'Active'
      }));
    }

    // The Category field falls back to the shared categories list when it has
    // no options of its own.
    if (field.fieldKey === 'category' && (!field.options || field.options.length === 0)) {
      return dbCategories.map(c => ({ value: c.name, label: c.name }));
    }

    const values = [...(field.options || [])];
    if (current && !values.includes(current)) values.push(current);
    return values.map(v => ({ value: v, label: v }));
  };

  /** Renders one configured field. */
  const renderWorkshopField = (field: WorkshopFieldConfig) => {
    const value = coerceFieldValue(getFieldValue(field), field.fieldType);
    // Width follows the field type; it is not a configurable option.
    const widthClass = fieldSpansFullRow(field.fieldType) ? 'sm:col-span-2' : '';
    const showAgeError = field.boundTo === 'ageRange' && field.required && errorTouched && !ageRange;

    const label = (
      <label className="text-xs font-bold text-brand-charcoal/80">
        {field.label}
        {field.required && <span className="text-red-500 font-extrabold"> *</span>}
      </label>
    );

    const inputClass = `w-full bg-brand-cream/35 border rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-charcoal ${
      showAgeError ? 'border-red-500' : 'border-brand-clay'
    }`;

    let control: React.ReactNode = null;

    switch (field.fieldType) {
      case 'long_text':
        control = (
          <textarea
            rows={3}
            placeholder={field.placeholder}
            value={value || ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={inputClass}
          />
        );
        break;

      case 'rich_text':
        control = (
          <div>
            <div className="flex items-center gap-1 bg-brand-sand/40 border border-brand-clay rounded-t-xl px-2 py-1.5">
              <Bold className="h-3.5 w-3.5 text-brand-charcoal/50" />
              <Italic className="h-3.5 w-3.5 text-brand-charcoal/50" />
              <Link className="h-3.5 w-3.5 text-brand-charcoal/50" />
              <AlignLeft className="h-3.5 w-3.5 text-brand-charcoal/50" />
              <span className="ml-2 text-[10px] font-mono text-brand-charcoal/40">Pristine HTML Mode</span>
            </div>
            <textarea
              rows={4}
              placeholder={field.placeholder}
              value={value || ''}
              onChange={e => setFieldValue(field, e.target.value)}
              className="w-full bg-brand-cream/35 border border-t-0 border-brand-clay rounded-b-xl p-3 text-xs font-semibold text-brand-charcoal"
            />
          </div>
        );
        break;

      case 'number':
        control = (
          <input
            type="number"
            placeholder={field.placeholder}
            value={value ?? ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={inputClass}
          />
        );
        break;

      case 'dropdown': {
        const choices = choicesFor(field, value);
        control = (
          <select
            value={value || ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">{field.placeholder || `Select ${field.label.toLowerCase()}...`}</option>
            {choices.map(choice => (
              <option key={choice.value} value={choice.value} disabled={choice.disabled}>
                {choice.label}
              </option>
            ))}
          </select>
        );
        break;
      }

      case 'multi_select': {
        const selected: string[] = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
        control = (
          <div className="flex flex-wrap gap-1.5">
            {choicesFor(field).map(choice => {
              const isOn = selected.includes(choice.value);
              return (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setFieldValue(field, isOn
                    ? selected.filter(v => v !== choice.value)
                    : [...selected, choice.value])}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                    isOn
                      ? 'bg-brand-terracotta text-brand-cream border-brand-terracotta'
                      : 'bg-white border-brand-clay text-brand-charcoal/70'
                  }`}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        );
        break;
      }

      case 'tags': {
        const tags: string[] = Array.isArray(value) ? value : [];
        const isMaterials = field.boundTo === 'materials';
        return (
          <div key={field.fieldId} className={`space-y-2 ${widthClass}`}>
            {label}
            <input
              type="text"
              placeholder={field.placeholder || 'Add a value and press Enter...'}
              value={isMaterials ? materialInput : (customTagInputs[field.fieldKey] || '')}
              onChange={e => isMaterials
                ? setMaterialInput(e.target.value)
                : setCustomTagInputs(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const raw = isMaterials ? materialInput : (customTagInputs[field.fieldKey] || '');
                const next = raw.trim();
                if (!next || tags.includes(next)) return;
                setFieldValue(field, [...tags, next]);
                if (isMaterials) setMaterialInput('');
                else setCustomTagInputs(prev => ({ ...prev, [field.fieldKey]: '' }));
              }}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-brand-sand px-2.5 py-1 rounded-lg border border-brand-clay text-[11px] font-bold text-brand-charcoal">
                  <span>{tag}</span>
                  <X
                    className="h-3 w-3 hover:text-brand-terracotta cursor-pointer shrink-0"
                    onClick={() => setFieldValue(field, tags.filter(t => t !== tag))}
                  />
                </span>
              ))}
            </div>
          </div>
        );
      }

      case 'checkbox':
        return (
          <label key={field.fieldId} className={`flex items-center gap-2.5 ${widthClass} cursor-pointer`}>
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => setFieldValue(field, e.target.checked)}
              className="h-4 w-4 accent-brand-terracotta cursor-pointer"
            />
            <span className="text-xs font-bold text-brand-charcoal/80">
              {field.label}{field.required && <span className="text-red-500"> *</span>}
            </span>
          </label>
        );

      case 'date':
        control = (
          <DateInput
            value={value || ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={inputClass}
          />
        );
        break;

      case 'time':
        control = (
          <input
            type="time"
            lang="en-GB"
            value={value || ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={inputClass}
          />
        );
        break;

      default:
        control = (
          <input
            type="text"
            placeholder={field.placeholder}
            value={value || ''}
            onChange={e => setFieldValue(field, e.target.value)}
            className={inputClass}
          />
        );
    }

    return (
      <div key={field.fieldId} className={`space-y-1 ${widthClass}`}>
        {label}
        {control}
        {showAgeError && (
          <span className="text-[10px] text-red-500 font-bold flex items-center gap-1 pt-0.5 leading-tight">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>This field is required.</span>
          </span>
        )}
      </div>
    );
  };

  const curriculumFields = useMemo(
    () => fieldsForCard(workshopFields, 'curriculum'),
    [workshopFields]
  );
  const logisticsFields = useMemo(
    () => fieldsForCard(workshopFields, 'logistics'),
    [workshopFields]
  );

  /** Required-field validation generated from the configuration. */
  const findMissingRequiredField = (): WorkshopFieldConfig | null => {
    for (const field of [...curriculumFields, ...logisticsFields]) {
      if (!field.required) continue;
      const value = getFieldValue(field);
      const empty = Array.isArray(value)
        ? value.length === 0
        : value === undefined || value === null || String(value).trim() === '';
      if (empty) return field;
    }
    return null;
  };

  // Saving / Publishing handler
  const handlePublish = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      // Shared rules first: title, category, price, capacity, age range and at
      // least one session.
      // The photo minimum is keyed on the status being saved, not on which
      // button was pressed: this handler also saves a workshop left as Draft or
      // Archived in the status selector, and only a workshop actually going on
      // the customer site needs its photographs.
      const willBePublished = (status || 'Published') === 'Published';

      const baseErrors = validateWorkshopForm({
        title, category: category || categoryInput, price, capacity, ageRange, sessions,
        ...(willBePublished ? { images } : {})
      });
      setWorkshopErrors(baseErrors);
      if (Object.keys(baseErrors).length > 0) {
        if (baseErrors.ageRange) setErrorTouched(true);
        alert(Object.values(baseErrors)[0]);
        return;
      }

      // Then the configurable required fields, so a field made required in
      // Settings blocks the save too.
      const missing = findMissingRequiredField();
      if (missing) {
        if (missing.boundTo === 'ageRange') setErrorTouched(true);
        alert(`"${missing.label}" is required. Please fill it in before publishing.`);
        return;
      }

      const finalAgeRange = ageRange.trim() || 'All Ages';
      const finalTitle = title.trim() || 'Untitled Workshop';
      const finalCategory = category.trim() || categoryInput.trim() || 'Pottery';

      // Block the save while the tutor has a conflicting assignment.
      const conflictMessage = await findAssignmentConflict();
      if (conflictMessage) {
        alert(
          `Assignment blocked — this tutor is Busy.\n\n${conflictMessage}\n\nSelect another staff member or change the session time, then save again.`
        );
        return;
      }

      // Query fresh staff records directly from Dexie to prevent stale state
      const latestStaff = await getFreshStaff();
      const assignedStaffMember = latestStaff.find(st => st.id === tutorStaffId);
      const staffId = assignedStaffMember?.id;

      const workshopData = {
        title: finalTitle,
        category: finalCategory,
        hook: hook || 'A handcraft masterclass',
        description: description || 'No description provided.',
        fullDetails: fullDetails || 'No details provided.',
        duration: duration || '2 Hours',
        ageRange: finalAgeRange,
        price: Number(price) || 200,
        capacity: Number(capacity) || 10,
        spotsLeft: Number(capacity) || 10,
        // No substitution: a workshop with no photograph is saved with none.
        // The stock photo that used to stand in here is what made a row whose
        // images had been lost look like a row that simply had a photo.
        image: images[0] || '',
        additionalImages: images.slice(1),
        // Name is denormalized for display only; staffId is the assignment record.
        instructor: assignedStaffMember ? assignedStaffMember.name : '',
        staffId,
        room: selectedSpaceLabel || room || 'The Clay Station (Studio A)',
        roomId: roomId || undefined,
        materials,
        skillLevel: skillLevel || 'Beginner',
        status: status || 'Published',
        // Every session carries the workshop's tutor ID, so changing the tutor
        // moves the assignment on both staff profiles.
        sessions: sessions.map((s, idx) => ({
          ...s,
          id: s.id ? String(s.id) : `sess-${Date.now()}-${idx}`,
          date: s.date || todayDateStr,
          time: s.time || s.startTime || '10:00 AM',
          startTime: s.time || s.startTime || '10:00 AM',
          duration: s.duration || duration,
          capacity: Number(s.capacity) || Number(capacity) || 10,
          spotsLeft: s.spotsLeft !== undefined ? Number(s.spotsLeft) : (Number(s.capacity) || Number(capacity) || 10),
          isFull: Boolean(s.isFull),
          // A session may have its own instructor; otherwise it inherits the
          // workshop tutor. Both the id and the resolved name are stored.
          ...(() => {
            const own = s.staffId ? latestStaff.find(st => st.id === s.staffId) : undefined;
            const member = own || assignedStaffMember;
            return { instructor: member ? member.name : '', staffId: member?.id };
          })(),
          // Stable studio-space and rule links, saved with the session.
          roomId: s.roomId || roomId || undefined,
          room: s.room || selectedSpaceLabel || room,
          tableId: s.tableId || undefined,
          ruleId: s.ruleId
        })),
        recurringSchedules,
        // Values for admin-created fields, by stable key.
        customFields: customFieldValues
      };

      // Ensure category is permanently saved to the categories table
      await addCategoryIfMissing(finalCategory);

      if (editingWorkshopId) {
        await updateWorkshop(editingWorkshopId, workshopData);
        alert(`Successfully updated workshop: "${finalTitle}" (${status || 'Published'})!`);
        setEditingWorkshopId(null);
        resetForm();
      } else {
        await addWorkshop(workshopData);
        alert(`Successfully published workshop: "${finalTitle}"!\nIt is now live on the customer-facing workshops page.`);
        setEditingWorkshopId(null);
        resetForm();
      }
    } catch (err) {
      console.error("Error saving workshop:", err);
      alert("Failed to save workshop. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Draft saver
  const handleSaveDraft = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    try {
      const finalAgeRange = ageRange.trim() || 'All Ages';
      const finalTitle = title.trim() || 'Untitled Workshop Draft';
      const finalCategory = category.trim() || categoryInput.trim() || 'Pottery';

      // Drafts are blocked on conflicts too — the sessions are still real assignments.
      const conflictMessage = await findAssignmentConflict();
      if (conflictMessage) {
        alert(
          `Assignment blocked — this tutor is Busy.\n\n${conflictMessage}\n\nSelect another staff member or change the session time, then save again.`
        );
        return;
      }

      // Query fresh database records directly from Dexie
      const latestStaff = await getFreshStaff();
      const assignedStaffMember = latestStaff.find(st => st.id === tutorStaffId);
      const staffId = assignedStaffMember?.id;

      const workshopData = {
        title: finalTitle,
        category: finalCategory,
        hook: hook || 'A handcraft masterclass',
        description: description || 'No description provided.',
        fullDetails: fullDetails || 'No details provided.',
        duration: duration || '2 Hours',
        ageRange: finalAgeRange,
        price: Number(price) || 200,
        capacity: Number(capacity) || 10,
        spotsLeft: Number(capacity) || 10,
        // No substitution: a workshop with no photograph is saved with none.
        // The stock photo that used to stand in here is what made a row whose
        // images had been lost look like a row that simply had a photo.
        image: images[0] || '',
        additionalImages: images.slice(1),
        // Name is denormalized for display only; staffId is the assignment record.
        instructor: assignedStaffMember ? assignedStaffMember.name : '',
        staffId,
        room: selectedSpaceLabel || room || 'The Clay Station (Studio A)',
        roomId: roomId || undefined,
        materials,
        skillLevel: skillLevel || 'Beginner',
        status: 'Draft' as const,
        // Every session carries the workshop's tutor ID, so changing the tutor
        // moves the assignment on both staff profiles.
        sessions: sessions.map((s, idx) => ({
          ...s,
          id: s.id ? String(s.id) : `sess-${Date.now()}-${idx}`,
          date: s.date || todayDateStr,
          time: s.time || s.startTime || '10:00 AM',
          startTime: s.time || s.startTime || '10:00 AM',
          duration: s.duration || duration,
          capacity: Number(s.capacity) || Number(capacity) || 10,
          spotsLeft: s.spotsLeft !== undefined ? Number(s.spotsLeft) : (Number(s.capacity) || Number(capacity) || 10),
          isFull: Boolean(s.isFull),
          // A session may have its own instructor; otherwise it inherits the
          // workshop tutor. Both the id and the resolved name are stored.
          ...(() => {
            const own = s.staffId ? latestStaff.find(st => st.id === s.staffId) : undefined;
            const member = own || assignedStaffMember;
            return { instructor: member ? member.name : '', staffId: member?.id };
          })(),
          // Stable studio-space and rule links, saved with the session.
          roomId: s.roomId || roomId || undefined,
          room: s.room || selectedSpaceLabel || room,
          tableId: s.tableId || undefined,
          ruleId: s.ruleId
        })),
        recurringSchedules,
        // Values for admin-created fields, by stable key.
        customFields: customFieldValues
      };

      await addCategoryIfMissing(finalCategory);

      if (editingWorkshopId) {
        await updateWorkshop(editingWorkshopId, workshopData);
        alert(`Draft updated successfully for: "${finalTitle}"!`);
        setEditingWorkshopId(null);
        resetForm();
      } else {
        await addWorkshop(workshopData);
        alert(`Draft created successfully for: "${finalTitle}"!`);
        setEditingWorkshopId(null);
        resetForm();
      }
    } catch (err) {
      console.error("Error saving draft:", err);
      alert("Failed to save draft. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Filter & Sort Workshops (Single row per workshop)
  const processedWorkshops = useMemo(() => {
    let result = [...workshops];

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      result = result.filter(ws => 
        ws.title.toLowerCase().includes(q) ||
        ws.category.toLowerCase().includes(q) ||
        ws.instructor.toLowerCase().includes(q) ||
        (ws.skillLevel && ws.skillLevel.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (tableSortField === 'title') {
        aVal = a.title;
        bVal = b.title;
      } else if (tableSortField === 'category') {
        aVal = a.category;
        bVal = b.category;
      } else if (tableSortField === 'skillLevel') {
        aVal = a.skillLevel || '';
        bVal = b.skillLevel || '';
      } else if (tableSortField === 'price') {
        return tableSortAsc ? a.price - b.price : b.price - a.price;
      } else if (tableSortField === 'status') {
        aVal = a.status || 'Published';
        bVal = b.status || 'Published';
      }

      if (tableSortAsc) {
        return String(aVal).localeCompare(String(bVal));
      } else {
        return String(bVal).localeCompare(String(aVal));
      }
    });

    return result;
  }, [workshops, tableSearch, tableSortField, tableSortAsc]);

  // Pagination for Workshops (10 per page)
  const ITEMS_PER_PAGE = 10;
  const totalWorkshopPages = Math.max(1, Math.ceil(processedWorkshops.length / ITEMS_PER_PAGE));
  const paginatedWorkshops = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedWorkshops.slice(start, start + ITEMS_PER_PAGE);
  }, [processedWorkshops, currentPage]);

  const toggleExpandWorkshop = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkshopIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortAsc(!tableSortAsc);
    } else {
      setTableSortField(field);
      setTableSortAsc(true);
    }
  };

  return (
    <div className={`p-4 sm:p-6 text-left bg-brand-cream min-h-full min-w-0 relative animate-in fade-in duration-300 ${
      showActionBar ? 'pb-36' : 'pb-8'
    }`}>
      
      {/* Page Title & Edit Mode indicator. Also the scroll anchor: an edit
          starts here, where the "Editing" heading and the first fields are. */}
      <div
        ref={formTopRef}
        className="mb-8 pb-4 border-b border-brand-clay/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 scroll-mt-6"
      >
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-charcoal">
            {editingWorkshopId ? (
              <span className="flex items-center gap-2 text-brand-terracotta">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span>Editing: {title || 'Unnamed Workshop'}</span>
              </span>
            ) : (
              'Create New Creative Workshop'
            )}
          </h1>
          <p className="text-xs text-brand-charcoal/60 mt-1">
            {editingWorkshopId 
              ? "Modify this workshop's fields, scheduled slots, or visibility and click Update." 
              : "Configure curriculum, seat counts, pricing, and timetable sessions."
            }
          </p>
        </div>
        
        {editingWorkshopId && (
          <button
            type="button"
            onClick={() => {
              setEditingWorkshopId(null);
              resetForm();
            }}
            className="cursor-pointer px-4 py-2 border border-brand-clay bg-white hover:bg-brand-sand rounded-xl text-xs font-bold text-brand-charcoal transition-all"
          >
            Cancel Editing
          </button>
        )}
      </div>

      <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        
        {/* LEFT COLUMN: Basics & Details metadata */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section: Basics */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-charcoal flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-brand-terracotta" />
              <span>Workshop Curriculum basics</span>
            </h3>


            {/* Rendered from Settings → Workshop Detail Lists. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {curriculumFields.map(renderWorkshopField)}
            </div>

          </div>

          {/* Section: Details / Logistics */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="font-display font-bold text-lg text-brand-charcoal flex items-center gap-2">
              <Settings className="h-5 w-5 text-brand-terracotta" />
              <span>Logistics & Metadata</span>
            </h3>

            {/* Rendered from Settings → Workshop Detail Lists. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {logisticsFields.map(renderWorkshopField)}
            </div>

            {roomWarning && (
              <p className="text-[11px] font-bold text-red-600">{roomWarning}</p>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Image Uploader, Status Selector, and Sessions repeatable rows */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Status Selector */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-5 shadow-2xs space-y-3 text-left">
            <label className="text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider block">Class Visibility Status</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Draft', 'Published', 'Archived'] as const).map(s => {
                const isActive = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                      isActive 
                        ? 'bg-brand-charcoal text-brand-cream border-brand-charcoal shadow-sm' 
                        : 'bg-brand-cream border-brand-clay text-brand-charcoal/70 hover:bg-brand-sand'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image Uploader — a workshop can carry several photos; the
              customer detail page rotates through all of them. */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-5 shadow-2xs space-y-3 text-left">
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-xs font-bold text-brand-charcoal/80 uppercase tracking-wider block">
                Workshop photos
              </label>
              <span className="text-[10px] font-bold text-brand-charcoal/45">
                {images.length} {images.length === 1 ? 'photo' : 'photos'}
              </span>
            </div>

            <label className="border-2 border-dashed border-brand-clay rounded-2xl p-5 text-center bg-brand-cream/20 flex flex-col items-center justify-center cursor-pointer hover:bg-brand-sand/30 transition-colors block">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageFileChange}
                disabled={uploadingPhotos}
                className="hidden"
              />
              <Upload className={`h-7 w-7 text-brand-terracotta mb-2 shrink-0 ${uploadingPhotos ? 'animate-pulse' : 'pulse-accent'}`} />
              <p className="text-xs font-bold text-brand-charcoal">
                {uploadingPhotos ? 'Uploading photos…' : 'Click or drag & drop photos here'}
              </p>
              <p className="text-[10px] text-brand-charcoal/50 mt-0.5">
                {uploadingPhotos
                  ? 'Please wait — do not close this form.'
                  : 'JPEG, PNG, WEBP (Max 5MB each) — pick several at once, or add more later'}
              </p>
            </label>

            {images.length > 0 ? (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {images.map((src, index) => (
                    <div
                      key={src}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-brand-clay bg-brand-clay"
                    >
                      <img src={src} alt={`Workshop photo ${index + 1}`} className="h-full w-full object-cover" />

                      {/* The first photo is the cover — it is what the workshop
                          card shows wherever a single image is needed. */}
                      {index === 0 ? (
                        <span className="absolute bottom-1 left-1 rounded bg-brand-terracotta px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                          Cover
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMakeCover(src)}
                          className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-charcoal opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-white"
                          title="Use as cover photo"
                        >
                          Make cover
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(src)}
                        aria-label={`Remove photo ${index + 1}`}
                        title="Remove photo"
                        className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-2xs hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-brand-charcoal/50 font-semibold">
                  The first photo is the cover, used on the workshop card. The rest appear in the
                  slider on the workshop page.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-brand-charcoal/50 font-semibold italic">
                No photos yet — the workshop will show an empty photo frame until one is added.
              </p>
            )}
          </div>

          {/* Section: Monthly Recurring Schedule Configuration */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-5 shadow-2xs space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-brand-clay/60 pb-3">
              <div>
                <h4 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-brand-terracotta" />
                  <span>Monthly Schedule</span>
                </h4>
                <p className="text-[11px] text-brand-charcoal/60 mt-0.5">
                  Define reusable monthly recurring schedule rules. Sessions are generated automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRecurringSchedules([
                    ...recurringSchedules,
                    {
                      id: `rule-${Date.now()}`,
                      daysOfWeek: ['Sunday', 'Tuesday'],
                      startTime: '04:00 PM',
                      duration: duration || '2 Hours',
                      instructor: selectedTutor?.name || '',
                      staffId: tutorStaffId || undefined,
                      capacity: capacity || 10,
                      room: room || 'Studio A',
                      effectiveStartDate: todayDateStr,
                      status: 'Active'
                    }
                  ]);
                }}
                className="px-3 py-1.5 bg-brand-sand hover:bg-brand-sand/80 text-brand-charcoal rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="h-3.5 w-3.5 text-brand-terracotta" />
                <span>Add Rule</span>
              </button>
            </div>

            {recurringSchedules.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50 italic py-2">No monthly schedule rules defined yet.</p>
            ) : (
              <div className="space-y-4">
                {recurringSchedules.map((rule, idx) => (
                  <div key={rule.id} className="p-3.5 bg-brand-cream/40 border border-brand-clay/60 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-brand-terracotta">Rule #{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={rule.status}
                          onChange={e => {
                            const updated = [...recurringSchedules];
                            updated[idx].status = e.target.value as any;
                            setRecurringSchedules(updated);
                          }}
                          className="bg-white border border-brand-clay text-[10px] font-bold rounded-lg px-2 py-0.5"
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setRecurringSchedules(recurringSchedules.filter(r => r.id !== rule.id))}
                          className="text-red-500 hover:text-red-700 p-1 rounded cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Days of week */}
                    <div>
                      <label className="text-[10px] font-bold text-brand-charcoal/70 uppercase block mb-1">Days of Week</label>
                      <div className="flex flex-wrap gap-1">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                          const isSelected = rule.daysOfWeek.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                const updated = [...recurringSchedules];
                                const currentDays = updated[idx].daysOfWeek;
                                updated[idx].daysOfWeek = isSelected 
                                  ? currentDays.filter(d => d !== day)
                                  : [...currentDays, day];
                                setRecurringSchedules(updated);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-brand-terracotta text-brand-cream' 
                                  : 'bg-white border border-brand-clay/60 text-brand-charcoal/60'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Start Time, Instructor, Capacity */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Start Time</label>
                        <input
                          type="text"
                          value={rule.startTime}
                          onChange={e => {
                            const updated = [...recurringSchedules];
                            updated[idx].startTime = e.target.value;
                            setRecurringSchedules(updated);
                          }}
                          className="w-full bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Capacity</label>
                        <input
                          type="number"
                          value={rule.capacity}
                          onChange={e => {
                            const updated = [...recurringSchedules];
                            updated[idx].capacity = parseInt(e.target.value) || 10;
                            setRecurringSchedules(updated);
                          }}
                          className="w-full bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs"
                        />
                      </div>
                    </div>

                    {/* Instructor with Staff Availability check */}
                    <div>
                      <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Instructor (Availability Check)</label>
                      <select
                        value={resolveStaffId(staff, rule.staffId, rule.instructor) || ''}
                        onChange={e => {
                          const nextId = e.target.value;
                          const member = staff.find(s => s.id === nextId);
                          const updated = [...recurringSchedules];
                          updated[idx] = {
                            ...updated[idx],
                            staffId: nextId || undefined,
                            instructor: member?.name || ''
                          };
                          setRecurringSchedules(updated);
                        }}
                        className="w-full bg-white border border-brand-clay rounded-lg p-1.5 text-xs font-semibold"
                      >
                        <option value="">Select Instructor...</option>
                        {/* Availability is evaluated against EVERY session this rule
                            will generate, read from the shared session calendar. */}
                        {staff
                          .filter(st => st.status === 'Active' || st.id === rule.staffId)
                          .map(st => {
                            const ruleConflict = findRuleConflict({
                              rule,
                              workshop: { duration },
                              staff: st,
                              assignmentSources,
                              spaceSources,
                              assignmentExclusion: editingExclusion,
                              spaceExclusion: editingExclusion,
                              ownSessions: workshopSessions
                            });
                            // An <option> renders text only, so this pair reads
                            // as words rather than symbols or an icon.
                            const availLabel = ruleConflict
                              ? `Busy: ${formatSlotDate(ruleConflict.date)} ${ruleConflict.startTime}–${ruleConflict.endTime}`
                              : 'Available';
                            return (
                              <option key={st.id} value={st.id}>
                                {st.name} ({availLabel})
                              </option>
                            );
                          })}
                      </select>

                      {/* Named conflict for the instructor currently on this rule */}
                      {(() => {
                        const ruleStaffId = resolveStaffId(staff, rule.staffId, rule.instructor);
                        const ruleStaff = ruleStaffId ? staff.find(st => st.id === ruleStaffId) : null;
                        if (!ruleStaff) return null;
                        const conflict = findRuleConflict({
                          rule,
                          workshop: { duration },
                          staff: ruleStaff,
                          assignmentSources,
                          spaceSources,
                          assignmentExclusion: editingExclusion,
                          spaceExclusion: editingExclusion,
                          ownSessions: workshopSessions
                        });
                        if (!conflict) return null;
                        return (
                          <p className="text-[10px] font-bold text-red-600 mt-1 leading-snug">
                            {conflict.message}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Studio room / table for this rule, with availability */}
                    <div>
                      <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Studio Room / Table (Availability Check)</label>
                      <select
                        value={rule.roomId || ''}
                        onChange={e => {
                          const nextId = e.target.value;
                          const space = studioSpaces.find(sp => sp.id === nextId);
                          const updated = [...recurringSchedules];
                          updated[idx] = {
                            ...updated[idx],
                            roomId: nextId || undefined,
                            room: space?.name || ''
                          };
                          setRecurringSchedules(updated);
                        }}
                        className="w-full bg-white border border-brand-clay rounded-lg p-1.5 text-xs font-semibold"
                      >
                        <option value="">Use the workshop's room</option>
                        {studioSpaces.map(space => {
                          const slots = getRuleSlots(rule, { duration });
                          const conflict = slots.length > 0
                            ? findSpaceConflictAcrossSlots(space, slots, spaceSources, editingExclusion)
                            : (space.status !== 'Active'
                                ? checkSpaceAvailability({
                                    space, date: todayDateStr, startTime: rule.startTime || '10:00 AM', sources: spaceSources
                                  })
                                : null);
                          return (
                            <option key={space.id} value={space.id} disabled={!!conflict}>
                              {conflict ? conflict.label : `${space.name} — Available`}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Effective dates */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Effective From</label>
                        <DateInput
                          value={rule.effectiveStartDate}
                          onChange={e => {
                          const updated = [...recurringSchedules];
                          updated[idx].effectiveStartDate = e.target.value;
                          setRecurringSchedules(updated);
                          }}
                          className="w-full bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-brand-charcoal/70 block mb-0.5">Effective Until (Optional)</label>
                        <DateInput
                          value={rule.effectiveEndDate || ''}
                          onChange={e => {
                          const updated = [...recurringSchedules];
                          updated[idx].effectiveEndDate = e.target.value;
                          setRecurringSchedules(updated);
                          }}
                          className="w-full bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Auto-Generate button */}
            <div className="pt-2 space-y-2">
              {/* Which month to generate for — independent of today's real
                  date, since a rule's own Effective From/Until is often for
                  a future month. Previously this was silently always "the
                  current real-world month," which produced nothing for a
                  rule scoped to a later month, or an unrelated result from
                  whichever other rule happened to cover today's month. */}
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-brand-charcoal/70 shrink-0">Generate for</label>
                <select
                  value={genTargetMonth}
                  onChange={e => setGenTargetMonth(Number(e.target.value))}
                  className="bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs cursor-pointer"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={genTargetYear}
                  onChange={e => setGenTargetYear(Number(e.target.value))}
                  className="bg-white border border-brand-clay rounded-lg p-1.5 font-semibold text-xs cursor-pointer"
                >
                  {[genBaseYear, genBaseYear + 1, genBaseYear + 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  // Block generation while any active rule would produce a session
                  // that clashes with the instructor or the studio space.
                  const blocking = findRecurringConflict(recurringSchedules);
                  if (blocking) {
                    alert(
                      `Session generation blocked — scheduling conflict.\n\n${blocking.conflict.message}\n\n` +
                      `Select another instructor or room for this rule, or change its time, then generate again.`
                    );
                    return;
                  }

                  const year = genTargetYear;
                  const month = genTargetMonth;
                  const mockWorkshop = {
                    id: editingWorkshopId || 'temp-ws',
                    title: title || 'Workshop',
                    duration: duration || '2 Hours',
                    instructor: selectedTutor?.name || '',
                    staffId: tutorStaffId || undefined,
                    room: selectedSpaceLabel || room,
                    roomId: roomId || undefined,
                    capacity: capacity || 10,
                    recurringSchedules
                  } as any;

                  // The generator dedupes against the sessions it is handed. It was
                  // handed an empty array, so every re-run produced a full second
                  // copy of the month — the source of the duplicate sessions in
                  // production. Pass the rows actually on the form, shaped the way
                  // the generator compares them: it reads `workshopId`, `date` and
                  // `startTime`, while the form rows carry the start time as `time`.
                  const existingForDedup = sessions.map(s => ({
                    ...s,
                    workshopId: mockWorkshop.id,
                    startTime: String((s as any).startTime ?? s.time ?? '')
                  })) as any[];

                  const generatedRecords = generateSessionsForMonth(mockWorkshop, year, month, existingForDedup);
                  if (generatedRecords.length > 0) {
                    const mappedNew = generatedRecords.map((g, i) => ({
                      // Keep the generator's deterministic id (workshop + date +
                      // time) when editing a saved workshop: sessions are written
                      // with bulkPut, so a re-run that slips past the dedup above
                      // overwrites its own earlier row instead of inserting a
                      // second one. A workshop being created has no id yet — a
                      // deterministic key would be `sess-temp-ws-...` and would
                      // collide with the NEXT new workshop, so those keep a
                      // unique id and rely on the in-form dedup alone.
                      id: editingWorkshopId ? g.id : `sess-gen-${Date.now()}-${i}`,
                      date: g.date,
                      time: g.startTime,
                      endTime: g.endTime,
                      duration: g.duration,
                      capacity: g.capacity,
                      spotsLeft: g.capacity,
                      isFull: false,
                      // Keep the stable links the generator resolved.
                      staffId: g.staffId,
                      instructor: g.instructor,
                      roomId: g.roomId,
                      room: g.room,
                      tableId: g.tableId,
                      ruleId: g.ruleId
                    }));
                    setSessions([...sessions, ...mappedNew]);
                    alert(`Generated ${generatedRecords.length} sessions from monthly recurring schedule for ${year}-${month < 10 ? '0' + month : month}!`);
                  } else {
                    // Distinguish "an active rule exists, but none of them
                    // cover the month you picked" (the confusing case this
                    // fix targets) from every other reason nothing came out
                    // (no rules, none Active, or all duplicates of existing
                    // sessions) — kept as the original generic message,
                    // rather than trying to enumerate every possible cause.
                    const monthStr = month < 10 ? `0${month}` : `${month}`;
                    const daysInTargetMonth = new Date(year, month, 0).getDate();
                    const monthStartStr = `${year}-${monthStr}-01`;
                    const monthEndStr = `${year}-${monthStr}-${daysInTargetMonth}`;
                    const hasActiveRule = recurringSchedules.some(r => r.status === 'Active');
                    const hasRuleCoveringMonth = recurringSchedules.some(r => {
                      if (r.status !== 'Active') return false;
                      const startsInTimeOrBefore = !r.effectiveStartDate || r.effectiveStartDate <= monthEndStr;
                      const endsInTimeOrAfter = !r.effectiveEndDate || r.effectiveEndDate >= monthStartStr;
                      return startsInTimeOrBefore && endsInTimeOrAfter;
                    });

                    if (hasActiveRule && !hasRuleCoveringMonth) {
                      alert(
                        `No active rule's Effective From/Until range covers ${MONTH_NAMES[month - 1]} ${year}.\n\n` +
                        `Adjust the rule's effective dates, or pick a different month above, then generate again.`
                      );
                    } else {
                      alert("No new sessions generated. Ensure rules are Active and valid.");
                    }
                  }
                }}
                className="w-full py-2 bg-brand-charcoal text-brand-cream hover:bg-black rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-brand-terracotta" />
                <span>Generate Monthly Sessions from Schedule</span>
              </button>
            </div>
          </div>


          </div>

        {/* SESSIONS — full width beneath both columns. In the 5-column
            side rail this became an extremely long vertical strip; across
            the whole grid the same rows fit several to a line. */}
        <div className="lg:col-span-12">
          {/* Section: Sessions repeating rows */}
          <div className="bg-white border border-brand-clay/70 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4 min-w-0 overflow-hidden">
            {/* Sits above the scroll area, so the heading and Add Session stay
                put while sessions 7+ scroll past underneath. */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-brand-sage">
                Sessions Calendar
                {sessions.length > 0 && (
                  <span className="text-brand-charcoal/45 ltr-numerals">
                    {' · '}{sessions.length} session{sessions.length === 1 ? '' : 's'}
                  </span>
                )}
              </h4>
              <button
                type="button"
                onClick={handleAddSession}
                className="cursor-pointer text-xs font-bold text-brand-terracotta hover:underline flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Add Session</span>
              </button>
            </div>

            {/* Three across, two rows deep: six sessions visible, the rest
                reached by scrolling inside this box. `session-grid-2-rows`
                sets the height from the row height itself, so it stays two
                rows however tall a card renders — a fixed pixel cap would cut
                the second row in half as soon as a card grew a line. */}
            <div
              ref={sessionsGridRef}
              className="session-grid-2-rows grid min-h-0 grid-cols-1 gap-3 overflow-y-auto always-scrollbar md:grid-cols-2 xl:grid-cols-3"
            >
              {sessions.map((sess) => (
                <div 
                  key={sess.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs overflow-hidden ${
                    sess.isFull 
                      ? 'bg-red-50/50 border-red-200' 
                      : 'bg-brand-cream/35 border-brand-clay/60 hover:bg-brand-sand/15'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DateInput
                        value={sess.date}
                        onChange={(e) => {
                        const newDate = e.target.value;
                        setSessions(sessions.map(s => s.id === sess.id ? { ...s, date: newDate } : s));
                        }}
                        className="bg-brand-cream border border-brand-clay p-1 rounded font-semibold text-xs text-brand-charcoal"
                      />
                      <input 
                        type="text" 
                        value={sess.time}
                        onChange={(e) => {
                          const newTime = e.target.value;
                          setSessions(sessions.map(s => s.id === sess.id ? { ...s, time: newTime } : s));
                        }}
                        className="bg-brand-cream border border-brand-clay p-1 rounded font-semibold text-xs text-brand-charcoal w-24"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
                      <span className="text-[10px] font-bold text-brand-charcoal/50">Room:</span>
                      <select
                        value={sess.roomId || ''}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const space = studioSpaces.find(sp => sp.id === nextId);
                          setSessions(sessions.map(s => s.id === sess.id
                            ? { ...s, roomId: nextId || undefined, room: space?.name || '' }
                            : s));
                        }}
                        className="bg-brand-cream border border-brand-clay p-0.5 rounded font-semibold text-[10px] text-brand-charcoal max-w-[150px] min-w-0 flex-shrink"
                      >
                        <option value="">Workshop default</option>
                        {studioSpaces.map(space => {
                          // Checked for this session's own date and time.
                          const slotStart = sess.time || sess.startTime;
                          const check = (sess.date && slotStart)
                            ? checkSpaceAvailability({
                                space,
                                date: sess.date,
                                startTime: slotStart,
                                endTime: sess.endTime,
                                duration: sess.duration || duration,
                                sources: spaceSources,
                                exclude: editingExclusion
                              })
                            : null;
                          const unavailable = check ? !check.isAvailable : space.status !== 'Active';
                          return (
                            <option key={space.id} value={space.id} disabled={unavailable}>
                              {check ? check.label : `${space.name} — ${space.status === 'Active' ? 'Available' : space.status}`}
                            </option>
                          );
                        })}
                      </select>

                      {/* This session's own instructor; blank uses the workshop tutor. */}
                      <span className="text-[10px] font-bold text-brand-charcoal/50 ml-2">Instructor:</span>
                      <select
                        value={sess.staffId || ''}
                        onChange={(e) => {
                          const nextId = e.target.value;
                          const member = staff.find(st => st.id === nextId);
                          setSessions(sessions.map(s => s.id === sess.id
                            ? { ...s, staffId: nextId || undefined, instructor: member?.name || '' }
                            : s));
                        }}
                        className="bg-brand-cream border border-brand-clay p-0.5 rounded font-semibold text-[10px] text-brand-charcoal max-w-[150px] min-w-0 flex-shrink"
                      >
                        <option value="">Workshop default</option>
                        {staff
                          .filter(member => member.status === 'Active' || member.id === sess.staffId)
                          .map(member => {
                            // Checked against this session's own date and time.
                            const slotStart = sess.time || sess.startTime;
                            const avail = (sess.date && slotStart)
                              ? checkStaffMemberAvailability({
                                  staff: member,
                                  date: sess.date,
                                  startTime: slotStart,
                                  endTime: sess.endTime,
                                  duration: sess.duration || duration,
                                  sources: assignmentSources,
                                  exclude: editingExclusion
                                })
                              : null;
                            const unavailable = avail ? !avail.isAvailable : false;
                            return (
                              <option key={member.id} value={member.id} disabled={unavailable}>
                                {avail ? `${member.name} — ${avail.status}` : member.name}
                              </option>
                            );
                          })}
                      </select>

                      <span className="text-[10px] font-bold text-brand-charcoal/50">Capacity:</span>
                      <input 
                        type="number"
                        value={sess.capacity}
                        onChange={(e) => {
                          const cap = parseInt(e.target.value) || 10;
                          setSessions(sessions.map(s => {
                            if (s.id !== sess.id) return s;
                            // Seats already booked are preserved; chairs left is
                            // derived from the new capacity, never hand-typed.
                            const booked = Math.max(0, (Number(s.capacity) || 0) - (Number(s.spotsLeft) || 0));
                            const left = Math.max(0, cap - booked);
                            return { ...s, capacity: cap, spotsLeft: left, isFull: left === 0 };
                          }));
                        }}
                        className="bg-brand-cream border border-brand-clay p-0.5 rounded font-bold text-xs text-brand-charcoal w-12 text-center"
                      />
                      <span className="font-bold text-brand-charcoal">chairs</span>

                      {/* Read-only: chairs left follows capacity and bookings. */}
                      <span className="text-[10px] font-bold text-brand-charcoal/50 ml-2">Left:</span>
                      <span className="bg-brand-sand/40 border border-brand-clay/60 p-0.5 rounded font-bold text-xs text-brand-charcoal w-12 text-center">
                        {sess.spotsLeft}
                      </span>
                    
                      {sess.isFull ? (
                        <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded font-extrabold uppercase">
                          Fully Booked
                        </span>
                      ) : (
                        <span className="text-[9px] bg-brand-sage/10 text-brand-sage px-1.5 py-0.5 rounded font-bold">
                          {sess.spotsLeft} open seats
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSession(sess.id)}
                    className="p-1.5 shrink-0 hover:bg-brand-clay/20 text-brand-charcoal/40 hover:text-brand-terracotta rounded cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
        </div>


        </div>

      </form>

      {/* ========================================================= */}
      {/* SECTION: SAVED WORKSHOPS & TIMETABLE SESSIONS TABLE */}
      {/* ========================================================= */}
      <div className="bg-white border border-brand-clay/70 rounded-3xl p-6 shadow-xl space-y-6 mt-8">
        
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-brand-charcoal flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-terracotta" />
              <span>Saved Workshops & Scheduled Sessions</span>
            </h3>
            <p className="text-xs text-brand-charcoal/50 mt-0.5">
              Click any row below to load its full curriculum and scheduled slots into the form above for editing.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-charcoal/40" />
            <input
              type="text"
              placeholder="Search table by title, tutor, category..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="w-full bg-brand-cream/40 border border-brand-clay/70 rounded-xl py-2 pl-9 pr-3 text-xs font-semibold text-brand-charcoal focus:outline-none focus:ring-1 focus:ring-brand-terracotta"
            />
          </div>
        </div>

        {/* The Dynamic Table Container */}
        <div className="overflow-x-auto border border-brand-clay/50 rounded-2xl">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-brand-sand/50 text-[11px] font-bold text-brand-charcoal border-b border-brand-clay/70 uppercase tracking-wider">
                <th onClick={() => toggleSort('title')} className="py-3 px-4 cursor-pointer hover:bg-brand-sand select-none transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Workshop Title</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-charcoal/40" />
                  </div>
                </th>
                <th onClick={() => toggleSort('category')} className="py-3 px-4 cursor-pointer hover:bg-brand-sand select-none transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-charcoal/40" />
                  </div>
                </th>
                <th onClick={() => toggleSort('skillLevel')} className="py-3 px-4 cursor-pointer hover:bg-brand-sand select-none transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Skill Level</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-charcoal/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Sessions</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-center">Capacity</th>
                <th onClick={() => toggleSort('price')} className="py-3 px-4 cursor-pointer hover:bg-brand-sand select-none transition-colors text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span>Price</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-charcoal/40" />
                  </div>
                </th>
                <th className="py-3 px-4">Instructor</th>
                <th onClick={() => toggleSort('status')} className="py-3 px-4 cursor-pointer hover:bg-brand-sand select-none transition-colors text-center">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span>Status</span>
                    <ArrowUpDown className="h-3 w-3 text-brand-charcoal/40" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-brand-clay/30 bg-white">
              
              {/* 1. LOADING SKELETON STATE */}
              {isWorkshopsLoading && (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-36"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-16"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-20"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-16 mx-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-12"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-8 mx-auto"></div></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 bg-brand-clay/35 rounded-md w-16 ml-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-brand-clay/35 rounded-md w-28"></div></td>
                    <td className="py-4 px-4"><div className="h-6 bg-brand-clay/35 rounded-full w-16 mx-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-6 bg-brand-clay/35 rounded-md w-12 mx-auto"></div></td>
                  </tr>
                ))
              )}

              {/* 2. EMPTY STATE */}
              {!isWorkshopsLoading && paginatedWorkshops.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="h-8 w-8 text-brand-charcoal/30" />
                      <p className="font-bold text-brand-charcoal/75">No scheduled workshops found</p>
                      <p className="text-[11px] text-brand-charcoal/50">
                        Try clearing or modifying your search query, or publish a new workshop to see it appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {/* 3. DYNAMIC WORKSHOP ROWS */}
              {!isWorkshopsLoading && paginatedWorkshops.map(ws => {
                const sessionCount = ws.sessions ? ws.sessions.length : 0;
                const isExpanded = expandedWorkshopIds.has(ws.id);
                const isEditingThis = editingWorkshopId === ws.id;

                return (
                  <React.Fragment key={ws.id}>
                    <tr
                      onClick={() => setEditingWorkshopId(ws.id)}
                      className={`group hover:bg-brand-sand/55 cursor-pointer transition-colors duration-150 ${
                        isEditingThis ? 'bg-brand-sand/65 font-semibold text-brand-terracotta border-l-4 border-l-brand-terracotta' : ''
                      }`}
                    >
                      {/* Workshop Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 text-left">
                          <img 
                            src={ws.image} 
                            alt={ws.title} 
                            className="h-9 w-12 object-cover rounded-lg shrink-0 border border-brand-clay/40"
                          />
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-bold text-brand-charcoal group-hover:text-brand-terracotta transition-colors truncate">
                              {ws.title}
                            </span>
                            <span className="text-[10px] text-brand-charcoal/40 font-semibold truncate">
                              {ws.hook}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 font-semibold text-brand-charcoal">
                        {ws.category}
                      </td>

                      {/* Skill Level */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          ws.skillLevel === 'Beginner' ? 'bg-brand-sage/10 text-brand-sage border-brand-sage/20' :
                          ws.skillLevel === 'Intermediate' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                          ws.skillLevel === 'Advanced' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                          'bg-brand-charcoal/5 text-brand-charcoal border-brand-charcoal/10'
                        }`}>
                          {ws.skillLevel || 'Beginner'}
                        </span>
                      </td>

                      {/* Sessions count with expand button */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => toggleExpandWorkshop(ws.id, e)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${
                            sessionCount > 0 
                              ? 'bg-brand-sand/60 text-brand-charcoal border-brand-clay hover:bg-brand-sand' 
                              : 'bg-brand-cream text-brand-charcoal/40 border-brand-clay/40'
                          }`}
                        >
                          <Calendar className="h-3 w-3 text-brand-terracotta" />
                          <span>{sessionCount} {sessionCount === 1 ? 'Session' : 'Sessions'}</span>
                          {sessionCount > 0 && (
                            isExpanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />
                          )}
                        </button>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 text-brand-charcoal/60 font-medium">
                        {ws.duration}
                      </td>

                      {/* Capacity */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-brand-charcoal/75">
                        {ws.capacity}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-brand-charcoal">
                        {ws.price} SAR
                      </td>

                      {/* Instructor — resolved from the assigned staff ID */}
                      <td className="py-3.5 px-4 font-semibold text-brand-charcoal/70">
                        {resolveStaffName(staff, ws.staffId, ws.instructor) || '—'}
                      </td>

                      {/* Status badge & Quick Switcher */}
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={ws.status || 'Published'}
                          onChange={async (e) => {
                            const newStatus = e.target.value as 'Draft' | 'Published' | 'Archived';
                            await updateWorkshop(ws.id, { status: newStatus });
                          }}
                          className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider cursor-pointer font-sans outline-none ${
                            (ws.status || 'Published') === 'Published' 
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                              : (ws.status || 'Published') === 'Draft'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <option value="Published">Published</option>
                          <option value="Draft">Draft</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkshopId(ws.id);
                          }}
                          className="px-2.5 py-1 bg-brand-cream border border-brand-clay hover:bg-brand-sand text-brand-charcoal font-bold rounded-lg text-xs transition-colors"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDED SESSIONS DETAIL SUB-ROW */}
                    {isExpanded && ws.sessions && ws.sessions.length > 0 && (
                      <tr className="bg-brand-cream/30 border-b border-brand-clay/50">
                        <td colSpan={10} className="p-4 pl-12">
                          <div className="bg-white border border-brand-clay/60 rounded-xl p-3 space-y-2">
                            <h5 className="text-xs font-bold text-brand-charcoal flex items-center gap-1.5 uppercase tracking-wider">
                              <Clock className="h-3.5 w-3.5 text-brand-terracotta" />
                              <span>Scheduled Timetable Slots for "{ws.title}"</span>
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {ws.sessions.map((sess: any, sIdx: number) => {
                                // Seats left are counted from the live bookings
                                // and walk-ins, by the same helper the customer
                                // site and the Live Queue use. A session row
                                // stores no spotsLeft of its own.
                                const usage = getSessionSeatUsage(sess, {
                                  workshops, bookings, queue
                                });
                                const isFull = usage.remainingCapacity <= 0;
                                return (
                                  <div key={sess.id || sIdx} className="p-2.5 bg-brand-sand/30 border border-brand-clay/40 rounded-lg flex items-center justify-between text-xs">
                                    <div>
                                      <p className="font-bold text-brand-charcoal">{sess.date}</p>
                                      <p className="text-[11px] text-brand-charcoal/70">{sess.time || sess.startTime}</p>
                                    </div>
                                    <div className="text-right">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        isFull ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                      }`}>
                                        {isFull ? 'Full' : `${usage.remainingCapacity} / ${usage.capacity} Left`}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

            </tbody>
          </table>
        </div>

        {/* PAGINATION CONTROLS (10 workshops per page) */}
        {processedWorkshops.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs font-semibold text-brand-charcoal/60">
              Showing <span className="font-bold text-brand-charcoal">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span>–<span className="font-bold text-brand-charcoal">{Math.min(currentPage * ITEMS_PER_PAGE, processedWorkshops.length)}</span> of <span className="font-bold text-brand-charcoal">{processedWorkshops.length}</span> workshops
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-brand-clay rounded-xl text-xs font-bold text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-sand transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-brand-charcoal px-2">
                Page {currentPage} of {totalWorkshopPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalWorkshopPages}
                onClick={() => setCurrentPage(prev => Math.min(totalWorkshopPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-brand-clay rounded-xl text-xs font-bold text-brand-charcoal disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-sand transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* STICKY FOOTER ACTION BAR
          Portalled to the body. `.page-transition` wraps every console page and
          runs a filling `transform` animation, which makes it the containing
          block for fixed children — so `bottom-0` was resolving to the bottom
          of the page content rather than the window, which is why the bar was
          clipped instead of sitting on the viewport edge. */}
      {showActionBar && createPortal(
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 z-40 flex flex-wrap items-center justify-between gap-3 border-t border-brand-clay bg-brand-cream p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <button
          type="button"
          onClick={handleSaveDraft}
          // Blocked mid-upload: saving now would store the photos that happen
          // to have finished and silently drop the rest.
          disabled={isSaving || uploadingPhotos}
          className="cursor-pointer px-5 py-3 rounded-xl border border-brand-clay bg-white text-xs font-bold text-brand-charcoal hover:bg-brand-sand transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          <span>{uploadingPhotos ? 'Uploading…' : isSaving ? 'Saving...' : 'Save Draft'}</span>
        </button>

        <div className="flex gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              // Cancel abandons the draft, it does not leave the page — routing
              // to the Dashboard lost the rest of the workshop list too.
              setEditingWorkshopId(null);
              resetForm();
              scrollFormIntoView();
            }}
            className="cursor-pointer px-5 py-3 text-xs font-bold text-brand-charcoal/60 hover:text-brand-charcoal disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            onClick={handlePublish}
            disabled={isSaving || uploadingPhotos}
            className="cursor-pointer rounded-xl bg-brand-terracotta px-6 py-3 text-xs font-bold text-brand-cream hover:bg-brand-terracotta-hover transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="h-4 w-4 stroke-[3]" />
            <span>{uploadingPhotos ? 'Uploading…' : isSaving ? 'Saving...' : (editingWorkshopId ? 'Update Workshop' : 'Publish Workshop')}</span>
          </button>
        </div>
      </div>,
      document.body
      )}

    </div>
  );
};
