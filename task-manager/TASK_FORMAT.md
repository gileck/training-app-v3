# Task Format Specification

This document defines the standardized format for tasks in the task management system.

## Current Structure

Tasks are stored as **individual markdown files** in `task-manager/tasks/` with YAML frontmatter. The `tasks.md` file is **auto-generated** and should not be manually edited.

```
task-manager/
├── tasks/              # Individual task files (edit these)
│   ├── task-1.md
│   ├── task-2.md
│   └── ...
├── tasks.md            # Auto-generated summary index (DO NOT EDIT)
└── lib/                # Task management library
```

## Individual Task File Format

Each task file (`tasks/task-N.md`) follows this structure:

```markdown
---
number: 5
title: "Add User Authentication"
priority: High
size: M
complexity: Medium
status: TODO
dateAdded: 2026-01-27
dateUpdated: 2026-01-28
dateCompleted: 2026-01-29
completionCommit: abc1234
---

# Task 5: Add User Authentication

**Summary:** Add JWT-based authentication with persistent sessions

## Details

Detailed description, context, problem statement, or background.

## Implementation Notes

Technical details, code snippets, API references, or implementation approach.

## Files to Modify

- `path/to/file.ts` - What needs to change
- `path/to/another.ts` - What needs to change

## Dependencies

- Task #3 must be completed first
- Requires feature X to be deployed

## Risks

- Potential issue that could delay or block this task
- Known challenges or unknowns

## Notes

Additional context or comments
```

## Field Definitions

### YAML Frontmatter (Required Metadata)

#### number
- **Type:** Integer
- **Required:** Yes
- **Auto-assigned:** By library (highest + 1)
- **Rules:** Never reuse numbers, even for deleted tasks

#### title
- **Type:** String
- **Required:** Yes
- **Format:** Clear, actionable title in imperative form
- **Rules:**
  - Start with verb when possible: "Add", "Fix", "Refactor", "Update"
  - Keep concise (< 80 characters)
- **Examples:**
  - `"Add User Authentication"`
  - `"Fix Login Bug"`
  - `"Refactor Database Layer"`

#### priority
- **Type:** `Critical` | `High` | `Medium` | `Low`
- **Required:** Yes
- **Definitions:**
  - **Critical:** Blocks other work, production issue, or security vulnerability
  - **High:** Important for current milestone, impacts user experience
  - **Medium:** Should be done soon, but not urgent
  - **Low:** Nice to have, can be deferred

#### complexity
- **Type:** `Low` | `Medium` | `High`
- **Required:** Yes
- **Definitions:**
  - **Low:** Straightforward, well-understood, minimal unknowns
  - **Medium:** Some complexity, may require design decisions
  - **High:** Complex problem, significant unknowns, architectural impact

#### size
- **Type:** `XS` | `S` | `M` | `L` | `XL`
- **Required:** Yes
- **Definitions:**
  - **XS:** < 1 hour, 1-2 files, < 50 lines changed
  - **S:** 1-4 hours, 2-5 files, 50-100 lines changed
  - **M:** 4-8 hours, 5-15 files, 100-500 lines changed
  - **L:** 1-3 days, 15-30 files, 500-1000 lines changed
  - **XL:** 3+ days, 30+ files, 1000+ lines changed

#### status
- **Type:** `TODO` | `In Progress` | `Blocked` | `Done`
- **Required:** Yes
- **Default:** `TODO` for new tasks
- **Definitions:**
  - **TODO:** Not started, ready to work on
  - **In Progress:** Currently being worked on
  - **Blocked:** Cannot proceed due to dependency or issue
  - **Done:** Completed and verified

#### dateAdded
- **Type:** String (YYYY-MM-DD format)
- **Required:** Yes
- **Auto-set:** By library to current date

#### dateUpdated
- **Type:** String (YYYY-MM-DD format)
- **Required:** No
- **Auto-set:** By library when task is modified

#### dateCompleted
- **Type:** String (YYYY-MM-DD format)
- **Required:** No (only for completed tasks)
- **Auto-set:** By library when marking task as done

#### completionCommit
- **Type:** String (git commit hash)
- **Required:** No (optional for completed tasks)
- **Set by:** User when marking task as done

#### planFile
- **Type:** String (file path)
- **Required:** No
- **Format:** Path to implementation plan file (e.g., `task-manager/plans/task-5-plan.md`)
- **Set by:** `/plan-task` command or manually
- **Usage:** When present, `/start-task` will use this plan instead of creating a new one

### Markdown Body (Optional Sections)

#### Summary
- **Required:** Yes
- **Format:** `**Summary:** One-sentence description`
- **Rules:** Keep concise, describe the goal/outcome

