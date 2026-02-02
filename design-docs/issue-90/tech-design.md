# Technical Design: Add Welcome Toast on Home Page

**Size: S** | **Complexity: Low**

## Overview

Add a one-time welcome toast notification that displays when a user first visits the home page. The toast will show an informational message for 3 seconds using the existing toast system, with the "already shown" flag stored in localStorage via a Zustand store.

## Files to Create

- **`src/client/features/welcome-toast/store.ts`**
  - Zustand store to track if welcome toast has been shown
  - Persisted to localStorage with key `welcome-toast-storage`
  - Contains `hasShownWelcomeToast` boolean flag
  - Provides `setWelcomeToastShown()` action

- **`src/client/features/welcome-toast/index.ts`**
  - Exports store and hooks for external use

## Files to Modify

- **`src/client/routes/Home/Home.tsx`**
  - Import `toast` from `@/client/components/ui/toast`
  - Import `useWelcomeToastStore` from new feature
  - Add `useEffect` hook to show toast on first visit
  - Check `hasShownWelcomeToast` flag before displaying
  - Call `toast.info()` with 3000ms duration
  - Mark toast as shown after display

## Implementation Details

**Store Structure:**
```typescript
interface WelcomeToastState {
  hasShownWelcomeToast: boolean;
  setWelcomeToastShown: () => void;
}
```

**Toast Configuration:**
- Type: `info` (blue accent with info icon)
- Message: "Welcome! Explore the app to get started."
- Duration: 3000ms (3 seconds)
- Position: Bottom of screen (handled by existing ToastContainer)

**Logic Flow:**
1. Home component mounts
2. Check `hasShownWelcomeToast` from store
3. If `false`, display toast with `toast.info()`
4. Immediately set `hasShownWelcomeToast = true`
5. On subsequent visits, skip toast display

## Implementation Plan

1. Create welcome toast feature directory at `src/client/features/welcome-toast/`
2. Create store file at `src/client/features/welcome-toast/store.ts` with Zustand store using `createStore` factory
3. Create index file at `src/client/features/welcome-toast/index.ts` to export store
4. Modify `src/client/routes/Home/Home.tsx` to import toast and welcome toast store
5. Add `useEffect` hook in Home component to check flag and show toast on first visit
6. Set flag to true after showing toast
7. Test by clearing localStorage and visiting home page