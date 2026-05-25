---
title: Authentication
description: Instant-boot authentication pattern for PWA. Use this when working with auth flows.
summary: Uses `isProbablyLoggedIn` hint in localStorage for instant render, validates with server in background. JWT in HttpOnly cookie. Use `useUser()` for validated user, `useAuthStore(s => s.userPublicHint)` for instant-boot UI. Child projects can override login/signup logic via `src/apis/auth-overrides.ts` and control UI via `src/client/auth-config.ts`.
priority: 2
---

# Authentication System Documentation

This document explains the authentication system, including the **preflight optimization** and instant-boot pattern for PWA support.

## Architecture Overview

The authentication system uses:

1. **Auth Preflight** (`preflight.ts`) - Pre-flight /me call before React mounts
2. **Zustand Store** (`authStore`) - Client-side auth state with localStorage persistence
3. **React Query** - Server data caching with localStorage persistence  
4. **HttpOnly Cookies** - Secure JWT token storage (server-side)

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layers                            │
├─────────────────────────────────────────────────────────────┤
│  In-Memory (Module)         │  localStorage (Zustand)        │
│  - Preflight result         │  - isProbablyLoggedIn (hint)   │
│  - Preflight promise        │  - userPublicHint              │
│                             │  - hintTimestamp               │
├─────────────────────────────────────────────────────────────┤
│  localStorage (React Query)  │  HttpOnly Cookie (Server)     │
│  - /me response cache        │  - JWT auth token (secure)    │
│  - All query data            │                               │
└─────────────────────────────────────────────────────────────┘
```

## Auth Preflight (No Login Flash)

The **auth preflight** is the key innovation that ensures users with valid cookies **never see a login form flash**. It works by starting the `/me` API call immediately when the JS bundle loads, **before React even mounts**.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Traditional Flow (without preflight):                       │
│                                                              │
│  JS Loads → React Mounts → useAuthValidation → /me API → UI │
│                                                 ↑            │
│                              ~300-500ms blank screen here    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  With Preflight:                                             │
│                                                              │
│  JS Loads ─┬─→ Start /me API call (preflight.ts)            │
│            │   (runs in parallel with React init)            │
│            │                                                 │
│            └─→ React Mounts → Check preflight result → UI   │
│                               (usually already complete!)    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

1. `preflight.ts` is imported in `_app.tsx` as a **side effect**:
   ```typescript
   import '@/client/features/auth/preflight'; // Starts /me call immediately
   ```

2. The import runs `startAuthPreflight()` which starts a `fetch('/api/process/auth_me')`

3. The preflight runs **in parallel** with:
   - React Query cache restoration
   - Zustand store hydration
   - React component mounting

4. When `useAuthValidation()` hook runs in `AuthWrapper`, it:
   - First checks if preflight already has a result (sync check)
   - If yes: uses the result immediately
   - If no: waits for the preflight promise to resolve

### User Experience by Scenario

| Scenario | Experience |
|----------|------------|
| Valid cookie | App renders immediately, **never sees login** |
| Valid cookie + hint | App renders immediately from hint, validates in background |
| No cookie + hint | App shows from hint, preflight fails → login form |
| No cookie + no hint | Loading skeleton (~200ms) → login form |

## Instant Boot Pattern (Fallback)

The hint-based instant boot serves as a **fallback** when:
- The preflight hasn't completed yet (slow network)
- The user has a localStorage hint from a previous session

It works by:

1. **Persisting a "hint"** that the user is probably logged in
2. **Showing the app shell immediately** based on this hint
3. **Validating with preflight** (or React Query as fallback)

### Why This Matters

Without preflight or instant boot:
```
App Start → Loading spinner (300-500ms) → App renders
```

With preflight:
```
App Start → App renders immediately (preflight already done)
```

With instant boot (fallback):
```
App Start → App renders from hint → Background validation
```

## Auth Flow: First Time User (No Hint, No Cookie)

```
App Start (JS Bundle Loads)
    │
    ├──── Preflight starts /me API call immediately ────────────┐
    │     (runs in parallel with React initialization)          │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  QueryProvider: Cache restore (non-blocking)                 │ │
