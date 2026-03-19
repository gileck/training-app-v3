---
number: 26
title: Standardize Telegram Messages and Commit Summaries
priority: Medium
size: M
complexity: Low
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-28
dateCompleted: 2026-01-28
---

# Task 26: Standardize Telegram Messages and Commit Summaries

**Summary:** Ensure all Telegram notifications and commit summaries across all workflow phases follow a consistent format and include the same issue context.

## Files to Modify

- `src/server/template/telegram.ts` - Add message formatting helpers
- `src/agents/core-agents/*/` - Update each agent to use standard formats
- `src/agents/shared/` - Create shared formatting utilities
- PR Review Agent - Ensure generated commit messages follow format

## Notes

- Consider using a template engine for flexibility
- Include issue URL in messages for easy navigation
- Phase indicators are especially important for multi-phase features
