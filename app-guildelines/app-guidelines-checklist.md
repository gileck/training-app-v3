# Application Guidelines Compliance Checklist

This checklist helps ensure that your application follows all established guidelines. Use this as a systematic approach to verifying compliance throughout the codebase.

## 1. API Guidelines Check

Start by reviewing all API modules registered in `src/apis/apis.ts`.

For each API module:

- [ ] Check file structure: `index.ts`, `types.ts`, `server.ts`, and `client.ts` exist
- [ ] Verify API naming pattern:
  - [ ] API names defined ONLY in `index.ts`
  - [ ] Server re-exports API names from `index.ts` 
  - [ ] Client imports API names from `index.ts` (NEVER from `server.ts`)
- [ ] Confirm types are defined in `types.ts` and never duplicated elsewhere
- [ ] Verify client functions return `CacheResult<ResponseType>`
- [ ] Check that business logic is implemented in server-side code (`server.ts` and/or `handlers/*`)
- [ ] Ensure API handlers in `apis.ts` use consistent API names

**Reference**: See `client-server-communications.md` for detailed guidelines on API structure

## 2. Routes Check

Review all routes in `client/routes` folder:

- [ ] Ensure proper route organization follows the app guidelines
- [ ] Verify each route implements appropriate loading states
- [ ] Confirm routes use proper error handling
- [ ] Verify dynamic routes follow naming conventions
- [ ] Ensure routes use layout components appropriately
- [ ] Ensure that the routes are simple, code is orgenized, an splited into mutliple React components if needed.

**Reference**: See `pages-and-routing-guidelines.md` for detailed guidelines on routing

## 3. React Components Check

Review components in `client/components`:

- [ ] Verify components follow established naming conventions
- [ ] Check that components use TypeScript interfaces for props
- [ ] Ensure components don't import server-side code
- [ ] Confirm components make proper use of React hooks
- [ ] Check for clean separation of presentation and logic
- [ ] Verify that components don't redefine API types (should import from API types.ts)
- [ ] Ensure proper error handling in components
- [ ] Check consistent styling approach

**Reference**: See `React-components-guidelines.md` for detailed guidelines on components

## 4. Server Code Check

Review code in the `server` folder:

- [ ] Ensure server code doesn't import client-side code
- [ ] Verify proper error handling in server functions
- [ ] Ensure clean separation of concerns

**Reference**: See `general-code-guidelines.md` and `ai-models-api-usage.md` for server-side practices

## 5. TypeScript and Coding Standards Check

- [ ] Verify consistent type definitions
- [ ] Check for any usage of `any` type (should be avoided)
- [ ] Ensure proper use of TypeScript features
- [ ] Check for consistent formatting
- [ ] Verify error handling approaches
- [ ] Ensure no circular dependencies
- [ ] Ensure no types duplications across the project

**Reference**: See `Typescript-guildelines.md` for TypeScript best practices

## 6. Final Verification

Run the Project checks (typscript and lint)
```bash
yarn checks
```

The application is not compliant with guidelines until `yarn checks` completes with 0 errors. All TypeScript and linting errors must be fixed before considering the guidelines check complete.
Finish the task by making sure `yarn check` is not reporting any issues.