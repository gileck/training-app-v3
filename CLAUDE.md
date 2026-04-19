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

Auto-generate CLAUDE.md from docs. Run this after creating or updating docs.

**Summary:** Run `yarn build:claude` to regenerate CLAUDE.md from all docs with frontmatter. **IMPORTANT: Run this after adding new docs or updating title/summary/description in existing docs.**

**Docs:** [build-claude-md.md](docs/template/build-claude-md.md)

---

## Project Structure Guidelines

Where to put your project code and what not to modify. Use this when adding new features or modifying the codebase.

**Summary:** Template-owned paths sync automatically and should NOT be modified. Put project code in `project/` folders and `*.project.ts` files. Use `projectOverrides` only when absolutely necessary.

**Docs:** [project-structure-guidelines.md](docs/template/project-structure-guidelines.md)

---

## Project Validation

Complete guide to code validation - what checks exist, how they run locally and in CI, and how to use them programmatically.

**Summary:** **CRITICAL: Always run `yarn checks` before completing work.** Runs 4 checks in parallel: TypeScript, ESLint, circular dependencies, unused dependencies. Must pass with 0 errors before committing, creating PRs, or deploying.

**Docs:** [project-validation.md](docs/template/project-validation.md)

---

## Admin-Approved Signups

Gate new signups behind admin approval. Use this when setting up or customizing the admin approval flow.

**Summary:** Enabled by default. New signups land in 'pending' status until an admin approves via /admin/approvals. First-user-wins bootstrap auto-approves the first signup on a fresh deployment. Admin (ADMIN_USER_ID) always bypasses the gate. Disable with requireAdminApproval: false in src/apis/auth-overrides.ts.

**Docs:** [admin-approved-signups.md](docs/template/admin-approved-signups.md)

---

## Authentication

Instant-boot authentication pattern for PWA. Use this when working with auth flows.

**Summary:** Uses `isProbablyLoggedIn` hint in localStorage for instant render, validates with server in background. JWT in HttpOnly cookie. Use `useUser()` for validated user, `useAuthStore(s => s.userPublicHint)` for instant-boot UI. Child projects can override login/signup logic via `src/apis/auth-overrides.ts` and control UI via `src/client/auth-config.ts`.

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
**Rules:** [client-server-communications](docs/template/project-guidelines/client-server-communications.md)

---

## Error Handling

Guidelines for handling and displaying errors across the application. Use this when implementing error states, catch blocks, or user-facing error messages.

**Guidelines:**
- Use `ErrorDisplay` for route/page errors, `errorToast` for mutations
- Never show raw `error.message` — use `cleanErrorMessage()` or `getUserFriendlyMessage()`
- Stack traces are admin-only
- Always pass error object to `errorToast` (enables copy)
- Use `errorToastAuto(error, fallback)` for automatic classification
- Validation errors use plain `toast.error()`, NOT `errorToast`
- Import from specific files to avoid circular deps with bug-report/auth

**Full docs:** [error-handling.md](docs/template/error-handling.md), [logging-and-error-tracking.md](docs/template/logging-and-error-tracking.md), [react-query-mutations.md](docs/template/react-query-mutations.md)

---

## Offline/PWA Support

Full offline support with optimistic updates. Use this when implementing mutations.

**Guidelines:**
- CRITICAL: Never update UI from server response — only optimistic updates in `onMutate`
- Keep `onSuccess` empty
- Keep `onSettled` empty
- Only rollback in `onError`
- Mutations must handle empty `{}` responses (offline queue)

**Full docs:** [offline-pwa-support.md](docs/template/offline-pwa-support.md)

---

## State Management

Dual-store architecture for PWA with offline support. Use this when managing application state.

**Guidelines:**
- React Query for server data, Zustand for client state, useState for 4 ephemeral cases only
- Valid useState: text input, dialog open, in-flight submission, confirm dialog
- Everything else MUST use Zustand
- All Zustand stores MUST use `createStore` factory
- NEVER update UI from server response — optimistic-only pattern

