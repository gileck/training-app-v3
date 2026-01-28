/**
 * useIOSKeyboardOffset Hook
 *
 * Detects iOS keyboard and calculates offset needed to keep content visible.
 * Uses the visualViewport API to detect when the keyboard reduces visible area.
 *
 * Why this is needed:
 * - iOS Safari and PWA mode don't resize the viewport when the keyboard opens
 * - The keyboard overlays content instead of pushing it up
 * - Bottom sheets and fixed elements at `bottom: 0` get covered by the keyboard
 *
 * Usage:
 * ```tsx
 * const keyboardOffset = useIOSKeyboardOffset();
 *
 * <SheetContent
 *   style={{
 *     transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
 *     transition: 'transform 0.1s ease-out',
 *   }}
 * >
 * ```
 *
 * @returns The pixel offset needed to push content above the keyboard (0 when keyboard is closed)
 *
 * @see docs/ios-pwa-fixes.md for more details on iOS PWA keyboard handling
 */

import { useState, useEffect } from 'react';

export function useIOSKeyboardOffset(): number {
    // eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral keyboard state
    const [keyboardOffset, setKeyboardOffset] = useState(0);

    useEffect(() => {
        // Only run in browser and when visualViewport is available
        if (typeof window === 'undefined' || !window.visualViewport) {
            return;
        }

        const viewport = window.visualViewport;

        const handleResize = () => {
            // Calculate the difference between window height and viewport height
            // This difference is the keyboard height on iOS
            const offset = window.innerHeight - viewport.height;
            setKeyboardOffset(offset > 0 ? offset : 0);
        };

        viewport.addEventListener('resize', handleResize);
        viewport.addEventListener('scroll', handleResize);

        // Initial check
        handleResize();

        return () => {
            viewport.removeEventListener('resize', handleResize);
            viewport.removeEventListener('scroll', handleResize);
        };
    }, []);

    return keyboardOffset;
}
