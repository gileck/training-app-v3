# Project Guidelines

This file provides Claude with context about the project's architecture, coding standards, and best practices. Each section summarizes a documentation file with key points and links to detailed docs.

---

## Architecture Overview

This is a **Next.js PWA** with offline-first capabilities, optimized for instant boot and seamless offline experience.

**Core Principles:**
- **Offline-First**: App works without network, syncs when online
- **Fast Boot**: Uses cached state (localStorage) for instant startup
- **Optimistic Updates**: All mutations update UI immediately before server confirms
- **Feature-Based Organization**: Code organized by feature, not type

### Project Structure

```
src/
├── client/
│   ├── features/       # Feature modules (stores, hooks, components)
│   ├── routes/         # Route/page components with route-specific hooks
│   ├── components/     # Shared UI components only (ui/, layout/)
│   ├── stores/         # Store factory & registry infrastructure
│   └── query/          # React Query infrastructure
├── apis/               # API definitions (types, handlers, client functions)
├── server/             # Server-side code
└── pages/              # Next.js pages
```

---

## State Management

Dual-store architecture optimized for PWA with offline support.

**Summary:** The app uses Zustand for client state and React Query for server state, both persisted to localStorage for instant boot and offline support.

**Key Points:**
- **React Query** for API data (todos, users, any fetched data)
- **Zustand** for client state (settings, auth hints, route persistence)
- **useState** for ephemeral UI (modals, form inputs)
- All Zustand stores MUST use `createStore` factory from `@/client/stores`
- Direct zustand imports are blocked by ESLint

```typescript
import { createStore } from '@/client/stores';

const useMyStore = createStore<MyState>({
    key: 'my-storage',
    label: 'My Store',
    creator: (set) => ({ ... }),
    persistOptions: { ... },  // OR inMemoryOnly: true
});
```

**Docs:** [docs/state-management.md](docs/state-management.md), [docs/react-query-mutations.md](docs/react-query-mutations.md), [docs/zustand-stores.md](docs/zustand-stores.md)

**Rules:** [.cursor/rules/state-management-guidelines.mdc](.cursor/rules/state-management-guidelines.mdc)

---

## Authentication

Instant-boot authentication pattern for PWA.

**Summary:** Uses `isProbablyLoggedIn` hint in localStorage to render app immediately, then validates with server in background. JWT stored in HttpOnly cookie.

**Key Points:**
- Auth state stored in Zustand (`features/auth`), user data cached in React Query
- **First visit**: Brief blank screen → login dialog (no error shown)
- **Returning user**: App renders instantly from hint → background validation
- **Session expired**: App renders → validation fails → login dialog
- Use `useUser()` for validated user, `useIsAuthenticated()` for auth check
- Use `useAuthStore(s => s.userPublicHint)` for instant-boot UI (before validation)

**Docs:** [docs/authentication.md](docs/authentication.md)

---

## Caching Strategy

Single-layer client cache using localStorage.

**Summary:** React Query handles all API caching with localStorage persistence (~5MB, ~1ms reads). IndexedDB was removed due to unreliable performance on some systems.

**Key Points:**
- **staleTime**: How long data is "fresh" before refetching (default 30s)
- **gcTime**: How long to keep data in memory after unmount (default 30min)
- **persistMaxAge**: localStorage TTL (default 7 days)
- User can toggle "Use Cache" in Settings
- All queries use `useQueryDefaults()` for centralized cache config
- Large queries can be excluded from persistence

**Docs:** [docs/caching-strategy.md](docs/caching-strategy.md)

---

## Offline/PWA Support

Full offline support with service worker and optimistic updates.

**Summary:** When offline, GET requests serve cached data via React Query, POST requests are queued in localStorage and batch-synced when online.

**Key Points:**
- **Offline banner** appears at top of screen when offline
- **Batch sync alert** shows sync progress when coming back online
- POST requests return `{}` when offline (not an error)
- **CRITICAL - Optimistic-Only Pattern**: Never update UI from server response

```typescript
useMutation({
    mutationFn: async (data) => { ... },
    onMutate: async (vars) => {
        // UPDATE UI HERE - this is the source of truth
        const previous = queryClient.getQueryData(['key']);
        queryClient.setQueryData(['key'], newValue);
        return { previous };
    },
    onError: (err, vars, context) => {
        // ONLY rollback on error
        queryClient.setQueryData(['key'], context.previous);
    },
    onSuccess: () => {}, // EMPTY - never update from server response
    onSettled: () => {}, // EMPTY - never invalidateQueries
});
```