**Full docs:** [state-management.md](docs/template/state-management.md), [react-query-mutations.md](docs/template/react-query-mutations.md), [zustand-stores.md](docs/template/zustand-stores.md)
**Rules:** [state-management-guidelines](docs/template/project-guidelines/state-management-guidelines.md)

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

**Summary:** All operations in `src/server/database/collections/`. Use `toStringId()`, `toQueryId()`, `toDocumentId()` from `@/server/template/utils`. **CRITICAL: Always use optional chaining and fallbacks for schema backward compatibility.**

**Docs:** [mongodb-usage.md](docs/template/mongodb-usage.md)
**Rules:** [mongodb-usage](docs/template/project-guidelines/mongodb-usage.md)

---

## React Rendering & Infinite Loops

Common pitfalls causing infinite re-renders. Use this when debugging render loops.

**Summary:** Never return `{}` or `[]` literals in Zustand selector fallbacks - use module-level constants. Never return object literals from selectors to extract multiple values - use individual selectors instead.

**Docs:** [react-rendering-guidelines.md](docs/template/react-rendering-guidelines.md)

---

## Theming System

Application theming with semantic color tokens. Use this when customizing colors and themes.

**Summary:** Comprehensive theming with semantic color tokens. Never hardcode colors - always use theme variables like `bg-background`, `text-foreground`.

**Docs:** [theming.md](docs/template/theming.md)

---

## UI & Styling

shadcn/ui components with semantic theming. Use this when adding/editing UI components.

**Summary:** Use shadcn/ui as the ONLY component library. All colors must use semantic tokens (`bg-background`, `text-foreground`), never hardcode colors (`bg-white`, `text-black`).

**Docs:** [shadcn-component-library.md](docs/template/shadcn-component-library.md), [theming.md](docs/template/theming.md)
**Rules:** [shadcn-usage](docs/template/project-guidelines/shadcn-usage.md), [theming-guidelines](docs/template/project-guidelines/theming-guidelines.md)

---

## Critical Deployment Issues

Common deployment pitfalls. Use this before deploying to production.

**Summary:** Always run `vercel link` first. Verify env vars match with `yarn verify-production`. Use `src/pages/` not `pages/`.

**Docs:** [critical-deployment-issues.md](docs/template/critical-deployment-issues.md)

---

## Git Worktree Workflow

Isolated development with clean commit history. Use this for feature/fix development.

**Summary:** Create worktree for development, squash merge to main for single clean commit. Always run `yarn checks` before merging.

**Docs:** [git-worktree-workflow.md](docs/template/git-worktree-workflow.md)

---

## GitHub PR CLI Tool

CLI for managing GitHub pull requests. Use this when creating/managing PRs programmatically.

**Summary:** Auto-detects `owner/repo` from git remote. Use `--cloud-proxy` in Claude Code cloud. Commands - `yarn github-pr create`, `yarn github-pr list`, `yarn github-pr merge`.

**Docs:** [github-pr-cli-guide.md](docs/template/github-pr-cli-guide.md)

---

## iOS-Inspired UI Design Guidelines

Design philosophy and iOS-inspired principles for UI components. Use this for understanding design patterns, advanced concepts (RTL, haptics, animations), and QA checklists.

**Summary:** iOS-inspired design reference with semantic color tokens, 8px spacing grid, 44px touch targets, spring animations, dark mode handling, accessibility standards, and comprehensive QA checklists. Code examples use raw CSS/HTML — adapt to shadcn + Tailwind patterns when implementing.

**Docs:** [ui-design-guidelines.md](docs/template/ui-design-guidelines.md)

---

## MCP / SDK Programmatic Access

Give agents and scripts typed, authenticated access to every app endpoint via a bearer-token + X-On-Behalf-Of pattern.

**Summary:** Bake programmatic access into any child project: `ADMIN_API_TOKEN` + `X-On-Behalf-Of` lets a Node SDK or MCP server act as any user. Run `yarn init:mcp` to scaffold `packages/<name>-sdk/` and `packages/<name>-mcp/`.

**Docs:** [mcp-sdk-access.md](docs/template/mcp-sdk-access.md), [admin.md](docs/template/admin.md), [authentication.md](docs/template/authentication.md)

---

