/**
 * Template Navigation Items
 *
 * These are admin menu items provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To customize navigation, modify NavLinks.tsx instead.
 */

import { NavItem } from './layout/types';
import { ClipboardList, Lightbulb } from 'lucide-react';

/** Admin-only menu items (shown in separate section) */
export const adminMenuItems: NavItem[] = [
  { path: '/admin/reports', label: 'Reports', icon: <ClipboardList size={18} /> },
  { path: '/admin/feature-requests', label: 'Feature Requests', icon: <Lightbulb size={18} /> },
];

export function filterAdminNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => !item.path.startsWith('/admin'));
}
