---
title: Admin-Approved Signups
description: Gate new signups behind admin approval. Use this when setting up or customizing the admin approval flow.
summary: "Enabled by default. New signups land in 'pending' status until an admin approves via /admin/approvals. First-user-wins bootstrap auto-approves the first signup on a fresh deployment. Admin (ADMIN_USER_ID) always bypasses the gate. Disable with requireAdminApproval: false in src/apis/auth-overrides.ts."
priority: 2
---

# Admin-Approved Signups

New user signups are gated behind admin approval by default. When `requireAdminApproval: true` is set in `src/apis/auth-overrides.ts` (the template default), every new signup is placed in a `pending` state and cannot log in until an admin approves them.

## How It Works

```
New User Signs Up
     │
     ├── Is the users collection empty? (first-user-wins)
     │     └── YES → Auto-approve, issue JWT, log _id to server console
     │
     ├── Does user _id match ADMIN_USER_ID? (admin bypass)
     │     └── YES → Auto-approve, issue JWT
     │
     └── Normal case
           ├── Create user with approvalStatus: 'pending'
           ├── Do NOT issue JWT (no cookie)
           ├── Return { pendingApproval: true } → "Waiting for approval" screen
           └── Send Telegram notification to owner with [Review & Approve] button
                    │
                    ▼
              Admin opens /admin/approvals
                    │
                    ├── Approve → approvalStatus: 'approved', user can log in
                    └── Reject  → approvalStatus: 'rejected' (soft delete)
```

## Flow Details

1. **New signups** are created with `approvalStatus: 'pending'`. The register endpoint does **not** issue a JWT and returns `{ pendingApproval: true }`. The login form shows a "Waiting for approval" screen.
2. **Login attempts** by pending users are blocked with "Your account is pending admin approval". Rejected users see "Your account has been rejected". The admin user (`ADMIN_USER_ID`) bypasses the gate.
3. **The admin is notified via Telegram** on each new signup (via `sendNotificationToOwner()` + `OWNER_TELEGRAM_CHAT_ID`). The message renders an inline keyboard button opening `/admin/approvals`. The URL is resolved via `appConfig.appUrl` (cascades: `NEXT_PUBLIC_APP_URL` -> `VERCEL_PROJECT_PRODUCTION_URL` -> `VERCEL_URL` -> hardcoded default).
4. **The admin opens `/admin/approvals`** -- an admin-only route (also in the admin menu) listing pending users with Approve / Reject actions.
5. **Approve** sets `approvalStatus: 'approved'` and stamps `approvedAt`. The user can now log in normally.
6. **Reject** is a soft delete: `approvalStatus: 'rejected'` with `rejectedAt`. The user row stays, reserving the username/email so the rejected user cannot re-register with the same credentials.

## Disabling (Open Signups)

Set `requireAdminApproval: false` in `src/apis/auth-overrides.ts`:

```typescript
export const authOverrides: AuthOverrides = {
  requireAdminApproval: false,
};
```

For child projects: add `src/apis/auth-overrides.ts` to `projectOverrides` in `.template-sync.json` so future template syncs don't overwrite your change.

## Bootstrap: Fresh Deployment Setup

The flag is on by default, so a **first-user-wins** bootstrap bypass is built in:

1. **Deploy with the flag on** -- no pre-setup needed. `ADMIN_USER_ID` can be empty.
2. **First user signs up** -- they're auto-approved immediately (not the pending screen). A `[registerUser] First-user-wins bootstrap: ...` line is logged on the server with the new user's `_id`.
3. **Grab the `_id`** from that server log line (or from MongoDB).
4. **Set `ADMIN_USER_ID=<id>`** in your environment and restart / redeploy. Now the first user has admin access and `/admin/approvals` starts working.
5. **Subsequent signups** go through the normal pending -> approve flow.

### Security Caveats

