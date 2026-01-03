# Zustand Store Guidelines

This document describes the Zustand store factory pattern used in this application. All stores must be created using `createStore` from `@/client/stores`.

## Quick Start

```typescript
import { createStore } from '@/client/stores';

// PERSISTED store (default) - persistOptions REQUIRED
const useMyStore = createStore<MyState>({
  key: 'my-storage',
  label: 'My Store',
  creator: (set) => ({
    value: 'default',
    setValue: (v) => set({ value: v }),
  }),
  persistOptions: {
    partialize: (state) => ({ value: state.value }),
  },
});

// IN-MEMORY store (explicit opt-out) - inMemoryOnly REQUIRED
const useSessionStore = createStore<SessionState>({
  key: 'session',
  label: 'Session',
  inMemoryOnly: true,
  creator: (set) => ({
    data: null,
    setData: (d) => set({ data: d }),
  }),
});
```

## Core Philosophy

**Persistence is the default.** This application follows an offline-first philosophy where user data should survive app restarts, browser refreshes, and iOS PWA kills.

- **Persisted stores** save to localStorage automatically
- **In-memory stores** require explicit opt-out via `inMemoryOnly: true`

## API Reference

### createStore(config)

Creates a Zustand store with automatic registration and optional persistence.

#### Config for Persisted Stores (Default)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | `string` | Yes | Unique storage key (used for localStorage) |
| `label` | `string` | Yes | Human-readable label for display |
| `creator` | `StateCreator<T>` | Yes | Zustand state creator function |
| `persistOptions` | `PersistOptions` | Yes | Persistence configuration |
| `withSelector` | `boolean` | No | Enable `subscribeWithSelector` (default: `true`) |

#### Config for In-Memory Stores

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | `string` | Yes | Unique identifier for registry |
| `label` | `string` | Yes | Human-readable label |
| `creator` | `StateCreator<T>` | Yes | Zustand state creator function |
| `inMemoryOnly` | `true` | Yes | Must be `true` to opt-out of persistence |
| `withSelector` | `boolean` | No | Enable `subscribeWithSelector` (default: `false`) |

### persistOptions

Common `persistOptions` configurations:

```typescript
// Persist all state (empty object)
persistOptions: {}

// Persist specific fields
persistOptions: {
  partialize: (state) => ({ 
    settings: state.settings,
    // Omit runtime-only fields
  }),
}

// With TTL validation on rehydration
persistOptions: {
  partialize: (state) => ({
    data: state.data,
    timestamp: state.timestamp,
  }),
  onRehydrateStorage: () => (state) => {
    if (state && !isValid(state.timestamp)) {
      state.data = null;
      state.timestamp = null;
    }
  },
}
```

## Registry Utilities

All stores are automatically registered to a central registry, enabling cache management.

```typescript
import {
  getAllStores,
  getPersistedStores,
  getInMemoryStores,
  getTotalCacheSize,
  getCacheSizeBreakdown,
  clearAllPersistedStores,
  clearPersistedStore,
  printAllStores,
} from '@/client/stores';
```

| Function | Returns | Description |
|----------|---------|-------------|
| `getAllStores()` | `StoreInfo[]` | All registered stores |
| `getPersistedStores()` | `StoreInfo[]` | Only localStorage stores |
| `getInMemoryStores()` | `StoreInfo[]` | Only in-memory stores |
| `getTotalCacheSize()` | `CacheSize` | Combined size `{ bytes, formatted }` |
| `getCacheSizeBreakdown()` | `CacheSizeInfo[]` | Size per store with labels |
| `clearAllPersistedStores()` | `void` | Clear all localStorage stores |
| `clearPersistedStore(key)` | `boolean` | Clear specific store |
| `printAllStores()` | `void` | Debug output to console |

## Hydration Timing

### The Problem

Zustand's persist middleware provides a `hasHydrated()` method that returns `true` when localStorage data has been loaded. However, **`hasHydrated() = true` does NOT mean React hooks will return the hydrated values**.