│  localStorage may be empty → completes immediately           │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  BootGate waits for local rehydration                        │ │
│  - auth/settings/router stores rehydrate from localStorage   │ │
│  - isProbablyLoggedIn = false (no hint stored)               │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  AuthWrapper renders                                         │ │
│  isProbablyLoggedIn = false, preflight pending               │ │
│  → Shows loading skeleton (brief ~200ms)                     │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  useAuthValidation() checks preflight result   ◄─────────────┘
│  Preflight returns: { user: null } (no session, NOT an error)│
│  → isValidated = true, user = null                           │
│  → Shows Login Dialog                                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  User logs in via LoginForm                                  │
│  useLogin() mutation calls server                            │
│  Server validates, sets HttpOnly JWT cookie                  │
│  Returns user data                                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  On success:                                                 │
│  - Zustand: isProbablyLoggedIn=true, userPublicHint={...}   │
│  - React Query: caches /me response to localStorage          │
│  - App renders authenticated UI                              │
└─────────────────────────────────────────────────────────────┘
```

**Key improvement:** Instead of a blank screen, new users see a loading skeleton that mimics the app layout, providing a polished experience.

## Auth Flow: Cookie Session (No Hint, Valid Cookie) - NO LOGIN FLASH

This flow supports users who have a valid session cookie but no localStorage hint
(e.g., cleared localStorage, different tab, SSO scenarios). **Thanks to preflight, these users never see a login form.**

```
App Start (JS Bundle Loads)
    │
    ├──── Preflight starts /me API call immediately ────────────┐
    │     Cookie sent automatically with request                │
    │     (runs in parallel with React initialization)          │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  BootGate waits for local rehydration                        │ │
│  isProbablyLoggedIn = false (no hint stored)                 │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  AuthWrapper renders                                         │ │
│  - Checks preflight result (may already be complete!)        │ │
│  - If preflight complete with user → show app immediately    │ │
│  - If preflight pending → show loading skeleton briefly      │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  useAuthValidation() uses preflight result   ◄───────────────┘
│  Preflight returns: { user: { ... } }                        │
│  → setValidatedUser() immediately                            │
│  → App renders authenticated UI (NO LOGIN FLASH!)            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-validation:                                            │
│  - isProbablyLoggedIn = true (saved for next boot)           │
│  - userPublicHint = { name, email, avatar }                  │
│  - isValidated = true, isAuthenticated = true                │
└─────────────────────────────────────────────────────────────┘
```

**Key improvement:** Users with valid cookies go directly from loading skeleton to app content. They **never** see the login form, even if localStorage was cleared.

## Auth Flow: Returning User (Instant Boot with Preflight)

```
App Start (e.g., after iOS killed the app)
    │
    ├──── Preflight starts /me API call immediately ────────────┐
    │     (runs in parallel, validates session)                 │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  QueryProvider: Cache restore (~1-5ms)                       │ │
│  Restores React Query cache from localStorage                │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  BootGate waits for local rehydration (fast)                 │ │
│  isProbablyLoggedIn = true                                   │ │
│  userPublicHint = { name: "Gil", email: "...", avatar: "..." }│ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  AuthWrapper renders                                         │ │
│  isProbablyLoggedIn = true (from hint)                       │ │
│  → Shows App Shell immediately (instant boot!)               │ │
│  → TopNavBar shows avatar/name from userPublicHint           │ │
└─────────────────────────────────────────────────────────────┘ │
    │                                                           │
    ▼                                                           │
┌─────────────────────────────────────────────────────────────┐ │
│  useAuthValidation() checks preflight result ◄───────────────┘
│  Preflight usually completes around this time                │
│  Uses preflight result instead of separate /me call          │
└─────────────────────────────────────────────────────────────┘
    │
    ├─── If valid ──────────────────────────────────────────────┐
    │    - Updates user state with fresh data                   │
    │    - Refreshes hint for next boot                         │
    │    - User continues using app (no interruption!)          │
    │                                                           │
    └─── If 401 (session expired) ─────────────────────────────┐
         - Calls clearAuth()                                    │
         - Clears isProbablyLoggedIn and userPublicHint        │
         - Shows Login Dialog                                   │
         - User sees brief flash then login prompt              │
