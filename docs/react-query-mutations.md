# React Query Mutations & Optimistic Updates (App Guidelines)

This document defines the **required mutation patterns** for this application.

## Core Rule: Optimistic-only

**The UI is the source of truth.**

- **Update UI/cache immediately** in `onMutate`
- **Rollback only on error** in `onError`
- **Do not update UI from server responses** in `onSuccess`
- **Do not invalidate/refetch from mutations** in `onSettled` / `onSuccess`

This avoids race conditions when users interact faster than the server responds.

## What's Allowed in onSuccess/onError? (UI Side Effects)

> **Key Distinction**: The rule is "no STATE updates from server responses" - NOT "onSuccess must be empty".
>
> UI side effects that don't modify application state are perfectly fine.

While `onSuccess`/`onError` should NOT update **cache or application state** from server responses, these UI side effects are acceptable:

✅ **Allowed** (ephemeral UI feedback - no state change):
- **Toasts/notifications**: `toast.success('Saved successfully')` or `toast.error('Failed')`
- **Logging**: `logger.info('Mutation succeeded')`
- **Analytics**: `analytics.track('todo_created')`
- **Navigation**: `router.push('/next-page')`
- **Zustand updates** (non-server data): `useStore.setState({ showWelcome: false })`
- **Cleanup operations**: `queryClient.removeQueries({ queryKey: ['deleted-item', id] })`

❌ **Forbidden** (state updates from server response):
- **React Query cache updates with server data**: `queryClient.setQueryData(['key'], serverData)`
- **Applying server response to UI state**: `setState(response.data)`
- **Invalidating queries**: `queryClient.invalidateQueries(...)` (causes race conditions - see exception below)

**Why is this the rule?** The optimistic-only pattern prevents race conditions where server responses arrive out-of-order and overwrite the user's latest changes. Toasts, logging, and navigation are "fire-and-forget" operations that don't modify application state, so they can't cause race conditions.

```typescript
// ✅ CORRECT: onSuccess with UI side effects (no state update)
onSuccess: () => {
    toast.success('Item deleted');  // Just user feedback
    logger.info('delete', 'Item deleted successfully');  // Just logging
},

// ❌ WRONG: onSuccess updating state from server response
onSuccess: (serverData) => {
    queryClient.setQueryData(['items'], serverData);  // Race condition risk!
},
```

### ✅ Allowed Exception: Invalidating Separate Aggregation Queries

The rule "no invalidateQueries" applies to **the data you just optimistically updated**. However, you **may** invalidate a **separate** query that contains server-computed aggregations the client cannot calculate.

**Example**: Activity list + activity summary

```typescript
// ✅ ALLOWED - invalidating a DIFFERENT query for server-computed aggregations
useMutation({
    mutationFn: deleteActivity,
    
    onMutate: async (activityId) => {
        // Optimistically remove from activities list
        queryClient.setQueryData(['activities'], (old) => ({
            activities: old.activities.filter(a => a._id !== activityId)
        }));
        return { previous };
    },
    
    onError: (_err, _vars, context) => {
        queryClient.setQueryData(['activities'], context.previous);
    },
    
    onSuccess: () => {},  // Empty - don't update activities from server
    
    onSettled: () => {
        // ✅ OK - 'activity-summary' is a SEPARATE query we can't compute client-side
        queryClient.invalidateQueries({ queryKey: ['activity-summary'] });
        
        // ❌ BAD - This would cause race condition with optimistic data
        // queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
});
```

**Why this is acceptable UX:**

| Component | Behavior | Timing |
|-----------|----------|--------|
| **Activity list** | Item disappears instantly | Immediate (optimistic) |
| **Summary card** (e.g., "Today: 15 sets") | Shows stale data briefly → refreshes | ~200-500ms delay |

The user's primary focus is on the list they just modified. The summary is peripheral - a brief delay updating derived aggregations is imperceptible and doesn't cause jarring "jump back" behavior.

**When NOT to use this exception:**
- If the summary is the **primary focus** of the interaction (user drills down into summary)
- If staleness would confuse the user's next action
- For the **same data** you're optimistically updating (always causes race conditions)

## Why "optimistic-only" (race condition example)

If you apply server responses on success:

1. User changes value to "A" → optimistic UI shows "A"
2. User quickly changes to "B" → optimistic UI shows "B"
3. Server responds to the first request ("A") → UI incorrectly reverts to "A"
4. Server responds to the second request ("B") → UI flips again

