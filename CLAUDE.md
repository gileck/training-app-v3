# Project Guidelines

This file provides Claude with context about the project's architecture, coding standards, and best practices. Read the referenced docs/rules for detailed information.

---


## Architecture Overview

Next.js PWA with offline-first capabilities. Use this to understand the project structure and core principles.

**Summary:** Offline-first app with instant boot using cached state (localStorage). All mutations use optimistic updates. Code organized by feature, not type.

**Key Points:**
- `src/client/features/` - Feature modules (stores, hooks, components)
- `src/client/routes/` - Route/page components
- `src/apis/` - API definitions
- `template/` folders are synced from template, `project/` folders are project-specific

**Docs:** [architecture.md](docs/template/architecture.md)

---

## Build CLAUDE.md

Auto-generate CLAUDE.md from docs and skills. Run this after creating or updating docs.

**Summary:** Run `yarn build:claude` to regenerate CLAUDE.md from all docs and skills with frontmatter. **IMPORTANT: Run this after adding new docs or updating title/summary/description in existing docs.**

**Docs:** [build-claude-md.md](docs/template/build-claude-md.md)

---

## Exit Codes

How to properly check command success/failure. Use this when running shell commands.

**Summary:** **CRITICAL: Never parse command output to determine success/failure. Always use exit codes.** Exit code 0 = Success, non-zero = Failure. Use try/catch with execSync.

**Docs:** [exit-codes-guide.md](docs/template/exit-codes-guide.md)

---

## Validation & Quality Checks

Code validation and linting requirements. Use this before completing any work.

**Summary:** **CRITICAL: Always run `yarn checks` before completing work.** Runs both TypeScript and ESLint checks, shows ALL errors at once. Must pass with 0 errors before committing, creating PRs, or deploying.

**Docs:** [validation-planning-mode.md](docs/template/validation-planning-mode.md)

---

## Authentication

Instant-boot authentication pattern for PWA. Use this when working with auth flows.

**Summary:** Uses `isProbablyLoggedIn` hint in localStorage for instant render, validates with server in background. JWT in HttpOnly cookie. Use `useUser()` for validated user, `useAuthStore(s => s.userPublicHint)` for instant-boot UI.

**Docs:** [authentication.md](docs/template/authentication.md)

---

## Caching Strategy

Single-layer client cache using localStorage. Use this when configuring query caching.

**Summary:** React Query handles all API caching with localStorage persistence. Configure via `useQueryDefaults()`. User can toggle cache in Settings.

**Docs:** [caching-strategy.md](docs/template/caching-strategy.md)

---

## Client-Server Communication

Single API endpoint pattern with React Query. Use this when creating/calling APIs.

**Summary:** All APIs route through `/api/process/{api_name}`. Components use React Query hooks, never call API client functions directly. All domain types in `apis/<domain>/types.ts`.

**Docs:** [api-endpoint-format.md](docs/template/api-endpoint-format.md)
**Rules:** [client-server-communications](.ai/skills/template/client-server-communications/SKILL.md)

---

## Mobile-First Philosophy

All UI must be designed for mobile screens first (~400px width). Use this when implementing any UI.

**Summary:** Design for 400px width first, then enhance with `sm:`, `md:`, `lg:` modifiers. Touch targets minimum 44px.

**Rules:** [ui-mobile-first-shadcn](.ai/skills/template/ui-mobile-first-shadcn/SKILL.md)

---

## Offline/PWA Support

Full offline support with optimistic updates. Use this when implementing mutations.

**Summary:** GET requests serve cached data, POST requests queue in localStorage and batch-sync when online. **CRITICAL: Never update UI from server response** - use optimistic updates in `onMutate`, keep `onSuccess`/`onSettled` empty.

**Docs:** [offline-pwa-support.md](docs/template/offline-pwa-support.md)

---

## State Management

Dual-store architecture for PWA with offline support. Use this when managing application state.

**Summary:** React Query for server/API data, Zustand for client state, useState for ephemeral UI. All Zustand stores MUST use `createStore` factory from `@/client/stores`.

**Docs:** [state-management.md](docs/template/state-management.md), [react-query-mutations.md](docs/template/react-query-mutations.md), [zustand-stores.md](docs/template/zustand-stores.md)
**Rules:** [state-management-guidelines](.ai/skills/template/state-management-guidelines/SKILL.md)

