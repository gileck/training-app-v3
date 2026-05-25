---
title: useOptimisticMutation
description: Opinionated wrapper around useMutation that bakes in the optimistic-only pattern — cancel, snapshot, rollback, errorToast, and defensive invalidate. Use this when you don't want to wire the same pattern by hand.
summary: "`useOptimisticMutation` from `@/client/query` is a drop-in wrapper around `useMutation` that handles cancel + snapshot + rollback for every affected key, calls `errorToast` on failure, and defensively invalidates so a missed rollback self-corrects. Projects can adopt it gradually — plain `useMutation` still works as long as it follows the rules in react-query-mutations.md."
guidelines:
  - "Prefer `useOptimisticMutation` over hand-rolled `useMutation` for mutations that follow the optimistic-only pattern"
  - "Declare every cache key the mutation touches in `affectedKeys` — the wrapper snapshots, rolls back, and defensively invalidates each one"
  - "Use `errorMessage` to provide a domain-specific user-facing message; return `null` from the function form to suppress the toast (rare — only when the call site shows its own dialog)"
  - "`onSuccess` is for UI side effects only (success toast, navigation, logging). NEVER call `setQueryData` from it — `applyOptimistic` is the source of truth"
  - "When offline, `apiClient.post` returns `{}` and `onError` never fires — the offline banner is the feedback, not a toast"
priority: 2
---

# useOptimisticMutation

`useOptimisticMutation` is a thin opinionated wrapper around `useMutation` that
bakes in the optimistic-only mutation pattern documented in
[react-query-mutations.md](./react-query-mutations.md) and
[offline-pwa-support.md](./offline-pwa-support.md).

It exists because the pattern is load-bearing (silent-failure bugs are the #1
mutation foot-gun in this codebase) and hand-wiring it correctly every time is
error-prone. The wrapper makes "doing it right" the default and "doing it
wrong" require effort.

## What it bakes in

For every mutation:

1. **Cancel** in-flight queries for every `affectedKeys` entry, so an outgoing
   fetch can't race the optimistic update.
2. **Snapshot** the previous data for every affected key.
3. **Apply** your optimistic update via `applyOptimistic`.
4. On error:
   - **Rollback** every snapshotted key (you cannot forget one).
   - **errorToast** with a user-facing message + Copy Error action.
   - **Invalidate** every affected key as a defensive safety net — if a
     hand-written `applyOptimistic` ever forgets to snapshot a key, the next
     fetch will correct the UI.
5. `onSuccess` / `onSettled` cannot write to cache from the server response.
   The wrapper exposes an `onSuccess` slot for UI side effects only.

When the device is offline, `apiClient.post` returns `{}` and `mutationFn`
does not throw — so `onError` does not fire, and no toast appears. The
offline banner + batch-sync alert are the feedback for the offline path. This
is exactly the behavior you want.

## API

```typescript
import { useOptimisticMutation } from '@/client/query';

useOptimisticMutation<TData, TVars>({
    mutationFn: (vars) => Promise<TData>,        // throw on response.data?.error
    affectedKeys: QueryKey[] | (vars) => QueryKey[],
    applyOptimistic?: (vars, queryClient) => void,
    errorMessage?: string | (err, vars) => string | null,
    onError?: (err, vars) => void,               // side effects only
    onSuccess?: (data, vars) => void,            // side effects only — never setQueryData
});
```

### `affectedKeys`

The query keys this mutation touches. Static array for fixed keys, or a
function of `vars` when keys depend on the variables (e.g. a per-item cache
key).

```typescript
affectedKeys: [todosQueryKey],
// or
affectedKeys: (vars) => [todosQueryKey, todoQueryKey(vars.todoId)],
```

The wrapper cancels, snapshots, rolls back, and invalidates each one. **Every
key your `applyOptimistic` writes to MUST appear here** — that's how rollback
finds them.

### `applyOptimistic`

