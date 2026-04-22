/**
 * Project Navigation Items
 *
 * Define your project-specific navigation items here.
 * This file is NOT synced from template - it's owned by your project.
 */

import { NavItem } from '../template/layout/types';
import { Home, Dumbbell, TrendingUp, Settings } from 'lucide-react';
import { ActiveWorkoutStatusBar } from './ActiveWorkoutStatusBar';

/** Renders in the center of the TopNavBar. Returns null when there's no active workout. */
export const TopNavBarSlot = ActiveWorkoutStatusBar;

/** Project-specific admin menu items */
export const projectAdminMenuItems: NavItem[] = [
  // Add your admin menu items here if needed
];

/** Bottom navigation bar items */
export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/training-plans', label: 'Plans', icon: <Dumbbell size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

/** Regular app menu items (shown in hamburger menu) */
export const menuItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/training-plans', label: 'Training Plans', icon: <Dumbbell size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];
