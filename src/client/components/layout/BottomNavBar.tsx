import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from '../../router';
import { NavItem } from '../../components/layout/types';

interface BottomNavBarProps {
  navItems: NavItem[];
}

// =============================================================================
// iOS Safari Viewport Offset Hook
// =============================================================================
// 
// MAGIC NUMBERS REFERENCE:
// - 100ms: Time for iOS to finish viewport adjustment before recalculating
// - 300ms: Time for iOS Safari to settle after keyboard dismisses
// - 50px: Threshold for "normal" viewport (accounts for minor toolbar differences)
//

/**
 * Hook to handle iOS Safari's dynamic viewport (address bar hide/show + keyboard)
 * Returns the offset needed to keep fixed bottom elements properly positioned
 * 
 * ## Problem
 * iOS Safari has a "dynamic viewport" where the address bar hides/shows during scroll.
 * Fixed position elements (like bottom navbars) can detach from the screen edge,
 * floating above the bottom with a visible gap.
 * 
 * ## Solution
 * Uses the Visual Viewport API to calculate the difference between the layout viewport
 * (window.innerHeight) and the visual viewport (what the user actually sees).
 * This difference is applied as a `bottom` offset to keep the navbar anchored.
 * 
 * ## Edge Cases Handled
 * - Address bar show/hide during scroll (visualViewport resize/scroll events)
 * - Keyboard appearance/dismissal (focusin/focusout with delayed reset)
 * - App switching (visibilitychange event)
 * - Orientation changes (window resize event)
 * 
 * ## Keyboard Dismiss Fix
 * When keyboard dismisses, iOS Safari sometimes doesn't fire visualViewport events,
 * leaving the offset "stuck". Fix: On focusout, wait 300ms for iOS to settle, 
 * then check if viewport is back to normal (within 50px threshold). If so, reset to 0.
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API
 */
function useIOSViewportOffset() {
  // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral UI state for iOS Safari viewport offset, changes rapidly during scroll
  const [offset, setOffset] = useState(0);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isKeyboardOpenRef = useRef(false);

  // Force reset offset to 0 (used when viewport returns to normal state)
  const forceReset = useCallback(() => {
    setOffset(0);
  }, []);

  // Calculate and set the offset based on viewport differences
  const updateOffset = useCallback(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      // Layout viewport = full page height (includes hidden address bar space)
      // Visual viewport = what user actually sees (shrinks when address bar visible)
      const layoutHeight = window.innerHeight;
      const visualHeight = window.visualViewport.height;
      const visualOffsetTop = window.visualViewport.offsetTop;

      // The offset is how much the visual viewport is shifted from the bottom
      // This value is applied to `bottom` style to keep navbar at visible bottom
      const newOffset = layoutHeight - visualHeight - visualOffsetTop;
      setOffset(Math.max(0, newOffset));
    }
  }, []);

  // Delayed reset - handles iOS Safari's unreliable viewport events after keyboard dismisses
  const scheduleReset = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    // 300ms - time for iOS Safari to settle after keyboard dismisses
    // iOS doesn't reliably fire visualViewport events on keyboard dismiss
    resetTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const layoutHeight = window.innerHeight;
        const visualHeight = window.visualViewport.height;

        // 50px threshold - accounts for minor viewport differences (toolbars, etc.)
        // If difference is small, viewport is "back to normal" and we can reset
        if (Math.abs(layoutHeight - visualHeight) < 50) {
          forceReset();
        } else {
          // Viewport still different (e.g., address bar visible), recalculate
          updateOffset();
        }
      }
    }, 300);
  }, [updateOffset, forceReset]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    // Initial calculation on mount
    updateOffset();

    // === Visual Viewport Events ===
    // Fires when address bar shows/hides during scroll
    window.visualViewport.addEventListener('resize', updateOffset);
    window.visualViewport.addEventListener('scroll', updateOffset);

    // === Keyboard Focus Detection ===
    // Track when keyboard opens/closes to handle the dismissal edge case
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInput) {
        isKeyboardOpenRef.current = true;
        // 100ms delay - allows iOS to finish viewport adjustment before recalculating
        setTimeout(updateOffset, 100);
      }
    };

    const handleFocusOut = () => {
      if (isKeyboardOpenRef.current) {
        isKeyboardOpenRef.current = false;
        // Don't immediately reset - schedule a delayed check
        // This handles iOS Safari's unreliable viewport events on keyboard dismiss
        scheduleReset();
      }
    };

    // === App Switching ===
    // Recalculate when user returns to app (viewport may have changed)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 100ms delay - allows iOS to finish viewport adjustment before recalculating
        setTimeout(updateOffset, 100);
      }
    };

    // Add all event listeners
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', updateOffset); // Orientation changes

    return () => {
      window.visualViewport?.removeEventListener('resize', updateOffset);
      window.visualViewport?.removeEventListener('scroll', updateOffset);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', updateOffset);

      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, [updateOffset, scheduleReset]);

  return offset;
}

export const BottomNavBar = ({ navItems }: BottomNavBarProps) => {
  const { currentPath, navigate } = useRouter();
  const iosOffset = useIOSViewportOffset();

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div
      className="fixed inset-x-0 z-40 block border-t bg-background sm:hidden"
      style={{
        // Use bottom with iOS offset to handle Safari's dynamic viewport
        bottom: `${iosOffset}px`,
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
        // iOS Safari fixes for fixed positioning during scroll
        transform: 'translate3d(0, 0, 0)',
        WebkitTransform: 'translate3d(0, 0, 0)',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
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
              className={`flex h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors ${active
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
            >
              <span className={active ? 'text-primary' : 'text-muted-foreground'}>{item.icon}</span>
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavBar;
