import React, { ReactNode, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { useSettingsStore } from '@/client/features/settings';

export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const theme = useSettingsStore((state) => state.settings.theme);

  // Sync next-themes with app settings
  useEffect(() => {
    // next-themes reads class on html; we rely on attribute "class" toggling
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <NextThemesProvider attribute="class" defaultTheme={theme} enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
};
