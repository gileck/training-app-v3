import { ReactNode } from 'react';

export interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

export interface NavigatorStandalone {
  standalone?: boolean;
}
