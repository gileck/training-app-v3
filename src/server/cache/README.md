# API Route Caching System

This module provides a file system-based caching mechanism for API routes. It's designed to work with Vercel's serverless functions and follows the project's best practices.

## Key Features

- File system-based caching compatible with Vercel's `/tmp` directory
- Type-safe API with TypeScript support
- Configurable TTL (time-to-live) for cache entries
- Cache bypass options
- Cache status and management utilities

## API Reference

### Main Functions

#### `withCache<T>(callback, params, options?): Promise<CacheResult<T>>`

Executes a function with caching support.

```typescript
import { withCache } from '@/serverUtils/cache';

const { result, isFromCache } = await withCache(
  () => fetchExpensiveData(),
  { key: 'data-fetch', params: { userId: '123' } },
  { ttl: 3600000 } // 1 hour
);
```

#### `clearCache(params): boolean`

Clears the cache for specific parameters.

```typescript
import { clearCache } from '@/serverUtils/cache';

clearCache({ key: 'data-fetch', params: { userId: '123' } });
```

#### `getCacheStatus(params): CacheStatus`

Gets the status of a cache entry.

```typescript
import { getCacheStatus } from '@/serverUtils/cache';

const status = getCacheStatus({ key: 'data-fetch', params: { userId: '123' } });
// { exists: true, isExpired: false, metadata: { ... } }
```

#### `clearAllCache(): boolean`

Clears all cache entries.

```typescript
import { clearAllCache } from '@/serverUtils/cache';

clearAllCache();
```

### API Route Integration

Use the `withCachedApiRoute` utility to easily integrate caching with API routes:

```typescript
import { withCachedApiRoute } from '@/serverUtils/cache/withCachedApiRoute';
import { NextApiRequest, NextApiResponse } from 'next';

// Your original handler
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Process request and return response
  return { data: 'some data' };
}

// Wrap with caching
export default withCachedApiRoute(
  handler,
  (req) => ({
    key: 'api-endpoint-name',
    params: {
      // Extract relevant parameters from request for cache key
      query: req.query,
      body: req.method === 'POST' ? req.body : undefined
    }
  }),
  { ttl: 3600000 } // 1 hour
);
```

## Best Practices

1. Always use meaningful cache keys that represent the data being cached
2. Set appropriate TTL values based on how frequently the data changes
3. Include all relevant parameters that affect the output in the cache key
4. Use cache bypassing for debugging or when fresh data is required
5. Monitor cache usage in production to optimize performance and costs