## Telegram Notifications (App Runtime)

Application feature for sending notifications via Telegram. Use this when adding app notifications.

**Summary:** Two types - Owner notifications (system alerts) and User notifications (personal alerts). Requires `TELEGRAM_BOT_TOKEN`. Run `yarn telegram-setup` for chat IDs.

**Docs:** [telegram-notifications.md](docs/template/telegram-notifications.md)

---

## Vercel CLI Tool

CLI for managing Vercel deployments and env vars. Use this for deployment operations.

**Summary:** Run `vercel link` first. **CRITICAL: Never use `npx vercel env add` with piped input** - use `yarn vercel-cli env:sync` instead. Commands - `yarn vercel-cli list`, `yarn vercel-cli env:sync`, `yarn vercel-cli logs`.

**Docs:** [vercel-cli-guide.md](docs/template/vercel-cli-guide.md)
**Rules:** [vercel-cli-usage](docs/template/project-guidelines/vercel-cli-usage.md)

---

## RPC-over-MongoDB Architecture

Generic remote function execution system for running server code on a local machine via MongoDB. Use this when working with the RPC daemon or adding new remote handlers.

**Summary:** Vercel inserts jobs into MongoDB, a local daemon polls and executes them, returns results via MongoDB. Used to bypass datacenter IP blocks.

**Key Points:**
- `src/server/template/rpc/` - Generic RPC system (zero project-specific code)
- Start daemon: `yarn daemon` or `yarn daemon --verbose`
- Handlers are modules with a default export async function
- Security: shared secret (RPC_SECRET env var) + path validation + file existence check
- task-cli config: `agent-tasks/rpc-daemon/config.json`

**Docs:** [rpc-architecture.md](docs/template/rpc-architecture.md)

---

## Wixpress Registry Issues

Handling npm package issues in Wix corporate network. Use this if experiencing lock file or ESLint issues.

**Summary:** Run `yarn setup-hooks` once after cloning. Always use `yarn install`, never `npm install`.

**Docs:** [wixpress-registry-issues.md](docs/template/wixpress-registry-issues.md)

---

# github-agents-workflow

## GitHub Agents Workflow Overview

Architecture and flow of the AI-powered feature/bug pipeline. Use this to understand the agent workflow system.

**Summary:** 9-status pipeline (Backlog → Product Development → Product Design → Bug Investigation → Tech Design → Ready for development → PR Review → Final Review → Done). Items enter via UI or CLI, approve via Telegram, then flow through Product Design / Bug Investigator / Tech Design / Implementor / PR Review / Workflow Review agents. Dual-tracked in source collections + workflow-items; all actions log to `agent-logs/issue-N.md`.

**Docs:** [overview.md](docs/template/github-agents-workflow/overview.md), [setup-guide.md](docs/template/github-agents-workflow/setup-guide.md), [cli.md](docs/template/github-agents-workflow/cli.md), [workflow-e2e.md](docs/template/github-agents-workflow/workflow-e2e.md), [workflow-items-architecture.md](docs/template/github-agents-workflow/workflow-items-architecture.md)

---

## Agent Workflow CLI

CLI for managing workflow items. Use this when working with `yarn agent-workflow` commands.

**Summary:** `yarn agent-workflow` commands: `start` (interactive), `create`, `list` (filter by --type/--status/--domain), `get` (details + live status), `update` (status/priority/size/complexity/domain, supports --dry-run). ID lookup accepts ObjectId, 8-char prefix, or GitHub issue number. Flags: `--auto-approve`, `--route`, `--created-by`.

**Docs:** [cli.md](docs/template/github-agents-workflow/cli.md), [overview.md](docs/template/github-agents-workflow/overview.md), [workflow-e2e.md](docs/template/github-agents-workflow/workflow-e2e.md)

---

## Directory Locking

Directory-level lock for preventing concurrent agent runs on same working directory

**Summary:** Master script acquires per-directory lock using PID-based ownership and stale detection. Prevents concurrent git operations and file modifications.

**Docs:** [directory-locking.md](docs/template/github-agents-workflow/directory-locking.md)

---

## GitHub Agents Workflow Setup