```

**Key improvement:** The preflight runs in parallel with instant boot, so validation happens faster. For valid sessions, the app is fully authenticated by the time the user starts interacting.

## Auth Flow: Offline (with localStorage Hints)

When the device is offline, the preflight is skipped entirely and the app relies on localStorage hints for instant boot.

```
App Start (Offline - navigator.onLine = false)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Preflight checks navigator.onLine                          │
│  → Offline detected                                         │
│  → Returns { data: null, skippedOffline: true }             │
│  → Does NOT make network request                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Zustand hydrates from localStorage                         │
│  isProbablyLoggedIn = true (from previous session)          │
│  userPublicHint = { name, avatar, email }                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  useAuthValidation processes preflight result               │
│  → Sees skippedOffline = true                               │
│  → Sets hasValidated.current = true (prevents fallback!)    │
│  → Does NOT clear isProbablyLoggedIn hints                  │
│  → Sets isValidating = false                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthWrapper evaluates                                      │
│  showApp = isAuthenticated || isProbablyLoggedIn            │
│         = false || true = TRUE ✅                           │
│  showLogin = false (isValidated is false)                   │
│  showLoading = false (isValidating is false)                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  App renders instantly from cached localStorage! ✅          │
│  - TopNavBar shows avatar/name from userPublicHint          │
│  - React Query serves cached data                           │
│  - User can work offline seamlessly                         │
└─────────────────────────────────────────────────────────────┘
```

### The `skippedOffline` Flag

When the preflight returns `data: null`, it could mean two different things:

| `data: null` | `skippedOffline` | Meaning | Action |
|--------------|------------------|---------|--------|
| ✓ | `false` | Server confirmed no valid session | **Clear hints** → show login |
| ✓ | `true` | Network unavailable, couldn't check | **Keep hints** → show cached app |

This distinction is critical:
- Without `skippedOffline`, we can't tell if `null` means "server says no session" or "network failed"
- With `skippedOffline`, we know to trust localStorage hints and render the app

### Why This Matters for Offline

```typescript
// In handlePreflightResult:
if (skippedOffline) {
    // Network unavailable - trust localStorage hints
    hasValidated.current = true;  // Prevents fallback query!
    setValidating(false);
    // Do NOT call clearAuth() - keep the hints
    return;
}

// Only reaches here if we got a real server response
if (data?.user) {
    setValidatedUser(data.user);
} else {
    clearAuth();  // Safe - server explicitly said "no session"
}
```

### Offline User Experience

| Scenario | Result |
|----------|--------|
| Offline + has `isProbablyLoggedIn` hint | **App shows immediately** from cache |
| Offline + no hint (new user) | Login form shows (expected) |
| Online → goes offline mid-session | App continues working with cached data |

📚 **Related**: See [offline-pwa-support.md](./offline-pwa-support.md) for complete offline architecture.

## Key Components

### Auth Preflight (`src/client/features/auth/preflight.ts`)

The preflight module starts the `/me` API call immediately when imported:

```typescript
// In _app.tsx - imported as side effect
import '@/client/features/auth/preflight';

// preflight.ts exports:
export function startAuthPreflight(): void;    // Called automatically on import
export function getPreflightResult(): PreflightResult | null;  // Sync check
export async function waitForPreflight(): Promise<PreflightResult | null>;  // Async wait
export function isPreflightComplete(): boolean;
export function resetPreflight(): void;        // For logout
```

The preflight:
1. Runs immediately when the module is imported (before React mounts)
2. Checks `navigator.onLine` - if offline, returns `{ skippedOffline: true }` immediately
3. If online, makes a `fetch('/api/process/auth_me', { credentials: 'include' })` call
4. Stores the result in module-level variables
5. `useAuthValidation()` hook consumes the result

### Zustand Auth Store (`src/client/features/auth/store.ts`)

```typescript
interface AuthState {
    // Persisted (localStorage) - for instant boot
    isProbablyLoggedIn: boolean;      // Hint: user was logged in
    userPublicHint: UserPublicHint;   // Name, email, avatar for UI
    hintTimestamp: number;            // TTL check (7 days)
    
