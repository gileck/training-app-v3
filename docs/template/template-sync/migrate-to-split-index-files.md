# Migration Guide: Split Index Files (Template + Project)

> **⚠️ ONE-TIME MANUAL UPDATE REQUIRED**
>
> If your project was created before commit `4b8502a` (Jan 18, 2026), you need to manually update 5 index files to use the new template + project pattern.
>
> **Why?** These files are in `ignoredFiles` (don't auto-sync), so you need to update them manually once.

---

## What Changed

The template now splits aggregation files into two parts:
- **`.template.ts` files** - Template code (auto-syncs from template)
- **Main index files** - Your project code + imports from template

This prevents merge conflicts during template sync.

---

## Files to Update (5 total)

Update these files in your project:

1. `src/apis/apis.ts`
2. `src/client/features/index.ts`
3. `src/client/components/NavLinks.tsx`
4. `src/client/routes/index.ts`
5. `src/server/database/collections/index.ts`

---

## 1. Update `src/apis/apis.ts`

### Before (OLD - remove this):
```typescript
import { mergeApiHandlers } from "./registry";
import { chatApiHandlers } from "./chat/server";
import { clearCacheApiHandlers } from "./settings/clearCache/server";
import { authApiHandlers } from "./auth/server";
import { todosApiHandlers } from "./todos/server";
import { reportsApiHandlers } from "./reports/server";
import { featureRequestsApiHandlers } from "./feature-requests/server";

export const apiHandlers = mergeApiHandlers(
  chatApiHandlers,
  clearCacheApiHandlers,
  authApiHandlers,
  todosApiHandlers,
  reportsApiHandlers,
  featureRequestsApiHandlers
);
```

### After (NEW - replace with this):
```typescript
/**
 * API Handlers
 *
 * This file merges template API handlers with project-specific handlers.
 * Template handlers are in apis.template.ts (synced from template).
 *
 * Add your project-specific API handlers below.
 */

import { mergeApiHandlers } from "./registry";
import { templateApiHandlers } from "./apis.template";
import { chatApiHandlers } from "./chat/server";
import { todosApiHandlers } from "./todos/server";

export const apiHandlers = mergeApiHandlers(
  templateApiHandlers,  // Template APIs (auth, reports, feature-requests, clearCache)
  chatApiHandlers,      // Your project-specific APIs
  todosApiHandlers
  // Add more project-specific API handlers here:
  // myApiHandlers,
);
```

**What to keep:**
- Keep any project-specific APIs you added (e.g., `chatApiHandlers`, `todosApiHandlers`)
- Remove template APIs that are now in `templateApiHandlers` (auth, reports, feature-requests, clearCache)

---

## 2. Update `src/client/features/index.ts`

### Before (OLD - remove this):
```typescript
/**
 * Client Features
 */

export * from './auth';
export * from './settings';
export * from './router';
export * from './offline-sync';
export * from './session-logs';
export * from './bug-report';
export * from './feature-request';
export * from './error-tracking';
export * from './theme';
export * from './boot-performance';
export * from './my-custom-feature';  // Your project-specific feature
```

### After (NEW - replace with this):
```typescript
/**
 * Client Features
 *
 * This file re-exports template features and adds project-specific features.
 * Template features are in index.template.ts (synced from template).
 *
 * Add your project-specific feature exports below the template re-export.
 */

// Re-export all template features
export * from './index.template';

// Add project-specific features below:
export * from './my-custom-feature';  // Your project-specific features
```

**What to keep:**
- Keep any project-specific features you added
- Remove template features that are now in `index.template.ts`

---

## 3. Update `src/client/components/NavLinks.tsx`

### Before (OLD - remove this):
```typescript
import { NavItem } from './layout/types';
import { Home, MessageSquare, Settings, CheckSquare, ClipboardList, Palette, Lightbulb } from 'lucide-react';

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/todos', label: 'Todos', icon: <CheckSquare size={18} /> },
  { path: '/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
];

export const menuItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/todos', label: 'Todos', icon: <CheckSquare size={18} /> },
  { path: '/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
  { path: '/theme', label: 'Theme', icon: <Palette size={18} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export const adminMenuItems: NavItem[] = [
  { path: '/admin/reports', label: 'Reports', icon: <ClipboardList size={18} /> },
  { path: '/admin/feature-requests', label: 'Feature Requests', icon: <Lightbulb size={18} /> },
];

export function filterAdminNavItems(items: NavItem[], isAdmin: boolean): NavItem[] {
  if (isAdmin) return items;
  return items.filter((item) => !item.path.startsWith('/admin'));
}
```

### After (NEW - replace with this):
```typescript
/**
 * Project Navigation Items
 *
 * This file defines the app's navigation menus.
 * Admin items and utilities are imported from NavLinks.template.tsx (synced from template).
 *
 * Customize navItems and menuItems for your project's needs.
 */

import { NavItem } from './layout/types';
import { Home, MessageSquare, CheckSquare } from 'lucide-react';

// Re-export template items and utilities
export { adminMenuItems, filterAdminNavItems } from './NavLinks.template';

/** Bottom navigation bar items */
export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/todos', label: 'Todos', icon: <CheckSquare size={18} /> },
  { path: '/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
];

/** Hamburger menu items */
export const menuItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={18} /> },
  { path: '/todos', label: 'Todos', icon: <CheckSquare size={18} /> },
  { path: '/chat', label: 'Chat', icon: <MessageSquare size={18} /> },
  // Template items (theme, settings) can be added here if needed
];
```

**What to keep:**
- Keep your project-specific nav items
- Remove `adminMenuItems` and `filterAdminNavItems` (now in template)

---

## 4. Update `src/client/routes/index.ts`

### Before (OLD - remove this):
```typescript
import { Home } from './Home';
import { NotFound } from './NotFound';
import { AIChat } from './AIChat';
import { Settings } from './Settings';
import { Todos } from './Todos';
import { SingleTodo } from './SingleTodo';
import { Profile } from './Profile';
import { Reports } from './Reports';
import { FeatureRequests } from './FeatureRequests';
import { MyFeatureRequests } from './MyFeatureRequests';
import { Theme } from './Theme';
import { createRoutes } from '../router';

export const routes = createRoutes({
  '/': Home,
  '/ai-chat': AIChat,
  '/todos': Todos,
  '/todos/:todoId': SingleTodo,
  '/settings': Settings,
  '/theme': Theme,
  '/profile': Profile,
  '/my-requests': MyFeatureRequests,
  '/admin/reports': Reports,
  '/admin/feature-requests': FeatureRequests,
  '/not-found': NotFound,
});
```

### After (NEW - replace with this):
```typescript
/**
 * Route Definitions
 *
 * This file defines the app's routes by merging template routes with project routes.
 * Template routes are in index.template.ts (synced from template).
 *
 * Add your project-specific routes below.
 */

import { createRoutes } from '../router';
import { templateRoutes } from './index.template';
import { Home } from './Home';
import { AIChat } from './AIChat';
import { Todos } from './Todos';
import { SingleTodo } from './SingleTodo';

export const routes = createRoutes({
  // Template routes (settings, profile, admin, theme, not-found, etc.)
  ...templateRoutes,

  // Project routes:
  '/': Home,
  '/ai-chat': AIChat,
  '/todos': Todos,
  '/todos/:todoId': SingleTodo,

  // Add more project routes here:
  // '/my-page': MyPage,
});
```

**What to keep:**
- Keep your project-specific routes (e.g., Home, AIChat, Todos)
- Remove template routes that are now in `templateRoutes` (Settings, Theme, Profile, Reports, FeatureRequests, MyFeatureRequests, NotFound)

---

## 5. Update `src/server/database/collections/index.ts`

### Before (OLD - remove this):
```typescript
export * as users from './users';
export * as todos from './todos';
export * as reports from './reports';
export * as featureRequests from './feature-requests';
export * as myCollection from './my-collection';
```

### After (NEW - replace with this):
```typescript
/**
 * Database Collections
 *
 * This file re-exports template collections and adds project-specific collections.
 * Template collections are in index.template.ts (synced from template).
 *
 * Add your project-specific collection exports below the template re-export.
 */

// Re-export all template collections
export * from './index.template';

// Project-specific collections:
export * as todos from './todos';
export * as myCollection from './my-collection';
```

**What to keep:**
- Keep your project-specific collections (e.g., `todos`, `myCollection`)
- Remove template collections that are now in template (users, reports, featureRequests)

---

## Verification

After updating all 5 files:

1. **Run TypeScript checks:**
   ```bash
   yarn checks
   ```

2. **Test the app:**
   ```bash
   yarn dev
   ```

3. **Verify everything works:**
   - Navigation menus should work
   - Routes should load
   - API calls should work
   - Database collections accessible

---

## Why This Change?

**Problem before:** Template sync would conflict on these 5 files because both template and project modified them.

**Solution now:**
- Template code lives in `.template.ts` files (syncs automatically)
- Your code lives in main files (ignored from sync)
- Main files import from template + add project-specific code

**Result:** No more merge conflicts on these files during template sync! 🎉

---

## Need Help?

If you run into issues during migration:

1. Check the template's version of these files for reference
2. Make sure to keep all your project-specific code
3. Only remove imports/exports that are now in `.template.ts` files
4. Run `yarn checks` to catch any missing imports

---

## Summary Checklist

- [ ] Update `src/apis/apis.ts` to import from `apis.template.ts`
- [ ] Update `src/client/features/index.ts` to import from `index.template.ts`
- [ ] Update `src/client/components/NavLinks.tsx` to import from `NavLinks.template.tsx`
- [ ] Update `src/client/routes/index.ts` to import from `index.template.ts`
- [ ] Update `src/server/database/collections/index.ts` to import from `index.template.ts`
- [ ] Run `yarn checks` - should pass with 0 errors
- [ ] Test app - everything should work as before
- [ ] Sync template - should have no conflicts on these files! ✅
