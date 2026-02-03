import { useRouter } from '@/client/features';
import { NavItem } from './types';

interface BottomNavBarProps {
  navItems: NavItem[];
}

/**
 * BottomNavBar - Mobile navigation fixed at the bottom of the screen.
 * 
 * ## iOS Safari/PWA Viewport Fix
 * 
 * This navbar does NOT use `position: fixed`. Instead, it sits at the bottom
 * of a flexbox container that uses `height: 100dvh` (see Layout.tsx).
 * 
 * ### The Problem
 * iOS Safari and PWA have viewport bugs where `position: fixed; bottom: 0`
 * elements get mispositioned when:
 * - The iOS keyboard opens/closes
 * - The browser toolbar shows/hides on scroll
 * - In PWA standalone mode after keyboard interactions
 * 
 * ### The Solution (100dvh Layout)
 * Instead of `position: fixed`, we use a CSS-only approach:
 * 1. Layout.tsx sets `height: 100dvh` on mobile (dynamic viewport height)
 * 2. Main content has `overflow-y: auto` (scrolls internally)
 * 3. This navbar uses `shrink-0` and sits naturally at the flex container bottom
 * 
 * The `dvh` unit automatically adjusts when iOS shows/hides the keyboard or
 * toolbar, so the navbar stays correctly positioned without any JavaScript.
 * 
 * ### What We Tried That Didn't Work
 * - Option 1: Scroll jiggle on focusout - fixed keyboard but broke scroll-down
 * - Complex visualViewport API tracking - too many edge cases, flickering
 * - Force repaint on keyboard close - inconsistent results
 * 
 * @see Layout.tsx for the parent container setup
 */
export const BottomNavBar = ({ navItems }: BottomNavBarProps) => {
  const { currentPath, navigate } = useRouter();

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // No position:fixed - navbar sits at bottom of 100dvh flex container (see docs above)
  // Footer uses CSS variables for theming - inline styles ensure proper reactivity when theme changes
  return (
    <div
      className="z-40 block shrink-0 border-t sm:hidden"
      style={{
        backgroundColor: 'hsl(var(--footer))',
        color: 'hsl(var(--footer-foreground))',
        paddingBottom: 'max(4px, calc(env(safe-area-inset-bottom, 0px) / 2))',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div
        className="mx-auto grid max-w-screen-lg gap-1 px-2 pt-1"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}
      >
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNavigation(item.path)}
              aria-current={active ? 'page' : undefined}
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors ${active
                ? 'bg-accent text-foreground'
                : 'hover:bg-accent/50 hover:text-foreground'
              }`}
              style={!active ? { color: 'hsl(var(--footer-foreground))' } : undefined}
            >
              <span 
                className={active ? 'text-primary' : ''}
                style={!active ? { color: 'hsl(var(--footer-foreground))' } : undefined}
              >
                {item.icon}
              </span>
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavBar;
