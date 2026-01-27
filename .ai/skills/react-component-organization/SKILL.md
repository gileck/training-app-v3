---
name: react-component-organization
description: when developing React components
---
# React Component Organization Pattern

This rule documents the pattern for organizing React components in our codebase, focusing on creating small, focused components with clear separation of concerns.

## Core Principles

1. **Single Responsibility**: Each component should handle one specific concern
2. **Separation of Logic and UI**: Separate business logic from UI rendering
3. **Composition over Complexity**: Compose small components rather than creating large monolithic ones
4. **Consistent Folder Structure**: Organize related components in logical folder structures

## Implementation Pattern

For complex UI sections, follow this organization pattern:

### 1. Split Components by Responsibility

Break down large components into smaller, focused components:
- `PageLayout.tsx` - Overall page structure
- `HeaderSection.tsx` - Page header with title, actions
- `ContentSection.tsx` - Main content area
- `DataTable.tsx` - Table showing data
- `FilterBar.tsx` - Controls for filtering data

### 2. Data Fetching Pattern (React Query)

Use React Query hooks for data fetching instead of manual useState/useEffect patterns:

```typescript
// hooks.ts - Colocated in route folder
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, deleteUser } from '@/apis/users/client';

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const response = await getUsers({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (userId: string) => {
            const response = await deleteUser({ userId });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
    // Optimistic-only: update in onMutate, rollback on error, never invalidate from mutations
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const previous = queryClient.getQueryData(['users']);
      queryClient.setQueryData(['users'], (old: any) => {
        if (!old?.users) return old;
        return { ...old, users: old.users.filter((u: any) => u.id !== userId) };
      });
      return { previous };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) queryClient.setQueryData(['users'], context.previous);
    },
    onSuccess: () => {},
    onSettled: () => {},
    });
}

// UserList.tsx - Component uses hooks directly
const UserList = () => {
  const { data, isLoading, error } = useUsers();
  const deleteUserMutation = useDeleteUser();
  const users = data?.users || [];
  
  // CRITICAL: Check states in order - Loading → Error → Empty → Data
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!data) return <p>Unable to load users</p>;
  if (users.length === 0) return <EmptyState message="No users yet" />;
  
  return (
    <div className="user-list">
      {users.map(user => (
        <UserListItem 
          key={user.id} 
          user={user} 
          onDelete={() => deleteUserMutation.mutate(user.id)} 
        />
      ))}
    </div>
  );
};
```

### 3. State Management Pattern

- **Server State**: Use React Query for data from APIs (cached in localStorage)
- **Client State**: Use Zustand stores for app-wide state (persisted to localStorage)
- **Local State**: Use useState for component-specific UI state

```typescript
// ❌ Don't use Context for global state
const { user } = useAuth(); // OLD pattern

// ✅ Use feature stores
import { useUser, useAuthStore } from '@/client/features/auth';
const user = useUser();
const isValidated = useAuthStore((state) => state.isValidated);

// ❌ Don't fetch data with useState/useEffect
const [data, setData] = useState([]);
useEffect(() => { fetchData().then(setData); }, []);

// ✅ Use React Query hooks
const { data, isLoading } = useTodos();
```

**Reference**: See `feature-based-structure` rule for where to place stores and hooks.

### 4. Component Composition Hierarchy

Build UI through composition:
1. **Base/Atom Components**: Simple UI elements in `src/client/components/ui/`
2. **Compound Components**: Combinations of base components (form fields, cards)
3. **Section Components**: Logical sections of a page or feature
4. **Page Components**: Compose sections into complete pages

### 5. File Organization

#### Route-Specific Components

For components that are part of a specific route, follow this structure:
```
src/client/routes/[ROUTE_NAME]/
├── [ROUTE_NAME].tsx     // Main route component 
├── index.ts             // Exports the route
├── hooks.ts             // React Query hooks (queries + mutations)
├── components/          // UI components specific to this route (optional)
│   ├── Header.tsx
│   ├── ContentSection.tsx 
│   └── ListItem.tsx     
└── types.ts             // Shared types (if needed beyond API types)
```

