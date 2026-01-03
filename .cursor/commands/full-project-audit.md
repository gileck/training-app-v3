# Full Project Audit

This command performs a comprehensive audit of the entire project against all documentation and rules. It systematically reviews every feature, route, API, and component to ensure compliance with established guidelines.

📚 **Primary References**:
- [CLAUDE.md](mdc:../../CLAUDE.md) - Project guidelines summary
- [app-guidelines-checklist.md](mdc:../../app-guildelines/app-guidelines-checklist.md) - Quick checklist
- [docs/architecture.md](mdc:../../docs/architecture.md) - Architecture overview

---

## ⚠️ CRITICAL: Read This First

This is a **comprehensive audit**. Before starting, understand:

1. **This will take time** - You'll review every file in the project systematically
2. **Create a TODO list FIRST** - Track your progress through each audit area
3. **Don't fix immediately** - Collect all findings first, then propose fixes
4. **Get approval** - Present findings and wait for user approval before making changes

---

## 🚨 MANDATORY: Create TODO List Before Starting

**You MUST create a TODO list using the `todo_write` tool BEFORE starting any audit work.**

This audit is too large to complete without tracking. The TODO list ensures:
- No areas are missed
- Progress is tracked
- The audit can be resumed if interrupted

### Step 1: Create Initial TODO List

**Action**: Use `todo_write` to create todos for each major audit phase:

```
## Initial TODO List (Create This First)

1. [pending] Phase 1: Read all documentation
2. [pending] Phase 2: Discovery - Map APIs, features, routes, mutations, stores
3. [pending] Phase 3.1-3.3: Audit APIs, Features, Routes
4. [pending] Phase 3.4: Audit React Query Mutations (CRITICAL)
5. [pending] Phase 3.5: Audit Zustand Stores (CRITICAL)
6. [pending] Phase 3.6: Audit State Management Patterns (CRITICAL)
7. [pending] Phase 3.7: Audit Offline PWA Support (CRITICAL)
8. [pending] Phase 3.8-3.11: Audit Theming, TypeScript, MongoDB, shadcn
9. [pending] Phase 3.12: Audit React Components (CRITICAL)
10. [pending] Phase 4: Check Cross-Cutting Concerns
11. [pending] Phase 5: Check Documentation Sync
12. [pending] Phase 6: Create Summary & Get Approval
13. [pending] Phase 7: Implement Approved Fixes
14. [pending] Phase 8: Run yarn checks & Verify
```

### Step 2: Expand TODOs During Discovery

After Phase 2 (Discovery), **update your TODO list** to include specific items:

```
## Expanded TODO List (After Discovery)

### APIs (one per domain)
- [pending] Audit auth API
- [pending] Audit todos API
- [pending] Audit chat API
... (add all discovered APIs)

### Features (one per feature)
- [pending] Audit auth feature + store
- [pending] Audit settings feature + store
... (add all discovered features)

### Routes (one per route)
- [pending] Audit Todos route
- [pending] Audit Settings route
... (add all discovered routes)

### Mutations (CRITICAL - one per mutation)
- [pending] Audit useCreateTodo mutation
- [pending] Audit useUpdateTodo mutation
- [pending] Audit useDeleteTodo mutation
... (add ALL discovered mutations)
```

### Step 3: Update TODOs Throughout

**As you complete each area**:
1. Mark the TODO as `completed`
2. Note any issues found
3. Continue to next TODO

**⛔ DO NOT skip TODO updates** - They are essential for tracking this large audit.

---

## Process Overview

```
Phase 1: Study Documentation (Required First)
    │ - CLAUDE.md, architecture.md
    │ - 🚨 CRITICAL: react-query-mutations.md
    │ - 🚨 CRITICAL: zustand-stores.md
    │ - 🚨 CRITICAL: state-management.md
    │ - 🚨 CRITICAL: offline-pwa-support.md
    │ - All .cursor/rules/*.mdc files
    ▼
Phase 2: Discovery & Planning
    │ - Map all APIs, routes, features, stores
    │ - Find ALL mutations and stores
    │ - Create comprehensive TODO list
    ▼
Phase 3: Systematic Review (Per Area)
    │ - 3.1-3.3: APIs, Features, Routes
    │ - 3.4: 🚨 Mutations (optimistic-only pattern)
    │ - 3.5: 🚨 Zustand Stores (createStore factory)
    │ - 3.6: 🚨 State Management (React Query vs Zustand)
    │ - 3.7: 🚨 Offline PWA Support
    │ - 3.8-3.11: Theming, TypeScript, MongoDB, shadcn
    ▼
Phase 4: Cross-Cutting Concerns
    │ - Import patterns
    │ - Server/client separation
    │ - Loading state patterns
    ▼
Phase 5: Documentation Sync
    │ - Check docs match implementation
    │ - Identify gaps/contradictions
    ▼
Phase 6: Summary & Approval
    │ - Present all findings
    │ - Wait for explicit user approval
    │ - ⛔ DO NOT PROCEED without approval
    ▼
Phase 7: Implementation
    │ - Fix approved issues
    │ - Run yarn checks (must pass with 0 errors)
    │ - List flows for user to verify
```

---

## Phase 1: Study Documentation (Required First)

**Action**: Read and understand ALL project documentation before proceeding.

### 🚨 CRITICAL Documentation (Must Read First)

These four docs define the most important patterns. Violations here cause the worst bugs:

| Doc | Why Critical | Key Pattern |
|-----|--------------|-------------|
| **docs/react-query-mutations.md** | Race conditions, offline bugs | Optimistic-only: update in `onMutate`, empty `onSuccess` |
| **docs/zustand-stores.md** | Boot failures, state loss | All stores use `createStore` factory |
| **docs/state-management.md** | Wrong state location, loading bugs | React Query for API, Zustand for client, loading state order |
| **docs/offline-pwa-support.md** | Offline failures, auth issues | Guard against empty `{}`, `skippedOffline` handling |

### Required Reading

Read these files completely in order:

#### 🚨 Critical Documentation (Read First)
1. **`docs/react-query-mutations.md`** - Mutation guidelines (CRITICAL - prevents race conditions)
2. **`docs/zustand-stores.md`** - Store factory (CRITICAL - prevents boot failures)
3. **`docs/state-management.md`** - State management patterns (CRITICAL - prevents loading bugs)
4. **`docs/offline-pwa-support.md`** - Offline handling (CRITICAL - prevents offline failures)

#### Core Documentation
5. `CLAUDE.md` - Main guidelines summary
6. `docs/architecture.md` - Architecture overview
7. `docs/authentication.md` - Auth flow details
8. `docs/caching-strategy.md` - Caching architecture

#### Rules Files
9. `.cursor/rules/client-server-communications.mdc` - API structure
10. `.cursor/rules/feature-based-structure.mdc` - Code organization
11. `.cursor/rules/react-component-organization.mdc` - Component patterns
12. `.cursor/rules/react-hook-organization.mdc` - Hook patterns
13. `.cursor/rules/state-management-guidelines.mdc` - State decisions
14. `.cursor/rules/pages-and-routing-guidelines.mdc` - Routing patterns
15. `.cursor/rules/shadcn-usage.mdc` - UI components
16. `.cursor/rules/theming-guidelines.mdc` - Theming requirements
17. `.cursor/rules/typescript-guidelines.mdc` - TypeScript standards
18. `.cursor/rules/mongodb-usage.mdc` - Database patterns
19. `.cursor/rules/ai-models-api-usage.mdc` - AI integration (if applicable)
20. `.cursor/rules/user-access.mdc` - Auth patterns

#### Supporting Documentation
21. `docs/api-endpoint-format.md` - API format details
22. `docs/admin.md` - Admin system
23. `app-guildelines/React-components-guidelines.md` - Component patterns & loading states

### Confirm Understanding

After reading, you should understand:

| Concept | Key Points |
|---------|------------|
| **API Structure** | `index.ts` (names) → `types.ts` → `server.ts` → `client.ts` → `handlers/` |
| **State Management** | React Query for server data, Zustand for client state, useState for UI |
| **Mutation Pattern** | Optimistic-only: update in `onMutate`, rollback on `onError`, empty `onSuccess`/`onSettled` |
| **Store Factory** | All Zustand stores MUST use `createStore` from `@/client/stores` |
| **Feature Structure** | Features in `features/`, route-specific in `routes/`, shared UI in `components/` |
| **Component Patterns** | Single responsibility, < 200 lines, Loading → Error → Empty → Data, mobile-first |
| **Theming** | Semantic tokens ONLY (`bg-background`, NOT `bg-white`) |
| **TypeScript** | No `any`, no `as any`, prefer unions over enums |
| **MongoDB** | All ops in `server/database/collections/`, use ID utilities |

