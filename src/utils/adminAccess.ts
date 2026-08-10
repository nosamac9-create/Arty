/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin Console pages and the permission rules that guard them.
 *
 * The page list mirrors the Admin Console routes exactly — the same ids the
 * sidebar and App router use — so a permission can never name a page that does
 * not exist. There is one permission system, stored on the staff record.
 */

import { StaffMember, StaffRole } from '../types';

export type AdminPageId =
  | 'dashboard'
  | 'queue'
  | 'customers'
  | 'staff'
  | 'bookings'
  | 'workshops-admin'
  | 'events-admin'
  | 'pieces-admin'
  | 'system-health'
  | 'settings';

export interface AdminPage {
  id: AdminPageId;
  label: string;
}

/** The real Admin Console pages, in sidebar order. */
export const ADMIN_PAGES: AdminPage[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'queue', label: 'Live Queue' },
  { id: 'customers', label: 'Customers' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'workshops-admin', label: 'Workshops' },
  { id: 'events-admin', label: 'Events & Socials' },
  { id: 'pieces-admin', label: 'Pottery Pieces' },
  { id: 'system-health', label: 'System Health' },
  { id: 'settings', label: 'Settings' }
];

export const ADMIN_PAGE_IDS: AdminPageId[] = ADMIN_PAGES.map(p => p.id);

export function getPageLabel(id: string): string {
  return ADMIN_PAGES.find(p => p.id === id)?.label || id;
}

/** The role itself grants unrestricted access; no page needs selecting. */
export function isSuperAdmin(staff?: StaffMember | null): boolean {
  return staff?.role === 'Super Admin';
}

/** Can this staff member sign in to the console at all? */
export function hasConsoleAccount(staff?: StaffMember | null): boolean {
  if (!staff) return false;
  if (staff.status === 'Inactive' || staff.status === 'Former Staff') return false;
  return staff.hasConsoleAccess === true;
}

/**
 * Page-level authorization. Checked before rendering a protected page and
 * before protected writes — not only when drawing the sidebar.
 */
export function canAccessPage(staff: StaffMember | null | undefined, pageId: string): boolean {
  if (!staff) return false;
  if (!hasConsoleAccount(staff)) return false;
  if (isSuperAdmin(staff)) return true;
  return (staff.permissions || []).includes(pageId);
}

/** Every page this staff member may open, in console order. */
export function allowedPages(staff: StaffMember | null | undefined): AdminPage[] {
  if (!staff) return [];
  if (isSuperAdmin(staff)) return ADMIN_PAGES;
  return ADMIN_PAGES.filter(page => canAccessPage(staff, page.id));
}

/** Where to land after signing in. Null when the account has no pages at all. */
export function firstAllowedPage(staff: StaffMember | null | undefined): AdminPageId | null {
  return allowedPages(staff)[0]?.id ?? null;
}

/** Default page set for a newly granted console account. */
export function defaultPermissionsForRole(role: StaffRole): string[] {
  if (role === 'Super Admin') return [...ADMIN_PAGE_IDS];
  if (role === 'Admin') return ADMIN_PAGE_IDS.filter(id => id !== 'settings');
  return ['dashboard', 'queue'];
}

/** Keeps only ids that are real console pages. */
export function sanitizePermissions(permissions?: string[]): string[] {
  if (!permissions) return [];
  return permissions.filter(id => ADMIN_PAGE_IDS.includes(id as AdminPageId));
}


/**
 * Settings subsections, shown as a submenu under Settings in the sidebar.
 * These are the sections that already exist on the Settings page — the ids match
 * what the page renders, so navigation and content can never drift apart.
 */
export type SettingsSectionId =
  | 'settings-stages'
  | 'settings-workshop-lists'
  | 'settings-popup'
  | 'settings-staff-registry'
  | 'settings-pottery-logging'
  | 'settings-capacity'
  | 'settings-events'
  | 'settings-data-reset';

export interface SettingsSection {
  id: SettingsSectionId;
  label: string;
}

/**
 * Ids are namespaced so they can never collide with an Admin Console page id —
 * "staff" is the Staff Management page, "settings-staff-registry" is a section.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'settings-stages', label: 'Piece Pipeline Stages' },
  { id: 'settings-workshop-lists', label: 'Workshop Detail Lists' },
  { id: 'settings-popup', label: 'Booking Pop-up' },
  { id: 'settings-staff-registry', label: 'Staff Registry' },
  { id: 'settings-pottery-logging', label: 'Pottery Logging Console' },
  { id: 'settings-capacity', label: 'Capacity' },
  { id: 'settings-events', label: 'Events / Birthday' },
  { id: 'settings-data-reset', label: 'Data Reset' }
];

/** Maps a legacy stored section id onto its namespaced replacement. */
const LEGACY_SECTION_IDS: Record<string, SettingsSectionId> = {
  'stages': 'settings-stages',
  'workshops': 'settings-workshop-lists',
  'popup': 'settings-popup',
  'staff': 'settings-staff-registry',
  'pottery-logging': 'settings-pottery-logging',
  'capacity': 'settings-capacity',
  'events': 'settings-events',
  'data-reset': 'settings-data-reset'
};

/** Resolves any stored value — new or legacy — to a valid section. */
export function resolveSettingsSection(value?: string | null): SettingsSectionId {
  if (value && isSettingsSection(value)) return value;
  if (value && LEGACY_SECTION_IDS[value]) return LEGACY_SECTION_IDS[value];
  return 'settings-stages';
}

export const SETTINGS_SECTION_IDS = SETTINGS_SECTIONS.map(s => s.id);

export function isSettingsSection(value: string): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.includes(value as SettingsSectionId);
}

export function getSettingsSectionLabel(id: string): string {
  return SETTINGS_SECTIONS.find(s => s.id === id)?.label || id;
}