    // Runtime only (not persisted)
    user: UserResponse | null;        // Full validated user
    isValidated: boolean;             // Server confirmed auth
    isValidating: boolean;            // Validation in progress
    
    // Actions
    setUserHint(hint): void;
    setValidatedUser(user): void;
    clearAuth(): void;
}
```

### Auth Hooks (`src/client/features/auth/hooks.ts`)

All auth-related hooks in one file:
- `useAuthValidation()` - Background validation pattern (silent errors)
- `useLogin()` - Login mutation, updates Zustand on success
- `useRegister()` - Registration mutation
- `useLogout()` - Clears auth state and React Query cache
- `useCurrentUser()` - Fetches current user via React Query

### Response Format

The `/me` endpoint returns different responses based on auth state:

| Response | Meaning | Is Error? |
|----------|---------|-----------|
| `{ user: UserResponse }` | Authenticated user | ❌ No |
| `{ user: null }` | No session (new user) | ❌ No - normal flow |
| `{ error: "User not found" }` | Token valid but user deleted | ✅ Yes |

**Key design decision**: `{ user: null }` is NOT an error - it's the expected response for new users or users without a session. This prevents confusing error messages in the console.

### Error Handling

Error messages are only shown for **user-initiated actions** (login/register), not for background validation:

| API Call | Shows Error? | Reason |
|----------|-------------|--------|
| `/me` → `{ user: null }` | ❌ No | Expected for new users - just show login |
| `/me` → `{ error: "..." }` | ❌ No | Rare case - show login silently |
| `auth/login` | ✅ Yes | User action - show "Invalid username or password" etc. |
| `auth/register` | ✅ Yes | User action - show "Username already taken" etc. |

### AuthWrapper (`src/client/features/auth/AuthWrapper.tsx`)

Guards the app based on auth state with simple logic. **AuthWrapper is rendered inside RouterProvider** so it has access to the router context and re-renders on navigation.

```typescript
// Get isPublicRoute from router context (re-renders on navigation)
const { isPublicRoute } = useRouter();

// Public routes bypass authentication entirely
if (isPublicRoute) {
    return <>{children}</>;
}

