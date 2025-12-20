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
│  - auth/settings/router stores rehydrate from localStorage    │
│  - isProbablyLoggedIn = false (no hint stored)               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthWrapper renders                                         │
│  isProbablyLoggedIn = false, isValidating = true             │
│  → Shows Loading spinner (checking for cookie session)       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  useAuthValidation() calls /me endpoint                      │
│  Server returns: { error: "Not authenticated" }              │
│  → isValidating = false                                      │
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
│  isProbablyLoggedIn = false, isValidating = true             │
│  → Shows Loading spinner (checking for cookie session)       │
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
- `useAuthValidation()` - Background validation pattern
- `useLogin()` - Login mutation, updates Zustand on success
- `useRegister()` - Registration mutation
- `useLogout()` - Clears auth state and React Query cache
- `useCurrentUser()` - Fetches current user via React Query

### AuthWrapper (`src/client/features/auth/AuthWrapper.tsx`)

Guards the app based on auth state:
- If `isProbablyLoggedIn && !isValidated` → render app immediately (instant boot with loading bar)
- If `isAuthenticated` (validated) → render app
- If `isValidating && !isProbablyLoggedIn` → show loading spinner (checking cookie session)
- Otherwise → show login dialog

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

### User sees brief loading spinner then app loads
This is expected for users with a valid cookie but no localStorage hint (e.g., cleared localStorage). The `/me` check detects the valid session and logs them in.

### User sees app briefly then login dialog
This happens when the localStorage hint exists but the session has expired server-side. The instant boot shows the app, then validation fails and login is shown.

### User stuck on loading
Check if localStorage restore is blocked by the browser or storage access is denied. React Query restore is non-blocking, and BootGate should only be a brief local step.

### Auth state not persisting
- Check localStorage for `auth-storage` key (Zustand)
- Check localStorage for React Query cache (`react-query-cache-v2`)
- Verify `hintTimestamp` hasn't expired (7 days)

### 401 errors after app restart
Session may have expired server-side. This is handled gracefully - user sees app briefly (instant boot), then login dialog after validation fails.
