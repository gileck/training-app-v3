---
number: 34
title: Add list/get/update Commands to Workflow CLI
priority: Medium
size: M
complexity: Low
status: Done
dateAdded: 2026-02-01
dateUpdated: 2026-02-01
dateCompleted: 2026-02-01
completionCommit: ccbc23a
planFile: task-manager/plans/task-34-plan.md
---

# Task 34: Add list/get/update Commands to Workflow CLI

**Summary:** Extend `yarn agent-workflow` with commands to list existing items, get details of specific items, and update item status/fields

## Details

The workflow CLI currently only supports `start` and `create` commands. Add additional commands to make it a complete management tool:

- `list` - List feature requests and/or bug reports with optional filters
- `get` - Get full details of a specific item by ID
- `update` - Update status, priority, or other fields of an item

## Implementation Notes

Follow the existing CLI patterns in `src/agents/cli/`:
- Add new command handlers in `src/agents/cli/commands/`
- Use the existing database functions from `@/server/database`
- Support filtering by type (feature/bug), status, source (ui/cli/auto)

### Command Examples

```bash
# List all items
yarn agent-workflow list

# List with filters
yarn agent-workflow list --type feature --status new
yarn agent-workflow list --type bug --source cli

# Get item details
yarn agent-workflow get <id>
yarn agent-workflow get --type feature <id>

# Update item
yarn agent-workflow update <id> --status in_progress
yarn agent-workflow update <id> --priority high
```

## Files to Modify

- `src/agents/cli/commands/list.ts` - New command for listing items
- `src/agents/cli/commands/get.ts` - New command for getting item details
- `src/agents/cli/commands/update.ts` - New command for updating items
- `src/agents/cli/commands/index.ts` - Export new commands
- `src/agents/cli/index.ts` - Register new commands

## Dependencies

- Source tracking feature must be complete (done - Task from previous session)

## Notes

This completes the CLI tool as outlined in the original plan at `.claude/plans/rustling-exploring-rivest.md`
