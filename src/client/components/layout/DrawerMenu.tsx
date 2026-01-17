import { Sheet, SheetContent, SheetTitle } from '@/client/components/ui/sheet';
import React from 'react';
import { useRouter } from '../../router';
import { NavItem } from '../../components/layout/types';
import { useOpenBugReportDialog } from '@/client/features/bug-report';
import { Bug } from 'lucide-react';
import { Separator } from '@/client/components/ui/separator';

interface DrawerMenuProps {
  navItems: NavItem[];
  adminNavItems?: NavItem[];
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

export const DrawerMenu = ({ navItems, adminNavItems, mobileOpen, onDrawerToggle }: DrawerMenuProps) => {
  const { currentPath, navigate } = useRouter();
  const openBugReportDialog = useOpenBugReportDialog();

  const handleNavigation = (path: string) => {
    navigate(path);
    onDrawerToggle();
  };

  const handleReportBug = () => {
    onDrawerToggle();
    openBugReportDialog();
  };

  const renderNavItem = (item: NavItem) => {
    const selected = currentPath === item.path;
    return (
      <button
        key={item.path}
        onClick={() => handleNavigation(item.path)}
        className={`flex h-9 w-full items-center justify-start gap-2.5 rounded-md px-3 text-left text-sm ${selected
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
      >
        <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    );
  };

  const drawerContent = (
    <div className="py-2">
      <nav className="grid gap-0.5 px-2 pb-2">
        {navItems.map(renderNavItem)}
      </nav>

      {/* Admin Section */}
      {adminNavItems && adminNavItems.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="px-4 py-1">
            <span className="text-xs font-medium text-muted-foreground">Admin</span>
          </div>
          <nav className="grid gap-0.5 px-2 pb-2">
            {adminNavItems.map(renderNavItem)}
          </nav>
        </>
      )}

      <Separator className="my-2" />
      <div className="px-2">
        <button
          onClick={handleReportBug}
          className="flex h-9 w-full items-center justify-start gap-2.5 rounded-md px-3 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <Bug size={18} />
          </span>
          <span>Report a Bug</span>
        </button>
      </div>
    </div>
  );

  return (
    <Sheet open={mobileOpen} onOpenChange={(o) => !o && onDrawerToggle()}>
      <SheetContent side="left" className="w-64">
        <div className="px-4 py-2">
          <SheetTitle>Menu</SheetTitle>
        </div>
        {drawerContent}
      </SheetContent>
    </Sheet>
  );
};

export default DrawerMenu;
