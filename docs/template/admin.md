# Admin System

This app supports a lightweight **single-admin** setup controlled by an environment variable.

## Configuration

- `ADMIN_USER_ID`: the **user.id** (Mongo `_id` string) of the single admin user.

Where it’s used:
- **Server**: derives `context.isAdmin` for every API call.
- **Client**: receives `user.isAdmin` on login/register/me and exposes `useIsAdmin()`.

## Conventions

### Admin Routes

Admin routes can be defined in two ways:

1. **Path convention**: Any route under **`/admin/*`** is automatically admin-only
2. **Route metadata**: Use `adminOnly: true` in route config

```typescript
// src/client/routes/index.ts
export const routes = createRoutes({
  // Path convention - automatically admin-only
  '/admin/dashboard': AdminDashboard,
  '/admin/users': AdminUsers,
  
  // Explicit metadata - admin-only at any path
  '/reports': { component: Reports, adminOnly: true },
});
```

Non-admin users attempting to access admin routes are redirected to `/`.

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


