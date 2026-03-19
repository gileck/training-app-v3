# Task 34: Add list/get/update Commands to Workflow CLI - Implementation Plan

## Objective

Extend the `yarn agent-workflow` CLI tool with three new commands (`list`, `get`, `update`) to enable complete management of feature requests and bug reports from the command line, completing the CLI as a full management tool.

## Approach

The implementation will follow the existing patterns established by `start.ts` and `create.ts`:

1. **Command Structure**: Each command gets its own file in `src/agents/cli/commands/`
2. **Argument Parsing**: Extend `parse-args.ts` to handle new command-specific arguments
3. **Database Access**: Use existing database functions from `@/server/template/database` (specifically `featureRequests` and `reports` namespaces)
4. **Output Formatting**: Implement consistent table/detail output formats for CLI display

**Key Design Decisions:**

1. **Unified Item Handling**: Since feature requests and bug reports have different schemas but similar CLI needs, create a unified approach that:
   - Uses `--type feature|bug` to filter by type
   - Outputs type-appropriate fields in listings
   - Handles type-specific update fields (e.g., `priority` only for features)

2. **ID Handling**: Support both full MongoDB ObjectId strings and short prefixes (first 8 chars) for convenience

3. **Output Formatting**:
   - `list`: Tabular format with columns: ID, Type, Status, Title/Description, Source, Created
   - `get`: Detailed single-item view with all fields
   - `update`: Show before/after state for confirmation

## Sub-tasks

- [ ] **1. Create `list.ts` command handler**
  - Implement `handleList(args: string[])` function
  - Query both `featureRequests.findFeatureRequests()` and `reports.findReports()` based on filters
  - Support filters: `--type`, `--status`, `--source`
  - Format output as table with truncated titles
  - Show ID prefix (first 8 chars) for easier use with `get` and `update`

- [ ] **2. Create `get.ts` command handler**
  - Implement `handleGet(args: string[])` function
  - Accept positional `<id>` argument
  - Support optional `--type` to optimize lookup (search specific collection first)
  - If no type specified, search both collections
  - Display full item details including: all fields, GitHub links if synced, timestamps

- [ ] **3. Create `update.ts` command handler**
  - Implement `handleUpdate(args: string[])` function
  - Accept positional `<id>` argument
  - Support `--status`, `--priority` flags
  - Validate status values against allowed values per type
  - Validate priority values (features only)
  - Show current vs new values before applying
  - Support `--dry-run` flag

- [ ] **4. Extend `parse-args.ts` for new arguments**
  - Add `id?: string` for positional ID argument
  - Add `status?: string` for filtering/updating
  - Add new validation functions: `validateListArgs()`, `validateGetArgs()`, `validateUpdateArgs()`

- [ ] **5. Update `commands/index.ts` to export new handlers**
  - Export `handleList`, `handleGet`, `handleUpdate`

- [ ] **6. Update main `cli/index.ts`**
  - Register `list`, `get`, `update` commands in `COMMANDS` map
  - Update `printUsage()` with new command documentation

- [ ] **7. Add formatting utilities**
  - Create output formatting helper in `utils/` for table display
  - Handle date formatting for CLI output
  - Handle ID truncation for display

## Files to Modify

- `src/agents/cli/commands/list.ts` - **NEW FILE** - List command implementation
- `src/agents/cli/commands/get.ts` - **NEW FILE** - Get command implementation
- `src/agents/cli/commands/update.ts` - **NEW FILE** - Update command implementation
- `src/agents/cli/commands/index.ts` - Export new command handlers
- `src/agents/cli/index.ts` - Register commands and update usage docs
- `src/agents/cli/utils/parse-args.ts` - Add new argument parsing and validation
- `src/agents/cli/utils/format.ts` - **NEW FILE** (optional) - Output formatting utilities

## Implementation Details

### list.ts Command

```typescript
// Filters
interface ListFilters {
  type?: 'feature' | 'bug';   // Filter by item type
  status?: string;             // Filter by status
  source?: 'ui' | 'cli' | 'auto'; // Filter by source
}

// Example output format:
// ID        TYPE     STATUS        TITLE                          SOURCE   CREATED
// a1b2c3d4  feature  in_progress   Add dark mode                  cli      2024-01-15
// e5f6g7h8  bug      new           Login fails on mobile          ui       2024-01-14
```

### get.ts Command

```typescript
// Searches both collections if --type not provided
// Shows full document details formatted for readability
// Includes GitHub links if synced
```

### update.ts Command

```typescript
// Valid status transitions per type:
// Feature: new -> in_progress -> done | rejected
// Bug: new -> investigating -> resolved | closed

// Priority (features only): low, medium, high, critical
```

### Status Value Mapping

**Feature Request Statuses:**
- `new` - Not yet synced to GitHub
- `in_progress` - Synced to GitHub
- `done` - Completed
- `rejected` - Not implementing

**Bug Report Statuses:**
- `new` - Not yet investigated
- `investigating` - Being looked at
- `resolved` - Fixed
- `closed` - Closed (won't fix, duplicate, etc.)

## Notes

1. **Database Functions Already Exist**: The database layer already has all needed functions:
   - `findFeatureRequests(filters)` and `findReports(filters)` for listing
   - `findFeatureRequestById(id)` and `findReportById(id)` for getting
   - `updateFeatureRequestStatus(id, status)` and `updateReportStatus(id, status)` for updates
   - `updatePriority(id, priority)` for feature priority updates

2. **Source Filter Support**: Both collections already support the `source` field in their filter interfaces (`FeatureRequestFilters.source` and `ReportFilters.source`), so no database changes needed.

3. **No Delete Command**: The task description only mentions list/get/update. Delete could be added later but is not in scope.

4. **Error Handling**: Follow existing pattern from `create.ts` - validate inputs early, exit with code 1 on errors, show helpful error messages.

5. **ID Prefix Matching**: Consider implementing a helper that finds items by ID prefix (first 8 chars) for better UX, falling back to full ID match.

## Critical Files for Reference

- `src/agents/cli/commands/create.ts` - Pattern to follow for command structure and database imports
- `src/agents/cli/utils/parse-args.ts` - Argument parsing patterns and validation approach
- `src/server/database/collections/feature-requests/feature-requests.ts` - Database functions for feature requests
- `src/server/database/collections/reports/reports.ts` - Database functions for bug reports
- `src/server/database/collections/feature-requests/types.ts` - Type definitions and status/source enums