**Docs:** [docs/offline-pwa-support.md](docs/offline-pwa-support.md)

---

## Client-Server Communication

Single API endpoint pattern with React Query for data fetching.

**Summary:** All APIs route through `/api/process/{api_name}`. Components use React Query hooks, never call API client functions directly.

**Key Points:**
- API structure per domain: `types.ts`, `index.ts`, `server.ts`, `client.ts`, `handlers/`
- API names use slashes internally, underscores in URLs: `auth/login` → `/api/process/auth_login`
- Request format: `POST { params: {...}, options: {...} }`
- Response format: `{ data: T, isFromCache: boolean }`
- All domain types MUST be in `apis/<domain>/types.ts`

```typescript
// In routes/[ROUTE]/hooks.ts
export function useTodos() {
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
```

**Docs:** [docs/api-endpoint-format.md](docs/api-endpoint-format.md)
**Rules:** [.cursor/rules/client-server-communications.mdc](.cursor/rules/client-server-communications.mdc)

---

## React Components

Component organization and patterns.

**Summary:** Use feature-based organization with small, focused components. Route-specific code stays in route folder, shared features go in `features/`.

**Key Points:**
- Split components when exceeding 150 lines
- Route-specific components in `src/client/routes/[ROUTE]/components/`
- Feature components in `src/client/features/[FEATURE]/`
- Shared UI primitives only in `src/client/components/ui/`
- **CRITICAL - Loading States**: Always check in order: Loading → Error → Empty → Data

```typescript
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage />;
if (!data) return <p>Unable to load</p>;
if (items.length === 0) return <EmptyState />;
return <ItemList items={items} />;
```

**Rules:** [.cursor/rules/react-component-organization.mdc](.cursor/rules/react-component-organization.mdc), [.cursor/rules/react-hook-organization.mdc](.cursor/rules/react-hook-organization.mdc), [.cursor/rules/feature-based-structure.mdc](.cursor/rules/feature-based-structure.mdc)

---

## UI & Styling

shadcn/ui components with semantic theming.

**Summary:** Use shadcn/ui as the ONLY component library. All colors must use semantic tokens, never hardcode colors.

**Key Points:**
- Components in `src/client/components/ui/`
- Add new components: `npx shadcn@latest add <component>`
- Theme toggle via `useTheme()` hook from `next-themes`
- **MUST use semantic color tokens:**

| Use This | NOT This |
|----------|----------|
| `bg-background` | `bg-white` |
| `bg-card` | `bg-gray-100` |
| `bg-primary` | `bg-blue-500` |
| `text-foreground` | `text-black` |
| `text-muted-foreground` | `text-gray-500` |
| `border-border` | `border-gray-200` |

**Docs:** [docs/shadcn-component-library.md](docs/shadcn-component-library.md), [docs/theming.md](docs/theming.md)
**Rules:** [.cursor/rules/shadcn-usage.mdc](.cursor/rules/shadcn-usage.mdc), [.cursor/rules/theming-guidelines.mdc](.cursor/rules/theming-guidelines.mdc), [.cursor/rules/ui-design-guidelines.mdc](.cursor/rules/ui-design-guidelines.mdc)

---

## Admin System

Single-admin setup via environment variable.

**Summary:** Admin is controlled by `ADMIN_USER_ID` env var (MongoDB `_id` string). Admin routes and APIs are protected automatically.

**Key Points:**
- **Admin routes**: `/admin/*` redirects non-admins to `/`
- **Admin APIs**: `admin/*` APIs are protected automatically
- **Client**: Use `useIsAdmin()` hook for conditional UI
- Server handlers receive `context.isAdmin`

**Docs:** [docs/admin.md](docs/admin.md)

---

## Logging & Error Tracking

Session logging with bug reporting and error tracking.

**Summary:** Session logger captures all events in Zustand store (last 500 entries). Bug reports include full session logs for debugging.

**Key Points:**
- **Session logger**: API calls, user actions, network changes, errors
- **Bug report dialog**: Accessible from menu, includes screenshot option
- **Auto error tracking**: Global error handler + React ErrorBoundary
- **Reports dashboard**: `/reports` to view all reports
- **Console helpers**: `enableLogs()`, `printLogs()`, `getSessionLogs()`

