---
title: Offline/PWA Support
description: Full offline support with optimistic updates. Use this when implementing mutations.
summary: "GET requests serve cached data, POST requests queue in localStorage and batch-sync when online. **CRITICAL: Never update UI from server response** - use optimistic updates in `onMutate`, keep `onSuccess`/`onSettled` empty."
priority: 2
---

# Offline PWA Support Documentation

## Overview

The application implements full offline Progressive Web App (PWA) support with localStorage-based caching, service worker integration, and user-friendly error handling. Users can work seamlessly offline with cached data and receive clear feedback when content isn't available.

## Architecture

### 0. Auth Preflight Offline Handling

**Files**: 
- `src/client/features/auth/preflight.ts` - Preflight with offline detection
- `src/client/features/auth/hooks.ts` - useAuthValidation with skippedOffline handling

The auth preflight is the **first thing that runs** when the app loads. It has special offline handling to ensure instant boot works offline.

#### How It Works

```typescript
// In preflight.ts
export function startAuthPreflight(): void {
    // Skip preflight when offline - let instant boot hints work
    if (!navigator.onLine) {
        const result = {
            data: null,
            error: null,
            isComplete: true,
            skippedOffline: true,  // ← This flag is key!
        };
        preflightResult = result;
        return;
    }
    
    // Only make network request if online
    // ... fetch('/api/process/auth_me') ...
}
```

#### The `skippedOffline` Flag

When `data: null` is returned, it could mean:

| Scenario | `skippedOffline` | What to do |
|----------|------------------|------------|
| Server says "no session" | `false` | Clear hints → show login |
| Network unavailable | `true` | **Keep hints** → show cached app |

#### Offline Boot Flow

```
Offline App Start
       │
       ▼
┌──────────────────────────────────────────────────┐
│  Preflight: navigator.onLine = false             │
│  → Returns { skippedOffline: true }              │
│  → No network request made                       │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│  useAuthValidation sees skippedOffline = true    │
│  → Sets hasValidated.current = true              │
│  → Does NOT clear isProbablyLoggedIn hints       │
│  → Does NOT trigger fallback React Query         │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│  AuthWrapper: isProbablyLoggedIn = true          │
│  → showApp = true (from localStorage hint)       │
│  → App renders instantly from cache! ✅          │
└──────────────────────────────────────────────────┘
```

#### Why `hasValidated.current = true` Matters

Without this, the fallback React Query would run:

```typescript
// Fallback query enabled check:
enabled: preflightChecked && !hasValidated.current && !isValidated
//       true             && true (if not set!)    && true = ENABLED!
```

If enabled, the fallback query would:
1. Call apiClient → detect offline → throw error
2. Error handler would call `clearAuth()` → clear hints!
3. User would see login form instead of cached app ❌

By setting `hasValidated.current = true` when offline, we prevent this cascade.

📚 **Related**: See [authentication.md](./authentication.md) for complete auth flow details.

### 1. Client-Side Caching (React Query + localStorage)

**Files**: 
- `src/client/query/QueryProvider.tsx` - React Query persistence setup
- `src/client/query/persister.ts` - localStorage persister

The application uses **React Query** for all API data caching, persisted to localStorage.

#### Key Features:
- **Storage**: localStorage (`react-query-cache-v2`)
- **Capacity**: ~5MB (sufficient for most apps)
- **Performance**: Fast and reliable (~1ms reads)
- **Persistence**: Automatic via `PersistQueryClientProvider`
- **Cache TTL**: 24 hours max age

> **Note**: IndexedDB was previously used but removed due to unreliable performance (5+ second reads on some systems). The old IndexedDB implementation is preserved in `src/client/utils/indexedDBCache.ts` but marked as unused. See [Caching Strategy](./caching-strategy.md) for details.

### 2. API Client Offline Behavior

**File**: `src/client/utils/apiClient.ts`

The API client handles offline scenarios gracefully without throwing exceptions, instead returning typed error payloads that integrate with existing error handling.

#### Offline Detection:

```typescript
const effectiveOffline = (settings?.offlineMode === true) || 
                        (typeof navigator !== 'undefined' && !navigator.onLine);
```

Two sources determine offline state:
1. **Manual Offline Mode**: User-toggled setting (`settings.offlineMode`)
2. **Device Offline**: Browser's `navigator.onLine` status

#### GET Requests (`apiClient.call`)

When offline:
- Returns: `{ data: { error: 'Network unavailable while offline' }, isFromCache: false }`
- User sees: Clear message that network is required
- **React Query** serves cached data if available (separate from apiClient)

> **Note**: The apiClient no longer has its own caching layer. React Query handles all caching. When offline, React Query will serve stale cached data if available.

#### POST Requests (`apiClient.post`)

When offline:
- Request is enqueued in localStorage queue for batch sync later
- Returns: `{ data: {}, isFromCache: false }` (empty object, NOT an error)

⚠️ **CRITICAL: OPTIMISTIC-ONLY UI PATTERN**

## The Golden Rule: NEVER Update UI from Server Responses on Success

This is the most important pattern in the entire application for offline support.

### Why Server Responses Cause Race Conditions

```
❌ WRONG: Updating UI from server response

User clicks [+]     → UI: 1 (optimistic)
User clicks [+]     → UI: 2 (optimistic)
Server response #1  → UI: 1 (RACE CONDITION! Reverts to stale state)
Server response #2  → UI: 2 (finally correct, but user saw flicker)
```

### The Correct Pattern

```typescript
// ✅ CORRECT: Optimistic-only pattern
useMutation({
    mutationFn: async (data) => {
        const response = await apiClient.post('entity/update', data);
        if (response.data?.error) throw new Error(response.data.error);
        return response.data;
    },
    
    // THIS IS THE SOURCE OF TRUTH - update UI immediately
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['entity'] });
        const previous = queryClient.getQueryData(['entity']);
        
        // Optimistically update
        queryClient.setQueryData(['entity'], (old) => ({
            ...old,
            value: variables.newValue,
        }));
        
        return { previous }; // For rollback on error
    },
    
    // ONLY on error: rollback to previous state
    onError: (_error, _variables, context) => {
        if (context?.previous) {
            queryClient.setQueryData(['entity'], context.previous);
        }
    },
    
    // onSuccess: intentionally empty - NEVER update UI from server response
    // onSettled: intentionally empty - NEVER refetch after mutation
});
```

### Why This Works

1. **`onMutate`**: Updates UI immediately (this IS the source of truth)
2. **`mutationFn`**: Sends request to server (queued if offline)
3. **`onSuccess`**: EMPTY - server response is ignored on success
4. **`onError`**: ONLY on error - rollback to previous state
5. **`onSettled`**: EMPTY - never invalidateQueries (causes race conditions)

> **Note**: While `onSuccess` should not update state from server responses, ephemeral feedback like **toasts** (`toast.success('Saved')`), **logging**, **analytics**, or **navigation** is acceptable. These don't cause race conditions because they're fire-and-forget operations that don't modify application state. See [React Query Mutations](./react-query-mutations.md#whats-allowed-in-onsuccess) for details.

### Temporary IDs for Create Operations

When creating items, use temporary IDs that stay in the UI:

```typescript
onMutate: async (variables) => {
    // Create with temp ID - will be replaced on next page load
    const optimisticItem = {
        _id: `temp-${Date.now()}`,
        ...variables,
    };
    queryClient.setQueryData(['items'], (old) => [...old, optimisticItem]);
    return { previous };
},
```

The temp ID stays until the next page load fetches fresh data with real IDs.
This is intentional and correct - the user can still interact with the item.

### What About Data Freshness?

- **Page Load**: Queries fetch fresh data from server
- **Navigation**: Queries refetch if stale (React Query handles this)
- **Manual Refresh**: Pull-to-refresh or refresh button refetches
- **Mutations**: UI updates optimistically, no refetch needed

### Files Following This Pattern

