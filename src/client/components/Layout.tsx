import { ReactNode, useState } from 'react';
import { TopNavBar } from './layout/TopNavBar';
import { BottomNavBar } from './layout/BottomNavBar';
import { DrawerMenu } from './layout/DrawerMenu';
import { Footer } from './layout/Footer';
import { NavigatorStandalone } from './layout/types';
import { filterAdminNavItems, menuItems, navItems } from './NavLinks';
import { BugReportDialog, useGlobalErrorHandler, ErrorBoundary, useNetworkLogger } from '@/client/features';
import { ToastContainer } from './ui/toast';
import { useIsAdmin } from '@/client/features/auth';


export const Layout = ({ children }: { children?: ReactNode }) => {
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral drawer open state
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as NavigatorStandalone).standalone);
  const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false;

  // Set up global error handler
  useGlobalErrorHandler();

  // Set up network status logger
  useNetworkLogger();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // iOS Safari/PWA Fix: Use 100dvh on mobile instead of min-h-screen
  // This makes the container height equal to the dynamic viewport height,
  // which automatically adjusts when iOS keyboard/toolbar appears/disappears.
  // The BottomNavBar sits at the flex container bottom (no position:fixed needed).
  // See BottomNavBar.tsx for full documentation of the iOS viewport fix.
  return (
    <div 
      className={`flex flex-col ${isStandalone && isMobile ? 'pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]' : ''}`}
      style={{
        height: isMobile ? '100dvh' : undefined,
        minHeight: isMobile ? undefined : '100vh',
      }}
    >
      {/* Top Navigation Bar */}
      <TopNavBar
        navItems={filterAdminNavItems(navItems, isAdmin)}
        isStandalone={isStandalone}
        onDrawerToggle={handleDrawerToggle}
      />

      {/* Mobile Drawer Menu */}
      <DrawerMenu
        navItems={filterAdminNavItems(menuItems, isAdmin)}
        mobileOpen={mobileOpen}
        onDrawerToggle={handleDrawerToggle}
      />

      {/* Main Content - scrolls internally on mobile */}
      <main 
        className="mx-auto w-full max-w-screen-lg flex-1 overflow-y-auto px-2 py-3 sm:px-4"
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>

      {/* Footer (hidden on mobile) */}
      <Footer isStandalone={isStandalone} />

      {/* Bottom Navigation (mobile only) */}
      <BottomNavBar navItems={filterAdminNavItems(navItems, isAdmin)} />

      {/* Bug Report Dialog */}
      <BugReportDialog />

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