```typescript
import { logger } from '@/client/features/session-logs';
logger.info('feature', 'Message', { meta: { ... } });
```

**Docs:** [docs/logging-and-error-tracking.md](docs/logging-and-error-tracking.md)

---

## TypeScript

Strict TypeScript guidelines.

**Summary:** Strict mode enabled, no `any` types allowed. Types should be simple and close to where they're used.

**Key Points:**
- **Never use `any`** or `as any` - use proper type narrowing
- Prefer union types over enums: `'pending' | 'approved' | 'rejected'`
- All domain types in `apis/<domain>/types.ts`
- Keep types simple - avoid complex type structures
- Always type function parameters and return values

**Rules:** [.cursor/rules/typescript-guidelines.mdc](.cursor/rules/typescript-guidelines.mdc)

---

## Guidelines Compliance Checklist

Systematic verification of codebase compliance.

**Summary:** Use this checklist to verify code follows all established guidelines. Run `yarn checks` to validate - the app is not compliant until it passes with 0 errors.

**Key Points:**

**1. API Guidelines: (in api folder)**
- [ ] File structure: `index.ts`, `types.ts`, `server.ts`, `client.ts` exist
- [ ] API names defined ONLY in `index.ts`
- [ ] Server re-exports from `index.ts`, client imports from `index.ts` (never `server.ts`)
- [ ] Types defined in `types.ts`, never duplicated elsewhere
- [ ] Client functions return `CacheResult<ResponseType>`

**2. Routes Check:**
- [ ] Proper loading states implemented
- [ ] Error handling in place
- [ ] Code organized and split into multiple components if needed

**3. React Components:**
- [ ] TypeScript interfaces for props
- [ ] No server-side imports in client code
- [ ] Don't redefine API types (import from `types.ts`)
- [ ] Clean separation of presentation and logic

**4. Server Code:**
- [ ] No client-side imports
- [ ] Proper error handling

**5. TypeScript:**
- [ ] No `any` types
- [ ] No type duplications
- [ ] No circular dependencies

**6. MongoDB Usage:**
- [ ] All operations encapsulated in `src/server/database/collections/`
- [ ] No direct `mongodb` imports outside database layer
- [ ] API layer imports from `@/server/database`, never uses `getDb()` directly
- [ ] Each collection has: `types.ts` + `<collection>.ts`
- [ ] Collection types use `ObjectId` for `_id` and foreign keys

**7. State Management:**
- [ ] Zustand stores use `createStore` factory (no direct zustand imports)
- [ ] React Query for server state, Zustand for client state
- [ ] Stores export via `index.ts` for public API

**8. Offline/PWA Support:**
- [ ] Mutations use optimistic-only pattern (`onMutate` updates UI, `onSuccess` empty)
- [ ] Guard against empty data in `onSuccess` (offline returns `{}`)
- [ ] No `invalidateQueries` in `onSettled` (causes race conditions)

**9. UI & Styling:**
- [ ] Only shadcn/ui components (no other UI libraries)
- [ ] Semantic color tokens only (`bg-background`, not `bg-white`)
- [ ] No hardcoded colors or raw Tailwind colors

**10. Final Verification:**
```bash
yarn checks  # Must pass with 0 errors
```

**Docs:** [app-guildelines/app-guidelines-checklist.md](app-guildelines/app-guidelines-checklist.md)

---

## Template Sync

Merge updates from the template repository into projects created from it.

**Summary:** Projects created from this template can receive ongoing updates and improvements while maintaining their own customizations. The sync system auto-merges safe changes and flags true conflicts only when files changed in BOTH template and project.

**Key Points:**
- **Smart conflict detection**: Only flags conflicts when BOTH sides changed a file
- **Project customizations preserved**: Files you changed that template didn't touch are NOT conflicts
- **Auto-commits**: Synced changes are automatically committed

**Commands:**
```bash
yarn init-template <url>       # Initialize tracking in new project
yarn sync-template             # Sync updates (interactive)
yarn sync-template --dry-run   # Preview changes without applying
yarn sync-template --diff-summary  # Generate full diff report
```