- **Race window**: two simultaneous signups on a truly empty collection could both pass the empty-check and both be auto-approved. The window is milliseconds on a first deployment. The real admin can reject the extra user via `/admin/approvals` afterward.
- **Exposure window**: between deploying and the admin signing up, the signup form is publicly reachable. If an attacker reaches it first, they get auto-approved. Mitigation: deploy to a preview URL only the admin knows, or sign up immediately after deployment.
- **Admin bypass**: a user whose `_id` matches `ADMIN_USER_ID` is always auto-approved, so re-registering the admin after a DB wipe still works without the first-user branch.

## Schema

The `User` document has three optional fields added by this feature:

| Field | Type | Description |
|-------|------|-------------|
| `approvalStatus` | `'pending' \| 'approved' \| 'rejected'` | Missing = `'approved'` (backward compat with legacy users) |
| `approvedAt` | `Date` | Stamped when admin approves |
| `rejectedAt` | `Date` | Stamped when admin rejects |

**Backward compatibility:** existing users created before this feature have no `approvalStatus` field. The login gate uses `user.approvalStatus ?? 'approved'`, so they're treated as approved and unaffected when the flag is turned on.

## API Endpoints

All endpoints are admin-only (return `{ error: 'Admin access required' }` for non-admins).

| Endpoint | Request | Description |
|----------|---------|-------------|
| `admin/user-approvals/list` | `{}` | List pending users (newest first) |
| `admin/user-approvals/approve` | `{ userId: string }` | Set user to `'approved'`, stamp `approvedAt` |
| `admin/user-approvals/reject` | `{ userId: string }` | Set user to `'rejected'`, stamp `rejectedAt` (soft delete) |

## Client Hooks

```typescript
import { usePendingUsers, useApproveUser, useRejectUser } from '@/client/routes/template/UserApprovals/hooks';

// List pending users
const { data: pending, isLoading, error } = usePendingUsers();

// Approve (optimistic — removes from list immediately)
const approveMutation = useApproveUser();
approveMutation.mutate(userId);

// Reject (optimistic — removes from list immediately, shows ConfirmDialog first)
const rejectMutation = useRejectUser();
rejectMutation.mutate(userId);
```

## File Map

| File | Ownership | Purpose |
|------|-----------|---------|
| `src/apis/auth-overrides.ts` | Template (add to `projectOverrides` to customize) | `requireAdminApproval` flag |
| `src/apis/template/auth/auth-overrides-types.ts` | Template | `AuthOverrides` interface with flag type |
| `src/apis/template/auth/handlers/registerUser.ts` | Template | Pending branch, first-user-wins, Telegram notification |
| `src/apis/template/auth/handlers/loginUser.ts` | Template | Approval gate (pending/rejected check) |
| `src/apis/template/auth/types.ts` | Template | `RegisterResponse` with `pendingApproval` field |
| `src/apis/template/user-approvals/` | Template | Admin API domain (list/approve/reject handlers) |
| `src/client/routes/template/UserApprovals/` | Template | Admin approvals page + React Query hooks |
| `src/client/features/template/auth/LoginForm.tsx` | Template | `PendingApprovalScreen` component |
| `src/client/features/template/auth/hooks.ts` | Template | `useRegister` returns `RegisterResult` discriminated type |
| `src/client/components/template/NavLinks.template.tsx` | Template | Admin menu entry for `/admin/approvals` |
| `src/server/database/collections/template/users/types.ts` | Template | `approvalStatus`, `approvedAt`, `rejectedAt` fields |
| `src/server/database/collections/template/users/users.ts` | Template | `findPendingUsers`, `setUserApprovalStatus`, `isUsersCollectionEmpty` |

## Login Gate Ordering

When `requireAdminApproval` is enabled, the login handler checks approval status **before** any project-level `validateLogin` hook runs. This means:

- A pending/rejected user is blocked before `validateLogin` ever sees them.
- `validateLogin` hooks can assume they only see approved users.
- The admin (`ADMIN_USER_ID`) bypasses the approval gate entirely.

## Future Phase: User Notification on Approval

Notifying the approved user themselves (e.g. "your account is now active") is intentionally deferred. Only email is captured at signup, so user-facing notifications will require adding email infrastructure. The `approveUser` handler has a comment marking where this notification should go.
