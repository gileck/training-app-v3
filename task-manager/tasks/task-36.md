---
number: 36
title: Improve sync-template with Interactive Conflict Resolution
priority: Medium
size: L
complexity: Medium
status: Done
dateAdded: 2026-02-01
dateUpdated: 2026-02-01
dateCompleted: 2026-02-01
completionCommit: 51c495c
planFile: task-manager/plans/task-36-plan.md
---

# Task 36: Improve sync-template with Interactive Conflict Resolution

**Summary:** Enhance `yarn sync-template` to automatically add new template files and provide interactive prompts for conflicts, divergences, and deletions with common resolution options

## Details

Currently `yarn sync-template` requires manual intervention for many scenarios. This task improves the UX by:

1. **Auto-add new template files** - Files that exist in template but not in project should be automatically added (unless in projectOverrides)

2. **Interactive conflict resolution** - When files diverge between template and project, prompt the user with options:
   - **Accept template** - Overwrite with template version
   - **Keep project** - Add to projectOverrides, keep current version
   - **Merge** - Open diff view or 3-way merge
   - **Contribute to template** - Mark for upstream contribution
   - **Skip** - Skip this file for now

3. **Handle deletions** - When template removes a file:
   - **Delete locally** - Remove the file
   - **Keep (add to overrides)** - Keep file, add to projectOverrides
   - **Skip** - Decide later

4. **Batch operations** - Allow "apply to all similar" for repetitive decisions

## Implementation Notes

### Interactive Prompt Flow

```
📦 Syncing template...

✅ Auto-added: 3 new files
   - src/utils/newHelper.ts
   - docs/new-feature.md
   - config/new-config.json

⚠️  Conflicts detected: 2 files

[1/2] src/client/features/auth/store.ts
      Template: 45 lines changed
      Project: 12 lines changed (local modifications)

      ? How do you want to resolve this?
      ❯ Accept template version
        Keep project version (add to overrides)
        View diff
        Merge manually
        Contribute changes to template
        Skip for now

[2/2] src/server/api/handler.ts
      ...

🗑️  Template removed: 1 file

[1/1] src/deprecated/oldUtil.ts

      ? This file was removed from template:
      ❯ Delete locally
        Keep file (add to overrides)
        Skip for now

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Sync complete!
   Added: 3 files
   Updated: 1 file
   Skipped: 1 file
   Added to overrides: 1 file
```

### Key Features

- Use `inquirer` or similar for interactive prompts
- Show meaningful diffs (line count changes, conflict preview)
- Remember choices for "apply to all" functionality
- Update `template-sync.config.json` automatically when adding to overrides
- Support `--yes` flag for non-interactive mode (accept all template changes)
- Support `--dry-run` to preview without making changes

## Files to Modify

- `scripts/template/sync-template.ts` - Main sync logic with interactive prompts
- `scripts/template/sync-template-utils.ts` - Utility functions for diff/merge
- `template-sync.config.json` - Auto-update when adding overrides
- `docs/template/template-sync/template-sync.md` - Update documentation

## Dependencies

- Existing sync-template infrastructure
- May need to add `inquirer` or `prompts` package for interactive CLI

## Risks

- Complex edge cases with merge scenarios
- Need to handle git state properly (uncommitted changes)
- Interactive mode might not work well in CI environments

## Notes

This significantly improves the developer experience when syncing template updates, reducing manual file editing and config management.
