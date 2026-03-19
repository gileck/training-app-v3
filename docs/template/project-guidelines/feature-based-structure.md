---
name: feature-based-structure
description: Feature-based folder structure for client code. Use this when organizing client-side code.
title: Feature-Based Structure
guidelines:
  - "All feature code lives together in `src/client/features/{name}/` (stores, hooks, components, types)"
  - "`features/` for cross-route features, `routes/` for route-specific code, `components/` for shared UI primitives only"
  - "All Zustand stores MUST use `createStore` factory from `@/client/stores`"
  - "Import from feature index (`@/client/features/auth`), NOT internal files (`auth/store`)"
  - "Feature-specific components go in `features/`, NOT `components/`"
priority: 3
---

# Feature-Based Structure

This project uses **feature-based organization** for client code. All code related to a feature lives together.

## Directory Structure

```
src/client/
├── features/           # Feature modules (stores, hooks, components, types)
│   ├── auth/           # Authentication feature
│   │   ├── store.ts    # Zustand store (uses createStore)
│   │   ├── hooks.ts    # React Query hooks + custom hooks
│   │   ├── types.ts    # Feature-specific types
│   │   ├── AuthWrapper.tsx
│   │   ├── LoginForm.tsx
│   │   └── index.ts    # Public API exports
│   ├── settings/       # Settings feature
│   │   ├── store.ts
│   │   ├── types.ts
│   │   └── index.ts
│   └── router/         # Route persistence
│       ├── store.ts
│       └── index.ts
├── stores/             # Store factory & registry (infrastructure)
│   ├── createStore.ts  # Store factory (required for all stores)
│   ├── registry.ts     # Cache management utilities
│   ├── types.ts        # Store config interfaces
│   └── index.ts        # Public exports
├── routes/             # Route/page components (feature-specific to that route)
│   ├── Todos/
│   │   ├── Todos.tsx   # Main component
│   │   ├── hooks.ts    # Route-specific React Query hooks
│   │   └── index.ts
│   ├── Settings/
│   └── Profile/
├── components/         # Shared UI components ONLY
│   ├── ui/             # shadcn components
│   └── layout/         # Layout components (TopNavBar, Sidebar)
├── query/              # React Query infrastructure
│   ├── queryClient.ts
│   ├── persister.ts
│   └── defaults.ts
└── utils/              # Shared utilities
```

## Rules

### 1. Features contain ALL feature-related code

✅ **DO**: Put store, hooks, components, and types together

```
features/auth/
├── store.ts          # useAuthStore (uses createStore)
├── hooks.ts          # useLogin, useLogout, useAuthValidation
├── types.ts          # UserPublicHint, LoginFormState
├── AuthWrapper.tsx   # Component
├── LoginForm.tsx     # Component
└── index.ts          # exports
```

❌ **DON'T**: Scatter feature code across folders

```
stores/authStore.ts
hooks/useAuthValidation.ts
hooks/mutations/useAuthMutations.ts
components/auth/AuthWrapper.tsx
```

### 2. All stores MUST use createStore factory

✅ **DO**: Use the factory from `@/client/stores`

```typescript
import { createStore } from '@/client/stores';

export const useMyStore = createStore<MyState>({
    key: 'my-storage',
    label: 'My Store',
    creator: (set) => ({ ... }),
    persistOptions: { ... },  // For persisted stores
    // OR
    inMemoryOnly: true,       // For in-memory stores
});
```

❌ **DON'T**: Import zustand directly (blocked by ESLint)

```typescript
import { create } from 'zustand';  // ERROR!
```

### 3. Routes folder is for route-specific code

Routes contain only code specific to that route/page:

```typescript
// routes/Todos/hooks.ts - Only used by Todos route
export function useTodos() { ... }
export function useCreateTodo() { ... }
```

If a hook/component is used by multiple routes → move to `features/`

### 4. Features export via index.ts

Every feature has a public API:

```typescript
// features/auth/index.ts
export { useAuthStore, useIsAuthenticated } from './store';
export { useLogin, useLogout } from './hooks';
export { AuthWrapper } from './AuthWrapper';
export type { UserPublicHint } from './types';
```

### 5. Import from feature index, not internal files

✅ **DO**:
```typescript
import { useAuthStore, useLogin } from '@/client/features/auth';
import { createStore } from '@/client/stores';
```

❌ **DON'T**:
```typescript
import { useAuthStore } from '@/client/features/auth/store';
import { create } from 'zustand';
```

### 6. Shared components go in `components/`

Only truly shared, reusable UI components:
- `components/ui/` - shadcn primitives (Button, Card, Input)
- `components/layout/` - App shell (TopNavBar, Layout)

Feature-specific components live in the feature folder.

## Creating a New Feature with Store

1. Create feature folder: `src/client/features/{name}/`
2. Create store with `createStore`:
   - `store.ts` - Use `persistOptions` for persisted OR `inMemoryOnly: true` for in-memory
3. Create other files:
   - `hooks.ts` - React Query hooks
   - `types.ts` - TypeScript types
   - Components as needed
   - `index.ts` - Public exports
4. Export from `features/index.ts`

### Example: Adding a "notifications" feature

```
features/notifications/
├── store.ts          # useNotificationStore (uses createStore)
├── hooks.ts          # useNotifications, useMarkAsRead
├── types.ts          # Notification, NotificationSettings
├── NotificationBell.tsx
├── NotificationList.tsx
└── index.ts
```

```typescript
// features/notifications/store.ts
import { createStore } from '@/client/stores';
import { STORE_DEFAULTS, createTTLValidator } from '@/client/config';

const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

interface NotificationState {
    unreadCount: number;
    lastCheckedAt: number | null;
    setUnreadCount: (count: number) => void;
}

export const useNotificationStore = createStore<NotificationState>({
    key: 'notification-storage',
    label: 'Notifications',
    creator: (set) => ({
        unreadCount: 0,
        lastCheckedAt: null,
        setUnreadCount: (count) => set({ unreadCount: count, lastCheckedAt: Date.now() }),
    }),
    persistOptions: {
        partialize: (state) => ({ unreadCount: state.unreadCount, lastCheckedAt: state.lastCheckedAt }),
        onRehydrateStorage: () => (state) => {
            if (state && !isValid(state.lastCheckedAt)) {
                state.unreadCount = 0;
            }
        },
    },
});
```

```typescript
// features/notifications/index.ts
export { useNotificationStore } from './store';
export { useNotifications, useMarkAsRead } from './hooks';
export { NotificationBell } from './NotificationBell';
export type { Notification } from './types';
```

## Key Documentation

- **Store Factory**: [docs/zustand-stores.md](mdc:docs/zustand-stores.md)
- **State Management**: [docs/state-management.md](mdc:docs/state-management.md)
- **Architecture**: [docs/architecture.md](mdc:docs/architecture.md)
