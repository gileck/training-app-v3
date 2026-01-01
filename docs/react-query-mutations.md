# React Query Mutations & Optimistic Updates (App Guidelines)

This document defines the **required mutation patterns** for this application.

## Core Rule: Optimistic-only

**The UI is the source of truth.**

- **Update UI/cache immediately** in `onMutate`
- **Rollback only on error** in `onError`
- **Do not update UI from server responses** in `onSuccess`
- **Do not invalidate/refetch from mutations** in `onSettled` / `onSuccess`

This avoids race conditions when users interact faster than the server responds.

## Why “optimistic-only” (race condition example)

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

## Offline behavior note (this app)

When offline, `apiClient.post` queues the request and returns `{ data: {}, isFromCache: false }` immediately.

Implications:

- Prefer `onSuccess: () => {}` for mutations (optimistic-only)
- If you have a special-case `onSuccess`, it **must** guard against empty `data` while offline

