# Full Project Audit (Report Only)

This command performs a comprehensive audit of the entire project against all documentation and rules. It systematically reviews every feature, route, API, and component to ensure compliance with established guidelines.

**⚠️ OUTPUT: This command produces a detailed AUDIT REPORT with all violations and a fix plan. It does NOT make any code changes.**

## 📁 Report Output Location

**The audit report MUST be saved to a file:**

```
audits/audit-YYYY-MM-DD.md
```

**Example**: `audits/audit-2026-01-03.md`

This single file contains both the audit findings AND the progress tracker with checkboxes that can be marked as done during implementation.

If the `audits/` folder doesn't exist, create it.

📚 **Primary References**:
- [CLAUDE.md](mdc:../../CLAUDE.md) - Project guidelines summary
- [app-guidelines-checklist.md](mdc:../../app-guildelines/app-guidelines-checklist.md) - Quick checklist
- [docs/architecture.md](mdc:../../docs/architecture.md) - Architecture overview

---

## Audit Scope Selection

Before starting the audit, determine the scope. The user may have specified a scope when invoking the command (e.g. `/full-project-audit project only`). If not, ask the user which scope to audit:

| Scope | What to scan | What to skip |
|-------|-------------|--------------|
| **Project only** | `*/project/**`, `*.project.ts`, `src/pages/` | All `*/template/**` and `*.template.ts` paths |
| **Template only** | `*/template/**`, `*.template.ts`, `src/pages/` | All `*/project/**` and `*.project.ts` paths |
| **Project + Template** | Everything in `src/` | Nothing |

The ownership model is defined in `docs/template/project-structure-guidelines.md`. In short:
- **Template-owned**: `src/client/features/template/`, `src/client/routes/template/`, `src/client/components/template/`, `src/apis/template/`, `src/server/database/collections/template/`, `*.template.ts`
- **Project-owned**: `src/client/features/project/`, `src/client/routes/project/`, `src/client/components/project/`, `src/apis/project/`, `src/server/database/collections/project/`, `*.project.ts`
- **Shared infrastructure** (`src/pages/`, `src/server/template/utils/`, `src/client/utils/`, `src/client/stores/`, `src/client/query/`) is included in all scopes.

When searching, filter results to only include files within the selected scope.

---

## ⚠️ CRITICAL: Read This First

This is a **comprehensive audit report**. Before starting, understand:

1. **This will take time** - You'll review every file in the project systematically
2. **Create a TODO list FIRST** - Track your progress through each audit area
3. **Collect ALL findings** - Document every violation, issue, and recommendation
4. **DO NOT FIX ANYTHING** - This audit produces a report only, no code changes
5. **Output a comprehensive report** - The final deliverable is a detailed audit summary with a fix plan

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
10. [pending] Phase 3.14: Audit Error Handling Patterns
11. [pending] Phase 4: Check Cross-Cutting Concerns
12. [pending] Phase 5: Check Documentation Sync
13. [pending] Phase 6: Generate Final Audit Report
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
    │ - All docs/template/project-guidelines/*.md files
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
    │ - 3.14: Error Handling Patterns
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
Phase 6: Generate Final Audit Report
    │ - Compile ALL violations found
    │ - Categorize by severity and area
    │ - Create detailed fix plan with tasks
    │ - Output comprehensive report
    │ - ⛔ DO NOT MAKE ANY CODE CHANGES
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
7. `docs/template/project-structure-guidelines.md` - Template/project subfolder structure
8. `docs/authentication.md` - Auth flow details
9. `docs/caching-strategy.md` - Caching architecture
10. `docs/template/error-handling.md` - Error handling patterns

#### Rules Files
10. `docs/template/project-guidelines/client-server-communications.md` - API structure
11. `docs/template/project-guidelines/feature-based-structure.md` - Code organization
12. `docs/template/project-guidelines/react-component-organization.md` - Component patterns
13. `docs/template/project-guidelines/react-hook-organization.md` - Hook patterns
14. `docs/template/project-guidelines/state-management-guidelines.md` - State decisions
15. `docs/template/project-guidelines/pages-and-routing-guidelines.md` - Routing patterns
16. `docs/template/project-guidelines/shadcn-usage.md` - UI components
17. `docs/template/project-guidelines/theming-guidelines.md` - Theming requirements
18. `docs/template/project-guidelines/typescript-guidelines.md` - TypeScript standards
19. `docs/template/project-guidelines/mongodb-usage.md` - Database patterns
20. `docs/template/project-guidelines/ai-models-api-usage.md` - AI integration (if applicable)
21. `docs/template/project-guidelines/user-access.md` - Auth patterns

#### Supporting Documentation
22. `docs/api-endpoint-format.md` - API format details
23. `docs/admin.md` - Admin system
24. `app-guildelines/React-components-guidelines.md` - Component patterns & loading states

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
| **Error Handling** | `ErrorDisplay` for pages, `errorToast`/`errorToastAuto` for mutations, never raw `error.message` |

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

#### 3.1.7: Acceptable API Structure Variations

Not all APIs follow the standard structure. These variations are **acceptable when documented**:

##### Variation A: No `client.ts` (Local-First Sync APIs)

**When acceptable:**
- API is a batch sync endpoint for local-first architecture
- Client uses Zustand store as source of truth (localStorage)
- Sync module calls API directly via `apiClient.post` (not React Query hooks)
- No individual CRUD operations exposed to UI components

**Example use case:** `plan-data` API where:
- User edits are stored locally first
- Changes are debounced and synced to server in batches
- UI reads from Zustand store, not from React Query cache

**Required documentation:** Add comment in `index.ts`:
```typescript
/**
 * ARCHITECTURE NOTE: This API intentionally has NO client.ts file.
 *
 * This is a local-first sync API, not a typical CRUD API:
 * - Client uses Zustand store as source of truth (localStorage)
 * - Sync module calls the API directly via apiClient.post
 * - No React Query hooks needed - store handles all state
 *
 * @see src/client/features/[feature]/sync.ts for client usage
 */
```

**When NOT acceptable:**
- API has multiple operations that UI components call directly
- Standard CRUD API with React Query hooks
- Missing `client.ts` is just an oversight

##### Variation B: No `handlers/` Folder (Single-Operation APIs)

**When acceptable:**
- API has only ONE operation
- Handler logic is < 150 lines
- All logic contained in `server.ts`

**Example use case:** `workout-warmup` API with single `generateWarmup` operation

**Required documentation:** Add comment in `index.ts`:
```typescript
/**
 * ARCHITECTURE NOTE: This API has NO handlers/ folder - handlers are
 * inlined in server.ts.
 *
 * This is acceptable for single-operation APIs:
 * - Only one endpoint: [operation name]
 * - All logic contained in ~XX lines
 * - No need for separate handler files
 *
 * For multi-operation APIs, use the handlers/ folder pattern instead.
 */