---

## Phase 2: Discovery & Planning

**Action**: Map the entire codebase and create a comprehensive TODO list.

### Step 2.1: Discover All APIs

```bash
# List all API domains
ls -la src/apis/

# For each domain, check structure
ls -la src/apis/<domain>/
```

**Create a table of all APIs:**

```markdown
| Domain | Has index.ts | Has types.ts | Has server.ts | Has client.ts | Has handlers/ | Notes |
|--------|--------------|--------------|---------------|---------------|---------------|-------|
| auth | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| todos | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
```

### Step 2.2: Discover All Features

```bash
# List all features
ls -la src/client/features/

# For each feature, check structure
ls -la src/client/features/<feature>/
```

**Create a table of all features:**

```markdown
| Feature | Has store.ts | Has hooks.ts | Has types.ts | Has index.ts | Uses createStore | Notes |
|---------|--------------|--------------|--------------|--------------|------------------|-------|
| auth | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| settings | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
```

### Step 2.3: Discover All Routes

```bash
# List all routes
ls -la src/client/routes/

# For each route, check structure
ls -la src/client/routes/<route>/
```

**Create a table of all routes:**

```markdown
| Route | Main Component | Has hooks.ts | Has components/ | Registered in index.ts | Notes |
|-------|----------------|--------------|-----------------|------------------------|-------|
| Todos | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Settings | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
```

### Step 2.4: Discover All Mutations

```bash
# Find all useMutation usage
grep -r "useMutation" src/client --include="*.ts" --include="*.tsx" -l

# Find temp ID patterns (RED FLAGS)
grep -r "temp-\|temp_\|tempId" src/client --include="*.ts" --include="*.tsx"

# Find invalidateQueries in mutations (RED FLAG)
grep -r "invalidateQueries" src/client --include="*.ts" --include="*.tsx" -B5 -A5
```

### Step 2.5: Discover Database Collections

```bash
# List all collections
ls -la src/server/database/collections/
```

### Step 2.6: 🚨 MANDATORY - Update TODO List With Discoveries

**⛔ DO NOT PROCEED to Phase 3 without updating your TODO list.**

After completing discovery (Steps 2.1-2.5), you MUST use the `todo_write` tool to **expand your initial TODO list** with specific items for everything you discovered:

```
## Expanded TODO List (REQUIRED before Phase 3)

### APIs (one TODO per domain discovered)
- [pending] Audit auth API
- [pending] Audit todos API
- [pending] Audit chat API
- [pending] Audit reports API
... (add ALL discovered APIs)

### Features (one TODO per feature discovered)
- [pending] Audit auth feature + verify createStore
- [pending] Audit settings feature + verify createStore
- [pending] Audit router feature + verify createStore
... (add ALL discovered features)

### Routes (one TODO per route discovered)
- [pending] Audit Todos route + loading states
- [pending] Audit Settings route + loading states
... (add ALL discovered routes)

### 🚨 Mutations (CRITICAL - one TODO per mutation discovered)
- [pending] Audit useCreateTodo - check optimistic pattern
- [pending] Audit useUpdateTodo - check optimistic pattern
- [pending] Audit useDeleteTodo - check optimistic pattern
... (add ALL discovered mutations - this is critical!)

### Cross-Cutting Checks
- [pending] Audit theming compliance
- [pending] Audit TypeScript quality
- [pending] Audit MongoDB usage patterns
- [pending] Check docs/implementation alignment
```

**Why specific TODOs matter**:
- Generic "audit all mutations" is too vague
- Each mutation/store/route needs individual attention
- Specific TODOs prevent accidentally skipping items

**Mark each TODO as `completed` or `cancelled` as you finish it.**

---

## Phase 3: Systematic Review

### 3.1: API Audit (Per Domain)

For EACH API domain, check:

#### 3.1.1: File Structure

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `index.ts` exists | ✓ | | |
| `types.ts` exists | ✓ | | |
| `server.ts` exists | ✓ | | |
| `client.ts` exists | ✓ | | |
| `handlers/` exists (if multiple ops) | ✓ | | |

#### 3.1.2: index.ts Checks

```typescript
// ✅ REQUIRED: Domain name constant
export const name = 'domain';

// ✅ REQUIRED: API name constants
export const API_OPERATION_NAME = 'domain/operation';

// ❌ MUST NOT: Export handler functions
// ❌ MUST NOT: Export client functions
```

| Check | Status |
|-------|--------|
| Has `name` constant | |
| Has API name constants | |
| Does NOT export handlers | |
| Does NOT export client functions | |

#### 3.1.3: types.ts Checks

| Check | Status |
|-------|--------|
| Request types defined | |
| Response types defined | |
| Types NOT duplicated elsewhere | |
| Uses proper types (no `any`) | |

#### 3.1.4: server.ts Checks

```typescript
// ✅ REQUIRED: Re-export from index
export * from './index';

// ✅ REQUIRED: Import API names from index
import { API_OPERATION_NAME } from './index';

// ✅ REQUIRED: Export handlers object
export const domainApiHandlers = { ... };
```

| Check | Status |
|-------|--------|
| Has `export * from './index'` | |
| Imports API names from `./index` | |
| Exports handlers object | |
| Does NOT import client code | |

#### 3.1.5: client.ts Checks

```typescript
// ✅ REQUIRED: Import API names from index (NOT server)
import { API_OPERATION_NAME } from './index';

// ✅ REQUIRED: Returns CacheResult<T>
export async function operation(params: Req): Promise<CacheResult<Res>> { ... }
```

| Check | Status |
|-------|--------|
| Imports API names from `./index` | |
| Does NOT import from `./server` | |
| Returns `CacheResult<T>` | |
| Uses `apiClient.call` or `apiClient.post` | |

#### 3.1.6: Registration Check

Verify in `src/apis/apis.ts`:

| Check | Status |
|-------|--------|
| Handlers imported from `server.ts` | |
| Handlers spread into registry | |

---

### 3.2: Feature Audit (Per Feature)

For EACH feature, check:

#### 3.2.1: File Structure

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `store.ts` exists (if has state) | ✓ | | |
| `hooks.ts` exists (if has hooks) | ✓ | | |
| `types.ts` exists (if has types) | ✓ | | |
| `index.ts` exists | ✓ | | |

#### 3.2.2: Store Factory Compliance

```typescript
// ✅ REQUIRED: Use createStore factory
import { createStore } from '@/client/stores';

// ✅ REQUIRED: Proper configuration
const useMyStore = createStore<MyState>({
    key: 'storage-key',
    label: 'Display Name',
    creator: (set) => ({ ... }),
    // ONE OF:
    persistOptions: { ... },  // For persisted stores
    // OR
    inMemoryOnly: true,       // For in-memory stores
});
```

| Check | Status |
|-------|--------|
| Uses `createStore` from `@/client/stores` | |
| Does NOT import `create` from zustand directly | |
| Has `key` property | |
| Has `label` property | |
| Has `creator` function | |
| Has `persistOptions` OR `inMemoryOnly: true` | |

#### 3.2.3: Index Exports

| Check | Status |
|-------|--------|
| Exports store hooks | |
| Exports feature hooks | |
| Exports components (if any) | |
| Exports types | |

---

### 3.3: Route Audit (Per Route)

For EACH route, check:

#### 3.3.1: File Structure

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `[Route].tsx` exists | ✓ | | |
| `index.ts` exists | ✓ | | |
| `hooks.ts` exists (if has data) | ✓ | | |

#### 3.3.2: Route Registration

Check in `src/client/routes/index.ts`:

| Check | Status |
|-------|--------|
| Route is registered | |
| Uses correct path format (`/kebab-case`) | |
| Has `public: true` if needed | |
| Has `adminOnly: true` if needed | |

#### 3.3.3: Component Quality

| Check | Status |
|-------|--------|
| Component under 200 lines | |
| Uses React Query hooks (not direct API calls) | |
| Proper loading state handling | |
| Proper error state handling | |
| Proper empty state handling | |
| Loading → Error → Empty → Data order | |

#### 3.3.4: Loading State Pattern (CRITICAL)