All mutation hooks in the application follow this pattern:
- `src/client/features/workout/hooks.ts` - Set tracking mutations
- `src/client/routes/TrainingPlans/hooks.ts` - Plan CRUD mutations
- `src/client/routes/ManagePlan/hooks.ts` - Exercise CRUD mutations

---

When offline, `apiClient.post` returns an empty object `{}` instead of actual response data.
This is intentional - it allows optimistic updates to persist without triggering rollbacks.

**Why this design?**
1. Optimistic updates (in `onMutate`) already update the UI immediately
2. Returning `{}` prevents the mutation from "failing" (no rollback triggered)
3. The request is queued and will sync via batch-updates when online
4. After sync, React Query caches are invalidated to fetch fresh data

- Queue automatically flushes when connection is restored
- User sees: Confirmation that action will complete when online

### 3. Offline Banner

**File**: `src/client/components/layout/TopNavBar.tsx`

A global banner appears below the top navigation when offline, providing constant visual feedback.

```tsx
{effectiveOffline && (
  <div className="sticky top-14 z-40 w-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-xs py-1 text-center border-b border-amber-500/30">
    ⚠️ Offline mode: using cached data
  </div>
)}
```

**Features**:
- Reactive to both manual offline mode and device connectivity
- Styled with amber colors for visibility in light/dark themes
- Sticky positioning keeps it visible while scrolling
- Automatically appears/disappears based on connectivity

### 4. Batch Sync Alert

**Feature**: `src/client/features/offline-sync/`

When the device comes back online and queued offline calls are being synced, a beautiful alert appears showing sync progress and results.

#### Alert States

| State | Appearance | Description |
|-------|------------|-------------|
| **Syncing** | Blue gradient with shimmer animation | "Syncing X offline calls..." with progress bar |
| **Success** | Green gradient | "All X calls synced successfully" - auto-dismisses after 4s |
| **Partial** | Amber gradient | "X synced, Y failed" - expandable details |
| **Error** | Red gradient | "X calls failed to sync" - expandable details |

#### Feature Structure

```
src/client/features/offline-sync/
├── types.ts              # BatchSyncFailure, BatchSyncSuccess, AlertStatus
├── store.ts              # Zustand store for alert state
├── hooks.ts              # useOfflineSyncInitializer hook
├── BatchSyncAlert.tsx    # The alert UI component
└── index.ts              # Public exports
```

#### Usage

The sync initializer is called once in `_app.tsx`:

```typescript
import { useOfflineSyncInitializer, BatchSyncAlert } from '@/client/features';

function AppInitializer() {
  // Initialize offline sync system (queue flushing, alerts, cache invalidation)
  useOfflineSyncInitializer();
  return null;
}

// In App component JSX:
<BatchSyncAlert />
```

#### Alert Features

- **Expandable Details**: Click "View Details" to see individual call results
- **Formatted API Names**: "todos/create" → "Create Todo"
- **Error Information**: Shows error message and request parameters for failed calls
- **Glassmorphism Design**: Backdrop blur with gradient backgrounds
- **Dark Mode Support**: Appropriate colors for both themes
- **Positioned Above Bottom Nav**: Won't overlap UI elements

### 5. Error Handling Pattern

**File**: `src/client/routes/AIChat/AIChat.tsx` (example)

Components check for error payloads before processing responses:

```typescript
const { data, isFromCache, metadata } = await sendChatMessage({...});

// Check if the response contains an error
if (data.error) {
  // Handle error payload - display error message
  const errorMessage: Message = {
    id: Date.now().toString(),
    text: data.error,
    sender: 'ai',
    timestamp: new Date(),
    isFromCache
  };
  setMessages(prev => [...prev, errorMessage]);
} else {
  // Safe to destructure - no error present
  const { cost, result } = data;
  // ... process success response
}
```

This pattern:
- Prevents runtime crashes from missing properties
- Displays user-friendly error messages inline
- Maintains consistent error handling across the app
- Works with React Query hooks for data fetching

### 6. Cache Management

**File**: `src/client/routes/Settings/Settings.tsx`

