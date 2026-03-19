---
name: mongodb-usage
description: when accessing the database or a collection in the db
title: MongoDB Usage
guidelines:
  - "All MongoDB operations MUST be in `src/server/database/collections/` — never import `mongodb` directly in API handlers"
  - "Use `toStringId()`, `toQueryId()`, `toDocumentId()` from `@/server/template/utils` — never use `ObjectId` methods directly"
  - "CRITICAL: Always use optional chaining and fallbacks for schema backward compatibility (`doc.field?.toISOString() ?? fallback`)"
  - "New fields must be optional (`?`) with nullish coalescing (`??`) defaults"
priority: 3
---
# MongoDB Usage Guidelines

**Full documentation:** [docs/mongodb-usage.md](docs/mongodb-usage.md)

## Quick Reference

### Core Principles
1. All MongoDB operations in `src/server/database/collections/`
2. Never import `mongodb` directly in API handlers
3. Use `@/server/template/utils` for ID conversion

### ID Utilities
```typescript
import { toStringId, toQueryId, toDocumentId } from '@/server/template/utils';

// API responses
{ _id: toStringId(doc._id) }

// MongoDB queries
{ _id: toQueryId(clientId) }

// Document insertion
{ _id: toDocumentId(clientId) }
```

## ⚠️ CRITICAL: Schema Backward Compatibility

**When adding new fields to schemas, existing documents won't have them. Always use optional chaining and fallbacks:**

```typescript
// ✅ CORRECT - Handle potentially missing fields
const createdAt = doc.createdAt?.toISOString() ?? new Date().toISOString();
const firstOccurrence = doc.firstOccurrence?.toISOString() ?? createdAt;
const count = doc.count ?? 1;

// ❌ WRONG - Assumes field always exists (crashes on legacy docs)
const createdAt = doc.createdAt.toISOString();
```

**When Adding New Fields:**
1. Add as optional in TypeScript (`?`) or provide defaults
2. Use optional chaining (`?.`) when accessing
3. Provide fallbacks with nullish coalescing (`??`)
4. Consider migration scripts for critical fields

See [docs/mongodb-usage.md](docs/mongodb-usage.md) for full details.

## What NOT To Do

### ❌ NEVER import MongoDB directly in API layer:
```typescript
// WRONG - This is forbidden
import { MongoClient, Collection } from 'mongodb';

const getExercises = async () => {
  const client = new MongoClient(process.env.MONGODB_URI!);
  const db = client.db('training_app');
  const collection = db.collection('exercises');
  
  return collection.find().toArray();
};
```

### ❌ NEVER access collections directly from API layer:
```typescript
// WRONG - This is forbidden
import { getDb } from '@/server/template/database';

const getExercises = async () => {
  const db = await getDb();
  const collection = db.collection('exercises');
  
  return collection.find().toArray();
};
```

### ❌ NEVER use direct ObjectId methods on IDs that could be UUIDs:
```typescript
// WRONG - Will crash on UUID strings from client-generated IDs
const response = {
  _id: doc._id.toHexString(),  // TypeError: toHexString is not a function
};

const item = await collection.findOne({
  _id: new ObjectId(clientId),  // BSONError: invalid ObjectId
});

// CORRECT - Use server utilities
import { toStringId, toQueryId } from '@/server/template/utils';

const response = {
  _id: toStringId(doc._id),  // Works for both ObjectId and string
};

const item = await collection.findOne({
  _id: toQueryId(clientId),  // Works for both formats
});
```

## Reference

- **Server Utilities**: `src/server/template/utils/id.ts`
- **Mutation Guidelines**: `docs/react-query-mutations.md` (client-generated IDs)
