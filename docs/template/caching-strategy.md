---
title: Caching Strategy
description: Single-layer client cache using localStorage. Use this when configuring query caching.
summary: React Query handles all API caching with localStorage persistence. Configure via `useQueryDefaults()`. User can toggle cache in Settings.
priority: 2
---

# Caching Strategy

This document describes the application's caching architecture, including what is cached, where it's stored, and how to manage caches.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [React Query (Server State Cache)](#react-query-server-state-cache)
3. [Zustand (Client State Persistence)](#zustand-client-state-persistence)
4. [Server-Side Cache](#server-side-cache)
5. [Cache Clearing](#cache-clearing)
6. [Historical Note: Removed API Cache](#historical-note-removed-api-cache)

---

## Architecture Overview

The application uses a **simplified single-layer client cache** architecture:

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
│  │  • User settings     │    │  • Query state       │          │
│  │  • Route persistence │    │  • Loading/error     │          │
│  └──────────┬───────────┘    └──────────┬───────────┘          │
│             │                           │                       │
│             ▼                           ▼                       │
│  ┌──────────────────────────────────────────────────┐          │
│  │              localStorage                         │          │
│  │   • Fast and reliable (~1ms read/write)          │          │
│  │   • Limited to ~5MB (sufficient for most apps)   │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         apiClient                                │
│  ┌──────────────────────────────────────────────────┐          │
│  │  No client-side API cache layer                  │          │
│  │  React Query handles all caching                 │          │
│  └──────────────────────────────────────────────────┘          │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js Server                              │
│  ┌──────────────────────────────────────────────────┐          │
│  │  Server-Side Cache (S3 or Filesystem)            │          │
│  │  • Configurable via app.config.js                │          │
│  │  • Used for expensive operations (AI, etc.)      │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Why localStorage Over IndexedDB?

We chose localStorage for all client-side persistence because:

| Aspect | localStorage | IndexedDB |
|--------|-------------|-----------|
| **Read Speed** | ~1ms | 50ms - 6000ms (varies wildly) |
| **Reliability** | Consistent | Unpredictable on some systems |
| **Capacity** | ~5MB | ~50MB+ |
| **API** | Synchronous | Async (complex) |

For our use case, 5MB is sufficient (React Query cache is typically <100KB), and the consistent fast performance is more valuable than extra capacity.

---

## React Query (Server State Cache)

React Query handles all server data caching with automatic:
- **Deduplication** - Multiple components share one request
- **Background refresh** - Stale data updates automatically
- **Persistence** - Cache survives app restart

### Storage Location

```
localStorage key: react-query-cache-v2
```

### Configuration

```typescript
// src/client/query/QueryProvider.tsx
<PersistQueryClientProvider
    persistOptions={{
        persister,
        maxAge: QUERY_DEFAULTS.PERSIST_MAX_AGE, // 7 days (from @/client/config)
        dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
                // Only persist successful queries
                // Exclude large data (e.g., 'reports')
            },
        },
    }}
/>
```

### Default Cache Times

```typescript
// src/client/config/defaults.ts
QUERY_DEFAULTS.STALE_TIME       // 30 seconds (data is "fresh")
QUERY_DEFAULTS.GC_TIME          // 30 minutes (keep in memory after unmount)
QUERY_DEFAULTS.PERSIST_MAX_AGE  // 7 days (localStorage persistence)
```

### User-Controlled Cache Behavior

The `staleWhileRevalidate` setting (Settings → "Use Cache") controls React Query caching:

| Setting | staleTime | gcTime | Behavior | Offline |
|---------|-----------|--------|----------|---------|
| **ON** (default) | User-configurable (default 30s) | User-configurable (default 30min) | Serve cached data instantly, refresh in background | ✅ Works |
| **OFF** | 0 | 0 | Always fetch fresh, never show cached data | ❌ Won't work |

When SWR is ON, users can customize:
- **Stale Time** (seconds): How long data is "fresh" before refetching (default: 30)
- **Memory Cache** (minutes): How long to keep data in memory (default: 30)
- **Persist Cache** (days): How long to keep cache in localStorage (default: 7)

This is controlled by `useQueryDefaults()` - the single point of control for all queries:

```typescript
// src/client/query/defaults.ts
export function useQueryDefaults() {
    const { staleWhileRevalidate, cacheStaleTimeSeconds, cacheGcTimeMinutes } = useSettingsStore((s) => s.settings);

    if (staleWhileRevalidate) {
        return { 
            staleTime: cacheStaleTimeSeconds * 1000,  // User-configurable
            gcTime: cacheGcTimeMinutes * 60 * 1000,   // User-configurable
        };
    }
    return { staleTime: 0, gcTime: 0 }; // No caching, offline won't work
}
```

All query hooks use `...queryDefaults` to automatically respect these settings.

### Excluding Queries from Persistence

Large or sensitive queries can be excluded from persistence:

```typescript
// src/client/query/QueryProvider.tsx
const EXCLUDED_QUERY_KEYS = [
    'reports', // Contains huge session logs
];
```

---

## Zustand (Client State Persistence)

Zustand stores persist user preferences and hints to localStorage.

### Current Stores

| Store | localStorage Key | Contents | TTL |
|-------|-----------------|----------|-----|
| `useAuthStore` | `auth-storage` | Login hints, user hint | 7 days |
| `useSettingsStore` | `settings-storage` | Theme, offline mode, AI model | 7 days |
| `useRouteStore` | `route-storage` | Last visited route | 30 days |

### Example Store with Persistence

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORE_DEFAULTS, createTTLValidator } from '@/client/config';

const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

export const useMyStore = create<MyState>()(
    persist(
        (set) => ({
            value: 'default',
            timestamp: null,
            setValue: (v) => set({ value: v, timestamp: Date.now() }),
        }),
        {
            name: 'my-storage', // localStorage key
            onRehydrateStorage: () => (state) => {
                if (state && !isValid(state.timestamp)) {
                    // Clear expired state
                }
            },
        }
    )
);
```

---

## Server-Side Cache

The server uses S3 or filesystem caching for expensive operations.

### Configuration

```javascript
// src/app.config.js
export const appConfig = {
    cacheType: isProduction ? 's3' : 's3', // 's3' or 'fs'
};
```

### Implementation

```typescript
// src/apis/processApiCall.ts
const provider = appConfig.cacheType === 's3' ? s3CacheProvider : fsCacheProvider;
const serverCache = createCache(provider);

// Server-side caching is currently disabled (React Query handles client-side)
const result = await serverCache.withCache(processWithContext, params, {
    disableCache: true
});
```

---

## Cache Clearing

### From Settings Page

Users can clear caches from Settings:

```typescript
// Clear server-side cache
await clearCacheApi({});

// Clear React Query in-memory cache
queryClient.clear();

// Clear React Query persisted cache
localStorage.removeItem('react-query-cache-v2');
```

### On Logout

Logout clears all caches and user data:

```typescript
// src/client/features/auth/hooks.ts
export async function clearAllUserData(queryClient: QueryClient) {
    queryClient.clear();
    
    if (typeof window !== 'undefined') {
        localStorage.removeItem('settings-storage');
        localStorage.removeItem('route-storage');
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('react-query-cache-v2');
        localStorage.removeItem('apiClient_offline_post_queue_v1');
    }
    
    window.location.href = '/';
}
```

### localStorage Keys Reference

| Key | Purpose | Cleared On |
|-----|---------|-----------|
| `react-query-cache-v2` | React Query cache | Settings clear, Logout |
| `settings-storage` | User settings | Logout only |
| `auth-storage` | Auth hints | Logout only |
| `route-storage` | Route persistence | Logout only |
| `apiClient_offline_post_queue_v1` | Offline mutation queue | Logout only |

---

## Historical Note: Removed API Cache

### What Was Removed (Dec 2025)

Previously, the app had a **separate API cache layer** in addition to React Query:

```
Old Architecture:
Component → React Query Cache → API Cache (IndexedDB/localStorage) → Network
```

Files that were part of this system:
- `src/client/utils/indexedDBCache.ts` (marked as unused, kept for reference)
- `src/client/utils/localStorageCache.ts` (marked as unused, kept for reference)

### Why It Was Removed

1. **Redundancy**: React Query already provides caching + persistence
2. **Complexity**: Two cache layers with different TTLs caused confusion
3. **Performance**: IndexedDB was unreliable (5+ second reads on some systems)
4. **Debugging**: Hard to know which cache was being used

### Current Architecture

```
New Architecture:
Component → React Query (with localStorage persistence) → Network
```

Single source of truth = simpler code, easier debugging.

### If You Need the Old API Cache

The files are preserved with "CURRENTLY UNUSED" comments. To re-enable:

1. Import `clientCacheProvider` from `indexedDBCache.ts`
2. Wrap `apiClient` calls with `clientCache.withCache()`
3. Add `ApiOptions` type back for cache control options

---

## Best Practices

### DO ✅

```typescript
// Use React Query for all server data
const { data, isLoading, error } = useQuery({
    queryKey: ['items'],
    queryFn: fetchItems,
});

// Use centralized config for TTLs
import { QUERY_DEFAULTS, STORE_DEFAULTS } from '@/client/config';

// Guard against empty data in mutations (offline mode)
onSuccess: (data) => {
    if (data && data.id) { /* use data */ }
},

// ✅ CORRECT: Proper loading state handling - check states in order
{isLoading ? (
    <LoadingSpinner />
) : error ? (
    <ErrorMessage />
) : !data ? (
    <p>Unable to load</p>
) : items.length === 0 ? (
    <EmptyState />  // ONLY when truly empty
) : (
    <ItemList items={items} />
)}
```

### DON'T ❌

```typescript
// Don't hardcode cache times
staleTime: 30000, // BAD - use QUERY_DEFAULTS.STALE_TIME

// Don't manually manage API response caching
const cache = new Map(); // BAD - use React Query

// Don't assume mutation data exists
onSuccess: (data) => {
    cache.set(data.id); // BAD - data may be {} when offline
},

// ❌ CRITICAL BUG: Don't show empty state without checking loading first
const items = data?.items || [];
{items.length === 0 ? (
    <p>No items</p>  // BUG: Shows "No items" during loading!
) : (
    <ItemList items={items} />
)}
```

### Loading State Rule

**Always check states in this order: Loading → Error → Empty → Data**

| Cache State | `isLoading` | `data` | Show |
|-------------|-------------|--------|------|
| No cache, fetching | `true` | `undefined` | Loading spinner |
| Cache exists | `false` | cached | Cached data (instant) |
| Revalidating | `false` | cached | Cached data |
| Failed | `false` | `undefined` | Error message |
| Success, empty | `false` | `[]` | Empty state |

See [State Management - Loading States](./state-management.md#️-loading-states---critical-ux-pattern) for detailed patterns.

---

## Related Documentation

- [State Management](./state-management.md) - Zustand vs React Query decision guide
- [Offline PWA Support](./offline-pwa-support.md) - Offline behavior details
- [Architecture](./architecture.md) - Overall system architecture

