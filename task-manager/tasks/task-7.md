---
number: 7
title: Add Automatic Branch Cleanup After PR Merge
priority: Medium
size: S
complexity: Low
status: Done
dateAdded: 2026-01-27
---

# Task 7: Add Automatic Branch Cleanup After PR Merge

**Summary:** Feature branches created during implementation are never deleted after PR merge, causing repository clutter.

## Files to Modify

- `src/server/project-management/types.ts` - Add interface method
- `src/server/project-management/adapters/github.ts` - Implement method
- `scripts/on-pr-merged.ts` - Call after successful merge
- --
