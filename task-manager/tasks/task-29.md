---
number: 29
title: Disable Plan Mode When Addressing PR Feedback
priority: Medium
size: S
complexity: Low
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-28
dateCompleted: 2026-01-28
completionCommit: a0a531e
---

# Task 29: Disable Plan Mode When Addressing PR Feedback

**Summary:** Plan mode should only be enabled for new PR creation, not when the implementor is addressing feedback from PR review.

## Files to Modify

- `src/agents/core-agents/implementAgent/index.ts` - Add feedback detection
- `src/agents/lib/index.ts` - Pass feedback context to plan decision
- Possibly `src/agents/shared/planSubagent.ts` - Skip logic

## Notes

- Simple check that can save cost on iterations
- Should log when plan mode is skipped and why
- Consider making this behavior configurable (always plan, never plan, smart plan)
