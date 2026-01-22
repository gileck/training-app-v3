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

**Store Location:**
- **Cross-route state** → `features/{name}/store.ts` (auth, settings, theme)
- **Route-specific state** → `routes/{RouteName}/store.ts` (filters, view prefs used only by that route)

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

**Preview Auto-Login:**

Automatically logs in a test user on Vercel preview deployments (PR previews).

Setup:
1. Create a test user account in the app
2. Get the user's ID from MongoDB (`_id` field)
3. Add `PREVIEW_USER_ID` to Vercel: Settings → Environment Variables
   - Set for **Preview** environment only (NOT Production)
   - Value: the test user's MongoDB `_id`

When visiting a preview URL, the middleware automatically sets an auth cookie for the test user.

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

## iOS PWA Fixes

iOS-specific issues and fixes for PWA mode.

**Summary:** iOS Safari and PWA have unique behaviors, especially around the virtual keyboard. The keyboard overlays the viewport instead of resizing it, hiding fixed-position elements.

**Key Points:**
- **Keyboard hides fixed elements**: Bottom sheets, modals at `bottom: 0` get covered
- **Use `visualViewport` API**: Detects actual visible area when keyboard opens
- **Transform, not position**: Use `translateY` to move elements above keyboard

**Quick Fix Pattern:**

```typescript
function useIOSKeyboardOffset() {
    const [offset, setOffset] = useState(0);
    useEffect(() => {
        if (!window.visualViewport) return;
        const handle = () => {
            const diff = window.innerHeight - window.visualViewport.height;
            setOffset(diff > 0 ? diff : 0);
        };
        window.visualViewport.addEventListener('resize', handle);
        window.visualViewport.addEventListener('scroll', handle);
        return () => {
            window.visualViewport.removeEventListener('resize', handle);
            window.visualViewport.removeEventListener('scroll', handle);
        };
    }, []);
    return offset;
}

// Usage: style={{ transform: offset > 0 ? `translateY(-${offset}px)` : undefined }}
```