```typescript
// ✅ CORRECT: Check states in order
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
if (!data) return <p>Unable to load</p>;
if (items.length === 0) return <EmptyState />;
return <ItemList items={items} />;

// ❌ WRONG: Shows empty state during loading
if (items.length === 0) return <EmptyState />; // BUG!
```

| Check | Status |
|-------|--------|
| Checks `isLoading` first | |
| Checks `error` second | |
| Checks `!data` third | |
| Checks empty array last | |

---

### 3.4: React Query Mutations Audit (CRITICAL)

📚 **Reference**: [docs/react-query-mutations.md](../../docs/react-query-mutations.md)

This is the **most critical** audit section. Race conditions from incorrect mutation patterns are the #1 source of bugs.

#### 3.4.1: Find ALL Mutations

```bash
# Find all useMutation usage
grep -r "useMutation" src/client --include="*.ts" --include="*.tsx" -l

# Find temp ID patterns (RED FLAGS)
grep -r "temp-\|temp_\|tempId\|`temp" src/client --include="*.ts" --include="*.tsx"

# Find invalidateQueries in mutations (RED FLAG unless separate aggregation query)
grep -r "invalidateQueries" src/client --include="*.ts" --include="*.tsx" -B5 -A5

# Find setQueryData in onSuccess (RED FLAG)
grep -r "onSuccess.*setQueryData\|setQueryData.*onSuccess" src/client --include="*.ts" --include="*.tsx"
```

#### 3.4.2: Classification Table

Create a table of ALL mutations:

| Hook | Type | File | Pattern | Status |
|------|------|------|---------|--------|
| useUpdateTodo | Edit | routes/Todos/hooks.ts | Optimistic-only | ✓/✗ |
| useDeleteTodo | Delete | routes/Todos/hooks.ts | Optimistic-only | ✓/✗ |
| useCreateTodo | Create | routes/Todos/hooks.ts | Non-optimistic OR Client ID | ✓/✗ |

#### 3.4.3: Edit/Delete Mutations - Optimistic-Only Pattern

**REQUIRED pattern for ALL edits and deletes:**

```typescript
// ✅ REQUIRED pattern
useMutation({
    mutationFn: async (data) => { ... },
    
    // STEP 1: Update UI immediately (SOURCE OF TRUTH)
    onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: ['key'] });
        const previous = queryClient.getQueryData(['key']);
        queryClient.setQueryData(['key'], (old) => /* optimistic update */);
        return { previous };
    },
    
    // STEP 2: Rollback ONLY on error
    onError: (_err, _vars, context) => {
        if (context?.previous) {
            queryClient.setQueryData(['key'], context.previous);
        }
    },
    
    // STEP 3: EMPTY - never update from server response
    onSuccess: () => {},
    
    // STEP 4: EMPTY - never invalidateQueries from mutations
    onSettled: () => {},
});
```

**Per-mutation checklist:**

| Check | Status |
|-------|--------|
| Has `onMutate` with optimistic update | |
| `onMutate` cancels queries first | |
| `onMutate` snapshots previous for rollback | |
| Has `onError` with rollback | |
| `onSuccess` is empty | |
| `onSettled` is empty | |
| Does NOT use `invalidateQueries` on same data | |
| Does NOT use `setQueryData` with server response | |

**Allowed exception**: `invalidateQueries` on a SEPARATE aggregation query (e.g., `['activity-summary']` after modifying `['activities']`).

#### 3.4.4: Create Mutations - Decision Required

For EACH create mutation, answer:

| Question | Answer | Notes |
|----------|--------|-------|
| Does client generate stable ID (UUID/nanoid)? | Yes/No | |
| Does server accept and persist that ID? | Yes/No | Check API handler |
| Does server compute critical display fields? | Yes/No | (totals, URLs, numbers) |
| Does validation require global state? | Yes/No | (uniqueness, quotas) |
| **Verdict** | Optimistic / Non-optimistic | |

**Pattern A: Client-Generated ID (Optimistic)**

```typescript
// ✅ CORRECT: Optimistic with client-generated ID
import { generateId } from '@/client/utils/id';

// Helper hook pattern
export function useCreateTodoWithId() {
    const mutation = useCreateTodo();
    return {
        ...mutation,
        mutate: (data: { title: string }) => {
            const _id = generateId(); // UUID generated ONCE
            mutation.mutate({ ...data, _id });
        },
    };
}

// Base mutation
useMutation({
    mutationFn: async (data: { _id: string; title: string }) => { ... },
    
    onMutate: async (variables) => {
        // Use variables._id - same ID throughout
        queryClient.setQueryData(['todos'], (old) => ({
            todos: [...(old?.todos || []), { _id: variables._id, ...variables }]
        }));
        return { previous };
    },
    
    onError: (_err, _vars, context) => { /* rollback */ },
    onSuccess: () => {},  // EMPTY - optimistic-only
    onSettled: () => {},  // EMPTY
});
```

**Pattern B: Server-Generated ID (Non-Optimistic)**

```typescript
// ✅ CORRECT: Non-optimistic create (show loading)
useMutation({
    mutationFn: async (data) => { ... },
    
    // No onMutate - don't insert optimistically
    
    onSuccess: (newItem) => {
        if (!newItem) return; // ⚠️ CRITICAL: Guard for offline mode
        queryClient.setQueryData(['items'], (old) => ({
            items: [...(old?.items || []), newItem]
        }));
    },
});

// Component shows loading state
<Button disabled={mutation.isPending}>
    {mutation.isPending ? 'Creating...' : 'Create'}
</Button>
```

**❌ NON-COMPLIANT: Temp ID Replacement Pattern**

```typescript
// ❌ WRONG: This pattern causes bugs
onMutate: async (variables) => {
    const tempId = `temp-${Date.now()}`; // RED FLAG!
    queryClient.setQueryData(['items'], (old) => ({
        items: [...old, { _id: tempId, ...variables }]
    }));
    return { tempId };
},
onSuccess: (newItem, _vars, context) => {
    // ❌ Replacing temp ID with server ID - NON-COMPLIANT
    queryClient.setQueryData(['items'], (old) => ({
        items: old?.items?.map(item => 
            item._id === context?.tempId ? newItem : item
        )
    }));
},
```

#### 3.4.5: Server ID Utilities Check

For optimistic creates with client IDs, verify server uses ID utilities:

```bash
# Check server handlers for proper ID handling
grep -r "toDocumentId\|toQueryId\|toStringId" src/server --include="*.ts"
grep -r "toDocumentId\|toQueryId\|toStringId" src/apis --include="*.ts"

# Find potential violations (direct ObjectId usage with client IDs)
grep -r "new ObjectId\|\.toHexString" src/apis --include="*.ts"
```

| Check | Status |
|-------|--------|
| Server uses `toDocumentId(clientId)` for inserts | |
| Server uses `toQueryId(clientId)` for queries | |
| Server uses `toStringId(doc._id)` for responses | |
| No direct `new ObjectId(clientId)` calls | |
| No direct `.toHexString()` calls on potentially-UUID IDs | |

#### 3.4.6: Offline Mode Guards

For any `onSuccess` that handles data (non-optimistic creates):

```typescript
// ⚠️ CRITICAL: Guard against empty {} from offline queue
onSuccess: (newItem) => {
    if (!newItem || !newItem._id) return; // Guard for offline
    queryClient.setQueryData(['items'], (old) => ({
        items: [...(old?.items || []), newItem]
    }));
},
```

| Check | Status |
|-------|--------|
| All `onSuccess` with data handling guard against empty/undefined | |
| `if (!data) return` or `if (!data?._id) return` present | |

#### 3.4.7: UX Compliance for Optimistic Operations

Per docs: "If an operation is optimistic, ALL UI should feel instant"

```typescript
// ❌ WRONG: Dialog shows loading for optimistic operation
const handleConfirmDelete = async () => {
    setIsDeleting(true);  // Shows loading spinner
    await deleteMutation.mutateAsync({ id });
    setIsDeleting(false);
    closeDialog();  // Dialog closes AFTER server responds
};

