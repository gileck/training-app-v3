---
name: state-management-guidelines
description: when managing state in the application (client state, server state, offline support)
title: State Management Rules
guidelines:
  - "React Query for API data, Zustand for client state, useState ONLY for 4 ephemeral cases"
  - "Valid useState: text input, dialog open, in-flight submission, confirm dialog — everything else MUST use Zustand"
  - "All Zustand stores MUST use `createStore` from `@/client/stores` — direct zustand imports blocked by ESLint"
  - "NEVER update UI from server response — optimistic-only pattern: update in `onMutate`, rollback in `onError`, empty `onSuccess`/`onSettled`"
  - "Default to Zustand persisted — use `inMemoryOnly: true` only for truly transient state"
priority: 2
---
# State Management Guidelines

📚 **Full Documentation**: [docs/state-management.md](mdc:docs/state-management.md)
📚 **React Query Mutations**: [docs/react-query-mutations.md](mdc:docs/react-query-mutations.md)
📚 **Store Factory**: [docs/zustand-stores.md](mdc:docs/zustand-stores.md)

## Quick Decision

| State Type | Solution |
|------------|----------|
| API data (todos, users, etc.) | **React Query** |
| User preferences (theme, offline) | **Zustand** (`features/settings`) |
| Auth hints | **Zustand** (`features/auth`) |
| Route persistence | **Zustand** (`features/router`) |
| UI state that survives navigation | **Zustand** (in-memory or persisted) |
| Truly ephemeral UI (see below) | **useState** |

```
API data? → React Query
Otherwise → Zustand (createStore)
ONLY if truly ephemeral → useState
```

## 🚨 CRITICAL: Most UI State Should Be Persistent

**Default to Zustand for all UI state.** Only use `useState` for the narrow set of truly ephemeral cases listed below. If in doubt, use Zustand.

### ✅ useState — Truly Ephemeral (resets are expected)

These are the **only** valid `useState` cases:

- **Text input value** before submission (search box, form field)
- **Dialog/modal open** state (closing on navigate is correct)
- **In-flight submission** indicator (`isSubmitting` tied to a single button click)
- **Confirm dialog** visibility (one-shot confirmation prompts)

### ❌ useState — These Must Be Zustand

Any state the user would expect to **survive navigation** or **persist across sessions**:

- **View mode** (list/grid, compact/expanded) → Zustand persisted
- **Filter selections** (type filter, status filter, date range) → Zustand persisted
- **Sort order** (newest first, alphabetical) → Zustand persisted
- **Collapsed/expanded sections** (sidebar, accordion groups) → Zustand in-memory or persisted
- **Selected tab** in a tab bar → Zustand in-memory or persisted
- **Toggle states** (show advanced options, show completed items) → Zustand persisted
- **Pagination / scroll position** → Zustand in-memory
- **Select mode** (bulk selection active, selected items) → Zustand in-memory

**Rule of thumb:** If navigating away and back should restore the state, it belongs in Zustand — not useState.

## Zustand Store Factory (REQUIRED)

All Zustand stores MUST use `createStore` from `@/client/stores`:

```typescript
import { createStore } from '@/client/stores';

// PERSISTED store (default) - persistOptions REQUIRED
const useMyStore = createStore<MyState>({
    key: 'my-storage',
    label: 'My Store',
    creator: (set) => ({ ... }),
    persistOptions: { partialize: (state) => ({ ... }) },
});

// IN-MEMORY store (explicit opt-out) - inMemoryOnly REQUIRED
const useModalStore = createStore<ModalState>({
    key: 'modal',
    label: 'Modal',
    inMemoryOnly: true,
    creator: (set) => ({ ... }),
});
```

**Direct zustand imports are BLOCKED by ESLint** outside `src/client/stores/`.

## Zustand Imports

```typescript
import { useUser, useIsProbablyLoggedIn } from '@/client/features/auth';
import { useSettingsStore, useEffectiveOffline } from '@/client/features/settings';
import { useRouteStore } from '@/client/features/router';
```

## React Query Hooks

```typescript
// Query: always use useQueryDefaults()
export function useTodos() {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: ['todos'],
        queryFn: () => fetchTodos(),
        ...queryDefaults,
    });
}
```

## 🚨 CRITICAL: Optimistic-Only Mutation Pattern

**NEVER update UI from server responses on SUCCESS. Only rollback on ERROR.**

This prevents race conditions when user clicks faster than server responds.

```typescript
// ✅ CORRECT: Optimistic-only pattern
useMutation({
    mutationFn: async (data) => {
        const response = await apiClient.post('entity/update', data);
        if (response.data?.error) throw new Error(response.data.error);
        return response.data;
    },
    
    // UPDATE UI IMMEDIATELY - this is the source of truth
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['entity'] });
        const previous = queryClient.getQueryData(['entity']);
        queryClient.setQueryData(['entity'], (old) => ({ ...old, ...variables }));
        return { previous };
    },
    
    // ONLY on error: rollback
    onError: (_error, _variables, context) => {
        if (context?.previous) {
            queryClient.setQueryData(['entity'], context.previous);
        }
    },
    
    // onSuccess: EMPTY - never update from server response
    // onSettled: EMPTY - never invalidateQueries (causes race conditions)
});
```

```typescript
// ❌ WRONG: These cause race conditions!
onSuccess: (data) => {
    queryClient.setQueryData(['entity'], data); // Updates from stale server response
},
onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['entity'] }); // Triggers refetch, overwrites optimistic
},
```

📚 **Full Documentation**: [docs/offline-pwa-support.md](mdc:docs/offline-pwa-support.md)

## Config Defaults

All TTL/cache values in `src/client/config/defaults.ts`:

```typescript
import { TIME, STORE_DEFAULTS, QUERY_DEFAULTS } from '@/client/config';
```

## New Store Checklist

**Store Location:**
- **Cross-route state** → `src/client/features/{name}/store.ts`
- **Route-specific state** (only used by one route) → `src/client/routes/{RouteName}/store.ts`

**Steps:**
1. Create store file using `createStore`
2. Choose: `persistOptions` (persisted) OR `inMemoryOnly: true` (in-memory)
3. For feature stores: Create `index.ts` and export from `src/client/features/index.ts`
4. For route stores: Import directly within the route folder
5. For TTL validation: use `createTTLValidator(STORE_DEFAULTS.TTL)`

**Rule:** If the store is only imported by files within a single route, keep it in that route folder.

## Registry Utilities

```typescript
import { 
    getAllStores, 
    getTotalCacheSize, 
    clearAllPersistedStores 
} from '@/client/stores';
```