```

**When NOT acceptable:**
- API has 2+ operations (use `handlers/` folder)
- Handler logic exceeds 150 lines
- Complex logic that would benefit from separation

##### How to Audit These Variations

When you encounter an API missing `client.ts` or `handlers/`:

1. **Check for documentation comment** in `index.ts`
2. **Verify the use case matches** the acceptable pattern
3. **If documented and matches**: Mark as **Compliant** with note
4. **If undocumented**: Flag as issue - needs documentation or refactoring

| Variation | Has Comment | Use Case Matches | Verdict |
|-----------|-------------|------------------|---------|
| No client.ts | ✓ | ✓ (local-first sync) | Compliant |
| No client.ts | ✗ | - | Needs documentation |
| No client.ts | ✓ | ✗ (should have hooks) | Non-compliant |
| No handlers/ | ✓ | ✓ (single-op, <150 lines) | Compliant |
| No handlers/ | ✗ | - | Needs documentation |
| No handlers/ | ✓ | ✗ (multi-op or >150 lines) | Non-compliant |

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

#### ⚠️ 3.4.0: The #1 Mistake - Confusing Temp IDs with Client-Generated Stable IDs

Before auditing, understand this critical distinction:

| Pattern | Example | Compliant? |
|---------|---------|------------|
| **Temp ID that gets replaced** | `_id: \`temp-${Date.now()}\`` then replaced with server ID in `onSuccess` | ❌ **NO** |
| **Client-generated stable ID** | `_id: nanoid()` or `_id: crypto.randomUUID()` that server persists as-is | ✅ **YES** (if server accepts it) |

**How to tell the difference:**
- Look at `onSuccess` - does it replace the temp ID with a server-returned ID? → **Non-compliant**
- Look at the server handler - does it use the client-provided ID or generate its own? → Check API code

**DO NOT mark a mutation as "Compliant" if it uses temp IDs, even if onSuccess is empty.** The temp ID pattern itself is the problem.

#### Core Rules Summary

1. **Edits / Deletes → Optimistic-only**
   - Update cache in `onMutate`
   - Rollback on `onError`
   - `onSuccess`: No STATE updates from server response (UI side effects like toasts are OK)
   - `onSettled`: No invalidateQueries on the same data (UI side effects are OK)

2. **Creates → Decision required**
   - **Optimistic create** ONLY if client generates stable ID that server persists
   - **Non-optimistic create** (show loader) if server generates ID
   - **NEVER use temp-ID → server-ID replacement flows**

3. **Allowed in onSuccess (not violations):**
   - `queryClient.removeQueries()` - cleaning up stale single-item cache after delete
   - Inserting server-returned entity for non-optimistic creates
   - Zustand store updates (not React Query cache)

#### 3.4.1: Find ALL Mutations

```bash
# Find all useMutation usage
grep -r "useMutation" src/client --include="*.ts" --include="*.tsx" -l

# Find all mutation hook definitions  
grep -r "function use.*Create\|function use.*Update\|function use.*Delete\|function use.*Add\|function use.*Remove" src/client --include="*.ts" --include="*.tsx"

# Find temp ID patterns (RED FLAGS)
grep -r "temp-\|temp_\|tempId\|`temp\|temporary" src/client --include="*.ts" --include="*.tsx"

# Find Date.now() or Math.random() in ID generation (RED FLAGS)
grep -r "Date.now()\|Math.random()" src/client --include="*.ts" --include="*.tsx" -B2 -A2

# Find invalidateQueries in mutations (RED FLAG unless separate aggregation query)
grep -r "invalidateQueries" src/client --include="*.ts" --include="*.tsx" -B5 -A5

# Find setQueryData in onSuccess (RED FLAG)
grep -r "onSuccess.*setQueryData\|setQueryData.*onSuccess" src/client --include="*.ts" --include="*.tsx"
```

**Expected locations**:
- `src/client/routes/*/hooks.ts` - Route-specific mutations
- `src/client/features/*/hooks.ts` - Feature mutations
- Any other `.ts`/`.tsx` files with `useMutation` (check components too!)

#### 3.4.2: Classification Table

Create a table of ALL mutations:

| Hook | Type | File | Pattern | Status |
|------|------|------|---------|--------|
| useUpdateTodo | Edit | routes/Todos/hooks.ts | Optimistic-only | ✓/✗ |
| useDeleteTodo | Delete | routes/Todos/hooks.ts | Optimistic-only | ✓/✗ |
| useCreateTodo | Create | routes/Todos/hooks.ts | Non-optimistic OR Client ID | ✓/✗ |

#### 3.4.3: Edit/Delete Mutations - Optimistic-Only Pattern

> **🚨 IMPORTANT: What is NOT a violation:**
> - `toast.success()` or `toast.error()` in `onSuccess`/`onError` → **ALLOWED** (UI feedback)
> - `logger.info()` or analytics calls → **ALLOWED** (side effects)
> - Navigation (`navigate()`) → **ALLOWED** (side effects)
>
> **Only these are violations:**
> - `queryClient.setQueryData()` with server response data
> - `queryClient.invalidateQueries()` on the same data
> - Any state update derived from server response

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
    
    // STEP 3: No STATE updates from server response (UI side effects like toasts are OK)
    onSuccess: () => {
        // toast.success('Deleted'); // ✅ OK - UI feedback
        // logger.info('deleted');   // ✅ OK - logging
    },

    // STEP 4: No invalidateQueries on same data (UI side effects are OK)
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
| `onSuccess` has no STATE updates from server response | |
| `onSettled` has no invalidateQueries on same data | |
| Does NOT use `invalidateQueries` on same data | |
| Does NOT use `setQueryData` with server response | |

> **Note on UI Side Effects**: Toasts (`toast.success()`), logging, analytics, and navigation in `onSuccess`/`onError` are **NOT violations**. Only STATE updates from server responses violate the optimistic-only pattern.

**Allowed exception**: `invalidateQueries` on a SEPARATE aggregation query (e.g., `['activity-summary']` after modifying `['activities']`).

#### 3.4.4: Create Mutations - Decision Required

**⚠️ CRITICAL**: For EVERY create mutation, you MUST perform detailed analysis. Do NOT skip this step.

##### Per-Mutation Analysis Template (REQUIRED for each create)

For each create mutation, answer these questions by reading the **server handler code**:

```markdown
### [Hook Name] (e.g., useCreatePlan)

| Question | Answer |
|----------|--------|
| **Can server accept client ID?** | [Yes / No → requires API change] |
| **Server computes critical fields?** | [List fields and whether client can compute them] |
| **Global validation required?** | [Uniqueness checks? Rate limits? Quota?] |
| **Multiple caches affected?** | [Which query keys need updating?] |

**Analysis**: [Explain your reasoning]

**Verdict**: [Optimistic (client ID) / Non-optimistic (show loader)]
**Reason**: [One sentence justification]
```

##### Example: Thorough Create Analysis

```markdown
### useCreatePlan

| Question | Answer |
|----------|--------|
| **Can server accept client ID?** | No → **Simple change** (add optional `_id` to request) |
| **Server computes critical fields?** | `isActive` = first plan check. **Client CAN compute** (checks if plans list is empty) |
| **Global validation required?** | No uniqueness constraints |
| **Multiple caches affected?** | Only `['plans']` query |

**Analysis**: The server generates a MongoDB ObjectId, but this can be changed to accept a client ID. The only computed field (`isActive`) can be derived from the cached plans list length.

**Verdict**: Optimistic (client ID)
**Reason**: Simple entity with client-computable `isActive` field
```

```markdown
### useCreateExercise