Complete setup instructions for the GitHub agents workflow. Use this when setting up the workflow for the first time.

**Summary:** Setup requires: GitHub tokens (admin + bot), MongoDB connection, optional Telegram integration. Pipeline status tracked in workflow-items MongoDB collection. Run `yarn verify-setup` to check configuration.

**Key Points:**
- Two tokens: GITHUB_TOKEN (admin/PR reviews) + GITHUB_BOT_TOKEN (PRs/issues)
- Pipeline status tracked in workflow-items MongoDB collection (no GitHub Projects setup needed)
- Optional: Telegram topics for organized notifications
- Optional: Claude GitHub App for automated PR reviews

**Docs:** [setup-guide.md](docs/template/github-agents-workflow/setup-guide.md), [overview.md](docs/template/github-agents-workflow/overview.md), [workflow-items-architecture.md](docs/template/github-agents-workflow/workflow-items-architecture.md), [telegram-notifications.md](docs/template/telegram-notifications.md)

---

## Guards and Hooks

**Summary:** Complete catalog of guards (precondition checks) and hooks (side effects) extracted from current workflow-service functions, with registry design and function mapping table.

**Docs:** [guards-and-hooks.md](docs/template/github-agents-workflow/new-pipeline-architecture/guards-and-hooks.md)

---

## Implementation Roadmap

**Summary:** Phase dependency graph, progress tracking, and execution order for the 8-phase pipeline architecture migration.

**Docs:** [overview.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/overview.md)

---

## Phase 1: Foundation

**Summary:** Create type system, engine skeleton, guard/hook registries, and DB schema changes for the pipeline architecture.

**Docs:** [phase-1-foundation.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-1-foundation.md)

---

## Phase 2: Guards and Hooks

**Summary:** Extract all precondition checks and side effects from current workflow-service functions into standalone guard and hook modules.

**Docs:** [phase-2-guards-and-hooks.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-2-guards-and-hooks.md)

---

## Phase 3: Pipeline Definitions

**Summary:** Create the two pipeline definition const objects (feature, bug) with unit tests validating internal consistency.

**Docs:** [phase-3-pipeline-definitions.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-3-pipeline-definitions.md)

---

## Phase 4: Engine Core

**Summary:** Implement the pipeline engine with transition validation, guard execution, hook orchestration, dual-write, and concurrency control.

**Docs:** [phase-4-engine-core.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-4-engine-core.md)

---

## Phase 5: Internal Migration

**Summary:** Refactor each workflow-service function into a thin wrapper around the pipeline engine, one function at a time with E2E validation after each.

**Docs:** [phase-5-internal-migration.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-5-internal-migration.md)

---

## Phase 6: External Migration

**Summary:** Migrate all transport layer callers (Telegram handlers, API handlers, CLI, agents) from direct workflow-service function calls to engine-based calls.

**Docs:** [phase-6-external-migration.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-6-external-migration.md)

---

## Phase 7: Cleanup

**Summary:** Remove deprecated function bodies, old constants, and unused code after all callers have been migrated to the pipeline engine.

**Docs:** [phase-7-cleanup.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-7-cleanup.md)

---

## Phase 8: Verification & Review

**Summary:** Verify that all known concerns, edge cases, and awareness items from the design review are properly handled in the final implementation.

**Docs:** [phase-8-verification.md](docs/template/github-agents-workflow/new-pipeline-architecture/implementation/phase-8-verification.md)

---

## Pipeline Architecture Overview

Use this to understand the new pipeline architecture design, its motivation, and how it replaces the current workflow-service implementation.

**Summary:** JSON-driven pipeline engine replacing unvalidated status transitions with declared state machines, validated by a generic engine with registered hooks and guards.

**Docs:** [overview.md](docs/template/github-agents-workflow/new-pipeline-architecture/overview.md)

---

## Pipeline Definition Schema

**Summary:** TypeScript interfaces and design decisions for declaring pipeline statuses, transitions, guards, hooks, and review flows as typed const objects.

**Docs:** [pipeline-schema.md](docs/template/github-agents-workflow/new-pipeline-architecture/pipeline-schema.md)