**Fix**: never apply server responses; the optimistic cache update remains consistent with user intent.

## Pattern: edits / deletes (always optimistic-only)

**Guideline**

- Implement optimistic update in `onMutate`
- Snapshot previous cache for rollback
- Roll back on `onError`
- Keep `onSuccess` and `onSettled` empty

**Examples**

- Edit: toggle todo `completed`, rename a todo title, change a user preference entity
- Delete: delete a todo (rollback if forbidden), remove a saved item

### ⚠️ UX Rule: All Related UI Must Be Instant

If an operation is optimistic, **all UI should feel instant** - not just the list/data display.

**Common mistake**: Showing loading states in confirmation dialogs for optimistic operations.

```typescript
// ❌ WRONG - Dialog shows "Removing..." even though list updates instantly
const handleConfirmDelete = async () => {
    setIsDeleting(true);  // Shows loading spinner
    await deleteMutation.mutateAsync({ id });
    setIsDeleting(false);
    closeDialog();  // Dialog closes AFTER server responds
};

// ✅ CORRECT - Dialog closes immediately, mutation runs in background
const handleConfirmDelete = () => {
    closeDialog();  // Close immediately
    deleteMutation.mutate({ id });  // Optimistic update happens, server in background
};
```

**The principle**: With optimistic updates, the user's action is "done" the moment they click. Don't make them wait for the server.

| Component | Optimistic Behavior |
|-----------|---------------------|
| List/data display | Updates instantly ✓ |
| Confirmation dialog | Closes instantly ✓ |
| Action button | No loading state needed ✓ |
| Form inputs | Clear/reset instantly ✓ |

**Exception**: Show loading only for operations that are NOT optimistic (e.g., creates that require server-generated IDs).

## Pattern: creates (no temp IDs + replace flows)

We **do not** implement “temp IDs → server IDs replacement” flows (too complex/bug-prone).

### Create rule (simplified)

**2.1 Optimistic-only create ONLY if all are true:**

- The client can **safely generate a stable ID**
  - Strong random IDs like UUID/ULID/nanoid are fine
  - If uniqueness depends on server/global knowledge the client doesn’t have, it’s **not safe**
- The server accepts and **persists that ID** as the entity’s public ID
  - Retries must be **idempotent**: same `id` must not create duplicates
- The client can render the entity immediately without important server-derived fields

**2.2 Otherwise: do NOT do optimistic create**

- Show loader / disable submit
- On success, insert the returned entity (or refetch) and render it

### Examples (optimistic-only create)

- Create todo: client generates `id`, inserts `{ id, title, completed:false }`, server stores by `id`
- Create simple comment/note: client generates `id`, server mostly persists the payload and validates permissions

### Examples (no optimistic create)

- Create order/invoice/booking: server computes totals, availability, discounts, permissions, numbering
- Create entity requiring server-side uniqueness checks the client can’t reliably do (client lacks “all items”)

## Pattern: optimistic create + async enrichment (partial loading)

When the base entity is safe to create optimistically (client-generated `id`) but some derived/enriched fields must be computed server-side, use:

- **Optimistic create** for base entity
- **Loading state only** for the enriched field(s)
- When enrichment returns: update **only** the enriched field(s), never overwrite the base entity

### Example: user comment + AI tags

1. User writes comment
2. Client generates `commentId` and inserts comment card immediately (author/text/etc.)
3. Tags area renders in a **loading** state
4. Send create-comment request with `commentId`
5. When tags arrive, fill **only** tags

**Error handling**

- If **create comment** fails → remove optimistic comment card + show error
- If **AI tags** fail → keep comment card; show “Tags unavailable” + allow retry

**Stale response guard (required)**

Store a `tagsRequestId` / `tagsVersion` when starting generation and only apply a tags response if:

- the comment still exists, and
- the response matches the latest `tagsRequestId`

## How to Generate Client IDs

When implementing optimistic creates, you need client-generated IDs that are:
- **Globally unique** - no collisions with other clients or server-generated IDs
- **Stable** - same ID used throughout the request lifecycle
- **Accepted by server** - server must persist this ID, not generate its own

### Use the `generateId()` Utility

This app provides a standard utility for ID generation:

```typescript
import { generateId } from '@/client/utils/id';

const id = generateId();
// → "550e8400-e29b-41d4-a716-446655440000" (UUID v4)
```

**Location**: `src/client/utils/id.ts`

