# Authentication System Documentation

This document explains the authentication system, including the instant-boot pattern for PWA support.

## Architecture Overview

The authentication system uses:

1. **Zustand Store** (`authStore`) - Client-side auth state with localStorage persistence
2. **React Query** - Server data caching with localStorage persistence  
3. **HttpOnly Cookies** - Secure JWT token storage (server-side)

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layers                            │
├─────────────────────────────────────────────────────────────┤
│  localStorage (Zustand)     │  localStorage (React Query)    │
│  - isProbablyLoggedIn       │  - /me response cache          │
│  - userPublicHint           │  - All query data              │
│  - hintTimestamp            │                                │
├─────────────────────────────────────────────────────────────┤
│  HttpOnly Cookie (Server)                                    │
│  - JWT auth token (secure, not accessible to JS)             │
└─────────────────────────────────────────────────────────────┘
```

## Instant Boot Pattern

The app is designed to start instantly, even after iOS kills it in the background. This is achieved by:

1. **Persisting a "hint"** that the user is probably logged in
2. **Showing the app shell immediately** based on this hint
3. **Validating in background** with the server

### Why This Matters

Without instant boot:
```
App Start → Loading spinner (2-3 sec) → App renders
```

With instant boot:
```
App Start → App renders immediately → Background validation
```

## Auth Flow: First Time User (No Hint, No Cookie)

```
App Start
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  QueryProvider: Cache restore (non-blocking)                 │
│  localStorage may be empty → completes immediately           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BootGate waits for local rehydration                        │
│  - auth/settings/router stores rehydrate from localStorage   │
│  - isProbablyLoggedIn = false (no hint stored)               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthWrapper renders                                         │
│  isProbablyLoggedIn = false, isValidated = false             │
│  → Shows nothing (brief blank screen during /me check)       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  useAuthValidation() calls /me endpoint                      │
│  Server returns: { error: "Not authenticated" }              │
│  → isValidated = true, user = null                           │
│  → Shows Login Dialog (no error message displayed)           │
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

## Auth Flow: Cookie Session (No Hint, Valid Cookie)

This flow supports users who have a valid session cookie but no localStorage hint
(e.g., cleared localStorage, different tab, SSO scenarios):

```
App Start
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BootGate waits for local rehydration                        │
│  isProbablyLoggedIn = false (no hint stored)                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthWrapper renders                                         │
│  isProbablyLoggedIn = false, isValidated = false             │
│  → Shows nothing (brief blank screen during /me check)       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  useAuthValidation() calls /me endpoint                      │
│  Cookie is sent automatically with request                   │
│  Server returns: { user: { ... } }                           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  On success:                                                 │
│  - setValidatedUser() updates Zustand                        │
│  - isProbablyLoggedIn = true (saved for next boot)           │
│  - userPublicHint = { name, email, avatar }                  │
│  - isValidated = true, isAuthenticated = true                │
│  - App renders authenticated UI                              │
└─────────────────────────────────────────────────────────────┘
```

## Auth Flow: Returning User (Instant Boot)

```
App Start (e.g., after iOS killed the app)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  QueryProvider: Cache restore (~1-5ms)                       │
│  Restores React Query cache from localStorage                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  BootGate waits for local rehydration (fast)                 │
│  isProbablyLoggedIn = true                                   │
│  userPublicHint = { name: "Gil", email: "...", avatar: "..." }│
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthWrapper renders                                         │
│  isProbablyLoggedIn = true                                   │
│  → Shows App Shell immediately                               │
│  → TopNavBar shows avatar/name from userPublicHint           │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  useAuthValidation() runs in background                      │
│  Calls /me endpoint via React Query                          │
│  May serve cached response first (stale-while-revalidate)    │
└─────────────────────────────────────────────────────────────┘
    │
    ├─── If valid ──────────────────────────────────────────────┐
    │    - Updates user state with fresh data                   │
    │    - Refreshes hint for next boot                         │
    │    - User continues using app normally                    │
    │                                                           │
    └─── If 401 (session expired) ─────────────────────────────┐
         - Calls clearAuth()                                    │
         - Clears isProbablyLoggedIn and userPublicHint        │
         - Shows Login Dialog                                   │
         - User sees brief flash then login prompt              │
```

## Key Components

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

### Error Handling

Error messages are only shown for **user-initiated actions** (login/register), not for background validation:

| API Call | Shows Error? | Reason |
|----------|-------------|--------|
| `/me` (validation) | ❌ No | Expected for first-time/logged-out users - just show login |
| `auth/login` | ✅ Yes | User action - show "Invalid username or password" etc. |
| `auth/register` | ✅ Yes | User action - show "Username already taken" etc. |