#### Details
- **Required:** No
- **Format:** Markdown section with heading `## Details`
- **Content:** Extended description, problem statement, background

#### Implementation Notes
- **Required:** No
- **Format:** Markdown section with heading `## Implementation Notes`
- **Content:** Technical approach, code examples, API references

#### Files to Modify
- **Required:** No
- **Format:** Markdown section with bulleted list
- **Example:**
  ```markdown
  ## Files to Modify

  - `src/auth/index.ts` - Add JWT middleware
  - `src/routes/users.ts` - Add authentication check
  ```

#### Dependencies
- **Required:** No
- **Format:** Markdown section with bulleted list
- **Example:**
  ```markdown
  ## Dependencies

  - Task #3 must be completed first
  - Requires MongoDB migration
  ```

#### Risks
- **Required:** No
- **Format:** Markdown section with bulleted list
- **Example:**
  ```markdown
  ## Risks

  - May require database schema change
  - Performance impact on login endpoint
  ```

#### Notes
- **Required:** No
- **Format:** Markdown section with free-form text
- **Content:** Additional context, historical decisions

## Auto-Generated Summary Index

The `tasks.md` file is automatically generated by the library:

```markdown
# Tasks

> **Note:** This file is auto-generated. Edit individual files in tasks/

## Summary
- **Total Tasks:** 20
- **Open:** 10
- **In Progress:** 2
- **Done:** 8

## 📋 Open Tasks (10)

### 🟠 High Priority
| # | Title | Size | Complexity |
|---|-------|------|------------|
| 5 | Add User Authentication | M | Medium |

## ✅ Completed Tasks (8)
| # | Title | Completed | Commit |
|---|-------|-----------|--------|
| 1 | ~~Fix Login Bug~~ | 2026-01-24 | `abc1234` |
```

**Important:**
- **DO NOT** manually edit `tasks.md`
- It is rebuilt automatically by the library after any task modification
- To modify tasks, edit individual files in `tasks/task-N.md`
- Or use the CLI: `yarn task --help`

## Creating Tasks

### Using the Library

```typescript
import { createTask } from './task-manager/lib';

const task = createTask({
    title: "Add User Authentication",
    priority: "High",
    complexity: "Medium",
    size: "M",
    summary: "Add JWT-based authentication",
    details: "Users need secure login...",
    filesToModify: ["src/auth/index.ts"]
});
// Creates: task-manager/tasks/task-{N}.md
// Updates: task-manager/tasks.md (auto)
```

### Using the CLI

```bash
# Use the interactive slash command
/add-task

# Or manually create task-{N}.md in tasks/
# Then rebuild index:
yarn task rebuild-index
```

## Updating Tasks

### Using the Library

```typescript
import { updateTask, markTaskInProgress, markTaskDone } from './task-manager/lib';

// Update any fields
updateTask(5, { title: "New Title", details: "Updated details" });

// Mark as in progress
markTaskInProgress(5);

// Mark as done
markTaskDone(5, "abc1234"); // optional commit hash
```

### Using the CLI

```bash
# Mark as in progress
yarn task mark-in-progress --task 5

# Mark as done
yarn task mark-done --task 5 --commit abc1234

# Or manually edit tasks/task-5.md
# Then rebuild index:
yarn task rebuild-index
```

## Migration from Legacy Format

To migrate from the old monolithic `tasks.md` to individual files:

```bash
# Preview migration
yarn task migrate --dry-run

# Execute migration
yarn task migrate

# Verify
yarn task list
```

The migration:
1. Backs up `tasks.md` to `tasks.md.backup`
2. Creates `tasks/` directory
3. Writes individual `task-N.md` files with YAML frontmatter
4. Regenerates `tasks.md` as auto-summary

## Best Practices

1. **Always use the library or CLI** - Don't manually manipulate files
2. **Task numbers are sequential** - Never reuse numbers
3. **Summary index is auto-generated** - Don't edit `tasks.md` directly
4. **Use meaningful titles** - Start with action verbs
5. **Include summaries** - One-sentence description required
6. **Document dependencies** - Help planning and prioritization
7. **Track completion** - Include commit hash when marking done

## Tools & Commands

```bash
# View all tasks
yarn task list

# View specific task
yarn task view --task 5

# Work on task
yarn task work --task 5

# Create worktree
yarn task worktree --task 5

# Mark in progress
yarn task mark-in-progress --task 5

# Mark done
yarn task mark-done --task 5 --commit abc1234

# Rebuild index
yarn task rebuild-index

# Migrate from legacy
yarn task migrate
```

## See Also

- `task-manager/lib/README.md` - Library documentation
- `task-manager/README.md` - Task management overview
- `.claude/commands/add-task.md` - Interactive task creation
