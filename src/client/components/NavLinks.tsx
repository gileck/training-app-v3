/**
 * Navigation Items
 *
 * This file combines template and project navigation items.
 * - NavLinks.template.tsx: Template items (synced from template)
 * - NavLinks.project.ts: Project items (your custom items)
 */

import type { ReactNode } from 'react';
import { templateAdminMenuItems, filterAdminNavItems } from './template/NavLinks.template';
import { projectAdminMenuItems, navItems, menuItems } from './project/NavLinks.project';
import * as projectNavModule from './project/NavLinks.project';

// Re-export for use by Layout
export { navItems, menuItems, filterAdminNavItems };

// Optional project-owned slot: child projects add `export const TopNavBarSlot`
// to NavLinks.project.tsx to render a custom component in the top nav bar.
// Fallback keeps the template backward-compatible with projects that haven't
// added the export yet.
const projectTopNavBarSlot =
  (projectNavModule as { TopNavBarSlot?: () => ReactNode }).TopNavBarSlot;
export const TopNavBarSlot: () => ReactNode =
  projectTopNavBarSlot ?? (() => null);

// Same shape, but rendered in the right-side controls cluster (before the
// offline indicator / theme toggle / avatar). Use this for status pills or
// utility buttons that should sit next to the user controls.
const projectTopNavBarRightSlot =
  (projectNavModule as { TopNavBarRightSlot?: () => ReactNode }).TopNavBarRightSlot;
export const TopNavBarRightSlot: () => ReactNode =
  projectTopNavBarRightSlot ?? (() => null);

/** Combined admin menu items (template + project) */
export const adminMenuItems = [
  ...templateAdminMenuItems,
  ...projectAdminMenuItems,
];