const showApp = isAuthenticated || isProbablyLoggedIn;
const showLogin = isValidated && !isAuthenticated && !isProbablyLoggedIn;
const showLoading = isValidating && !isProbablyLoggedIn && !isAuthenticated;
```

- **Public routes**: Render immediately without any auth check
- `showApp`: If authenticated OR have localStorage hint → render app immediately
- `showLogin`: Only shown AFTER validation explicitly confirms no user
- `showLoading`: Show loading skeleton while preflight is pending (only for users without hint)

**Why AuthWrapper is inside RouterProvider:**
- AuthWrapper needs to re-render when the route changes (e.g., navigating from public to protected route)
- RouterProvider provides `isPublicRoute` via context, computed from route metadata
- This ensures auth is always checked when navigating to protected routes, even from public routes

### Public Routes

Routes can be marked as public to bypass authentication entirely. Public routes render immediately without waiting for auth validation.

```typescript
// src/client/routes/index.ts
export const routes = createRoutes({
  // Standard routes (require authentication)
  '/': Home,
  '/settings': Settings,
  
  // Public routes (no authentication required)
  '/share/:id': { component: SharePage, public: true },
  '/landing': { component: LandingPage, public: true },
});
```

**How it works:**
1. `RouterProvider` computes `isPublicRoute` from route metadata when matching the current route
2. `AuthWrapper` (inside RouterProvider) gets `isPublicRoute` from `useRouter()` context
3. If `isPublicRoute` is true, children render immediately without auth checks
4. When user navigates from public to protected route, AuthWrapper re-renders and checks auth

**When to use `public: true`:**
- Share pages that should be accessible via link without login
- Landing pages or marketing pages
- Public documentation pages

**Note:** Public routes are defined via route metadata, NOT a hardcoded list in `AuthWrapper`. The router computes `isPublicRoute` and provides it via context, keeping auth logic clean and ensuring proper re-rendering on navigation.

📚 See: [pages-and-routing-guidelines](project-guidelines/pages-and-routing-guidelines.md) for route configuration details.

**Loading Skeleton**: Instead of a blank screen, `AuthWrapper` now shows a polished loading skeleton that mimics the app layout (nav bar, progress card, exercise cards, bottom nav). This provides a better experience for new users.

**Key insight**: Using `isValidated` (not `!isValidating`) prevents login dialog flickering during Zustand hydration race conditions.

## Admin Flag (`isAdmin`)

Authentication responses include `user.isAdmin` so the client can enable admin-only UI immediately after login.

- Admin is configured via `ADMIN_USER_ID` (user.id / Mongo `_id` string).
- The server returns `isAdmin` on:
  - `auth/login`
  - `auth/register`
  - `auth/me`

📚 See: [admin.md](./admin.md)

## Server-Side Authentication

### JWT Token Flow

1. **Login/Register**: Server validates credentials, generates JWT, sets HttpOnly cookie
2. **API Requests**: Cookie automatically sent with every request
3. **Validation**: `processApiCall` middleware extracts and verifies JWT
4. **Context**: User ID passed to API handlers for authorization

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `auth/login` | POST | Authenticate user, set JWT cookie |
| `auth/register` | POST | Create user, set JWT cookie |
| `auth/me` | POST | Get current user (validates token) |
| `auth/logout` | POST | Clear JWT cookie |
| `auth/update-profile` | POST | Update profile fields (username, email, 2FA, etc.) |
| `auth/change-password` | POST | Change password for authenticated user |
| `auth/request-password-reset` | POST | Send a Telegram reset link (always returns success — anti-enumeration) |
| `auth/reset-password` | POST | Redeem a reset token and set a new password |

### Security Notes

- JWT tokens stored in **HttpOnly cookies** (not accessible to JavaScript)
- `isProbablyLoggedIn` is just a UI hint, not actual auth
- Real authentication is always validated server-side
- Token expiry handled by server, client just responds to 401
- **Long-lived tokens (10 years)**: This project uses 10-year JWT expiry for PWA/mobile-like experience where users expect to stay logged in indefinitely. Security is maintained via HttpOnly cookies and server-side validation.

### Change Password Flow

The `auth/change-password` endpoint lets an authenticated user replace their password. Handler: `src/apis/template/auth/handlers/changePassword.ts`. UI: `src/client/routes/template/Profile/components/ChangePasswordDialog.tsx`, opened from the Security section in Profile.

**Server flow:**
1. Require `context.userId` (rejects unauthenticated callers)
2. Validate input — both fields present, new password ≥ 8 chars, must differ from current
3. `bcrypt.compare(currentPassword, user.password_hash)` — generic error message on mismatch (`"Current password is incorrect"`) to avoid leaking which check failed
4. `bcrypt.hash(newPassword, SALT_ROUNDS)` and persist via `users.updateUser`
5. Fire-and-forget `sendTelegramNotificationToUser(userId, "Your password was just changed…")` so a hijacked session can't silently rotate the password without the real owner finding out. Skips silently if the user has no Telegram chat ID configured. Failure is logged but does not fail the request.

**Client flow (`useChangePassword`):**
- Standard React Query mutation. No optimistic update — this is a security operation that must wait for server confirmation, no offline support.
- An empty `{}` response (the offline-queue convention from `apiClient`) is treated as failure with a "You must be online" message, so users aren't told it succeeded when the request was just queued.

**Intentional simplifications (current MVP):**
- **No token / session invalidation.** Existing JWTs on other devices remain valid until they expire. This is consistent with the rest of the system (10-year tokens, no revocation anywhere). If you later need "log out all devices", add a `tokenVersion` field on the user, include it in the JWT payload, increment it on password change, and check it in `getUserContext.ts` — that would invalidate every existing token globally in one place.
- **No rate limiting.** The endpoint requires a valid auth cookie *and* the current password, so it isn't a public brute-force surface.
- **No `validateNewPassword` override hook.** Min length 8 is hardcoded in the handler. Add an entry to `auth-overrides-types.ts` if a child project needs a custom policy.

### Forgot Password Flow (Telegram)

Lets a logged-out user reset their password via a one-time link delivered through Telegram. There is no email path — Telegram is the only out-of-band channel the template supports. Users without a `telegramChatId` configured cannot use this flow and must contact the administrator.

**Files:**
- Server: `src/apis/template/auth/handlers/requestPasswordReset.ts`, `src/apis/template/auth/handlers/resetPassword.ts`
- Token storage: `src/server/database/collections/template/password-reset-tokens/`
- UI: `src/client/features/template/auth/ForgotPasswordDialog.tsx` (opened from `LoginForm`), `src/client/routes/template/ResetPassword/`

**Flow:**
1. From the login form, the user clicks "Forgot password?" and submits their username.
2. `auth/request-password-reset` looks up the user. If found and they have a `telegramChatId`, it generates a 32-byte random token, stores **only the SHA-256 hash** in `password_reset_tokens` (TTL 30 minutes, single-use), and fires-and-forgets a Telegram message containing `{baseUrl}/reset-password?token={rawToken}`. The endpoint **always** returns `{ success: true }` regardless of outcome — see "Anti-enumeration" below.
3. The user opens the link in Telegram. The `/reset-password` route reads the token from the URL, prompts for a new password (≥ 8 chars + confirmation), and calls `auth/reset-password`.
4. `auth/reset-password` hashes the incoming token, looks up an unconsumed/unexpired record, **atomically marks it consumed** (race-safe with `findOneAndUpdate`), updates the user's `password_hash`, invalidates any other outstanding tokens for that user, and sends a Telegram confirmation. On success the user is redirected to sign in.

**Security properties:**
- **Anti-enumeration (response payload)**: `auth/request-password-reset` returns the same `{ success: true }` whether the username exists, doesn't exist, exists-but-not-approved, or exists-but-has-no-Telegram. The Telegram send is fire-and-forget so response time doesn't leak whether Telegram was actually called. **Caveat**: the DB lookup and token-insert paths still differ in cost between branches, so a sophisticated attacker can probe usernames by *response timing* alone. Add upper-bounded random delays or dummy DB work in the early-exit branches if this matters for your threat model.
- **Approval gate**: pending/rejected users cannot trigger a reset (mirrors the login gate), even though the response looks identical to the user-doesn't-exist case.
- **Token is never stored in plaintext**: only the SHA-256 hash. A DB compromise does not expose live reset links.
- **Single-use + 30-min validity**: tokens are atomically consumed via `findOneAndUpdate` and rejected after `expiresAt`. Successful reset also invalidates any sibling tokens for the same user. **Note**: there is no MongoDB TTL index — consumed/expired token rows accumulate indefinitely. Same pattern as `login_approvals`. Add a TTL index on `expiresAt` (or a sweeper job) if this becomes a storage concern.
- **Confirmation notification**: a successful reset triggers a follow-up Telegram message so an attacker who manages to intercept a token can't silently take over without the real owner being notified.

**Intentional simplifications (current MVP):**
- **No rate limiting on `auth/request-password-reset`**. An unauthenticated attacker could spam the endpoint to send Telegram messages to a user. Tradeoff is small (Telegram messages are throttled by their API) but worth adding a per-IP / per-username cooldown if abuse appears.
- **No verify-token endpoint**. The reset page accepts any non-empty token and only validates on submit, so an expired link shows the error after the user types a password. Add a verify endpoint if the extra UX polish is worth a third route.
- **No "log out all devices" after reset**. Same reasoning as the change-password flow — see above.
- **No `tokenVersion` rotation**. A legitimate user who resets after suspecting compromise won't kick the attacker off other devices. The fix is the same `tokenVersion` work mentioned in the change-password section.

## TTL (Time-to-Live) Settings

| Data | TTL | Purpose |
|------|-----|---------|
| Auth hint (Zustand) | 7 days | Clear stale hints after inactivity |
| React Query cache | 24 hours | localStorage persistence max age |
| JWT token + Cookie | 10 years | Session expiry (effectively permanent) |

## Auth Overrides (Project-Specific Logic)

Child projects can customize login/signup behavior without modifying template code. Two project-owned files control this:

### Server-Side Overrides (`src/apis/auth-overrides.ts`)

Define `validateLogin` and/or `validateRegistration` hooks to reject login or signup attempts with custom logic. Return an error string to reject, or `undefined` to allow.

```typescript
import type { AuthOverrides } from './template/auth/auth-overrides-types';

