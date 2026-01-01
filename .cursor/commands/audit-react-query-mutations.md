# Audit React Query Mutations

This command audits ALL React Query mutations in the project and ensures they follow the optimistic-only mutation guidelines.

📚 **Full Documentation**: [docs/react-query-mutations.md](mdc:../../docs/react-query-mutations.md)  
📚 **State Management**: [docs/state-management.md](mdc:../../docs/state-management.md)

## Guidelines Summary (High-Level)

### Core Rules

1. **Edits / Deletes → Optimistic-only**
   - Update cache in `onMutate`
   - Rollback on `onError`
   - `onSuccess: () => {}` (empty - never update from server response)
   - `onSettled: () => {}` (empty - never invalidate from mutations)

2. **Creates → Decision required**
   - **2.1 Optimistic create** ONLY if:
     - Client can safely generate stable ID (UUID/nanoid)
     - Server accepts and persists that ID (idempotent)
     - Client can render entity without server-derived fields
   - **2.2 Non-optimistic create** otherwise:
     - Show loader / disable submit
     - On success, insert returned entity into cache
     - This is the SAFE default when unsure

3. **Never do temp-ID → server-ID replacement flows** (too complex/bug-prone)

4. **Async enrichment pattern** (optional advanced):
   - Base entity optimistic, enriched fields show loading
   - Only update enriched fields from server, never base entity

---

## Process

### Step 1: Read Guidelines (Required First Step)

**Action**: Read and understand the full guidelines before proceeding.

Read these files completely:
1. `docs/react-query-mutations.md` - Detailed mutation patterns
2. `docs/state-management.md` - Section on React Query mutations
3. `.cursor/rules/state-management-guidelines.mdc` - Quick reference

Confirm you understand:
- Why optimistic-only prevents race conditions
- The difference between edit/delete vs create patterns
- When to use non-optimistic creates (the safe default)

---

### Step 2: Find ALL React Query Mutations

**Action**: Search the entire codebase for mutation hooks.

```bash
# Find all useMutation usage
grep -r "useMutation" src/client --include="*.ts" --include="*.tsx" -l

# Find all mutation hook definitions
grep -r "function use.*Mutation\|function use.*Create\|function use.*Update\|function use.*Delete" src/client --include="*.ts" --include="*.tsx"
```

**Expected locations**:
- `src/client/routes/*/hooks.ts` - Route-specific mutations
- `src/client/features/*/hooks.ts` - Feature mutations
- Any other `.ts`/`.tsx` files with `useMutation`

---

### Step 3: Analyze Each Mutation

For EACH mutation found, determine:

#### A) Mutation Type Classification

| Type | Pattern | Example |
|------|---------|---------|
| **Edit** | Updates existing entity | `useUpdateTodo`, `useUpdateProfile` |
| **Delete** | Removes entity | `useDeleteTodo`, `useDeleteReport` |
| **Create** | Creates new entity | `useCreateTodo`, `useCreateComment` |

#### B) Current Implementation Check

For each mutation, check:

1. **Does it have `onMutate` with optimistic update?**
   - ✅ Good: Updates cache immediately
   - ❌ Bad: No optimistic update (for edits/deletes)

2. **Does `onSuccess` update cache from server response?**
   - ❌ Bad for edits/deletes: `queryClient.setQueryData(key, serverData)`
   - ❌ Bad for edits/deletes: Any data transformation from response

3. **Does `onSuccess` or `onSettled` call `invalidateQueries`?**
   - ❌ Bad for edits/deletes: Causes race conditions
   - ⚠️ Allowed only for non-optimistic creates

4. **For creates: Does it use temp IDs?**
   - ❌ Bad: `temp-${Date.now()}` or similar patterns
   - ❌ Bad: Replacing temp ID with server ID

#### C) Classification Result

Mark each mutation as:
- ✅ **Compliant** - Follows guidelines
- ⚠️ **Needs Review** - Unclear case, needs discussion
- ❌ **Non-compliant** - Must be fixed

---

### Step 4: Summarize Findings

**Action**: Create a summary table for the user.

#### Format

```markdown
## Mutation Audit Results

### ✅ Compliant Mutations (X total)
| File | Hook | Type | Notes |
|------|------|------|-------|
| routes/Todos/hooks.ts | useUpdateTodo | Edit | Optimistic-only ✓ |
| routes/Todos/hooks.ts | useDeleteTodo | Delete | Optimistic-only ✓ |

### ❌ Non-compliant Mutations (X total)
| File | Hook | Type | Issue | Suggested Fix |
|------|------|------|-------|---------------|
| routes/Example/hooks.ts | useUpdateItem | Edit | onSuccess updates from server | Make optimistic-only |
| features/auth/hooks.ts | useLogin | Create | Uses invalidateQueries | Remove invalidation |

### ⚠️ Needs Discussion (X total)
| File | Hook | Type | Question |
|------|------|------|----------|
| routes/Orders/hooks.ts | useCreateOrder | Create | Server computes totals - should this be non-optimistic? |
```

---

### Step 5: Explain UX Impact for Creates

**CRITICAL**: For any CREATE mutation that needs to change from optimistic to non-optimistic:

#### Template for User Communication

```markdown
## UX Change Required: [Hook Name]

**Current behavior**: Optimistic create with temp ID
**Proposed behavior**: Non-optimistic create (show loader)

### Why optimistic create is problematic here:

[Explain the specific reason - one of these:]

1. **Server generates the ID**: The entity ID is a MongoDB ObjectId generated server-side. 
   Replacing temp IDs with real IDs is complex and error-prone.

2. **Server computes critical fields**: The server calculates [fields], which the client 
   cannot predict. Showing wrong data then correcting it is poor UX.

3. **Uniqueness validation**: The server must validate uniqueness against the full dataset.
   The client cannot reliably check this.

4. **Complex relationships**: This entity immediately affects [other caches/lists].
   Coordinating temp-ID replacement across caches is too risky.

### UX Options (ranked by recommendation):

**Option A (Recommended): Inline Loading State**
- Disable submit button while creating
- Show small spinner next to button
- On success, new item appears in list
- Fast server response makes this imperceptible

**Option B: Skeleton Placeholder**
- Insert skeleton/placeholder card immediately
- Replace with real card on success
- Good for lists where position matters

**Option C: Optimistic with client-generated ID**
- Only if you can change the API to accept client IDs
- Client generates UUID/nanoid, server uses it as primary ID
- Requires API changes: [describe what changes]

### Recommendation: [Option A/B/C]

Do you approve this change?
```

---

### Step 6: Get User Approval

**Action**: Present all findings and wait for explicit approval.

```markdown
## Summary of Proposed Changes

### Changes that modify code only (no UX impact):
1. [Hook]: Remove `invalidateQueries` from onSuccess
2. [Hook]: Change onSuccess to empty function
...

### Changes that affect UX:
1. [Hook]: Change from optimistic to non-optimistic create
   - User will see: [describe]
...

**Please review and reply:**
- "Approve all" - Proceed with all changes
- "Approve except [X]" - Skip specific changes
- "Questions about [X]" - I'll explain further
```

**DO NOT PROCEED without explicit user approval.**

---

### Step 7: Implement Changes

**Action**: After approval, make the changes systematically.

#### For each edit/delete mutation:

```typescript
// BEFORE (non-compliant)
onSuccess: (data) => {
    if (data) {
        queryClient.setQueryData(['key', data.id], data);
    }
    queryClient.invalidateQueries({ queryKey: ['key'] });
},

// AFTER (compliant)
onSuccess: () => {},
onSettled: () => {},
```

#### For creates changing to non-optimistic:

```typescript
// BEFORE (optimistic with temp ID)
onMutate: async (variables) => {
    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData(['items'], (old) => ({
        items: [...old.items, { _id: tempId, ...variables }]
    }));
    return { tempId };
},
onSuccess: (newItem, variables, context) => {
    // Replace temp with real...
},

// AFTER (non-optimistic)
// Remove onMutate entirely
onSuccess: (newItem) => {
    if (!newItem) return; // Guard for offline
    queryClient.setQueryData(['items'], (old) => ({
        items: [...(old?.items || []), newItem]
    }));
},
```

#### Update component UX if needed:

```typescript
// Show loading state for non-optimistic creates
const createMutation = useCreateItem();

<Button 
    onClick={() => createMutation.mutate(data)}
    disabled={createMutation.isPending}
>
    {createMutation.isPending ? 'Creating...' : 'Create'}
</Button>
```

---

### Step 8: List Flows to Verify

**Action**: Tell user exactly what to test.

```markdown
## Please Verify These Flows

### Edits (should feel instant):
- [ ] [Route/Feature]: Edit [entity] - should update immediately, no flicker

### Deletes (should feel instant):
- [ ] [Route/Feature]: Delete [entity] - should disappear immediately

### Creates (UX changed):
- [ ] [Route/Feature]: Create [entity] - verify:
  - Button shows loading state while creating
  - New item appears after ~0.5-1s
  - No errors in console
  - Works correctly on retry if first attempt fails

### Offline behavior:
- [ ] Toggle offline mode in settings
- [ ] Try edit/delete - should work (optimistic)
- [ ] Try create - should queue and sync when online

Reply with:
- "All verified" - Ready to commit
- "Issue with [X]" - I'll investigate
```

---

### Step 9: Commit and Push

**Action**: After user confirms all flows work:

```bash
git add -A
git commit -m "refactor: align React Query mutations with optimistic-only guidelines

Edits/deletes:
- [List hooks changed to optimistic-only]

Creates:
- [List hooks changed to non-optimistic if any]

See docs/react-query-mutations.md for guidelines."

git push
```

---

## Checklist for Agent

Use this checklist to track progress:

- [ ] Read docs/react-query-mutations.md completely
- [ ] Read docs/state-management.md mutation section
- [ ] Found all useMutation hooks in codebase
- [ ] Classified each as edit/delete/create
- [ ] Checked each for compliance
- [ ] Created summary table
- [ ] Explained UX impact for any create changes
- [ ] Got explicit user approval
- [ ] Made all approved changes
- [ ] Listed flows for user to verify
- [ ] User confirmed all flows work
- [ ] Committed and pushed changes