**Auto Mode Flags (for CI/CD):**
| Flag | Safe Changes | Conflicts |
|------|-------------|-----------|
| `--auto-safe-only` | Applied | Skipped |
| `--auto-merge-conflicts` | Applied | Creates `.template` files |
| `--auto-override-conflicts` | Applied | Replaced with template |
| `--auto-skip-conflicts` | Applied | Skipped |

**Interactive Conflict Resolution:**
- **Override**: Replace your changes with template version
- **Skip**: Keep your version, ignore template changes
- **Merge**: Create `.template` file for manual merge
- **Do nothing**: Leave file unchanged for now

**Configuration (`.template-sync.json`):**
- `ignoredFiles`: Files never synced (config, example features)
- `projectSpecificFiles`: Your custom files to skip
- Supports glob patterns (`*`, `**`)

**Docs:** [docs/template-sync/template-sync.md](docs/template-sync/template-sync.md)

---

## GitHub PR CLI Tool

Command-line tool for managing GitHub pull requests.

**Summary:** `yarn github-pr` provides a CLI for creating, updating, and merging PRs using the GitHub API via `@octokit/rest`. Requires `GITHUB_TOKEN` in `.env`.

**Setup:**
```bash
# Add to .env (Fine-grained token with repo permissions, or Classic token with `repo` scope)
GITHUB_TOKEN=github_pat_xxxxx...
```

**Available Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List PRs | `yarn github-pr list --state open` |
| `info` | Get PR details | `yarn github-pr info --pr 1` |
| `comment` | Add comment | `yarn github-pr comment --pr 1 --message "LGTM!"` |
| `title` | Update title | `yarn github-pr title --pr 1 --text "feat: new feature"` |
| `body` | Update description | `yarn github-pr body --pr 1 --text "Description here"` |
| `label` | Add/remove labels | `yarn github-pr label --pr 1 --add bug,urgent` |
| `reviewer` | Request reviewers | `yarn github-pr reviewer --pr 1 --users alice,bob` |
| `merge` | Merge PR | `yarn github-pr merge --pr 1 --method squash` |
| `close` | Close PR | `yarn github-pr close --pr 1` |

**Common Workflows:**

```bash
# Create a PR (use gh CLI, then manage with github-pr)
git checkout -b feat/my-feature
# ... make changes, commit ...
git push -u origin feat/my-feature
gh pr create --title "feat: my feature" --body "Description"

# Update PR title and description
yarn github-pr title --pr 1 --text "feat: improved title"
yarn github-pr body --pr 1 --text "## Summary\nDetailed description..."

# Add a comment
yarn github-pr comment --pr 1 --message "Ready for review!"

# Squash and merge with custom commit message
yarn github-pr merge --pr 1 --method squash \
  --title "feat: my feature" \
  --message "Detailed commit description"
```

**Key Points:**
- Auto-detects `owner/repo` from git remote (or use `--owner`/`--repo`)
- Loads `GITHUB_TOKEN` from `.env` automatically
- Merge methods: `merge`, `squash`, `rebase` (default: `squash`)
- For creating PRs, use `gh pr create` (GitHub CLI)

**Script:** `scripts/github-pr.ts`

---

## Additional Rules Reference

| Topic | Rule File |
|-------|-----------|
| AI Model API Usage | [.cursor/rules/ai-models-api-usage.mdc](.cursor/rules/ai-models-api-usage.mdc) |
| ESLint Custom Rules | [.cursor/rules/eslint-custom-guidelines.mdc](.cursor/rules/eslint-custom-guidelines.mdc) |
| Feature Planning | [.cursor/rules/feature-planning.mdc](.cursor/rules/feature-planning.mdc) |
| MongoDB Usage | [.cursor/rules/mongodb-usage.mdc](.cursor/rules/mongodb-usage.mdc) |
| Pages & Routing | [.cursor/rules/pages-and-routing-guidelines.mdc](.cursor/rules/pages-and-routing-guidelines.mdc) |
| Settings Usage | [.cursor/rules/settings-usage-guidelines.mdc](.cursor/rules/settings-usage-guidelines.mdc) |
| User Access | [.cursor/rules/user-access.mdc](.cursor/rules/user-access.mdc) |
| Mobile-First UI | [.cursor/rules/ui-mobile-first-shadcn.mdc](.cursor/rules/ui-mobile-first-shadcn.mdc) |
| App Guidelines Checklist | [.cursor/rules/app-guidelines-checklist.mdc](.cursor/rules/app-guidelines-checklist.mdc) |