export const authOverrides: AuthOverrides = {
  // Example: Admin-only login
  validateLogin: async ({ user }) => {
    const adminUserId = process.env.ADMIN_USER_ID;
    if (adminUserId && user._id.toString() !== adminUserId) {
      return 'Login is restricted to administrators only';
    }
  },

  // Example: Disable new signups
  validateRegistration: async () => {
    return 'Registration is currently disabled';
  },
};
```

**Hook timing:**
- `validateLogin` runs **after** password verification, before JWT is issued. Receives the full `User` object from the database.
- `validateRegistration` runs **before** user creation, after input validation.

**Available parameters:**

| Hook | Parameters |
|------|-----------|
| `validateLogin` | `{ user: User, request: LoginRequest, context: ApiHandlerContext }` |
| `validateRegistration` | `{ request: RegisterRequest, context: ApiHandlerContext }` |

### Client-Side Config (`src/client/auth-config.ts`)

Controls login form UI behavior:

```typescript
export const authConfig = {
  /** Set to false to hide the registration option from the login form */
  allowRegistration: true,
};
```

When `allowRegistration` is `false`, the "Don't have an account? Sign up" toggle is hidden from the login form.

### Common Patterns

| Use Case | Server Override | Client Config |
|----------|----------------|---------------|
| Disable signups | `validateRegistration` returns error | `allowRegistration: false` |
| Admin-approved signups | `requireAdminApproval: true` | No change needed |
| Admin-only login | `validateLogin` checks `ADMIN_USER_ID` | No change needed |
| Email domain restriction | `validateRegistration` checks email domain | No change needed |
| Invite-only registration | `validateRegistration` checks invite code | No change needed |

> **Security note:** `allowRegistration: false` only hides the signup UI. Direct API calls to `auth/register` will still succeed unless you also add a `validateRegistration` server override. Always set **both** when disabling signups.

### Admin-Approved Signups

**Enabled by default.** New signups land in `pending` status until an admin approves via `/admin/approvals`. First-user-wins bootstrap auto-approves the first signup on a fresh deployment. Set `requireAdminApproval: false` in `src/apis/auth-overrides.ts` to allow open signups.

See **[admin-approved-signups.md](./admin-approved-signups.md)** for the full reference: flow details, bootstrap setup, security caveats, schema, API endpoints, client hooks, and file map.

### File Ownership & Template Sync

Both config files are included in `templatePaths` with safe defaults (no overrides, registration enabled). They sync to all child projects automatically so the template never breaks.

To customize: edit the files in your child project, then add them to `projectOverrides` in `.template-sync.json` to prevent future syncs from overwriting your changes.

```json
{
  "projectOverrides": [
    "src/apis/auth-overrides.ts",
    "src/client/auth-config.ts"
  ]
}
```

| File | Synced | Purpose |
|------|--------|---------|
| `src/apis/template/auth/auth-overrides-types.ts` | Yes (template) | `AuthOverrides` interface |
| `src/apis/auth-overrides.ts` | Yes (defaults), add to `projectOverrides` to customize | Server-side overrides |
| `src/client/auth-config.ts` | Yes (defaults), add to `projectOverrides` to customize | Client-side UI config |

## Usage Examples

### Checking Auth State in Components

```typescript
import { useAuthStore, useUser, useIsAuthenticated } from '@/client/features/auth';