| Question | Answer |
|----------|--------|
| **Can server accept client ID?** | No → **Simple change** |
| **Server computes critical fields?** | **`imageUrl` from blob storage upload** - client cannot predict final URL |
| **Global validation required?** | No |
| **Multiple caches affected?** | `['exercises']` and `['exercise', id]` |

**Analysis**: When user provides `imageBase64`, server uploads to blob storage and returns a generated URL (e.g., `https://blob.vercel-storage.com/...`). Client cannot predict this URL. With optimistic-only pattern, we can't update from server response, so the image URL would never appear.

**Verdict**: Non-optimistic (show loader)
**Reason**: Blob upload produces server-derived `imageUrl` that client cannot predict
```

##### Decision Flowchart (Apply to Each Create)

```
Can client generate the ID?
├── NO (server uses MongoDB ObjectId, etc.)
│   ├── Can API be changed to accept client ID? 
│   │   ├── YES → Continue evaluation
│   │   └── NO → Non-optimistic
│   └── Continue ↓
└── YES → Continue ↓

Does server compute critical DISPLAY fields?
├── YES (image URLs, computed totals, assigned numbers)
│   └── Non-optimistic (can't show correct data without server)
└── NO / Client can compute from cache → Continue ↓

Does validation require server/global state?
├── YES (uniqueness, rate limits, quotas)
│   └── Non-optimistic (might be rejected)
└── NO → Continue ↓

Multiple caches need coordinated updates?
├── YES (complex)
│   └── Probably non-optimistic (or carefully consider)
└── NO → ✅ Safe for optimistic create
```

##### Summary Table (After All Creates Analyzed)

Present a summary categorizing all creates:

```markdown
## Create Mutation Analysis Summary

| # | Hook | Verdict | Key Reason |
|---|------|---------|------------|
| 1 | useCreatePlan | **Optimistic** | Simple entity, `isActive` from cache |
| 2 | useCreateWorkout | **Optimistic** | Order computable from cache |
| 3 | useCreateExercise | **Non-optimistic** | Blob upload = server-derived imageUrl |
| 4 | useCreateOrder | **Non-optimistic** | Server computes totals, discounts |

### Prerequisites for Optimistic Creates

For the X mutations marked "Optimistic (client ID)", these API changes are required:

1. **Server must accept client-provided ID** - Add optional `_id` field to request type
2. **Server must use that ID** - Don't let MongoDB auto-generate
3. **Idempotency** - Handle duplicate IDs gracefully (return existing, don't error)
```

##### Quick Decision Table

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
    onSuccess: () => {
        // toast.success('Created'); // ✅ OK - UI feedback only
    },
    onSettled: () => {},
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

#### 3.4.8: Common Mistakes to Avoid (Mutation Audit)

When auditing mutations, watch out for these specific mistakes:

##### ❌ Mistake 1: Marking temp-ID creates as "Compliant"

**Wrong**: "useCreatePlan - Optimistic with temp ID ✓"
**Why wrong**: If it uses temp IDs, it's non-compliant regardless of other factors.
**Correct**: Mark as non-compliant, explain temp ID violation.

##### ❌ Mistake 2: Confusing `removeQueries` with `setQueryData`

**Wrong**: Marking `onSuccess: () => queryClient.removeQueries(...)` as violation
**Why wrong**: Removing stale cache entries is cleanup, not updating from server.
**Correct**: This is fine after deletes.

##### ❌ Mistake 3: Not explaining UX impact for create changes

**Wrong**: "useCreateTodo needs to be non-optimistic" (no explanation)
**Why wrong**: User needs to understand the tradeoff.
**Correct**: Use the full UX impact template (see below).

##### ❌ Mistake 4: Saying "optimistic with temp ID" without checking replacement

**Wrong**: Assuming temp ID is fine if onSuccess looks simple
**Check**: Does ANY code path replace temp ID with server ID? Check onSuccess, onError, onSettled.

##### ❌ Mistake 5: Missing mutations in components

**Wrong**: Only checking `hooks.ts` files
**Correct**: Also grep for `useMutation` in `.tsx` files (inline mutations).

#### 3.4.9: UX Impact Template (For Non-Compliant Creates)

For any CREATE mutation that is non-compliant, document the UX impact:

```markdown
## UX Change Required: [Hook Name]

**File**: [path/to/file.ts]
**Current behavior**: [Describe what happens now]
**Proposed behavior**: [Describe the change]

### Why the current implementation is problematic:

☐ **Temp ID replacement**: The code uses `temp-${Date.now()}` or similar, then replaces 
   with server ID in onSuccess. This is complex, error-prone, and causes subtle bugs 
   when users act faster than the server responds.

☐ **Server generates the ID**: The entity ID is a MongoDB ObjectId generated server-side.
   The client cannot know this ID ahead of time.

☐ **Server computes critical fields**: The server calculates [specific fields] which 
   the client cannot predict.

### Recommended fix:

**Option A (Recommended): Non-optimistic with inline loading**
- Remove `onMutate` (no optimistic insert)
- In `onSuccess`: insert the server-returned entity
- In component: disable button + show spinner while `isPending`
- UX impact: User sees ~0.5-1s delay, but no visual glitches

**Option B: True optimistic with client-generated ID**
- Requires API change: server must accept and persist client-provided ID
- Client generates UUID/nanoid before mutation
- No replacement needed - same ID used everywhere
- UX impact: Instant feedback, but requires backend changes

### My recommendation: Option [A/B]

[Explain why this option is best for this specific case]
```

#### 3.4.10: Mutation Audit Checklist

Complete this for EACH mutation before moving to section 3.5:

| Check | Status |
|-------|--------|
| Classified as edit/delete/create/other | |
| For creates: completed per-mutation analysis template | |
| For creates: determined verdict with reasoning | |
| For edits/deletes: verified optimistic-only pattern | |
| For edits/deletes: checked for server response handling | |
| For edits/deletes: checked for invalidateQueries calls | |
| Marked as compliant/non-compliant/needs-discussion | |
| Searched both `.ts` AND `.tsx` files | |

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

📚 **Reference**: [docs/template/project-guidelines/theming-guidelines.md](../../docs/template/project-guidelines/theming-guidelines.md)

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

📚 **Reference**: [docs/template/project-guidelines/typescript-guidelines.md](../../docs/template/project-guidelines/typescript-guidelines.md)

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

#### 3.10.1: File Structure

| Check | Status |
|-------|--------|
| Collection in `server/database/collections/` | |
| Has `types.ts` | |
| Has `<collection>.ts` | |

#### 3.10.2: ID Handling

```typescript
// ✅ CORRECT: Use ID utilities
import { toStringId, toQueryId, toDocumentId } from '@/server/template/utils';

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

#### 3.10.3: API Layer Separation

| Check | Status |
|-------|--------|
| No `mongodb` imports in `src/apis/` | |
| No `getDb()` calls in `src/apis/` | |
| API handlers import from `@/server/template/database` | |

---

### 3.11: shadcn/ui Audit

📚 **Reference**: [docs/template/project-guidelines/shadcn-usage.md](../../docs/template/project-guidelines/shadcn-usage.md)

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
- [docs/template/project-guidelines/react-component-organization.md](../../docs/template/project-guidelines/react-component-organization.md)
- [docs/template/project-guidelines/react-hook-organization.md](../../docs/template/project-guidelines/react-hook-organization.md)
- [docs/template/project-guidelines/feature-based-structure.md](../../docs/template/project-guidelines/feature-based-structure.md)

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

### 3.13: Project Structure Audit

📚 **Reference**: [docs/template/project-structure-guidelines.md](../../docs/template/project-structure-guidelines.md)

The project uses a **template/project subfolder pattern** to separate synced template code from project-specific code. This enables template updates without conflicts.

#### 3.13.1: Features Structure

```bash
# Verify template/project subfolder structure
ls -la src/client/features/
ls -la src/client/features/template/
ls -la src/client/features/project/

# Find features NOT in template/ or project/ (VIOLATIONS)
find src/client/features -maxdepth 1 -type d | grep -v -E "template|project|^src/client/features$"

# Check three-file pattern exists
ls src/client/features/index.ts src/client/features/index.template.ts src/client/features/index.project.ts
```

| Check | Status |
|-------|--------|
| `features/template/` exists with template features | |
| `features/project/` exists (even if empty with .gitkeep) | |
| No feature folders at `features/` root level | |
| `index.ts` exists (combiner) | |
| `index.template.ts` exists (template exports) | |
| `index.project.ts` exists (project exports) | |

#### 3.13.2: Routes Structure

```bash
# Verify template/project subfolder structure
ls -la src/client/routes/
ls -la src/client/routes/template/
ls -la src/client/routes/project/

# Find routes NOT in template/ or project/ (VIOLATIONS)
find src/client/routes -maxdepth 1 -type d | grep -v -E "template|project|^src/client/routes$"

# Check three-file pattern exists
ls src/client/routes/index.ts src/client/routes/index.template.ts src/client/routes/index.project.ts
```

| Check | Status |
|-------|--------|
| `routes/template/` exists with template routes | |
| `routes/project/` exists with project routes | |
| No route folders at `routes/` root level | |
| `index.ts` exists (combiner) | |
| `index.template.ts` exists (template exports) | |
| `index.project.ts` exists (project exports) | |

#### 3.13.3: Components Structure

```bash
# Verify template/project subfolder structure
ls -la src/client/components/
ls -la src/client/components/template/
ls -la src/client/components/project/

# Check NavLinks three-file pattern
ls src/client/components/NavLinks.tsx
ls src/client/components/template/NavLinks.template.tsx
ls src/client/components/project/NavLinks.project.tsx

# Check GlobalDialogs pattern
ls src/client/components/GlobalDialogs.tsx
ls src/client/components/template/GlobalDialogs.template.tsx
```

| Check | Status |
|-------|--------|
| `components/template/` exists (ui/, layout/, etc.) | |
| `components/project/` exists | |
| `NavLinks.tsx` exists (combiner) | |
| `NavLinks.template.tsx` exists in template/ | |
| `NavLinks.project.tsx` exists in project/ | |
| `GlobalDialogs.tsx` exists (combiner) | |

#### 3.13.4: Circular Import Prevention (CRITICAL)

**Internal feature-to-feature imports MUST use direct paths, NOT the barrel file.**

```bash
# Find barrel imports within features (VIOLATIONS - cause circular deps)
grep -r "from '@/client/features'" src/client/features/template/ --include="*.ts" --include="*.tsx"

# These should use direct imports like:
# import { useRouter } from '../router';
# import { useIsAdmin } from '../auth/store';
# NOT: import { useRouter } from '@/client/features';
```

| Check | Status |
|-------|--------|
| No `from '@/client/features'` imports inside `features/template/` | |
| Internal feature imports use relative paths (`../router`, `../auth/store`) | |
| Circular dependency check passes (`yarn check:circular`) | |

#### 3.13.5: Template Sync Configuration

```bash
# Verify template paths are configured
cat .template-sync.template.json | grep -A5 "templatePaths"

# Check for required template paths
grep "src/client/features/template" .template-sync.template.json
grep "src/client/routes/template" .template-sync.template.json
grep "src/client/components/template" .template-sync.template.json
```

| Check | Status |
|-------|--------|
| `.template-sync.template.json` exists | |
| `src/client/features/template/**` in templatePaths | |
| `src/client/features/index.ts` in templatePaths | |
| `src/client/features/index.template.ts` in templatePaths | |
| `src/client/routes/template/**` in templatePaths | |
| `src/client/routes/index.ts` in templatePaths | |
| `src/client/routes/index.template.ts` in templatePaths | |
| `src/client/components/template/**` in templatePaths | |
| `src/client/components/NavLinks.tsx` in templatePaths | |

#### 3.13.6: Project Overrides Check

```bash
# Check if any template files are in projectOverrides (should be minimal)
cat .template-sync.json 2>/dev/null | grep -A20 "projectOverrides" || echo "No overrides file"
```

| Check | Status |
|-------|--------|
| `projectOverrides` only contains intentionally modified files | |
| No template files modified without being in `projectOverrides` | |

---

### 3.14: Error Handling Audit

📚 **Reference**: [docs/template/error-handling.md](../../docs/template/error-handling.md)

All error handling flows through shared utilities in `src/client/features/template/error-tracking/`. This audit verifies correct usage of `ErrorDisplay`, `errorToast`/`errorToastAuto`, and shared `errorUtils`.

#### 3.14.1: Find All Error Display Patterns

```bash
# Find all route/page error states
grep -r "error)" src/client/routes --include="*.tsx" -B2 -A5

# Find ErrorDisplay usage (CORRECT)
grep -r "ErrorDisplay" src/client --include="*.tsx" -l

# Find custom error rendering (POTENTIAL VIOLATIONS)
grep -r "error\.message" src/client/routes --include="*.tsx"
grep -r "error\.message" src/client/features --include="*.tsx"

# Find error state rendering without ErrorDisplay
grep -r "if.*error.*return" src/client/routes --include="*.tsx" -A3
```

**Expected**: All route/page-level error states should use `<ErrorDisplay>`:

```typescript
// ✅ CORRECT: Use ErrorDisplay for route/page errors
if (error) {
    return (
        <ErrorDisplay
            error={error}
            title="Failed to load items"
            onRetry={() => refetch()}
        />
    );
}

// ❌ WRONG: Custom inline error rendering
if (error) {
    return <p className="text-red-500">{error.message}</p>;
}

// ❌ WRONG: Showing raw error.message
if (error) {
    return <div>{error.message}</div>;
}
```

**Per-route checklist:**

| Route | Has Error State | Uses ErrorDisplay | Shows Raw Message | Status |
|-------|----------------|-------------------|-------------------|--------|
| [Route 1] | ✓/✗ | ✓/✗ | ✓/✗ | |
| [Route 2] | ✓/✗ | ✓/✗ | ✓/✗ | |

#### 3.14.2: Mutation Error Handling (onError Callbacks)

```bash
# Find all onError handlers in mutations
grep -r "onError" src/client --include="*.ts" --include="*.tsx" -A3

# Find errorToast usage (CORRECT for system errors)
grep -r "errorToast\|errorToastAuto" src/client --include="*.ts" --include="*.tsx" -l

# Find plain toast.error for system errors (POTENTIAL VIOLATIONS)
grep -r "toast\.error" src/client --include="*.ts" --include="*.tsx" -B3 -A1

# Find catch blocks that don't use errorToast
grep -r "catch.*{" src/client --include="*.ts" --include="*.tsx" -A5
```

**Expected patterns:**

```typescript
// ✅ CORRECT: errorToast with specific message + error object
onError: (err) => {
    errorToast('Failed to save changes', err);
},

// ✅ CORRECT: errorToastAuto for automatic classification
catch (error) {
    errorToastAuto(error, 'Failed to submit report.');
}

// ✅ CORRECT: plain toast.error for VALIDATION errors (no Error object)
if (!title.trim()) {
    toast.error('Please enter a title');
    return;
}

// ❌ WRONG: plain toast.error for system/mutation errors (no copy action)
onError: () => {
    toast.error('Failed to delete item');
},

// ❌ WRONG: showing raw error message
onError: (err) => {
    toast.error(err.message);
},

// ❌ WRONG: swallowing errors silently
onError: () => {
    // nothing
},
```

**Key distinction**: `toast.error()` is fine for **validation** (no Error object). For **system/mutation errors**, always use `errorToast(message, error)` or `errorToastAuto(error)` so users get the "Copy Error" action button.

**Per-mutation checklist:**

| Mutation | Has onError | Uses errorToast/errorToastAuto | Passes Error Object | Status |
|----------|-------------|-------------------------------|---------------------|--------|
| [Mutation 1] | ✓/✗ | ✓/✗ | ✓/✗ | |
| [Mutation 2] | ✓/✗ | ✓/✗ | ✓/✗ | |

#### 3.14.3: No Raw Error Messages to Users

```bash
# Find direct error.message usage in UI (VIOLATIONS)
grep -r "error\.message" src/client/routes --include="*.tsx"
grep -r "error\.message" src/client/features --include="*.tsx" --include="*.ts"
grep -r "err\.message" src/client --include="*.tsx"

# Find cleanErrorMessage usage (CORRECT)
grep -r "cleanErrorMessage\|getUserFriendlyMessage" src/client --include="*.ts" --include="*.tsx" -l
```

**Rule**: Never show `error.message` directly to users. Always use `cleanErrorMessage()` or `getUserFriendlyMessage()`. Raw messages often contain API paths, stack traces, or technical jargon.

```typescript
// ❌ WRONG: Raw error message
<p>{error.message}</p>

// ✅ CORRECT: Use utility
import { getUserFriendlyMessage } from '@/client/features/template/error-tracking';
<p>{getUserFriendlyMessage(error)}</p>
```

| Check | Status |
|-------|--------|
| No `error.message` rendered directly in JSX | |
| No `err.message` passed to toast without cleaning | |
| Uses `cleanErrorMessage()` or `getUserFriendlyMessage()` | |

#### 3.14.4: ErrorBoundary Coverage

```bash
# Check ErrorBoundary usage
grep -r "ErrorBoundary" src/client --include="*.tsx" -l
grep -r "ErrorBoundary" src/pages --include="*.tsx" -l

# Verify _app.tsx wraps with ErrorBoundary
grep -A5 "ErrorBoundary" src/pages/_app.tsx
```

| Check | Status |
|-------|--------|
| `ErrorBoundary` wraps app in `_app.tsx` | |
| `ErrorBoundary` uses `ErrorDisplay` internally | |
| Critical route sections have error boundaries | |

#### 3.14.5: Admin-Only Stack Traces

The `ErrorDisplay` component should gate stack trace visibility using `useIsAdmin()`.

```bash
# Verify ErrorDisplay checks admin status
grep -A10 "useIsAdmin\|isAdmin" src/client/features/template/error-tracking/ErrorDisplay.tsx

# Check formatErrorForCopy respects admin
grep -A10 "formatErrorForCopy\|isAdmin" src/client/features/template/error-tracking/errorUtils.ts
```

| Check | Status |
|-------|--------|
| `ErrorDisplay` uses `useIsAdmin()` for stack trace visibility | |
| "Copy Error" button gives full details to admins only | |
| Non-admin users see cleaned error message only | |
| No stack traces leaked to non-admin UI anywhere | |

#### 3.14.6: Error Imports (Circular Dependency Prevention)

```bash
# Find imports from error-tracking barrel inside bug-report or auth (VIOLATIONS)
grep -r "from.*error-tracking'" src/client/features/template/bug-report --include="*.ts" --include="*.tsx"
grep -r "from.*error-tracking'" src/client/features/template/auth --include="*.ts" --include="*.tsx"

# These should import from specific files instead:
# ✅ from '../error-tracking/errorToast'
# ✅ from '../error-tracking/errorUtils'
# ❌ from '../error-tracking' (barrel - causes circular dep)
```

| Check | Status |
|-------|--------|
| `bug-report` does NOT import from `'../error-tracking'` barrel | |
| `auth` does NOT import from `'../error-tracking'` barrel | |
| Uses direct file imports (`../error-tracking/errorToast`) | |

#### 3.14.7: Error Handling Summary Table

Create a summary of all error handling patterns found:

| Location | Error Type | Pattern Used | Correct Pattern | Status |
|----------|-----------|--------------|-----------------|--------|
| Route: [name] | Query error | `ErrorDisplay` / Custom | `ErrorDisplay` | ✓/✗ |
| Mutation: [name] | Mutation error | `errorToast` / `toast.error` | `errorToast` | ✓/✗ |
| Component: [name] | Inline error | raw message / cleaned | `getUserFriendlyMessage` | ✓/✗ |

#### 3.14.8: Common Error Handling Violations

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Custom error rendering in routes | Check `if (error) return` in routes | Use `<ErrorDisplay>` component |
| `toast.error()` for mutation failures | Check `onError` callbacks | Use `errorToast(message, err)` |
| Raw `error.message` in UI | `grep -r "error\.message"` in tsx | Use `getUserFriendlyMessage()` |
| Missing error object in toast | Check `errorToast` calls | Always pass error as second arg |
| Swallowed errors (empty catch) | Check `catch` blocks | Add `errorToastAuto(error)` |
| Barrel import in bug-report/auth | Check import paths | Use direct file imports |
| Stack traces visible to non-admins | Check error rendering | Use `ErrorDisplay` (handles admin gate) |

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

## Phase 6: Generate Final Audit Report

**⚠️ CRITICAL: This is the final output. DO NOT make any code changes.**

### 6.1: Create Output File

**Action**: Create the audit report file in the `audits/` folder:

```
audits/audit-YYYY-MM-DD.md
```

This file contains:
- Full audit findings and violations
- Fix implementation plan with phases
- **Progress tracker with checkboxes** that can be marked `[x]` during implementation

**If the `audits/` folder doesn't exist, create it first.**

### 6.2: Compile All Findings

**Action**: Create a comprehensive audit report with ALL findings from the audit phases.

The final report MUST include these sections:

---

## 📋 AUDIT REPORT TEMPLATE

Use this template to generate the final audit report:

```markdown
# Project Audit Report

**Generated**: [YYYY-MM-DD]
**Project**: [Project Name]
**Status**: 🔴 Not Started | 🟡 In Progress | 🟢 Complete

---

## Progress Overview

| Category | Total Tasks | Completed | Remaining |
|----------|-------------|-----------|-----------|
| 🚨 Critical | X | 0 | X |
| ⚠️ High | X | 0 | X |
| 📝 Medium | X | 0 | X |
| 💡 Low | X | 0 | X |
| **Total** | **X** | **0** | **X** |

**Overall Progress**: 0%

---

## Executive Summary

| Category | Total Items | Compliant | Violations | Compliance % |
|----------|-------------|-----------|------------|--------------|
| APIs | X | X | X | XX% |
| Features | X | X | X | XX% |
| Routes | X | X | X | XX% |
| Mutations | X | X | X | XX% |
| Stores | X | X | X | XX% |
| Theming | X | X | X | XX% |
| TypeScript | X | X | X | XX% |
| Components | X | X | X | XX% |
| Error Handling | X | X | X | XX% |
| **TOTAL** | **X** | **X** | **X** | **XX%** |

### Overall Health Score: [X/10]

---

## 🚨 CRITICAL Issues (Must Fix)

Issues that cause bugs, data loss, or security vulnerabilities.

| # | Area | File | Issue | Impact |
|---|------|------|-------|--------|
| 1 | Mutations | path/to/file.ts | [Description] | Race conditions |
| 2 | Stores | path/to/file.ts | [Description] | Boot failures |
| ... | ... | ... | ... | ... |

---

## ⚠️ HIGH Priority Issues

Issues that cause poor UX or violate core patterns.

| # | Area | File | Issue | Impact |
|---|------|------|-------|--------|
| 1 | Loading States | path/to/file.tsx | [Description] | Empty state during loading |
| 2 | Theming | path/to/file.tsx | [Description] | Broken dark mode |
| ... | ... | ... | ... | ... |

---

## 📝 MEDIUM Priority Issues

Issues that should be fixed but don't cause immediate problems.

| # | Area | File | Issue | Impact |
|---|------|------|-------|--------|
| 1 | Component Size | path/to/file.tsx | [Description] | Maintainability |
| 2 | TypeScript | path/to/file.ts | [Description] | Type safety |
| ... | ... | ... | ... | ... |

---

## 💡 LOW Priority Issues / Recommendations

Best practice improvements and nice-to-haves.

| # | Area | File | Recommendation |
|---|------|------|----------------|
| 1 | ... | ... | ... |
| ... | ... | ... | ... |

---

## ✅ Compliant Areas

Areas that fully meet guidelines (brief summary).

| Area | Details |
|------|---------|
| auth API | Proper structure, correct patterns |
| settings feature | Uses createStore correctly |
| ... | ... |

---

## 📐 Acceptable Pattern Variations

APIs or features that deviate from standard structure but are compliant due to documented architectural decisions.

| Item | Variation | Justification | Documented |
|------|-----------|---------------|------------|
| plan-data API | No `client.ts` | Local-first sync pattern - uses Zustand store + direct apiClient.post | ✓ Comment in index.ts |
| workout-warmup API | No `handlers/` | Single-operation API (~100 lines) | ✓ Comment in index.ts |
| ... | ... | ... | ... |

> **Note**: Items listed here were initially flagged but confirmed as intentional architectural decisions.
> If an item is missing documentation, it should be listed in HIGH Priority Issues instead.

---

## 📚 Documentation Issues

| Doc | Issue | Update Needed |
|-----|-------|---------------|
| state-management.md | Missing example | Add [specific example] |
| ... | ... | ... |

---

## 🔧 FIX IMPLEMENTATION PLAN & PROGRESS TRACKER

> **How to use**: Mark tasks complete by changing `[ ]` to `[x]` as you implement fixes.
> Update the Progress Overview table at the top of this document as you complete tasks.

### Overview

| Phase | Description | Estimated Effort | Files Affected | Status |
|-------|-------------|------------------|----------------|--------|
| 1 | Critical Mutation Fixes | X hours | X files | ⬜ |
| 2 | Store Factory Migration | X hours | X files | ⬜ |
| 3 | Loading State Fixes | X hours | X files | ⬜ |
| 4 | Theming Compliance | X hours | X files | ⬜ |
| 5 | TypeScript Cleanup | X hours | X files | ⬜ |
| 6 | Component Refactoring | X hours | X files | ⬜ |
| 7 | Error Handling Fixes | X hours | X files | ⬜ |
| 8 | Documentation Updates | X hours | X files | ⬜ |

---

### Phase 1: Critical Mutation Fixes

**Priority**: 🚨 CRITICAL
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 1.1: [Specific mutation name]

- [ ] **Fix [mutation name]** in `path/to/file.ts`

**Issue**: [Description]

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
// Show the actual problematic code from the codebase
```

**Required Fix**:
```typescript
// Show the correct implementation
```

</details>

**Why This Matters**: [Brief explanation of the bug this causes]

---

#### Task 1.2: [Next mutation]

- [ ] **Fix [mutation name]** in `path/to/file.ts`

... (repeat for each mutation issue)

---

### Phase 2: Store Factory Migration

**Priority**: 🚨 CRITICAL
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 2.1: [Specific store name]

- [ ] **Migrate [store name] to createStore** in `path/to/file.ts`

**Issue**: [Description]

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
// Show the actual problematic code
```

**Required Fix**:
```typescript
// Show the correct implementation
```

</details>

---

### Phase 3: Loading State Fixes

**Priority**: ⚠️ HIGH
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 3.1: [Specific component]

- [ ] **Fix loading state** in `path/to/file.tsx`

**Issue**: Shows empty state before data loads

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
// Show the actual problematic code
```

**Required Fix**:
```typescript
// Show the correct implementation
```

</details>

---

### Phase 4: Theming Compliance

**Priority**: ⚠️ HIGH
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 4.1: Replace hardcoded colors in [file]

- [ ] **Replace hardcoded colors** in `path/to/file.tsx`

| Line | Current | Replace With |
|------|---------|--------------|
| XX | `bg-white` | `bg-background` |
| XX | `text-gray-500` | `text-muted-foreground` |
| ... | ... | ... |

---

### Phase 5: TypeScript Cleanup

**Priority**: 📝 MEDIUM
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 5.1: Remove `any` types

- [ ] **Remove `any` types** in `path/file.ts`

| Line | Current | Replace With |
|------|---------|--------------|
| XX | `: any` | `[proper type]` |
| ... | ... | ... |

---

### Phase 6: Component Refactoring

**Priority**: 📝 MEDIUM
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 6.1: Split [ComponentName] (XXX lines)

- [ ] **Split component** `path/to/Component.tsx`

**Current Size**: XXX lines
**Target**: < 150 lines each

**Proposed Split**:
1. `ComponentHeader.tsx` - Header section (~XX lines)
2. `ComponentList.tsx` - List rendering (~XX lines)
3. `ComponentItem.tsx` - Individual items (~XX lines)
4. `Component.tsx` - Main composition (~XX lines)

---

### Phase 7: Error Handling Fixes

**Priority**: ⚠️ HIGH
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 7.1: Replace custom error rendering with ErrorDisplay

- [ ] **Replace custom error UI** in `path/to/file.tsx`

**Issue**: Route uses custom inline error rendering instead of `<ErrorDisplay>`

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
// Custom error rendering
if (error) return <p className="text-red-500">{error.message}</p>;
```

**Required Fix**:
```typescript
import { ErrorDisplay } from '@/client/features/template/error-tracking';

if (error) {
    return (
        <ErrorDisplay
            error={error}
            title="Failed to load items"
            onRetry={() => refetch()}
        />
    );
}
```

</details>

---

#### Task 7.2: Replace toast.error with errorToast in mutations

- [ ] **Use errorToast for mutation errors** in `path/to/file.ts`

**Issue**: Mutation `onError` uses `toast.error()` instead of `errorToast()`, losing the "Copy Error" action

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
onError: () => {
    toast.error('Failed to save changes');
},
```

**Required Fix**:
```typescript
import { errorToast } from '@/client/features/template/error-tracking';

onError: (err) => {
    errorToast('Failed to save changes', err);
},
```

</details>

---

#### Task 7.3: Remove raw error.message from UI

- [ ] **Replace raw error messages** in `path/to/file.tsx`

**Issue**: Displays `error.message` directly to users

<details>
<summary>View Code Changes</summary>

**Current Code (Non-Compliant)**:
```typescript
<p>{error.message}</p>
```

**Required Fix**:
```typescript
import { getUserFriendlyMessage } from '@/client/features/template/error-tracking';

<p>{getUserFriendlyMessage(error)}</p>
```

</details>

---

### Phase 8: Documentation Updates

**Priority**: 💡 LOW
**Estimated Effort**: X hours
**Files Affected**: X

#### Task 8.1: Update [doc name]

- [ ] **Update documentation** `docs/[name].md`

**Changes Needed**:
- Add example for [topic]
- Update outdated section about [topic]
- Fix contradiction with [other doc]

---

## ✅ Final Verification Checklist

Complete these checks after ALL fixes are implemented:

### Code Quality
- [ ] `yarn checks` passes with 0 errors
- [ ] All mutations use correct optimistic-only pattern
- [ ] All stores use createStore factory
- [ ] No empty states shown during loading
- [ ] No hardcoded colors remain
- [ ] No `any` types remain
- [ ] All components < 200 lines
- [ ] All route error states use `ErrorDisplay` component
- [ ] All mutation `onError` uses `errorToast`/`errorToastAuto` (not plain `toast.error`)
- [ ] No raw `error.message` displayed to users

### Manual Testing
- [ ] Light mode works correctly
- [ ] Dark mode works correctly
- [ ] Offline mode works correctly
- [ ] Edit operations feel instant (optimistic)
- [ ] Delete operations feel instant (optimistic)
- [ ] Create operations show appropriate feedback
- [ ] Rapid clicking doesn't cause race conditions
- [ ] Initial page load shows skeleton (not empty state)
- [ ] Background refresh shows subtle indicator

---

## 📝 Implementation Log

Track your implementation progress here:

| Date | Tasks Completed | Notes |
|------|-----------------|-------|
| | | |
| | | |
| | | |

---

## Appendix: Files Inventory

### All Files Audited

| File | Lines | Issues Found | Priority |
|------|-------|--------------|----------|
| src/client/routes/Todos/hooks.ts | XXX | X | CRITICAL |
| src/client/features/auth/store.ts | XXX | X | HIGH |
| ... | ... | ... | ... |

### Files Requiring Changes

| File | Change Type | Estimated Lines Changed |
|------|-------------|-------------------------|
| path/to/file.ts | Mutation fix | ~XX lines |
| path/to/file.tsx | Loading state | ~XX lines |
| ... | ... | ... |
```

### 6.3: Important Notes for Report Generation

When generating the final report:

1. **Be Specific**: Include actual file paths, line numbers, and code snippets
2. **Prioritize Correctly**: 
   - 🚨 CRITICAL = Bugs, data loss, security issues
   - ⚠️ HIGH = Poor UX, major pattern violations
   - 📝 MEDIUM = Maintainability, best practices
   - 💡 LOW = Nice-to-haves, minor improvements
3. **Show Real Code**: Copy actual code from files, don't make up examples
4. **Calculate Metrics**: Provide accurate counts and percentages
5. **Make Tasks Actionable**: Each task should be self-contained and implementable

---

## Master Checklist (For Auditor)

Complete ALL items to finish the audit:

### Phase 1: Documentation Review
- [ ] Read CLAUDE.md
- [ ] Read docs/architecture.md
- [ ] Read **docs/state-management.md** (CRITICAL)
- [ ] Read **docs/react-query-mutations.md** (CRITICAL)
- [ ] Read **docs/zustand-stores.md** (CRITICAL)
- [ ] Read **docs/offline-pwa-support.md** (CRITICAL)
- [ ] Read docs/authentication.md
- [ ] Read docs/caching-strategy.md
- [ ] Read all docs/template/project-guidelines/*.md files

### Phase 2: Discovery
- [ ] Listed all API domains
- [ ] Listed all features
- [ ] Listed all routes
- [ ] Found ALL mutations (`grep -r "useMutation"`)
- [ ] Found ALL stores (`find -name "store.ts"`)
- [ ] Listed all database collections
- [ ] Created comprehensive TODO list

### Phase 3: Systematic Audit
- [ ] Audited EVERY API domain
- [ ] Audited EVERY feature
- [ ] Audited EVERY route
- [ ] Audited EVERY mutation (most critical)
- [ ] Audited EVERY store
- [ ] Checked theming compliance
- [ ] Checked TypeScript quality
- [ ] Checked MongoDB patterns
- [ ] Checked component organization
- [ ] Checked project structure (template/project subfolders)
- [ ] Checked circular imports in features
- [ ] Verified three-file pattern (index.ts, index.template.ts, index.project.ts)
- [ ] Checked error handling patterns (ErrorDisplay, errorToast, no raw messages)

### Phase 4: Cross-Cutting Concerns
- [ ] Verified import patterns
- [ ] Verified server/client separation
- [ ] Verified offline handling

### Phase 5: Documentation Sync
- [ ] Compared docs to implementation
- [ ] Identified gaps and contradictions

### Phase 6: Report Generation
- [ ] Created `audits/` folder (if it doesn't exist)
- [ ] Saved report to `audits/audit-YYYY-MM-DD.md`
- [ ] Compiled all violations with file paths and line numbers
- [ ] Categorized by severity (Critical/High/Medium/Low)
- [ ] Created fix implementation plan with specific tasks
- [ ] **Included checkboxes `[ ]` for each task** (progress tracker)
- [ ] Included actual code snippets (current vs. required)
- [ ] Calculated compliance scores
- [ ] Added Progress Overview table at top
- [ ] Added Implementation Log section
- [ ] Added Final Verification Checklist

### Final Verification
- [ ] All TODOs marked as completed
- [ ] Report saved to `audits/audit-YYYY-MM-DD.md`
- [ ] Report includes all sections from template
- [ ] Each violation has a corresponding fix task with checkbox
- [ ] Fix tasks are specific and actionable
- [ ] Progress tracker is ready to use
- [ ] ⛔ **NO CODE CHANGES WERE MADE**

---

## Quick Reference: Common Violations

### 🚨 CRITICAL Violations (docs/react-query-mutations.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Temp ID replacement | `grep -r "temp-\|tempId\|\`temp"` | Use client-generated UUID or non-optimistic |
| setQueryData in onSuccess with server data | Check `onSuccess` handlers | Remove - use optimistic-only |
| invalidateQueries on same data | `grep -r "invalidateQueries" -B5 -A5` | Remove (except separate aggregation queries) |
| Applying server response to state | Check `onSuccess` for `setState(response)` | Remove - trust optimistic update |
| Missing offline guard | Check non-optimistic creates | Add `if (!data) return` in onSuccess |
| Loading spinner on optimistic op | Check confirmation dialogs | Close immediately, no loading |

> **NOT Violations**: Toasts (`toast.success()`), logging (`logger.info()`), analytics, navigation, and `queryClient.removeQueries()` in `onSuccess`/`onError` are **allowed**. They're UI side effects that don't modify application state.

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

### 🚨 CRITICAL Violations (docs/template/project-structure-guidelines.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Circular imports via barrel | `grep -r "from '@/client/features'" src/client/features/template/` | Use direct imports (`../router`, `../auth/store`) |
| Feature not in template/project subfolder | `find src/client/features -maxdepth 1 -type d` | Move to `features/template/` or `features/project/` |
| Route not in template/project subfolder | `find src/client/routes -maxdepth 1 -type d` | Move to `routes/template/` or `routes/project/` |
| Missing three-file pattern | `ls src/client/features/index*.ts` | Create `index.ts`, `index.template.ts`, `index.project.ts` |
| NavLinks not using combiner pattern | `ls src/client/components/*NavLinks*` | Create `NavLinks.tsx` + `NavLinks.template.tsx` + `NavLinks.project.tsx` |
| Modified template file without override | Compare with template repo | Add to `projectOverrides` in `.template-sync.json` |
| No isFetching indicator | Check list components | Add subtle refresh indicator |
| Fixed pixel widths | `grep -r "w-\[.*px\]"` | Use responsive Tailwind classes |

### ⚠️ HIGH Violations (docs/template/error-handling.md)

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Custom error rendering in routes | Check `if (error) return` in route components | Use `<ErrorDisplay>` component |
| `toast.error()` for mutation failures | Check `onError` callbacks | Use `errorToast(message, err)` or `errorToastAuto(err)` |
| Raw `error.message` in UI | `grep -r "error\.message"` in tsx files | Use `getUserFriendlyMessage()` or `cleanErrorMessage()` |
| Missing error object in errorToast | Check `errorToast` calls | Always pass error as second argument |
| Swallowed errors (empty catch/onError) | Check `catch` blocks and `onError` | Add `errorToastAuto(error)` |
| Barrel import in bug-report/auth | `grep "error-tracking'" src/client/features/template/bug-report/` | Use direct file imports (`../error-tracking/errorToast`) |
| Stack traces visible to non-admins | Check error rendering components | Use `ErrorDisplay` (gates via `useIsAdmin()`) |

### Other Violations

| Violation | How to Find | Fix |
|-----------|-------------|-----|
| Hardcoded colors | `grep -r "bg-white\|bg-gray-"` | Use semantic tokens |
| `any` type | `grep -r ": any\|as any"` | Use proper types |
| Direct ObjectId | `grep -r "toHexString\|new ObjectId"` | Use ID utilities |
| Wrong API import | Check client.ts imports | Import from `./index`, not `./server` |
| Non-shadcn components | `grep -r "from '@mui"` | Use shadcn from `@/client/components/ui` |
| mongodb in APIs | `grep -r "from 'mongodb'" src/apis` | Import from `@/server/template/database` |

---

## Quick Reference: Acceptable Pattern Variations

These patterns deviate from the standard structure but are **acceptable when properly documented**.

### ✅ Acceptable: API Without `client.ts` (Local-First Sync)

| Criteria | Required |
|----------|----------|
| Use case | Batch sync endpoint for local-first architecture |
| Client usage | Zustand store + direct `apiClient.post` (not React Query) |
| Documentation | Comment in `index.ts` explaining the pattern |
| Operations | Typically single sync operation |

**How to verify:**
1. Check if a sync module exists (e.g., `features/[name]/sync.ts`)
2. Verify sync module uses `apiClient.post` directly
3. Confirm UI reads from Zustand store, not React Query
4. Check for architecture comment in `index.ts`

**Mark as compliant if:** Documented + matches local-first sync pattern
**Mark as violation if:** Missing docs OR should have standard React Query hooks

### ✅ Acceptable: API Without `handlers/` Folder (Single-Operation)

| Criteria | Required |
|----------|----------|
| Operations | Exactly ONE operation |
| Handler size | < 150 lines in `server.ts` |
| Documentation | Comment in `index.ts` explaining the pattern |

**How to verify:**
1. Count operations in `server.ts` (should be 1)
2. Check handler logic size (should be < 150 lines)
3. Check for architecture comment in `index.ts`

**Mark as compliant if:** Single operation + small handler + documented
**Mark as violation if:** Multiple operations OR large handler OR missing docs

### Decision Matrix for API Structure Variations

```
API missing client.ts?
├── YES
│   ├── Has documentation comment in index.ts?
│   │   ├── YES
│   │   │   └── Is it a local-first sync API?
│   │   │       ├── YES → ✅ Compliant
│   │   │       └── NO → ❌ Violation (wrong pattern)
│   │   └── NO → ⚠️ Needs documentation (add comment or refactor)
│   └── Continue checking...
└── NO → Standard pattern, check other requirements

API missing handlers/ folder?
├── YES
│   ├── Has documentation comment in index.ts?
│   │   ├── YES
│   │   │   └── Single operation AND < 150 lines?
│   │   │       ├── YES → ✅ Compliant
│   │   │       └── NO → ❌ Violation (should use handlers/)
│   │   └── NO → ⚠️ Needs documentation (add comment or refactor)
│   └── Continue checking...
└── NO → Standard pattern, check other requirements
```

---

## Notes

### This is a REPORT-ONLY Audit

- **DO NOT** make any code changes during this audit
- **DO NOT** fix any issues you find
- **DO** save the report to `audits/audit-YYYY-MM-DD.md`
- **DO** document every violation with specific details
- **DO** create a comprehensive fix plan with actionable tasks
- **DO** include checkboxes `[ ]` for each task (for progress tracking)
- **DO** include actual code snippets showing current vs. required code

### Using the Progress Tracker

The saved audit file serves as both a report AND a progress tracker:
1. Each fix task has a checkbox `[ ]`
2. When implementing fixes later, change `[ ]` to `[x]` as tasks are completed
3. Update the Progress Overview table at the top
4. Add entries to the Implementation Log
5. Complete the Final Verification Checklist when done

### TODO Tracking (Essential)
- **Create TODO list FIRST** using `todo_write` before any audit work
- **Expand TODOs after discovery** with specific items for each API, feature, route, mutation
- **Update TODOs throughout** - mark items as `completed` as you finish them
- **Verify all TODOs complete** before finishing the audit
- **The audit is incomplete** if any TODOs remain `pending`

### If Interrupted
- The TODO list allows you to resume the audit
- Check which TODOs are still `pending` to see where to continue
- Don't restart from the beginning - pick up from the last incomplete TODO
