---
number: 27
title: Fix PR Descriptions and Commit Messages
priority: Medium
size: M
complexity: Medium
status: Done
dateAdded: 2026-01-27
dateUpdated: 2026-01-28
dateCompleted: 2026-01-28
---

# Task 27: Fix PR Descriptions and Commit Messages

**Summary:** Improve the quality and consistency of auto-generated PR descriptions and commit messages produced by the workflow agents.

## Files to Modify

- `src/agents/core-agents/prReviewAgent/` - Improve commit message generation
- `src/agents/core-agents/implementAgent/` - Improve PR description generation
- Create `src/agents/shared/formatting/` - Shared formatting utilities
- Add prompt improvements for better output quality

## Notes

- PR descriptions should be ready for squash-merge without editing
- Consider adding a validation step before creating PR
- May want to use PR Review Agent to also review the description quality
