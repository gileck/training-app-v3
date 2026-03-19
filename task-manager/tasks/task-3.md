---
number: 3
title: Add "Ready to Merge" Status with Admin Approval Gate
priority: High
size: M
complexity: Mid
status: Done
dateAdded: 2026-01-27
dateCompleted: 2026-01-24
completionCommit: b79fca0
---

# Task 3: Add "Ready to Merge" Status with Admin Approval Gate

**Summary:** Add a new workflow status between "PR Review Approved" and "Done" that requires admin approval before merging.

## Implementation Notes

Implemented differently than originally proposed - instead of a new "Ready to Merge" status with Implementor agent handling merges, we implemented a simpler Telegram-based flow:
> - PR Review Agent generates commit message on approval → saves to PR comment
> - Admin receives Telegram with Merge/Request Changes buttons
> - Merge button squash-merges with the saved commit message
> - Request Changes sends back to implementation
>
> This is simpler (no extra status needed) and more immediate (one-click merge from Telegram).

## Files to Modify

- `src/server/template/project-management/types.ts` - Add new status
- `src/agents/core-agents/implementAgent/index.ts` - Add merge validation flow
- `.github/workflows/on-pr-merged.yml` - Update status transitions
- `scripts/on-pr-merged.ts` - Handle new status
- `docs/github-projects-integration.md` - Document new flow
- --