**DON'T:**
- Rely on `window.innerHeight` changing (it doesn't on iOS PWA)
- Use `100vh` for full-height layouts
- Use `env(keyboard-inset-bottom)` (not widely supported)

**Docs:** [docs/ios-pwa-fixes.md](docs/ios-pwa-fixes.md)

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

## React Rendering & Infinite Loops

Common pitfalls that cause infinite re-renders.

**CRITICAL:** Never return `{}` or `[]` literals in Zustand selector fallbacks. Create module-level constants for empty values.

**The Bug:**
```typescript
// BAD: New {} every render → infinite loop
return usePlanDataStore((state) => {
    if (!planId) return {};  // NEW OBJECT EVERY RENDER!
});
```

**The Fix:**
```typescript
// GOOD: Stable reference
const EMPTY_DATA = {};
return usePlanDataStore((state) => {
    if (!planId) return EMPTY_DATA;
});
```

**Docs:** [docs/react-rendering-guidelines.md](docs/react-rendering-guidelines.md)

---

## Routes & Navigation

Adding routes and keeping navigation menus in sync.

**Summary:** Routes are defined in `src/client/routes/index.ts`. When adding new routes, remember to add them to navigation menus if they should be user-accessible.

**Key Files:**
- `src/client/routes/index.ts` - Route definitions
- `src/client/components/NavLinks.tsx` - Navigation menus (navItems, menuItems)

**When Adding a New Route:**
1. Add the route component in `src/client/routes/[RouteName]/`
2. Register it in `src/client/routes/index.ts`
3. **Consider adding to navigation:**
   - `navItems` - Bottom navigation bar (mobile)
   - `menuItems` - Hamburger menu (sidebar)

**Routes That DON'T Need Menu Entries:**
- Dynamic routes (`/todos/:todoId`) - accessed via in-app links
- `/not-found` - fallback route
- `/profile` - accessed via avatar in header
- Public share pages - accessed via direct links
- Auth callback routes - redirect-only

**Rules:** [.cursor/rules/pages-and-routing-guidelines.mdc](.cursor/rules/pages-and-routing-guidelines.mdc)

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
- **GitHub integration**: Approved bugs sync to GitHub Issues and flow through AI agent workflow
- **Console helpers**: `enableLogs()`, `printLogs()`, `getSessionLogs()`

```typescript
import { logger } from '@/client/features/session-logs';
logger.info('feature', 'Message', { meta: { ... } });
```

**Docs:** [docs/logging-and-error-tracking.md](docs/logging-and-error-tracking.md)

---

## Telegram Notifications (App Runtime)

> **What this is:** Application feature that sends notifications via Telegram. This is runtime application logic in the source code.
>
> **NOT to be confused with:** "Send Message to User" below, which is a development tool for Claude Code.

**Two Notification Types:**

| Type | Recipient | Config Location | Use Cases |
|------|-----------|-----------------|-----------|
| **Owner** | App administrator | `ownerTelegramChatId` in app.config.js | New signups, errors, API thresholds, system alerts |
| **User** | Individual logged-in users | `telegramChatId` in user's Profile | Personal alerts, task updates, user-specific events |

**Setup:**
- Requires `TELEGRAM_BOT_TOKEN` in `.env`
- Run `yarn telegram-setup` to get chat IDs
- Owner: Set `ownerTelegramChatId` in app.config.js
- Users: Each user sets their own chat ID in Profile settings

**Usage:**
```typescript
import { sendNotificationToOwner, sendTelegramNotificationToUser } from '@/server/telegram';

// Owner notifications (app-level events)
await sendNotificationToOwner(`New user signed up: ${email}`);
await sendNotificationToOwner(`API Error: ${error.message}`);

// User notifications (per-user events)
await sendTelegramNotificationToUser(userId, 'Your task was completed');
```

**Docs:** [docs/telegram-notifications.md](docs/telegram-notifications.md)

---

## Send Message to User (Claude Code CLI/Cloud Only)

> **What this is:** A development tool for Claude Code (CLI or Cloud) to send Telegram messages to the developer during coding sessions. Useful for long-running tasks, notifications when work is done, etc.
>
> **NOT to be confused with:** "Telegram Notifications" above, which is an app runtime feature for end users.

**This is NOT application code** - it's a CLI script for the AI agent to communicate with the developer.

**Setup:**
1. `TELEGRAM_BOT_TOKEN` must be in `.env`
2. Run `yarn telegram-setup` to get your chat ID
3. Add `LOCAL_TELEGRAM_CHAT_ID=your_chat_id` to `.env`

**Usage (from Claude Code CLI or Cloud):**
```bash
yarn send-telegram "Task completed successfully"
yarn send-telegram "Build finished with 0 errors"
yarn send-telegram "Need your input on something"
```

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

## Validation & Quality Checks

**CRITICAL: Always run `yarn checks` before completing work.**

**For Claude Code (Planning Mode):**
Always include a final task to run `yarn checks` in your plan.

**Before any of these actions:**
- ✅ Committing code
- ✅ Creating pull requests
- ✅ Syncing to child projects
- ✅ Deploying to production

**Always run:** `yarn checks`

**If errors occur:**
1. Fix TypeScript errors first
2. Fix ESLint errors second
3. Re-run `yarn checks` until it passes

**Docs:** [docs/validation-planning-mode.md](docs/validation-planning-mode.md)

---

## Guidelines Compliance Checklist

Systematic verification of codebase compliance.

**Summary:** Use this checklist to verify code follows all guidelines. Run `yarn checks` to validate - must pass with 0 errors.

**Key Areas:**
1. API structure and naming
2. Routes with proper loading states
3. React components with TypeScript
4. Server code isolation
5. TypeScript strict mode
6. MongoDB layer encapsulation
7. State management patterns
8. Offline/PWA optimistic updates
9. UI styling with semantic tokens
10. Final verification: `yarn checks`

**Docs:** [app-guildelines/app-guidelines-checklist.md](app-guildelines/app-guidelines-checklist.md)

**Rules:** [.cursor/rules/app-guidelines-checklist.mdc](.cursor/rules/app-guidelines-checklist.mdc)

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

## Sync Child Projects (Template Only)

Sync template changes to projects cloned from this template.

**Summary:** After pushing changes to the template, sync those changes to child projects. Only syncs safe changes to projects without uncommitted changes.

**Setup:**
1. Create `child-projects.json` (gitignored) with project paths:
```json
{
  "projects": [
    "../project-1",
    "../project-2"
  ]
}
```

2. (Optional) Enable post-push hook:
```bash
yarn setup-hooks  # Enables 'git pushh' command
```

**Commands:**
```bash
yarn sync-children            # Sync all child projects
yarn sync-children --dry-run  # Preview without applying
yarn push-sync                # Push + prompt to sync children
yarn push-sync "message"      # Push with commit message + prompt
git pushh                     # git push + prompt to sync (after setup-hooks)
```

**Behavior:**
- Skips projects with uncommitted changes
- Only applies safe changes (no conflicts)
- Prints summary of synced/skipped projects

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
| `create` | Create a new PR | `yarn github-pr create --title "feat: feature" --body "Description"` |
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
# Create a PR
git checkout -b feat/my-feature
# ... make changes, commit ...
git push -u origin feat/my-feature
yarn github-pr create --title "feat: my feature" --body "Description"
# Or create as draft:
yarn github-pr create --title "feat: my feature" --body "WIP" --draft

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
- Auto-detects current branch for PR creation (or use `--head`)
- Auto-detects default branch for PR base (or use `--base`)
- Loads `GITHUB_TOKEN` from `.env` automatically
- Merge methods: `merge`, `squash`, `rebase` (default: `squash`)

**Cloud Environment (Claude Code Web):**
```bash
yarn github-pr --cloud-proxy list --state open
yarn github-pr --cloud-proxy create --title "feat: feature" --body "Description"
```

Use `--cloud-proxy` when running in Claude Code cloud environment. This enables:
- HTTP proxy support via `HTTPS_PROXY`/`HTTP_PROXY` env vars
- Quote stripping from `GITHUB_TOKEN` (cloud may add literal quotes)
- Proxy git remote URL parsing (`/git/owner/repo` format)

**IMPORTANT:** Always use `--cloud-proxy` flag when running github-pr commands.

**Script:** `scripts/github-pr.ts`

---

## GitHub Projects Integration

Automated pipeline from feature requests to merged PRs using GitHub Projects V2.

**Key Features:**
- Squash-merge ready PRs (no editing needed before merge)
- Auto-completion when PR merges
- Two-tier status tracking: MongoDB (high-level) + GitHub Projects (detailed workflow)

**CLI Commands:**
- `yarn agent:product-design` - Generate product designs
- `yarn agent:tech-design` - Generate technical designs
- `yarn agent:implement` - Implement features and create PRs

**Setup:**
📚 **[docs/init-github-projects-workflow.md](docs/init-github-projects-workflow.md)** - Complete setup guide

**Verify setup:** `yarn verify-setup`

**Agent Library Abstraction:**
- Default: Claude Code SDK
- Per-workflow overrides via environment variables
- Configure via `AGENT_DEFAULT_LIBRARY`, `AGENT_PRODUCT_DESIGN_LIBRARY`, etc.

**Docs:** [docs/github-projects-integration.md](docs/github-projects-integration.md), [docs/agent-library-abstraction.md](docs/agent-library-abstraction.md)

---

## Vercel CLI Tool

Command-line tool for managing Vercel deployments and projects.

**Summary:** `yarn vercel-cli` provides a CLI for listing deployments, viewing build logs, checking environment variables, and getting project info using the Vercel REST API. Requires `VERCEL_TOKEN` in `.env`.

**Setup:**
```bash
# Add to .env (get token from https://vercel.com/account/tokens)
VERCEL_TOKEN=your_token_here

# Link project (recommended for auto-detection)
vercel link
```

**Available Commands:**

| Command | Description | Example |
|---------|-------------|---------|
| `list` | List deployments | `yarn vercel-cli list --target production` |
| `info` | Get deployment details | `yarn vercel-cli info --deployment dpl_xxx` |
| `logs` | Get build logs | `yarn vercel-cli logs --deployment dpl_xxx` |
| `env` | List environment variables | `yarn vercel-cli env --target production` |
| `env:push` | Push .env to Vercel | `yarn vercel-cli env:push --overwrite` |
| `project` | Show project info | `yarn vercel-cli project` |

**Common Workflows:**

```bash
# Check latest production deployment
yarn vercel-cli list --target production --limit 1

# Debug a failed deployment
yarn vercel-cli list --state ERROR
yarn vercel-cli info --deployment dpl_xxx
yarn vercel-cli logs --deployment dpl_xxx

# Verify environment variables before deploy
yarn vercel-cli env --target production

# Push all .env variables to Vercel (all targets)
yarn vercel-cli env:push

# Push only to production, overwriting existing
yarn vercel-cli env:push --target production --overwrite
```

**Key Points:**
- Auto-detects project from `.vercel/project.json` (or use `--project-id`)
- Auto-detects team from linked project (or use `--team-id`)
- Loads `VERCEL_TOKEN` from `.env` automatically
- Build logs only (runtime logs require Vercel dashboard)

**Cloud Environment (Claude Code Web):**
```bash
yarn vercel-cli --cloud-proxy list
yarn vercel-cli --cloud-proxy logs --deployment dpl_xxx
```

Use `--cloud-proxy` when running in Claude Code cloud environment.

**Script:** `scripts/vercel-cli.ts`
**Rules:** [.cursor/rules/vercel-cli-usage.mdc](.cursor/rules/vercel-cli-usage.mdc)

---

## Critical Deployment Issues & Best Practices

Common pitfalls when deploying to production.

**⚠️ CRITICAL Issues:**

1. **`pages/` vs `src/pages/` Directory**
   - This project uses `src/pages/` (NOT `pages/`)
   - ✅ ALWAYS place pages/API routes in `src/pages/`
   - ❌ NEVER create `pages/` directory at root

2. **Vercel Environment Variables**
   - Use `VERCEL_PROJECT_PRODUCTION_URL` for stable URLs
   - Vercel URLs don't include protocol - prepend `https://`

3. **Markdown Extraction with Nested Code Blocks**
   - `extractMarkdown()` properly handles nested code blocks
   - Fixed in `src/agents/shared/claude.ts:253-317`

**Docs:** [docs/critical-deployment-issues.md](docs/critical-deployment-issues.md)

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
