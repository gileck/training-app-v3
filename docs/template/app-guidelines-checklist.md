---
name: app-guidelines-checklist
description: Application Guidelines Compliance Checklist
---
# Application Guidelines Compliance Checklist

This checklist helps ensure that your application follows all established guidelines. Use this as a systematic approach to verifying compliance throughout the codebase.

## 1. API Guidelines Check

Start by reviewing all API modules registered in [src/apis/apis.ts](mdc:src/apis/apis.ts).

For each API module:

- Check file structure: `index.ts`, `types.ts`, `server.ts`, and `client.ts` exist
- Verify API naming pattern:
  - API names defined ONLY in `index.ts`
  - Server re-exports API names from `index.ts` 
  - Client imports API names from `index.ts` (NEVER from `server.ts`)
- Confirm types are defined in `types.ts` and never duplicated elsewhere
- Verify client functions return `CacheResult<ResponseType>`
- Check that business logic is implemented in `server.ts`
- Ensure API handlers in `apis.ts` use consistent API names

**Reference**: See client-server-communications for detailed guidelines on API structure

## 2. Feature-Based Structure Check

Review feature organization in `client/features`:

- Verify each feature has its own folder under `features/`
- Check that feature folders contain: `store.ts`, `hooks.ts`, `types.ts`, `index.ts`
- Ensure feature components live in the feature folder, not `components/`
- Verify features export via `index.ts` (public API)
- Check imports use feature path: `@/client/features/{name}`
- Ensure route-specific code stays in `routes/{Name}/` folder

**Reference**: See feature-based-structure for detailed guidelines

## 3. Zustand Store Factory Check

Review all Zustand stores in `client/features/*/store.ts`:

- **ALL stores MUST use `createStore` from `@/client/stores`**
- No direct `import { create } from 'zustand'` (blocked by ESLint)
- Each store must have:
  - `key`: unique localStorage key
  - `label`: human-readable name for Settings display
  - `creator`: state creator function
  - Either `persistOptions` (for persisted stores) OR `inMemoryOnly: true` (for in-memory)
- For persisted stores with TTL:
  - Use `createTTLValidator` from `@/client/config`
  - Implement `onRehydrateStorage` to clear expired state
- Stores are auto-registered to the registry (no manual registration needed)

**Reference**: See [docs/zustand-stores.md](mdc:docs/zustand-stores.md) for detailed guidelines

## 4. Routes Check

Review all routes in `client/routes` folder:

- Ensure proper route organization follows the app guidelines
- Verify each route implements appropriate loading states
- Confirm routes use proper error handling
- Verify dynamic routes follow naming conventions
- Ensure routes use layout components appropriately
- Ensure that the routes are simple, code is organized, and split into multiple React components if needed.
- Route-specific hooks go in `routes/{Name}/hooks.ts`

**Reference**: See pages-and-routing-guidelines for detailed guidelines on routing

## 5. React Components Check

Review components in `client/components` (shared UI only):

- Verify only shared UI components are in `components/` folder
- Feature-specific components should be in `features/{name}/`
- Check that components use TypeScript interfaces for props
- Ensure components don't import server-side code
- Confirm components make proper use of React hooks
- Verify that components don't redefine API types (should import from API types.ts)
- Ensure proper error handling in components
- Check consistent styling approach

**Reference**: See react-component-organization for detailed guidelines on components

## 6. shadcn/ui Component Library Check

Review all UI components to ensure shadcn/ui is used exclusively:

- **ALL UI components MUST use shadcn/ui** (no Material-UI, Ant Design, Chakra, etc.)
- Verify imports are from `@/client/components/ui/*`
- Check that semantic color tokens are used (never hardcoded colors)
  - Use `bg-background`, `text-foreground`, `border-border`, etc.
  - NEVER use `bg-white`, `text-black`, `bg-blue-500`, etc.
- Confirm Button component uses proper variants: `default`, `secondary`, `outline`, `ghost`, `destructive`
- Ensure proper icon usage with `lucide-react` (not Material Icons or others)
- Verify `asChild` is used for proper component composition
- Check that all form inputs have associated Labels with `htmlFor`/`id`
- Confirm controlled components are used (Dialog, Select, Switch with `open`/`value`/`checked` props)
- Verify mobile-first responsive patterns with Sheet for mobile navigation

**Reference**: See [shadcn-usage](mdc:docs/template/project-guidelines/shadcn-usage.md) for detailed guidelines and [docs/shadcn-component-library.md](mdc:docs/shadcn-component-library.md) for comprehensive component documentation

## 7. Server Code Check

Review code in the `server` folder:

- Ensure server code doesn't import client-side code
- Verify proper error handling in server functions
- Ensure clean separation of concerns

**Reference**: See general-code-guidelines and ai-models-api-usage for server-side practices

## 8. TypeScript and Coding Standards Check

- Verify consistent type definitions
- Check for any usage of `any` type (should be avoided)
- Ensure proper use of TypeScript features
- Check for consistent formatting
- Verify error handling approaches
- Ensure no circular dependencies
- Ensure no types duplications across the project

**Reference**: See Typescript-guildelines for TypeScript best practices

## 9. Final Verification

Run the Project checks (typescript and lint)
```bash
yarn checks
```

The application is not compliant with guidelines until `yarn checks` completes with 0 errors. All TypeScript and linting errors must be fixed before considering the guidelines check complete.
Finish the task by making sure `yarn check` is not reporting any issues.