function MyComponent() {
    // Get validated user
    const user = useUser();
    
    // Check if fully authenticated
    const isAuthenticated = useIsAuthenticated();
    
    // Or for instant-boot UI (before validation)
    const userHint = useAuthStore((s) => s.userPublicHint);
    const isProbablyLoggedIn = useAuthStore((s) => s.isProbablyLoggedIn);
}
```

### Performing Login

```typescript
import { useLogin } from '@/client/features/auth';

function LoginForm() {
    const loginMutation = useLogin();
    
    const handleSubmit = (credentials) => {
        loginMutation.mutate(credentials, {
            onSuccess: () => {
                // User is now logged in
                // Zustand and React Query are automatically updated
            },
            onError: (error) => {
                // Show error message
            }
        });
    };
}
```

### Changing Password

```typescript
import { useChangePassword } from '@/client/features/auth';

function ChangePasswordForm() {
    const changePasswordMutation = useChangePassword();

    const handleSubmit = (currentPassword: string, newPassword: string) => {
        changePasswordMutation.mutate(
            { currentPassword, newPassword },
            {
                onSuccess: () => {
                    // Password changed; user stays logged in on this device.
                    // Other devices keep their existing JWTs (no global invalidation).
                },
                onError: (error) => {
                    // error.message is safe to show — generic for auth failures
                },
            }
        );
    };
}
```

### Performing Logout

```typescript
import { useLogout } from '@/client/features/auth';

