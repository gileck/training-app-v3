/**
 * Template Navigation Items
 *
 * These are admin menu items provided by the template.
 * Do not modify this file - it will be overwritten during template sync.
 *
 * To customize navigation, modify NavLinks.project.ts instead.
 */

import { NavItem } from './layout/types';
import { ClipboardList, UserCheck, Bug, Database, Activity, Plug, Users, Palette, Settings } from 'lucide-react';

/**
 * Template-provided app menu items (rendered after project items in the drawer).
 * Note: '/my-requests' is intentionally omitted — each project opts in by adding
 * it to menuItems in NavLinks.project.tsx if it wants the feature-request page.
 */
export const templateMenuItems: NavItem[] = [
  { path: '/theme', label: 'Theme', icon: <Palette size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

/** Template admin-only menu items */
export const templateAdminMenuItems: NavItem[] = [
  { path: '/admin/reports', label: 'Reports', icon: <ClipboardList size={18} /> },
  { path: '/admin/users', label: 'Users', icon: <Users size={18} /> },
  { path: '/admin/approvals', label: 'Approvals', icon: <UserCheck size={18} /> },
  { path: '/admin/sessions', label: 'Sessions', icon: <Activity size={18} /> },
  { path: '/admin/rpc-connection', label: 'RPC Connection', icon: <Plug size={18} /> },
  { path: '/admin/service-worker', label: 'SW & Push Debug', icon: <Bug size={18} /> },
  { path: '/admin/mongo-explorer', label: 'Mongo Explorer', icon: <Database size={18} /> },
];

/** Utility to filter admin items based on user role */
export function filterAdminNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => !item.path.startsWith('/admin'));
}