**Implementation**: Uses `crypto.randomUUID()` internally - built into all modern browsers, no dependencies, extremely low collision probability (1 in 2^122).

### Alternative: `nanoid` (If You Need Shorter IDs)

```bash
npm install nanoid
```

```typescript
import { nanoid } from 'nanoid';

const id = nanoid();
// → "V1StGXR8_Z5jdHi6B-myT" (21 chars, URL-safe)
```

### Implementation Pattern

**⚠️ Important**: The ID must be generated ONCE and used consistently. A common mistake is generating different IDs in `mutationFn` vs `onMutate`.

#### Pattern A: Helper Hook (Recommended)

Create a wrapper hook that handles ID generation internally:

```typescript
// hooks.ts
import { generateId } from '@/client/utils/id';

// Base mutation hook (expects _id in input)
export function useCreateTodo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { _id: string; title: string }) => {
            const response = await createTodo(data);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data?.todo;
        },
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: todosQueryKey });
            const previous = queryClient.getQueryData(todosQueryKey);
            
            // Use the same _id from variables
            queryClient.setQueryData(todosQueryKey, (old) => ({
                todos: [...(old?.todos || []), { _id: variables._id, ...variables }]
            }));
            
            return { previous };
        },
        onError: (_err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(todosQueryKey, context.previous);
        },
        onSuccess: () => {},
        onSettled: () => {},
    });
}

// Helper hook that generates ID internally
export function useCreateTodoWithId() {
    const mutation = useCreateTodo();

    return {
        ...mutation,
        mutate: (data: { title: string }) => {
            const _id = generateId();
            mutation.mutate({ ...data, _id });
        },
        mutateAsync: async (data: { title: string }) => {
            const _id = generateId();
            return mutation.mutateAsync({ ...data, _id });
        },
    };
}
```

**Usage in component**:

```typescript
const createMutation = useCreateTodoWithId();

// Simple - ID is generated internally
createMutation.mutate({ title: 'New todo' });
```

#### Pattern B: Generate ID in Component

If you need access to the ID before calling mutate:

```typescript
// Component
import { generateId } from '@/client/utils/id';

function CreateItemForm() {
    const createMutation = useCreateItem();
    
    const handleSubmit = (formData: FormData) => {
        const _id = generateId(); // Generate once
        createMutation.mutate({ ...formData, _id }); // Pass to mutation
    };
}

// Hook
export function useCreateItem() {
    return useMutation({
        mutationFn: async (data: CreateItemInput & { id: string }) => {
            // Use the passed ID
            const response = await createItem(data);
            // ...
        },
        
        onMutate: async (variables) => {
            // Use variables.id - same ID from component
            queryClient.setQueryData(['items'], (old) => ({
                items: [...(old?.items || []), { _id: variables.id, ...variables }]
            }));
        },
    });
}
```

### Edge Cases and Gotchas

#### 1. Server Must Accept Client IDs

Your API handler must use the client-provided ID, not generate its own.

**Use the server utilities** from `@/server/utils`:

```typescript
import { toDocumentId, toStringId, toQueryId } from '@/server/utils';

// ❌ WRONG - Server ignores client ID
const newItem = await collection.insertOne({
    ...data,
    // MongoDB generates _id automatically - client ID is lost!
});

// ✅ CORRECT - Server uses client ID (handles both ObjectId and UUID formats)
const newItem = await collection.insertOne({
    _id: toDocumentId(data._id), // Converts UUID string or ObjectId format appropriately
    ...data,
});

// For API responses, always convert to string
return { 
    item: { 
        ...newItem, 
        _id: toStringId(newItem._id) 
    } 
};
```

**Available server utilities** (`src/server/utils/id.ts`):

| Utility | Use Case |
|---------|----------|
| `toDocumentId(id)` | Insert documents - converts to ObjectId or keeps as UUID string |
| `toQueryId(id)` | Query documents - handles both ID formats |
| `toStringId(id)` | API responses - always returns string |
| `isObjectIdFormat(id)` | Check if ID is legacy ObjectId format |
| `isUuidFormat(id)` | Check if ID is UUID format |

#### 2. Idempotency: Handle Retries

If the client retries with the same ID (network timeout, offline sync), the server must not create duplicates:

```typescript
import { toQueryId, toDocumentId, toStringId } from '@/server/utils';

// Server handler
async function createItem(data: CreateItemInput) {
    // Check if already exists (idempotent) - toQueryId handles both formats
    const existing = await collection.findOne({ _id: toQueryId(data._id) });
    if (existing) {
        return { item: { ...existing, _id: toStringId(existing._id) } };
    }
    
    // Create new - toDocumentId handles both formats
    await collection.insertOne({ _id: toDocumentId(data._id), ...data });
    return { item: { ...data, _id: data._id } };
}
```

#### 3. MongoDB ObjectId Compatibility

This app uses **Option C (Recommended)**: Store UUID strings directly as `_id`.

The server utilities handle both formats seamlessly:

```typescript
import { toDocumentId, toQueryId, toStringId } from '@/server/utils';

// Insert - toDocumentId handles both formats
await collection.insertOne({
    _id: toDocumentId(clientId), // UUID stays as string, ObjectId format converts
    ...data,
});

// Query - toQueryId handles both formats  
const item = await collection.findOne({ 
    _id: toQueryId(clientId) // Works for both legacy ObjectIds and new UUIDs
});

// Response - toStringId normalizes to string
return { _id: toStringId(item._id), ...item };
```

**Why this approach:**
- ✅ Backward compatible with existing ObjectId documents
- ✅ Forward compatible with new UUID documents
- ✅ Single `_id` field (no separate `clientId`)
- ✅ MongoDB indexes work on both formats

#### 4. ⚠️ Always Use Server Utilities - Never Direct ObjectId Methods

When IDs can be either ObjectId format (legacy) or UUID strings (new), direct ObjectId methods will fail.

##### Error 1: `.toHexString()` on UUID strings

```
TypeError: item._id.toHexString is not a function
```

```typescript
// ❌ WRONG - Breaks on UUID strings
const clientId = item._id.toHexString(); // TypeError if _id is a UUID string!

// ✅ CORRECT - Works for both ObjectId and string
import { toStringId } from '@/server/utils';
const clientId = toStringId(item._id); // Always returns string
```

##### Error 2: `new ObjectId()` on UUID strings

```
BSONError: input must be a 24 character hex string, 12 byte Uint8Array, or an integer
```

```typescript
// ❌ WRONG - Breaks on UUID strings
const docId = new ObjectId(clientProvidedId); // BSONError if it's a UUID!

// ✅ CORRECT - Works for both formats
import { toDocumentId } from '@/server/utils';
const docId = toDocumentId(clientProvidedId); // ObjectId or string as appropriate
```

##### Error 3: Direct ObjectId in queries

```typescript
// ❌ WRONG - Breaks on UUID strings
const item = await collection.findOne({ _id: new ObjectId(id) });

// ✅ CORRECT - Works for both formats
import { toQueryId } from '@/server/utils';
const item = await collection.findOne({ _id: toQueryId(id) });
```

**Rule**: In API handlers and database code, **always use the server utilities** instead of direct ObjectId methods:

| Instead of | Use |
|------------|-----|
| `id.toHexString()` | `toStringId(id)` |
| `new ObjectId(id)` | `toDocumentId(id)` or `toQueryId(id)` |

#### 5. Collision Handling (Extremely Rare)

UUID v4 collision probability is ~1 in 2^122. You'll never see one. But if paranoid:

```typescript
import { toQueryId } from '@/server/utils';

// Server can reject with specific error
if (await collection.findOne({ _id: toQueryId(data._id) })) {
    throw new Error('ID_COLLISION'); // Client should regenerate and retry
}
```

---

## When NOT to Use Optimistic Creates (Give Up and Show Loader)

Optimistic creates add complexity. Default to **non-optimistic** (show loader) unless you have a strong reason for instant feedback.

### ❌ Do NOT use optimistic create when:

#### 1. Server Generates the ID

If the entity ID is a server-generated MongoDB ObjectId, database auto-increment, or any ID the client can't know beforehand:

```typescript
// Server generates ID - can't be optimistic
const result = await collection.insertOne(data);
const newId = result.insertedId; // Only known after insert
```

**Why**: You'd need temp ID → real ID replacement, which we explicitly avoid.

#### 2. Server Computes Critical Display Fields

If the server calculates fields that are immediately visible and important:

- **Order total** (after discounts, taxes, shipping)
- **Assigned number** (invoice #, ticket #, order #)
- **Computed status** (based on business rules)
- **Derived timestamps** (server time, not client time)
- **Permissions/visibility** (what the user can see)

**Why**: Showing wrong data then correcting it is worse UX than a brief loader.

#### 3. Server Validates Against Global State

If uniqueness or validity depends on data the client doesn't have:

- **Unique usernames/emails** (must check against all users)
- **Unique slugs** (must check against all posts)
- **Inventory availability** (must check current stock)
- **Time slot booking** (must check against all bookings)

**Why**: Client can't reliably check; optimistic insert might show something that will be rejected.

#### 4. Entity Immediately Affects Multiple Caches

If creating an entity requires updating multiple query caches:

- Creating a "project" that should appear in: projects list, sidebar, recent projects, user's projects, team's projects
- Creating a "transaction" that affects: transactions list, account balance, monthly summary, category totals

**Why**: Coordinating optimistic updates across many caches is complex and error-prone.

#### 5. Complex Relationships Are Created

If the create triggers server-side relationship creation:

- Creating a "team membership" that also creates notification preferences, permissions, etc.
- Creating an "order" that creates line items, reserves inventory, creates payment intent

**Why**: The returned entity has related data the client couldn't predict.

#### 6. The Form Has Validation That Requires Server

If submission might fail validation:

- **Rate limiting** (too many creates)
- **Quota exceeded** (max items reached)
- **Complex business rules** (can't create X because of Y)

**Why**: Optimistically showing an item that gets rejected is confusing.

### ✅ Safe to use optimistic create when:

- Client generates stable ID (UUID/nanoid)
- Server accepts and persists that ID
- Entity is simple (no computed fields needed for display)
- Single cache to update
- Validation is client-side (title required, etc.)
- Failure is rare (just rollback on the rare error)

### Decision Flowchart

```
Can client generate the ID?
├── NO → Non-optimistic (show loader)
└── YES ↓

Does server compute important display fields?
├── YES → Non-optimistic (show loader)
└── NO ↓

Does validation require server/global state?
├── YES → Non-optimistic (show loader)  
└── NO ↓

Multiple caches need updating?
├── YES → Probably non-optimistic (or carefully consider)
└── NO ↓

✅ Safe to use optimistic create
```

### Non-Optimistic Create Pattern (The Safe Default)

```typescript
// Hook - no onMutate, insert on success
export function useCreateItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: CreateItemInput) => {
            const response = await createItem(data);
            if (response.data?.error) throw new Error(response.data.error);
            return response.data?.item;
        },
        
        // No onMutate - not optimistic
        
        onSuccess: (newItem) => {
            if (!newItem) return; // Guard for offline
            queryClient.setQueryData(['items'], (old) => ({
                items: [...(old?.items || []), newItem]
            }));
        },
        
        onError: () => {
            toast.error('Failed to create item');
        },
    });
}

// Component - show loading state
function CreateItemButton({ data }: { data: CreateItemInput }) {
    const createMutation = useCreateItem();
    
    return (
        <Button 
            onClick={() => createMutation.mutate(data)}
            disabled={createMutation.isPending}
        >
            {createMutation.isPending ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                </>
            ) : (
                'Create Item'
            )}
        </Button>
    );
}
```

**UX Note**: With a fast server (~200-500ms), the loading state is barely noticeable. This is often better UX than optimistic + potential rollback.

---

## Query Key Design for Long-Lasting Cache

**Query keys should be STABLE and LONG-LASTING.** The goal is to show cached data as often as possible, fetching fresh data in the background.

### 🚨 CRITICAL: Avoid Dates in Query Keys

**Never include dates that change frequently in query keys.** Dates cause cache misses, forcing the user to wait for fresh data instead of seeing cached data immediately.

```typescript
// ❌ WRONG: Date in key causes frequent cache misses
const todayKey = ['activities', format(new Date(), 'yyyy-MM-dd')];
// Key changes every day → Yesterday's cache is useless
// User sees loading spinner every day instead of instant data

// ❌ WRONG: Time-based key
const recentKey = ['activities', { since: Date.now() - 24 * 60 * 60 * 1000 }];
// Key changes every millisecond → Cache never hits

// ✅ CORRECT: Stable key, filter client-side
const activitiesKey = ['activities'] as const;
// Key is stable → Cache persists across days
// Filter by date in component: activities.filter(a => isToday(a.date))

// ✅ CORRECT: If server filtering required, use stable time windows
const activitiesKey = ['activities', { period: 'last-30-days' }] as const;
// Key is stable for 30 days → Good cache hit rate
```

### Pattern: Stable Key + Client-Side Filtering

For date-filtered data, **fetch a broader dataset and filter client-side**:

```typescript
// Hook fetches all recent activities (stable key)
export function useActivities() {
    const queryDefaults = useQueryDefaults();
    
    return useQuery({
        queryKey: ['activities'] as const,  // ✅ Stable - no date
        queryFn: async () => {
            // Fetch last 30 days (or whatever makes sense)
            const response = await getActivities({ days: 30 });
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        ...queryDefaults,
    });
}

// Component filters client-side
function TodayActivities() {
    const { data, isFetching } = useActivities();
    const todayActivities = data?.activities?.filter(a => isToday(a.date)) || [];
    
    // Show cached data immediately, refresh indicator if fetching
    return (
        <div>
            {isFetching && <RefreshIndicator />}
            <ActivityList activities={todayActivities} />
        </div>
    );
}
```

### Pattern: Show Cached Data + Background Refresh Indicator

When data might be stale (e.g., date-based queries where the cache includes old data), show cached data **immediately** and indicate background refresh:

```typescript
function ActivityDashboard({ selectedDate }: { selectedDate: Date }) {
    const { data, isFetching, dataUpdatedAt } = useActivities();
    
    // Filter cached data by selected date
    const activities = data?.activities?.filter(a => 
        isSameDay(new Date(a.date), selectedDate)
    ) || [];
    
    // Check if cache might be stale for this date
    const cacheAge = Date.now() - dataUpdatedAt;
    const isStale = cacheAge > 5 * 60 * 1000; // > 5 minutes
    
    return (
        <Card>
            <CardHeader className="flex items-center justify-between">
                <CardTitle>Activities for {format(selectedDate, 'MMM d')}</CardTitle>
                
                {/* ✅ Subtle refresh indicator */}
                {isFetching && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Refreshing...
                    </div>
                )}
            </CardHeader>
            
            <CardContent>
                {/* ✅ Show cached data immediately, even if stale */}
                {activities.length === 0 ? (
                    <EmptyState message="No activities for this date" />
                ) : (
                    <ActivityList activities={activities} />
                )}
            </CardContent>
        </Card>
    );
}
```

### UX Comparison: Stable Keys vs Date Keys

| Approach | First Load | Return Visit | Date Change |
|----------|------------|--------------|-------------|
| **Date in key** ❌ | Loading spinner | Loading spinner (cache miss) | Loading spinner |
| **Stable key** ✅ | Loading spinner | **Instant data** (cache hit) | **Instant filtered data** |

### When Server-Side Filtering is Required

If the dataset is too large to fetch entirely (e.g., years of data), use **stable time windows**:

```typescript
// ✅ CORRECT: Stable monthly windows
export const activitiesQueryKey = (month: string) => 
    ['activities', { month }] as const;
// month = '2024-01' - changes once per month, not daily

// ✅ CORRECT: Stable "current period" concept
export const activitiesQueryKey = ['activities', 'current-month'] as const;
// Server interprets "current-month" - key is always stable
```

### Refresh Indicator Component

A reusable pattern for showing background refresh:

```typescript
// components/RefreshIndicator.tsx
export function RefreshIndicator({ isFetching }: { isFetching: boolean }) {
    if (!isFetching) return null;
    
    return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Updating...</span>
        </div>
    );
}

// Usage in any component
function MyList() {
    const { data, isFetching } = useMyQuery();
    
    return (
        <div>
            <div className="flex items-center justify-between">
                <h2>My Items</h2>
                <RefreshIndicator isFetching={isFetching} />
            </div>
            <ItemList items={data?.items || []} />
        </div>
    );
}
```

### Summary: Query Key Best Practices

| Practice | Do ✅ | Don't ❌ |
|----------|-------|---------|
| **Date filtering** | Stable key + client filter | Date in query key |
| **Time windows** | `'current-month'`, `'last-30-days'` | `new Date().toISOString()` |
| **Cache priority** | Show cached first, refresh in background | Invalidate cache, show spinner |
| **Refresh UX** | Subtle indicator while showing data | Full-screen loading spinner |
| **Key stability** | Keys change monthly at most | Keys change daily or more often |

---

## Offline behavior note (this app)

When offline, `apiClient.post` queues the request and returns `{ data: {}, isFromCache: false }` immediately.

Implications:

- Prefer `onSuccess: () => {}` for mutations (optimistic-only)
- If you have a special-case `onSuccess`, it **must** guard against empty `data` while offline