This prevents confusing error messages like "Not authenticated" appearing when a new user first visits the app.

### AuthWrapper (`src/client/features/auth/AuthWrapper.tsx`)

Guards the app based on auth state with simple logic:

```typescript
const showApp = isAuthenticated || isProbablyLoggedIn;
const showLogin = isValidated && !isAuthenticated && !isProbablyLoggedIn;
```

- `showApp`: If authenticated OR have localStorage hint → render app immediately
- `showLogin`: Only shown AFTER validation explicitly confirms no user
- No loaders: Brief blank screen during validation (~100ms) is better than flickering loaders

**Key insight**: Using `isValidated` (not `!isValidating`) prevents login dialog flickering during Zustand hydration race conditions.

## Public Routes

Some routes need to be accessible without authentication (e.g., shared plan preview). These are configured using a hardcoded `PUBLIC_ROUTES` array in `AuthWrapper.tsx`:

```typescript
// Public routes that render without requiring authentication
// To add a new public route: add the path prefix here
const PUBLIC_ROUTES = ['/share'];
```

### How Public Routes Work

1. **AuthWrapper** checks `currentPath` against `PUBLIC_ROUTES`
2. If the path starts with any public route prefix, the app renders immediately without auth check
3. Components on public routes handle their own auth logic (e.g., showing "Login to Add" button)

### Adding a New Public Route

1. Add the path prefix to `PUBLIC_ROUTES` array in `src/client/features/auth/AuthWrapper.tsx`
2. Ensure the route's API endpoints don't require `context.userId` (or handle the unauthenticated case)
3. Handle optional authentication in the component (e.g., show login modal when needed)

### Example: Shared Plan Route (`/share/:token`)

```typescript
// In AuthWrapper.tsx
const PUBLIC_ROUTES = ['/share'];

// In SharedPlan.tsx - handles its own auth
const { isAuthenticated } = useAuthValidation();

{isAuthenticated ? (
    <Button onClick={handleAddPlan}>Add to My Plans</Button>
) : (
    <Button onClick={handleLoginToAdd}>Login to Add Plan</Button>
)}
```

### Dismissible Auth Modal

Public routes may show a login modal that users can dismiss:

```typescript
// IOSAuthModal with onOpenChange prop for dismissibility
<IOSAuthModal 
    isOpen={showLoginModal} 
    onOpenChange={handleModalClose}  // Optional - makes modal dismissible
>
    <LoginForm />
</IOSAuthModal>
```

When `onOpenChange` is provided, clicking the backdrop closes the modal. The global auth modal (in `AuthWrapper`) doesn't pass this prop, so it remains non-dismissible.

### Current Public Routes

| Route Pattern | Component | Description |
|---------------|-----------|-------------|
| `/share/:token` | `SharedPlan` | Shared plan preview (requires login to add plan) |

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

### Security Notes

- JWT tokens stored in **HttpOnly cookies** (not accessible to JavaScript)
- `isProbablyLoggedIn` is just a UI hint, not actual auth
- Real authentication is always validated server-side
- Token expiry handled by server, client just responds to 401

## TTL (Time-to-Live) Settings

| Data | TTL | Purpose |
|------|-----|---------|
| Auth hint (Zustand) | 7 days | Clear stale hints after inactivity |
| React Query cache | 24 hours | localStorage persistence max age |
| JWT token | Server-defined | Actual session expiry |

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

## Troubleshooting

### User sees brief blank screen then app loads
This is expected for users with a valid cookie but no localStorage hint (e.g., cleared localStorage). The `/me` check (~100ms) detects the valid session and logs them in. No loader is shown to avoid HMR/hydration flickering issues.

### User sees brief blank screen then login dialog (no error)
This is expected for first-time users or users with no valid session. The `/me` check returns "Not authenticated" but **no error is displayed** - the login dialog simply appears. Error messages only appear after failed login/register attempts.

### User sees app briefly then login dialog
This happens when the localStorage hint exists but the session has expired server-side. The instant boot shows the app, then validation fails and login is shown.

### Login dialog flickers briefly
This should not happen with the current implementation. If it does:
- Ensure AuthWrapper uses `isValidated` (not `!isValidating`) in the `showLogin` condition
- Check for race conditions between Zustand hydration and React Query

### Auth state not persisting
- Check localStorage for `auth-storage` key (Zustand)
- Check localStorage for React Query cache (`react-query-cache-v2`)
- Verify `hintTimestamp` hasn't expired (7 days)

### 401 errors after app restart
Session may have expired server-side. This is handled gracefully - user sees app briefly (instant boot), then login dialog after validation fails.
