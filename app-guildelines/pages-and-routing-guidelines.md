# SPA Routing Guidelines

This document outlines the process for adding new routes to our Single Page Application (SPA) routing system.

## Overview

Our application uses a custom SPA routing system built on top of Next.js. The routing system is implemented in the `src/client/router` directory and consists of:

1. A `RouterProvider` component that manages navigation and renders the current route
2. Route components organized in folders within the `src/client/routes` directory
3. Route configuration in the `src/client/routes/index.ts` file
4. Navigation components in the `src/client/components/layout` directory

## Adding a New Route

Follow these steps to add a new route to the application:

### 1. Create a Route Component Folder

Create a new folder in the `src/client/routes` directory with the name of your route component:

```
src/client/routes/
├── NewRoute/
│   ├── NewRoute.tsx
│   └── index.ts
```

### Component Organization Guidelines

Follow these best practices for route components:

- **Keep route components focused and small**: The main route component should be primarily responsible for layout and composition, not complex logic.
  
- **Split large components**: If a route component is getting too large (over 200-300 lines), split it into multiple smaller components within the same route folder.
  
- **Route-specific components**: Components that are only used by a specific route should be placed in that route's folder.
  
- **Shared components**: If a component is used by multiple routes, move it to `src/client/components` directory.
  
- **Component hierarchy**:
  ```
  src/client/routes/NewRoute/           # Route-specific folder
  ├── NewRoute.tsx                      # Main route component (exported)
  ├── NewRouteHeader.tsx                # Route-specific component
  ├── NewRouteContent.tsx               # Route-specific component
  ├── NewRouteFooter.tsx                # Route-specific component
  └── index.ts                          # Exports the main component
  
  src/client/components/                # Shared components
  ├── SharedComponent.tsx               # Used by multiple routes
  └── ...
  ```

- Extract business logic into separate hooks or utility functions
- Follow the naming convention of PascalCase for component files and folders
- Use named exports (avoid default exports as per our guidelines)
- Keep related components and utilities in the same folder

## Data Fetching Pattern

### Using React Query for Data Fetching

Use React Query hooks for data fetching. This provides:
- **Instant boot**: Data loads from localStorage cache immediately
- **Background revalidation**: Fresh data fetches in the background
- **Optimistic updates**: UI updates immediately on mutations
- **Automatic error handling**: Built-in error and loading states

#### 1. Create a Query Hook (if not already exists)

Add a query hook in `src/client/hooks/queries/`:

```tsx
// src/client/hooks/queries/useNewRouteData.ts
import { useQuery } from '@tanstack/react-query';
import { getNewRouteData } from '@/apis/newroute/client';
import type { GetNewRouteDataResponse } from '@/apis/newroute/types';

export const newRouteQueryKey = ['newRoute'] as const;

export function useNewRouteData(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: newRouteQueryKey,
        queryFn: async (): Promise<GetNewRouteDataResponse> => {
            const response = await getNewRouteData();
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        enabled: options?.enabled ?? true,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
    });
}
```

#### 2. Create the Route Component

```tsx
// src/client/routes/NewRoute/NewRoute.tsx
import React from 'react';
import { LinearProgress } from '@/client/components/ui/linear-progress';
import { Alert } from '@/client/components/ui/alert';
import { Button } from '@/client/components/ui/button';
import { useNewRouteData } from '@/client/hooks/queries/useNewRouteData';

export function NewRoute() {
    const { data, isLoading, isFetching, error, refetch } = useNewRouteData();

    // Show loading only on initial load (not background refetch)
    // This enables instant boot - cached data shows immediately
    if (isLoading && !data) {
        return (
            <div className="w-full py-4">
                <LinearProgress />
                <p className="mt-2 text-center text-sm text-muted-foreground">
                    Loading...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-3">
                <Alert variant="destructive">
                    {error instanceof Error ? error.message : 'An error occurred'}
                </Alert>
                <Button onClick={() => refetch()} className="mt-2">
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="p-3">
            <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-semibold">New Route</h1>
                <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
                    Refresh
                </Button>
            </div>
            {/* Render your data */}
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
}
```

#### 3. Create the Index File

```tsx
// src/client/routes/NewRoute/index.ts
export { NewRoute } from './NewRoute';
```

### For Routes with URL Parameters

Use query parameters or route parameters with React Query:

```tsx
// src/client/routes/ItemDetail/ItemDetail.tsx
import { useRouter } from '../../router';
import { useItem } from '@/client/hooks/queries/useItem';

export function ItemDetail() {
    const { queryParams } = useRouter();
    const itemId = queryParams.itemId;

    const { data, isLoading, error } = useItem(itemId || '');

    if (isLoading && !data) {
        return <LoadingSpinner />;
    }

    // ... render item
}
```

### For Routes WITHOUT Data Fetching

For simple routes that don't need data fetching, create a single component:

```tsx
// src/client/routes/About/About.tsx
import React from 'react';

export function About() {
    return (
        <div className="p-3">
            <h1 className="text-2xl font-semibold">About</h1>
            <p>Static content here...</p>
        </div>
    );
}
```

### Creating Mutation Hooks

For data modifications (create, update, delete), create mutation hooks:

```tsx
// src/client/hooks/mutations/useCreateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createItem } from '@/apis/items/client';
import { itemsQueryKey } from '../queries/useItems';

export function useCreateItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateItemRequest) => {
            const response = await createItem(data);
            if (response.data?.error) {
                throw new Error(response.data.error);
            }
            return response.data;
        },
        // Mutations: follow optimistic-only pattern.
        // See docs/react-query-mutations.md for required guidelines (edits/deletes vs creates).
        onSuccess: () => {},
        onSettled: () => {},
    });
}
```