---

## Pipeline Definitions

**Summary:** Design notes for the two pipeline definitions (feature, bug) including status maps, transition overviews, multi-phase handling, and undo semantics.

**Docs:** [pipeline-definitions.md](docs/template/github-agents-workflow/new-pipeline-architecture/pipeline-definitions.md)

---

## Pipeline Engine

**Summary:** Pipeline engine interface, concurrency model, dual-write pattern, and agent integration for executing validated state transitions.

**Docs:** [engine.md](docs/template/github-agents-workflow/new-pipeline-architecture/engine.md)

---

## Testing Strategy

**Summary:** E2E test strategy using existing tests as regression validation, with no test changes needed during migration since exported function signatures are preserved.

**Docs:** [testing.md](docs/template/github-agents-workflow/new-pipeline-architecture/testing.md)

---

## Unified Workflow Service Layer

**Summary:** Architecture of the unified workflow service that centralizes all business logic for workflow lifecycle operations (approve, route, delete, advance, review, merge, revert, undo, decision, agent completion) across transports.

**Docs:** [workflow-service.md](docs/template/github-agents-workflow/workflow-service.md)

---

## Workflow E2E Tests

**Summary:** E2E tests that verify the full agent workflow lifecycle by mocking only at system boundaries (LLM, Telegram, filesystem) while running real code for artifacts, phases, parsing, workflow-db, logging, and decision-utils against an in-memory MongoDB.

**Docs:** [e2e-tests.md](docs/template/github-agents-workflow/e2e-tests.md)

---

## GitHub Agents Workflow E2E Scenarios

Visual workflows for all workflow scenarios. Use this to understand specific flows like multi-phase features, request changes, or rejections.

**Summary:** Comprehensive visual diagrams for: simple features, multi-phase features (L/XL split into phases), bug fixes, design/implementation request changes flows, undo actions (5-min window), clarification flows, and rejection scenarios.

**Key Points:**
- Simple features can skip design phases and go straight to implementation
- Multi-phase features create sequential PRs (Phase 1/3, 2/3, 3/3)
- Request Changes triggers revision cycle on same PR
- 5-minute undo window for accidental Request Changes clicks

**Docs:** [workflow-e2e.md](docs/template/github-agents-workflow/workflow-e2e.md), [overview.md](docs/template/github-agents-workflow/overview.md), [workflow-items-architecture.md](docs/template/github-agents-workflow/workflow-items-architecture.md)

---

## Bug Investigation Workflow

Complete documentation for the Bug Investigator agent and bug fix selection flow.

**Summary:** On approval, bugs auto-route to Bug Investigation. The agent runs read-only analysis and posts a GitHub comment with root cause + fix options. Obvious fixes (high confidence + S complexity + destination=implement) auto-submit; otherwise admin picks an option at /decision/:issueNumber, routing to Tech Design or Implementation. Telegram notifications fire either way.

**Docs:** [bug-investigation.md](docs/template/github-agents-workflow/bug-investigation.md), [overview.md](docs/template/github-agents-workflow/overview.md), [workflow-e2e.md](docs/template/github-agents-workflow/workflow-e2e.md), [setup-guide.md](docs/template/github-agents-workflow/setup-guide.md)

---

## GitHub Agents Workflow Setup (Legacy — GitHub Projects)

Legacy setup using GitHub Projects for pipeline status. Prefer the MongoDB-based setup in setup-guide.md.

**Summary:** Legacy flow backed by a GitHub Project (6-column Status field + Review Status field). Requires admin + bot tokens. Prefer setup-guide.md (MongoDB-based) for new installs.

**Docs:** [setup-guide-legacy-github-projects.md](docs/template/github-agents-workflow/setup-guide-legacy-github-projects.md), [overview.md](docs/template/github-agents-workflow/overview.md), [telegram-notifications.md](docs/template/telegram-notifications.md)

---

## Workflow Review Agent

Pipeline agent that reviews completed workflow items and creates improvement issues.