function LogoutButton() {
    const logoutMutation = useLogout();
    
    return (
        <button onClick={() => logoutMutation.mutate()}>
            Logout
        </button>
    );
}
```

## Boot Performance Logging

The auth system includes built-in performance logging to diagnose startup issues. Enable it in browser console:

```js
localStorage.setItem('debug:boot-performance', 'true');
location.reload();
```

This logs timing for each boot phase:
```
[Boot] ▶ Auth Preflight Start started at +20ms
[Boot] ✓ Auth Preflight Complete in 180ms (total: +200ms)
[Boot] ● BootGate Passed at +50ms
[Boot] ● AuthWrapper Render at +55ms
[Boot] ● Auth Validation Complete at +200ms
[Boot] ● App Content Shown at +210ms
[Boot] 📊 Performance Summary
```

Boot performance logging is always enabled in development mode.

## Troubleshooting

### User sees loading skeleton then app loads (valid cookie)
This is the expected flow for users with a valid cookie but no localStorage hint. The loading skeleton is shown briefly (~200ms) while the preflight `/me` call completes. Once authenticated, the app renders immediately.

### User sees loading skeleton then login dialog (new user)
This is expected for first-time users or users with no valid session. The preflight returns `{ user: null }` (not an error, just "no session") and the login dialog appears. Error messages only appear after failed login/register attempts.

### User sees app briefly then login dialog
This happens when the localStorage hint exists but the session has expired server-side. The instant boot shows the app from the hint, then preflight validation fails and login is shown.

### Login dialog flickers briefly
This should not happen with the current implementation. If it does:
- Ensure AuthWrapper uses `isValidated` (not `!isValidating`) in the `showLogin` condition
- Check for race conditions between Zustand hydration and preflight
- Enable boot performance logging to see timing

### User with valid cookie sees login form (shouldn't happen!)
If this occurs, it means the preflight isn't working correctly:
- Check browser console for preflight errors
- Verify `/api/auth_me` endpoint is responding correctly
- Enable boot performance logging to check preflight timing
- Ensure `preflight.ts` is imported in `_app.tsx`

### Auth state not persisting
- Check localStorage for `auth-storage` key (Zustand)
- Check localStorage for React Query cache (`react-query-cache-v2`)
- Verify `hintTimestamp` hasn't expired (7 days)

### 401 errors after app restart
Session may have expired server-side. This is handled gracefully - user sees loading skeleton or app from hint, then login dialog after preflight validation fails.

### Offline user sees login form (should see cached app)
If a user with localStorage hints goes offline and sees the login form instead of the cached app:
- Check that `preflight.ts` returns `{ skippedOffline: true }` when `!navigator.onLine`
- Verify `handlePreflightResult` sets `hasValidated.current = true` for `skippedOffline` case
- The fallback React Query should NOT be enabled when offline
- Enable boot performance logging to trace the flow