---

## Admin System

Single-admin setup via environment variable. Use this when implementing admin features.

**Summary:** Admin controlled by `ADMIN_USER_ID` env var. `/admin/*` routes and `admin/*` APIs protected automatically. Use `useIsAdmin()` hook for conditional UI.

**Docs:** [admin.md](docs/template/admin.md)

---

## Configuration Files (Template/Project Split)

Config files use a split pattern for template updates without losing project customizations. Use this when modifying ESLint, Next.js, or TypeScript configs.

**Summary:** Template configs (synced) live in `config/*/` folders. Project configs (never synced) let you add customizations. Root configs merge both.

**Key Points:**
- ESLint: `config/eslint/eslint.project.mjs` for project rules (ignores, custom rules)
- Next.js: `config/next/next.project.ts` for project config (images, domains)
- TypeScript: Add `tsconfig.json` to `projectOverrides` if you need custom excludes

**Docs:** [config-files.md](docs/template/config-files.md)

---

## Feature-Based Structure

Feature-based folder structure for client code. Use this when organizing client-side code.

**Summary:** All code related to a feature lives together in `src/client/features/{name}/`. Features contain stores, hooks, components, and types. All stores MUST use `createStore` factory.

**Key Points:**
- `features/` - Cross-route features (auth, settings, theme)
- `routes/` - Route-specific code (only used by that route)
- `components/` - Shared UI primitives only (shadcn components)
- Import from feature index, not internal files

**Rules:** [feature-based-structure](.ai/skills/template/feature-based-structure/SKILL.md)

---

## iOS PWA Fixes

iOS-specific keyboard and viewport issues. Use this when fixing iOS PWA bugs.

**Summary:** iOS keyboard overlays viewport instead of resizing it. Use `visualViewport` API and `translateY` transform to move elements above keyboard.

**Docs:** [ios-pwa-fixes.md](docs/template/ios-pwa-fixes.md)

---

## Logging & Error Tracking

Session logging with bug reporting. Use this when adding logging or debugging.

**Summary:** Session logger captures events in Zustand store. Bug reports include full session logs. Use `logger.info('feature', 'Message', { meta })`.

**Docs:** [logging-and-error-tracking.md](docs/template/logging-and-error-tracking.md)

---

## MongoDB Usage

Database layer patterns and schema evolution. Use this when working with MongoDB.

**Summary:** All operations in `src/server/database/collections/`. Use `toStringId()`, `toQueryId()`, `toDocumentId()` from `@/server/utils`. **CRITICAL: Always use optional chaining and fallbacks for schema backward compatibility.**

**Docs:** [mongodb-usage.md](docs/template/mongodb-usage.md)
**Rules:** [mongodb-usage](.ai/skills/template/mongodb-usage/SKILL.md)

---

## React Components

Component organization and patterns. Use this when creating/organizing components.

**Summary:** Feature-based organization with small, focused components (<150 lines). Route-specific code in route folder, shared features in `features/`. **CRITICAL: Always check Loading → Error → Empty → Data order.**

**Rules:** [react-component-organization](.ai/skills/template/react-component-organization/SKILL.md)

---

## React Hook Organization

React Query hooks and Zustand integration patterns. Use this when creating data fetching hooks.

**Summary:** React Query for server state, Zustand for client state. Colocate hooks in `hooks.ts` within route or feature folder. All mutations must handle empty `{}` responses (offline mode).

**Key Points:**
- Query hooks: use `useQueryDefaults()` for centralized cache config
- Mutation hooks: optimistic updates in `onMutate`, rollback on error, empty `onSuccess`/`onSettled`
- **CRITICAL:** Check `data === undefined` alongside `isLoading` - only show empty state when data is defined AND empty

**Rules:** [react-hook-organization](.ai/skills/template/react-hook-organization/SKILL.md)

---

## React Rendering & Infinite Loops

Common pitfalls causing infinite re-renders. Use this when debugging render loops.

**Summary:** Never return `{}` or `[]` literals in Zustand selector fallbacks - use module-level constants. Never return object literals from selectors to extract multiple values - use individual selectors instead.

**Docs:** [react-rendering-guidelines.md](docs/template/react-rendering-guidelines.md)