Apply the optimistic state. The wrapper has already snapshotted the affected
keys, so just write the new state. Do not worry about returning context — the
wrapper builds it.

```typescript
applyOptimistic: (vars, queryClient) => {
    queryClient.setQueryData<GetTodosResponse>(todosQueryKey, (old) => {
        if (!old?.todos) return { todos: [newTodo(vars)] };
        return { todos: [...old.todos, newTodo(vars)] };
    });
},
```

### `errorMessage`

User-facing message for the toast. Default: the thrown error's message.

```typescript
errorMessage: 'Failed to create todo',
// or
errorMessage: (err, vars) =>
    err.message.includes('duplicate') ? 'Already exists' : 'Failed to save',
// or — suppress the default toast (rare):
errorMessage: () => null,
```

Return `null` from the function form to suppress the toast — only do this
when the call site is going to show its own error UI (e.g. a blocking
failure dialog for a mission-critical flow). The rollback + invalidate still
run; only the toast is skipped.

### `onError` / `onSuccess`

For UI side effects only — logging, analytics, navigation, success toast,
opening a dialog. The wrapper already handles rollback, errorToast, and
invalidate; do not duplicate them.

```typescript
onSuccess: (data, vars) => {
    toast.success('Saved');
    router.push(`/items/${data.id}`);
},
onError: (err) => {
    logger.warn('todos', 'create-failed', { message: err.message });
},
```

## Example: see Todos

The reference implementation lives in
`src/client/routes/project/Todos/hooks.ts` — `useCreateTodo`, `useUpdateTodo`,
and `useDeleteTodo` all use the wrapper, including the multi-key case
(`useUpdateTodo` touches both the list cache and a per-item cache).

## When NOT to use it

- **Non-optimistic mutations** — if you need the UI to wait on the server
  response (e.g. a server-generated ID you can't synthesize client-side),
  drop down to plain `useMutation`. The wrapper is built for optimistic-only.
- **Mission-critical flows that need a blocking failure dialog** — you can
  still use the wrapper, but pair it with `mutateAsync` + try/catch at the
  call site. The wrapper's default toast still fires as a safety net; the
  dialog gives the user a recovery path. Set `errorMessage: () => null` if
  you want the dialog to be the only error UI.
- **Cross-mutation cache invalidation** — if mutation A needs to invalidate
  caches that mutation B owns, do it from a feature-level hook on top of the
  wrapper, not from `onSuccess` (which is for the same mutation's UI side
  effects).

## Migration: hand-rolled `useMutation` → `useOptimisticMutation`

Before:

```typescript
useMutation({
    mutationFn: async (vars) => {
        const r = await api.update(vars);
        if (r.data?.error) throw new Error(r.data.error);
        return r.data;
    },
    onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: ['items'] });
        const previous = queryClient.getQueryData(['items']);
        queryClient.setQueryData(['items'], (old) => /* ... */);
        return { previous };
    },
    onError: (err, _vars, context) => {
        if (context?.previous) queryClient.setQueryData(['items'], context.previous);
        // ⚠️ missing errorToast — silent failure
    },
    onSuccess: () => {},
    onSettled: () => {},
});
```

After:

```typescript
useOptimisticMutation({
    mutationFn: async (vars) => {
        const r = await api.update(vars);
        if (r.data?.error) throw new Error(r.data.error);
        return r.data;
    },
    affectedKeys: [['items']],
    applyOptimistic: (vars, qc) => {
        qc.setQueryData(['items'], (old) => /* ... */);
    },
    errorMessage: 'Failed to save changes',
});
```

The cancel, snapshot, rollback, errorToast, and invalidate are all handled.

## Adoption is optional

Plain `useMutation` is still allowed — `useOptimisticMutation` is a
convenience, not a mandate. The rules in
[react-query-mutations.md](./react-query-mutations.md) apply to both styles;
the wrapper just makes the rules harder to forget.
