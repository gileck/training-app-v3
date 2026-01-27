---
name: settings-usage-guidelines
description: when implementing a client-side feature that requires persistancy and can be configured by the user (settings/config/etc..)
---
# Settings Usage Guidelines

This document provides guidelines on how to use the application's settings feature using Zustand stores.

## Accessing Settings

Use the `useSettingsStore` hook from the settings feature:

```typescript
import { useSettingsStore } from '@/client/features/settings';

const MyComponent = () => {
    // Subscribe to specific settings slice (recommended)
    const aiModel = useSettingsStore((state) => state.settings.aiModel);
    const theme = useSettingsStore((state) => state.settings.theme);
    
    // Or get full settings object
    const settings = useSettingsStore((state) => state.settings);
    
    return <div>Current AI Model: {aiModel}</div>;
};
```

## Updating Settings

Use the `updateSettings` action from the store:

```typescript
import { useSettingsStore } from '@/client/features/settings';

const MyComponent = () => {
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    const handleUpdateModel = (newModelId: string) => {
        updateSettings({ aiModel: newModelId });
    };

    const handleToggleOffline = () => {
        updateSettings({ offlineMode: true });
    };
};
```

## Offline Mode Detection

The app tracks both user-toggled offline mode and device connectivity:

```typescript
import { useSettingsStore, useEffectiveOffline } from '@/client/features/settings';

const MyComponent = () => {
    // User's manual offline mode setting
    const offlineMode = useSettingsStore((state) => state.settings.offlineMode);
    
    // Device online/offline status
    const isDeviceOffline = useSettingsStore((state) => state.isDeviceOffline);
    
    // Combined: true if EITHER user enabled offline mode OR device is offline
    const effectiveOffline = useEffectiveOffline();
    
    if (effectiveOffline) {
        return <OfflineBanner />;
    }
};
```

## Available Settings

Current settings fields (defined in `src/client/features/settings/types.ts`):

| Field | Type | Description |
|-------|------|-------------|
| `aiModel` | `string` | Selected AI model ID |
| `theme` | `'light' \| 'dark'` | UI theme |
| `offlineMode` | `boolean` | User-toggled offline mode |
| `staleWhileRevalidate` | `boolean` | Cache serving strategy |

## Adding a New Settings Field

1. **Update the `Settings` interface** in `src/client/features/settings/types.ts`:
   ```typescript
   export interface Settings {
       aiModel: string;
       theme: 'light' | 'dark';
       offlineMode: boolean;
       staleWhileRevalidate: boolean;
       newField: boolean; // Add your new field
   }
   ```

2. **Update `defaultSettings`** in `src/client/features/settings/types.ts`:
   ```typescript
   export const defaultSettings: Settings = {
       aiModel: '',
       theme: 'light',
       offlineMode: false,
       staleWhileRevalidate: false,
       newField: false, // Provide default value
   };
   ```

3. **Settings automatically persist** to localStorage via Zustand's `persist` middleware.

4. **(Optional) Update the Settings UI** in `src/client/routes/Settings/Settings.tsx`.

## Clearing Cache

Use the API client and React Query directly:

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { clearCache as clearCacheApi } from '@/apis/settings/clearCache/client';

const REACT_QUERY_CACHE_KEY = 'react-query-cache-v2';

const handleClearCache = async () => {
    const queryClient = useQueryClient();
    
    // Clear server cache
    await clearCacheApi({});
    
    // Clear React Query in-memory cache
    queryClient.clear();
    
    // Clear React Query persisted cache from localStorage
    localStorage.removeItem(REACT_QUERY_CACHE_KEY);
};
```

> **Note**: As of Dec 2025, React Query handles all client-side caching. The old IndexedDB API cache (`clientCacheProvider`) is no longer used. See [Caching Strategy](docs/caching-strategy.md) for details.

## Key Files

- **Settings Types**: `src/client/features/settings/types.ts`
- **Settings Store**: `src/client/features/settings/store.ts`
- **Settings Feature Export**: `src/client/features/settings/index.ts`
- **Settings Page UI**: `src/client/routes/Settings/Settings.tsx`