### 2. Register the Route in the Routes Configuration

Add your new route to the routes configuration in `src/client/routes/index.ts`:

```tsx
// Import your new route component
import { NewRoute } from './NewRoute';

// Add it to the routes configuration
export const routes = createRoutes({
  '/': Home,
  '/ai-chat': AIChat,
  '/settings': Settings,
  '/new-route': NewRoute, // Add your new route here
  '/not-found': NotFound,
});
```

Route path naming conventions:
- Use kebab-case for route paths (e.g., `/new-route`, not `/newRoute`)
- Keep paths descriptive but concise
- Avoid deep nesting when possible

### 3. Add Navigation Item

Update the navigation items in `src/client/components/NavLinks.tsx` to include your new route:

```tsx
import { Extension } from 'lucide-react'; // Choose an appropriate icon

export const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home /> },
  { path: '/ai-chat', label: 'AI Chat', icon: <MessageSquare /> },
  { path: '/new-route', label: 'New Route', icon: <Extension /> }, // Add your new route
  { path: '/settings', label: 'Settings', icon: <Settings /> },
];
```

Navigation item guidelines:
- Choose a descriptive but concise label
- Select an appropriate Lucide icon that represents the route's purpose
- Consider the order of items in the navigation

## Using the Router

### Navigation

To navigate between routes in your components, use the `useRouter` hook:

```tsx
import { useRouter } from '../../router';

const MyComponent = () => {
  const { navigate } = useRouter();
  
  const handleClick = () => {
    navigate('/new-route');
  };
  
  // You can also replace the current history entry
  const handleReplace = () => {
    navigate('/new-route', { replace: true });
  };
  
  return (
    <Button onClick={handleClick}>Go to New Route</Button>
  );
};
```

### Navigation Guidelines

- **Always use the navigation API from useRouter**: Never use `window.location.href` for navigation as it causes a full page reload and breaks the SPA behavior.

```tsx
// ❌ Don't do this
window.location.href = '/some-route';

// ✅ Do this instead
const { navigate } = useRouter();
navigate('/some-route');
```

- This ensures consistent navigation behavior throughout the application
- Preserves the SPA (Single Page Application) experience
- Maintains application state during navigation
- Enables proper history management

### Getting Current Route

You can access the current route path using the `useRouter` hook:

```tsx
import { useRouter } from '../../router';

const MyComponent = () => {
  const { currentPath, routeParams, queryParams } = useRouter();
  
  return (
    <div>
      <p>Current path: {currentPath}</p>
      <p>Route params: {JSON.stringify(routeParams)}</p>
      <p>Query params: {JSON.stringify(queryParams)}</p>
    </div>
  );
};
```

## Advanced Routing Features

### Route Parameters

Our router automatically parses route parameters from the URL path. To define a route with parameters, use the colon syntax in your route path:

```tsx
// In src/client/routes/index.ts
export const routes = createRoutes({
  // Other routes...
  '/items/:id': ItemDetail,
});
```

Then access the parameters in your component:

```tsx
// src/client/routes/ItemDetail/ItemDetail.tsx
import { useRouter } from '../../router';

export function ItemDetail() {
  const { routeParams } = useRouter();
  const itemId = routeParams.id;
  
  return (
    <div>
      <h1>Item Detail</h1>
      {itemId ? <p>Item ID: {itemId}</p> : <p>Invalid item ID</p>}
    </div>
  );
}
```

### Query Parameters

The router also automatically parses query parameters from the URL:

```tsx
// src/client/routes/SearchResults/SearchResults.tsx
import { useRouter } from '../../router';

export function SearchResults() {
  const { queryParams } = useRouter();
  const searchQuery = queryParams.q || '';
  
  return (
    <div>
      <h1>Search Results</h1>
      <p>Query: {searchQuery}</p>
    </div>
  );
}
```

## Best Practices for Route Components

### 1. Use React Query for Data Fetching

```tsx
// ✅ Good: Use React Query hooks
const { data, isLoading, error, refetch } = useMyData();

// ❌ Bad: Manual data fetching in components
const [data, setData] = useState(null);
useEffect(() => { /* fetch data */ }, []);
```

### 2. Handle Loading States Properly

```tsx
// ✅ Good: Only block on initial load, not background refetch
if (isLoading && !data) {
    return <LoadingSpinner />;
}
// Data shows immediately from cache, background fetch is silent
```

### 3. Error Handling

```tsx
// ✅ Good: Handle errors gracefully
if (error) {
    return (
        <div className="p-3">
            <Alert variant="destructive">
                {error instanceof Error ? error.message : 'An error occurred'}
            </Alert>
            <Button onClick={() => refetch()}>Try Again</Button>
        </div>
    );
}
```

### 4. Type Safety

```tsx
// ✅ Good: Use TypeScript with proper types
import type { GetDataResponse } from '@/apis/myapi/types';

const { data } = useMyData(); // data is typed as GetDataResponse
```

## Summary

- **Use React Query hooks** for all data fetching (provides instant boot from cache)
- **Create query hooks** in `src/client/hooks/queries/` for reusable data fetching
- **Create mutation hooks** in `src/client/hooks/mutations/` for data modifications
- **Check `isLoading && !data`** for loading states (allows cached data to show immediately)
- **Handle errors gracefully** with retry functionality
- **Use proper TypeScript interfaces** for type safety
- **Keep route components focused** on layout and composition
