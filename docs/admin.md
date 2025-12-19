# Admin System

This app supports a lightweight **single-admin** setup controlled by an environment variable.

## Configuration

- `ADMIN_USER_ID`: the **user.id** (Mongo `_id` string) of the single admin user.

Where it’s used:
- **Server**: derives `context.isAdmin` for every API call.
- **Client**: receives `user.isAdmin` on login/register/me and exposes `useIsAdmin()`.

## Conventions

### Admin Routes

- Any client route under **`/admin/*`** is treated as **admin-only**.
- Non-admin users are redirected to `/`.

### Admin APIs

- Any API name under **`admin/*`** is treated as **admin-only**.
- This is enforced centrally in the API processor (and also in batch-updates for queued operations).

Examples:
- `admin/reports/list` → admin-only
- `reports/create` → public (regular users can submit reports)

## Client Usage

Use `useIsAdmin()` to show/hide admin-only UI:

```tsx
import { useIsAdmin } from '@/client/features/auth';

export function MyComponent() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  return <div>Admin-only UI</div>;
}
```

## Server Usage

All API handlers receive `context.isAdmin` via `ApiHandlerContext`.
Prefer the **`admin/*` naming convention** to avoid per-handler authorization checks.


