---
number: 23
title: Workflow Source Code Audit Command
priority: Medium
size: M
complexity: Medium
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-02-05
dateCompleted: 2026-02-05
completionCommit: e0bd491
---

# Task 23: Workflow Source Code Audit Command

**Summary:** Create a CLI command similar to `audit-project` but specifically for auditing workflow/agent source code quality and consistency.

## Files to Modify

- Create `scripts/audit-workflow.ts` - Main audit script
- `package.json` - Add `yarn audit-workflow` command
- Possibly create `src/agents/audit/` - Audit rules and validators

## Notes

- Should be similar in approach to existing `audit-project` command
- Output should be clear and actionable
- Consider generating a report file for review
