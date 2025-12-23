# Application Architecture

This document provides a high-level overview of the application architecture, designed for a Progressive Web App (PWA) with offline-first capabilities and native-like performance.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [App Boot Flow](#app-boot-flow)
3. [Authentication](#authentication)
4. [State Management](#state-management)
5. [Client-Server Communication](#client-server-communication)
6. [Offline Architecture](#offline-architecture)
7. [User Settings](#user-settings)
8. [Route & Component Organization](#route--component-organization)
9. [Key Files Reference](#key-files-reference)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              React Application                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Features      │  │   Routes        │  │   Components    │             │
│  │  (auth, etc.)   │  │  (pages)        │  │  (shared UI)    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                     State Layer                              │           │
│  │  ┌─────────────────┐          ┌─────────────────┐           │           │
│  │  │  Zustand Stores │          │  React Query    │           │           │
│  │  │  (Client State) │          │  (Server State) │           │           │
│  │  └────────┬────────┘          └────────┬────────┘           │           │
│  │           │                            │                     │           │
│  │           ▼                            ▼                     │           │
│  │  ┌─────────────────┐          ┌─────────────────┐           │           │
│  │  │              localStorage                      │           │           │
│  │  │   (instant boot + React Query cache)          │           │           │
│  │  └───────────────────────────────────────────────┘           │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API Layer                                       │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │  apiClient.call (GET)  │  apiClient.post (mutations)        │           │
│  │  - No client cache     │  - Offline queue                   │           │
│  │  - React Query caches  │  - Batch sync                      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Next.js Server                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  API Routes     │  │  Auth (JWT)     │  │  Database       │             │
│  │  /api/process/* │  │  HttpOnly Cookie│  │  MongoDB        │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Offline-First**: App works without network, syncs when online
2. **Fast Boot**: App renders quickly using cached state (localStorage) and background validation
3. **Optimistic Updates (Required)**: All mutations MUST update UI immediately before server confirms. Server responses should NOT update UI (only trigger error rollback or background invalidation)
4. **Feature-Based Organization**: Code is organized by feature, not type

---

## App Boot Flow

When a user opens the app, the following sequence occurs:

```
User Opens App
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. React Query Cache Restore (~1-5ms)                          │
│     - localStorage → Memory (fast! see note below)              │
│     - Server data available immediately                         │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Zustand Rehydration (fast, localStorage)                     │
│     - localStorage → Zustand stores (auth, settings, router)     │
│     - BootGate waits for rehydration before rendering the app    │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. AuthWrapper Renders                                         │
│     - If isProbablyLoggedIn: Show app immediately (instant boot) │
│     - If not: Brief blank screen, /me checks for cookie session │
│     - If /me succeeds: Show app; If /me fails: Show login       │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Route Restoration                                           │
│     - If lastRoute exists: Navigate to saved route              │
│     - Background: Auth validation + data revalidation           │
└─────────────────────────────────────────────────────────────────┘
```

This enables **fast startup** with a short local boot gate, then cached UI renders while fresh data loads in the background.

> **Why localStorage?** We use localStorage (not IndexedDB) for React Query persistence because IndexedDB was causing 5+ second startup delays on some systems (Dec 2025 - possibly a browser bug). localStorage is limited to ~5MB but is consistently fast. See the [State Management](#state-management) section for details and how to switch back if IndexedDB performance improves.

---

## Authentication

The app uses a **hint-based instant boot** pattern for authentication, with support for cookie-only sessions.

### Key Concepts

| Concept | Storage | Purpose |
|---------|---------|---------|
| `isProbablyLoggedIn` | localStorage (Zustand) | UI hint for instant boot |
| `userPublicHint` | localStorage (Zustand) | Name/avatar for immediate display |
| JWT Token | HttpOnly Cookie | Actual authentication (server-side) |
| Validated User | Memory (Zustand) | Full user data after server validation |

### Flow

1. **On Login**: Server sets HttpOnly JWT cookie + client stores hint in Zustand
2. **On App Open (with hint)**: Zustand hydrates hint → show app immediately → validate in background
3. **On App Open (no hint)**: Brief blank screen → call `/me` to check for cookie session
4. **If `/me` succeeds**: Store hint + show app (supports SSO, cleared localStorage)
5. **If `/me` fails**: Show login dialog (only after `isValidated=true`)
6. **On 401**: Clear hints, show login dialog

📚 **Detailed Documentation**: [authentication.md](./authentication.md)

## Admin

Admin access is implemented via a simple convention-based approach:
- Routes under `/admin/*` are admin-only.
- APIs under `admin/*` are admin-only.

📚 **Detailed Documentation**: [admin.md](./admin.md)

---

## State Management

The app uses two complementary state management solutions:

### Zustand (Client State)

All Zustand stores are created using the `createStore` factory from `@/client/stores`. This factory provides:
- **Automatic persistence** to localStorage (default behavior)
- **Central registry** for cache management
- **subscribeWithSelector** middleware for granular subscriptions
- **ESLint enforcement** blocking direct zustand imports

```typescript
import { useAuthStore } from '@/client/features/auth';
import { useSettingsStore } from '@/client/features/settings';

// Reading state
const user = useUser();
const theme = useSettingsStore((s) => s.settings.theme);

// Updating state
const updateSettings = useSettingsStore((s) => s.updateSettings);
updateSettings({ theme: 'dark' });
```

**Use Zustand for:**
- Auth hints (instant boot)
- User preferences (theme, offline mode)
- Route persistence (last visited page)
- Any UI state that should survive app restart

📚 **Store Factory Documentation**: [zustand-stores.md](./zustand-stores.md)

### React Query (Server State)

For data that comes from the server:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';

// Reading server data
const { data, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
});

// Mutating server data
const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => queryClient.invalidateQueries(['todos']),
});
```

**Use React Query for:**
- Any data fetched from APIs
- Data that needs caching/revalidation
- Server state with loading/error states

> **📌 Architecture Decision: localStorage vs IndexedDB**
> 
> React Query cache is persisted to **localStorage** (not IndexedDB). We originally used IndexedDB but switched due to severe performance issues - IndexedDB was causing **5+ second delays** during app startup on some systems (Dec 2025).
> 
> **Note:** This may be a browser bug or machine-specific issue that could be resolved in future browser updates. We plan to re-evaluate IndexedDB performance periodically, especially as the app grows and larger queries need caching.
> 
> **Trade-offs:**
> - ✅ localStorage: Fast (~1ms reads), consistent performance
> - ❌ localStorage: Limited to ~5MB storage (may become a bottleneck)
> - ✅ IndexedDB: Large capacity (100MB+), better for large queries
> - ❌ IndexedDB: Can be extremely slow on some systems (possibly a browser bug)
> 
> Currently, React Query cache (excluding large queries like reports) is typically <100KB, so localStorage works well. Large queries are excluded from persistence via `shouldDehydrateQuery`. However, if the app needs to cache larger datasets, we'll need to revisit IndexedDB.
> 
> **To switch back to IndexedDB** (when performance improves or larger storage is needed): Change `createLocalStoragePersister()` to `createIDBPersister()` in `src/client/query/QueryProvider.tsx`.

### When to Use What

```
Does this state come from an API?
  YES → React Query
  NO ↓

Should it persist across app restarts?
  YES → Zustand store (use createStore factory)
  NO ↓

Is it temporary UI state (modal, form)?
  YES → useState
```

📚 **Detailed Documentation**: [state-management.md](./state-management.md)

---

## Client-Server Communication

All API calls go through a centralized `apiClient`:

### GET Requests (Queries)

```typescript
// Direct network call (React Query handles caching)
const response = await apiClient.call<ResponseType>('entity/list', params);
// Returns: { data, isFromCache: false }
```

- **apiClient** does NOT cache - it's a simple fetch wrapper
- **React Query** handles all caching (localStorage persistence)
- Returns error when offline (React Query serves cached data)

### POST Requests (Mutations)

```typescript
// Bypasses cache, queues when offline
const response = await apiClient.post<ResponseType>('entity/create', params);
// Returns: { data: {} } when offline (queued for later)
```

- Never cached
- Queued in localStorage when offline
- Batch-synced when online via `/api/process/batch-updates`

### API Structure

```
src/apis/{feature}/
├── index.ts      # API name constants
├── types.ts      # Request/Response types
├── client.ts     # Client-side functions (apiClient.call/post)
├── server.ts     # Server handler registration (exports `{feature}ApiHandlers`)
├── shared.ts     # (Optional) shared server-only constants/helpers to avoid circular imports
└── handlers/     # Server-side implementation
```

### API Registry (Server-Side)

- The global API registry lives in `src/apis/apis.ts`
- Each domain exports a `<domain>ApiHandlers` map from `src/apis/<domain>/server.ts`
- `src/apis/registry.ts` provides `mergeApiHandlers(...)` to merge all domain maps into the registry with minimal boilerplate

📚 **Detailed Documentation**: [api-endpoint-format.md](./api-endpoint-format.md)

---

## Offline Architecture

The app is designed to work fully offline:

### Offline Detection

```typescript
import { useEffectiveOffline } from '@/client/features/settings';

const isOffline = useEffectiveOffline();
// true if: user enabled offline mode OR device has no network
```

### Data Flow When Offline

```
┌─────────────────────────────────────────────────────────────────┐
│  GET Request (offline)                                          │
│  1. apiClient returns error: "Network unavailable"              │
│  2. React Query serves stale cached data if available           │
│  3. If not cached → user sees error message                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  POST Request (offline)                                         │
│  1. Add to offline queue (localStorage)                         │
│  2. Return {} immediately (no error)                            │
│  3. Optimistic update handles UI                                │
│  4. When online → batch sync all queued requests                │
└─────────────────────────────────────────────────────────────────┘
```

### Optimistic Updates (Required Pattern)

**Optimistic updates are REQUIRED for all mutations** in this application. They provide:
- **Instant feedback**: UI responds in ~0ms instead of waiting for network
- **Offline support**: UI works even when network is unavailable
- **Native-like UX**: App feels as fast as native mobile apps

#### The Pattern

```typescript
useMutation({
    mutationFn: updateTodo,
    
    // 1. OPTIMISTIC UPDATE: Update UI immediately (before server responds)
    onMutate: async (newData) => {
        await queryClient.cancelQueries({ queryKey: ['todos'] });
        const previous = queryClient.getQueryData(['todos']);
        queryClient.setQueryData(['todos'], optimisticUpdate(newData));
        return { previous };
    },
    
    // 2. ROLLBACK: Restore previous state on error (online mode only)
    onError: (err, vars, context) => {
        queryClient.setQueryData(['todos'], context.previous);
        toast.error('Failed to update');
    },
    
    // 3. INVALIDATE ONLY: Do NOT update UI from server response
    onSuccess: () => {
        // Just invalidate to refetch in background - UI is already correct
        queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
});
```

#### ⚠️ Critical: Do NOT Update UI from Server Response

**Never use server response data to update the UI** in `onSuccess`. This causes race conditions:

```typescript
// ❌ WRONG: Race condition bug
onSuccess: (data) => {
    // This overwrites optimistic update with stale server data!
    queryClient.setQueryData(['todos', data.id], data);
},

// ✅ CORRECT: Only invalidate, let background refetch handle sync
onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
},
```

**Why this matters:**
1. User clicks "Mark Done" → optimistic update shows ✓
2. User clicks "Mark Undone" → optimistic update shows ○
3. First server response arrives → **overwrites to ✓** (stale data!)
4. Second server response arrives → finally shows ○

By only invalidating, the background refetch gets the final correct state.

#### Offline Mode Behavior

| Mode | `onMutate` | `onError` | `onSuccess` |
|------|------------|-----------|-------------|
| **Online** | Updates UI | Rollback + show error | Invalidate queries |
| **Offline** | Updates UI | Never called (queued) | Called with `{}` data |

When offline:
- Mutations are queued to localStorage (not sent to server)
- `onSuccess` is called immediately with empty `{}` data
- UI stays updated from `onMutate`
- When online, batch sync sends queued requests

📚 **Detailed Documentation**: [offline-pwa-support.md](./offline-pwa-support.md)

---

## User Settings

Settings are managed via Zustand with localStorage persistence:

```typescript
import { useSettingsStore, useEffectiveOffline } from '@/client/features/settings';

// Read settings
const theme = useSettingsStore((s) => s.settings.theme);
const offlineMode = useSettingsStore((s) => s.settings.offlineMode);

// Update settings
const updateSettings = useSettingsStore((s) => s.updateSettings);
updateSettings({ theme: 'dark' });

// Check effective offline (user setting OR device offline)
const isOffline = useEffectiveOffline();
```

### Available Settings

| Setting | Type | Description |
|---------|------|-------------|
| `theme` | `'light' \| 'dark'` | UI theme |
| `offlineMode` | `boolean` | Force offline mode |
| `staleWhileRevalidate` | `boolean` | Cache strategy |
| `aiModel` | `string` | Selected AI model |

📚 **Detailed Documentation**: See `.cursor/rules/settings-usage-guidelines.mdc`

---

## Route & Component Organization

### Feature-Based Structure

Code is organized by **feature**, not by type:

```
src/client/
├── features/                    # Cross-cutting features
│   ├── auth/                    # Authentication
│   │   ├── store.ts             # Zustand store (uses createStore)
│   │   ├── hooks.ts             # React Query hooks
│   │   ├── types.ts             # TypeScript types
│   │   ├── AuthWrapper.tsx      # Component
│   │   └── index.ts             # Public exports
│   ├── settings/                # User settings
│   └── router/                  # Route persistence
│
├── stores/                      # Store factory & registry
│   ├── createStore.ts           # Store factory
│   ├── registry.ts              # Cache management utilities
│   ├── types.ts                 # Store types
│   └── index.ts                 # Public exports
│
├── routes/                      # Page components
│   ├── Todos/                   # Todo list page
│   │   ├── Todos.tsx            # Main component
│   │   ├── hooks.ts             # Route-specific hooks
│   │   └── index.ts
│   ├── SingleTodo/              # Single todo page
│   └── Settings/                # Settings page
│
├── components/                  # Shared UI only
│   ├── ui/                      # shadcn primitives
│   └── layout/                  # App shell
│
├── config/                      # Centralized configuration
│   └── defaults.ts              # TTL, cache times
│
└── query/                       # React Query setup
    └── defaults.ts              # Query defaults
```

### How a Route Component Accesses State

```typescript
// src/client/routes/MyFeature/MyFeature.tsx

// 1. Import from features (cross-cutting state)
import { useUser } from '@/client/features/auth';
import { useSettingsStore } from '@/client/features/settings';

// 2. Import route-specific hooks (colocated)
import { useMyData, useCreateMyData } from './hooks';

// 3. Import shared UI components
import { Button } from '@/client/components/ui/button';

export function MyFeature() {
    // Cross-cutting state from features
    const user = useUser();
    const theme = useSettingsStore((s) => s.settings.theme);
    
    // Route-specific server data
    const { data, isLoading } = useMyData();
    const createMutation = useCreateMyData();
    
    // Local UI state (ephemeral)
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    return (/* ... */);
}
```

### Import Rules

| What | Import From |
|------|-------------|
| Cross-cutting stores/hooks | `@/client/features/{name}` |
| Store factory | `@/client/stores` |
| Route-specific hooks | `./hooks` (colocated) |
| Shared UI components | `@/client/components/ui/*` |
| API types | `@/apis/{name}/types` |
| Config constants | `@/client/config` |

📚 **Detailed Documentation**: See `.cursor/rules/feature-based-structure.mdc`

---

## Key Files Reference

### Configuration

| File | Purpose |
|------|---------|
| `src/client/config/defaults.ts` | Centralized TTL and cache constants |
| `src/client/query/defaults.ts` | React Query default options |

### Store Factory

| File | Purpose |
|------|---------|
| `src/client/stores/createStore.ts` | Store factory with persistence |
| `src/client/stores/registry.ts` | Cache management utilities |
| `src/client/stores/types.ts` | Store config interfaces |
| `src/client/stores/index.ts` | Public exports |

### Features

| File | Purpose |
|------|---------|
| `src/client/features/auth/store.ts` | Auth state + instant boot hints |
| `src/client/features/auth/hooks.ts` | Login, logout, validation hooks |
| `src/client/features/settings/store.ts` | User preferences |
| `src/client/features/router/store.ts` | Route persistence |

### Infrastructure

| File | Purpose |
|------|---------|
| `src/client/utils/apiClient.ts` | API client with offline support |
| `src/client/utils/offlinePostQueue.ts` | Offline mutation queue |
| `src/client/query/QueryProvider.tsx` | React Query + localStorage persistence |

### Documentation

| File | Topic |
|------|-------|
| `docs/authentication.md` | Auth flow details |
| `docs/offline-pwa-support.md` | Offline architecture details |
| `docs/caching-strategy.md` | Caching architecture & localStorage vs IndexedDB |
| `docs/api-endpoint-format.md` | API structure |
| `docs/zustand-stores.md` | Store factory & registry |
| `.cursor/rules/state-management-guidelines.mdc` | State management patterns |
| `.cursor/rules/feature-based-structure.mdc` | Code organization |

---

## Summary

This architecture enables:

✅ **Instant startup** - App renders immediately from cache  
✅ **Offline-first** - Full functionality without network  
✅ **Native-like UX** - Required optimistic updates, no loading spinners  
✅ **No race conditions** - Server responses don't update UI, only invalidate  
✅ **Maintainable code** - Feature-based organization  
✅ **Type safety** - End-to-end TypeScript  
✅ **Enforced patterns** - ESLint rules ensure consistency