// ✅ CORRECT: Dialog closes immediately
const handleConfirmDelete = () => {
    closeDialog();  // Close immediately
    deleteMutation.mutate({ id });  // Optimistic update runs
};
```

| Check | Status |
|-------|--------|
| Confirmation dialogs close immediately for optimistic ops | |
| No loading spinners shown for optimistic edits/deletes | |
| Only non-optimistic creates show loading states | |

---

### 3.5: Zustand Stores Audit (CRITICAL)

📚 **Reference**: [docs/zustand-stores.md](../../docs/zustand-stores.md)

All Zustand stores MUST use the `createStore` factory. Direct zustand imports are BLOCKED by ESLint.

#### 3.5.1: Find ALL Stores

```bash
# Find all store files
find src/client -name "store.ts" -o -name "*Store.ts"

# Find any direct zustand imports (VIOLATIONS)
grep -r "from 'zustand'\|from \"zustand\"" src/client --include="*.ts" --include="*.tsx"

# Find createStore usage
grep -r "createStore" src/client --include="*.ts"
```

#### 3.5.2: Per-Store Checklist

For EACH store file found:

| Store | Location | Type | Uses createStore | Config Complete | Status |
|-------|----------|------|------------------|-----------------|--------|
| useAuthStore | features/auth/store.ts | Persisted | ✓/✗ | ✓/✗ | |
| useSettingsStore | features/settings/store.ts | Persisted | ✓/✗ | ✓/✗ | |
| useRouteStore | features/router/store.ts | Persisted | ✓/✗ | ✓/✗ | |
| useSessionLogStore | features/session-logs/store.ts | In-Memory | ✓/✗ | ✓/✗ | |

#### 3.5.3: Persisted Store Requirements

```typescript
// ✅ REQUIRED: Persisted store pattern
import { createStore } from '@/client/stores';

export const useMyStore = createStore<MyState>({
    key: 'my-storage',           // ✓ Required: unique localStorage key
    label: 'My Store',           // ✓ Required: human-readable label
    creator: (set) => ({         // ✓ Required: state creator function
        value: 'default',
        setValue: (v) => set({ value: v }),
    }),
    persistOptions: {            // ✓ Required for persisted stores
        partialize: (state) => ({ value: state.value }),
    },
});
```

| Check | Status |
|-------|--------|
| Has `key` property (unique string) | |
| Has `label` property (human-readable) | |
| Has `creator` function | |
| Has `persistOptions` object | |
| `persistOptions.partialize` excludes runtime-only state | |

#### 3.5.4: In-Memory Store Requirements

```typescript
// ✅ REQUIRED: In-memory store pattern
import { createStore } from '@/client/stores';

export const useModalStore = createStore<ModalState>({
    key: 'modal',                // ✓ Required: unique identifier
    label: 'Modal',              // ✓ Required: human-readable label
    inMemoryOnly: true,          // ✓ Required: explicit opt-out of persistence
    creator: (set) => ({
        isOpen: false,
        open: () => set({ isOpen: true }),
        close: () => set({ isOpen: false }),
    }),
});
```

| Check | Status |
|-------|--------|
| Has `key` property | |
| Has `label` property | |
| Has `inMemoryOnly: true` | |
| Does NOT have `persistOptions` | |

#### 3.5.5: TTL Validation (For Stores with Expiring Data)

```typescript
// ✅ REQUIRED: TTL validation pattern
import { createStore } from '@/client/stores';
import { createTTLValidator, STORE_DEFAULTS } from '@/client/config';

const isValid = createTTLValidator(STORE_DEFAULTS.TTL);

export const useMyStore = createStore<MyState>({
    key: 'my-storage',
    label: 'My Store',
    creator: (set) => ({
        data: null,
        timestamp: null,
        setData: (data) => set({ data, timestamp: Date.now() }),
    }),
    persistOptions: {
        partialize: (state) => ({
            data: state.data,
            timestamp: state.timestamp,
        }),
        onRehydrateStorage: () => (state) => {
            // ✓ Clear expired data on app startup
            if (state && !isValid(state.timestamp)) {
                state.data = null;
                state.timestamp = null;
            }
        },
    },
});
```

| Check | Status |
|-------|--------|
| Uses `createTTLValidator` from `@/client/config` | |
| Has `onRehydrateStorage` that checks TTL | |
| Clears expired data on rehydration | |

#### 3.5.6: Hydration Timing (BootGate)

Verify the app waits for store hydration before rendering:

```bash
# Check for BootGate in _app.tsx
grep -A10 "BootGate\|useAllPersistedStoresHydrated" src/pages/_app.tsx
```

| Check | Status |
|-------|--------|
| `_app.tsx` uses `BootGate` or `useAllPersistedStoresHydrated` | |
| App components render AFTER hydration completes | |
| No components read store values before BootGate | |

#### 3.5.7: Store Export Pattern

Each feature should export via `index.ts`:

```typescript
// features/myFeature/index.ts
export { useMyStore } from './store';
export type { MyState } from './types';
```

| Check | Status |
|-------|--------|
| Store exported via feature `index.ts` | |
| Feature exported from `features/index.ts` | |
| Components import from `@/client/features/{name}` (not internal files) | |

#### 3.5.8: Common Violations

```bash
# Find violations
grep -r "import.*from 'zustand'" src/client --include="*.ts" --include="*.tsx"
grep -r "import.*from \"zustand\"" src/client --include="*.ts" --include="*.tsx"
```

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Direct zustand import | `grep "from 'zustand'"` | Use `createStore` from `@/client/stores` |
| Missing `persistOptions` | Manual review | Add `persistOptions` or `inMemoryOnly: true` |
| Missing TTL validation | Check stores with timestamps | Add `createTTLValidator` + `onRehydrateStorage` |
| Store not in registry | Call `printAllStores()` | Ensure store module is imported |

---

### 3.6: State Management Patterns Audit

📚 **Reference**: [docs/state-management.md](../../docs/state-management.md)

#### 3.6.1: State Decision Matrix Compliance

Verify each piece of state uses the correct solution:

| State Type | Required Solution | How to Check |
|------------|-------------------|--------------|
| API data (todos, users) | React Query | Should use `useQuery`/`useMutation` |
| User preferences | Zustand (persisted) | Should be in `features/settings/store.ts` |
| Auth hints | Zustand (persisted) | Should be in `features/auth/store.ts` |
| Route persistence | Zustand (persisted) | Should be in `features/router/store.ts` |
| Form inputs | useState | Local to component |
| Modal/dialog state | useState | Local to component |

```bash
# Find useState usage - should be ephemeral UI only
grep -r "useState" src/client/routes --include="*.tsx" | head -20

# Find potential violations (useState for server data)
grep -r "useState.*\[\]" src/client --include="*.tsx" -B2 -A2
```

#### 3.6.2: Query Hook Pattern Compliance

```typescript
// ✅ REQUIRED: Query hook pattern
import { useQuery } from '@tanstack/react-query';
import { useQueryDefaults } from '@/client/query';

