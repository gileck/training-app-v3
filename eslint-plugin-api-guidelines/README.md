# ESLint Plugin: API Guidelines

An ESLint plugin to enforce the API guidelines outlined in our application architecture. This plugin helps maintain the proper separation of client and server code, consistent API naming patterns, and proper type usage.

## Installation

```bash
npm install --save-dev eslint-plugin-api-guidelines
```

## Configuration

Add the plugin to your `.eslintrc.js`:

```js
module.exports = {
  plugins: ['api-guidelines'],
  extends: [
    // Your other extends...
    'plugin:api-guidelines/recommended'
  ],
  rules: {
    // You can override specific rules here
  }
};
```

## Rules

### Import Pattern Rules

#### `api-guidelines/no-server-import-in-client`
Prevents client.ts files from importing from server.ts files, ensuring proper separation of client and server code.

#### `api-guidelines/api-names-from-index`
Ensures API names are imported from index.ts in client files.

#### `api-guidelines/server-reexport-from-index`
Ensures server.ts re-exports API names from index.ts.

### Type Validation Rules

#### `api-guidelines/client-returns-cache-result`
Ensures client API functions properly wrap their return types with CacheResult<T> to handle caching metadata.

#### `api-guidelines/no-duplicate-api-types`
Prevents duplicating types that should be defined in an API's types.ts file.

### Other API Guidelines

#### `api-guidelines/no-direct-api-client-call`
Prevents direct apiClient calls from components - domain-specific client functions should be used instead.

#### `api-guidelines/export-name-from-index`
Ensures index.ts files in API modules export the API name constants used for routing API calls.

#### `api-guidelines/no-export-process-from-index`
Prevents exporting process functions from index.ts, which would cause them to be bundled with client-side code.

## How Rules Enforce Guidelines

This plugin enforces critical aspects of our API architecture:

1. **API Name Flow**
   - API names are defined in index.ts
   - Server re-exports names from index.ts
   - Client imports names from index.ts (never from server.ts)

2. **Type Consistency**
   - API types defined only in types.ts
   - No duplicate type definitions
   - Client functions return CacheResult<T>

3. **Separation of Concerns**
   - No server code in client bundle
   - No direct apiClient calls from components
   - Process functions never exported from index.ts

## Rule Examples

### ❌ Invalid (breaks guidelines)

```typescript
// client.ts
import { name } from './server'; // Error: Import from index.ts instead

// Component.tsx
import apiClient from '@/client/utils/apiClient';
// Error: Use domain-specific client functions
const data = await apiClient.call('api/name', params);

// index.ts
export { process } from './server'; // Error: Don't export process functions
```

### ✅ Valid (follows guidelines)

```typescript
// index.ts
export const name = 'api-name';

// server.ts
import { name } from './index';
export { name }; // Re-export from index

// client.ts
import { name } from './index'; // Correct import from index.ts

// Component.tsx
import { callApi } from '@/apis/domain/client';
const data = await callApi(params); // Use domain-specific client function
``` 