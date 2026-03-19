---
title: State Management
description: Dual-store architecture for PWA with offline support. Use this when managing application state.
summary: React Query for server/API data, Zustand for all client state (default persistent), useState ONLY for truly ephemeral UI (text input, dialog open, in-flight submission, confirm dialog). All Zustand stores MUST use `createStore` factory from `@/client/stores`.
guidelines:
  - "React Query for server data, Zustand for client state, useState for 4 ephemeral cases only"
  - "Valid useState: text input, dialog open, in-flight submission, confirm dialog"
  - Everything else MUST use Zustand
  - "All Zustand stores MUST use `createStore` factory"
  - "NEVER update UI from server response — optimistic-only pattern"
priority: 2
related_docs:
  - react-query-mutations.md
  - zustand-stores.md
related_rules:
  - state-management-guidelines
---

# State Management Deep Dive

This document provides a comprehensive guide to state management in the application, covering Zustand stores, React Query, offline support, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [State Decision Matrix](#state-decision-matrix)
3. [Zustand (Client State)](#zustand-client-state)
4. [React Query (Server State)](#react-query-server-state)
5. [Centralized Configuration](#centralized-configuration)
6. [Offline Mode](#offline-mode)
7. [PWA Instant Boot](#pwa-instant-boot)
8. [Creating New Stores](#creating-new-stores)
9. [Best Practices](#best-practices)

---

## Architecture Overview

The application uses a **dual-store architecture** optimized for PWA with offline support:

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Components                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────┐          │
│  │    Zustand Stores    │    │    React Query       │          │
│  │    (Client State)    │    │    (Server State)    │          │
│  │                      │    │                      │          │
│  │  • Auth hints        │    │  • API responses     │          │
│  │  • User settings     │    │  • Cached data       │          │
│  │  • Route persistence │    │  • Loading states    │          │
│  │  • UI preferences    │    │  • Error states      │          │
│  └──────────┬───────────┘    └──────────┬───────────┘          │
│             │                           │                       │
│             ▼                           ▼                       │
│  ┌──────────────────────────────────────────────────┐          │
│  │              localStorage                         │          │
│  │   (fast, reliable, ~5MB limit)                   │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Two Solutions?

| Aspect | Zustand | React Query |
|--------|---------|-------------|
| **Data Source** | Client-generated | Server API |
| **Persistence** | localStorage (rehydrate on boot) | localStorage (restore) |
| **Boot Time** | Fast local rehydrate | ~1-5ms |
| **Use Case** | Settings, hints, UI state | API data, caching |

> **Note**: Both Zustand and React Query now use localStorage for persistence. IndexedDB was removed due to unreliable performance on some systems (5+ second reads). See [Caching Strategy](./caching-strategy.md) for details.

---

## State Decision Matrix

Use this flowchart to decide which solution to use:

```
┌─────────────────────────────────────────┐
│     Does this state come from an API?   │
└─────────────────────┬───────────────────┘
                      │
          ┌───────────┴───────────┐
          │ YES                   │ NO
          ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────────┐
│   Use React Query   │  │ Should it persist across        │
│                     │  │ app restarts?                   │
│   • useQuery        │  └─────────────────┬───────────────┘
│   • useMutation     │            ┌───────┴───────┐
│   • queryClient     │            │ YES           │ NO
└─────────────────────┘            ▼               ▼
                        ┌─────────────────┐ ┌─────────────────┐
                        │  Use Zustand    │ │  Use useState   │
                        │  (createStore)  │ │                 │
                        │                 │ │  • Modal open   │
                        │  • Stores in    │ │  • Form inputs  │
                        │    features/    │ │  • Loading UI   │
                        │  • Persisted    │ │                 │
                        └─────────────────┘ └─────────────────┘
```

### Quick Reference Table

| State Type | Solution | Persistence | Examples |
|------------|----------|-------------|----------|
| API data | React Query | localStorage | Todos, user profile, any fetched data |
| User preferences | Zustand | localStorage | Theme, offline mode, AI model |
| Auth hints | Zustand | localStorage | `isProbablyLoggedIn`, `userPublicHint` |
| Route persistence | Zustand | localStorage | Last visited route |
| Form inputs | useState | None | Text inputs, checkboxes |
| Modal/dialog state | useState | None | `isOpen`, `selectedItem` |
| Loading indicators | useState | None | `isSubmitting` |

---

## Zustand (Client State)

### Store Factory: `createStore`

All Zustand stores **must** be created using the `createStore` factory from `@/client/stores`:

```typescript
import { createStore } from '@/client/stores';

// PERSISTED store (default) - persistOptions REQUIRED
const useSettingsStore = createStore<SettingsState>({
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

// IN-MEMORY store (explicit opt-out) - inMemoryOnly REQUIRED
const useModalStore = createStore<ModalState>({
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

### Why createStore?

| Feature | Direct Zustand | createStore Factory |
|---------|----------------|---------------------|
| **Persistence** | Manual setup | Default (opt-out explicit) |
| **Registry** | None | Auto-registered |
| **subscribeWithSelector** | Manual | Auto-applied |
| **Cache management** | Manual | Registry utilities |
| **ESLint enforcement** | None | Blocked outside stores/ |

📚 **Full Documentation**: [zustand-stores.md](./zustand-stores.md)

### Philosophy: Many Small Stores

Zustand recommends **separate, focused stores** over a single large store:

| Aspect | Single Store ❌ | Separate Stores ✅ |
|--------|----------------|-------------------|
| **Re-renders** | Any change triggers all selectors | Only affected components re-render |
| **Persistence** | One TTL for everything | Independent TTLs per feature |
| **Feature isolation** | All features coupled | Each feature owns its state |
| **Testing** | Hard to test slices | Easy to test in isolation |
| **Adding features** | Modify central file | Create new `features/x/store.ts` |

### Current Stores

```
src/client/features/
├── auth/store.ts           # Auth state + instant-boot hints (persisted)
├── settings/store.ts       # User preferences + offline mode (persisted)
├── router/store.ts         # Route persistence for PWA (persisted)
├── session-logs/store.ts   # Debug logs (in-memory)
├── bug-report/store.ts     # Bug report dialog (in-memory)
└── offline-sync/store.ts   # Batch sync alert (in-memory)

src/client/components/ui/
└── toast.tsx               # Toast notifications (in-memory)
```

### Using Zustand Stores

#### Auth Store

```typescript
import { useAuthStore, useUser, useIsProbablyLoggedIn } from '@/client/features/auth';

// Selector hooks (recommended)
const user = useUser();                           // Full validated user
const isProbablyLoggedIn = useIsProbablyLoggedIn(); // Persisted hint for instant boot

// Direct store access
const isValidated = useAuthStore((state) => state.isValidated);
const userHint = useAuthStore((state) => state.userPublicHint);

// Actions (typically called from mutation hooks)
const setValidatedUser = useAuthStore((state) => state.setValidatedUser);
const clearAuth = useAuthStore((state) => state.clearAuth);
```

#### Settings Store

```typescript
import { useSettingsStore, useEffectiveOffline } from '@/client/features/settings';

// Read individual settings (fine-grained subscriptions)
const theme = useSettingsStore((state) => state.settings.theme);
const offlineMode = useSettingsStore((state) => state.settings.offlineMode);

// Read all settings
const settings = useSettingsStore((state) => state.settings);

// Update settings
const updateSettings = useSettingsStore((state) => state.updateSettings);
updateSettings({ theme: 'dark' });

// Effective offline (user toggle OR device offline)
const isOffline = useEffectiveOffline();
```

#### Route Store

```typescript
import { useRouteStore, useLastRoute } from '@/client/features/router';

// Get last route for restoration
const lastRoute = useLastRoute(); // Returns null if expired

// Save route (handled automatically by router)
const setLastRoute = useRouteStore((state) => state.setLastRoute);
setLastRoute('/todos');
```

### Store Registry Utilities

All stores are auto-registered, enabling cache management:

```typescript
import {
    getAllStores,
    getPersistedStores,
    getTotalCacheSize,
    getCacheSizeBreakdown,
    clearAllPersistedStores,
    printAllStores,
} from '@/client/stores';

// Get all registered stores
const stores = getAllStores();

// Get total localStorage usage
const { bytes, formatted } = getTotalCacheSize();

// Clear all persisted data
clearAllPersistedStores();

// Debug output
printAllStores();
```

---

## React Query (Server State)

### Why React Query?

React Query handles all the complexity of server state:

- **Caching**: Automatic with configurable stale times
- **Deduplication**: Multiple components share one request
- **Background refresh**: Updates stale data automatically
- **Optimistic updates**: UI updates before server confirms **(REQUIRED in this app)**
- **Persistence**: localStorage for offline support

### Query Hook Pattern

```typescript
// src/client/routes/MyFeature/hooks.ts
import { useQuery } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query';
import { getItems } from '@/apis/items/client';

// Export query keys for cache invalidation
export const itemsQueryKey = ['items'] as const;
export const itemQueryKey = (id: string) => ['items', id] as const;

export function useItems(options?: { enabled?: boolean }) {
    const queryDefaults = useQueryDefaults(); // Centralized config
    
    return useQuery({
        queryKey: itemsQueryKey,
        queryFn: async () => {
            const response = await getItems({});
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        ...queryDefaults, // Apply centralized defaults
    });
}
```

### Mutation Hook Pattern (Optimistic Updates Required)

**Optimistic updates are REQUIRED for all mutations** to ensure:
- **Instant feedback**: UI responds immediately without waiting for network
- **Offline support**: UI works when network is unavailable
- **Native-like UX**: App feels as responsive as native mobile apps

📚 **Detailed Guidelines**: [react-query-mutations.md](./react-query-mutations.md)

#### 🚨 CRITICAL: Optimistic-only mutation pattern

**Never update UI from the server response on success.** The UI/cache is updated **only** in `onMutate`, and **only** rolled back in `onError`.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateItem } from '@/apis/items/client';

export function useUpdateItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: UpdateItemRequest) => {
            const response = await updateItem(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data?.item;
        },
        
        // STEP 1: OPTIMISTIC UPDATE - Update UI immediately (before server responds)
        onMutate: async (variables) => {
            // Cancel in-flight queries to prevent race conditions
            await queryClient.cancelQueries({ queryKey: itemsQueryKey });
            
            // Snapshot for rollback
            const previousItems = queryClient.getQueryData(itemsQueryKey);
            
            // Optimistically update cache - UI updates NOW
            queryClient.setQueryData(itemsQueryKey, (old) => ({
                items: old.items.map((item) =>
                    item._id === variables.itemId
                        ? { ...item, ...variables }
                        : item
                ),
            }));
            
            return { previousItems };
        },
        
        // STEP 2: ROLLBACK - Restore on error (online mode only)
        onError: (_err, _variables, context) => {
            if (context?.previousItems) {
                queryClient.setQueryData(itemsQueryKey, context.previousItems);
            }
            toast.error('Failed to update item');
        },

        // STEP 3: NOTHING - never update from server response (prevents races)
        onSuccess: () => {},

        // STEP 4: NOTHING - never invalidate from mutations (prevents overwriting optimistic state)
        onSettled: () => {},
    });
}
```

#### ⚠️ Critical: Do NOT Update UI from Server Response

**Never use server response data to update the UI** in `onSuccess`. This causes race conditions:

```typescript
// ❌ WRONG: Causes race condition bugs
onSuccess: (data) => {
    if (data && data._id) {
        // This overwrites optimistic update with potentially stale server data!
        queryClient.setQueryData(itemQueryKey(data._id), { item: data });
    }
    queryClient.invalidateQueries({ queryKey: itemsQueryKey });
},

// ✅ CORRECT: Do nothing (optimistic-only)
onSuccess: () => {
},
```

**Race condition example:**
1. User updates item to "A" → optimistic update shows "A"
2. User quickly updates to "B" → optimistic update shows "B"  
3. First server response returns "A" → **UI incorrectly shows "A"**
4. Second response returns "B" → UI finally shows "B"

By not applying server responses (and not invalidating from mutations), the UI remains consistent with user intent.

#### Creates vs edits/deletes (guideline)

**1) Edits / deletes → optimistic-only**

- Update cache immediately in `onMutate`
- Rollback only on `onError`
- `onSuccess` and `onSettled` should be empty (no server-driven updates, no invalidations)

**Examples (safe optimistic-only):**

- Edit: toggle a todo `completed`, rename a todo title, update a setting-like entity
- Delete: delete a todo (rollback if forbidden), remove a saved item

**2) Creates**

**2.1 Optimistic-only create ONLY if all are true:**

- The client can **safely generate a stable ID** (strong random IDs like UUID/ULID/nanoid are fine)
- The server accepts and **persists that ID** as the entity’s public ID (idempotent retries: same `id` must not create duplicates)
- The client can render the new entity immediately without needing important server-derived fields

**Examples (optimistic-only create):**

- Create todo: client generates `id`, immediately inserts `{ id, title, completed:false }`, server stores by `id`
- Create simple note/comment where server mainly persists the payload and validates permissions

**2.2 Otherwise: do NOT do optimistic create**

- Show loader / disable submit during create
- On success: insert the returned entity (or refetch) and render it

**Examples (no optimistic create):**

- Create order/invoice/booking where server computes totals, availability, discounts, permissions, numbering
- Create entity with uniqueness you can’t safely enforce client-side (because the client lacks the full dataset)

#### Pattern: optimistic create + async enrichment (partial loading)

When the entity itself is safe to create optimistically (client-generated ID), but a small server-side enrichment is needed, use **optimistic create for the base entity**, and **loading state only for the enriched field(s)**.

**Example: user comment + AI tags**

1. User writes comment
2. Client generates `commentId` and inserts the comment card immediately (name/text/etc.)
3. Render the AI tags area in a **loading** state
4. Send create-comment request with the client-generated `commentId`
5. When tags arrive, update **only** the tags area (do not overwrite the base comment)

**Error handling rules:**

- If **create comment** fails → remove the optimistic comment card + show error
- If **AI tags** fail → keep the comment card; show “Tags unavailable” + allow retry

**Stale response guard (required):**

Store a `tagsRequestId` (or `tagsVersion`) on the comment when starting tags generation, and only apply a tags response if:
- the comment still exists, and
- the response matches the latest `tagsRequestId`

#### Offline Mode Behavior

| Mode | `onMutate` | `onError` | `onSuccess` |
|------|------------|-----------|-------------|
| **Online** | Updates UI immediately | Rollback + show error | **Empty (optimistic-only)** |
| **Offline** | Updates UI immediately | Never called (request queued) | **Empty (optimistic-only)** |

When offline, mutations are queued and synced later via batch updates
```

### Query Keys Convention

```typescript
// List queries
export const todosQueryKey = ['todos'] as const;
export const usersQueryKey = ['users'] as const;

// Single item queries (include ID)
export const todoQueryKey = (id: string) => ['todos', id] as const;
export const userQueryKey = (id: string) => ['users', id] as const;

// Filtered queries (include params)
export const filteredTodosKey = (filter: string) => ['todos', { filter }] as const;
```

### 🚨 CRITICAL: Query Keys Should Be Stable and Long-Lasting

**The goal is to maximize cache hits.** Show cached data immediately, fetch fresh data in background.

#### ❌ WRONG: Dates in Query Keys

```typescript
// ❌ BAD: Date in key causes daily cache misses
const todayKey = ['activities', format(new Date(), 'yyyy-MM-dd')];
// User waits for loading spinner every day

// ❌ BAD: Timestamp in key
const recentKey = ['activities', { since: Date.now() - 86400000 }];
// Cache never hits (key changes every ms)
```

#### ✅ CORRECT: Stable Keys + Client Filtering

```typescript
// ✅ GOOD: Stable key, filter client-side
const activitiesKey = ['activities'] as const;

// In component: filter by date
const todayActivities = activities.filter(a => isToday(a.date));
```

#### Pattern: Show Cached Data + Background Refresh

When switching dates or filters, **show cached data immediately** with a subtle refresh indicator:

```typescript
function ActivityList({ selectedDate }) {
    const { data, isFetching } = useActivities();
    
    // Filter cached data client-side
    const filtered = data?.activities?.filter(a => 
        isSameDay(new Date(a.date), selectedDate)
    ) || [];
    
    return (
        <div>
            {/* Subtle refresh indicator - NOT full loading screen */}
            {isFetching && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                </div>
            )}
            
            {/* Show data immediately (from cache) */}
            <ItemList items={filtered} />
        </div>
    );
}
```

#### UX Comparison

| Approach | Cache Behavior | User Experience |
|----------|----------------|-----------------|
| **Date in key** ❌ | Miss every day | Loading spinner daily |
| **Stable key** ✅ | Hit for weeks | Instant data, background refresh |

📚 **Detailed Guidelines**: [react-query-mutations.md](./react-query-mutations.md#query-key-design-for-long-lasting-cache)

---

## Centralized Configuration

All cache and TTL configuration lives in **one place**: `src/client/config/defaults.ts`

### Time Constants

```typescript
import { TIME } from '@/client/config';

TIME.SECOND  // 1000
TIME.MINUTE  // 60 * 1000
TIME.HOUR    // 60 * 60 * 1000
TIME.DAY     // 24 * 60 * 60 * 1000
```

### Store TTL Defaults

```typescript
import { STORE_DEFAULTS } from '@/client/config';

STORE_DEFAULTS.TTL           // 7 days (default for most stores)
STORE_DEFAULTS.TTL_SHORT     // 1 day (for frequently changing data)
STORE_DEFAULTS.TTL_LONG      // 30 days (for stable data)
STORE_DEFAULTS.TTL_AUTH_HINT // 7 days (auth hint expiry)
STORE_DEFAULTS.TTL_ROUTE     // 30 days (route persistence)
```

### Query Cache Defaults

```typescript
import { QUERY_DEFAULTS } from '@/client/config';

// Default values (user-configurable in Settings when SWR is ON):
QUERY_DEFAULTS.STALE_TIME      // 30 seconds (data is "fresh")
QUERY_DEFAULTS.GC_TIME         // 30 minutes (keep in memory)
QUERY_DEFAULTS.PERSIST_MAX_AGE // 7 days (localStorage persistence)

// SWR ON:  Uses user-configured values → caching + offline works
// SWR OFF: staleTime=0, gcTime=0 → no caching, offline won't work
```

### TTL Validator Helper

```typescript
import { createTTLValidator, STORE_DEFAULTS, TIME } from '@/client/config';

// Use default TTL
const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

// Custom TTL
const isValid = createTTLValidator(2 * TIME.HOUR);

// Usage
if (!isValid(state.timestamp)) {
    // State is expired, clear it
}
```

---

## Offline Mode

### Detection

```typescript
import { useEffectiveOffline } from '@/client/features/settings';

// True if: user enabled offline mode OR device has no network
const isOffline = useEffectiveOffline();
```

### GET Requests (Queries)

When offline, `apiClient.call`:
1. Returns error: `"Network unavailable"`
2. React Query serves stale cached data if available
3. If not cached → user sees error message

### POST Requests (Mutations)

When offline, `apiClient.post`:
1. Queues request to localStorage
2. Returns `{ data: {}, isFromCache: false }` immediately
3. Does NOT throw an error

**⚠️ CRITICAL**: In this app, mutation `onSuccess` should generally be empty (optimistic-only).  
If you do have a special-case `onSuccess`, it must handle empty data when offline (the offline queue returns `{}` immediately).

### Batch Sync

When online:
1. App detects online status via `subscribeToEffectiveOfflineChanges`
2. `flushOfflineQueue()` sends all queued requests to `/api/process/batch-updates`
3. Server executes each request
4. React Query caches are invalidated to fetch fresh data

---

## PWA Instant Boot

The architecture enables **instant startup** after iOS kills the app:

### Boot Sequence

```
1. React Query restore (~1-5ms)
   └── React Query cache restores from localStorage (non-blocking)

2. BootGate (localStorage rehydrate)
   └── Auth/settings/router Zustand stores rehydrate from localStorage
   └── App renders after rehydration completes

3. Background (network)
   └── Auth validation (/me endpoint)
   └── Data revalidation (stale queries)
```

### What Gets Restored

| Data | Source | When Available |
|------|--------|----------------|
| Auth hint | localStorage | After BootGate |
| User settings | localStorage | After BootGate |
| Last route | localStorage | After BootGate |
| Server data | localStorage (React Query) | ~1-5ms |

---

## Creating New Stores

### Step 1: Create Store File

Use the `createStore` factory:

```typescript
// src/client/features/notifications/store.ts
import { createStore } from '@/client/stores';
import { STORE_DEFAULTS, createTTLValidator } from '@/client/config';

const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

interface NotificationState {
    unreadCount: number;
    lastCheckedAt: number | null;
    
    setUnreadCount: (count: number) => void;
    markAllRead: () => void;
}

export const useNotificationStore = createStore<NotificationState>({
    key: 'notification-storage',
    label: 'Notifications',
    creator: (set) => ({
        unreadCount: 0,
        lastCheckedAt: null,
        
        setUnreadCount: (count) => set({ 
            unreadCount: count, 
            lastCheckedAt: Date.now() 
        }),
        
        markAllRead: () => set({ 
            unreadCount: 0, 
            lastCheckedAt: Date.now() 
        }),
    }),
    persistOptions: {
        partialize: (state) => ({
            unreadCount: state.unreadCount,
            lastCheckedAt: state.lastCheckedAt,
        }),
        onRehydrateStorage: () => (state) => {
            if (state && !isValid(state.lastCheckedAt)) {
                state.unreadCount = 0;
                state.lastCheckedAt = null;
            }
        },
    },
});

// Selector hooks
export function useUnreadCount(): number {
    return useNotificationStore((state) => state.unreadCount);
}
```

### Step 2: Create Index Export

```typescript
// src/client/features/notifications/index.ts
export { useNotificationStore, useUnreadCount } from './store';
```

### Step 3: Add to Features Index

```typescript
// src/client/features/index.ts
export * from './auth';
export * from './settings';
export * from './router';
export * from './notifications'; // Add new feature
```

### In-Memory Store Example

For ephemeral state that shouldn't persist:

```typescript
// src/client/features/modal/store.ts
import { createStore } from '@/client/stores';

interface ModalState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

export const useModalStore = createStore<ModalState>({
    key: 'modal',
    label: 'Modal',
    inMemoryOnly: true,  // No persistence
    creator: (set) => ({
        isOpen: false,
        open: () => set({ isOpen: true }),
        close: () => set({ isOpen: false }),
    }),
});
```

---

## Best Practices

### DO ✅

```typescript
// Use createStore factory (required)
import { createStore } from '@/client/stores';

// Use selector hooks for fine-grained subscriptions
const theme = useSettingsStore((s) => s.settings.theme);

// Export query keys for external invalidation
export const todosQueryKey = ['todos'] as const;

// ALWAYS implement optimistic updates for mutations
onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['items'] });
    const previous = queryClient.getQueryData(['items']);
    queryClient.setQueryData(['items'], optimisticUpdate(newData));
    return { previous };
},

// Do nothing on success (optimistic-only)
onSuccess: () => {},

// Use centralized config
const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

// Use registry utilities for cache management
import { getTotalCacheSize } from '@/client/stores';

// Use STABLE query keys (avoid dates that change frequently)
export const activitiesQueryKey = ['activities'] as const;
// Then filter client-side by date in the component

// Show cached data immediately with background refresh indicator
const { data, isFetching } = useQuery(...);
// Show data even when isFetching=true, with subtle "Updating..." text
```

### DON'T ❌

```typescript
// Don't import zustand directly (blocked by ESLint)
import { create } from 'zustand'; // ERROR!

// Don't subscribe to entire store (causes unnecessary re-renders)
const store = useSettingsStore(); // BAD

// Don't hardcode cache times
staleTime: 30000, // BAD - use QUERY_DEFAULTS.STALE_TIME

// Don't update UI from server response (causes race conditions)
onSuccess: (data) => {
    queryClient.setQueryData(['items', data.id], data); // BAD - race condition!
},

// Don't skip optimistic updates (required for offline + fast UX)
// BAD - no onMutate means UI waits for server
useMutation({ mutationFn: updateItem });

// Don't use useState for server data
const [todos, setTodos] = useState([]); // BAD - use React Query

// Don't put dates in query keys (causes frequent cache misses)
const queryKey = ['activities', new Date().toISOString()]; // BAD - cache never hits!
// Use stable key + client-side filtering instead
```

### ESLint Enforcement

Direct zustand imports are **blocked** outside `src/client/stores/`:

```typescript
// This will ERROR - use createStore instead
import { create } from 'zustand';

// This is correct
import { createStore } from '@/client/stores';
```

The codebase also has a rule that warns on `useState`:

```typescript
// This will warn - forces you to think about state location
const [value, setValue] = useState('');

// Add disable comment with explanation if useState is correct
// eslint-disable-next-line state-management/prefer-state-architecture -- ephemeral form input
const [inputValue, setInputValue] = useState('');
```

---

## 🚨 CRITICAL: Correct Loading State Pattern

**NEVER show empty state before data is loaded.** This is a common bug that confuses users.

### The Problem

When using React Query, `isLoading` is only `true` during the **initial fetch with no cached data**. If the cache is empty (cache miss), React Query will:
1. Set `isLoading = true`
2. Fetch data
3. Set `isLoading = false`, `data = fetched data`

However, if you check only `isLoading`, you might show empty state incorrectly when:
- Cache was restored but was empty
- Query was enabled later
- Data hasn't arrived yet

### ❌ WRONG Pattern

```typescript
function MyComponent() {
    const { data, isLoading } = useMyQuery();
    const items = data?.items || [];

    // WRONG: Only checks isLoading
    if (isLoading) {
        return <Skeleton />;
    }

    // BUG: Shows "No items" even if data hasn't loaded yet!
    if (items.length === 0) {
        return <EmptyState />;
    }

    return <ItemsList items={items} />;
}
```

### ✅ CORRECT Pattern

```typescript
function MyComponent() {
    const { data, isLoading } = useMyQuery();
    const items = data?.items || [];

    // CORRECT: Check both isLoading AND data existence
    // Show loading when:
    // 1. Initial fetch with no cache (isLoading)
    // 2. OR no data exists yet (before first fetch completes)
    if (isLoading || data === undefined) {
        return <Skeleton />;
    }

    // Now we know data has been fetched - it's safe to check for empty
    if (items.length === 0) {
        return <EmptyState />;
    }

    return <ItemsList items={items} />;
}
```

### Key Rules

1. **Always check `data === undefined`** alongside `isLoading` for the loading state
2. **Only show empty state** when `data` is defined AND the array is empty
3. **Show cached data immediately** - if `data` exists (from cache), show it while `isFetching` refreshes in background
4. **Use skeleton loaders** not spinners for better UX (per app design guidelines)

### Helper Pattern

For cleaner code, compute a `showLoading` variable:

```typescript
const { data, isLoading, error } = useMyQuery();

// Determine if we should show loading state
const showLoading = isLoading || data === undefined;

// In render:
if (showLoading) return <Skeleton />;
if (error) return <ErrorState />;
if (data.items.length === 0) return <EmptyState />;
return <ItemsList items={data.items} />;
```

### Cache Behavior Summary

| Cache State | `isLoading` | `isFetching` | `data` | What to Show |
|-------------|-------------|--------------|--------|--------------|
| No cache, fetching | `true` | `true` | `undefined` | **Loading skeleton** |
| Cache miss, fetch done | `false` | `false` | `{ items: [] }` | **Empty state** |
| Cache hit (has data) | `false` | `false` | `{ items: [...] }` | **Data** |
| Cache hit, refetching | `false` | `true` | `{ items: [...] }` | **Data + subtle refresh indicator** |

### Background Refresh Indicator Pattern

**Always show cached data immediately** with a subtle indicator when refreshing:

```typescript
function ItemList() {
    const { data, isLoading, isFetching } = useItems();
    
    // Loading: no cached data yet
    if (isLoading || data === undefined) {
        return <Skeleton />;
    }
    
    return (
        <div>
            {/* Subtle refresh indicator - NOT a blocking spinner */}
            {isFetching && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                </div>
            )}
            
            {/* Show cached data immediately */}
            {data.items.length === 0 ? (
                <EmptyState />
            ) : (
                <ItemCards items={data.items} />
            )}
        </div>
    );
}
```

**Why this matters:**
- User sees data **instantly** from cache (PWA feel)
- Background refresh updates data without blocking UI
- Much better UX than showing loading spinner on every visit

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/client/stores/createStore.ts` | Store factory |
| `src/client/stores/registry.ts` | Cache management utilities |
| `src/client/stores/index.ts` | Public exports |
| `src/client/config/defaults.ts` | Centralized TTL/cache constants |
| `src/client/features/auth/store.ts` | Auth state + instant-boot hints |
| `src/client/features/settings/store.ts` | User preferences |
| `src/client/features/router/store.ts` | Route persistence |
| `src/client/query/defaults.ts` | React Query defaults hook |
| `src/client/query/QueryProvider.tsx` | React Query + localStorage persistence |
| `src/client/utils/apiClient.ts` | API client with offline queue |
| `src/client/utils/offlinePostQueue.ts` | POST request queue + batch sync |
| `docs/zustand-stores.md` | Store factory documentation |