Users can clear both server-side and client-side caches from the Settings page.

```typescript
// Clear server-side cache
const result = await clearCacheApi({});

// Clear React Query in-memory cache
queryClient.clear();

// Clear React Query persisted cache from localStorage
localStorage.removeItem('react-query-cache-v2');
```

**Features**:
- Clears both server and client caches
- Provides detailed feedback on success/failure
- Handles partial failures gracefully

### 7. Service Worker Integration

**File**: `next.config.ts`

The application uses `next-pwa` for service worker management:

```typescript
const nextConfig: NextConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    // ... caching strategies for fonts, static assets, images, etc.
  ],
})
```

**Configuration**:
- Disabled in development for easier debugging
- Enabled in production for offline capabilities
- Precaches app shell and static assets
- Runtime caching for external resources (fonts, images)

**Note**: POST requests are not cached by the service worker; they rely on the client cache and offline POST queue.

## Type System

**File**: `src/common/cache/types.ts`

The cache metadata type includes support for all cache providers:

```typescript
export interface CacheMetadata {
  createdAt: string;
  lastAccessedAt: string;
  key: string;
  provider: 'fs' | 's3' | 'localStorage' | 'indexedDB';
}
```

This ensures type consistency across:
- Server-side caching (fs, s3)
- Client-side caching (localStorage, indexedDB)
- Cache metadata tracking

## User Experience Flow

### Online → Offline Transition

1. User is browsing with network connection
2. Network connection lost or user enables offline mode
3. Offline banner appears at top of screen
4. Subsequent requests:
   - Previously cached data loads normally
   - Uncached content shows friendly error message
   - POST requests are queued for later

### Offline → Online Transition

1. Network connection restored or user disables offline mode
2. Offline banner disappears
3. Queued POST requests automatically flush
4. Fresh data fetched for new requests
5. Cache updated with new responses

### First-Time Offline

1. User goes offline without having cached data
2. Attempts to access content
3. Sees: "This content isn't available offline yet"
4. Must go online to cache the content first

## Migration Notes

### No Migration Required

The implementation uses localStorage for React Query persistence:
- Older unused caches (legacy files) remain but are not used
- Users can clear caches from Settings if needed
- Avoids slow IndexedDB startup behavior seen on some systems

### Backward Compatibility

- All API response types already include optional `error?: string`
- Existing error handling patterns work without modification
- React Query hooks check for error payloads
- No breaking changes to API contracts

## Testing Checklist

- [ ] Toggle device offline/online → banner appears/disappears
- [ ] Toggle `settings.offlineMode` → banner appears/disappears
- [ ] Offline + cached data → returns cached data
- [ ] Offline + no cache → returns friendly error message
- [ ] Offline + disableCache → returns "Network unavailable" error
- [ ] Offline POST → queues and returns friendly message
- [ ] Online → POST queue flushes automatically
- [ ] Clear cache → clears localStorage persisted cache
- [ ] Private browsing → falls back to localStorage gracefully

### Batch Sync Alert Testing
- [ ] Queue multiple offline POSTs → come online → "Syncing X calls" alert appears
- [ ] All calls succeed → success alert with "All X calls synced" (auto-dismisses)
- [ ] Some calls fail → partial alert shows "X synced, Y failed"
- [ ] Expand details → shows individual call results and errors
- [ ] Dismiss button works on success/error states
- [ ] Alert positioned above bottom nav bar

## Performance Considerations

### localStorage Benefits

1. **Fast & Reliable**: ~1ms read/write, consistent performance
2. **Synchronous**: Simple API, predictable behavior
3. **Sufficient Capacity**: ~5MB is enough for most API cache needs

### Why Not IndexedDB?

IndexedDB was previously used but removed because:
- **Unreliable performance**: 50ms to 6+ seconds on some systems
- **Complexity**: Async API harder to debug
- **Overkill**: Our cache typically stays under 500KB

### Cache Strategy

- **Online**: React Query handles stale-while-revalidate
- **Offline**: React Query serves cached data if available
- **TTL**: 24 hours max age for persisted cache

