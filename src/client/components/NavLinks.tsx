/**
 * Navigation Items
 *
 * This file combines template and project navigation items.
 * - NavLinks.template.tsx: Template items (synced from template)
 * - NavLinks.project.ts: Project items (your custom items)
 */

import { templateAdminMenuItems, filterAdminNavItems } from './template/NavLinks.template';
import { projectAdminMenuItems, navItems, menuItems } from './project/NavLinks.project';

// Re-export for use by Layout
export { navItems, menuItems, filterAdminNavItems };

/** Combined admin menu items (template + project) */
export const adminMenuItems = [
  ...templateAdminMenuItems,
  ...projectAdminMenuItems,
];
