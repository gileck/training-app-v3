# iOS PWA Known Issues and Fixes

This document covers iOS-specific issues encountered in PWA (Progressive Web App) mode and their solutions.

## Overview

iOS Safari and iOS PWA (home screen apps) have unique behaviors that differ from desktop browsers and Android. These differences often require specific handling.

---

## Virtual Keyboard Issues

### Problem: Fixed Elements Hidden Behind Keyboard

**Symptoms:**
- Bottom sheets, modals, or fixed-position elements are hidden behind the iOS virtual keyboard
- Users cannot see input fields when typing
- The viewport doesn't resize when keyboard opens

**Why This Happens:**

On iOS PWA, the virtual keyboard **overlays** the viewport instead of resizing it. This means:
- `window.innerHeight` remains unchanged when keyboard opens
- Elements with `position: fixed; bottom: 0` stay at the original bottom
- The keyboard covers these elements

**Solution: Use visualViewport API**

The `visualViewport` API provides the actual visible area, accounting for the keyboard:

```typescript
function useIOSKeyboardOffset() {
    const [keyboardOffset, setKeyboardOffset] = useState(0);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.visualViewport) {
            return;
        }

        const viewport = window.visualViewport;

        const handleResize = () => {
            // Keyboard height = difference between window and viewport
            const offset = window.innerHeight - viewport.height;
            setKeyboardOffset(offset > 0 ? offset : 0);
        };

        viewport.addEventListener('resize', handleResize);
        viewport.addEventListener('scroll', handleResize);
        handleResize();

        return () => {
            viewport.removeEventListener('resize', handleResize);
            viewport.removeEventListener('scroll', handleResize);
        };
    }, []);

    return keyboardOffset;
}
```

**Apply the offset:**

```tsx
<SheetContent
    style={{
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        transition: 'transform 0.1s ease-out',
    }}
>
    {/* content */}
</SheetContent>
```

**Implementation:** See `src/client/routes/Profile/components/EditableField.tsx`

---

## Best Practices

### DO:

1. **Use `visualViewport` API** for keyboard detection instead of resize events
2. **Use `transform: translateY`** to move elements above keyboard (performant, doesn't trigger layout)
3. **Add smooth transitions** (0.1s) to match iOS keyboard animation
4. **Test on actual iOS devices** - simulators don't always reproduce PWA behavior
5. **Listen to both `resize` and `scroll`** events on visualViewport

### DON'T:

1. **Don't rely on `window.innerHeight` changing** - it doesn't on iOS PWA when keyboard opens
2. **Don't use `position: fixed; bottom: 0`** alone for elements that need to stay above keyboard
3. **Don't use CSS `env(keyboard-inset-bottom)`** - not widely supported yet
4. **Don't use `100vh`** for full-height layouts - it includes the area behind keyboard
5. **Don't assume Android behavior** - Android Chrome does resize the viewport

---

## Testing iOS PWA

### On Physical Device:
1. Open Safari and navigate to your app
2. Tap Share button → "Add to Home Screen"
3. Open the app from home screen
4. Test all input interactions

### Common Test Cases:
- [ ] Open bottom sheet with input → keyboard should not hide input
- [ ] Scroll while typing → content should remain visible
- [ ] Dismiss keyboard → UI should return to normal position
- [ ] Rotate device with keyboard open → layout should adjust

---

## Related Files

- `src/client/routes/Profile/components/EditableField.tsx` - iOS keyboard fix implementation
- `src/client/components/ui/sheet.tsx` - Base sheet component

---

## Resources

- [MDN: Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- [WebKit Bug: viewport units](https://bugs.webkit.org/show_bug.cgi?id=141832)
