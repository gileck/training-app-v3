# ESLint Guidelines for API Architecture

This document explains how we use ESLint to automatically enforce our API architecture guidelines.

## The `eslint-plugin-api-guidelines` Plugin

We've created a custom ESLint plugin that enforces critical aspects of our API architecture. This plugin helps prevent common mistakes and ensures consistent implementation of the API patterns.

### Installation

```bash
npm install --save-dev eslint-plugin-api-guidelines
# or
yarn add -D eslint-plugin-api-guidelines
```

Add the plugin to your `.eslintrc.js`:

```js
module.exports = {
  extends: [
    // Other extends...
    'plugin:api-guidelines/recommended'
  ],
  plugins: [
    // Other plugins...
    'api-guidelines'
  ],
};
```

## What Rules Are Enforced

### 1. Import Pattern Enforcement

These rules ensure the proper flow of API names and prevent bundling server code with client code:

- `api-guidelines/no-server-import-in-client`: Prevents client.ts files from importing from server.ts
- `api-guidelines/api-names-from-index`: Ensures API names are imported from index.ts in client files
- `api-guidelines/server-reexport-from-index`: Ensures server.ts re-exports API names from index.ts

### 2. Type Validation

These rules enforce type consistency and prevent duplication:

- `api-guidelines/client-returns-cache-result`: Ensures client functions return CacheResult<T> type
- `api-guidelines/no-duplicate-api-types`: Prevents duplicating types that should be in types.ts

### 3. Other API Guidelines

These rules enforce other important aspects of our architecture:

- `api-guidelines/no-direct-api-client-call`: Prevents direct apiClient calls from components
- `api-guidelines/export-name-from-index`: Ensures index.ts exports API name constants
- `api-guidelines/no-export-process-from-index`: Prevents exporting process functions from index.ts

## How This Helps Our Development Process

1. **Automated Verification**: Rules automatically verify compliance with our API guidelines
2. **Immediate Feedback**: Developers get immediate feedback if they break the patterns
3. **Self-Documenting**: The rules themselves document and explain the guidelines
4. **Consistent Implementation**: Ensures consistent implementation across the codebase
5. **Prevents Critical Errors**: Prevents errors like importing server code in client bundles

## Example Violations and Fixes

### Example 1: Importing API names from server.ts instead of index.ts

```typescript
// ❌ WRONG: Importing from server.ts
import { name } from './server';

// ✅ CORRECT: Importing from index.ts
import { name } from './index';
```

### Example 2: Missing CacheResult wrapper in client functions

```typescript
// ❌ WRONG: Missing CacheResult wrapper
export const getUser = async (id: string): Promise<UserResponse> => {
  return apiClient.call(name, { id });
};

// ✅ CORRECT: Using CacheResult wrapper
export const getUser = async (id: string): Promise<CacheResult<UserResponse>> => {
  return apiClient.call<CacheResult<UserResponse>, GetUserRequest>(name, { id });
};
```

### Example 3: Duplicating API types in components

```typescript
// ❌ WRONG: Duplicating types in components
// Component.tsx
type UserResponse = { // Duplicating API type
  id: string;
  name: string;
};

// ✅ CORRECT: Importing types from API types.ts
// Component.tsx
import { UserResponse } from '@/apis/users/types';
```

## Integrating with Continuous Integration

For maximum effectiveness, ensure the ESLint rules are run:

1. In your IDE/editor during development
2. As a pre-commit hook using Husky
3. In your CI pipeline

Our API guidelines check is not complete until `yarn check` reports zero ESLint errors related to these rules.

## Relationship to Guidelines Documentation

These lint rules enforce the patterns described in detail in:
- `client-server-communications.md`
- `api-guidelines-checklist.md`

The lint rules provide automated enforcement of the most critical patterns, but developers should still review the full guidelines for complete understanding. 