export function useItems() {
    const queryDefaults = useQueryDefaults(); // ✓ Centralized config
    
    return useQuery({
        queryKey: ['items'] as const,        // ✓ Exported query key
        queryFn: async () => {
            const response = await getItems({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        ...queryDefaults,                    // ✓ Apply defaults
    });
}
```

| Check | Status |
|-------|--------|
| Uses `useQueryDefaults()` from `@/client/query` | |
| Query key exported as const | |
| Error handling in queryFn | |
| No hardcoded `staleTime`/`gcTime` | |

#### 3.6.3: Centralized Config Usage

```bash
# Check for hardcoded cache values (VIOLATIONS)
grep -r "staleTime:\|gcTime:\|cacheTime:" src/client --include="*.ts" --include="*.tsx"

# Should use centralized config
grep -r "QUERY_DEFAULTS\|STORE_DEFAULTS\|TIME\." src/client --include="*.ts"
```

| Check | Status |
|-------|--------|
| No hardcoded `staleTime` values | |
| No hardcoded `gcTime` values | |
| Uses `QUERY_DEFAULTS` from `@/client/config` | |
| Uses `STORE_DEFAULTS` for TTL values | |
| Uses `TIME.*` constants for durations | |

#### 3.6.4: Loading State Pattern (CRITICAL)

**The most common bug**: Showing empty state before data loads.

```typescript
// ❌ WRONG: Shows "No items" during loading!
function MyComponent() {
    const { data } = useItems();
    const items = data?.items || [];
    
    if (items.length === 0) return <EmptyState />; // BUG!
    return <ItemsList items={items} />;
}

// ✅ CORRECT: Check loading AND data existence
function MyComponent() {
    const { data, isLoading, error } = useItems();
    const items = data?.items || [];

    // Check states in order: Loading → Error → Empty → Data
    if (isLoading || data === undefined) return <Skeleton />;
    if (error) return <ErrorState />;
    if (items.length === 0) return <EmptyState />;
    return <ItemsList items={items} />;
}
```

| Check | Status |
|-------|--------|
| All components check `isLoading` first | |
| All components check `data === undefined` for loading | |
| Empty state only shown when `data` is defined AND empty | |
| Error state checked before empty state | |

```bash
# Find potential violations
grep -r "\.length === 0" src/client/routes --include="*.tsx" -B5 -A2
```

---

### 3.7: Offline PWA Support Audit

📚 **Reference**: [docs/offline-pwa-support.md](../../docs/offline-pwa-support.md)

#### 3.7.1: Auth Preflight Offline Handling

```bash
# Verify preflight handles offline
grep -A20 "navigator.onLine" src/client/features/auth/preflight.ts
```

| Check | Status |
|-------|--------|
| `preflight.ts` checks `navigator.onLine` | |
| Returns `{ skippedOffline: true }` when offline | |
| Does NOT make network request when offline | |
| `useAuthValidation` handles `skippedOffline` flag | |
| Does NOT clear hints when offline | |

#### 3.7.2: Optimistic-Only UI Pattern

See Section 3.4 (Mutation Audit) - this is the same pattern.

Key rule: **NEVER update UI from server responses on success.**

#### 3.7.3: POST Queue Handling

```bash
# Verify POST queue implementation
grep -r "offlinePostQueue\|flushOfflineQueue" src/client --include="*.ts"
```

| Check | Status |
|-------|--------|
| `apiClient.post` queues when offline | |
| Returns `{ data: {} }` immediately (not error) | |
| Queue flushes when online | |
| Batch sync endpoint exists (`/api/process/batch-updates`) | |

#### 3.7.4: Offline Banner

```bash
# Verify offline banner in TopNavBar
grep -r "effectiveOffline\|Offline mode" src/client/components/layout --include="*.tsx"
```

| Check | Status |
|-------|--------|
| Offline banner exists in TopNavBar | |
| Reacts to both manual mode and device offline | |
| Shows clear user feedback | |

#### 3.7.5: Batch Sync Alert

```bash
# Verify batch sync feature
ls -la src/client/features/offline-sync/
```

| Check | Status |
|-------|--------|
| `offline-sync` feature exists | |
| Has `store.ts`, `hooks.ts`, `BatchSyncAlert.tsx` | |
| `useOfflineSyncInitializer` called in `_app.tsx` | |
| `BatchSyncAlert` rendered in app | |

#### 3.7.6: Service Worker Configuration

```bash
# Check next.config.ts for PWA config
grep -A30 "withPWA" next.config.ts
```

| Check | Status |
|-------|--------|
| Uses `next-pwa` | |
| Disabled in development | |
| Has `reloadOnOnline: false` (prevents iOS reload bug) | |
| Runtime caching configured | |

#### 3.7.7: localStorage Persistence

```bash
# Verify React Query uses localStorage (not IndexedDB)
grep -r "createLocalStoragePersister\|localStorage" src/client/query --include="*.ts"
```

| Check | Status |
|-------|--------|
| React Query uses localStorage persister | |
| Persister is module-level singleton | |
| Storage key is `react-query-cache-v2` | |

---

### 3.8: Theming Audit

📚 **Reference**: [.cursor/rules/theming-guidelines.mdc](../../.cursor/rules/theming-guidelines.mdc)

Search for hardcoded colors:

```bash
# Find hardcoded colors (these are violations)
grep -r "bg-white\|bg-black\|bg-gray-\|bg-slate-\|bg-zinc-\|bg-blue-\|bg-red-\|bg-green-" src/client --include="*.tsx"
grep -r "text-white\|text-black\|text-gray-\|text-slate-" src/client --include="*.tsx"
grep -r "border-gray-\|border-slate-" src/client --include="*.tsx"
```

| Check | Status |
|-------|--------|
| No `bg-white` or `bg-black` | |
| No `bg-gray-*` or `bg-slate-*` | |
| No `text-white` or `text-black` | |
| No `text-gray-*` or `text-slate-*` | |
| No `border-gray-*` | |
| Uses `bg-background`, `bg-card`, etc. | |
| Uses `text-foreground`, `text-muted-foreground`, etc. | |

---

### 3.9: TypeScript Audit

📚 **Reference**: [.cursor/rules/typescript-guidelines.mdc](../../.cursor/rules/typescript-guidelines.mdc)

```bash
# Find any usage
grep -r ": any\|as any\|<any>" src --include="*.ts" --include="*.tsx"

# Run TypeScript check
yarn tsc --noEmit
```

| Check | Status |
|-------|--------|
| No `: any` types | |
| No `as any` casts | |
| No TypeScript errors | |
| Proper type narrowing used | |
| Prefer unions over enums | |
| Types close to where they're used | |

---

### 3.10: MongoDB Audit

For EACH collection:

#### 3.7.1: File Structure

| Check | Status |
|-------|--------|
| Collection in `server/database/collections/` | |
| Has `types.ts` | |
| Has `<collection>.ts` | |

#### 3.7.2: ID Handling

```typescript
// ✅ CORRECT: Use ID utilities
import { toStringId, toQueryId, toDocumentId } from '@/server/utils';

// ❌ WRONG: Direct ObjectId methods
doc._id.toHexString()  // Breaks on UUID strings
new ObjectId(clientId) // Breaks on UUID strings
```

| Check | Status |
|-------|--------|
| Uses `toStringId()` for responses | |
| Uses `toQueryId()` for queries | |
| Uses `toDocumentId()` for inserts | |
| No direct `.toHexString()` calls | |
| No `new ObjectId(clientId)` without validation | |

#### 3.7.3: API Layer Separation

| Check | Status |
|-------|--------|
| No `mongodb` imports in `src/apis/` | |
| No `getDb()` calls in `src/apis/` | |
| API handlers import from `@/server/database` | |

---

### 3.11: shadcn/ui Audit

📚 **Reference**: [.cursor/rules/shadcn-usage.mdc](../../.cursor/rules/shadcn-usage.mdc)

```bash
# Find non-shadcn imports (violations)
grep -r "from '@mui\|from 'antd\|from '@chakra" src/client --include="*.tsx"
grep -r "from '@ant-design" src/client --include="*.tsx"

# Verify shadcn imports
grep -r "@/client/components/ui" src/client/routes --include="*.tsx" | head -10
```

| Check | Status |
|-------|--------|
| No Material-UI imports | |
| No Ant Design imports | |
| No Chakra UI imports | |
| All UI from `@/client/components/ui/*` | |
| Icons from `lucide-react` only | |
| Uses semantic color tokens | |
| Uses Button variants (not custom styles) | |
| Controlled components (`open`, `value`, `checked`) | |

---

### 3.12: React Components Audit

📚 **References**:
- [app-guildelines/React-components-guidelines.md](../../app-guildelines/React-components-guidelines.md)
- [.cursor/rules/react-component-organization.mdc](../../.cursor/rules/react-component-organization.mdc)
- [.cursor/rules/react-hook-organization.mdc](../../.cursor/rules/react-hook-organization.mdc)
- [.cursor/rules/feature-based-structure.mdc](../../.cursor/rules/feature-based-structure.mdc)

#### 3.12.1: Component Organization Principles

```bash
# Find large components (potential violations)
find src/client -name "*.tsx" -exec wc -l {} \; | sort -rn | head -20

# Find components with useState for server data (VIOLATION)
grep -r "useState.*\[\]" src/client/routes --include="*.tsx" -B2 -A2

# Find components with useEffect for data fetching (VIOLATION)
grep -r "useEffect.*fetch\|useEffect.*api" src/client --include="*.tsx"
```

| Check | Status |
|-------|--------|
| Components under 150 lines (200 max) | |
| Single responsibility per component | |
| Separation of logic (hooks) and UI (components) | |
| No useState for server data (use React Query) | |
| No useEffect for data fetching (use React Query) | |

#### 3.12.2: File Structure Per Route

Each route should follow this structure:

```
src/client/routes/[ROUTE_NAME]/
├── [ROUTE_NAME].tsx     # Main route component 
├── index.ts             # Exports the route
├── hooks.ts             # React Query hooks (queries + mutations)
├── components/          # UI components specific to this route (optional)
│   ├── Header.tsx
│   ├── ContentSection.tsx 
│   └── ListItem.tsx     
└── types.ts             # Shared types (if needed beyond API types)
```

| Check | Status |
|-------|--------|
| Main component in `[ROUTE_NAME].tsx` | |
| Exports in `index.ts` | |
| Hooks in `hooks.ts` (single file, not folder) | |
| Route-specific components in `components/` | |
| Types in `types.ts` (if needed) | |

#### 3.12.3: Feature-Based Structure

Features should contain ALL related code:

```
src/client/features/[FEATURE]/
├── store.ts          # Zustand store (uses createStore)
├── hooks.ts          # React Query hooks + custom hooks
├── types.ts          # Feature-specific types
├── [Component].tsx   # Feature components
└── index.ts          # Public API exports
```

```bash
# Verify feature structure
ls -la src/client/features/*/

# Check for scattered feature code (VIOLATIONS)
# - Stores outside features/
find src/client -name "store.ts" | grep -v "features/"
# - Hooks outside features/ and routes/
find src/client -name "hooks.ts" | grep -v "features\|routes"
```

| Check | Status |
|-------|--------|
| Features have `index.ts` with exports | |
| Stores are in `features/*/store.ts` | |
| Feature hooks are in `features/*/hooks.ts` | |
| Feature components are in feature folder (not `components/`) | |
| Features exported from `features/index.ts` | |

#### 3.12.4: Shared Components Location

Only truly reusable UI primitives go in `components/`:

```
src/client/components/
├── ui/              # shadcn primitives (Button, Card, Input)
└── layout/          # App shell (TopNavBar, Layout)
```

| Check | Status |
|-------|--------|
| Only UI primitives in `components/ui/` | |
| Only layout components in `components/layout/` | |
| NO feature-specific components in `components/` | |
| Feature components are in `features/[name]/` | |

#### 3.12.5: Data Fetching Pattern (CRITICAL)

**All data fetching MUST use React Query hooks, NOT useState + useEffect.**

```typescript
// ✅ CORRECT: React Query hook
function useTodos() {
    const queryDefaults = useQueryDefaults();
    return useQuery({
        queryKey: ['todos'],
        queryFn: async () => {
            const response = await getTodos({});
            if (response.data?.error) throw new Error(response.data.error);
            return response.data;
        },
        ...queryDefaults,
    });
}

// ❌ WRONG: useState + useEffect
const [todos, setTodos] = useState([]);
useEffect(() => {
    getTodos({}).then(res => setTodos(res.data?.todos || []));
}, []);
```

| Check | Status |
|-------|--------|
| Uses `useQuery` for data fetching | |
| Uses `useMutation` for mutations | |
| No `useState([])` for server data | |
| No `useEffect` for data fetching | |
| Uses `useQueryDefaults()` hook | |
| Query keys exported as constants | |

#### 3.12.6: Loading State Pattern (CRITICAL UX)

**⚠️ NEVER show empty states while data is loading.** This is the most common UX bug.

```typescript
// ❌ WRONG: Shows "No items" during loading!
function ItemsList() {
    const { data } = useItems();
    const items = data?.items || [];
    
    if (items.length === 0) return <EmptyState />; // BUG!
    return <ItemList items={items} />;
}

// ✅ CORRECT: Check states in order - Loading → Error → Empty → Data
function ItemsList() {
    const { data, isLoading, error } = useItems();
    const items = data?.items || [];

    if (isLoading) return <LoadingSpinner />;     // 1. Loading
    if (error) return <ErrorMessage error={error} />; // 2. Error
    if (!data) return <p>Unable to load</p>;      // 3. No data
    if (items.length === 0) return <EmptyState />; // 4. Empty (AFTER data check!)
    return <ItemList items={items} />;            // 5. Data
}
```

```bash
# Find potential violations (empty check without loading check)
grep -r "\.length === 0" src/client/routes --include="*.tsx" -B5 -A2

# Find components missing isLoading check
grep -r "useQuery\|useItems\|useTodos" src/client/routes --include="*.tsx" -A10 | grep -v "isLoading"
```

| Check | Status |
|-------|--------|
| Checks `isLoading` FIRST | |
| Checks `error` SECOND | |
| Checks `!data` THIRD | |
| Checks `items.length === 0` LAST (after data exists) | |
| Uses skeleton loaders (not spinners) | |
| No empty state shown during loading | |

#### 3.12.7: Background Refresh Indicator

When showing cached data with background refresh, use `isFetching`:

```typescript
function ItemsList() {
    const { data, isLoading, isFetching } = useItems();
    
    if (isLoading || data === undefined) return <Skeleton />;
    
    return (
        <div>
            {/* Subtle refresh indicator while showing cached data */}
            {isFetching && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Updating...
                </div>
            )}
            <ItemList items={data.items} />
        </div>
    );
}
```

| Check | Status |
|-------|--------|
| Uses `isFetching` for background refresh indicator | |
| Shows cached data immediately (not full loading screen) | |
| Subtle refresh indicator (not blocking spinner) | |

#### 3.12.8: Mobile-First Design

All components MUST be mobile-first and mobile-friendly.

```bash
# Check for responsive classes
grep -r "sm:\|md:\|lg:\|xl:" src/client/routes --include="*.tsx" | head -10

# Find potential fixed-width violations
grep -r "w-\[.*px\]\|width:.*px" src/client --include="*.tsx"
```

| Check | Status |
|-------|--------|
| Uses responsive Tailwind classes (`sm:`, `md:`, `lg:`) | |
| Mobile layout works without horizontal scroll | |
| Touch-friendly tap targets (min 44px) | |
| No fixed pixel widths that break on mobile | |
| Uses `Sheet` for mobile navigation (not `Dialog`) | |

#### 3.12.9: Component Composition

Build UI through composition:

1. **Base Components**: `src/client/components/ui/` (shadcn primitives)
2. **Compound Components**: Combinations in feature/route folders
3. **Section Components**: Logical sections of a page
4. **Page Components**: Compose sections into complete pages

```typescript
// ✅ CORRECT: Composition pattern
const TodosPage = () => {
    const { data, isLoading, error } = useTodos();
    
    if (isLoading) return <TodosPageSkeleton />;
    if (error) return <PageError error={error} />;
    
    return (
        <PageLayout>
            <TodosHeader count={data?.todos?.length || 0} />
            <TodosFilters />
            <TodosList todos={data?.todos || []} />
        </PageLayout>
    );
};

// ❌ WRONG: Monolithic component with all logic inline
const TodosPage = () => {
    // 500+ lines of mixed logic and JSX
};
```

| Check | Status |
|-------|--------|
| Page components compose smaller components | |
| Components under 150 lines | |
| Logic extracted to hooks | |
| Section components for logical UI areas | |

#### 3.12.10: Component File Size Guidelines

| Size | Guideline |
|------|-----------|
| < 150 lines | ✅ Ideal |
| 150-200 lines | ⚠️ Consider splitting |
| > 200 lines | ❌ Must split |
| hooks.ts | Can be up to 300 lines (multiple hooks) |

```bash
# Find components exceeding size limits
find src/client/routes -name "*.tsx" -exec wc -l {} \; | awk '$1 > 200 { print }'
find src/client/features -name "*.tsx" -exec wc -l {} \; | awk '$1 > 200 { print }'
```

| Check | Status |
|-------|--------|
| No component files > 200 lines | |
| Large components split into smaller ones | |
| Main page composes, doesn't implement | |

---

## Phase 4: Cross-Cutting Concerns

### 4.1: Import Pattern Compliance

| Pattern | Expected | Status |
|---------|----------|--------|
| Feature imports | `@/client/features/{name}` (not internal files) | |
| Store factory | `@/client/stores` (not `zustand` directly) | |
| UI components | `@/client/components/ui/*` | |
| API types | `@/apis/{name}/types` | |

### 4.2: Server/Client Separation

| Check | Status |
|-------|--------|
| No server imports in client code | |
| No client imports in server code | |
| No `mongodb` imports outside database layer | |

### 4.3: Offline Mode Handling

| Check | Status |
|-------|--------|
| Mutations handle empty `{}` response | |
| `onSuccess` guards against undefined data | |
| Optimistic updates work offline | |

---

## Phase 5: Documentation Sync

### 5.1: Check Docs Match Implementation

For each documentation file, verify:

| Doc | Topic | Matches Code | Notes |
|-----|-------|--------------|-------|
| architecture.md | Overall structure | ✓/✗ | |
| authentication.md | Auth flow | ✓/✗ | |
| state-management.md | State patterns | ✓/✗ | |
| react-query-mutations.md | Mutation patterns | ✓/✗ | |
| zustand-stores.md | Store factory | ✓/✗ | |
| api-endpoint-format.md | API structure | ✓/✗ | |
| offline-pwa-support.md | Offline handling | ✓/✗ | |
| caching-strategy.md | Cache config | ✓/✗ | |

### 5.2: Identify Gaps

- [ ] Features documented but not implemented
- [ ] Features implemented but not documented
- [ ] Contradictions between docs and rules
- [ ] Outdated information

---

## Phase 6: Summary & Approval

### 6.1: Compile All Findings

**Action**: Create a comprehensive summary of all findings.

```markdown
## Audit Summary

### ✅ Compliant Areas (X total)
| Area | Details |
|------|---------|
| auth API | Proper structure, correct patterns |
| ... | ... |

### ⚠️ Minor Issues (X total)
| Area | Issue | Severity | Fix |
|------|-------|----------|-----|
| Todos route | Missing empty state | Low | Add EmptyState component |
| ... | ... | ... | ... |

### ❌ Non-Compliant Areas (X total)
| Area | Issue | Severity | Fix Required |
|------|-------|----------|--------------|
| useCreateTodo | Uses temp ID pattern | High | Convert to non-optimistic |
| ProfileCard | Hardcoded colors | Medium | Use semantic tokens |
| ... | ... | ... | ... |

### 📝 Documentation Updates Needed
| Doc | Update Needed |
|-----|---------------|
| state-management.md | Add new settings store example |
| ... | ... |

### 📊 Overall Compliance Score
- APIs: X/Y compliant (XX%)
- Features: X/Y compliant (XX%)
- Routes: X/Y compliant (XX%)
- Mutations: X/Y compliant (XX%)
- Theming: X/Y compliant (XX%)
- TypeScript: X/Y compliant (XX%)
- MongoDB: X/Y compliant (XX%)
```

### 6.2: Propose Fixes

For each non-compliant area, provide:

```markdown
## Fix: [Area Name]

**File**: `path/to/file.ts`
**Issue**: [Description]
**Severity**: High/Medium/Low

### Current Code (Non-Compliant):
```typescript
// Show problematic code
```

### Proposed Fix:
```typescript
// Show corrected code
```

### Impact:
- [ ] Code change only
- [ ] UX change (describe)
- [ ] Requires testing
```

### 6.3: Get User Approval

**Action**: Present all findings and wait for explicit approval.

```markdown
## Summary of Proposed Changes

### Code Changes (no UX impact):
1. [file] - [change description]
2. ...

### UX-Affecting Changes:
1. [file] - [change description]
   - Before: [behavior]
   - After: [behavior]
2. ...

### Documentation Updates:
1. [doc] - [update description]
2. ...

---

**Please review and reply:**
- **"Approve all"** - Proceed with all changes
- **"Approve except [X]"** - Skip specific changes
- **"Questions about [X]"** - I'll explain further
- **"Show me the code for [X]"** - I'll show the specific implementation
```

**⛔ DO NOT PROCEED without explicit user approval.**

---

## Phase 7: Implementation

### 7.1: Make Approved Changes

After approval, implement changes systematically:

1. Fix one area at a time
2. Run `yarn checks` after each area
3. Update documentation if needed
4. Track progress in TODO list

### 7.2: Final Verification

```bash
# Run all checks
yarn checks

# This runs:
# - TypeScript compilation
# - ESLint
```

**The audit is NOT complete until `yarn checks` passes with 0 errors.**

### 7.3: 🚨 Verify ALL TODOs Completed

**Before finishing the audit, verify ALL TODOs are marked as `completed` or `cancelled`.**

Use the TODO list to confirm:
- [ ] All discovered APIs audited
- [ ] All discovered features audited
- [ ] All discovered routes audited
- [ ] **ALL discovered mutations audited** (most critical)
- [ ] All discovered stores audited
- [ ] All cross-cutting concerns checked
- [ ] Summary created and user approved changes
- [ ] All approved fixes implemented

**⛔ The audit is NOT complete if any TODOs remain `pending` or `in_progress`.**

### 7.4: Test Critical Flows

List flows that should be manually tested:

```markdown
## Please Verify These Flows

### Mutations:
- [ ] Edit flows feel instant (optimistic)
- [ ] Delete flows feel instant (optimistic)
- [ ] Create flows show appropriate loading state
- [ ] Offline mode queues mutations

### Routes:
- [ ] Loading states show correctly
- [ ] Error states show correctly
- [ ] Empty states only show when truly empty

### Theming:
- [ ] Test with light mode
- [ ] Test with dark mode
- [ ] Test with different theme presets
```

---

## Master Checklist

Complete ALL items before finishing the audit:

### Phase 1: Documentation Review (REQUIRED FIRST)
- [ ] Read CLAUDE.md
- [ ] Read docs/architecture.md
- [ ] Read **docs/state-management.md** (CRITICAL)
- [ ] Read **docs/react-query-mutations.md** (CRITICAL)
- [ ] Read **docs/zustand-stores.md** (CRITICAL)
- [ ] Read **docs/offline-pwa-support.md** (CRITICAL)
- [ ] Read docs/authentication.md
- [ ] Read docs/caching-strategy.md
- [ ] Read all .cursor/rules/*.mdc files

### Phase 2: Discovery
- [ ] Listed all API domains
- [ ] Listed all features
- [ ] Listed all routes
- [ ] Found ALL mutations (`grep -r "useMutation"`)
- [ ] Found ALL stores (`find -name "store.ts"`)
- [ ] Listed all database collections
- [ ] Created comprehensive TODO list

### Phase 3: API Audit
- [ ] Audited EVERY API domain
- [ ] Checked file structure (index.ts, types.ts, server.ts, client.ts)
- [ ] Checked index.ts patterns (names only, no functions)
- [ ] Checked types.ts (no duplicates elsewhere)
- [ ] Checked server.ts patterns (`export * from './index'`)
- [ ] Checked client.ts patterns (imports from `./index`)
- [ ] Verified registration in apis.ts

### Phase 4: React Query Mutations Audit (CRITICAL - docs/react-query-mutations.md)
- [ ] Found and classified EVERY mutation (edit/delete/create)
- [ ] **Edit/Delete mutations**: Verified optimistic-only pattern
  - [ ] Has `onMutate` with optimistic update
  - [ ] Has `onError` with rollback
  - [ ] `onSuccess` is empty
  - [ ] `onSettled` is empty
  - [ ] No `invalidateQueries` on same data
  - [ ] No `setQueryData` with server response in `onSuccess`
- [ ] **Create mutations**: Verified correct pattern
  - [ ] Client-generated ID (optimistic) OR server ID (show loading)
  - [ ] NO temp ID replacement patterns (`temp-${Date.now()}`)
  - [ ] If server ID: guards against empty `{}` in `onSuccess`
- [ ] Server handlers use ID utilities (`toDocumentId`, `toQueryId`, `toStringId`)
- [ ] UX: Dialogs close immediately for optimistic ops (no loading spinners)

### Phase 5: Zustand Stores Audit (CRITICAL - docs/zustand-stores.md)
- [ ] All stores use `createStore` from `@/client/stores`
- [ ] NO direct zustand imports anywhere in `src/client`
- [ ] **Persisted stores** have:
  - [ ] `key` property
  - [ ] `label` property
  - [ ] `creator` function
  - [ ] `persistOptions` object
- [ ] **In-memory stores** have:
  - [ ] `key` property
  - [ ] `label` property
  - [ ] `inMemoryOnly: true`
- [ ] Stores with TTL use `createTTLValidator` + `onRehydrateStorage`
- [ ] `_app.tsx` uses `BootGate` or `useAllPersistedStoresHydrated`

### Phase 6: State Management Patterns (CRITICAL - docs/state-management.md)
- [ ] React Query used for ALL API data
- [ ] Zustand used for ALL persistent client state
- [ ] useState used ONLY for ephemeral UI state
- [ ] Query hooks use `useQueryDefaults()` (no hardcoded cache times)
- [ ] No hardcoded `staleTime`/`gcTime` values
- [ ] **Loading state pattern**: `if (isLoading || data === undefined)` BEFORE empty check
- [ ] No components show empty state during loading

### Phase 7: Offline PWA Support (CRITICAL - docs/offline-pwa-support.md)
- [ ] Auth preflight handles offline (`skippedOffline` flag)
- [ ] Hints NOT cleared when offline
- [ ] POST queue returns `{}` (not error) when offline
- [ ] All `onSuccess` handlers guard against empty data
- [ ] Offline banner exists in TopNavBar
- [ ] Batch sync alert feature exists and initialized
- [ ] Service worker has `reloadOnOnline: false`
- [ ] React Query uses localStorage (not IndexedDB)

### Phase 8: Feature Audit
- [ ] Audited EVERY feature folder
- [ ] Each feature has `index.ts` with public exports
- [ ] Features exported from `features/index.ts`
- [ ] Components import from `@/client/features/{name}` (not internal files)

### Phase 9: Route Audit
- [ ] Audited EVERY route
- [ ] Routes registered in `routes/index.ts`
- [ ] Loading state pattern correct (Loading → Error → Empty → Data)
- [ ] Components under 200 lines (split if larger)
- [ ] Uses React Query hooks (not direct API calls)

### Phase 10: Theming Audit
- [ ] No hardcoded colors (`bg-white`, `bg-gray-*`, etc.)
- [ ] All colors use semantic tokens (`bg-background`, `text-foreground`, etc.)
- [ ] Tested in light AND dark mode

### Phase 11: TypeScript Audit
- [ ] No `: any` types
- [ ] No `as any` casts
- [ ] `yarn tsc --noEmit` passes

### Phase 12: MongoDB Audit
- [ ] All collections in `server/database/collections/`
- [ ] Uses ID utilities (not direct ObjectId methods)
- [ ] No `mongodb` imports in `src/apis/`

### Phase 13: React Components Audit (CRITICAL)
- [ ] **Component Organization**
  - [ ] Components under 150 lines (200 max)
  - [ ] Single responsibility per component
  - [ ] Logic extracted to hooks, not in components
- [ ] **File Structure**
  - [ ] Route-specific code in `routes/[ROUTE_NAME]/`
  - [ ] Feature code in `features/[FEATURE_NAME]/`
  - [ ] Only shared primitives in `components/ui/`
- [ ] **Data Fetching (CRITICAL)**
  - [ ] Uses `useQuery` for data fetching (not useState + useEffect)
  - [ ] Uses `useMutation` for mutations
  - [ ] Uses `useQueryDefaults()` for query config
  - [ ] Query keys exported as constants
- [ ] **Loading State Pattern (CRITICAL UX)**
  - [ ] Checks `isLoading` FIRST
  - [ ] Checks `error` SECOND
  - [ ] Checks `!data` THIRD
  - [ ] Checks `items.length === 0` LAST (after data exists)
  - [ ] No empty state shown during loading
  - [ ] Uses skeleton loaders (not spinners)
- [ ] **Background Refresh**
  - [ ] Uses `isFetching` for refresh indicator
  - [ ] Shows cached data immediately
  - [ ] Subtle refresh indicator (not blocking)
- [ ] **Mobile-First**
  - [ ] Uses responsive Tailwind classes
  - [ ] Touch-friendly tap targets
  - [ ] No fixed pixel widths breaking mobile

### Phase 14: shadcn/ui Audit
- [ ] No other UI library imports (MUI, Ant Design, Chakra)
- [ ] All UI from `@/client/components/ui/*`
- [ ] Icons from `lucide-react` only

### Phase 15: Cross-Cutting Concerns
- [ ] Import patterns correct (features, stores, UI)
- [ ] Server/client separation maintained
- [ ] No circular dependencies

### Phase 16: Documentation Sync
- [ ] Docs match implementation
- [ ] No contradictions found OR documented
- [ ] No gaps found OR documented

### Phase 17: Summary & Approval
- [ ] Created comprehensive summary table
- [ ] Proposed all fixes with code examples
- [ ] Got **explicit user approval**
- [ ] Did NOT proceed without approval

### Phase 18: Implementation
- [ ] Made all approved changes
- [ ] `yarn checks` passes with 0 errors
- [ ] Listed specific flows for user to test
- [ ] User confirmed all flows work

---

## Quick Reference: Common Violations

### 🚨 CRITICAL Violations (docs/react-query-mutations.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Temp ID replacement | `grep -r "temp-\|tempId\|\`temp"` | Use client-generated UUID or non-optimistic |
| setQueryData in onSuccess | Check `onSuccess` handlers | Remove - use optimistic-only |
| invalidateQueries in mutation | `grep -r "invalidateQueries" -B5 -A5` | Remove (except separate aggregation queries) |
| Non-empty onSettled | Check mutation hooks | Make empty: `onSettled: () => {}` |
| Missing offline guard | Check non-optimistic creates | Add `if (!data) return` in onSuccess |
| Loading spinner on optimistic op | Check confirmation dialogs | Close immediately, no loading |

### 🚨 CRITICAL Violations (docs/zustand-stores.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Direct zustand import | `grep -r "from 'zustand'"` | Use `createStore` from `@/client/stores` |
| Missing persistOptions | Review store configs | Add `persistOptions` or `inMemoryOnly: true` |
| Missing TTL validation | Check stores with timestamps | Add `createTTLValidator` + `onRehydrateStorage` |
| No BootGate | Check `_app.tsx` | Add `useAllPersistedStoresHydrated` |

### 🚨 CRITICAL Violations (docs/state-management.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| useState for server data | `grep -r "useState.*\[\]"` | Use React Query |
| Hardcoded staleTime/gcTime | `grep -r "staleTime:\|gcTime:"` | Use `useQueryDefaults()` |
| Wrong loading check | `grep -r "\.length === 0" -B5` | Check `isLoading \|\| data === undefined` first |
| Empty state before data | Review route components | Fix state check order |

### 🚨 CRITICAL Violations (docs/offline-pwa-support.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Auth clears hints offline | Check `preflight.ts` | Handle `skippedOffline` flag |
| Missing offline guard | Check `onSuccess` handlers | Add `if (!data) return` |
| IndexedDB for React Query | Check `QueryProvider.tsx` | Use localStorage persister |
| Missing reloadOnOnline: false | Check `next.config.ts` | Add to PWA config |

### 🚨 CRITICAL Violations (React Components)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| useState for server data | `grep -r "useState.*\[\]"` | Use React Query hooks |
| useEffect for fetching | `grep -r "useEffect.*fetch"` | Use React Query hooks |
| Empty state during loading | `grep -r "\.length === 0" -B5` | Check `isLoading \|\| !data` first |
| Missing loading state | Check route components | Add `if (isLoading) return <Skeleton />` |
| Component > 200 lines | `find -name "*.tsx" -exec wc -l {}` | Split into smaller components |
| Feature code in components/ | Check `src/client/components/` | Move to `features/[name]/` |
| No isFetching indicator | Check list components | Add subtle refresh indicator |
| Fixed pixel widths | `grep -r "w-\[.*px\]"` | Use responsive Tailwind classes |

### Other Violations

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Hardcoded colors | `grep -r "bg-white\|bg-gray-"` | Use semantic tokens |
| `any` type | `grep -r ": any\|as any"` | Use proper types |
| Direct ObjectId | `grep -r "toHexString\|new ObjectId"` | Use ID utilities |
| Wrong API import | Check client.ts imports | Import from `./index`, not `./server` |
| Non-shadcn components | `grep -r "from '@mui"` | Use shadcn from `@/client/components/ui` |
| mongodb in APIs | `grep -r "from 'mongodb'" src/apis` | Import from `@/server/database` |

---

## Notes

### TODO Tracking (Essential)
- **Create TODO list FIRST** using `todo_write` before any audit work
- **Expand TODOs after discovery** with specific items for each API, feature, route, mutation
- **Update TODOs throughout** - mark items as `completed` as you finish them
- **Verify all TODOs complete** before finishing the audit
- **The audit is incomplete** if any TODOs remain `pending`

### General Guidelines
- This audit is comprehensive and may take significant time
- Always collect all findings before proposing fixes
- Get explicit approval before making any changes
- Run `yarn checks` after every change
- Document any new patterns discovered for future reference

### If Interrupted
- The TODO list allows you to resume the audit
- Check which TODOs are still `pending` to see where to continue
- Don't restart from the beginning - pick up from the last incomplete TODO