**Summary:** Last pipeline step (after pr-review). Picks up Done items where `reviewed !== true`, analyzes agent logs via LLM (read-only tools), appends `[LOG:REVIEW]` to `agent-logs/issue-N.md`, stores `reviewSummary` on the workflow item, sends Telegram, and files improvement issues via `yarn agent-workflow create` (admin-approved). Skips items without local logs.

**Docs:** [workflow-review.md](docs/template/github-agents-workflow/workflow-review.md), [overview.md](docs/template/github-agents-workflow/overview.md), [running-agents.md](docs/template/github-agents-workflow/running-agents.md), [agent-logging.md](docs/template/github-agents-workflow/agent-logging.md)

---

# project-guidelines

## Mobile-First Philosophy

All UI must be designed for mobile screens first (~400px width). Use this when implementing any UI.

**Guidelines:**
- Design for ~400px width FIRST, then enhance with `sm:`, `md:`, `lg:` modifiers
- Touch targets MUST be minimum 44px — use `min-h-11` or invisible extension pattern
- No horizontal scroll — content must fit within mobile viewport
- Use `pb-20` on mobile main to clear fixed bottom navigation
- Always use semantic color tokens — never hex values or raw Tailwind colors

**Full docs:** [ui-mobile-first-shadcn.md](docs/template/project-guidelines/ui-mobile-first-shadcn.md)

---

## State Management Rules

when managing state in the application (client state, server state, offline support)

**Guidelines:**
- React Query for API data, Zustand for client state, useState ONLY for 4 ephemeral cases
- Valid useState: text input, dialog open, in-flight submission, confirm dialog — everything else MUST use Zustand
- All Zustand stores MUST use `createStore` from `@/client/stores` — direct zustand imports blocked by ESLint
- NEVER update UI from server response — optimistic-only pattern: update in `onMutate`, rollback in `onError`, empty `onSuccess`/`onSettled`
- Default to Zustand persisted — use `inMemoryOnly: true` only for truly transient state

**Full docs:** [state-management-guidelines.md](docs/template/project-guidelines/state-management-guidelines.md)

---

## Client-Server Communications

Client-Server Communication Guidelines

**Guidelines:**
- Single API endpoint: all requests route through `/api/process/{api_name}`
- ALL domain types MUST be in `apis/<domain>/types.ts` — never duplicate in components
- Components use React Query hooks — never call API client functions directly
- API names defined in `<domain>/index.ts`, handlers in `<domain>/handlers/`, coordinator in `<domain>/server.ts`
- No client code in server files, no server code in client files
- Mutations return `{}` when offline — always guard against empty data

**Full docs:** [client-server-communications.md](docs/template/project-guidelines/client-server-communications.md)

---

## Feature-Based Structure

Feature-based folder structure for client code. Use this when organizing client-side code.

**Guidelines:**
- All feature code lives together in `src/client/features/{name}/` (stores, hooks, components, types)
- `features/` for cross-route features, `routes/` for route-specific code, `components/` for shared UI primitives only
- All Zustand stores MUST use `createStore` factory from `@/client/stores`
- Import from feature index (`@/client/features/auth`), NOT internal files (`auth/store`)
- Feature-specific components go in `features/`, NOT `components/`

**Full docs:** [feature-based-structure.md](docs/template/project-guidelines/feature-based-structure.md)

---

## MongoDB Usage

when accessing the database or a collection in the db

**Guidelines:**
- All MongoDB operations MUST be in `src/server/database/collections/` — never import `mongodb` directly in API handlers
- Use `toStringId()`, `toQueryId()`, `toDocumentId()` from `@/server/template/utils` — never use `ObjectId` methods directly
- CRITICAL: Always use optional chaining and fallbacks for schema backward compatibility (`doc.field?.toISOString() ?? fallback`)
- New fields must be optional (`?`) with nullish coalescing (`??`) defaults

**Full docs:** [mongodb-usage.md](docs/template/project-guidelines/mongodb-usage.md)

---

## React Components

Component organization and patterns. Use this when creating/organizing components.

**Guidelines:**
- CRITICAL: Always check states in order — Loading → Error → Empty → Data
- Check `isLoading || data === undefined` before showing empty state
- Components under 150 lines — split at 200+
- Route-specific code in `routes/{Name}/`, shared features in `features/`
- Feature-specific components go in `features/`, NOT `components/`
- Use React Query hooks for data fetching — never useState/useEffect