**Note**: Prefer a single `hooks.ts` file over a `hooks/` directory for most routes.

#### Feature Components (cross-cutting features)

For feature-specific components used across multiple routes:
```
src/client/features/notifications/
├── index.ts             // Public API exports
├── store.ts             // Zustand store
├── hooks.ts             // React Query hooks
├── types.ts             // Feature types
├── NotificationBell.tsx // Feature component
└── NotificationList.tsx // Feature component
```

#### Shared UI Components (primitives only)

For truly reusable UI primitives with no business logic:
```
src/client/components/
├── ui/                  // shadcn primitives (Button, Card, Input)
└── layout/              // App shell (TopNavBar, Layout)
```

**Note**: Feature-specific components go in `features/`, NOT `components/`.

### 6. Split Files at These Boundaries

Consider splitting components into separate files when:
- A component exceeds 150 lines
- A component has multiple complex sub-components
- Logic and UI would be clearer if separated
- A component is reused in multiple places

## File Size Guidelines

- Component files should generally stay under 150 lines
- If a component file exceeds 200 lines, it should definitely be split
- Main page components should primarily compose other components rather than implementing complex rendering logic
- `hooks.ts` files can be longer (up to 300 lines) as they contain multiple related hooks

## Example Component Structure

For a typical feature or page:

```typescript
// hooks.ts - React Query hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const featureQueryKey = ['feature'] as const;

export function useFeatureData() {
    return useQuery({
        queryKey: featureQueryKey,
        queryFn: async () => {
            const response = await getFeatureData({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
    });
}

export function useFeatureAction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (params) => { /* ... */ },
        // Optimistic-only: update in onMutate, rollback on error, never invalidate from mutations
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: featureQueryKey });
            const previous = queryClient.getQueryData(featureQueryKey);
            queryClient.setQueryData(featureQueryKey, (old) => {
                // Apply optimistic update...
                return old;
            });
            return { previous };
        },
        onError: (_err, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(featureQueryKey, context.previous);
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

// FeaturePage.tsx - Main page component
const FeaturePage = () => {
    const { data, isLoading, error } = useFeatureData();
    const actionMutation = useFeatureAction();
    const items = data?.items || [];
    
    // CRITICAL: Check states in order - Loading → Error → Empty → Data
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorDisplay error={error} />;
    if (!data) return <p>Unable to load</p>;
    
    return (
        <PageLayout>
            <FeatureHeader title={data?.title} />
            <FeatureFilters filters={data?.filters} />
            {items.length === 0 ? (
                <EmptyState message="No items yet" />
            ) : (
                <FeatureList 
                    items={items} 
                    onAction={(id) => actionMutation.mutate(id)} 
                />
            )}
        </PageLayout>
    );
};
```

Each component referenced above would live in its own file with focused responsibility.

## ⚠️ Loading States - CRITICAL UX Pattern

**NEVER show empty states ("No items found") while data is loading.**

### The Problem

When using `data?.items || []` with unloaded data, the array is empty. If you check `items.length === 0`, 
the UI incorrectly shows "No items" before data loads - a critical UX bug.

### State Priority Chain

Always check states in this exact order: **Loading → Error → Empty → Data**

```typescript
// ✅ CORRECT: Proper loading state handling
function ItemsList() {
    const { data, isLoading, error } = useItems();
    const items = data?.items || [];

    return (
        <Card>
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
        </Card>
    );
}

// ❌ WRONG: Shows "No items" during loading!
function ItemsList() {
    const { data } = useItems();
    const items = data?.items || [];
    
    // BUG: items is [] when loading, so shows empty state!
    return items.length === 0 
        ? <p>No items</p> 
        : <ItemList items={items} />;
}
```

### Quick Reference

| Cache State | `isLoading` | `data` | Show |
|-------------|-------------|--------|------|
| No cache, fetching | `true` | `undefined` | Loading |
| Cache exists | `false` | cached | Data |
| Failed | `false` | `undefined` | Error |
| Success, empty | `false` | `[]` | Empty state |
