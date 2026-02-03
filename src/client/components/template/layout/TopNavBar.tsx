import { Menu, Moon, SunMedium, LogIn, User, LogOut, WifiOff, Wifi } from 'lucide-react';
import { useRouter } from '@/client/features';
import { NavItem } from './types';
import {
  useAuthStore,
  useUser,
  useLogout,
  useSettingsStore,
  useEffectiveOffline,
  useThemeStore,
} from '@/client/features';
import { useState } from 'react';
import { Button } from '@/client/components/template/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/client/components/template/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/client/components/template/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/client/components/template/ui/dialog';

interface TopNavBarProps {
  navItems: NavItem[];
  isStandalone?: boolean;
  onDrawerToggle: () => void;
}

export const TopNavBar = ({ navItems, isStandalone, onDrawerToggle }: TopNavBarProps) => {
  const { currentPath, navigate } = useRouter();

  // Use Zustand stores
  const user = useUser();
  const userHint = useAuthStore((state) => state.userPublicHint);
  const isProbablyLoggedIn = useAuthStore((state) => state.isProbablyLoggedIn);
  const isValidated = useAuthStore((state) => state.isValidated);

  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const isDeviceOffline = useSettingsStore((state) => state.isDeviceOffline);
  const effectiveOffline = useEffectiveOffline();
  
  // Theme store for light/dark mode
  const themeMode = useThemeStore((state) => state.settings.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  // Use logout mutation
  const logoutMutation = useLogout();

  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dropdown menu state
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral dialog state
  const [offlineDialogOpen, setOfflineDialogOpen] = useState(false);

  // User can toggle back online only if device has network AND they manually enabled offline mode
  const canToggleOnline = !isDeviceOffline && settings.offlineMode;

  // Determine if user is authenticated (validated or has hint for instant boot)
  const isAuthenticated = isValidated && !!user;
  // For instant boot, show UI based on hint before validation completes
  const showAuthenticatedUI = isAuthenticated || isProbablyLoggedIn;

  // Display user - use validated user if available, otherwise fall back to hint
  const displayUser = user || (userHint ? {
    username: userHint.name,
    email: userHint.email,
    profilePicture: userHint.avatar,
  } : null);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleMenuClose = () => setOpen(false);

  const handleProfileClick = () => { handleMenuClose(); navigate('/profile'); };

  const handleLogoutClick = async () => {
    handleMenuClose();
    logoutMutation.mutate();
  };

  const handleThemeToggle = () => { setThemeMode(themeMode === 'light' ? 'dark' : 'light'); };

  const getThemeIcon = () => themeMode === 'light' ? <Moon size={18} /> : <SunMedium size={18} />;

  const handleGoOnline = () => {
    updateSettings({ offlineMode: false });
    setOfflineDialogOpen(false);
  };

  return (
    <>
      {/* Header uses CSS variables for theming - inline styles ensure proper reactivity when theme changes */}
      <nav 
        className={`sticky top-0 z-40 border-b backdrop-blur ${isStandalone ? 'backdrop-blur-md' : ''}`}
        style={{ 
          backgroundColor: 'hsl(var(--header) / 0.8)', 
          color: 'hsl(var(--header-foreground))' 
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-screen-lg items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="open drawer" onClick={onDrawerToggle}>
              <Menu size={18} />
            </Button>
            <div className="hidden sm:block">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  variant={currentPath === item.path ? 'secondary' : 'ghost'}
                  className="mx-0.5"
                  onClick={() => handleNavigation(item.path)}
                >
                  <span className="mr-2 inline-flex">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {effectiveOffline && (
              <button
                onClick={canToggleOnline ? () => setOfflineDialogOpen(true) : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  isDeviceOffline
                    ? 'border-muted-foreground/50 text-muted-foreground cursor-default'
                    : 'border-warning text-warning hover:bg-warning/10 cursor-pointer'
                }`}
                title={isDeviceOffline ? 'No network connection' : 'Click to go online'}
              >
                <WifiOff size={16} />
                <span className="hidden sm:inline">Offline</span>
              </button>
            )}

            <Button variant="ghost" size="icon" onClick={handleThemeToggle} title={`Current mode: ${themeMode}`} aria-label="toggle theme">
              {getThemeIcon()}
            </Button>

            {showAuthenticatedUI ? (
              <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="user menu">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={displayUser?.profilePicture} alt={displayUser?.username} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {displayUser?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{displayUser?.username}</span>
                      <span className="text-xs text-muted-foreground">{displayUser?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleProfileClick}>
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogoutClick} disabled={logoutMutation.isPending}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={handleLoginClick}>
                <LogIn className="mr-2 h-4 w-4" /> Login
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Go Online Dialog */}
      <Dialog open={offlineDialogOpen} onOpenChange={setOfflineDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-success" />
              Go Online?
            </DialogTitle>
            <DialogDescription>
              You&apos;re currently in offline mode. Any pending changes will be synced when you go back online.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setOfflineDialogOpen(false)}>
              Stay Offline
            </Button>
            <Button className="flex-1" onClick={handleGoOnline}>
              Go Online
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopNavBar;