**Full docs:** [react-component-organization.md](docs/template/project-guidelines/react-component-organization.md), [react-hook-organization.md](docs/template/project-guidelines/react-hook-organization.md), [feature-based-structure.md](docs/template/project-guidelines/feature-based-structure.md)

---

## React Hook Organization

React Query hooks and Zustand integration patterns. Use this when creating data fetching hooks.

**Guidelines:**
- Colocate hooks in `hooks.ts` within route or feature folder
- Query hooks: always use `useQueryDefaults()` for centralized cache config
- Mutation hooks: optimistic updates in `onMutate`, rollback in `onError`, empty `onSuccess`/`onSettled`
- CRITICAL: Check `data === undefined` alongside `isLoading` — only show empty state when data is defined AND empty
- Mutations must handle empty `{}` responses (offline mode)

**Full docs:** [react-hook-organization.md](docs/template/project-guidelines/react-hook-organization.md)

---

## Routes & Navigation

Adding routes and keeping navigation menus in sync. Use this when adding client routes.

**Guidelines:**
- Routes defined in `src/client/routes/index.ts` — add to `navItems` in `NavLinks.tsx` if user-accessible
- Use kebab-case paths (`/new-route`), PascalCase folders/components
- Data fetching via React Query hooks in `hooks.ts` — never direct API calls in components
- Always use `navigate()` from `useRouter()` — never `window.location.href`
- Route options: `public` (no auth), `adminOnly`, `fullScreen`

**Full docs:** [pages-and-routing-guidelines.md](docs/template/project-guidelines/pages-and-routing-guidelines.md)

---

## Settings Usage

User preferences and configuration patterns. Use this when implementing persistent user settings.

**Guidelines:**
- Use `useSettingsStore` from `@/client/features/settings` for all user preferences
- Subscribe to specific slices: `useSettingsStore((state) => state.settings.theme)`
- Update with: `updateSettings({ fieldName: value })`
- Use `useEffectiveOffline()` for combined offline detection (user toggle OR device offline)
- Add new fields in `types.ts` with defaults in `defaultSettings`

**Full docs:** [settings-usage-guidelines.md](docs/template/project-guidelines/settings-usage-guidelines.md)

---

## shadcn/ui Usage

when building UI components - MUST use shadcn/ui

**Guidelines:**
- shadcn/ui is the ONLY component library — never use Material-UI, Ant Design, Chakra, etc.
- NEVER hardcode colors (`bg-white`, `text-black`, `bg-blue-500`) — always use semantic tokens (`bg-background`, `text-foreground`)
- Use built-in variants (`variant="outline"`, `size="sm"`) instead of custom styling
- Use `asChild` for proper component composition (e.g., `DialogTrigger asChild`)
- Icons from `lucide-react` only — no other icon libraries
- Always provide `Label` with `htmlFor`/`id` for form inputs

**Full docs:** [shadcn-usage.md](docs/template/project-guidelines/shadcn-usage.md)

---

## Theming Guidelines

Theming and styling guidelines for components

**Guidelines:**
- ALWAYS use semantic CSS variables — never hardcode colors like `bg-white`, `text-black`, `bg-blue-500`, or hex values
- Exception: dialog/modal overlays may use `bg-black/60` (standard shadcn pattern)
- Use `bg-background`, `text-foreground`, `border-border`, `bg-card`, `text-muted-foreground`, etc.
- Status colors: `text-success`, `text-warning`, `text-info`, `text-destructive`
- Test components with 2+ theme presets in both light and dark modes

**Full docs:** [theming-guidelines.md](docs/template/project-guidelines/theming-guidelines.md)

---

## TypeScript

Strict TypeScript guidelines. Use this when writing TypeScript code.

**Guidelines:**
- No `any` types — use `unknown` and narrow with type guards
- Never cast to `any` (`as any`) — use proper type narrowing
- Prefer union types (`'pending' | 'approved'`) over enums
- All domain types MUST be defined in `apis/<domain>/types.ts` — never duplicate in components
- Do NOT create complex types — prefer simple, self-explanatory types

