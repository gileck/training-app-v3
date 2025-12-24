import { NavItem } from './layout/types';
import { Dumbbell, Calendar, Settings, ClipboardList, TrendingUp, Palette } from 'lucide-react';

// Main bottom navigation (Training App)
export const navItems: NavItem[] = [
  { path: '/', label: 'Workout', icon: <Dumbbell size={18} /> },
  { path: '/training-plans', label: 'Plans', icon: <Calendar size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

// Drawer menu with additional items
export const menuItems: NavItem[] = [
  { path: '/', label: 'Workout', icon: <Dumbbell size={18} /> },
  { path: '/training-plans', label: 'Training Plans', icon: <Calendar size={18} /> },
  { path: '/progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { path: '/admin/reports', label: 'Reports', icon: <ClipboardList size={18} /> },
  { path: '/theme', label: 'Theme', icon: <Palette size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export function filterAdminNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => !item.path.startsWith('/admin'));
}