## Security Considerations

1. **User Scoping**: Cache keys should include user context to prevent cross-user data leakage
2. **Sensitive Data**: Consider excluding sensitive data from client-side cache
3. **Cache Clearing**: Users can manually clear cache from Settings
4. **Private Browsing**: Automatic fallback to localStorage (session-only)

## Future Enhancements

Potential improvements for future iterations:

1. **Cache Size Management**: Implement LRU eviction when storage limits approached
2. **Selective Caching**: Allow per-API configuration of cache behavior
3. **Background Sync**: Use Background Sync API for more reliable POST queue
4. **Cache Warming**: Pre-cache critical content on app load
5. **Offline Analytics**: Track offline usage patterns
6. **Conflict Resolution**: Handle conflicts when syncing offline changes

## Troubleshooting

### Cache Not Working

1. Check if localStorage is available (private browsing / storage disabled can break persistence)
2. Verify `react-query-cache-v2` exists in localStorage
3. Try clearing cache from Settings and rebuilding online

### Offline Mode Stuck

1. Check `settings.offlineMode` in localStorage
2. Verify `navigator.onLine` status
3. Check for network connectivity issues
4. Try toggling offline mode in Settings

### POST Queue Not Flushing

1. Verify online status (`navigator.onLine`)
2. Check localStorage for queued items
3. Verify `shouldFlushNow()` logic
4. Check browser console for errors

### iOS Page Reload on Airplane Mode Off

**Problem**: On iOS, when coming back from airplane mode, the entire page reloads (white flash).

**Cause**: The `next-pwa` library defaults `reloadOnOnline` to `true`, which injects code that calls `location.reload()` when the browser's `online` event fires. This causes a full page reload on iOS when exiting airplane mode.

**Solution**: Set `reloadOnOnline: false` in the PWA configuration to disable automatic reload.

```typescript
// next.config.ts
const nextConfig = withPWA({
  // ... other options
  reloadOnOnline: false,  // Prevent page reload when coming back online
});
```

**Additional best practice**: The React Query persister is also a module-level singleton to prevent potential re-restore issues on re-render:

```typescript
// QueryProvider.tsx - persister created once at module level
const persister = typeof window !== 'undefined' ? createLocalStoragePersister() : null;
```

## Related Files

### Feature Stores (Zustand)
- `src/client/features/settings/store.ts` - Settings state with offline mode
- `src/client/features/auth/store.ts` - Auth state with instant-boot hints
- `src/client/features/router/store.ts` - Route persistence for PWA

### Centralized Configuration
- `src/client/config/defaults.ts` - Centralized TTL/cache defaults

### React Query Persistence
- `src/client/query/QueryProvider.tsx` - React Query with localStorage persistence
- `src/client/query/persister.ts` - localStorage persister for React Query
- `src/client/query/defaults.ts` - Query defaults (uses config)

### API Client & Offline
- `src/client/utils/apiClient.ts` - API client with offline handling
- `src/client/utils/offlinePostQueue.ts` - POST request queue + batch sync
- `src/client/utils/indexedDBCache.ts` - **UNUSED** - Preserved for reference
- `src/client/utils/localStorageCache.ts` - **UNUSED** - Preserved for reference

### Offline Sync Feature
- `src/client/features/offline-sync/store.ts` - Batch sync alert Zustand store
- `src/client/features/offline-sync/hooks.ts` - useOfflineSyncInitializer hook
- `src/client/features/offline-sync/BatchSyncAlert.tsx` - Sync alert UI component
- `src/client/features/offline-sync/types.ts` - Type definitions

### UI Components
- `src/client/components/layout/TopNavBar.tsx` - Offline badge
- `src/client/routes/Settings/Settings.tsx` - Cache management UI

### Configuration
- `src/common/cache/types.ts` - Cache type definitions
- `next.config.ts` - Service worker configuration

### Related Documentation
- [Caching Strategy](./caching-strategy.md) - Comprehensive caching guide
- [State Management](./state-management.md) - Zustand vs React Query