**Full docs:** [typescript-guidelines.md](docs/template/project-guidelines/typescript-guidelines.md)

---

## User Access

Accessing authenticated user in client and server code. Use this when implementing user-specific features.

**Guidelines:**
- Client: `const { user } = useAuth(); const userId = user?.id;`
- Server: `const userId = context.userId;` from `ApiHandlerContext` — always check if undefined
- Server `userId` is `undefined` if token is invalid or missing — always guard

**Full docs:** [user-access.md](docs/template/project-guidelines/user-access.md)

---

## AI Model API Usage

Server-side AI model integration patterns. Use this when calling AI APIs.

**Guidelines:**
- NEVER call AI APIs directly — always use `AIModelAdapter` from `src/server/template/ai/baseModelAdapter.ts`
- All AI calls MUST be server-side only — never expose API keys client-side
- Validate model IDs using `isModelExists()` before adapter initialization
- Always return 200 status codes with error fields, never throw uncaught errors
- Track and return cost of each AI call

**Full docs:** [ai-models-api-usage.md](docs/template/project-guidelines/ai-models-api-usage.md)

---

## ESLint Custom Rules

Custom ESLint rules and when to use disable comments. Use this when fixing lint issues.

**Guidelines:**
- Never use ESLint disable comments unless specifically instructed
- Exception: `state-management/prefer-state-architecture` — add disable comment WITH explanation
- Only 4 valid useState cases: text input, dialog open, in-flight submission, confirm dialog
- All other UI state (filters, view mode, sort, tabs, collapsed sections) MUST use Zustand
- Always run `yarn checks` after fixing lint issues

**Full docs:** [eslint-custom-guidelines.md](docs/template/project-guidelines/eslint-custom-guidelines.md)

---

## Vercel CLI Usage

when using Vercel CLI tool or managing Vercel deployments

**Guidelines:**
- Run `vercel link` first to auto-detect project ID
- NEVER use `npx vercel env add` with piped input — use `yarn vercel-cli env:push` instead
- Use `--cloud-proxy` when running in Claude Code cloud environment
- Check build logs first when deployments fail: `yarn vercel-cli logs --deployment dpl_xxx`

**Full docs:** [vercel-cli-usage.md](docs/template/project-guidelines/vercel-cli-usage.md)

---

# standalone-agents

## Repo Commits Code Reviewer

Standalone agent that reviews git commits for bugs and improvements. Use this to understand the automated code review system.

**Summary:** Reviews current source code guided by recent commits using diff-budget batching, creates issues via agent-workflow for admin approval. Runs every 4 hours, NOT part of the GitHub Projects workflow pipeline.

**Key Points:**
- Diff-budget approach: ~1500 lines per run, walks commits chronologically
- Creates issues via `yarn agent-workflow create` for Telegram approval
- Output includes priority, size (XS/S/M/L), complexity, and risk assessment
- State tracked in agent-tasks/repo-commits-code-reviewer/state.json

**Docs:** [repo-commits-code-reviewer.md](docs/template/standalone-agents/repo-commits-code-reviewer.md)

---

# _custom

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

## Additional Rules Reference

Reference table for additional skill rules not covered in main sections.

**Summary:** See the linked skill files for detailed guidelines on each topic.

**Docs:** [additional-rules-reference.md](docs/template/_custom/additional-rules-reference.md)

---

## Command Skills Reference

Reference table for command-based skills (slash commands).

**Summary:** See the linked command files for command usage and details.

**Docs:** [command-skills-reference.md](docs/template/_custom/command-skills-reference.md)

---

# template-sync

## Template Sync

Merge updates from template repository. Use this when syncing template changes to project.

**Summary:** Path ownership model with `templatePaths` (synced) and `projectOverrides` (kept different). Three-file pattern (`index.template.ts`, `index.project.ts`, `index.ts`) eliminates override conflicts.

**Docs:** [template-sync.md](docs/template/template-sync/template-sync.md), [sync-flows-reference.md](docs/template/template-sync/sync-flows-reference.md)

---