There's a timing gap:

```
Step 1: Persist middleware reads localStorage
Step 2: Persist sets hasHydrated() = true     ← Flag is set
Step 3: Persist calls setState() with data    ← Store updates
Step 4: React propagates to selector hooks    ← Hooks update (async!)
```

If you render components after Step 2 but before Step 4, hooks will return **default values**, not the hydrated data.

### The Solution

Use `useAllPersistedStoresHydrated()` from `@/client/stores`. This hook waits for:

1. All persisted stores to report `hasHydrated() = true`
2. One animation frame (`requestAnimationFrame`) for React to propagate values to hooks

```typescript
import { useAllPersistedStoresHydrated } from '@/client/stores';

function MyComponent() {
  const isHydrated = useAllPersistedStoresHydrated();
  
  if (!isHydrated) {
    return null; // Or a loading spinner
  }
  
  // Safe to read from stores - values are guaranteed to be hydrated
  return <App />;
}
```

### BootGate Pattern

The app uses a `BootGate` component in `_app.tsx` to block rendering until hydration is complete:

```tsx
function BootGate({ children }: { children: ReactNode }) {
  const isHydrated = useAllPersistedStoresHydrated();
  
  if (!isHydrated) return null;
  return <>{children}</>;
}

// Usage in _app.tsx
<QueryProvider>
  <BootGate>
    <AppThemeProvider>
      <RouterProvider routes={routes}>
        {RouteComponent => (
          <AuthWrapper>
            <Layout><RouteComponent /></Layout>
          </AuthWrapper>
        )}
      </RouterProvider>
    </AppThemeProvider>
  </BootGate>
</QueryProvider>
```

This ensures all child components reading from stores get the **actual hydrated values**, not defaults.

### Why Not Just Check `hasHydrated()`?

```typescript
// ❌ DON'T do this - race condition!
const store = useMyStore as any;
if (store.persist.hasHydrated()) {
  // Store data is loaded, but React hooks might still return defaults
}

// ✅ DO use the hook
const isHydrated = useAllPersistedStoresHydrated();
if (isHydrated) {
  // Safe - React has propagated values to all hooks
}
```

## When to Use Each Mode

### Use Persisted Store When:

- User preferences/settings
- Authentication hints (login state)
- Navigation state (last route)
- Draft content the user might want to recover
- Cached data that should survive restarts

### Use In-Memory Store When:

- Ephemeral UI state (modal open/closed)
- Session-only logs/debug data
- Temporary form state
- Data that should reset on refresh

## Examples

### Settings Store (Persisted)

```typescript
import { createStore } from '@/client/stores';

interface SettingsState {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useSettingsStore = createStore<SettingsState>({
  key: 'settings-storage',
  label: 'Settings',
  creator: (set) => ({
    theme: 'light',
    setTheme: (theme) => set({ theme }),
  }),
  persistOptions: {
    partialize: (state) => ({ theme: state.theme }),
  },
});
```

### Auth Store (Persisted with TTL)

```typescript
import { createStore } from '@/client/stores';
import { createTTLValidator, STORE_DEFAULTS } from '@/client/config';

const isValid = createTTLValidator(STORE_DEFAULTS.TTL_AUTH_HINT);

interface AuthState {
  token: string | null;
  timestamp: number | null;
  setToken: (token: string) => void;
  clearToken: () => void;
}

export const useAuthStore = createStore<AuthState>({
  key: 'auth-storage',
  label: 'Auth',
  creator: (set) => ({
    token: null,
    timestamp: null,
    setToken: (token) => set({ token, timestamp: Date.now() }),
    clearToken: () => set({ token: null, timestamp: null }),
  }),
  persistOptions: {
    partialize: (state) => ({
      token: state.token,
      timestamp: state.timestamp,
    }),
    onRehydrateStorage: () => (state) => {
      if (state && !isValid(state.timestamp)) {
        state.token = null;
        state.timestamp = null;
      }
    },
  },
});
```

### Modal Store (In-Memory)

