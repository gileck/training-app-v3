import React, { ReactNode, useEffect, useRef } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useThemeStore } from '@/client/features';

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const settings = useThemeStore((state) => state.settings);
  const applyTheme = useThemeStore((state) => state.applyTheme);
  const setInitialized = useThemeStore((state) => state.setInitialized);
  const initialized = useThemeStore((state) => state.initialized);
  const hasApplied = useRef(false);

  // Apply theme on mount and whenever settings change
  useEffect(() => {
    // Apply theme immediately
    applyTheme();
    
    // Mark as initialized after first application
    if (!hasApplied.current) {
      hasApplied.current = true;
      setInitialized();
    }
  }, [settings, applyTheme, setInitialized]);

  // Also sync with next-themes for SSR compatibility
  useEffect(() => {
    const root = document.documentElement;
    if (settings.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.mode]);

  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme={settings.mode} 
      enableSystem={false}
      forcedTheme={initialized ? settings.mode : undefined}
    >
      {children}
    </NextThemesProvider>
  );
};
