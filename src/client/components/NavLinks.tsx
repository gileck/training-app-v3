/**
 * Project Navigation Items
 *
 * This file defines the app's navigation menus.
 * Admin items and utilities are imported from NavLinks.template.tsx (synced from template).
 *
 * Customize navItems and menuItems for your project's needs.
 */

import { NavItem } from './layout/types';
import { Dumbbell, Calendar, Settings, TrendingUp, Palette } from 'lucide-react';

// Re-export template items and utilities
export { adminMenuItems, filterAdminNavItems } from './NavLinks.template';

/** Bottom navigation bar items (Training App) */
export const navItems: NavItem[] = [
  { path: '/', label: 'Workout', icon: <Dumbbell size={18} /> },
  { path: '/training-plans', label: 'Plans', icon: <Calendar size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

/** Hamburger menu items (Training App) */
export const menuItems: NavItem[] = [
  { path: '/', label: 'Workout', icon: <Dumbbell size={18} /> },
  { path: '/training-plans', label: 'Training Plans', icon: <Calendar size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/theme', label: 'Theme', icon: <Palette size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];