---

## Routes & Navigation

Adding routes and keeping navigation menus in sync. Use this when adding client routes.

**Summary:** Routes defined in `src/client/routes/index.ts`. Add to `navItems`/`menuItems` in `NavLinks.tsx` if user-accessible. Options: `public`, `fullScreen`, `adminOnly`.

**Rules:** [pages-and-routing-guidelines](.ai/skills/template/pages-and-routing-guidelines/SKILL.md)

---

## Settings Usage

User preferences and configuration patterns. Use this when implementing persistent user settings.

**Summary:** Use `useSettingsStore` from `@/client/features/settings` for all user preferences. Settings automatically persist to localStorage via Zustand.

**Key Points:**
- Subscribe to specific slices: `useSettingsStore((state) => state.settings.theme)`
- Update with: `updateSettings({ fieldName: value })`
- Use `useEffectiveOffline()` for combined offline detection (user toggle OR device offline)
- Add new fields in `types.ts` with defaults

**Rules:** [settings-usage-guidelines](.ai/skills/template/settings-usage-guidelines/SKILL.md)

---

## Theming System

Application theming with semantic color tokens. Use this when customizing colors and themes.

**Summary:** Comprehensive theming with semantic color tokens. Never hardcode colors - always use theme variables like `bg-background`, `text-foreground`.

**Docs:** [theming.md](docs/template/theming.md)

---

## TypeScript

Strict TypeScript guidelines. Use this when writing TypeScript code.

**Summary:** Strict mode enabled, no `any` types allowed. Prefer union types over enums. All domain types in `apis/<domain>/types.ts`.

**Rules:** [typescript-guidelines](.ai/skills/template/typescript-guidelines/SKILL.md)

---

## UI & Styling

shadcn/ui components with semantic theming. Use this when adding/editing UI components.

**Summary:** Use shadcn/ui as the ONLY component library. All colors must use semantic tokens (`bg-background`, `text-foreground`), never hardcode colors (`bg-white`, `text-black`).

**Docs:** [shadcn-component-library.md](docs/template/shadcn-component-library.md), [theming.md](docs/template/theming.md)
**Rules:** [shadcn-usage](.ai/skills/template/shadcn-usage/SKILL.md), [theming-guidelines](.ai/skills/template/theming-guidelines/SKILL.md), [ui-design-guidelines](.ai/skills/template/ui-design-guidelines/SKILL.md)

---

## User Access

Accessing authenticated user in client and server code. Use this when implementing user-specific features.

**Summary:** Client: use `useAuth()` hook to get `user` object. Server: use `context.userId` from `ApiHandlerContext` (derived from JWT token).

**Key Points:**
- Client: `const { user } = useAuth(); const userId = user?.id;`
- Server: `const userId = context.userId;` - always check if undefined
- Server `userId` is `undefined` if token is invalid or missing

**Rules:** [user-access](.ai/skills/template/user-access/SKILL.md)

---

## AI Model API Usage

Server-side AI model integration patterns. Use this when calling AI APIs.

**Summary:** Never call AI APIs directly - always use `AIModelAdapter` from `src/server/ai/baseModelAdapter.ts`. Server-side only, include caching and cost tracking.

**Key Points:**
- All AI calls must be server-side only
- Validate model IDs using `isModelExists()` before adapter initialization
- Always return 200 status codes with error fields, never throw uncaught errors
- Track and return cost of each AI call

**Rules:** [ai-models-api-usage](.ai/skills/template/ai-models-api-usage/SKILL.md)

---

## Critical Deployment Issues

Common deployment pitfalls. Use this before deploying to production.

**Summary:** Always run `vercel link` first. Verify env vars match with `yarn verify-production`. Use `src/pages/` not `pages/`.

**Docs:** [critical-deployment-issues.md](docs/template/critical-deployment-issues.md)

---

## ESLint Custom Rules

Custom ESLint rules and when to use disable comments. Use this when fixing lint issues.

**Summary:** Never use ESLint disable comments unless specifically instructed. Exception - `state-management/prefer-state-architecture` - add disable comment WITH explanation for valid `useState` usage.

**Key Points:**
- Valid `useState` justifications: ephemeral modal state, form input before submission, local loading indicator
- If warning triggers and none apply: use React Query (API data) or Zustand (preferences, auth, persistent UI)
- Always run `yarn checks` after fixing lint issues

