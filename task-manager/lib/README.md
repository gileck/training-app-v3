# Task Management Library

Centralized library for task management operations. Supports both legacy (monolithic `tasks.md`) and new (individual task files) formats during the migration period.

## Architecture

```
task-manager/
├── lib/
│   ├── types.ts           # TypeScript type definitions
│   ├── parser.ts          # Parse individual task files (YAML frontmatter)
│   ├── legacyParser.ts    # Parse legacy monolithic tasks.md
│   ├── taskReader.ts      # Read operations with auto-format detection
│   ├── taskWriter.ts      # Write operations (create, update, mark done)
│   ├── indexBuilder.ts    # Generate auto-summary index
│   └── index.ts           # Main exports
├── tasks/                 # Individual task files (new format)
│   ├── task-1.md
│   ├── task-2.md
│   └── ...
└── tasks.md               # Auto-generated summary index
```

## Format Detection

The library automatically detects which format is in use:
- **New format**: `tasks/` directory exists → reads from individual files
- **Legacy format**: No `tasks/` directory → reads from monolithic `tasks.md`

## Usage

### Reading Tasks

```typescript
import {
    getAllTasks,
    getTask,
    getTasksByStatus,
    detectFormat
} from './task-manager/lib';

// Get all tasks (auto-detects format)
const tasks = getAllTasks();

// Get specific task
const task = getTask(5);

// Get tasks by status
const openTasks = getTasksByStatus('TODO');
const inProgressTasks = getTasksByStatus('In Progress');
const doneTasks = getTasksByStatus('Done');

// Check current format
const format = detectFormat(); // 'legacy' or 'new'
```

### Creating Tasks

```typescript
import { createTask } from './task-manager/lib';

const newTask = createTask({
    title: "Add User Authentication",
    priority: "High",
    complexity: "Medium",
    size: "M",
    summary: "Add JWT-based authentication with persistent sessions",
    details: "Users need secure login...",
    filesToModify: ["src/auth/index.ts", "src/middleware/auth.ts"]
});

// Returns: Task object with assigned number
// Creates: task-manager/tasks/task-{N}.md
// Updates: task-manager/tasks.md (auto-generated summary)
```

### Updating Tasks

```typescript
import {
    updateTask,
    markTaskInProgress,
    markTaskDone
} from './task-manager/lib';

// Generic update
updateTask(5, {
    title: "Updated Title",
    details: "New details...",
});

// Mark as in progress
markTaskInProgress(5);

// Mark as done
markTaskDone(5, "abc1234"); // optional commit hash
```

### Building Index

```typescript
import {
    buildIndex,
    generateIndexMarkdown,
    rebuildTasksFile
} from './task-manager/lib';

// Build task index (in-memory)
const index = buildIndex();
console.log(index.byStatus.open.length);

// Generate markdown
const markdown = generateIndexMarkdown();

// Rebuild tasks.md from individual files
rebuildTasksFile();
```

## Task File Format

Individual task files use YAML frontmatter:

```markdown
---
number: 5
title: "Add User Authentication"
priority: High
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-27
---

# Task 5: Add User Authentication

**Summary:** Add JWT-based authentication with persistent sessions

## Details

Users need secure login functionality...

## Files to Modify

- src/auth/index.ts
- src/middleware/auth.ts
```

## CLI Integration

The CLI tool (`task-manager/tasks-cli.ts`) uses this library internally:

```bash
# List tasks (auto-detects format)
yarn task list

# View task details
yarn task view --task 5

# Work on task
yarn task work --task 5

# Mark as done
yarn task mark-done --task 5

# Migrate from legacy to new format
yarn task migrate --dry-run  # preview
yarn task migrate            # execute

# Rebuild summary index
yarn task rebuild-index
```

## Migration

To migrate from legacy to new format:

```bash
# Preview migration
yarn task migrate --dry-run

# Execute migration
yarn task migrate

# Verify
yarn task list

# Commit changes
git add task-manager/
git commit -m "refactor: migrate to individual task files"
```

**Rollback:**
```bash
cp task-manager/tasks.md.backup task-manager/tasks.md
rm -rf task-manager/tasks/
```

## Backward Compatibility

During the migration period, the library supports both formats:

- **Legacy format**: All operations work directly on `tasks.md`
- **New format**: Operations work on individual files, auto-rebuild index

CLI commands work identically in both formats.

## Auto-Generated Index

The `tasks.md` file in the new format is **auto-generated** and should not be manually edited:

```markdown
# Tasks

> **Note:** This file is auto-generated. Edit individual task files instead.

## Summary
- **Total Tasks:** 20
- **Open:** 10
- **Done:** 10

## 📋 Open Tasks (10)
### 🟠 High Priority
| # | Title | Size | Complexity |
...

## ✅ Completed Tasks (10)
| # | Title | Completed | Commit |
...
```

## Benefits

### For Developers
- Direct file paths: `tasks/task-17.md` vs searching in 1,171 lines
- No merge conflicts when multiple tasks updated
- Cleaner git diffs (single file changes)
- Better `git blame` and history tracking

### For AI Agents
- Simpler parsing (YAML vs regex)
- Update single task without affecting others
- Type-safe task handling
- Centralized logic (no duplication)

### For Maintenance
- Centralized parsing logic
- Type-safe operations (TypeScript)
- Scales to 100+ tasks easily
- Easy to add features (e.g., task dependencies graph)

## Type Definitions

See `types.ts` for complete type definitions:

```typescript
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TaskComplexity = 'Low' | 'Medium' | 'High';
export type TaskSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type TaskStatus = 'TODO' | 'In Progress' | 'Blocked' | 'Done';

export interface Task {
    number: number;
    title: string;
    priority: TaskPriority;
    complexity: TaskComplexity;
    size: TaskSize;
    status: TaskStatus;
    dateAdded: string;
    dateCompleted?: string;
    completionCommit?: string;
    summary: string;
    details?: string;
    implementationNotes?: string;
    filesToModify?: string[];
    dependencies?: string[];
    risks?: string[];
    notes?: string;
}
```