```typescript
import { createStore } from '@/client/stores';

interface ModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useModalStore = createStore<ModalState>({
  key: 'modal',
  label: 'Modal',
  inMemoryOnly: true,
  creator: (set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }),
});
```

## Using subscribeWithSelector

All persisted stores have `subscribeWithSelector` enabled by default. This allows subscribing to specific state slices:

```typescript
// Subscribe to changes in a specific field
useSettingsStore.subscribe(
  (state) => state.theme,
  (theme) => {
    console.log('Theme changed to:', theme);
  }
);
```

For in-memory stores, enable it explicitly:

```typescript
createStore<State>({
  key: 'my-store',
  label: 'My Store',
  inMemoryOnly: true,
  withSelector: true,  // Enable subscribeWithSelector
  creator: (set) => ({ ... }),
});
```

## ESLint Enforcement

Direct imports from `zustand` are blocked by ESLint outside of `src/client/stores/`:

```typescript
// ERROR: Use createStore from @/client/stores
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// CORRECT
import { createStore } from '@/client/stores';
```

## Migration Guide

To migrate an existing store:

### Before

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useMyStore = create<MyState>()(
  persist(
    (set) => ({
      value: 'default',
      setValue: (v) => set({ value: v }),
    }),
    {
      name: 'my-storage',
    }
  )
);
```

### After

```typescript
import { createStore } from '@/client/stores';

export const useMyStore = createStore<MyState>({
  key: 'my-storage',
  label: 'My Store',
  creator: (set) => ({
    value: 'default',
    setValue: (v) => set({ value: v }),
  }),
  persistOptions: {},
});
```

## Troubleshooting

### Store not appearing in registry

Ensure the store module is imported somewhere in your app before calling registry utilities.

### TypeScript errors with persistOptions

Make sure you're using the correct config type:
- Persisted stores MUST have `persistOptions`
- In-memory stores MUST have `inMemoryOnly: true` and MUST NOT have `persistOptions`

### subscribeWithSelector not working

For in-memory stores, explicitly enable it with `withSelector: true`.

### Store values are defaults even though localStorage has data

This is the hydration timing issue. React hooks don't immediately reflect the hydrated store values. Ensure your component renders **after** `useAllPersistedStoresHydrated()` returns `true`. See [Hydration Timing](#hydration-timing) above.

### Component renders with wrong values on first load

Make sure your component is inside `BootGate` (or uses `useAllPersistedStoresHydrated()` directly). Components that render before hydration completes will see default values.

### 🚨 Infinite Loop: "The result of getSnapshot should be cached"

**Error message:**
```
The result of getSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded.
```

**Cause:** Zustand selectors that return new array/object references on every call cause infinite re-render loops with React's `useSyncExternalStore`.

```typescript
// ❌ BAD - Creates new [] on every call, causing infinite loop
export function useItems(id: string | null) {
    return useMyStore((s) => id ? s.items[id] ?? [] : []);
}

// ❌ BAD - Creates new {} on every call
export function useData(id: string | null) {
    return useMyStore((s) => id ? s.data[id] ?? {} : {});
}
```

**Fix:** Use stable constant references for fallback values:

```typescript
// ✅ GOOD - Stable references prevent infinite loops
const EMPTY_ARRAY: Item[] = [];
const EMPTY_OBJECT: Record<string, Data> = {};

export function useItems(id: string | null) {
    return useMyStore((s) => {
        if (!id) return EMPTY_ARRAY;
        return s.items[id] ?? EMPTY_ARRAY;
    });
}

export function useData(id: string | null) {
    return useMyStore((s) => {
        if (!id) return EMPTY_OBJECT;
        return s.data[id] ?? EMPTY_OBJECT;
    });
}
```

**Why this happens:** Every time the selector runs and returns `[]` or `{}`, it creates a **new reference**. React sees this as "state changed" and re-renders, which calls the selector again, creating another new reference, ad infinitum.

**Rule:** Always use module-level constants for fallback values in Zustand selectors.
