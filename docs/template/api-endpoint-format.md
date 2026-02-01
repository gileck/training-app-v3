---
title: Client-Server Communication
description: Single API endpoint pattern with React Query. Use this when creating/calling APIs.
summary: All APIs route through `/api/process/{api_name}`. Components use React Query hooks, never call API client functions directly. All domain types in `apis/<domain>/types.ts`.
priority: 2
related_rules:
  - client-server-communications
---

# API Endpoint Format

## Overview

This application uses a centralized API architecture where all API requests are routed through a single dynamic endpoint: `/api/process/[name]`.

## URL Format

The API name is included directly in the URL path, with slashes replaced by underscores:

```
/api/process/{api_name}
```

Where `{api_name}` is the internal API name with slashes (`/`) replaced by underscores (`_`).

## Examples

| Internal API Name | HTTP Endpoint |
|------------------|---------------|
| `auth/me` | `/api/process/auth_me` |
| `auth/login` | `/api/process/auth_login` |
| `auth/register` | `/api/process/auth_register` |
| `todos/getTodos` | `/api/process/todos_getTodos` |
| `todos/createTodo` | `/api/process/todos_createTodo` |
| `chat` | `/api/process/chat` |
| `admin/reports/list` | `/api/process/admin_reports_list` |

## Admin APIs

Any API name under `admin/*` is treated as **admin-only**.

📚 See: [admin.md](./admin.md)

## Request Format

All API requests use the POST method with the following body structure:

```typescript
{
  params: {
    // API-specific parameters
  },
  options: {
    // Optional caching and request options
    disableCache?: boolean;
    bypassCache?: boolean;
    // ... other options
  }
}
```

### Example Request

```javascript
// Calling the auth/me API
fetch('/api/process/auth_me', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    params: {},
    options: {}
  })
})
```

## Response Format

All API responses follow a consistent structure:

```typescript
{
  data: T,              // The actual response data
  isFromCache: boolean  // Whether the response came from cache
}
```

### Example Response

```json
{
  "data": {
    "user": {
      "id": "123",
      "username": "john_doe",
      "email": "john@example.com"
    }
  },
  "isFromCache": false
}
```

## Client-Side Usage

The API client utilities handle the URL format conversion automatically. You don't need to manually replace slashes with underscores:

```typescript
import { apiLogin } from '@/apis/auth/client';

// This will automatically call /api/process/auth_login
const response = await apiLogin({
  username: 'user',
  password: 'pass'
});
```

## Implementation Details

### Client-Side Conversion

The client-side utilities (`apiClient.ts` and `offlinePostQueue.ts`) automatically convert internal API names to the URL format:

```typescript
// Internal: "auth/me"
// Converted to URL: "/api/process/auth_me"
const urlName = name.replace(/\//g, '_');
const response = await fetch(`/api/process/${urlName}`, { ... });
```

### Server-Side Conversion

The server-side handler (`processApiCall.ts`) converts the URL parameter back to the internal format:

```typescript
// URL parameter: "auth_me"
// Converted back to: "auth/me"
const nameParam = req.query.name as string;
const name = nameParam.replace(/_/g, '/');
```

## Why Underscores?

Using underscores in the URL instead of slashes provides several benefits:

1. **Simpler routing**: Single parameter route `[name]` instead of catch-all `[...name]`
2. **Cleaner URLs**: Easier to read and debug in network logs
3. **Better compatibility**: Avoids issues with URL encoding and path traversal
4. **Type safety**: Single string parameter is simpler to handle than arrays

## Migration Notes

If you're migrating from the previous format where the API name was in the request body:

### Before
```typescript
POST /api/process
Body: {
  name: "auth/me",
  params: { ... },
  options: { ... }
}
```

### After
```typescript
POST /api/process/auth_me
Body: {
  params: { ... },
  options: { ... }
}
```

No changes are needed in your application code - the client utilities handle this automatically.