**Rules:** [eslint-custom-guidelines](.ai/skills/template/eslint-custom-guidelines/SKILL.md)

---

## Git Worktree Workflow

Isolated development with clean commit history. Use this for feature/fix development.

**Summary:** Create worktree for development, squash merge to main for single clean commit. Always run `yarn checks` before merging.

**Docs:** [git-worktree-workflow.md](docs/template/git-worktree-workflow.md)

---

## GitHub Agents Workflow

AI-powered feature request and bug fix pipeline. Use this for automated feature/bug workflows.

**Summary:** 6-column workflow (Backlog → Product Design → Tech Design → Ready → PR Review → Done) with AI agents at each stage. Multi-phase features split into sequential PRs.

**Docs:** [init-github-projects-workflow.md](docs/template/init-github-projects-workflow.md)

---

## GitHub PR CLI Tool

CLI for managing GitHub pull requests. Use this when creating/managing PRs programmatically.

**Summary:** Auto-detects `owner/repo` from git remote. Use `--cloud-proxy` in Claude Code cloud. Commands - `yarn github-pr create`, `yarn github-pr list`, `yarn github-pr merge`.

**Docs:** [github-pr-cli-guide.md](docs/template/github-pr-cli-guide.md)

---

## Send Message to User (Claude Code Only)

CLI tool for Claude Code to send Telegram messages to developer. Use this for long-running task notifications.

**Summary:** Run `yarn send-telegram "message"` to notify developer. Requires `LOCAL_TELEGRAM_CHAT_ID` in `.env`.

**Docs:** [send-telegram.md](docs/template/_custom/send-telegram.md)

---

## Sync Child Projects (Template Only)

Sync template changes to child projects. Use this after pushing template changes.

**Summary:** Syncs safe changes to projects without uncommitted changes. Configure in `child-projects.json`.

**Docs:** [sync-children.md](docs/template/_custom/sync-children.md)

---

## Telegram Notifications (App Runtime)

Application feature for sending notifications via Telegram. Use this when adding app notifications.

**Summary:** Two types - Owner notifications (system alerts) and User notifications (personal alerts). Requires `TELEGRAM_BOT_TOKEN`. Run `yarn telegram-setup` for chat IDs.

**Docs:** [telegram-notifications.md](docs/template/telegram-notifications.md)

---

## Template Sync

Merge updates from template repository. Use this when syncing template changes to project.

**Summary:** Path ownership model with `templatePaths` (synced) and `projectOverrides` (kept different). Three-file pattern (`index.template.ts`, `index.project.ts`, `index.ts`) eliminates override conflicts.

**Docs:** [template-sync.md](docs/template/template-sync/template-sync.md), [sync-flows-reference.md](docs/template/template-sync/sync-flows-reference.md)

---

## Vercel CLI Tool

CLI for managing Vercel deployments and env vars. Use this for deployment operations.

**Summary:** Run `vercel link` first. **CRITICAL: Never use `npx vercel env add` with piped input** - use `yarn vercel-cli env:sync` instead. Commands - `yarn vercel-cli list`, `yarn vercel-cli env:sync`, `yarn vercel-cli logs`.

**Docs:** [vercel-cli-guide.md](docs/template/vercel-cli-guide.md)
**Rules:** [vercel-cli-usage](.ai/skills/template/vercel-cli-usage/SKILL.md)

---

## Additional Rules Reference

Reference table for additional skill rules not covered in main sections.

**Summary:** See the linked skill files for detailed guidelines on each topic.

**Docs:** [additional-rules-reference.md](docs/template/_custom/additional-rules-reference.md)

---

## Command Skills Reference

Reference table for command-based skills (slash commands).

**Summary:** See the linked skill files for command usage and details.

**Docs:** [command-skills-reference.md](docs/template/_custom/command-skills-reference.md)

---

## Wixpress Registry Issues

Handling npm package issues in Wix corporate network. Use this if experiencing lock file or ESLint issues.

**Summary:** Run `yarn setup-hooks` once after cloning. Always use `yarn install`, never `npm install`.

**Docs:** [wixpress-registry-issues.md](docs/template/wixpress-registry-issues.md)

---
