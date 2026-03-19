---
title: MongoDB Usage
description: Database layer patterns and schema evolution. Use this when working with MongoDB.
summary: "All operations in `src/server/database/collections/`. Use `toStringId()`, `toQueryId()`, `toDocumentId()` from `@/server/template/utils`. **CRITICAL: Always use optional chaining and fallbacks for schema backward compatibility.**"
priority: 3
related_rules:
  - mongodb-usage
---

# MongoDB Usage Guidelines

This document covers all MongoDB-related patterns, including database layer organization, ID handling, and schema evolution.

## Core Principles

1. **Encapsulation**: All MongoDB operations MUST be encapsulated within `src/server/database`
2. **No Direct MongoDB Imports**: Direct imports of `mongodb` outside the database layer are PROHIBITED
3. **Clean API Layer**: The API layer (`src/apis`) must ONLY interact through the database layer
4. **Type Safety**: All database operations should use TypeScript interfaces
5. **Use ID Utilities**: Always use `@/server/template/utils` for ID conversion

## Required Structure

```
/src
  /server
    /utils
      /id.ts                - ID conversion utilities
      /index.ts             - Exports all utilities
    /database
      /index.ts             - Exports shared utilities and collection modules
      /collections
        /<collection-name>  - One folder per MongoDB collection
          /types.ts         - TypeScript interfaces for the collection
          /<collection-name>.ts - Database operations
```

---

## ID Handling (ObjectId vs UUID)

This app supports both MongoDB ObjectId (legacy) and UUID strings (client-generated) for `_id` fields.

### Required: Use Server Utilities

```typescript
import { toStringId, toQueryId, toDocumentId } from '@/server/template/utils';
```

| Utility | Use Case | Example |
|---------|----------|---------|
| `toStringId(id)` | API responses | `{ _id: toStringId(doc._id) }` |
| `toQueryId(id)` | MongoDB queries | `{ _id: toQueryId(clientId) }` |
| `toDocumentId(id)` | Document insertion | `{ _id: toDocumentId(clientId) }` |

### Never Use Direct ObjectId Methods

```typescript
// BAD - Breaks on UUID strings
doc._id.toHexString()          // TypeError if UUID string
new ObjectId(clientId)          // BSONError if UUID string

// GOOD - Works for both formats
toStringId(doc._id)
toQueryId(clientId)
```

---

## CRITICAL: Schema Evolution & Backward Compatibility

**When modifying document schemas, you MUST account for existing documents in the database that were created before the schema change.**

### The Problem

When you add new required fields to a schema or change field types, existing documents in the database won't have those fields. This causes runtime errors when code assumes fields exist:

```typescript
// Schema change: Added `firstOccurrence: Date` as required field
// BUG: Existing documents don't have this field!
const response = {
  firstOccurrence: doc.firstOccurrence.toISOString(),  // TypeError: Cannot read properties of undefined
};
```

### Required: Defensive Coding for All Field Access

When reading documents that may have been created before a schema change:

```typescript
// CORRECT - Handle potentially missing fields
const createdAt = doc.createdAt?.toISOString() ?? new Date().toISOString();
const firstOccurrence = doc.firstOccurrence?.toISOString() ?? createdAt;
const occurrenceCount = doc.occurrenceCount ?? 1;

// WRONG - Assumes field always exists
const createdAt = doc.createdAt.toISOString();  // Crashes on legacy docs
```

### Schema Evolution Checklist

When adding new fields to a document schema:

1. **Add fields as optional in TypeScript** (with `?`) OR provide default values
2. **Use optional chaining (`?.`)** when accessing the field
3. **Provide sensible fallbacks** using nullish coalescing (`??`)
4. **Consider migration**: For critical fields, write a migration script to backfill existing documents
5. **Test with empty/partial documents** to verify backward compatibility

### Common Patterns for New Fields

**Dates:**
```typescript
// Fallback to createdAt, then to current time
const newDateField = doc.newDateField?.toISOString()
  ?? doc.createdAt?.toISOString()
  ?? new Date().toISOString();
```

**Counts:**
```typescript
// Default to 1 for count fields
const count = doc.count ?? 1;
```

**Nested Objects:**
```typescript
// Check parent exists before accessing child
const childValue = doc.parent?.child?.value ?? defaultValue;
```

**Arrays:**
```typescript
// Default to empty array
const items = doc.items ?? [];
```

### Migration Scripts (When Needed)

For important schema changes, create a migration script:

```typescript
// scripts/migrations/add-occurrence-fields.ts
const collection = await getCollection();

// Add default values to all documents missing the field
await collection.updateMany(
  { firstOccurrence: { $exists: false } },
  {
    $set: {
      firstOccurrence: new Date(),
      lastOccurrence: new Date(),
      occurrenceCount: 1
    }
  }
);
```

### Types vs Reality

Remember: TypeScript types describe the **intended** shape of documents. The **actual** documents in production may differ due to:

- Fields added after documents were created
- Fields removed but old documents still have them
- Type changes (string to Date, number to string)
- Optional fields that became required

**Always code defensively when reading from the database.**

---

## Collection Types

### Defining Collection Types

```typescript
// src/server/database/collections/exercises/types.ts
import { ObjectId } from 'mongodb';

export interface Exercise {
  _id: ObjectId;  // Can be ObjectId or string in practice
  userId: ObjectId;
  name: string;
  // New fields should be optional for backward compatibility
  newField?: string;
}

export type ExerciseCreate = Omit<Exercise, '_id'>;
export type ExerciseUpdate = Partial<Omit<Exercise, '_id' | 'userId'>>;
```

### Implementing Collection Operations

```typescript
// src/server/database/collections/exercises/exercises.ts
import { Collection, ObjectId } from 'mongodb';
import { getDb } from '@/server/template/database';
import { toQueryId } from '@/server/template/utils';
import { Exercise } from './types';

const getExercisesCollection = async (): Promise<Collection<Exercise>> => {
  const db = await getDb();
  return db.collection<Exercise>('exercises');
};

export const findExerciseById = async (
  exerciseId: string,
  userId: ObjectId | string
): Promise<Exercise | null> => {
  const collection = await getExercisesCollection();
  return collection.findOne({
    _id: toQueryId(exerciseId) as any,
    userId: typeof userId === 'string' ? new ObjectId(userId) : userId
  });
};
```

### Using in API Layer

```typescript
// src/apis/exercises/handlers/getExercise.ts
import { exercises } from '@/server/template/database';
import { toStringId } from '@/server/template/utils';

export const getExercise = async (params, context) => {
  const exercise = await exercises.findExerciseById(params.id, context.userId);
  if (!exercise) return { error: "Not found" };

  // Handle potentially missing fields with fallbacks
  return {
    exercise: {
      _id: toStringId(exercise._id),
      name: exercise.name,
      newField: exercise.newField ?? 'default',  // Backward compatible
    }
  };
};
```

---

## What NOT To Do

### Never import MongoDB directly in API layer

```typescript
// WRONG
import { MongoClient } from 'mongodb';
const client = new MongoClient(process.env.MONGODB_URI!);
```

### Never access collections directly from API layer

```typescript
// WRONG
import { getDb } from '@/server/template/database';
const db = await getDb();
const collection = db.collection('exercises');
```

### Never assume fields exist on documents

```typescript
// WRONG - Will crash on documents created before the field was added
const value = doc.newField.toString();

// CORRECT
const value = doc.newField?.toString() ?? 'default';
```

---

## Reference

- **Server Utilities**: `src/server/template/utils/id.ts`
- **Database Layer**: `src/server/database/`
- **Mutation Guidelines**: `docs/react-query-mutations.md`
