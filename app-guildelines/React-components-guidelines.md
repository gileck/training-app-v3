1. Always make the React component mobile first and mobile friendly.    
2. Always use shadcn/ui components with Tailwind CSS for UI components and styling.

## Loading States - CRITICAL UX Pattern

**⚠️ NEVER show empty states ("No items found") while data is loading. This is a critical UX bug.**

### The Problem

When a component renders with React Query data that hasn't loaded yet, using `data?.items || []` will return an empty array. If you then check `items.length === 0`, the UI incorrectly shows "No items" before the actual data loads.

### The Solution: State Priority Chain

Always check states in this exact order: **Loading → Error → Empty → Data**

```tsx
// ✅ CORRECT: Proper loading state handling
function ItemsList() {
    const { data, isLoading, error } = useItems();
    const items = data?.items || [];

    // Render based on state priority
    return (
        <div>
            {isLoading ? (
                // 1. LOADING: Query is fetching (no cache or revalidating)
                <LoadingSpinner />
            ) : error ? (
                // 2. ERROR: Query failed
                <ErrorMessage error={error} />
            ) : items.length === 0 ? (
                // 3. EMPTY: Data loaded successfully but array is empty
                <EmptyState message="No items yet" />
            ) : (
                // 4. DATA: Show the actual content
                <ItemList items={items} />
            )}
        </div>
    );
}
```

```tsx
// ❌ WRONG: Shows "No items" during loading
function ItemsList() {
    const { data } = useItems();
    const items = data?.items || [];

    return (
        <div>
            {items.length === 0 ? (
                <p>No items yet</p>  // BUG: Shows during loading!
            ) : (
                <ItemList items={items} />
            )}
        </div>
    );
}
```

### How React Query Caching Works

| Scenario | isLoading | data | Correct UI |
|----------|-----------|------|------------|
| First load, no cache | `true` | `undefined` | Loading spinner |
| Cached data exists | `false` | cached value | Show cached data |
| Revalidating with cache | `false` | cached value | Show cached data (optionally show revalidating indicator) |
| Error, no cache | `false` | `undefined` | Error message |
| Success, empty result | `false` | `{ items: [] }` | Empty state message |

### Full Pattern With isFetching Indicator

```tsx
function ItemsList() {
    const { data, isLoading, isFetching, error } = useItems();
    const items = data?.items || [];

    // Full-page loading only when no cached data
    if (isLoading) {
        return <PageLoadingSpinner />;
    }

    if (error) {
        return <PageErrorState error={error} />;
    }

    return (
        <div>
            {/* Optional: Show when revalidating cached data */}
            {isFetching && <TopBarProgress />}
            
            {items.length === 0 ? (
                <EmptyState />
            ) : (
                <ItemList items={items} />
            )}
        </div>
    );
}
```

### Alternative: Inline Conditional

For simpler components with an inline list area:

```tsx
function ItemsList() {
    const { data, isLoading, error } = useItems();
    const items = data?.items || [];

    return (
        <Card>
            {isLoading ? (
                <LinearProgress />
            ) : error ? (
                <p className="text-destructive">Failed to load items</p>
            ) : !data ? (
                <p className="text-muted-foreground">Unable to load items</p>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground">No items yet</p>
            ) : (
                <ul>
                    {items.map(item => <li key={item.id}>{item.name}</li>)}
                </ul>
            )}
        </Card>
    );
}
```

### Key Points

1. **`isLoading`**: True when fetching AND no data exists (initial load or no cache)
2. **`isFetching`**: True whenever a network request is in progress (including background revalidation)
3. **`data`**: Contains cached data immediately if available
4. **Empty state**: ONLY show when `!isLoading && data exists && items.length === 0`

