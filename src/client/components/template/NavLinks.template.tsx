/**
 * Template Navigation Items
 *
 * These are admin menu items provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To customize navigation, modify NavLinks.project.ts instead.
 */

import { NavItem } from './layout/types';
import { ClipboardList, Workflow } from 'lucide-react';

/** Template admin-only menu items */
export const templateAdminMenuItems: NavItem[] = [
  { path: '/admin/reports', label: 'Reports', icon: <ClipboardList size={18} /> },
  { path: '/admin/workflow', label: 'Workflow', icon: <Workflow size={18} /> },
];

/** Utility to filter admin items based on user role */
export function filterAdminNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => !item.path.startsWith('/admin'));
}
